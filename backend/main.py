from http.server import BaseHTTPRequestHandler, HTTPServer
from models.customer_model import init_db, add_customer
import json
import sqlite3
from models.customer_model import init_db, add_customer, DB_FILE
from models.fridge_model import get_all_fridges, update_fridge
from models.fridge_reading_model import get_latest_reading
from contextlib import closing

def get_connection():
    return sqlite3.connect("../Database/iot.db")

from breadboardCode import login
#retrieve alerts for the dashboard
from models.alert_model import get_all_alerts
from models.notification_model import get_user_notifications
from models.customer_model import get_customer, update_customer_profile, change_customer_password
from models.purchase_model import get_customer_points, get_customer_purchases
from models.user_model import (
    get_user,
    get_all_users,
    authenticate_user,
    update_user_role,
    update_user_name,
    change_password
)
from models.customer_model import update_customer

ROLES = ("customer", "admin")
from models.product_model import (
    get_active_products,
    get_all_products,
    get_product,
    add_product,
    update_product,
    add_stock
)
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


class Server(BaseHTTPRequestHandler):

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-User-Id")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-User-Id")
        self.end_headers()

    # The logged-in user, from the X-User-Id header the frontend sends
    def current_user(self):
        user_id = self.headers.get("X-User-Id", "")
        user = get_user(int(user_id)) if user_id.isdigit() else None
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

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length)) if length > 0 else None
        except ValueError:
            data = None

        if not isinstance(data, dict):
            self.send_json(400, {"error": "Invalid JSON"})
            return None

        return data

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

    def do_GET(self):
        # Public product catalogue (active products only)
        if self.path.rstrip("/") == "/products":
            self.send_json(200, get_active_products())
            return

        # Admin product dashboard (every product, with stock numbers)
        if self.path.rstrip("/") == "/admin/products":
            if self.require_admin():
                self.send_json(200, get_all_products())
            return

        # The logged-in user's own details (used by the nav bar and settings page)
        if self.path.rstrip("/") == "/me":
            user = self.require_user()
            if user:
                self.send_json(200, self.user_details(user))
            return

        # Every user, for the admin roles page
        if self.path.rstrip("/") == "/admin/users":
            if self.require_admin():
                self.send_json(200, [dict(u) for u in get_all_users()])
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

        # Get the latest reading for a specific refrigerator
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
        # Get notifications for a user
        if len(parts) == 3 and parts[0] == "users" and parts[2] == "notifications":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid user ID"})
                return

            user_id = int(parts[1])
            notifications = get_user_notifications(user_id)

            self.send_json(200, [dict(n) for n in notifications])
            return

        # Get account info, loyalty points and purchase history for a customer
        if len(parts) == 3 and parts[0] == "customers" and parts[2] == "account":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid customer ID"})
                return

            customer_id = int(parts[1])
            customer = get_customer(customer_id)

            if customer is None:
                self.send_json(404, {"error": "Customer not found"})
                return

            self.send_json(200, {
                "customer": dict(customer),
                "points": get_customer_points(customer_id),
                "purchases": get_customer_purchases(customer_id)
            })
            return

        self.send_json(404, {"error": "Route not found"})

    # Update the maximum temperature for a refrigerator
    def do_PUT(self):
        parts = self.path.strip("/").split("/")

        # Edit a product (admin only)
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
    # Update a customer's profile or password from the settings page
    def update_customer_settings(self, customer_id, setting):
        if not customer_id.isdigit():
            self.send_json(400, {"error": "Invalid customer ID"})
            return

        customer_id = int(customer_id)

        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))
        except ValueError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        if not isinstance(data, dict):
            self.send_json(400, {"error": "Request body must be a JSON object"})
            return

        if setting == "profile":
            for field in ("first_name", "last_name", "address"):
                value = data.get(field)
                if not isinstance(value, str) or not value.strip():
                    self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                    return

            phone = data.get("phone") or ""
            if not isinstance(phone, str):
                self.send_json(400, {"error": "Invalid phone"})
                return

            if update_customer_profile(
                customer_id,
                data["first_name"],
                data["last_name"],
                data["address"],
                phone
            ):
                self.send_json(200, {"message": "Profile updated"})
            else:
                self.send_json(404, {"error": "Customer not found"})
            return

        current = data.get("current_password")
        new = data.get("new_password")

        if not isinstance(current, str) or not current:
            self.send_json(400, {"error": "Enter your current password"})
            return

        if not isinstance(new, str) or len(new) < 8:
            self.send_json(400, {"error": "New password must be at least 8 characters"})
            return

        if new != data.get("confirm_password"):
            self.send_json(400, {"error": "New passwords do not match"})
            return

        result = change_customer_password(customer_id, current, new)

        if result == "ok":
            self.send_json(200, {"message": "Password updated"})
        elif result == "wrong_password":
            self.send_json(403, {"error": "Current password is incorrect"})
        else:
            self.send_json(404, {"error": "Customer not found"})

    def do_POST(self):
        if self.path == "/register":
            self.register_customer()
            return

        if self.path == "/login":
            self.login_user()
            return

        parts = self.path.strip("/").split("/")

        # Add a product (admin only)
        if parts == ["admin", "products"]:
            self.add_product_route()
            return

        # Receive stock for a product (admin only)
        if len(parts) == 4 and parts[:2] == ["admin", "products"] and parts[3] == "stock":
            self.add_stock_route(parts[2])
            return

        self.send_json(404, {"error": "Route not found"})

    def login_user(self):
        data = self.read_json()
        if data is None:
            return

        email = data.get("email")
        password = data.get("password")

        if not isinstance(email, str) or not email.strip() \
                or not isinstance(password, str) or not password:
            self.send_json(400, {"error": "Email and password are required"})
            return

        user = authenticate_user(email, password)

        if user is None:
            hardware_feedback(False)
            self.send_json(401, {"error": "Incorrect email or password"})
            return

        hardware_feedback(True)
        self.send_json(200, {"message": "Login successful", "user": user})

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

        customer = get_customer(user["user_id"])
        if customer:
            details["customer_phone"] = customer["customer_phone"]
            details["customer_address"] = customer["customer_address"]
            details["is_customer"] = True

        return details

    def update_settings_route(self):
        user = self.require_user()
        if not user:
            return

        data = self.read_json()
        if data is None:
            return

        for field in ("first_name", "last_name"):
            value = data.get(field)
            if not isinstance(value, str) or not value.strip():
                self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                return

        is_customer = get_customer(user["user_id"]) is not None

        if is_customer:
            for field in ("phone", "address"):
                value = data.get(field)
                if not isinstance(value, str) or not value.strip():
                    self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                    return

        update_user_name(user["user_id"], data["first_name"], data["last_name"])

        if is_customer:
            update_customer(
                user["user_id"],
                address=data["address"].strip(),
                phone=data["phone"].strip()
            )

        self.send_json(200, self.user_details(get_user(user["user_id"])))

    def change_password_route(self):
        user = self.require_user()
        if not user:
            return

        data = self.read_json()
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

        data = self.read_json()
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

    def add_product_route(self):
        if not self.require_admin():
            return

        data = self.read_json()
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

    def update_product_route(self, product_id):
        if not self.require_admin():
            return

        if not product_id.isdigit():
            self.send_json(400, {"error": "Invalid product ID"})
            return

        data = self.read_json()
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

    def add_stock_route(self, product_id):
        if not self.require_admin():
            return

        if not product_id.isdigit() or get_product(int(product_id)) is None:
            self.send_json(404, {"error": "Product not found"})
            return

        data = self.read_json()
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
                data["password"]
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