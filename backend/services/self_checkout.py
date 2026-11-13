
from models.database import get_connection
# Testing only: allow RFID tags to be reused across purchases.
RFID_TEST_MODE = True

class SelfCheckout:
    def __init__(self):
        self.active_session_id = None
        self.session_tags = {}

    def create_session(self, user_id=None):
        with get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO SelfCheckoutSessions (
                    user_id,
                    session_status
                )
                VALUES (?, 'ACTIVE')
                """,
                (user_id,)
            )

            session_id = cursor.lastrowid

        self.active_session_id = session_id
        self.session_tags[session_id] = []

        return session_id

    def get_cart(self, session_id):
        with get_connection() as conn:
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
                    c.category_name,
                    si.session_item_quantity
                FROM SessionItems AS si
                JOIN Products AS p
                    ON p.product_id = si.product_id
                LEFT JOIN Categories AS c
                    ON c.category_id = p.category_id
                WHERE si.session_id = ?
                """,
                (session_id,)
            ).fetchall()

        items = [dict(row) for row in rows]

        subtotal = sum(
            item["product_price_cents"] * item["session_item_quantity"]
            for item in items
        )

        gst = round(subtotal * 0.05)
        qst = round(subtotal * 0.09975)

        return {
            "session": dict(session),
            "items": items,
            "subtotal": subtotal,
            "gst": gst,
            "qst": qst,
            "total": subtotal + gst + qst,
            "item_count": sum(item["session_item_quantity"] for item in items)
        }

    def add_to_session(self, session_id, product_id, quantity=1):
        if type(quantity) is not int or quantity < 1:
            return False

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
                return False

            product = conn.execute(
                """
                SELECT product_stock_quantity, product_is_active
                FROM Products
                WHERE product_id = ?
                """,
                (product_id,)
            ).fetchone()

            if (
                product is None
                or not product["product_is_active"]
                or product["product_stock_quantity"] < quantity
            ):
                return False

            existing = conn.execute(
                """
                SELECT session_item_quantity
                FROM SessionItems
                WHERE session_id = ? AND product_id = ?
                """,
                (session_id, product_id)
            ).fetchone()

            current_quantity = existing["session_item_quantity"] if existing else 0

            if current_quantity + quantity > product["product_stock_quantity"]:
                return False

            conn.execute(
                """
                INSERT INTO SessionItems (
                    session_id,
                    product_id,
                    session_item_quantity
                )
                VALUES (?, ?, ?)
                ON CONFLICT(session_id, product_id)
                DO UPDATE SET
                    session_item_quantity =
                        session_item_quantity + excluded.session_item_quantity
                """,
                (session_id, product_id, quantity)
            )

        return self.get_cart(session_id)

    def set_quantity(self, session_id, product_id, quantity):
        if type(quantity) is not int or quantity < 1:
            return False

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
                return False

            product = conn.execute(
                """
                SELECT product_stock_quantity, product_is_active
                FROM Products
                WHERE product_id = ?
                """,
                (product_id,)
            ).fetchone()

            if (
                product is None
                or not product["product_is_active"]
                or quantity > product["product_stock_quantity"]
            ):
                return False

            cursor = conn.execute(
                """
                UPDATE SessionItems
                SET session_item_quantity = ?
                WHERE session_id = ? AND product_id = ?
                """,
                (quantity, session_id, product_id)
            )

            if cursor.rowcount == 0:
                return False

        return self.get_cart(session_id)

    def remove_from_session(self, session_id, product_id):
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
                return False

            cursor = conn.execute(
                """
                DELETE FROM SessionItems
                WHERE session_id = ? AND product_id = ?
                """,
                (session_id, product_id)
            )

            if cursor.rowcount == 0:
                return False

        return self.get_cart(session_id)

    def scan_products(self, scanned_epcs):
        if not scanned_epcs:
            return None

        unique_epcs = list(dict.fromkeys(
            epc.strip().upper()
            for epc in scanned_epcs
            if isinstance(epc, str) and epc.strip()
        ))

        if not unique_epcs:
            return None

        placeholders = ", ".join(["?"] * len(unique_epcs))

        with get_connection() as conn:
        # Find active products whose scanned tags have not already been sold.
            rows = conn.execute(
                f"""
                SELECT
                    p.product_id,
                    p.product_name,
                    p.product_description,
                    p.product_company,
                    p.product_image_url,
                    p.product_price_cents,
                    p.product_stock_quantity,
                    c.category_name,
                    pt.product_tag_epc
                FROM Products AS p
                JOIN ProductTags AS pt
                    ON pt.product_id = p.product_id
                LEFT JOIN Categories AS c
                    ON c.category_id = p.category_id
                WHERE UPPER(pt.product_tag_epc) IN ({placeholders})
                    AND pt.product_tag_status = 'ACTIVE'
                    
                     AND (
                        ? = 1 OR NOT EXISTS (
                            SELECT 1
                            FROM ProductTagSales pts
                            WHERE pts.product_tag_id = pt.product_tag_id
                        )
                    )
                    AND p.product_is_active = 1
                    AND p.product_stock_quantity > 0
                """,
                unique_epcs + [int(RFID_TEST_MODE)]
            ).fetchall()

        items = [dict(row) for row in rows]

        subtotal = sum(item["product_price_cents"] for item in items)
        gst = round(subtotal * 0.05)
        qst = round(subtotal * 0.09975)

        return {
            "items": items,
            "subtotal": subtotal,
            "gst": gst,
            "qst": qst,
            "total": subtotal + gst + qst,
            "item_count": len(items)
        }

    def scan_barcodes(self, scanned_barcodes):
        if not scanned_barcodes:
            return None

        unique_barcodes = list(dict.fromkeys(
            barcode.strip()
            for barcode in scanned_barcodes
            if isinstance(barcode, str) and barcode.strip()
        ))

        if not unique_barcodes:
            return None

        placeholders = ", ".join(["?"] * len(unique_barcodes))

        with get_connection() as conn:
            rows = conn.execute(
                f"""
                SELECT
                    p.product_id,
                    p.product_name,
                    p.product_description,
                    p.product_company,
                    p.product_image_url,
                    p.product_price_cents,
                    p.product_stock_quantity,
                    c.category_name,
                    b.barcode_value
                FROM Products AS p
                JOIN BarCodes AS b
                    ON b.product_id = p.product_id
                LEFT JOIN Categories AS c
                    ON c.category_id = p.category_id
                WHERE b.barcode_value IN ({placeholders})
                    AND p.product_is_active = 1
                    AND p.product_stock_quantity > 0
                """,
                unique_barcodes
            ).fetchall()

        items = [dict(row) for row in rows]

        subtotal = sum(item["product_price_cents"] for item in items)
        gst = round(subtotal * 0.05)
        qst = round(subtotal * 0.09975)

        return {
            "items": items,
            "subtotal": subtotal,
            "gst": gst,
            "qst": qst,
            "total": subtotal + gst + qst,
            "item_count": len(items)
        }

    def process_rfid(self, epc, rssi=None):

        if self.active_session_id is None:
            return None
        # Count each physical RFID tag only once in this cart.
        epc = epc.strip().upper()

        if epc in self.session_tags.get(self.active_session_id, []):
            return None

        result = self.scan_products([epc])

        if not result or not result["items"]:
            return None

        product = result["items"][0]

        cart = self.add_to_session(
            self.active_session_id,
            product["product_id"]
        )

        if cart:
            self.session_tags.setdefault(
                self.active_session_id, []
            ).append(epc.upper())

        return cart

    def complete_purchase(
        self,
        session_id,
        customer_id=None,
        payment_method="card"
    ):
        with get_connection() as conn:
            conn.execute("BEGIN IMMEDIATE")

            session = conn.execute(
                """
                SELECT session_id, session_status
                FROM SelfCheckoutSessions
                WHERE session_id = ?
                """,
                (session_id,)
            ).fetchone()

            if session is None or session["session_status"] != "ACTIVE":
                return False

            if customer_id is not None:
                customer = conn.execute(
                    """
                    SELECT customer_id
                    FROM Customers
                    WHERE customer_id = ?
                    """,
                    (customer_id,)
                ).fetchone()

                if customer is None:
                    return False

            items = conn.execute(
                """
                SELECT
                    p.product_id,
                    p.product_name,
                    p.product_price_cents,
                    p.product_stock_quantity,
                    si.session_item_quantity
                FROM SessionItems AS si
                JOIN Products AS p
                    ON p.product_id = si.product_id
                WHERE si.session_id = ?
                    AND p.product_is_active = 1
                """,
                (session_id,)
            ).fetchall()

            if not items:
                return False

            for item in items:
                if item["session_item_quantity"] > item["product_stock_quantity"]:
                    return False

            subtotal = sum(
                item["product_price_cents"] * item["session_item_quantity"]
                for item in items
            )

            gst = round(subtotal * 0.05)
            qst = round(subtotal * 0.09975)
            discount = 0
            total = subtotal + gst + qst - discount

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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
                """,
                (
                    customer_id,
                    session_id,
                    subtotal,
                    gst,
                    qst,
                    discount,
                    total,
                    payment_method
                )
            ).lastrowid

            purchase_items = {}

            for item in items:
                quantity = item["session_item_quantity"]

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
                        item["product_id"],
                        quantity,
                        item["product_price_cents"]
                    )
                ).lastrowid

                purchase_items[item["product_id"]] = purchase_item_id

                conn.execute(
                    """
                    UPDATE Products
                    SET product_stock_quantity = product_stock_quantity - ?,
                        product_updated_at = CURRENT_TIMESTAMP
                    WHERE product_id = ?
                    """,
                    (quantity, item["product_id"])
                )

             # Test purchases do not create new physical-tag sale records.
            tags_to_record = (
                [] if RFID_TEST_MODE else self.session_tags.get(session_id, [])
            )

            for epc in tags_to_record:
                tag = conn.execute(
                    """
                    SELECT product_tag_id, product_id
                    FROM ProductTags
                    WHERE UPPER(product_tag_epc) = ?
                    """,
                    (epc.upper(),)
                ).fetchone()

                if tag is None or tag["product_id"] not in purchase_items:
                    continue

                conn.execute(
                    """
                    INSERT OR IGNORE INTO ProductTagSales (
                        product_tag_id,
                        purchase_item_id
                    )
                    VALUES (?, ?)
                    """,
                    (
                        tag["product_tag_id"],
                        purchase_items[tag["product_id"]]
                    )
                )
            # Members earn 1 point per full dollar of the final total.
            # Save the points and their history together with the purchase.
            points_earned = 0

            if customer_id is not None and total >= 100:
                result = conn.execute(
                    """
                    UPDATE CustomerMemberships
                    SET customer_membership_points =
                            customer_membership_points + ?,
                        customer_membership_updated_at = CURRENT_TIMESTAMP
                    WHERE customer_id = ?
                      AND customer_id IN (
                          SELECT customer_id FROM Customers
                          WHERE customer_is_member = 1
                      )
                    """,
                    (total // 100, customer_id)
                )

                if result.rowcount == 1:
                    points_earned = total // 100

                    conn.execute(
                        """
                        INSERT INTO LoyaltyTransactions (
                            customer_id,
                            purchase_id,
                            loyalty_transaction_type,
                            loyalty_points_change,
                            loyalty_transaction_description
                        )
                        VALUES (?, ?, 'EARN', ?, ?)
                        """,
                        (
                            customer_id,
                            purchase_id,
                            points_earned,
                            "Points earned from purchase"
                        )
                    )
            
            receipt_number = f"ST-{purchase_id:08d}"

            receipt_id = conn.execute(
                """
                INSERT INTO Receipts (
                    purchase_id,
                    receipt_number
                )
                VALUES (?, ?)
                """,
                (purchase_id, receipt_number)
            ).lastrowid

            conn.execute(
                """
                UPDATE SelfCheckoutSessions
                SET session_status = 'COMPLETED',
                    session_completed_at = CURRENT_TIMESTAMP
                WHERE session_id = ?
                """,
                (session_id,)
            )

            receipt = conn.execute(
                """
                SELECT *
                FROM Receipts
                WHERE receipt_id = ?
                """,
                (receipt_id,)
            ).fetchone()

            receipt_data = dict(receipt)

            receipt_data.update({
                # Include the points awarded for this purchase in the receipt.
                "points_earned": points_earned,
                "purchase_id": purchase_id,
                "items": [
                    {
                        "product_id": item["product_id"],
                        "product_name": item["product_name"],
                        "product_price": item["product_price_cents"] / 100,
                        "session_item_quantity": item["session_item_quantity"]
                    }
                    for item in items
                ],
                "subtotal": subtotal / 100,
                "gst": gst / 100,
                "qst": qst / 100,
                "discount": discount / 100,
                "total": total / 100
            })

        self.session_tags.pop(session_id, None)

        if self.active_session_id == session_id:
            self.active_session_id = None

        return receipt_data
