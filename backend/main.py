from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import secrets
import sqlite3
import sys

from models.database import init_db, DB_FILE
from models.checkout_models.model_products import (
    add_product_with_barcode,
    update_product_with_barcode,
    update_product as update_product_record
)
from models.checkout_models.model_purchases import get_customer_purchases as get_purchase_records
from models.client_models.model_customers import (
    add_customer,
    get_customer,
    get_customer_by_user_id,
    update_customer
)
from models.client_models.model_receipts import get_customer_receipt
from models.management_models.model_fridges import get_all_fridges, update_fridge
from models.management_models.model_readings import get_latest_reading
from models.management_models.model_alerts import get_all_alerts
from models.management_models.model_notifications import get_user_notifications
from models.management_models.model_stock_receipts import add_stock_receipt

# Merge conflict 2 nov 13 : keep dashboard/account functions, checkout services and receipt emailing.
from models.user_model import (
    get_user,
    get_all_users,
    authenticate_user,
    update_user_role,
    update_user_name,
    change_password
)
from models.purchase_model import get_customer_points, get_customer_purchases
from models.product_model import (
    get_active_products,
    get_all_products,
    get_product,
    add_product,
    update_product,
    add_stock
)
from services.self_checkout import SelfCheckout
from services.rfid_reader import RFIDReader
from services.email_receipt import send_receipt_email lucas-test
from services.breadboardCode import login

if sys.platform == "win32":
    mqttProj = None
else:
    from services import mqttProj

ROLES = ("customer", "admin")


def hardware_feedback(*attempt):
    try:
        login(*attempt)
    except Exception as error:
        print(f"Hardware feedback unavailable: {error}")


SESSIONS = {}  # login token -> user_id


