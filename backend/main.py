from http.server import BaseHTTPRequestHandler, HTTPServer

from models.database import init_db, DB_FILE, get_connection
from models.checkout_models.model_products import get_all_products
from services.self_checkout import SelfCheckout
from services.rfid_reader import RFIDReader
from models.management_models.model_fridges import get_all_fridges, update_fridge
from models.management_models.model_readings import get_latest_reading
from models.management_models.model_alerts import get_all_alerts
from models.management_models.model_notifications import get_user_notifications
from models.client_models.model_customers import add_customer, get_customer_by_email

from services.breadboardCode import login
import hashlib
import hmac
import json
import sqlite3
import sys

if sys.platform == "win32":
    mqttProj = None
else:
    import mqttProj


POINTS_PER_DOLLAR = 1


def hardware_feedback(*attempt):
    try:
        login(*attempt)
    except Exception as error:
        print(f"Hardware feedback unavailable: {error}")


def verify_password(password, stored_hash):
    try:
        salt_hex, hash_hex = stored_hash.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            100000
        )
        return hmac.compare_digest(actual_hash, expected_hash)
    except (AttributeError, ValueError):
        return False


def ensure_loyalty_schema():
    with get_connection() as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(Customers)")}
        if "customer_is_member" not in columns:
            conn.execute(
                "ALTER TABLE Customers ADD COLUMN customer_is_member INTEGER NOT NULL DEFAULT 0 CHECK (customer_is_member IN (0, 1))"
            )

        conn.execute("DROP VIEW IF EXISTS CustomerLoyaltyBalances")
        conn.execute(
            """
            CREATE VIEW CustomerLoyaltyBalances AS
            SELECT
                Customers.customer_id,
                Customers.user_id,
                COALESCE(SUM(LoyaltyTransactions.loyalty_points_change), 0)
                    AS customer_loyalty_points
            FROM Customers
            LEFT JOIN LoyaltyTransactions
                ON Customers.customer_id = LoyaltyTransactions.customer_id
            GROUP BY Customers.customer_id, Customers.user_id
            """
        )


