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
              AND (? IS NULL OR DATE(purchase_created_at, 'localtime') >= ?)
              AND (? IS NULL OR DATE(purchase_created_at, 'localtime') <= ?)
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
                  AND (? IS NULL OR DATE(pu.purchase_created_at, 'localtime') >= ?)
                  AND (? IS NULL OR DATE(pu.purchase_created_at, 'localtime') <= ?)
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
                DATE(pu.purchase_created_at, 'localtime') AS sale_date,
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
              AND (? IS NULL OR DATE(pu.purchase_created_at, 'localtime') >= ?)
              AND (? IS NULL OR DATE(pu.purchase_created_at, 'localtime') <= ?)
            GROUP BY DATE(pu.purchase_created_at, 'localtime'), c.category_id
            ORDER BY sale_date, c.category_name
            """,
            (start_date, start_date, end_date, end_date)
        ).fetchall()

        return [dict(row) for row in rows]

# Customer activity for a date range (or one day when start == end).
# New customer = their first completed purchase ever falls inside the range.
# Returning customer = they also bought before the range.
# Shoppers per day = distinct customers + guest checkouts (no account).
def get_customer_activity(start_date=None, end_date=None):
    from datetime import date, timedelta

    with db_connection() as conn:
        bounds = conn.execute(
            """
            SELECT MIN(DATE(purchase_created_at, 'localtime')) AS first_day,
                   MAX(DATE(purchase_created_at, 'localtime')) AS last_day
            FROM Purchases
            WHERE purchase_status = 'COMPLETED'
            """
        ).fetchone()

        today = date.today().isoformat()
        start = start_date or bounds["first_day"] or today
        end = end_date or max(bounds["last_day"] or today, today)

        purchases = conn.execute(
            """
            SELECT DATE(pu.purchase_created_at, 'localtime') AS day,
                   pu.customer_id,
                   first.first_day
            FROM Purchases pu
            LEFT JOIN (
                SELECT customer_id, MIN(DATE(purchase_created_at, 'localtime')) AS first_day
                FROM Purchases
                WHERE purchase_status = 'COMPLETED' AND customer_id IS NOT NULL
                GROUP BY customer_id
            ) first ON first.customer_id = pu.customer_id
            WHERE pu.purchase_status = 'COMPLETED'
              AND DATE(pu.purchase_created_at, 'localtime') BETWEEN ? AND ?
            """,
            (start, end)
        ).fetchall()

    customers = {}          # customer_id -> first purchase day
    guest_checkouts = 0
    daily_customers = {}    # day -> set of customer ids
    daily_guests = {}       # day -> guest checkout count

    for row in purchases:
        if row["customer_id"] is None:
            guest_checkouts += 1
            daily_guests[row["day"]] = daily_guests.get(row["day"], 0) + 1
        else:
            customers[row["customer_id"]] = row["first_day"]
            daily_customers.setdefault(row["day"], set()).add(row["customer_id"])

    new_customers = sum(1 for first_day in customers.values() if first_day >= start)

    # Every calendar day counts, so a day with nobody can be the quietest.
    daily = []
    day = date.fromisoformat(start)
    last = date.fromisoformat(end)

    while day <= last:
        key = day.isoformat()
        members = len(daily_customers.get(key, ()))
        guests = daily_guests.get(key, 0)
        daily.append({
            "date": key,
            "customers": members,
            "guests": guests,
            "shoppers": members + guests,
        })
        day += timedelta(days=1)

    busiest = max(daily, key=lambda d: d["shoppers"]) if daily else None
    quietest = min(daily, key=lambda d: d["shoppers"]) if daily else None

    return {
        "start_date": start,
        "end_date": end,
        "total_customers": len(customers),
        "new_customers": new_customers,
        "returning_customers": len(customers) - new_customers,
        "guest_checkouts": guest_checkouts,
        "total_shoppers": len(customers) + guest_checkouts,
        "busiest_day": busiest,
        "quietest_day": quietest,
        "daily": daily,
    }
