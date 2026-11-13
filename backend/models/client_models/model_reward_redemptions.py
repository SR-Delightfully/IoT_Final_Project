from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "RewardRedemptions"
PRIMARY_KEY = "redemption_id"

def get_all_redemptions():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_redemption(redemption_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, redemption_id)

def get_redemption_by_transaction(transaction_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM RewardRedemptions
            WHERE loyalty_transaction_id = ?
            """,
            (transaction_id,)
        ).fetchone()

        return dict(row) if row else None

def add_redemption(reward_id, loyalty_transaction_id, status="PENDING"):
    return insert_record(TABLE, {
        "reward_id": reward_id,
        "loyalty_transaction_id": loyalty_transaction_id,
        "redemption_status": status
    })

def update_redemption(redemption_id, values):
    return update_record(TABLE, PRIMARY_KEY, redemption_id, values)

def delete_redemption(redemption_id):
    return delete_record(TABLE, PRIMARY_KEY, redemption_id)