from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Fridges"
PRIMARY_KEY = "fridge_id"

def get_all_fridges():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_fridge(fridge_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, fridge_id)

def add_fridge(name, location, min_temperature, max_temperature, min_humidity, max_humidity):
    return insert_record(TABLE, {
        "fridge_name": name,
        "fridge_location": location,
        "fridge_min_temperature": min_temperature,
        "fridge_max_temperature": max_temperature,
        "fridge_min_humidity": min_humidity,
        "fridge_max_humidity": max_humidity
    })

def update_fridge(fridge_id, values):
    return update_record(TABLE, PRIMARY_KEY, fridge_id, values)

def delete_fridge(fridge_id):
    return delete_record(TABLE, PRIMARY_KEY, fridge_id)

def get_fridge_dashboard():
    """Every fridge with its latest reading and latest MSP01 sensor values."""
    with db_connection() as conn:
        fridges = [dict(row) for row in conn.execute(
            "SELECT * FROM Fridges ORDER BY fridge_id"
        ).fetchall()]

        for fridge in fridges:
            reading = conn.execute(
                """
                SELECT reading_temperature, reading_humidity, reading_created_at
                FROM Readings
                WHERE fridge_id = ?
                ORDER BY reading_created_at DESC, reading_id DESC
                LIMIT 1
                """,
                (fridge["fridge_id"],)
            ).fetchone()

            fridge["latest_reading"] = dict(reading) if reading else None
            fridge.update(dict(reading) if reading else {
                "reading_temperature": None,
                "reading_humidity": None,
                "reading_created_at": None,
            })
            fridge["sensor"] = get_latest_sensor_values(conn, fridge["fridge_id"])

        return fridges


def get_latest_sensor_values(conn, fridge_id):
    """Newest value of each MSP01 field (they arrive in separate messages)."""
    sensor = {}

    for column in ("sensor_motion", "sensor_light", "sensor_light_detected", "sensor_battery"):
        row = conn.execute(
            f"""
            SELECT {column} AS value, sensor_created_at
            FROM SensorReadings
            WHERE fridge_id = ? AND {column} IS NOT NULL
            ORDER BY sensor_created_at DESC, sensor_reading_id DESC
            LIMIT 1
            """,
            (fridge_id,)
        ).fetchone()

        sensor[column] = row["value"] if row else None
        sensor[f"{column}_at"] = row["sensor_created_at"] if row else None

    last_seen = [value for key, value in sensor.items() if key.endswith("_at") and value]
    sensor["sensor_last_seen"] = max(last_seen) if last_seen else None

    # When motion was last detected, not just the latest motion value.
    row = conn.execute(
        """
        SELECT MAX(sensor_created_at) AS at
        FROM SensorReadings
        WHERE fridge_id = ? AND sensor_motion = 1
        """,
        (fridge_id,)
    ).fetchone()
    sensor["sensor_last_motion_at"] = row["at"] if row else None

    return sensor if sensor["sensor_last_seen"] else None


def set_fridge_fan(fridge_id, on):
    """Save the fan state from the dashboard. Returns False if the fridge doesn't exist."""
    return update_fridge(fridge_id, {
        "fridge_fan_on": 1 if on else 0,
        "fridge_fan_source": "dashboard" if on else None,
    })
