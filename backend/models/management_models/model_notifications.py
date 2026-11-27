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
            ORDER BY notification_created_at DESC
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
        "notification_title": title,
        "notification_summary": summary,
        "notification_message_brief": brief_message,
        "notification_message_full": full_message
    })

def update_notification(notification_id, values):
    return update_record(TABLE, PRIMARY_KEY, notification_id, values)

def delete_notification(notification_id):
    return delete_record(TABLE, PRIMARY_KEY, notification_id)

def get_all_notifications_detailed():
    """Every notification, newest first, with its alert message and fridge."""
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT Notifications.*,
                   Alerts.alert_message,
                   Readings.fridge_id,
                   Fridges.fridge_name,
                   Users.user_email
            FROM Notifications
            LEFT JOIN Alerts ON Alerts.alert_id = Notifications.alert_id
            LEFT JOIN Readings ON Readings.reading_id = Alerts.reading_id
            LEFT JOIN Fridges ON Fridges.fridge_id = Readings.fridge_id
            LEFT JOIN Users ON Users.user_id = Notifications.user_id
            ORDER BY Notifications.notification_created_at DESC,
                     Notifications.notification_id DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]


def mark_notification_read(notification_id):
    with db_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE Notifications
            SET notification_status = 'READ',
                notification_read_at = COALESCE(notification_read_at, CURRENT_TIMESTAMP)
            WHERE notification_id = ?
            """,
            (notification_id,)
        )
        return cursor.rowcount > 0
