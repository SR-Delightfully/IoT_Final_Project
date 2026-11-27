import json
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

def get_all_notifications_detailed(user_id):
    """Fridge-alert notifications for the fridge page, newest first: this admin's
    own dashboard alerts (the same rows as their bell) plus every alert email.
    Purchase confirmations and low-stock notices only go to the bell."""
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
            WHERE Notifications.alert_id IS NOT NULL
              AND (Notifications.notification_type = 'EMAIL'
                   OR Notifications.user_id = ?)
            ORDER BY Notifications.notification_created_at DESC,
                     Notifications.notification_id DESC
            """,
            (user_id,)
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


# ---------- In-app notifications (navbar bell) ----------
# notification_data holds {"kind": ..., ...values} so the frontend can show the
# message in the visitor's language; the English text columns are the fallback.

def notify(conn, user_id, kind, title, brief, link=None, data=None,
           notification_type="SYSTEM", alert_id=None, full=None):
    """Add a bell notification inside an existing connection/transaction."""
    payload = {"kind": kind, **(data or {})}
    conn.execute(
        """
        INSERT INTO Notifications (
            user_id, alert_id, notification_type, notification_title,
            notification_summary, notification_message_brief,
            notification_message_full, notification_status,
            notification_sent_at, notification_link, notification_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SENT', CURRENT_TIMESTAMP, ?, ?)
        """,
        (user_id, alert_id, notification_type, title, brief, brief,
         full or brief, link, json.dumps(payload))
    )


def notify_admins(conn, kind, title, brief, link=None, data=None,
                  notification_type="SYSTEM", alert_id=None):
    for row in conn.execute("SELECT user_id FROM Users WHERE user_role = 'admin'").fetchall():
        notify(conn, row[0], kind, title, brief, link, data, notification_type, alert_id)


def get_bell_notifications(user_id, limit=50):
    """The user's own in-app notifications, newest first (email log rows excluded)."""
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT notification_id, notification_type, notification_title,
                   notification_message_brief, notification_status,
                   notification_created_at, notification_read_at,
                   notification_link, notification_data, alert_id
            FROM Notifications
            WHERE user_id = ? AND notification_type != 'EMAIL'
            ORDER BY notification_created_at DESC, notification_id DESC
            LIMIT ?
            """,
            (user_id, limit)
        ).fetchall()

    result = []
    for row in rows:
        item = dict(row)
        try:
            item["notification_data"] = json.loads(item["notification_data"] or "null")
        except ValueError:
            item["notification_data"] = None
        result.append(item)
    return result


def mark_user_notifications_read(user_id, notification_id=None):
    """Mark one (or all) of a user's notifications as read. Returns rows changed."""
    query = """
        UPDATE Notifications
        SET notification_status = 'READ',
            notification_read_at = COALESCE(notification_read_at, CURRENT_TIMESTAMP)
        WHERE user_id = ? AND notification_read_at IS NULL
    """
    params = [user_id]
    if notification_id is not None:
        query += " AND notification_id = ?"
        params.append(notification_id)

    with db_connection() as conn:
        return conn.execute(query, params).rowcount
