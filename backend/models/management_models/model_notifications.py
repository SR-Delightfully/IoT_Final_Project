from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Notifications"
PRIMARY_KEY = "notification_id"

def get_all_notifications():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_notification(notification_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, notification_id)

def get_user_notifications(user_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM Notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,)
        ).fetchall()

        return [dict(row) for row in rows]
    
def add_notification(user_id, notification_type, title, summary,
                     brief_message=None, full_message=None, alert_id=None):
    return insert_record(TABLE, {
        "user_id": user_id,
        "alert_id": alert_id,
        "notification_type": notification_type,
        "title": title,
        "summary": summary,
        "brief_message": brief_message,
        "full_message": full_message
    })

def update_notification(notification_id, values):
    return update_record(TABLE, PRIMARY_KEY, notification_id, values)

def delete_notification(notification_id):
    return delete_record(TABLE, PRIMARY_KEY, notification_id)