class Server(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

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

        if len(parts) == 3 and parts[0] == "users" and parts[2] == "notifications":
            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid user ID"})
                return
            notifications = get_user_notifications(int(parts[1]))
            self.send_json(200, [dict(n) for n in notifications])
            return

        if path == "/products":
            try:
                products = []
                for product in get_all_products():
                    data = dict(product)
                    if not data["product_is_active"]:
                        continue
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
        try:
            data = self.read_json()
            if type(data.get("max_temperature")) not in (int, float):
                raise ValueError("Invalid temperature")
            updated = update_fridge(
                int(parts[1]),
                fridge_max_temperature=data["max_temperature"]
            )
            if updated:
                self.send_json(200, {"message": "Threshold updated"})
            else:
                self.send_json(404, {"error": "Fridge not found"})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.send_json(400, {"error": "Temperature violates fridge limits"})
        except Exception as error:
            print(f"Fridge update error: {error}")
            self.send_json(500, {"error": "Could not update fridge threshold"})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        parts = path.strip("/").split("/")

        if path == "/register":
            self.register_customer()
            return

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "login":
            self.login_checkout_customer(int(parts[2]) if parts[2].isdigit() else None)
            return

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "lookup":
            self.lookup_checkout_customer(int(parts[2]) if parts[2].isdigit() else None)
            return

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "membership":
            self.enroll_checkout_customer(int(parts[2]) if parts[2].isdigit() else None)
            return

        if path == "/checkout/session":
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
                cart = self.checkout.add_to_session(int(parts[2]), product_id, quantity)
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

        if path == "/checkout":
            try:
                data = self.read_json()
                session_id = data.get("session_id")
                redeem_points = data.get("redeem_points", 0)
                payment_method = data.get("payment_method", "card")

                if type(session_id) is not int or session_id <= 0:
                    self.send_json(400, {"error": "A valid session_id is required"})
                    return
                if type(redeem_points) is not int or redeem_points < 0:
                    self.send_json(400, {"error": "Invalid loyalty points amount"})
                    return

                receipt = self.checkout.complete_purchase(
                    session_id,
                    payment_method=payment_method,
                    redeem_points=redeem_points
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

    def do_PATCH(self):
        parts = self.path.strip("/").split("/")
        if len(parts) != 5 or parts[0] != "checkout" or parts[1] != "session" or parts[3] != "items":
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

    def do_DELETE(self):
        parts = self.path.strip("/").split("/")
        if len(parts) != 5 or parts[0] != "checkout" or parts[1] != "session" or parts[3] != "items":
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

    def lookup_checkout_customer(self, session_id):
        if session_id is None:
            self.send_json(400, {"error": "Invalid checkout session ID"})
            return

        try:
            data = self.read_json()
            email = data.get("email")
            if not isinstance(email, str) or not email.strip():
                self.send_json(400, {"error": "Email is required"})
                return

            customer = get_customer_by_email(email.strip())
            if not customer:
                self.send_json(404, {"error": "No customer account was found with that email"})
                return

            with get_connection() as conn:
                session = conn.execute(
                    "SELECT session_status FROM SelfCheckoutSessions WHERE session_id = ?",
                    (session_id,)
                ).fetchone()
                if session is None or session["session_status"] != "ACTIVE":
                    self.send_json(404, {"error": "Active checkout session not found"})
                    return

                membership = conn.execute(
                    """
                    SELECT customer_membership_points
                    FROM CustomerMemberships
                    WHERE customer_id = ?
                    """,
                    (customer["customer_id"],)
                ).fetchone()
                if membership is None:
                    self.send_json(404, {"error": "No loyalty membership was found for that email"})
                    return

                conn.execute(
                    "UPDATE Customers SET customer_is_member = 1 WHERE customer_id = ?",
                    (customer["customer_id"],)
                )
                conn.execute(
                    "UPDATE SelfCheckoutSessions SET user_id = ? WHERE session_id = ?",
                    (customer["user_id"], session_id)
                )
                account = conn.execute(
                    """
                    SELECT
                        c.customer_id,
                        c.customer_is_member AS is_member,
                        u.user_id,
                        u.user_fname AS first_name,
                        u.user_lname AS last_name,
                        u.user_email AS email,
                        cm.customer_membership_points AS loyalty_points
                    FROM Customers AS c
                    JOIN Users AS u ON u.user_id = c.user_id
                    JOIN CustomerMemberships AS cm ON cm.customer_id = c.customer_id
                    WHERE c.customer_id = ?
                    """,
                    (customer["customer_id"],)
                ).fetchone()

            self.send_json(200, {
                "message": "Membership found and linked to checkout",
                "account": dict(account)
            })
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid lookup request"})
        except Exception as error:
            print(f"Checkout member lookup error: {error}")
            self.send_json(500, {"error": "Could not find the loyalty account"})

    def login_checkout_customer(self, session_id):
        if session_id is None:
            self.send_json(400, {"error": "Invalid checkout session ID"})
            return
        try:
            data = self.read_json()
            email = data.get("email")
            password = data.get("password")
            if not isinstance(email, str) or not email.strip() or not isinstance(password, str) or not password:
                self.send_json(400, {"error": "Email and password are required"})
                return

            customer = get_customer_by_email(email)
            if not customer or not verify_password(password, customer.get("user_password_hash")):
                self.send_json(401, {"error": "Incorrect email or password"})
                return

            with get_connection() as conn:
                session = conn.execute(
                    """
                    SELECT session_status FROM SelfCheckoutSessions
                    WHERE session_id = ?
                    """,
                    (session_id,)
                ).fetchone()
                if session is None or session["session_status"] != "ACTIVE":
                    self.send_json(404, {"error": "Active checkout session not found"})
                    return
                conn.execute(
                    "UPDATE SelfCheckoutSessions SET user_id = ? WHERE session_id = ?",
                    (customer["user_id"], session_id)
                )
                account_row = conn.execute(
                    """
                    SELECT
                        c.customer_id,
                        c.customer_is_member AS is_member,
                        u.user_id,
                        u.user_fname AS first_name,
                        u.user_lname AS last_name,
                        u.user_email AS email,
                        COALESCE(b.customer_loyalty_points, 0) AS loyalty_points
                    FROM Customers AS c
                    JOIN Users AS u ON u.user_id = c.user_id
                    LEFT JOIN CustomerLoyaltyBalances AS b
                        ON b.customer_id = c.customer_id
                    WHERE c.customer_id = ?
                    """,
                    (customer["customer_id"],)
                ).fetchone()

            account = dict(account_row) if account_row else None
            self.send_json(200, {"message": "Signed in successfully", "account": account})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid login request"})
        except Exception as error:
            print(f"Checkout login error: {error}")
            self.send_json(500, {"error": "Could not sign in"})

    def enroll_checkout_customer(self, session_id):
        if session_id is None:
            self.send_json(400, {"error": "Invalid checkout session ID"})
            return

        try:
            with get_connection() as conn:
                session = conn.execute(
                    "SELECT user_id, session_status FROM SelfCheckoutSessions WHERE session_id = ?",
                    (session_id,)
                ).fetchone()
                if session is None or session["session_status"] != "ACTIVE":
                    self.send_json(404, {"error": "Active checkout session not found"})
                    return
                if session["user_id"] is None:
                    self.send_json(401, {"error": "Sign in before joining the loyalty program"})
                    return

                updated = conn.execute(
                    "UPDATE Customers SET customer_is_member = 1 WHERE user_id = ?",
                    (session["user_id"],)
                ).rowcount
                if not updated:
                    self.send_json(404, {"error": "Customer account not found"})
                    return

                account = conn.execute(
                    """
                    SELECT
                        c.customer_id,
                        c.customer_is_member AS is_member,
                        u.user_id,
                        u.user_fname AS first_name,
                        u.user_lname AS last_name,
                        u.user_email AS email,
                        COALESCE(b.customer_loyalty_points, 0) AS loyalty_points
                    FROM Customers AS c
                    JOIN Users AS u ON u.user_id = c.user_id
                    LEFT JOIN CustomerLoyaltyBalances AS b
                        ON b.customer_id = c.customer_id
                    WHERE c.user_id = ?
                    """,
                    (session["user_id"],)
                ).fetchone()

            self.send_json(200, {"message": "Loyalty membership activated", "account": dict(account)})
        except Exception as error:
            print(f"Loyalty enrollment error: {error}")
            self.send_json(500, {"error": "Could not activate loyalty membership"})

    def register_customer(self):
        try:
            data = self.read_json()
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Invalid JSON"})
            return

        required_fields = ["first_name", "last_name", "email", "password", "confirm_password"]
        for field in required_fields:
            value = data.get(field)
            if not isinstance(value, str) or not value.strip():
                self.send_json(400, {"error": f"Missing or invalid field: {field}"})
                return

        for field in ("address", "phone"):
            if data.get(field) is not None and not isinstance(data[field], str):
                self.send_json(400, {"error": f"Invalid field: {field}"})
                return

        if type(data.get("is_member", False)) is not bool:
            self.send_json(400, {"error": "Invalid membership selection"})
            return

        if data["password"] != data["confirm_password"]:
            hardware_feedback(False)
            self.send_json(400, {"error": "Passwords do not match"})
            return

        try:
            customer_id = add_customer(
                data["first_name"],
                data["last_name"],
                (data.get("address") or "").strip(),
                (data.get("phone") or "").strip(),
                data["email"].strip(),
                data["password"],
                is_member=data.get("is_member", False)
            )
            with get_connection() as conn:
                conn.execute(
                    "UPDATE Customers SET customer_is_member = ? WHERE customer_id = ?",
                    (int(data.get("is_member", False)), customer_id)
                )
            hardware_feedback(True)
            self.send_json(201, {"message": "Customer added", "customer_id": customer_id})
        except sqlite3.IntegrityError as error:
            hardware_feedback(False)
            print(f"Registration database error: {error}")
            self.send_json(409, {"error": "This email or customer code is already registered"})
        except Exception as error:
            hardware_feedback(False)
            print(f"Registration error: {error}")
            self.send_json(500, {"error": "Could not add customer"})


def run_server():
    init_db()
    ensure_loyalty_schema()
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
