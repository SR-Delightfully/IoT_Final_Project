from http.server import BaseHTTPRequestHandler, HTTPServer

from models.database import init_db, DB_FILE
from models.checkout_models.model_products import get_all_products
from services.self_checkout import SelfCheckout
from services.rfid_reader import RFIDReader
from models.management_models.model_fridges import get_all_fridges, update_fridge
from models.management_models.model_readings import get_latest_reading
from models.management_models.model_alerts import get_all_alerts
from models.management_models.model_notifications import get_user_notifications
from models.management_models.model_stock_receipts import (
    get_all_stock_receipts,
    get_stock_receipt,
    get_stock_receipt_items,
    add_stock_receipt,
    delete_stock_receipt
)

from models.client_models.model_customers import add_customer

from contextlib import closing
from services.breadboardCode import login
import json
import sqlite3
import sys

if sys.platform == "win32":
    mqttProj = None
else:
    import mqttProj

def hardware_feedback(*attempt):
    try:
        login(*attempt)
    except Exception as error:
        print(f"Hardware feedback unavailable: {error}")


class Server(BaseHTTPRequestHandler):

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):

        if self.path.rstrip("/") == "/fridges":
            try:
                dashboard = []

                for fridge in get_all_fridges():
                    data = dict(fridge)
                    reading = get_latest_reading(data["fridge_id"])
                    data["latest_reading"] = dict(reading) if reading else None
                    dashboard.append(data)

                self.send_json(200, {"fridges": dashboard})

            except Exception as error:
                print(f"Fridge fetch error: {error}")
                self.send_json(500, {"error": "Could not load fridge data"})

            return

        if self.path == "/alerts":
            try:
                alerts = get_all_alerts()
                self.send_json(200, [dict(alert) for alert in alerts])
            except Exception as error:
                print(f"Alert fetch error: {error}")
                self.send_json(500, {"error": "Could not load alerts"})
            return

        parts = self.path.strip("/").split("/")

        if len(parts) == 3 and parts[0] == "fridges" and parts[2] == "latest":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid refrigerator ID"})
                return

            fridge_id = int(parts[1])
            reading = get_latest_reading(fridge_id)

            if reading:
                self.send_json(200, dict(reading))
            else:
                self.send_json(404, {"error": "No readings found"})

            return

        if len(parts) == 3 and parts[0] == "users" and parts[2] == "notifications":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid user ID"})
                return

            user_id = int(parts[1])
            notifications = get_user_notifications(user_id)

            self.send_json(200, [dict(n) for n in notifications])
            return

        if self.path.rstrip("/") == "/products":
            try:
                products = []

                for product in get_all_products():
                    if not product["product_is_active"]:
                        continue

                    data = dict(product)
                    data["product_price"] = round(data["product_price_cents"] / 100, 2)
                    data["product_stock"] = data["product_stock_quantity"]
                    data["product_category"] = data.pop("category_name", None)
                    data["product_barcode"] = data.pop("barcode_value", None)

                    products.append(data)

                self.send_json(200, products)

            except Exception as error:
                print(f"Product fetch error: {error}")
                self.send_json(500, {"error": "Could not load products"})

            return
        
        if len(parts) == 3 and parts[0] == "checkout" and parts[1] == "session":
            if not parts[2].isdigit():
                self.send_json(400, {"error": "Invalid checkout session ID"})
                return

            try:
                cart = self.checkout.get_cart(int(parts[2]))

                if cart is None:
                    self.send_json(404, {"error": "Checkout session not found"})
                else:
                    self.send_json(200, cart)

            except Exception as error:
                print(f"Checkout cart error: {error}")
                self.send_json(500, {"error": "Could not load checkout cart"})

            return    
        
        self.send_json(404, {"error": "Route not found"})

    def do_PUT(self):
        parts = self.path.strip("/").split("/")

        if len(parts) != 3 or parts[0] != "fridges" or parts[2] != "threshold":
            self.send_json(404, {"error": "Route not found"})
            return

        if not parts[1].isdigit():
            self.send_json(400, {"error": "Invalid fridge ID"})
            return

        fridge_id = int(parts[1])

        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict) or type(data.get("max_temperature")) not in (int, float):
            self.send_json(400, {"error": "Invalid temperature"})
            return

        try:
            updated = update_fridge(
                fridge_id,
                fridge_max_temperature=data["max_temperature"]
            )
        except sqlite3.IntegrityError:
            self.send_json(400, {"error": "Temperature violates fridge limits"})
            return

        if updated:
            self.send_json(200, {"message": "Threshold updated"})
        else:
            self.send_json(404, {"error": "Fridge not found"})

    def do_POST(self):

        if self.path == "/register":
            self.register_customer()
            return

        if self.path == "/checkout/session":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length)) if length else {}

                if not isinstance(data, dict):
                    raise ValueError

                user_id = data.get("user_id")

                if user_id is not None and (type(user_id) is not int or user_id <= 0):
                    self.send_json(400, {"error": "Invalid user ID"})
                    return

                session_id = self.checkout.create_session(user_id)

                self.send_json(201, {
                    "session_id": session_id,
                    "session_status": "ACTIVE"
                })

            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"error": "Invalid session request"})

            except sqlite3.IntegrityError as error:
                print(f"Checkout session database error: {error}")
                self.send_json(400, {"error": "Could not create checkout session"})

            except Exception as error:
                print(f"Checkout session error: {error}")
                self.send_json(500, {"error": "Could not create checkout session"})

            return

        if self.path == "/checkout":
            try:
                length = int(self.headers.get("Content-Length", 0))

                if length <= 0:
                    self.send_json(400, {"error": "Request body is empty"})
                    return

                data = json.loads(self.rfile.read(length))

                if not isinstance(data, dict):
                    self.send_json(400, {"error": "Request body must be a JSON object"})
                    return

                session_id = data.get("session_id")
                customer_id = data.get("customer_id")
                payment_method = data.get("payment_method")

                if type(session_id) is not int or session_id <= 0:
                    self.send_json(400, {"error": "A valid session_id is required"})
                    return

                if customer_id is not None and (type(customer_id) is not int or customer_id <= 0):
                    self.send_json(400, {"error": "Invalid customer ID"})
                    return

                receipt = self.checkout.complete_purchase(
                    session_id,
                    customer_id=customer_id,
                    payment_method=payment_method
                )

                self.send_json(201, receipt)

            except (ValueError, json.JSONDecodeError) as error:
                self.send_json(400, {"error": str(error) or "Invalid checkout request"})

            except sqlite3.IntegrityError as error:
                print(f"Checkout database error: {error}")
                self.send_json(409, {"error": "Could not complete this purchase"})

            except Exception as error:
                print(f"Checkout error: {error}")
                self.send_json(500, {"error": "Could not complete checkout"})

            return

        self.send_json(404, {"error": "Route not found"})

    def register_customer(self):
        try:
            content_len = int(self.headers.get("Content-Length", 0))

            if content_len <= 0:
                self.send_json(400, {"error": "Request body is empty"})
                return

            body = self.rfile.read(content_len)
            data = json.loads(body)

        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict):
            self.send_json(400, {"error": "Request body must be a JSON object"})
            return

        required_fields = [
            "first_name",
            "last_name",
            "address",
            "phone",
            "email",
            "password",
            "confirm_password"
        ]

        for field in required_fields:
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                return

        if data["password"] != data["confirm_password"]:
            hardware_feedback(False)
            self.send_json(400, {"error": "Passwords do not match"})
            return

        try:
            customer_id = add_customer(
                data["first_name"],
                data["last_name"],
                data["address"],
                data["phone"],
                data["email"],
                data["password"],
                is_member=data.get("is_member", False)
            )

            hardware_feedback(True)

            self.send_json(
                201,
                {
                    "message": "Customer added",
                    "customer_id": customer_id
                }
            )

        except sqlite3.IntegrityError as error:
            hardware_feedback(False)
            print(f"Registration database error: {error}")
            self.send_json(
                409,
                {"error": "This email or customer code is already registered"}
            )

        except Exception as error:
            hardware_feedback(False)
            print(f"Registration error: {error}")
            self.send_json(500, {"error": "Could not add customer"})


def run_server():
    init_db()

    checkout = SelfCheckout()
    reader = RFIDReader()
    Server.checkout = checkout

    if mqttProj is not None:
        mqttProj.start(db_path=DB_FILE)

    reader.start(checkout.process_rfid)

    server_address = ("0.0.0.0", 5050)
    server = HTTPServer(server_address, Server)

    print("Server running on http://localhost:5050")

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nServer stopped")

    finally:
        reader.stop()
        server.server_close()

        if mqttProj is not None:
            mqttProj.stop()

if __name__ == "__main__":
    run_server()
