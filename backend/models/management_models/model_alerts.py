from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Alerts"
PRIMARY_KEY = "alert_id"

def get_all_alerts():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_alert(alert_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, alert_id)

def get_alerts_by_status(status):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM Alerts
            WHERE alert_status = ?
            ORDER BY alert_created_at DESC
            """,
            (status,)
        ).fetchall()

        return [dict(row) for row in rows]

def get_alerts_by_reading(reading_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM Alerts
            WHERE reading_id = ?
            ORDER BY alert_id
            """,
            (reading_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_alert(reading_id, alert_type, condition, value, message, status="UNACKNOWLEDGED"):
    return insert_record(TABLE, {
        "reading_id": reading_id,
        "alert_type": alert_type,
        "alert_condition": condition,
        "alert_value": value,
        "alert_message": message,
        "alert_status": status
    })

def update_alert(alert_id, values):
    return update_record(TABLE, PRIMARY_KEY, alert_id, values)

def delete_alert(alert_id):
    return delete_record(TABLE, PRIMARY_KEY, alert_id)

def get_alerts_with_fridge():
    """Newest alerts first, with the fridge they came from."""
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT Alerts.*, Readings.fridge_id, Fridges.fridge_name
            FROM Alerts
            JOIN Readings ON Readings.reading_id = Alerts.reading_id
            JOIN Fridges ON Fridges.fridge_id = Readings.fridge_id
            ORDER BY Alerts.alert_created_at DESC, Alerts.alert_id DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]


def acknowledge_alert(alert_id, user_id):
    """Mark an open alert as acknowledged. Returns False if it doesn't exist or is resolved."""
    with db_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE Alerts
            SET alert_status = 'ACKNOWLEDGED',
                alert_acknowledged_at = COALESCE(alert_acknowledged_at, CURRENT_TIMESTAMP),
                alert_acknowledged_by = COALESCE(alert_acknowledged_by, ?)
            WHERE alert_id = ? AND alert_status != 'RESOLVED'
            """,
            (user_id, alert_id)
        )
        return cursor.rowcount > 0
