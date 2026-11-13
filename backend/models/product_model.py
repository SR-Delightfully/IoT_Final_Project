from models.database import db_connection
from models.management_models.model_stock_receipts import add_stock_receipt


# One row per product with its category, first barcode and how many were sold.
# Some columns are given two names so both the products pages and the
# self-checkout page can read the same response.
PRODUCT_QUERY = """
    SELECT
        p.product_id,
        p.product_name,
        p.product_description,
        p.category_id,
        c.category_name AS product_category,
        c.category_image_url,
        p.product_price_cents,
        ROUND(p.product_price_cents / 100.0, 2) AS product_price,
        b.barcode_value AS product_barcode,
        b.barcode_value AS product_upc,
        p.product_company,
        p.product_company AS product_producer_company,
        p.product_image_url,
        p.product_is_active,
        p.product_is_active AS product_active,
        p.product_stock_quantity,
        p.product_stock_quantity AS product_stock,
        p.product_stock_quantity AS quantity_in_stock,
        COALESCE((
            SELECT SUM(pi.purchase_item_quantity)
            FROM PurchaseItems pi
            JOIN Purchases pu ON pu.purchase_id = pi.purchase_id
            WHERE pi.product_id = p.product_id
              AND pu.purchase_status = 'COMPLETED'
        ), 0) AS total_sold,
        p.product_created_at
    FROM Products p
    LEFT JOIN Categories c ON c.category_id = p.category_id
    LEFT JOIN BarCodes b ON b.barcode_id = (
        SELECT MIN(b2.barcode_id)
        FROM BarCodes b2
        WHERE b2.product_id = p.product_id
    )
"""


def get_active_products():
    with db_connection() as conn:
        rows = conn.execute(
            PRODUCT_QUERY
            + " WHERE p.product_is_active = 1 ORDER BY p.product_name"
        ).fetchall()

        return [dict(row) for row in rows]


def get_all_products():
    with db_connection() as conn:
        rows = conn.execute(PRODUCT_QUERY + " ORDER BY p.product_id").fetchall()

        return [dict(row) for row in rows]


def get_product(product_id):
    with db_connection() as conn:
        row = conn.execute(
            PRODUCT_QUERY + " WHERE p.product_id = ?",
            (product_id,)
        ).fetchone()

        return dict(row) if row else None


def _category_id(conn, name):
    conn.execute(
        "INSERT INTO Categories (category_name) VALUES (?) "
        "ON CONFLICT(category_name) DO NOTHING",
        (name,)
    )
    return conn.execute(
        "SELECT category_id FROM Categories WHERE category_name = ?",
        (name,)
    ).fetchone()["category_id"]


def _set_barcode(conn, product_id, upc):
    barcode = conn.execute(
        "SELECT MIN(barcode_id) AS barcode_id FROM BarCodes WHERE product_id = ?",
        (product_id,)
    ).fetchone()

    if barcode["barcode_id"] is None:
        conn.execute(
            "INSERT INTO BarCodes (product_id, barcode_value) VALUES (?, ?)",
            (product_id, upc)
        )
    else:
        conn.execute(
            "UPDATE BarCodes SET barcode_value = ? WHERE barcode_id = ?",
            (upc, barcode["barcode_id"])
        )


def add_product(name, category, price, upc, producer, image_url=None):
    with db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Products (
                category_id,
                product_name,
                product_price_cents,
                product_company,
                product_image_url
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (_category_id(conn, category), name, price, producer, image_url)
        )

        product_id = cursor.lastrowid
        _set_barcode(conn, product_id, upc)

        return product_id


# Form field name -> Products column
EDITABLE_FIELDS = {
    "name": "product_name",
    "price": "product_price_cents",
    "producer": "product_company",
    "image_url": "product_image_url",
    "active": "product_is_active",
}


def update_product(product_id, **changes):
    columns = []
    values = []

    for key, value in changes.items():
        if key in EDITABLE_FIELDS:
            columns.append(f"{EDITABLE_FIELDS[key]} = ?")
            values.append(value)

    with db_connection() as conn:
        exists = conn.execute(
            "SELECT 1 FROM Products WHERE product_id = ?",
            (product_id,)
        ).fetchone()

        if not exists:
            return False

        if "category" in changes:
            columns.append("category_id = ?")
            values.append(_category_id(conn, changes["category"]))

        if columns:
            columns.append("product_updated_at = CURRENT_TIMESTAMP")
            conn.execute(
                f"UPDATE Products SET {', '.join(columns)} WHERE product_id = ?",
                (*values, product_id)
            )

        if "upc" in changes:
            _set_barcode(conn, product_id, changes["upc"])

        return True


def add_stock(product_id, quantity, note=None):
    # The note is kept as the supplier on the stock receipt
    return add_stock_receipt(
        supplier=note,
        items=[{"product_id": product_id, "quantity": quantity}]
    )
