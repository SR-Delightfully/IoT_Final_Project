from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "SessionItems"
PRIMARY_KEY = "session_item_id"

def get_all_session_items():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_session_item(session_item_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, session_item_id)

def get_items_by_session(session_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT si.*, p.product_name, p.product_price_cents,
                   p.product_stock_quantity
            FROM SessionItems si
            JOIN Products p ON si.product_id = p.product_id
            WHERE si.session_id = ?
            ORDER BY si.session_item_id
            """,
            (session_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_session_item(session_id, product_id, quantity=1):
    with db_connection() as conn:
        conn.execute(
            """
            INSERT INTO SessionItems (
                session_id,
                product_id,
                session_item_quantity
            )
            VALUES (?, ?, ?)
            ON CONFLICT(session_id, product_id)
            DO UPDATE SET session_item_quantity =
                session_item_quantity + excluded.session_item_quantity
            """,
            (session_id, product_id, quantity)
        )

        row = conn.execute(
            """
            SELECT * FROM SessionItems
            WHERE session_id = ? AND product_id = ?
            """,
            (session_id, product_id)
        ).fetchone()

        return dict(row) if row else None

def update_session_item(session_item_id, values):
    return update_record(TABLE, PRIMARY_KEY, session_item_id, values)

def delete_session_item(session_item_id):
    return delete_record(TABLE, PRIMARY_KEY, session_item_id)

def clear_session_items(session_id):
    with db_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM SessionItems WHERE session_id = ?",
            (session_id,)
        )
        return cursor.rowcount