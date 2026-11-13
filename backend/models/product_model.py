from models.customer_model import get_connection


INVENTORY_COLUMNS = """
    i.product_id,
    i.product_name,
    i.product_category,
    i.product_upc,
    i.product_price,
    i.product_producer_company,
    i.product_active,
    p.product_image_url,
    p.product_created_at,
    i.total_received,
    i.total_sold,
    i.quantity_in_stock,
    i.available_epc_tags
"""


def get_active_products():
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT {INVENTORY_COLUMNS}
            FROM Inventory AS i
            JOIN Products AS p ON p.product_id = i.product_id
            WHERE i.product_active = 1
            ORDER BY i.product_name
            """
        ).fetchall()

        return [dict(row) for row in rows]


def get_all_products():
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT {INVENTORY_COLUMNS}
            FROM Inventory AS i
            JOIN Products AS p ON p.product_id = i.product_id
            ORDER BY i.product_id
            """
        ).fetchall()

        return [dict(row) for row in rows]


def get_product(product_id):
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT {INVENTORY_COLUMNS}
            FROM Inventory AS i
            JOIN Products AS p ON p.product_id = i.product_id
            WHERE i.product_id = ?
            """,
            (product_id,)
        ).fetchone()

        return dict(row) if row else None


def add_product(name, category, price, upc, producer, image_url=None):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Products (
                product_name,
                product_category,
                product_price,
                product_upc,
                product_producer_company,
                product_image_url
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, category, price, upc, producer, image_url)
        )
        return cursor.lastrowid


EDITABLE_FIELDS = {
    "name": "product_name",
    "category": "product_category",
    "price": "product_price",
    "upc": "product_upc",
    "producer": "product_producer_company",
    "image_url": "product_image_url",
    "active": "product_active",
}


def update_product(product_id, **changes):
    columns = []
    values = []

    for key, value in changes.items():
        if key in EDITABLE_FIELDS:
            columns.append(f"{EDITABLE_FIELDS[key]} = ?")
            values.append(value)

    if not columns:
        return get_product(product_id) is not None

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE Products SET {', '.join(columns)} WHERE product_id = ?",
            (*values, product_id)
        )
        return cursor.rowcount > 0


def add_stock(product_id, quantity, note=None):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO StockReceptions (
                product_id,
                reception_quantity_received,
                reception_note
            )
            VALUES (?, ?, ?)
            """,
            (product_id, quantity, note)
        )
        return cursor.lastrowid
