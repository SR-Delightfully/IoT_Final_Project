
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if os.path.isdir(os.path.join(BASE_DIR, "Database")):
    DB_DIR = os.path.join(BASE_DIR, "Database")
else:
    DB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "Database"))

DB_FILE = os.path.join(DB_DIR, "iot.db")
SCHEMA_FILE = os.path.join(DB_DIR, "readable.sql")
SEED_FILE = os.path.join(DB_DIR, "init_database.sql")

if not os.path.isfile(DB_FILE):
    print(f"Database file not found: {DB_FILE}")
    exit()

if not os.path.isfile(SCHEMA_FILE):
    print(f"Schema file not found: {SCHEMA_FILE}")
    exit()

if not os.path.isfile(SEED_FILE):
    print(f"Seed file not found: {SEED_FILE}")
    exit()

confirmation = input(
    "This will permanently delete ALL tables and data. "
    "The database will then be rebuilt. Type YES to continue: "
)

if confirmation != "YES":
    print("Database reset cancelled.")
    exit()

connection = sqlite3.connect(DB_FILE)
cursor = connection.cursor()

try:
    cursor.execute("PRAGMA foreign_keys = OFF")
    cursor.execute("BEGIN TRANSACTION")

    cursor.execute("""
        SELECT type, name
        FROM sqlite_master
        WHERE type IN ('table', 'view', 'trigger', 'index')
        AND name NOT LIKE 'sqlite_%'
    """)

    objects = cursor.fetchall()

    for object_type, name in objects:
        escaped_name = name.replace('"', '""')

        if object_type == "view":
            cursor.execute(f'DROP VIEW IF EXISTS "{escaped_name}"')
        elif object_type == "trigger":
            cursor.execute(f'DROP TRIGGER IF EXISTS "{escaped_name}"')
        elif object_type == "index":
            cursor.execute(f'DROP INDEX IF EXISTS "{escaped_name}"')
        elif object_type == "table":
            cursor.execute(f'DROP TABLE IF EXISTS "{escaped_name}"')

    connection.commit()

    connection.execute("PRAGMA foreign_keys = ON")

    connection.executescript(
        open(SCHEMA_FILE, encoding="utf-8").read()
    )

    connection.executescript(
        open(SEED_FILE, encoding="utf-8").read()
    )

    connection.commit()

    print("\nDatabase successfully reset and rebuilt!")
    print(f"Database: {DB_FILE}")
    print(f"Deleted {len(objects)} previous database objects.")
    print("Schema recreated.")
    print("Seed data inserted.")
    print("Products, barcodes, RFID tags and fridges initialized.")

except (sqlite3.Error, OSError) as error:
    connection.rollback()
    print(f"Database reset failed: {error}")

finally:
    connection.close()
