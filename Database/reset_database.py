
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if os.path.isdir(os.path.join(BASE_DIR, "Database")):
    DB_FILE = os.path.join(BASE_DIR, "Database", "iot.db")
else:
    DB_FILE = os.path.join(BASE_DIR, "..", "Database", "iot.db")

DB_FILE = os.path.abspath(DB_FILE)

if not os.path.isfile(DB_FILE):
    print(f"Database file not found: {DB_FILE}")
    exit()

confirmation = input("This will permanently delete ALL tables and data. Type YES to continue: ")

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

        if object_type == "table":
            cursor.execute(f'DROP TABLE IF EXISTS "{escaped_name}"')
        elif object_type == "view":
            cursor.execute(f'DROP VIEW IF EXISTS "{escaped_name}"')
        elif object_type == "trigger":
            cursor.execute(f'DROP TRIGGER IF EXISTS "{escaped_name}"')
        elif object_type == "index":
            cursor.execute(f'DROP INDEX IF EXISTS "{escaped_name}"')

    connection.commit()

    print(f"Database successfully reset: {DB_FILE}")
    print(f"Deleted {len(objects)} database objects.")
    print("All tables and their records have been deleted.")
    print("You can now run your updated SQL schema.")

except sqlite3.Error as error:
    connection.rollback()
    print(f"Database reset failed: {error}")

finally:
    connection.close()
