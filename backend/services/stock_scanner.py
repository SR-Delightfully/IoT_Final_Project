import re
import threading
import time

from models.database import get_connection

EPC_PATTERN = re.compile(r"^[0-9A-F]{1,24}$")


def normalize_epc(epc):
    if not isinstance(epc, str):
        return None

    epc = epc.strip().upper()
    return epc if EPC_PATTERN.match(epc) else None


# Collects RFID tags while an admin is receiving stock.
# While scan mode is on, the reader sends tags here instead of the self-checkout.
class StockScanner:
    # Scan mode turns itself off if the dashboard stops checking in
    # (for example the admin closed the tab), so the kiosk is not blocked.
    IDLE_TIMEOUT = 30

    def __init__(self):
        self.lock = threading.Lock()
        self.active = False
        self.epcs = []
        self.last_seen = 0

    def is_active(self):
        with self.lock:
            if self.active and time.time() - self.last_seen > self.IDLE_TIMEOUT:
                self.active = False
            return self.active

    def start(self):
        with self.lock:
            self.active = True
            self.last_seen = time.time()

    def stop(self):
        with self.lock:
            self.active = False

    def clear(self):
        with self.lock:
            self.epcs = []

    def remove(self, epc):
        epc = normalize_epc(epc)
        with self.lock:
            if epc in self.epcs:
                self.epcs.remove(epc)
                return True
        return False

    def process_rfid(self, epc, rssi=None):
        epc = normalize_epc(epc)
        if epc is None:
            return

        with self.lock:
            if self.active and epc not in self.epcs:
                self.epcs.append(epc)

    def snapshot(self):
        with self.lock:
            self.last_seen = time.time()
            active = self.active
            epcs = list(self.epcs)

        registered = {}
        if epcs:
            placeholders = ", ".join("?" for _ in epcs)
            with get_connection() as conn:
                rows = conn.execute(
                    f"""
                    SELECT UPPER(pt.product_tag_epc) AS epc, p.product_name
                    FROM ProductTags pt
                    JOIN Products p ON p.product_id = pt.product_id
                    WHERE UPPER(pt.product_tag_epc) IN ({placeholders})
                    """,
                    epcs
                ).fetchall()
            registered = {row["epc"]: row["product_name"] for row in rows}

        tags = [
            {
                "epc": epc,
                "status": "registered" if epc in registered else "new",
                "product_name": registered.get(epc)
            }
            for epc in epcs
        ]

        return {
            "active": active,
            "tags": tags,
            "new_count": sum(1 for tag in tags if tag["status"] == "new")
        }


# What the scanner simulator can "scan": each active product with its barcode
# and some of its unsold tags, plus every customer's membership card.
def get_simulator_catalog(tags_per_product=10):
    with get_connection() as conn:
        products = conn.execute(
            """
            SELECT p.product_id, p.product_name,
                   (SELECT MIN(b.barcode_value) FROM BarCodes b
                    WHERE b.product_id = p.product_id) AS barcode
            FROM Products p
            WHERE p.product_is_active = 1
            ORDER BY p.product_name
            """
        ).fetchall()

        tags = conn.execute(
            """
            SELECT pt.product_id, pt.product_tag_epc
            FROM ProductTags pt
            LEFT JOIN ProductTagSales s ON s.product_tag_id = pt.product_tag_id
            WHERE pt.product_tag_status = 'ACTIVE' AND s.product_tag_id IS NULL
            ORDER BY pt.product_tag_id
            """
        ).fetchall()

        cards = conn.execute(
            """
            SELECT c.customer_code AS code,
                   u.user_fname || ' ' || u.user_lname AS name
            FROM Customers c
            JOIN Users u ON u.user_id = c.user_id
            WHERE c.customer_code IS NOT NULL
            ORDER BY c.customer_id
            """
        ).fetchall()

    tags_by_product = {}
    for tag in tags:
        product_tags = tags_by_product.setdefault(tag["product_id"], [])
        if len(product_tags) < tags_per_product:
            product_tags.append(tag["product_tag_epc"])

    return {
        "products": [
            {**dict(product), "tags": tags_by_product.get(product["product_id"], [])}
            for product in products
        ],
        "cards": [dict(card) for card in cards]
    }
