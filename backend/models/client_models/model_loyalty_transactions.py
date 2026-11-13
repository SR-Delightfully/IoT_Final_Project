from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "LoyaltyTransactions"
PRIMARY_KEY = "loyalty_transaction_id"

def get_all_loyalty_transactions():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_loyalty_transaction(transaction_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, transaction_id)

def get_customer_loyalty_transactions(customer_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM LoyaltyTransactions
            WHERE customer_id = ?
            ORDER BY created_at DESC
            """,
            (customer_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_loyalty_transaction(customer_id, transaction_type, points_change,
                            description=None, purchase_id=None):
    return insert_record(TABLE, {
        "customer_id": customer_id,
        "purchase_id": purchase_id,
        "loyalty_transaction_type": transaction_type,
        "loyalty_points_change": points_change,
        "description": description
    })

def update_loyalty_transaction(transaction_id, values):
    return update_record(TABLE, PRIMARY_KEY, transaction_id, values)

def delete_loyalty_transaction(transaction_id):
    return delete_record(TABLE, PRIMARY_KEY, transaction_id)