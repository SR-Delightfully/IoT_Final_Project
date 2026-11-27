from models.database import db_connection
# Current stock and latest recorded delivery for each product.
def get_inventory_report():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.product_is_active,
                p.product_stock_quantity AS quantity_in_stock,
                (
                    SELECT MAX(sr.stock_receipt_date)
                    FROM StockReceiptItems sri
                    JOIN StockReceipts sr
                        ON sr.stock_receipt_id = sri.stock_receipt_id
                    WHERE sri.product_id = p.product_id
                ) AS last_restocked
            FROM Products p
            LEFT JOIN Categories c ON c.category_id = p.category_id
            ORDER BY p.product_name, p.product_id
            """
        ).fetchall()

        return [dict(row) for row in rows]
    
    # Total collected from completed purchases, including tax and after discounts.
def get_sales_total(start_date=None, end_date=None):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT SUM(purchase_total_cents) AS total_sales_cents
            FROM Purchases
            WHERE purchase_status = 'COMPLETED'
              AND (? IS NULL OR DATE(purchase_created_at) >= ?)
              AND (? IS NULL OR DATE(purchase_created_at) <= ?)
            """,
            (start_date, start_date, end_date, end_date)
        ).fetchone()

        return row["total_sales_cents"] or 0
# Units sold per product during the selected period.
def get_product_sales(start_date=None, end_date=None):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                s.units_sold
            FROM Products p
            LEFT JOIN Categories c ON c.category_id = p.category_id
            LEFT JOIN (
                SELECT pi.product_id,
                       SUM(pi.purchase_item_quantity) AS units_sold
                FROM PurchaseItems pi
                JOIN Purchases pu ON pu.purchase_id = pi.purchase_id
                WHERE pu.purchase_status = 'COMPLETED'
                  AND (? IS NULL OR DATE(pu.purchase_created_at) >= ?)
                  AND (? IS NULL OR DATE(pu.purchase_created_at) <= ?)
                GROUP BY pi.product_id
            ) s ON s.product_id = p.product_id
            WHERE p.product_is_active = 1 OR s.units_sold > 0
            ORDER BY p.product_name, p.product_id
            """,
            (start_date, start_date, end_date, end_date)
        ).fetchall()

        result = []

        for row in rows:
            product = dict(row)
            product["units_sold"] = product["units_sold"] or 0
            result.append(product)

        return result
# Daily product sales by category, before tax and purchase-level discounts.
def get_daily_sales(start_date=None, end_date=None):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                DATE(pu.purchase_created_at) AS sale_date,
                c.category_name,
                SUM(
                    pi.purchase_item_quantity *
                    pi.purchase_item_unit_price_cents
                ) AS product_sales_cents
            FROM Purchases pu
            JOIN PurchaseItems pi ON pi.purchase_id = pu.purchase_id
            JOIN Products p ON p.product_id = pi.product_id
            LEFT JOIN Categories c ON c.category_id = p.category_id
            WHERE pu.purchase_status = 'COMPLETED'
              AND (? IS NULL OR DATE(pu.purchase_created_at) >= ?)
              AND (? IS NULL OR DATE(pu.purchase_created_at) <= ?)
            GROUP BY DATE(pu.purchase_created_at), c.category_id
            ORDER BY sale_date, c.category_name
            """,
            (start_date, start_date, end_date, end_date)
        ).fetchall()

        return [dict(row) for row in rows]