
import hashlib
import hmac
import os

from models.customer_model import get_connection, hash_password


def verify_password(password, password_hash):
    try:
        salt_hex, hash_hex = password_hash.split(":")
        salt = bytes.fromhex(salt_hex)

        hashed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            100000
        )

        return hmac.compare_digest(hashed.hex(), hash_hex)

    except (ValueError, AttributeError):
        return False


def add_user(first_name, last_name, email, password, role="customer"):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO Users (
                user_fname,
                user_lname,
                user_email,
                user_password_hash,
                user_role
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                first_name.strip(),
                last_name.strip(),
                email.strip().lower(),
                hash_password(password),
                role
            )
        )
        return cursor.lastrowid


def get_user(user_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT
                user_id,
                user_role,
                user_fname,
                user_lname,
                user_email,
                user_created_at
            FROM Users
            WHERE user_id = ?
            """,
            (user_id,)
        ).fetchone()


def get_user_by_email(email):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT
                user_id,
                user_role,
                user_fname,
                user_lname,
                user_email,
                user_password_hash,
                user_created_at
            FROM Users
            WHERE user_email = ?
            """,
            (email.strip().lower(),)
        ).fetchone()


def authenticate_user(email, password):
    user = get_user_by_email(email)

    if user and verify_password(password, user["user_password_hash"]):
        return {
            "user_id": user["user_id"],
            "user_role": user["user_role"],
            "user_fname": user["user_fname"],
            "user_lname": user["user_lname"],
            "user_email": user["user_email"]
        }

    return None


def get_all_users():
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT
                user_id,
                user_role,
                user_fname,
                user_lname,
                user_email,
                user_created_at
            FROM Users
            ORDER BY user_id
            """
        ).fetchall()


def update_user_role(user_id, role):
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE Users SET user_role = ? WHERE user_id = ?",
            (role, user_id)
        )
        return cursor.rowcount > 0


def delete_user(user_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM Users WHERE user_id = ?",
            (user_id,)
        )
        return cursor.rowcount > 0
