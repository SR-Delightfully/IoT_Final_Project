from http.server import BaseHTTPRequestHandler, HTTPServer
from models.customer_model import init_db, add_customer
import json
import sqlite3
from contextlib import closing

def get_connection():
    return sqlite3.connect("../Database/iot.db")

from breadboardCode import login


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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
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

                self.send_json(200, {"fridges": fridges})

            except Exception as error:
                print(f"Fridge fetch error: {error}")
                self.send_json(
                    500,
                    {"error": "Could not load fridge data"}
                )

            return

        self.send_json(404, {"error": "Route not found"})

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

    server_address = ("0.0.0.0", 5050)
    server = HTTPServer(server_address, Server)

    print("Server running on http://localhost:5050")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()