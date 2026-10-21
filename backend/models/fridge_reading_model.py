
from models.database import get_connection


def add_reading(fridge_id, humidity, temperature):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO FridgeReadings (
                fridge_id,
                reading_humidity,
                reading_temperature
            )
            VALUES (?, ?, ?)
            """,
            (fridge_id, humidity, temperature)
        )

        return cursor.lastrowid


def get_reading(reading_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM FridgeReadings WHERE reading_id = ?",
            (reading_id,)
        ).fetchone()


def get_latest_reading(fridge_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM FridgeReadings
            WHERE fridge_id = ?
            ORDER BY reading_recorded_at DESC, reading_id DESC
            LIMIT 1
            """,
            (fridge_id,)
        ).fetchone()


def get_fridge_readings(fridge_id, limit=100):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM FridgeReadings
            WHERE fridge_id = ?
            ORDER BY reading_recorded_at DESC, reading_id DESC
            LIMIT ?
            """,
            (fridge_id, limit)
        ).fetchall()


def delete_reading(reading_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM FridgeReadings WHERE reading_id = ?",
            (reading_id,)
        )

        return cursor.rowcount > 0
