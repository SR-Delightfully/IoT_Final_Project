from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit, parse_qs
import json
import os
import secrets
import sqlite3
import sys
import threading
from datetime import date

from models.database import init_db, DB_FILE, get_connection
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
    get_customer_by_card,
    ensure_membership_cards,
    update_customer
)
from models.client_models.model_receipts import get_customer_receipt
from models.management_models.model_fridges import (
    get_fridge,
    get_fridge_dashboard,
    set_fridge_fan,
    update_fridge
)
from models.management_models.model_readings import get_latest_reading
from models.management_models.model_alerts import get_alerts_with_fridge, acknowledge_alert
from models.management_models.model_notifications import (
    get_user_notifications,
    get_all_notifications_detailed,
    mark_notification_read
)
from models.management_models.model_stock_receipts import add_stock_receipt
from models.report_model import (
    get_inventory_report,
    get_sales_total,
    get_product_sales,
    get_daily_sales,
    get_customer_activity
)

# Merge conflict 2 nov 13 : keep dashboard/account functions, checkout services and receipt emailing.
from models.user_model import (
    get_user,
    get_all_users,
    authenticate_user,
    update_user_role,
    update_user_name,
    change_password
)
from models.purchase_model import get_customer_points, get_customer_purchases, get_customer_product_history
from models.product_model import (
    get_active_products,
    get_all_products,
    get_product,
    add_product,
    update_product,
    get_categories,
    update_category_thresholds,
    receive_tagged_stock,
    TagError
)
from services.self_checkout import SelfCheckout
from services.rfid_reader import RFIDReader
from services.stock_scanner import StockScanner, normalize_epc, get_simulator_catalog
from services.email_receipt import send_receipt_email 
from services.breadboardCode import login

if sys.platform == "win32":
    mqttProj = None
else:
    from services import mqttProj

ROLES = ("customer", "admin")


