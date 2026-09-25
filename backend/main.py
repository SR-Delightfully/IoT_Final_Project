# Yeah I am Stuck here
# I gotchu, i need to connect the frontend anyways lol

from http.server import BaseHTTPRequestHandler, HTTPServer
import json

from models.customer_model import init_db, add_customer
from breadboardCode import login


class Server(BaseHTTPRequestHandler):

    # CORS options
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/register":
            self.register_customer()
            return

        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        self.wfile.write(
            json.dumps({
                "[ERROR]": "Route not found"
            }).encode()
        )

    def register_customer(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len)

        try:
            data = json.loads(body)

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            self.wfile.write(
                json.dumps({
                    "[ERROR]": "Invalid JSON"
                }).encode()
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
            if field not in data or not data[field]:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                self.wfile.write(
                    json.dumps({
                        "[ERROR]": f"Missing field: {field}"
                    }).encode()
                )

                return

            if data["password"] != data["confirm_password"]:
                login(False)

                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                self.wfile.write(
                    json.dumps({
                        "[ERROR]": "Passwords do not match"
                    }).encode()
                )

                return

        try:
            add_customer(
                data["first_name"],
                data["last_name"],
                data["address"],
                data["phone"],
                data["email"],
                data["password"]
            )

            login(True)

            res = {
                "message": "Customer added"
            }

            self.send_response(201)

        except Exception as e:
            print(e)

            login(False)

            res = {
                "error": "Could not add customer"
            }

            self.send_response(500)

        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        self.wfile.write(
            json.dumps(res).encode()
        )


def run_server():
    init_db()

    server_address = ("0.0.0.0", 5000)

    server = HTTPServer(
        server_address,
        Server
    )

    print("Server running on http://localhost:5000")

    server.serve_forever()


if __name__ == "__main__":
    run_server()
