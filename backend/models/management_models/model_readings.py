from models.database import db_connection, fetch_all, fetch_by_id, insert_record, delete_record

TABLE = "Readings"
PRIMARY_KEY = "reading_id"

def get_all_readings():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_reading(reading_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, reading_id)

def get_readings_by_fridge(fridge_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM Readings
            WHERE fridge_id = ?
            ORDER BY reading_created_at DESC
            """,
            (fridge_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def get_latest_reading(fridge_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM Readings
            WHERE fridge_id = ?
            ORDER BY reading_created_at DESC, reading_id DESC
            LIMIT 1
            """,
            (fridge_id,)
        ).fetchone()

        return dict(row) if row else None

def add_reading(fridge_id, temperature, humidity):
    return insert_record(TABLE, {
        "fridge_id": fridge_id,
        "reading_temperature": temperature,
        "reading_humidity": humidity
    })

def delete_reading(reading_id):
    return delete_record(TABLE, PRIMARY_KEY, reading_id)