
from models.database import get_connection


def add_fridge(
    name,
    location,
    max_humidity,
    min_humidity,
    max_temperature,
    min_temperature
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Fridges (
                fridge_name,
                fridge_location,
                fridge_max_humidity,
                fridge_min_humidity,
                fridge_max_temperature,
                fridge_min_temperature
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                location,
                max_humidity,
                min_humidity,
                max_temperature,
                min_temperature
            )
        )

        return cursor.lastrowid


def get_fridge(fridge_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM Fridges WHERE fridge_id = ?",
            (fridge_id,)
        ).fetchone()


def get_all_fridges():
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM Fridges ORDER BY fridge_id"
        ).fetchall()


def update_fridge(fridge_id, **fields):
    allowed_fields = {
        "fridge_name",
        "fridge_location",
        "fridge_max_humidity",
        "fridge_min_humidity",
        "fridge_max_temperature",
        "fridge_min_temperature"
    }

    updates = {
        key: value
        for key, value in fields.items()
        if key in allowed_fields
    }

    if not updates:
        return False

    assignments = ", ".join(f"{key} = ?" for key in updates)
    values = list(updates.values()) + [fridge_id]

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE Fridges SET {assignments} WHERE fridge_id = ?",
            values
        )

        return cursor.rowcount > 0


def delete_fridge(fridge_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM Fridges WHERE fridge_id = ?",
            (fridge_id,)
        )

        return cursor.rowcount > 0