class Server(BaseHTTPRequestHandler):

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # Raises ValueError / JSONDecodeError on a bad body
    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))

        if length <= 0:
            return {}

        data = json.loads(self.rfile.read(length))

        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object")

        return data

    # Same as read_json, but answers 400 itself and returns None on a bad body
    def read_json_or_400(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length)) if length > 0 else None
        except ValueError:
            data = None

        if not isinstance(data, dict):
            self.send_json(400, {"error": "Invalid JSON"})
            return None

        return data

    # ---------- Login sessions ----------

    # The user id behind the "Authorization: Bearer <token>" header
    def get_logged_in_user_id(self):
        auth_header = self.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        return SESSIONS.get(parts[1])
        # Allow product and stock changes only for logged-in administrators.
    def require_admin(self):
        user_id = self.get_logged_in_user_id()

        if user_id is None:
            self.send_json(401, {"error": "Please log in"})
            return False

        user = get_user(user_id)

        if user is None or user["user_role"] != "admin":
            self.send_json(403, {"error": "Administrator access required"})
            return False

        return True

    def current_user(self):
        user_id = self.get_logged_in_user_id()
        user = get_user(user_id) if user_id is not None else None
        return dict(user) if user else None

    def require_user(self):
        user = self.current_user()

        if user is None:
            self.send_json(401, {"error": "Please log in"})

        return user

    # Only users with the 'admin' role can use the /admin routes
    def require_admin(self):
        user = self.current_user()

        if user is None or user["user_role"] != "admin":
            self.send_json(403, {"error": "Admins only"})
            return None

        return user

    def user_details(self, user):
        details = {
            "user_id": user["user_id"],
            "user_role": user["user_role"],
            "user_fname": user["user_fname"],
            "user_lname": user["user_lname"],
            "user_email": user["user_email"],
            "customer_phone": None,
            "customer_address": None,
            "is_customer": False,
        }

        customer = get_customer_by_user_id(user["user_id"])
        if customer:
            details["customer_phone"] = customer["customer_phone"]
            details["customer_address"] = customer["customer_address"]
            details["is_customer"] = True

        return details

    def validate_product(self, data, partial=False):
        text_fields = ["name", "category", "upc", "producer"]
        product = {}

        for field in text_fields:
            if field not in data:
                if not partial:
                    return None, f"Missing field: {field}"
                continue

            value = data[field]
            if not isinstance(value, str) or not value.strip():
                return None, f"Invalid field: {field}"
            product[field] = value.strip()

        if "upc" in product and not (12 <= len(product["upc"]) <= 13):
            return None, "UPC must be 12 or 13 characters"

        if "price" in data or not partial:
            price = data.get("price")
            if type(price) is not int or price < 0:
                return None, "Price must be a whole number of cents"
            product["price"] = price

        if "image_url" in data:
            image_url = data["image_url"]
            if image_url is not None and not isinstance(image_url, str):
                return None, "Invalid field: image_url"
            product["image_url"] = (image_url or "").strip() or None

        if "active" in data:
            if type(data["active"]) is not bool:
                return None, "Invalid field: active"
            product["active"] = 1 if data["active"] else 0

        return product, None

    # ---------- GET ----------

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

        # Public product catalogue (active products only)
        if path == "/products":
            try:
                self.send_json(200, get_active_products())
            except Exception as error:
                print(f"Product fetch error: {error}")
                self.send_json(500, {"error": "Could not load products"})
            return

        # Admin product dashboard (every product, with stock numbers)
        if path == "/admin/products":
            if self.require_admin():
                self.send_json(200, get_all_products())
            return

        # The logged-in user's own details (used by the nav bar and settings page)
        if path == "/me":
            user = self.require_user()
            if user:
                self.send_json(200, self.user_details(user))
            return

        # Account page: customer info, loyalty points and purchase history
        if path == "/me/account":
            user = self.require_user()
            if not user:
                return

            customer = get_customer_by_user_id(user["user_id"])

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            self.send_json(200, {
                "customer": customer,
                "points": get_customer_points(customer["customer_id"]),
                "purchases": get_customer_purchases(customer["customer_id"])
            })
            return

        # Every user, for the admin roles page
        if path == "/admin/users":
            if self.require_admin():
                self.send_json(200, [dict(u) for u in get_all_users()])
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

        if path == "/account/purchases":
            user_id = self.get_logged_in_user_id()

            if user_id is None:
                self.send_json(401, {"error": "Please log in"})
                return

            customer = get_customer_by_user_id(user_id)

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            self.send_json(200, get_purchase_records(customer["customer_id"]))
            return

        # Receipt for one of the logged-in customer's purchases
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

            receipt = get_customer_receipt(customer["customer_id"], int(parts[2]))

            if receipt is None:
                self.send_json(404, {"error": "Receipt not found"})
                return

            self.send_json(200, receipt)
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

            return

        if path == "/alerts":
            try:
                alerts = get_all_alerts()
                self.send_json(200, [dict(alert) for alert in alerts])
            except Exception as error:
                print(f"Alert fetch error: {error}")
                self.send_json(500, {"error": "Could not load alerts"})
            return

        # Latest reading for one refrigerator
        if len(parts) == 3 and parts[0] == "fridges" and parts[2] == "latest":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid refrigerator ID"})
                return

            reading = get_latest_reading(int(parts[1]))

            if reading:
                self.send_json(200, dict(reading))
            else:
                self.send_json(404, {"error": "No readings found"})

            return

        # Notifications for a user
        if len(parts) == 3 and parts[0] == "users" and parts[2] == "notifications":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid user ID"})
                return

            notifications = get_user_notifications(int(parts[1]))
            self.send_json(200, [dict(n) for n in notifications])
            return

        # Self-checkout cart
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

    # ---------- PUT ----------

    def do_PUT(self):
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

        # Edit a product (admin dashboard)
        if len(parts) == 3 and parts[0] == "admin" and parts[1] == "products":
            self.update_product_route(parts[2])
            return

        # Change another user's role (admin only)
        if len(parts) == 4 and parts[:2] == ["admin", "users"] and parts[3] == "role":
            self.update_role_route(parts[2])
            return

        # Update your own settings
        if parts == ["me"]:
            self.update_settings_route()
            return

        if parts == ["me", "password"]:
            self.change_password_route()
            return

        if len(parts) == 2 and parts[0] == "products":

            # Merge: keep admin protection and reuse the product-update helper.
            if not self.require_admin():
                return

            self.replace_product(parts[1]) #lucas-test
            return
            

        if len(parts) == 3 and parts[0] == "fridges" and parts[2] == "threshold":
            self.update_threshold(parts[1])
            return

        self.send_json(404, {"error": "Route not found"})

    # Replace a product's details, category and barcode
    def replace_product(self, product_id):
        if not product_id.isdigit():
            self.send_json(400, {"error": "Invalid product ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        for field in ("product_name", "product_category", "product_upc", "product_producer_company"):
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
                int(product_id),
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

    # Update the minimum temperature for a refrigerator
    def update_threshold(self, fridge_id):
        if not fridge_id.isdigit():
            self.send_json(400, {"error": "Invalid fridge ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        if type(data.get("min_temperature")) not in (int, float):
            self.send_json(400, {"error": "Invalid temperature"})
            return

        try:
            updated = update_fridge(
                int(fridge_id),
                {"fridge_min_temperature": data["min_temperature"]}
            )
        except sqlite3.IntegrityError:
            self.send_json(400, {"error": "Temperature violates fridge limits"})
            return

        if updated:
            self.send_json(200, {"message": "Threshold updated"})
        else:
            self.send_json(404, {"error": "Fridge not found"})

    def update_settings_route(self):
        user = self.require_user()
        if not user:
            return

        data = self.read_json_or_400()
        if data is None:
            return

        for field in ("first_name", "last_name"):
            value = data.get(field)
            if not isinstance(value, str) or not value.strip():
                self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                return

        customer = get_customer_by_user_id(user["user_id"])

        if customer:
            for field in ("phone", "address"):
                value = data.get(field)
                if not isinstance(value, str) or not value.strip():
                    self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                    return

        update_user_name(user["user_id"], data["first_name"], data["last_name"])

        if customer:
            update_customer(customer["customer_id"], {
                "customer_address": data["address"].strip(),
                "customer_phone": data["phone"].strip()
            })

        self.send_json(200, self.user_details(get_user(user["user_id"])))

    def change_password_route(self):
        user = self.require_user()
        if not user:
            return

        data = self.read_json_or_400()
        if data is None:
            return

        current = data.get("current_password")
        new = data.get("new_password")

        if not isinstance(current, str) or not isinstance(new, str):
            self.send_json(400, {"error": "Current and new password are required"})
            return

        if len(new) < 8:
            self.send_json(400, {"error": "New password must be at least 8 characters"})
            return

        if not change_password(user["user_id"], current, new):
            self.send_json(400, {"error": "Current password is incorrect"})
            return

        self.send_json(200, {"message": "Password changed"})

    def update_role_route(self, user_id):
        admin = self.require_admin()
        if not admin:
            return

        if not user_id.isdigit():
            self.send_json(400, {"error": "Invalid user ID"})
            return

        if int(user_id) == admin["user_id"]:
            self.send_json(400, {"error": "You can't change your own role"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        role = data.get("role")
        if role not in ROLES:
            self.send_json(400, {"error": f"Role must be one of: {', '.join(ROLES)}"})
            return

        if not update_user_role(int(user_id), role):
            self.send_json(404, {"error": "User not found"})
            return

        self.send_json(200, dict(get_user(int(user_id))))

    def update_product_route(self, product_id):
        if not self.require_admin():
            return

        if not product_id.isdigit():
            self.send_json(400, {"error": "Invalid product ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        product, error = self.validate_product(data, partial=True)
        if error:
            self.send_json(400, {"error": error})
            return

        try:
            updated = update_product(int(product_id), **product)
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "A product with this UPC already exists"})
            return

        if updated:
            self.send_json(200, get_product(int(product_id)))
        else:
            self.send_json(404, {"error": "Product not found"})

    # ---------- POST ----------

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

        if path == "/register":
            self.register_customer()
            return

        if path == "/login":
            self.login_user()
            return

        if path == "/products":
            self.create_product()
            return

        if path == "/stock-receptions":
            self.receive_stock()
            return

        # Add a product (admin dashboard)
        if parts == ["admin", "products"]:
            self.add_product_route()
            return

        # Receive stock for a product (admin dashboard)
        if len(parts) == 4 and parts[:2] == ["admin", "products"] and parts[3] == "stock":
            self.add_stock_route(parts[2])
            return

        if path == "/checkout/session":
            self.create_checkout_session()
            return

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "items":
            self.add_cart_item(parts[2])
            return

        if path == "/checkout":
    # Merge: preserve token-based checkout and automatic receipt emailing.
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

                #After purchase it sends an email using customer token
                if not receipt:
                    self.send_json(400, {"error": "Could not complete this purchase"})
                else:
                    receipt["email_status"] = "not_applicable"

                    # Email registered customers after the purchase is saved.
                    if customer_id is not None:
                        try:
                            send_receipt_email(
                                customer["user_email"],
                                receipt
                            )
                            receipt["email_status"] = "sent"
                        except Exception as error:
                            print(f"Receipt email error: {error}")
                            receipt["email_status"] = "failed"

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

    # Checks email and password, then hands back a login token
    def login_user(self):
        data = self.read_json_or_400()
        if data is None:
            return

        for field in ("email", "password"):
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                return

        try:
            user = authenticate_user(data["email"], data["password"])
        except sqlite3.Error as error:
            print(f"Login database error: {error}")
            self.send_json(500, {"error": "Could not log in"})
            return

        if not user:
            self.send_json(401, {"error": "Invalid email or password"})
            return

        token = secrets.token_urlsafe(32)
        SESSIONS[token] = user["user_id"]

        self.send_json(200, {
            "message": "Login successful",
            "token": token,
            "user": user
        })

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

        if len(data["password"]) < 8:
            hardware_feedback(False)
            self.send_json(400, {"error": "Password must be at least 8 characters"})
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
            customer = get_customer(customer_id)

            hardware_feedback(True)
            self.send_json(201, {
                "message": "Customer added",
                "customer_id": customer_id,
                "customer_code": customer["customer_code"]
            })

        except sqlite3.IntegrityError as error:
            hardware_feedback(False)
            print(f"Registration database error: {error}")
            self.send_json(409, {"error": "This email or customer code is already registered"})

        except Exception as error:
            hardware_feedback(False)
            print(f"Registration error: {error}")
            self.send_json(500, {"error": "Could not add customer"})

    def add_product_route(self):
        if not self.require_admin():
            return

        data = self.read_json_or_400()
        if data is None:
            return

        product, error = self.validate_product(data)
        if error:
            self.send_json(400, {"error": error})
            return

        try:
            product_id = add_product(
                product["name"],
                product["category"],
                product["price"],
                product["upc"],
                product["producer"],
                product.get("image_url")
            )
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "A product with this UPC already exists"})
            return

        self.send_json(201, get_product(product_id))

    def add_stock_route(self, product_id):
        if not self.require_admin():
            return

        if not product_id.isdigit() or get_product(int(product_id)) is None:
            self.send_json(404, {"error": "Product not found"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        quantity = data.get("quantity")
        if type(quantity) is not int or quantity <= 0:
            self.send_json(400, {"error": "Quantity must be a positive whole number"})
            return

        note = data.get("note")
        note = (note.strip() or None) if isinstance(note, str) else None

        add_stock(int(product_id), quantity, note)
        self.send_json(201, get_product(int(product_id)))

    # Create a product with its category and barcode
    def create_product(self):
        # Merge: preserve administrator protection.
        if not self.require_admin():
            return

        data = self.read_json_or_400()
        if data is None:
            return

        for field in ("product_name", "product_category", "product_upc", "product_producer_company"):
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                return

        price = data.get("product_price")

        if type(price) is not int or price < 0:
            self.send_json(400, {"error": "Price must be a non-negative integer in cents"})
            return

        try:
            product_id = add_product_with_barcode(
                data["product_name"].strip(),
                data["product_category"].strip(),
                price,
                data["product_upc"].strip(),
                data["product_producer_company"].strip()
            )

            self.send_json(201, {"message": "Product added", "product_id": product_id})

        except sqlite3.IntegrityError as error:
            print(f"Product database error: {error}")
            self.send_json(400, {"error": "Invalid product data or UPC already registered"})

        except Exception as error:
            print(f"Product creation error: {error}")
            self.send_json(500, {"error": "Could not add product"})

    # Record a delivery and increase the product's stock
    def receive_stock(self):
        # Merge: preserve administrator protection.
        if not self.require_admin():
            return
        data = self.read_json_or_400()
        if data is None:
            return

        product_id = data.get("product_id")
        quantity = data.get("quantity")
        supplier = data.get("supplier")

        if type(product_id) is not int or product_id <= 0:
            self.send_json(400, {"error": "Invalid product ID"})
            return

        if type(quantity) is not int or quantity <= 0:
            self.send_json(400, {"error": "Quantity must be a positive integer"})
            return

        if supplier is not None and not isinstance(supplier, str):
            self.send_json(400, {"error": "Supplier must be text"})
            return

        try:
            reception_id = add_stock_receipt(
                supplier=supplier,
                items=[{"product_id": product_id, "quantity": quantity}]
            )

            self.send_json(201, {"message": "Stock received", "reception_id": reception_id})

        except (sqlite3.IntegrityError, ValueError) as error:
            print(f"Stock reception error: {error}")
            self.send_json(400, {"error": "Product does not exist or stock data is invalid"})

    def create_checkout_session(self):
        try:
            data = self.read_json()
            user_id = data.get("user_id")

            if user_id is not None and (type(user_id) is not int or user_id <= 0):
                self.send_json(400, {"error": "Invalid user ID"})
                return

            session_id = self.checkout.create_session(user_id)

            self.send_json(201, {"session_id": session_id, "session_status": "ACTIVE"})

        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid session request"})
        except sqlite3.IntegrityError as error:
            print(f"Checkout session database error: {error}")
            self.send_json(400, {"error": str(error)})
        except Exception as error:
            print(f"Checkout session error: {error}")
            self.send_json(500, {"error": "Could not create checkout session"})

    def add_cart_item(self, session_id):
        if not session_id.isdigit():
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

            cart = self.checkout.add_to_session(int(session_id), product_id, quantity)

            if cart is False or cart is None:
                self.send_json(400, {"error": "Could not add product to cart"})
            else:
                self.send_json(200, cart)

        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid request"})
        except Exception as error:
            print(f"Add cart item error: {error}")
            self.send_json(500, {"error": "Could not add product to cart"})

    # Complete the purchase using the items in the cart.
    # Without a login token the purchase is done as a guest.
    def complete_checkout(self):
        try:
            data = self.read_json()
            session_id = data.get("session_id")
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

    # ---------- PATCH ----------

    def do_PATCH(self):
        parts = self.path.split("?")[0].strip("/").split("/")

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

            cart = self.checkout.set_quantity(int(parts[2]), int(parts[4]), quantity)

            if cart is False or cart is None:
                self.send_json(400, {"error": "Could not update cart item"})
            else:
                self.send_json(200, cart)

        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid request"})
        except Exception as error:
            print(f"Update cart item error: {error}")
            self.send_json(500, {"error": "Could not update cart item"})

    # ---------- DELETE ----------

    def do_DELETE(self):
        parts = self.path.split("?")[0].strip("/").split("/")

        # Hide the product without deleting its database record.
        if len(parts) == 2 and parts[0] == "products":
            # Merge: preserve administrator protection.
            if not self.require_admin():
                return
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid product ID"})
                return

            if update_product_record(int(parts[1]), {"product_is_active": 0}):
                self.send_json(200, {"message": "Product removed"})
            else:
                self.send_json(404, {"error": "Product not found"})

            return

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
            cart = self.checkout.remove_from_session(int(parts[2]), int(parts[4]))

            if cart is False or cart is None:
                self.send_json(400, {"error": "Could not remove cart item"})
            else:
                self.send_json(200, cart)

        except Exception as error:
            print(f"Remove cart item error: {error}")
            self.send_json(500, {"error": "Could not remove cart item"})


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
