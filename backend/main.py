from http.server import BaseHTTPRequestHandler, HTTPServer
from models.customer_model import init_db, add_customer
import json
import sqlite3
from models.customer_model import init_db, add_customer, get_customer, DB_FILE
from models.fridge_model import get_all_fridges, update_fridge
from models.fridge_reading_model import get_latest_reading
from models.product_model import get_all_products, add_product, update_product, delete_product
from models.stock_reception_model import add_stock_reception
from models.user_model import authenticate_user
import secrets #This is included in python and I will use it to generate random login tokens 
from models.purchase_model import get_customer_purchases, get_customer_receipt, complete_purchase
from contextlib import closing

def get_connection():
    return sqlite3.connect("../Database/iot.db")

from breadboardCode import login
#retrieve alerts for the dashboard
from models.alert_model import get_all_alerts
from models.notification_model import get_user_notifications
import sys

if sys.platform == "win32":
    mqttProj = None
else:
    import mqttProj


def hardware_feedback(attempt):
    try:
        login(attempt)
    except Exception as error:
        print(f"Hardware feedback unavailable: {error}")

SESSIONS = {} # is a python dictionnary(associative array)

class Server(BaseHTTPRequestHandler):

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE,  OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization") #The frontend is allowed to send the login token
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    #Reads frontends token to match with what we have in the SESsIONS array
    def get_logged_in_user_id(self):
        auth_header = self.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]

        return SESSIONS.get(token)
    
    def do_GET(self):
        if self.path == "/account/purchases":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            purchases = get_customer_purchases(user_id)

            self.send_json(200, purchases)
            return
        # Get all fridge dashboard data
        if self.path == "/fridges/dashboard":
            dashboard = []

            for fridge in get_all_fridges():
                data = dict(fridge)
                reading = get_latest_reading(data["fridge_id"])

                data["latest_reading"] = dict(reading) if reading else None
                dashboard.append(data)

            self.send_json(200, dashboard)
            return
        # Get all refrigerators
        if self.path.rstrip("/") == "/fridges":
            try:
                with get_connection() as conn:
                    cursor = conn.execute("""
                        SELECT
                            f.fridge_id,
                            f.fridge_name,
                            f.fridge_location,
                            f.fridge_min_temperature,
                            f.fridge_max_temperature,
                            f.fridge_min_humidity,
                            f.fridge_max_humidity,
                            r.reading_temperature,
                            r.reading_humidity,
                            r.reading_recorded_at
                        FROM Fridges AS f
                        LEFT JOIN FridgeReadings AS r
                            ON r.reading_id = (
                                SELECT r2.reading_id
                                FROM FridgeReadings AS r2
                                WHERE r2.fridge_id = f.fridge_id
                                ORDER BY
                                    r2.reading_recorded_at DESC,
                                    r2.reading_id DESC
                                LIMIT 1
                            )
                        ORDER BY f.fridge_id
                    """)

                    columns = [column[0] for column in cursor.description]
                    fridges = [
                        dict(zip(columns, row))
                        for row in cursor.fetchall()
                    ]

                self.send_json(200, fridges)

            except Exception as error:
                print(f"Fridge fetch error: {error}")
                self.send_json(
                    500,
                    {"error": "Could not load fridge data"}
                )

            return
        if self.path == "/alerts":
            alerts = get_all_alerts()
            self.send_json(200, [dict(alert) for alert in alerts])
            return
            # checks for path, gets the products, and sends a json response
        if self.path == "/products":
            products = get_all_products()
            self.send_json(200, products)
            return

        # Get the latest reading for a specific refrigerator
        parts = self.path.strip("/").split("/")
        if len(parts) == 3 and parts[0] == "account" and parts[1] == "purchases":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            if not parts[2].isdigit():
                self.send_json(400, {"error": "Invalid purchase ID"})
                return

            purchase_id = int(parts[2])
            receipt = get_customer_receipt(user_id, purchase_id)

            if receipt is None:
                self.send_json(404, {"error": "Receipt not found"})
                return

            self.send_json(200, receipt)
            return

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
        # Get notifications for a user
        if len(parts) == 3 and parts[0] == "users" and parts[2] == "notifications":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid user ID"})
                return

            user_id = int(parts[1])
            notifications = get_user_notifications(user_id)

            self.send_json(200, [dict(n) for n in notifications])
            return

            #Reads the token and looks for the user ID, gets customers info
        if self.path == "/account":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            customer = get_customer(user_id)

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            self.send_json(200, dict(customer)) #converts the db row into a dictio0nnary that we can send using send_json()
            return

        self.send_json(404, {"error": "Route not found"})


    def do_DELETE(self):
        parts = self.path.strip("/").split("/")

        if len(parts) != 2 or parts[0] != "products":
            self.send_json(404, {"error": "Route not found"})
            return

        if not parts[1].isdigit():
            self.send_json(400, {"error": "Invalid product ID"})
            return

        product_id = int(parts[1])
        deleted = delete_product(product_id)

        if deleted:
            self.send_json(200, {"message": "Product removed"})
        else:
            self.send_json(404, {"error": "Active product not found"})


    # Update the maximum temperature for a refrigerator
    def do_PUT(self):
        #splits after the / and divides the request in 2 (that's what we need), then checks if we have 2 parts and 1 is products, then checks if part 1 is a digit to accept

        parts = self.path.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "products":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid product ID"})
                return

            product_id = int(parts[1])

            try:
                length = int(self.headers.get("Content-Length", 0))

                if length <= 0:
                    self.send_json(400, {"error": "Request body is empty"})
                    return

                data = json.loads(self.rfile.read(length))
            except ValueError:
                self.send_json(400, {"error": "Invalid JSON"})
                return

            if not isinstance(data, dict):
                self.send_json(400, {"error": "Request body must be a JSON object"})
                return

            required_fields = [
                "product_name",
                "product_category",
                "product_upc",
                "product_producer_company"
            ]

            for field in required_fields:
                value = data.get(field)

                if not isinstance(value, str) or not value.strip():
                    self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                    return

            price = data.get("product_price")

            if type(price) is not int or price < 0:
                self.send_json(400, {"error": "Price must be a non-negative integer in cents"})
                return

            try:
                updated = update_product(
                    product_id,
                    data["product_name"].strip(),
                    data["product_category"].strip(),
                    price,
                    data["product_upc"].strip(),
                    data["product_producer_company"].strip()
                )
            except sqlite3.IntegrityError:
                self.send_json(400, {"error": "Invalid product data or UPC already registered"})
                return

            if updated:
                self.send_json(200, {"message": "Product updated"})
            else:
                self.send_json(404, {"error": "Product not found"})

            return

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
        except ValueError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict) or type(data.get("min_temperature")) not in (int, float):
            self.send_json(400, {"error": "Invalid temperature"})
            return

        try:
            updated = update_fridge(
                fridge_id,
                fridge_min_temperature=data["min_temperature"]
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
            #Create a product
        if self.path == "/products":
            self.create_product()
            return
        if self.path == "/stock-receptions":
            self.receive_stock()
            return
        if self.path == "/login":
            self.login_user()
            return
        if self.path == "/checkout":
            self.complete_checkout()
            return

        self.send_json(404, {"error": "Route not found"})
    #Checks email, password, uses authenticate_user and then returns a JSON reponse
    def login_user(self):
        try:
            content_len = int(self.headers.get("Content-Length", 0))

            if content_len <= 0:
                self.send_json(400, {"error": "Request body is empty"})
                return

            body = self.rfile.read(content_len)
            data = json.loads(body)

        except ValueError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict):
            self.send_json(
                400,
                {"error": "Request body must be a JSON object"}
            )
            return

        required_fields = ["email", "password"]

        for field in required_fields:
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                self.send_json(
                    400,
                    {"error": f"Missing or invalid field: {field}"}
                )
                return

        try:
            user = authenticate_user(
                data["email"],
                data["password"]
            )

        except sqlite3.Error as error:
            print(f"Login database error: {error}")
            self.send_json(500, {"error": "Could not log in"})
            return

        if not user:
            self.send_json(
                401,
                {"error": "Invalid email or password"}
            )
            return

        token = secrets.token_urlsafe(32) #Gnerates random text tocken 32 bytes

        SESSIONS[token] = user["user_id"] #Adds a pair to the array

        self.send_json(
            200,
            {
                "message": "Login successful",
                "token": token, #Frontend receives the token value
                "user": user
            }
        )
