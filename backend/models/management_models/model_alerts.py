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