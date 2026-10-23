from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import sqlite3
from models.customer_model import init_db, add_customer, DB_FILE
from models.fridge_model import get_all_fridges, update_fridge
from models.fridge_reading_model import get_latest_reading
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


class Server(BaseHTTPRequestHandler):

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
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
        if self.path == "/fridges":
            fridges = get_all_fridges()
            self.send_json(200, [dict(fridge) for fridge in fridges])
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

        self.send_json(404, {"error": "Route not found"})
    

        # Update the maximum temperature for a refrigerator
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
        except ValueError:
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
