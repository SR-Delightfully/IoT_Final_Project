from models.database import db_connection

def get_all_stock_receipts():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT sr.*,
                   COUNT(sri.stock_receipt_item_id) AS total_products,
                   COALESCE(SUM(sri.stock_receipt_item_quantity), 0) AS total_quantity
            FROM StockReceipts sr
            LEFT JOIN StockReceiptItems sri
                ON sr.stock_receipt_id = sri.stock_receipt_id
            GROUP BY sr.stock_receipt_id
            ORDER BY sr.stock_receipt_date DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]

def get_stock_receipt(stock_receipt_id):
    with db_connection() as conn:
        receipt = conn.execute(
            """
            SELECT *
            FROM StockReceipts
            WHERE stock_receipt_id = ?
            """,
            (stock_receipt_id,)
        ).fetchone()

        if not receipt:
            return None

        items = conn.execute(
            """
            SELECT sri.*, p.product_name, p.product_price_cents
            FROM StockReceiptItems sri
            JOIN Products p ON sri.product_id = p.product_id
            WHERE sri.stock_receipt_id = ?
            """,
            (stock_receipt_id,)
        ).fetchall()

        result = dict(receipt)
        result["items"] = [dict(item) for item in items]

        return result

def add_stock_receipt(supplier=None, items=None):
    if not items:
        raise ValueError("A stock receipt must contain at least one product")

    with db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO StockReceipts (stock_receipt_supplier)
            VALUES (?)
            """,
            (supplier,)
        )

        stock_receipt_id = cursor.lastrowid

        for item in items:
            product_id = item["product_id"]
            quantity = item["quantity"]

            if type(quantity) is not int or quantity <= 0:
                raise ValueError("Received quantity must be a positive integer")

            product = conn.execute(
                """
                SELECT product_id
                FROM Products
                WHERE product_id = ?
                """,
                (product_id,)
            ).fetchone()

            if not product:
                raise ValueError(f"Product {product_id} does not exist")

            conn.execute(
                """
                INSERT INTO StockReceiptItems (
                    stock_receipt_id,
                    product_id,
                    stock_receipt_item_quantity
                )
                VALUES (?, ?, ?)
                """,
                (stock_receipt_id, product_id, quantity)
            )

            conn.execute(
                """
                UPDATE Products
                SET product_stock_quantity = product_stock_quantity + ?,
                    product_updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                """,
                (quantity, product_id)
            )

        return stock_receipt_id

def get_stock_receipt_items(stock_receipt_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT sri.*, p.product_name, p.product_company
            FROM StockReceiptItems sri
            JOIN Products p ON sri.product_id = p.product_id
            WHERE sri.stock_receipt_id = ?
            ORDER BY sri.stock_receipt_item_id
            """,
            (stock_receipt_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def delete_stock_receipt(stock_receipt_id):
    with db_connection() as conn:
        receipt = conn.execute(
            """
            SELECT stock_receipt_id
            FROM StockReceipts
            WHERE stock_receipt_id = ?
            """,
            (stock_receipt_id,)
        ).fetchone()

        if not receipt:
            return False

        items = conn.execute(
            """
            SELECT product_id, stock_receipt_item_quantity
            FROM StockReceiptItems
            WHERE stock_receipt_id = ?
            """,
            (stock_receipt_id,)
        ).fetchall()

        for item in items:
            conn.execute(
                """
                UPDATE Products
                SET product_stock_quantity = product_stock_quantity - ?,
                    product_updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                """,
                (item["stock_receipt_item_quantity"], item["product_id"])
            )

        conn.execute(
            "DELETE FROM StockReceiptItems WHERE stock_receipt_id = ?",
            (stock_receipt_id,)
        )

        conn.execute(
            "DELETE FROM StockReceipts WHERE stock_receipt_id = ?",
            (stock_receipt_id,)
        )

        return True