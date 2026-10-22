
from models.database import get_connection


def add_notification(alert_id, user_id, notification_type):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Notifications (
                alert_id,
                user_id,
                notification_type
            )
            VALUES (?, ?, ?)
            """,
            (alert_id, user_id, notification_type)
        )

        return cursor.lastrowid


def get_notification(notification_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM Notifications WHERE notification_id = ?",
            (notification_id,)
        ).fetchone()


def get_user_notifications(user_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM Notifications
            WHERE user_id = ?
            ORDER BY notification_created_at DESC
            """,
            (user_id,)
        ).fetchall()


def mark_notification_sent(notification_id):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE Notifications
            SET notification_status = 'sent',
                notification_sent_at = CURRENT_TIMESTAMP
            WHERE notification_id = ?
            """,
            (notification_id,)
        )

        return cursor.rowcount > 0


def mark_notification_read(notification_id, user_id):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE Notifications
            SET notification_status = 'read',
                notification_read_at = CURRENT_TIMESTAMP
            WHERE notification_id = ?
              AND user_id = ?
            """,
            (notification_id, user_id)
        )

        return cursor.rowcount > 0


def delete_notification(notification_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM Notifications WHERE notification_id = ?",
            (notification_id,)
        )

        return cursor.rowcount > 0
