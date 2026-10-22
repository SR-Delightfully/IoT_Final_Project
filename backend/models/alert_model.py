
from models.database import get_connection


def add_alert(
    fridge_id,
    reading_id,
    alert_type,
    condition,
    value,
    message
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Alerts (
                fridge_id,
                reading_id,
                alert_type,
                alert_condition,
                alert_value,
                alert_message
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                fridge_id,
                reading_id,
                alert_type,
                condition,
                value,
                message
            )
        )

        return cursor.lastrowid


def get_alert(alert_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM Alerts WHERE alert_id = ?",
            (alert_id,)
        ).fetchone()


def get_all_alerts():
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM Alerts ORDER BY alert_created_at DESC"
        ).fetchall()


def get_fridge_alerts(fridge_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM Alerts
            WHERE fridge_id = ?
            ORDER BY alert_created_at DESC
            """,
            (fridge_id,)
        ).fetchall()


def acknowledge_alert(alert_id, user_id):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE Alerts
            SET alert_status = 'acknowledged',
                alert_acknowledged_by = ?,
                alert_acknowledged_at = CURRENT_TIMESTAMP
            WHERE alert_id = ?
              AND alert_status = 'unacknowledged'
            """,
            (user_id, alert_id)
        )

        return cursor.rowcount > 0


def resolve_alert(alert_id):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE Alerts
            SET alert_status = 'resolved',
                alert_resolved_at = CURRENT_TIMESTAMP
            WHERE alert_id = ?
              AND alert_status != 'resolved'
            """,
            (alert_id,)
        )

        return cursor.rowcount > 0


def delete_alert(alert_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM Alerts WHERE alert_id = ?",
            (alert_id,)
        )

        return cursor.rowcount > 0
