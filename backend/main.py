
from http.server import BaseHTTPRequestHandler, HTTPServer

from models.database import init_db, DB_FILE
from models.checkout_models.model_products import get_all_products, update_product, add_product_with_barcode, update_product_with_barcode
from models.checkout_models.model_purchases import get_customer_purchases # purchase history.
from models.client_models.model_users import authenticate_user
from services.self_checkout import SelfCheckout
from services.rfid_reader import RFIDReader
from models.management_models.model_fridges import get_all_fridges, update_fridge
from models.management_models.model_readings import get_latest_reading
from models.management_models.model_alerts import get_all_alerts
from models.management_models.model_notifications import get_user_notifications
from models.client_models.model_customers import add_customer
from models.management_models.model_stock_receipts import add_stock_receipt

from services.breadboardCode import login
import json
import sqlite3
import secrets
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

SESSIONS = {} # is a python dictionnary(associative array)

class Server(BaseHTTPRequestHandler):

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")  #Frontend can send the token to us
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))

        if length <= 0:
            return {}

        data = json.loads(self.rfile.read(length))

        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object")

        return data

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
#While merging: Kept patch and authorization, kept token and protected purchase history, kept Sabrina's normalized path and parts setup, made changes to match the updated database
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def get_logged_in_user_id(self):
        auth_header = self.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        return SESSIONS.get(parts[1])

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

        if path == "/account/purchases":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            customer = get_customer_by_user_id(user_id)

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            purchases = get_customer_purchases(customer["customer_id"])
            self.send_json(200, purchases)
            return

        if path == "/fridges":
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

#Merge conflict 4: Removed duplicate fridge code that used old db, kept the aletrs, kept the receipt route protected(token check), find the customer record linked to the logged-in user
            return

        if path == "/alerts":
            try:
                alerts = get_all_alerts()
                self.send_json(200, [dict(alert) for alert in alerts])
            except Exception as error:
                print(f"Alert fetch error: {error}")
                self.send_json(500, {"error": "Could not load alerts"})
            return

        if len(parts) == 3 and parts[0] == "account" and parts[1] == "purchases":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            if not parts[2].isdigit():
                self.send_json(400, {"error": "Invalid purchase ID"})
                return

            customer = get_customer_by_user_id(user_id)

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            purchase_id = int(parts[2])
            receipt = get_customer_receipt(customer["customer_id"], purchase_id)

            if receipt is None:
                self.send_json(404, {"error": "Receipt not found"})
                return

            self.send_json(200, receipt)
            return

        if len(parts) == 3 and parts[0] == "fridges" and parts[2] == "latest":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid refrigerator ID"})
                return
# Merge conflict 5: Keep the named fridge ID before retrieving its latest reading (both did the same thing )
            fridge_id = int(parts[1])
            reading = get_latest_reading(fridge_id)

            if reading:
                self.send_json(200, dict(reading))
            else:
                self.send_json(404, {"error": "No readings found"})

            return
        # Merge conflict 6: Kept the notifications route comment, nothing to change
        # Get notifications for a user
        if len(parts) == 3 and parts[0] == "users" and parts[2] == "notifications":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid user ID"})
                return
            # Merge conflict 7: Combine notifications, account access, product listing and cart retrieval, avoided duplicating do_PUT.
            user_id = int(parts[1])
            notifications = get_user_notifications(user_id)

            self.send_json(200, [dict(n) for n in notifications])
            return

        if path == "/account":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            customer = get_customer_by_user_id(user_id)

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            self.send_json(200, dict(customer))
            return

        if path == "/products":
            try:
                products = []

                for product in get_all_products():
                    data = dict(product)

                    if not data["product_is_active"]:
                        continue

                    data["product_price"] = round(
                        data["product_price_cents"] / 100, 2
                    )
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


    def do_DELETE(self):
