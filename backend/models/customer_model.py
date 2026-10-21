
import sqlite3
import hashlib
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DB_FILE = BASE_DIR / "Database" / "iot.db"
SCHEMA_FILE = BASE_DIR / "Database" / "readable.sql"


def get_connection():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Database schema not found: {SCHEMA_FILE}")

    schema = SCHEMA_FILE.read_text(encoding="utf-8")

    with get_connection() as conn:
        conn.executescript(schema)


def hash_password(password):
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100000
    )
    return f"{salt.hex()}:{hashed.hex()}"


def add_customer(
    first_name,
    last_name,
    address,
    phone,
    email,
    password,
    customer_code=None
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Users (
                user_role,
                user_fname,
                user_lname,
                user_email,
                user_password_hash
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                "customer",
                first_name.strip(),
                last_name.strip(),
                email.strip().lower(),
                hash_password(password)
            )
        )

        customer_id = cursor.lastrowid

        conn.execute(
            """
            INSERT INTO Customers (
                customer_id,
                customer_code,
                customer_address,
                customer_phone
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                customer_id,
                customer_code,
                address.strip(),
                phone.strip() if phone else None
            )
        )

        return customer_id


def get_customer(customer_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT
                u.user_id,
                u.user_role,
                u.user_fname,
                u.user_lname,
                u.user_email,
                u.user_created_at,
                c.customer_code,
                c.customer_address,
                c.customer_phone
            FROM Users u
            JOIN Customers c ON c.customer_id = u.user_id
            WHERE c.customer_id = ?
            """,
            (customer_id,)
        ).fetchone()


def get_customer_by_email(email):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT
                u.user_id,
                u.user_role,
                u.user_fname,
                u.user_lname,
                u.user_email,
                u.user_created_at,
                c.customer_code,
                c.customer_address,
                c.customer_phone
            FROM Users u
            JOIN Customers c ON c.customer_id = u.user_id
            WHERE u.user_email = ?
            """,
            (email.strip().lower(),)
        ).fetchone()


def get_all_customers():
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT
                u.user_id,
                u.user_role,
                u.user_fname,
                u.user_lname,
                u.user_email,
                u.user_created_at,
                c.customer_code,
                c.customer_address,
                c.customer_phone
            FROM Users u
            JOIN Customers c ON c.customer_id = u.user_id
            ORDER BY u.user_id
            """
        ).fetchall()


def update_customer(
    customer_id,
    address=None,
    phone=None,
    customer_code=None
):
    with get_connection() as conn:
        customer = conn.execute(
            "SELECT * FROM Customers WHERE customer_id = ?",
            (customer_id,)
        ).fetchone()

        if customer is None:
            return False

        conn.execute(
            """
            UPDATE Customers
            SET customer_address = ?,
                customer_phone = ?,
                customer_code = ?
            WHERE customer_id = ?
            """,
            (
                address if address is not None else customer["customer_address"],
                phone if phone is not None else customer["customer_phone"],
                customer_code if customer_code is not None else customer["customer_code"],
                customer_id
            )
        )

        return True


def delete_customer(customer_id):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            DELETE FROM Users
            WHERE user_id = ?
              AND user_role = 'customer'
              AND EXISTS (
                  SELECT 1
                  FROM Customers
                  WHERE Customers.customer_id = Users.user_id
              )
            """,
            (customer_id,)
        )
        return cursor.rowcount > 0
