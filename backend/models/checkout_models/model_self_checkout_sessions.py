from models.database import fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "SelfCheckoutSessions"
PRIMARY_KEY = "session_id"

def get_all_sessions():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_session(session_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, session_id)

def get_user_sessions(user_id):
    from models.database import db_connection

    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM SelfCheckoutSessions
            WHERE user_id = ?
            ORDER BY session_id DESC
            """,
            (user_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_session(user_id=None, status="ACTIVE"):
    return insert_record(TABLE, {
        "user_id": user_id,
        "session_status": status
    })

def update_session(session_id, values):
    return update_record(TABLE, PRIMARY_KEY, session_id, values)

def delete_session(session_id):
    return delete_record(TABLE, PRIMARY_KEY, session_id)