# Merge: handle product deactivation and cart removal in ONE DELETE method.
        if len(parts) == 2 and parts[0] == "products":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid product ID"})
                return

            removed = update_product(
                int(parts[1]),
                {"product_is_active": 0}
            )

            if removed:
                self.send_json(200, {"message": "Product removed"})
            else:
                self.send_json(404, {"error": "Product not found"})

            return


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
                updated = update_product_with_barcode(
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
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

        if path == "/register":
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
        

        if path == "/checkout/session":
            try:
                data = self.read_json()
                user_id = data.get("user_id")

                if user_id is not None and (type(user_id) is not int or user_id <= 0):
                    self.send_json(400, {"error": "Invalid user ID"})
                    return

                session_id = self.checkout.create_session(user_id)

                self.send_json(201, {
                    "session_id": session_id,
                    "session_status": "ACTIVE"
                })

            except (ValueError, json.JSONDecodeError) as error:
                self.send_json(400, {"error": str(error) or "Invalid session request"})
            except sqlite3.IntegrityError as error:
                print(f"Checkout session database error: {error}")
                self.send_json(400, {"error": str(error)})
            except Exception as error:
                print(f"Checkout session error: {error}")
                self.send_json(500, {"error": "Could not create checkout session"})

            return

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "items":
            if not parts[2].isdigit():
                self.send_json(400, {"error": "Invalid checkout session ID"})
                return

            try:
                data = self.read_json()
                product_id = data.get("product_id")
                quantity = data.get("quantity", 1)

                if type(product_id) is not int or product_id <= 0:
                    self.send_json(400, {"error": "Invalid product ID"})
                    return

                if type(quantity) is not int or quantity < 1:
                    self.send_json(400, {"error": "Invalid quantity"})
                    return

                cart = self.checkout.add_to_session(
                    int(parts[2]),
                    product_id,
                    quantity
                )

                if cart is False or cart is None:
                    self.send_json(400, {"error": "Could not add product to cart"})
                else:
                    self.send_json(200, cart)

            except (ValueError, json.JSONDecodeError) as error:
                self.send_json(400, {"error": str(error) or "Invalid request"})
            except Exception as error:
                print(f"Add cart item error: {error}")
                self.send_json(500, {"error": "Could not add product to cart"})

            return
        # Complete the purchase using the items in the cart.
        if path == "/checkout":
            try:
                data = self.read_json()

                session_id = data.get("session_id")
                # Identify the customer from their login token. Without a token, complete the purchase as a guest.
                customer_id = None

                if self.headers.get("Authorization"):
                    user_id = self.get_logged_in_user_id()

                    if user_id is None:
                        self.send_json(401, {"error": "Please log in again"})
                        return

                    customer = get_customer_by_user_id(user_id)

                    if customer is None:
                        self.send_json(404, {"error": "Customer account not found"})
                        return

                    customer_id = customer["customer_id"]
                payment_method = data.get("payment_method", "card")

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

                if not receipt:
                    self.send_json(400, {"error": "Could not complete this purchase"})
                else:
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
        supplier = data.get("supplier")

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
        # Record the delivery and increase the product's stock.
            reception_id = add_stock_receipt(
                supplier=supplier,
                items=[
                    {"product_id": product_id, "quantity": quantity}
                ]
            )

            self.send_json(
                201,
                {
                    "message": "Stock received",
                    "reception_id": reception_id
                }
            )

        except (sqlite3.IntegrityError, ValueError) as error:
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
            product_id = add_product_with_barcode(
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


    def do_PATCH(self):
        parts = self.path.strip("/").split("/")

        if (
            len(parts) != 5
            or parts[0] != "checkout"
            or parts[1] != "session"
            or parts[3] != "items"
        ):
            self.send_json(404, {"error": "Route not found"})
            return

        if not parts[2].isdigit() or not parts[4].isdigit():
            self.send_json(400, {"error": "Invalid session or product ID"})
            return

        try:
            data = self.read_json()
            quantity = data.get("quantity")

            if type(quantity) is not int or quantity < 1:
                self.send_json(400, {"error": "Invalid quantity"})
                return

            cart = self.checkout.set_quantity(
                int(parts[2]),
                int(parts[4]),
                quantity
            )

            if cart is False or cart is None:
                self.send_json(400, {"error": "Could not update cart item"})
            else:
                self.send_json(200, cart)

        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid request"})
        except Exception as error:
            print(f"Update cart item error: {error}")
            self.send_json(500, {"error": "Could not update cart item"})

    def do_DELETE(self):
        parts = self.path.strip("/").split("/")

        if (
            len(parts) != 5
            or parts[0] != "checkout"
            or parts[1] != "session"
            or parts[3] != "items"
        ):
            self.send_json(404, {"error": "Route not found"})
            return

        if not parts[2].isdigit() or not parts[4].isdigit():
            self.send_json(400, {"error": "Invalid session or product ID"})
            return

        try:
            cart = self.checkout.remove_from_session(
                int(parts[2]),
                int(parts[4])
            )

            if cart is False or cart is None:
                self.send_json(400, {"error": "Could not remove cart item"})
            else:
                self.send_json(200, cart)

        except Exception as error:
            print(f"Remove cart item error: {error}")
            self.send_json(500, {"error": "Could not remove cart item"})

    def register_customer(self):
        try:
            data = self.read_json()

        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid JSON"})
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
                is_member=True
            )
            customer = get_customer(customer_id) #Uses ID to get the Info 

            hardware_feedback(True)
        # Merge conflict 8: Keep the membership number in the registration response.
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
            self.send_json(409, {
                "error": "This email or customer code is already registered"
            })

        except Exception as error:
            hardware_feedback(False)
            print(f"Registration error: {error}")
            self.send_json(500, {"error": "Could not add customer"})


def run_server():
    init_db()

    checkout = SelfCheckout()
    Server.checkout = checkout

    reader = None

    try:
        reader = RFIDReader()
        reader.start(checkout.process_rfid)
        print("[INFO] RFID reader initialized.")
    except Exception as error:
        print(f"[WARNING] RFID reader unavailable: {error}")
        print("[INFO] Continuing without RFID hardware.")

    if mqttProj is not None:
        try:
            mqttProj.start(db_path=DB_FILE)
        except Exception as error:
            print(f"[WARNING] MQTT unavailable: {error}")

    server = HTTPServer(("0.0.0.0", 5050), Server)

    print("Server running on http://localhost:5050")
    print("Frontend API is available.")

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nServer stopped")

    finally:
        if reader is not None:
            try:
                reader.stop()
            except Exception as error:
                print(f"[WARNING] Could not stop RFID reader: {error}")

        server.server_close()

        if mqttProj is not None:
            try:
                mqttProj.stop()
            except Exception as error:
                print(f"[WARNING] Could not stop MQTT: {error}")


if __name__ == "__main__":
    run_server()
