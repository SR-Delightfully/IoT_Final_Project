
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime
import shutil
import re

BASE_DIR = Path(__file__).resolve().parents[2]
DB_FILE = BASE_DIR / "Database" / "iot.db"
SCHEMA_FILE = BASE_DIR / "Database" / "readable.sql"
SEED_FILE = BASE_DIR / "Database" / "init_database.sql"

@contextmanager
def db_connection():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_connection():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def _database_has_data():
    with db_connection() as conn:
        tables = conn.execute("""
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
        """).fetchall()

        for table in tables:
            count = conn.execute(
                f'SELECT COUNT(*) FROM "{table["name"]}"'
            ).fetchone()[0]

            if count > 0:
                return True

    return False

def _build_database():
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Schema not found: {SCHEMA_FILE}")

    if not SEED_FILE.exists():
        raise FileNotFoundError(f"Seed file not found: {SEED_FILE}")

    conn = get_connection()

    try:
        conn.executescript(
            SCHEMA_FILE.read_text(encoding="utf-8")
        )

        conn.executescript(
            SEED_FILE.read_text(encoding="utf-8")
        )

    finally:
        conn.close()


def init_db():
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Schema not found: {SCHEMA_FILE}")

    if not SEED_FILE.exists():
        raise FileNotFoundError(f"Seed file not found: {SEED_FILE}")

    conn = get_connection()

    try:
        conn.executescript(
            SCHEMA_FILE.read_text(encoding="utf-8")
        )

        conn.executescript(
            SEED_FILE.read_text(encoding="utf-8")
        )

        print("Database schema and seed data initialized!")

    finally:
        conn.close()

def populate_db():
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Schema not found: {SCHEMA_FILE}")

    if not SEED_FILE.exists():
        raise FileNotFoundError(f"Seed file not found: {SEED_FILE}")

    if not _database_has_data():
        print("Database is empty. Initializing...")
        _build_database()
        print("Database successfully initialized!")
        return

    print("\nDatabase already contains records.")
    confirmation = input(
        "Do you want to back up and rebuild the database? (yes/no): "
    ).strip().lower()

    if confirmation not in ("yes", "y"):
        print("Operation cancelled. Existing database preserved.")
        return

    backup_file = DB_FILE.with_name(
        f"iot_backup_{datetime.now():%Y%m%d_%H%M%S}.db"
    )

    shutil.copy2(DB_FILE, backup_file)
    print(f"Backup created: {backup_file}")

    DB_FILE.unlink()

    _build_database()

    print("Database successfully rebuilt!")

def _identifier(value):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"Invalid SQL identifier: {value}")
    return value

def fetch_all(table, order_by=None):
    table = _identifier(table)
    query = f"SELECT * FROM {table}"

    if order_by:
        query += f" ORDER BY {_identifier(order_by)}"

    with db_connection() as conn:
        return [dict(row) for row in conn.execute(query).fetchall()]

def fetch_by_id(table, primary_key, record_id):
    table = _identifier(table)
    primary_key = _identifier(primary_key)

    with db_connection() as conn:
        row = conn.execute(
            f"SELECT * FROM {table} WHERE {primary_key} = ?",
            (record_id,)
        ).fetchone()

        return dict(row) if row else None

def insert_record(table, values):
    table = _identifier(table)

    if not values:
        raise ValueError("No values provided")

    columns = [_identifier(column) for column in values]
    placeholders = ", ".join("?" for _ in columns)
    column_names = ", ".join(columns)

    with db_connection() as conn:
        cursor = conn.execute(
            f"INSERT INTO {table} ({column_names}) VALUES ({placeholders})",
            tuple(values[column] for column in values)
        )
        return cursor.lastrowid

def update_record(table, primary_key, record_id, values):
    table = _identifier(table)
    primary_key = _identifier(primary_key)

    if not values:
        return False

    columns = [_identifier(column) for column in values]
    assignments = ", ".join(f"{column} = ?" for column in columns)

    with db_connection() as conn:
        cursor = conn.execute(
            f"UPDATE {table} SET {assignments} WHERE {primary_key} = ?",
            (*values.values(), record_id)
        )
        return cursor.rowcount > 0

def delete_record(table, primary_key, record_id):
    table = _identifier(table)
    primary_key = _identifier(primary_key)

    with db_connection() as conn:
        cursor = conn.execute(
            f"DELETE FROM {table} WHERE {primary_key} = ?",
            (record_id,)
        )
        return cursor.rowcount > 0

    with db_connection() as conn:
        cursor = conn.execute(
            f"DELETE FROM {table} WHERE {primary_key} = ?",
            (record_id,)
        )
        return cursor.rowcount > 0