#Reads the given ProductID, positive quantity. Returns new receptionID
    def receive_stock(self):
        try:
            content_len = int(self.headers.get("Content-Length", 0))

            if content_len <= 0:
                self.send_json(400, {"error": "Request body is empty"})
                return

            body = self.rfile.read(content_len)
            data = json.loads(body)

        except ValueError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict):
            self.send_json(
                400,
                {"error": "Request body must be a JSON object"}
            )
            return

        product_id = data.get("product_id")
        quantity = data.get("quantity")
        note = data.get("note")

        if type(product_id) is not int or product_id <= 0:
            self.send_json(400, {"error": "Invalid product ID"})
            return

        if type(quantity) is not int or quantity <= 0:
            self.send_json(
                400,
                {"error": "Quantity must be a positive integer"}
            )
            return

        if note is not None and not isinstance(note, str):
            self.send_json(400, {"error": "Note must be text"})
            return

        try:
            reception_id = add_stock_reception(
                product_id,
                quantity,
                note
            )

            self.send_json(
                201,
                {
                    "message": "Stock received",
                    "reception_id": reception_id
                }
            )

        except sqlite3.IntegrityError as error:
            print(f"Stock reception error: {error}")
            self.send_json(
                400,
                {"error": "Product does not exist or stock data is invalid"}
            )


    def complete_checkout(self):
        customer_id = self.get_logged_in_user_id()

        if self.headers.get("Authorization") is not None and customer_id is None:
            self.send_json(401, {"error": "Please log in again"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))

            if length <= 0:
                self.send_json(400, {"error": "Request body is empty"})
                return

            data = json.loads(self.rfile.read(length))

        except ValueError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict):
            self.send_json(
                400,
                {"error": "Request body must be a JSON object"}
            )
            return

        try:
            purchase_id = complete_purchase(
                customer_id,
                data.get("epcs")
            )

            receipt = get_customer_receipt(customer_id, purchase_id)
            self.send_json(201, receipt)

        except ValueError as error:
            self.send_json(400, {"error": str(error)})

        except sqlite3.IntegrityError as error:
            print(f"Checkout database error: {error}")
            self.send_json(400, {"error": "Invalid purchase data"})

        except sqlite3.Error as error:
            print(f"Checkout error: {error}")
            self.send_json(500, {"error": "Could not complete purchase"})


    #Read request, check given information, check price in cents, save product and send json result

    def create_product(self):
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
            self.send_json(
                400,
                {"error": "Request body must be a JSON object"}
            )
            return

        required_fields = [
            "product_name",
            "product_category",
            "product_upc",
            "product_producer_company"
        ]

        for field in required_fields:
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                self.send_json(
                    400,
                    {"error": f"Missing or invalid field: {field}"}
                )
                return

        price = data.get("product_price")

        if type(price) is not int or price < 0:
            self.send_json(
                400,
                {"error": "Price must be a non-negative integer in cents"}
            )
            return

        try:
            product_id = add_product(
                data["product_name"].strip(),
                data["product_category"].strip(),
                price,
                data["product_upc"].strip(),
                data["product_producer_company"].strip()
            )

            self.send_json(
                201,
                {
                    "message": "Product added",
                    "product_id": product_id
                }
            )

        except sqlite3.IntegrityError as error:
            print(f"Product database error: {error}")
            self.send_json(
                400,
                {"error": "Invalid product data or UPC already registered"}
            )

        except Exception as error:
            print(f"Product creation error: {error}")
            self.send_json(500, {"error": "Could not add product"})


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
            self.send_json(
                400,
                {"error": "Request body must be a JSON object"}
            )
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
                self.send_json(
                    400,
                    {"error": f"Missing or invalid field: {field}"}
                )
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
                data["password"]
            )
            customer = get_customer(customer_id) #Uses ID to get the Info 

            hardware_feedback(True)

            self.send_json(
                201,
                {
                    "message": "Customer added",
                    "customer_id": customer_id,
                    "customer_code": customer["customer_code"] #include the MEM number in the response
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

    if mqttProj is not None:
        mqttProj.start(db_path=DB_FILE)

    server_address = ("0.0.0.0", 5050)
    server = HTTPServer(server_address, Server)

    print("Server running on http://localhost:5050")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    finally:
        server.server_close()

        if mqttProj is not None:
            mqttProj.stop()


if __name__ == "__main__":
    run_server()
