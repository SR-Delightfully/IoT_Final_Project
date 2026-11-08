import threading

from models.database import db_connection

GST_RATE = 5
QST_RATE = 9975


def calculate_tax(subtotal_cents, rate, denominator):
    return (subtotal_cents * rate + denominator // 2) // denominator


def cents_to_dollars(amount):
    return round(amount / 100, 2)


class SelfCheckout:
    def __init__(self):
        self.lock = threading.RLock()
        self.session_tags = {}

    def create_session(self, user_id=None):
        with db_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO SelfCheckoutSessions (user_id, session_status)
                VALUES (?, 'ACTIVE')
                """,
                (user_id,)
            )
            session_id = cursor.lastrowid

        with self.lock:
            self.session_tags[session_id] = {}

        return session_id

    def get_active_session(self):
        with db_connection() as conn:
            row = conn.execute(
                """
                SELECT session_id, user_id, session_status, session_created_at
                FROM SelfCheckoutSessions
                WHERE session_status = 'ACTIVE'
                ORDER BY session_id DESC
                LIMIT 1
                """
            ).fetchone()

        return dict(row) if row else None

    def process_rfid(self, epc, rssi=None):
        epc = epc.strip().upper() if isinstance(epc, str) else ""

        if not epc:
            return {"status": "INVALID", "message": "Invalid RFID tag."}

        session = self.get_active_session()

        if session is None:
            return {
                "status": "NO_SESSION",
                "message": "No active checkout session."
            }

        session_id = session["session_id"]

        with self.lock:
            scanned_tags = self.session_tags.setdefault(session_id, {})

            if epc in scanned_tags:
                return {"status": "DUPLICATE", "epc": epc}

            with db_connection() as conn:
                row = conn.execute(
                    """
                    SELECT
                        pt.product_tag_id,
                        pt.product_tag_epc,
                        p.product_id,
                        p.product_name,
                        p.product_price_cents,
                        p.product_stock_quantity
                    FROM ProductTags AS pt
                    JOIN Products AS p ON p.product_id = pt.product_id
                    WHERE UPPER(pt.product_tag_epc) = ?
                        AND pt.product_tag_status = 'ACTIVE'
                        AND p.product_is_active = 1
                        AND NOT EXISTS (
                            SELECT 1
                            FROM ProductTagSales AS pts
                            WHERE pts.product_tag_id = pt.product_tag_id
                        )
                    """,
                    (epc,)
                ).fetchone()

                if row is None:
                    return {"status": "UNRECOGNIZED", "epc": epc}

                if row["product_stock_quantity"] <= 0:
                    return {
                        "status": "OUT_OF_STOCK",
                        "epc": epc,
                        "product_name": row["product_name"]
                    }

                session_row = conn.execute(
                    """
                    SELECT session_status
                    FROM SelfCheckoutSessions
                    WHERE session_id = ?
                    """,
                    (session_id,)
                ).fetchone()

                if session_row is None or session_row["session_status"] != "ACTIVE":
                    return {
                        "status": "NO_SESSION",
                        "message": "Checkout session is no longer active."
                    }

                conn.execute(
                    """
                    INSERT INTO SessionItems (
                        session_id,
                        product_id,
                        session_item_quantity
                    )
                    VALUES (?, ?, 1)
                    ON CONFLICT(session_id, product_id)
                    DO UPDATE SET session_item_quantity =
                        session_item_quantity + 1
                    """,
                    (session_id, row["product_id"])
                )

                scanned_tags[epc] = {
                    "product_tag_id": row["product_tag_id"],
                    "product_id": row["product_id"]
                }

        print(f"RFID scanned: {epc} | RSSI: {rssi} dBm | Session: {session_id}")

        return {
            "status": "ADDED",
            "epc": epc,
            "session_id": session_id,
            "product_id": row["product_id"],
            "product_name": row["product_name"]
        }

    def scan_products(self, scanned_epcs, session_id=None):
        results = []

        for epc in scanned_epcs or []:
            result = self.process_rfid(epc)

            if session_id is not None and result.get("session_id") != session_id:
                continue

            results.append(result)

        return results

    def get_cart(self, session_id):
        with db_connection() as conn:
            session = conn.execute(
                """
                SELECT session_id, user_id, session_status
                FROM SelfCheckoutSessions
                WHERE session_id = ?
                """,
                (session_id,)
            ).fetchone()

            if session is None:
                return None

            rows = conn.execute(
                """
                SELECT
                    p.product_id,
                    p.product_name,
                    p.product_description,
                    p.product_company,
                    p.product_image_url,
                    p.product_price_cents,
                    p.product_stock_quantity,
                    c.category_name AS product_category,
                    b.barcode_value AS product_barcode,
                    si.session_item_quantity AS quantity
                FROM SessionItems AS si
                JOIN Products AS p ON p.product_id = si.product_id
                LEFT JOIN Categories AS c ON c.category_id = p.category_id
                LEFT JOIN BarCodes AS b ON b.product_id = p.product_id
                WHERE si.session_id = ?
                ORDER BY p.product_name
                """,
                (session_id,)
            ).fetchall()

        items = []
        subtotal = 0

        for row in rows:
            item = dict(row)
            item["product_price"] = cents_to_dollars(item["product_price_cents"])
            item["product_stock"] = item["product_stock_quantity"]
            item["line_total"] = cents_to_dollars(
                item["product_price_cents"] * item["quantity"]
            )

            subtotal += item["product_price_cents"] * item["quantity"]
            items.append(item)

        gst = calculate_tax(subtotal, GST_RATE, 100)
        qst = calculate_tax(subtotal, QST_RATE, 100000)

        return {
            "session": dict(session),
            "items": items,
            "subtotal": cents_to_dollars(subtotal),
            "gst": cents_to_dollars(gst),
            "qst": cents_to_dollars(qst),
            "total": cents_to_dollars(subtotal + gst + qst),
            "item_count": sum(item["quantity"] for item in items)
        }

    def complete_purchase(
        self,
        session_id,
        customer_id=None,
        payment_method=None
    ):
        with self.lock:
            scanned_tags = dict(self.session_tags.get(session_id, {}))

            if not scanned_tags:
                raise ValueError(
                    "The checkout cart is empty or its RFID scan data is unavailable."
                )

            with db_connection() as conn:
                conn.execute("BEGIN IMMEDIATE")

                session = conn.execute(
                    """
                    SELECT session_id
                    FROM SelfCheckoutSessions
                    WHERE session_id = ? AND session_status = 'ACTIVE'
                    """,
                    (session_id,)
                ).fetchone()

                if session is None:
                    raise ValueError(
                        "Checkout session not found or is no longer active."
                    )

                if customer_id is not None:
                    customer = conn.execute(
                        "SELECT customer_id FROM Customers WHERE customer_id = ?",
                        (customer_id,)
                    ).fetchone()

                    if customer is None:
                        raise ValueError("Customer not found.")

                tag_ids = [
                    tag["product_tag_id"]
                    for tag in scanned_tags.values()
                ]
                placeholders = ", ".join("?" for _ in tag_ids)

                rows = conn.execute(
                    f"""
                    SELECT
                        pt.product_tag_id,
                        pt.product_tag_epc,
                        p.product_id,
                        p.product_name,
                        p.product_price_cents,
                        p.product_stock_quantity
                    FROM ProductTags AS pt
                    JOIN Products AS p ON p.product_id = pt.product_id
                    WHERE pt.product_tag_id IN ({placeholders})
                        AND pt.product_tag_status = 'ACTIVE'
                        AND p.product_is_active = 1
                        AND NOT EXISTS (
                            SELECT 1 FROM ProductTagSales AS pts
                            WHERE pts.product_tag_id = pt.product_tag_id
                        )
                    """,
                    tag_ids
                ).fetchall()

                if len(rows) != len(tag_ids):
                    raise ValueError(
                        "One or more scanned products are no longer available."
                    )

                products = {}

                for row in rows:
                    product = dict(row)
                    product_id = product["product_id"]

                    products.setdefault(product_id, {
                        "product_id": product_id,
                        "product_name": product["product_name"],
                        "product_price_cents": product["product_price_cents"],
                        "product_stock_quantity": product["product_stock_quantity"],
                        "tags": []
                    })

                    products[product_id]["tags"].append(
                        product["product_tag_id"]
                    )

                subtotal = 0

                for product in products.values():
                    quantity = len(product["tags"])

                    if quantity > product["product_stock_quantity"]:
                        raise ValueError(
                            f"Insufficient stock for {product['product_name']}."
                        )

                    subtotal += product["product_price_cents"] * quantity

                gst = calculate_tax(subtotal, GST_RATE, 100)
                qst = calculate_tax(subtotal, QST_RATE, 100000)
                total = subtotal + gst + qst

                purchase_id = conn.execute(
                    """
                    INSERT INTO Purchases (
                        customer_id,
                        session_id,
                        purchase_subtotal_cents,
                        purchase_gst_cents,
                        purchase_qst_cents,
                        purchase_discount_cents,
                        purchase_total_cents,
                        purchase_payment_method,
                        purchase_status
                    )
                    VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'COMPLETED')
                    """,
                    (
                        customer_id,
                        session_id,
                        subtotal,
                        gst,
                        qst,
                        total,
                        payment_method
                    )
                ).lastrowid

                receipt_items = []

                for product in products.values():
                    quantity = len(product["tags"])

                    purchase_item_id = conn.execute(
                        """
                        INSERT INTO PurchaseItems (
                            purchase_id,
                            product_id,
                            purchase_item_quantity,
                            purchase_item_unit_price_cents
                        )
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            purchase_id,
                            product["product_id"],
                            quantity,
                            product["product_price_cents"]
                        )
                    ).lastrowid

                    updated = conn.execute(
                        """
                        UPDATE Products
                        SET product_stock_quantity = product_stock_quantity - ?
                        WHERE product_id = ? AND product_stock_quantity >= ?
                        """,
                        (quantity, product["product_id"], quantity)
                    ).rowcount

                    if updated != 1:
                        raise ValueError(
                            f"Could not update stock for {product['product_name']}."
                        )

                    for product_tag_id in product["tags"]:
                        conn.execute(
                            """
                            INSERT INTO ProductTagSales (
                                product_tag_id,
                                purchase_item_id
                            )
                            VALUES (?, ?)
                            """,
                            (product_tag_id, purchase_item_id)
                        )

                    receipt_items.append({
                        "product_id": product["product_id"],
                        "product_name": product["product_name"],
                        "product_price": cents_to_dollars(
                            product["product_price_cents"]
                        ),
                        "quantity": quantity
                    })

                conn.execute(
                    """
                    UPDATE SelfCheckoutSessions
                    SET session_status = 'COMPLETED',
                        session_completed_at = CURRENT_TIMESTAMP
                    WHERE session_id = ?
                    """,
                    (session_id,)
                )

                receipt_number = f"STS-{purchase_id:06d}"

                receipt_id = conn.execute(
                    """
                    INSERT INTO Receipts (purchase_id, receipt_number)
                    VALUES (?, ?)
                    """,
                    (purchase_id, receipt_number)
                ).lastrowid

                receipt = conn.execute(
                    "SELECT * FROM Receipts WHERE receipt_id = ?",
                    (receipt_id,)
                ).fetchone()

            self.session_tags.pop(session_id, None)

        return {
            **dict(receipt),
            "items": receipt_items,
            "subtotal": cents_to_dollars(subtotal),
            "gst": cents_to_dollars(gst),
            "qst": cents_to_dollars(qst),
            "total": cents_to_dollars(total)
        }