def hardware_feedback(*attempt):
    # Blue LED on success, red LED + buzzer on failure. The fade takes about
    # 3 seconds, so run it in the background instead of delaying the reply.
    def run():
        try:
            login(*attempt)
        except Exception as error:
            print(f"Hardware feedback unavailable: {error}")

    threading.Thread(target=run, daemon=True).start()


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
        # Read the route before "?" and the date filters after "?" separately.
        parsed_url = urlsplit(self.path)
        path = parsed_url.path.rstrip("/")
        parts = path.strip("/").split("/")
        query_params = parse_qs(parsed_url.query)

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
        # Inventory report: admin only.
        if path == "/admin/reports/inventory":
            if not self.require_admin():
                return

            try:
                report = get_inventory_report()
                self.send_json(200, report)
            except sqlite3.Error as error:
                print(f"Inventory report error: {error}")
                self.send_json(500, {"error": "Could not load inventory report"})

            return
        # Sales report admin only.
        if path == "/admin/reports/sales":
            if not self.require_admin():
                return

            start_date = query_params.get("start_date", [None])[0]
            end_date = query_params.get("end_date", [None])[0]

            try:
                if start_date is not None:
                    start_date = date.fromisoformat(start_date).isoformat()

                if end_date is not None:
                    end_date = date.fromisoformat(end_date).isoformat()
            except ValueError:
                self.send_json(400, {"error": "Invalid date. Use YYYY-MM-DD."})
                return

            if start_date and end_date and start_date > end_date:
                self.send_json(400, {"error": "Start date must be on or before end date."})
                return

            try:
                products = get_product_sales(start_date, end_date)

                self.send_json(200, {
                    "start_date": start_date,
                    "end_date": end_date,
                    "total_sales_cents": get_sales_total(start_date, end_date),
                    "total_units_sold": sum(p["units_sold"] for p in products),
                    "products": products,
                    "daily_sales": get_daily_sales(start_date, end_date)
                })
            except sqlite3.Error as error:
                print(f"Sales report error: {error}")
                self.send_json(500, {"error": "Could not load sales report"})

            return
        # Customer activity report: admin only.
        if path == "/admin/reports/customers":
            if not self.require_admin():
                return

            start_date = query_params.get("start_date", [None])[0]
            end_date = query_params.get("end_date", [None])[0]

            try:
                if start_date is not None:
                    start_date = date.fromisoformat(start_date).isoformat()

                if end_date is not None:
                    end_date = date.fromisoformat(end_date).isoformat()
            except ValueError:
                self.send_json(400, {"error": "Invalid date. Use YYYY-MM-DD."})
                return

            if start_date and end_date and start_date > end_date:
                self.send_json(400, {"error": "Start date must be on or before end date."})
                return

            try:
                self.send_json(200, get_customer_activity(start_date, end_date))
            except sqlite3.Error as error:
                print(f"Customer activity report error: {error}")
                self.send_json(500, {"error": "Could not load customer activity report"})

            return

        # Products, tags and membership cards for the scanner simulator
        if path == "/simulate/catalog":
            if self.require_simulator():
                self.send_json(200, get_simulator_catalog())
            return

        if path == "/admin/categories":
            if self.require_admin():
                self.send_json(200, get_categories())
            return

        # Tags collected while the admin is receiving stock
        if path == "/admin/scan":
            if self.require_admin():
                self.send_json(200, self.scanner.snapshot())
            return

        # Active loyalty rewards for the signed-in customer.
        if path == "/loyalty/rewards":
            user = self.require_user()
            if not user:
                return

            customer = get_customer_by_user_id(user["user_id"])
            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            if not customer.get("customer_is_member"):
                self.send_json(403, {"error": "This account is not enrolled in the loyalty program"})
                return

            try:
                with get_connection() as conn:
                    rewards = conn.execute(
                        """
                        SELECT reward_id, reward_name, reward_description,
                               reward_image_url, reward_points_cost
                        FROM Rewards
                        WHERE reward_is_active = 1
                        ORDER BY reward_points_cost, reward_name
                        """
                    ).fetchall()

                self.send_json(200, {
                    "points": get_customer_points(customer["customer_id"]),
                    "rewards": [dict(reward) for reward in rewards]
                })
            except Exception as error:
                print(f"Loyalty rewards error: {error}")
                self.send_json(500, {"error": "Could not load loyalty rewards"})
            return

        # The logged-in user's own details (used by the nav bar and settings page)
        if path == "/me":
            user = self.require_user()
            if user:
                self.send_json(200, self.user_details(user))
            return

        # Both routes share login, customer lookup and date validation.
        if path in ("/me/account", "/me/account/product-history"):
            user = self.require_user()
            if not user:
                return

            customer = get_customer_by_user_id(user["user_id"])

            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            start_date = query_params.get("start_date", [None])[0]
            end_date = query_params.get("end_date", [None])[0]

            try:
                if start_date is not None:
                    start_date = date.fromisoformat(start_date).isoformat()

                if end_date is not None:
                    end_date = date.fromisoformat(end_date).isoformat()

            except ValueError:
                self.send_json(400, {"error": "Invalid date. Use YYYY-MM-DD."})
                return

            if start_date is not None and end_date is not None:
                if start_date > end_date:
                    self.send_json(
                        400,
                        {"error": "Start date must be on or before end date."}
                    )
                    return

            # Product history runs after the customer and dates are known.
            if path == "/me/account/product-history":
                try:
                    product_id = int(query_params.get("product_id", [""])[0])
                    if product_id <= 0:
                        raise ValueError
                except ValueError:
                    self.send_json(400, {"error": "A valid product_id is required"})
                    return

                history = get_customer_product_history(
                    customer["customer_id"],
                    product_id,
                    start_date,
                    end_date
                )

                purchase_count = len({item["purchase_id"] for item in history})
                total_quantity = sum(
                    item["purchase_item_quantity"] for item in history
                )

                self.send_json(200, {
                    "product_id": product_id,
                    "purchase_count": purchase_count,
                    "total_quantity": total_quantity,
                    "history": history
                })
                return

            # Account history and spending total.
            purchases = get_customer_purchases(
                customer["customer_id"],
                start_date,
                end_date
            )

            total_spent_cents = 0

            for purchase in purchases:
                if purchase["purchase_payment_status"] == "paid":
                    total_spent_cents += purchase["purchase_total"]

            self.send_json(200, {
                "customer": customer,
                "points": get_customer_points(customer["customer_id"]),
                "purchases": purchases,
                "total_spent_cents": total_spent_cents
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
                self.send_json(200, {"fridges": get_fridge_dashboard()})

            except Exception as error:
                print(f"Fridge fetch error: {error}")
                self.send_json(500, {"error": "Could not load fridge data"})

            return

        if path == "/alerts":
            try:
                self.send_json(200, get_alerts_with_fridge())
            except Exception as error:
                print(f"Alert fetch error: {error}")
                self.send_json(500, {"error": "Could not load alerts"})
            return

        # Every notification (fridge alert emails and dashboard alerts): admin only.
        if path == "/notifications":
            if not self.require_admin():
                return

            try:
                self.send_json(200, get_all_notifications_detailed())
            except sqlite3.Error as error:
                print(f"Notification fetch error: {error}")
                self.send_json(500, {"error": "Could not load notifications"})
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

        if len(parts) == 3 and parts[0] == "fridges" and parts[2] == "fan":
            self.set_fan_route(parts[1])
            return

        # Stock-level thresholds for one category (admin only)
        if len(parts) == 4 and parts[:2] == ["admin", "categories"] and parts[3] == "thresholds":
            self.update_category_thresholds_route(parts[2])
            return

        if len(parts) == 3 and parts[0] == "notifications" and parts[2] == "read":
            if not self.require_admin():
                return

            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid notification ID"})
                return

            if mark_notification_read(int(parts[1])):
                self.send_json(200, {"message": "Notification marked as read"})
            else:
                self.send_json(404, {"error": "Notification not found"})
            return

        self.send_json(404, {"error": "Route not found"})

    def update_category_thresholds_route(self, category_id):
        if not self.require_admin():
            return

        if not category_id.isdigit():
            self.send_json(400, {"error": "Invalid category ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        low = data.get("low_threshold")
        moderate = data.get("moderate_threshold")

        if type(low) is not int or type(moderate) is not int or low < 0 or moderate < 0:
            self.send_json(400, {"error": "Thresholds must be whole numbers of 0 or more."})
            return

        if low > moderate:
            self.send_json(400, {"error": "The low level must not be above the moderate level."})
            return

        if update_category_thresholds(int(category_id), low, moderate):
            self.send_json(200, {"message": "Stock levels saved"})
        else:
            self.send_json(404, {"error": "Category not found"})

    # Turn a fridge fan on or off from the dashboard. On the Pi this also
    # drives the DC motor through mqttProj; elsewhere only the database changes.
    def set_fan_route(self, fridge_id):
        if not self.require_admin():
            return

        if not fridge_id.isdigit():
            self.send_json(400, {"error": "Invalid fridge ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        if type(data.get("on")) is not bool:
            self.send_json(400, {"error": "'on' must be true or false"})
            return

        fridge_id = int(fridge_id)

        try:
            if mqttProj is not None:
                mqttProj.set_fan(fridge_id, data["on"])
            elif not set_fridge_fan(fridge_id, data["on"]):
                raise KeyError(fridge_id)
        except KeyError:
            self.send_json(404, {"error": "Fridge not found"})
            return
        except Exception as error:
            print(f"Fan control error: {error}")
            self.send_json(500, {"error": "Could not change the fan"})
            return

        self.send_json(200, {"fridge_id": fridge_id, "fridge_fan_on": data["on"]})

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
    # Save a fridge's operating limits. The alert email fires above the max temperature.
    def update_threshold(self, fridge_id):
        if not self.require_admin():
            return

        if not fridge_id.isdigit():
            self.send_json(400, {"error": "Invalid fridge ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        fields = (
            "fridge_min_temperature",
            "fridge_max_temperature",
            "fridge_min_humidity",
            "fridge_max_humidity",
        )
        values = {}

        for field in fields:
            value = data.get(field)

            # bool is a subclass of int, so reject it explicitly
            if type(value) not in (int, float):
                self.send_json(400, {"error": f"{field} must be a number"})
                return

            values[field] = float(value)

        if values["fridge_min_temperature"] > values["fridge_max_temperature"]:
            self.send_json(400, {"error": "Minimum temperature must not be above the maximum."})
            return

        if values["fridge_min_humidity"] > values["fridge_max_humidity"]:
            self.send_json(400, {"error": "Minimum humidity must not be above the maximum."})
            return

        if values["fridge_min_humidity"] < 0 or values["fridge_max_humidity"] > 100:
            self.send_json(400, {"error": "Humidity must be between 0 and 100%."})
            return

        try:
            updated = update_fridge(int(fridge_id), values)
        except sqlite3.IntegrityError:
            self.send_json(400, {"error": "These limits are not allowed for this fridge."})
            return

        if updated:
            self.send_json(200, {"message": "Limits saved", "fridge": get_fridge(int(fridge_id))})
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

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "login":
            self.login_checkout_customer(int(parts[2]) if parts[2].isdigit() else None)
            return

        if path == "/loyalty/redeem":
            self.redeem_loyalty_reward()
            return

        # Acknowledge a fridge alert from the dashboard (admin only)
        if len(parts) == 3 and parts[0] == "alerts" and parts[2] == "acknowledge":
            admin = self.require_admin()
            if not admin:
                return

            if not parts[1].isdigit():
                self.send_json(400, {"error": "Invalid alert ID"})
                return

            if acknowledge_alert(int(parts[1]), admin["user_id"]):
                self.send_json(200, {"message": "Alert acknowledged"})
            else:
                self.send_json(404, {"error": "Alert not found or already resolved"})
            return

        if path == "/checkout/authorize-employee":
            self.authorize_employee_adjustment()
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

        # Receive scanned RFID tags as stock for an existing product
        if len(parts) == 4 and parts[:2] == ["admin", "products"] and parts[3] == "receive":
            self.receive_tags_route(parts[2])
            return

        # Pretend the RFID reader just read these tags
        if path == "/simulate/rfid":
            self.simulate_rfid()
            return

        if len(parts) == 3 and parts[:2] == ["admin", "scan"]:
            self.scan_mode_route(parts[2])
            return

        # The kiosk page was left: cancel the open sale and free the reader
        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "cancel":
            if not parts[2].isdigit():
                self.send_json(400, {"error": "Invalid checkout session ID"})
            elif self.checkout.cancel_session(int(parts[2])):
                self.send_json(200, {"session_status": "CANCELLED"})
            else:
                self.send_json(404, {"error": "Active checkout session not found"})
            return

        if len(parts) == 4 and parts[0] == "checkout" and parts[1] == "session" and parts[3] == "card":
            self.link_membership_card(int(parts[2]) if parts[2].isdigit() else None)
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

    def login_checkout_customer(self, session_id):
        if session_id is None:
            self.send_json(400, {"error": "Invalid checkout session ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        email = data.get("email")
        password = data.get("password")

        if not isinstance(email, str) or not email.strip() or not isinstance(password, str) or not password:
            self.send_json(400, {"error": "Email and password are required"})
            return

        try:
            user = authenticate_user(email.strip(), password)
            if not user:
                self.send_json(401, {"error": "Incorrect email or password"})
                return

            customer = get_customer_by_user_id(user["user_id"])
            if customer is None:
                self.send_json(404, {"error": "Customer account not found"})
                return

            with get_connection() as conn:
                session = conn.execute(
                    """
                    SELECT session_status
                    FROM SelfCheckoutSessions
                    WHERE session_id = ?
                    """,
                    (session_id,)
                ).fetchone()

                if session is None or session["session_status"] != "ACTIVE":
                    self.send_json(404, {"error": "Active checkout session not found"})
                    return

                conn.execute(
                    """
                    UPDATE SelfCheckoutSessions
                    SET user_id = ?
                    WHERE session_id = ?
                    """,
                    (user["user_id"], session_id)
                )

                membership = conn.execute(
                    """
                    SELECT customer_membership_points
                    FROM CustomerMemberships
                    WHERE customer_id = ?
                    """,
                    (customer["customer_id"],)
                ).fetchone()

                account = {
                    "customer_id": customer["customer_id"],
                    "is_member": bool(customer.get("customer_is_member", 0)),
                    "user_id": user["user_id"],
                    "first_name": user["user_fname"],
                    "last_name": user["user_lname"],
                    "email": user["user_email"],
                    "loyalty_points": membership["customer_membership_points"] if membership else 0
                }

            self.send_json(200, {
                "message": "Signed in successfully",
                "account": account
            })

        except sqlite3.Error as error:
            print(f"Checkout login database error: {error}")
            self.send_json(500, {"error": "Could not sign in"})
        except Exception as error:
            print(f"Checkout login error: {error}")
            self.send_json(500, {"error": "Could not sign in"})

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
                hardware_feedback(False)
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

    def authorize_employee_adjustment(self):
        data = self.read_json_or_400()
        if data is None:
            return

        employee = self.get_employee_by_id(data.get("employee_id"))
        if employee is None:
            self.send_json(403, {"error": "Employee ID not recognized or not authorized"})
            return

        self.send_json(200, {
            "authorized": True,
            "employee": {
                "user_id": employee["user_id"],
                "name": f"{employee['user_fname']} {employee['user_lname']}"
            }
        })

    @staticmethod
    def get_employee_by_id(employee_id):
        if isinstance(employee_id, bool):
            return None

        try:
            employee_id = int(str(employee_id).strip())
        except (TypeError, ValueError):
            return None

        if employee_id <= 0:
            return None

        with get_connection() as conn:
            employee = conn.execute(
                """
                SELECT user_id, user_role, user_fname, user_lname
                FROM Users
                WHERE user_id = ?
                  AND user_role IN ('employee', 'admin')
                """,
                (employee_id,)
            ).fetchone()

        return dict(employee) if employee else None

    def redeem_loyalty_reward(self):
        user = self.require_user()
        if not user:
            return

        data = self.read_json_or_400()
        if data is None:
            return

        reward_id = data.get("reward_id")
        if isinstance(reward_id, bool) or not str(reward_id).isdigit():
            self.send_json(400, {"error": "A valid reward ID is required"})
            return

        customer = get_customer_by_user_id(user["user_id"])
        if customer is None:
            self.send_json(404, {"error": "Customer account not found"})
            return

        if not customer.get("customer_is_member"):
            self.send_json(403, {"error": "This account is not enrolled in the loyalty program"})
            return

        conn = get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE")

            reward = conn.execute(
                """
                SELECT reward_id, reward_name, reward_description,
                       reward_points_cost
                FROM Rewards
                WHERE reward_id = ? AND reward_is_active = 1
                """,
                (int(reward_id),)
            ).fetchone()

            if reward is None:
                conn.rollback()
                self.send_json(404, {"error": "Reward is no longer available"})
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
                conn.rollback()
                self.send_json(409, {"error": "Loyalty membership could not be found"})
                return

            points_cost = reward["reward_points_cost"]
            current_points = membership["customer_membership_points"]
            if current_points < points_cost:
                conn.rollback()
                self.send_json(400, {"error": "You do not have enough points for this reward"})
                return

            conn.execute(
                """
                UPDATE CustomerMemberships
                SET customer_membership_points = customer_membership_points - ?,
                    customer_membership_updated_at = CURRENT_TIMESTAMP
                WHERE customer_id = ?
                """,
                (points_cost, customer["customer_id"])
            )

            transaction_id = conn.execute(
                """
                INSERT INTO LoyaltyTransactions (
                    customer_id,
                    loyalty_transaction_type,
                    loyalty_points_change,
                    loyalty_transaction_description
                )
                VALUES (?, 'REDEEM', ?, ?)
                """,
                (
                    customer["customer_id"],
                    -points_cost,
                    f"Redeemed reward: {reward['reward_name']}"
                )
            ).lastrowid

            redemption_id = conn.execute(
                """
                INSERT INTO RewardRedemptions (
                    reward_id,
                    loyalty_transaction_id,
                    redemption_status
                )
                VALUES (?, ?, 'COMPLETED')
                """,
                (int(reward_id), transaction_id)
            ).lastrowid

            balance = conn.execute(
                """
                SELECT customer_membership_points
                FROM CustomerMemberships
                WHERE customer_id = ?
                """,
                (customer["customer_id"],)
            ).fetchone()["customer_membership_points"]

            conn.commit()
            self.send_json(201, {
                "message": "Reward redeemed successfully",
                "redemption_id": redemption_id,
                "reward": dict(reward),
                "points_redeemed": points_cost,
                "points_balance": balance
            })

        except Exception as error:
            conn.rollback()
            print(f"Loyalty redemption error: {error}")
            self.send_json(500, {"error": "Could not redeem this reward"})
        finally:
            conn.close()

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

        epcs, supplier, error = self.read_tag_batch(data, required=False)
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
                product.get("image_url"),
                epcs=epcs,
                supplier=supplier
            )
        except TagError as error:
            self.send_json(409, {"error": str(error)})
            return
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "A product with this UPC already exists"})
            return

        if epcs:
            self.scanner.stop()
            self.scanner.clear()

        self.send_json(201, get_product(product_id))

    # Reads the scanned tags and optional supplier sent with a stock batch
    def read_tag_batch(self, data, required=True):
        raw = data.get("epcs", [])
        if not isinstance(raw, list):
            return None, None, "epcs must be a list"

        epcs = []
        for value in raw:
            epc = normalize_epc(value)
            if epc is None:
                return None, None, f"Invalid tag: {value}"
            if epc not in epcs:
                epcs.append(epc)

        if required and not epcs:
            return None, None, "Scan at least one tag"

        supplier = data.get("supplier")
        if supplier is not None and not isinstance(supplier, str):
            return None, None, "Supplier must be text"
        supplier = (supplier or "").strip() or None

        return epcs, supplier, None

    def receive_tags_route(self, product_id):
        if not self.require_admin():
            return

        if not product_id.isdigit():
            self.send_json(404, {"error": "Product not found"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        epcs, supplier, error = self.read_tag_batch(data)
        if error:
            self.send_json(400, {"error": error})
            return

        try:
            received = receive_tagged_stock(int(product_id), epcs, supplier)
        except TagError as error:
            self.send_json(409, {"error": str(error)})
            return
        except sqlite3.IntegrityError as error:
            print(f"Stock receive error: {error}")
            self.send_json(409, {"error": "Could not save these tags"})
            return

        if received is None:
            self.send_json(404, {"error": "Product not found"})
            return

        self.scanner.stop()
        self.scanner.clear()

        product = get_product(int(product_id))
        product["received"] = received
        self.send_json(201, product)

    # The scanner simulator is on unless SCANNER_SIMULATOR=0
    def require_simulator(self):
        if os.getenv("SCANNER_SIMULATOR", "1") == "0":
            self.send_json(404, {"error": "Scanner simulator is disabled"})
            return False
        return True

    def simulate_rfid(self):
        if not self.require_simulator():
            return

        data = self.read_json_or_400()
        if data is None:
            return

        raw = data.get("epcs")
        if not isinstance(raw, list) or not raw:
            self.send_json(400, {"error": "epcs must be a non-empty list"})
            return

        epcs = [normalize_epc(value) for value in raw]
        if None in epcs:
            self.send_json(400, {"error": "Tags must be up to 24 hex characters"})
            return

        routed_to = "ignored"
        for epc in epcs:
            routed_to = self.route_tag(epc)

        self.send_json(200, {"routed_to": routed_to, "count": len(epcs)})

    # Turn the admin stock-scanning mode on or off
    def scan_mode_route(self, action):
        if not self.require_admin():
            return

        if action == "start":
            if self.checkout.is_busy():
                self.send_json(409, {"error": "The self-checkout is in use. Try again when the sale is finished."})
                return
            self.scanner.start()
        elif action == "stop":
            self.scanner.stop()
        elif action == "clear":
            self.scanner.clear()
        else:
            self.send_json(404, {"error": "Route not found"})
            return

        self.send_json(200, self.scanner.snapshot())

    # Link a customer to the sale by scanning their membership card
    def link_membership_card(self, session_id):
        if session_id is None:
            self.send_json(400, {"error": "Invalid checkout session ID"})
            return

        data = self.read_json_or_400()
        if data is None:
            return

        code = data.get("code")
        code = code.strip() if isinstance(code, str) else ""

        customer = get_customer_by_card(code)
        if customer is None:
            self.send_json(404, {"error": "Membership card not recognized"})
            return

        with get_connection() as conn:
            session = conn.execute(
                """
                SELECT user_id, session_status
                FROM SelfCheckoutSessions
                WHERE session_id = ?
                """,
                (session_id,)
            ).fetchone()

            if session is None or session["session_status"] != "ACTIVE":
                self.send_json(404, {"error": "Active checkout session not found"})
                return

            # A signed-in account keeps the sale; the card is ignored.
            if session["user_id"] is not None:
                self.send_json(409, {"error": "An account is already linked to this sale"})
                return

            conn.execute(
                "UPDATE SelfCheckoutSessions SET user_id = ? WHERE session_id = ?",
                (customer["user_id"], session_id)
            )

        self.send_json(200, {
            "message": f"Welcome, {customer['user_fname']}",
            "account": {
                "customer_id": customer["customer_id"],
                "is_member": bool(customer.get("customer_is_member", 0)),
                "user_id": customer["user_id"],
                "first_name": customer["user_fname"],
                "last_name": customer["user_lname"],
                "loyalty_points": customer["customer_loyalty_points"],
                "via_card": True
            }
        })

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
        if self.scanner.is_active():
            self.send_json(409, {"error": "Stock is being received. Please wait a moment."})
            return

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

            current_cart = self.checkout.get_cart(int(parts[2]))
            if current_cart is None:
                self.send_json(404, {"error": "Checkout session not found"})
                return

            current_item = next(
                (item for item in current_cart["items"] if item["product_id"] == int(parts[4])),
                None
            )
            if current_item is None:
                self.send_json(404, {"error": "Cart item not found"})
                return

            # Customers can lower quantities themselves before paying (Phase 3).
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

        # Drop a stray tag from the current stock scan
        if len(parts) == 4 and parts[:3] == ["admin", "scan", "tags"]:
            if self.require_admin():
                self.scanner.remove(parts[3])
                self.send_json(200, self.scanner.snapshot())
            return

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
            # Customers can remove unwanted items themselves before paying (Phase 3).
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

    try:
        updated = ensure_membership_cards()
        if updated:
            print(f"[INFO] Issued membership card codes to {updated} customer(s).")
    except Exception as error:
        print(f"[WARNING] Could not update membership cards: {error}")

    checkout = SelfCheckout()
    scanner = StockScanner()
    Server.checkout = checkout
    Server.scanner = scanner

    # Tags go to the stock scan while an admin is receiving stock,
    # otherwise to the self-checkout.
    def route_tag(epc, rssi=None):
        if scanner.is_active():
            scanner.process_rfid(epc, rssi)
            return "stock-scan"

        checkout.process_rfid(epc, rssi)
        return "checkout" if checkout.active_session_id is not None else "ignored"

    Server.route_tag = staticmethod(route_tag)

    reader = None

    try:
        reader = RFIDReader()
        reader.start(route_tag)
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
