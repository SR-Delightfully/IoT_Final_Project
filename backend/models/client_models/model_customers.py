import hashlib
import os
from models.database import db_connection, fetch_all, fetch_by_id, update_record, delete_record

TABLE = "Customers"
PRIMARY_KEY = "customer_id"

def hash_password(password):
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100000
    )
    return f"{salt.hex()}:{hashed.hex()}"

def add_customer(first_name, last_name, address, phone, email, password, customer_code=None, is_member=False):
    if not isinstance(is_member, (bool, int)) or is_member not in (0, 1):
        raise ValueError("Invalid membership status")

    password_hash = hash_password(password)

    with db_connection() as conn:
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
                password_hash
            )
        )

        user_id = cursor.lastrowid

        cursor = conn.execute(
            """
            INSERT INTO Customers (
                user_id,
                customer_code,
                customer_address,
                customer_phone,
                customer_is_member,
                customer_membership_date
            )
            VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
            """,
            (
                user_id,
                customer_code,
                address.strip() if address else None,
                phone.strip() if phone else None,
                int(is_member),
                int(is_member)
            )
        )

        return cursor.lastrowid

def get_customer(customer_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT c.*, u.user_role, u.user_fname, u.user_lname,
                   u.user_email, u.user_is_verified, u.user_created_at
            FROM Customers c
            JOIN Users u ON c.user_id = u.user_id
            WHERE c.customer_id = ?
            """,
            (customer_id,)
        ).fetchone()

        return dict(row) if row else None

def get_customer_by_email(email):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT c.*, u.user_role, u.user_fname, u.user_lname,
                   u.user_email, u.user_password_hash,
                   u.user_is_verified, u.user_created_at
            FROM Customers c
            JOIN Users u ON c.user_id = u.user_id
            WHERE u.user_email = ?
            """,
            (email.strip().lower(),)
        ).fetchone()

        return dict(row) if row else None

def get_all_customers():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT c.*, u.user_fname, u.user_lname, u.user_email,
                   u.user_is_verified, u.user_created_at
            FROM Customers c
            JOIN Users u ON c.user_id = u.user_id
            ORDER BY c.customer_id
            """
        ).fetchall()

        return [dict(row) for row in rows]

def update_customer(customer_id, values):
    customer_fields = {
        "customer_code",
        "customer_address",
        "customer_phone"
    }

    user_fields = {
        "user_fname",
        "user_lname",
        "user_email",
        "user_is_verified"
    }

    customer_values = {
        key: value for key, value in values.items()
        if key in customer_fields
    }

    user_values = {
        key: value for key, value in values.items()
        if key in user_fields
    }

    membership_value = values.get("customer_is_member")

    if "customer_is_member" in values:
        if not isinstance(membership_value, (bool, int)) or membership_value not in (0, 1):
            raise ValueError("Invalid membership status")

    with db_connection() as conn:
        customer = conn.execute(
            "SELECT user_id FROM Customers WHERE customer_id = ?",
            (customer_id,)
        ).fetchone()

        if not customer:
            return False

        if customer_values:
            columns = ", ".join(f"{key} = ?" for key in customer_values)
            conn.execute(
                f"UPDATE Customers SET {columns} WHERE customer_id = ?",
                (*customer_values.values(), customer_id)
            )

        if "customer_is_member" in values:
            conn.execute(
                """
                UPDATE Customers
                SET customer_is_member = ?,
                    customer_membership_date = CASE
                        WHEN ? = 1 THEN COALESCE(customer_membership_date, CURRENT_TIMESTAMP)
                        ELSE NULL
                    END
                WHERE customer_id = ?
                """,
                (int(membership_value), int(membership_value), customer_id)
            )

        if user_values:
            if "user_email" in user_values:
                user_values["user_email"] = user_values["user_email"].strip().lower()

            columns = ", ".join(f"{key} = ?" for key in user_values)
            conn.execute(
                f"UPDATE Users SET {columns} WHERE user_id = ?",
                (*user_values.values(), customer["user_id"])
            )

        return True

def delete_customer(customer_id):
    with db_connection() as conn:
        customer = conn.execute(
            "SELECT user_id FROM Customers WHERE customer_id = ?",
            (customer_id,)
        ).fetchone()

        if not customer:
            return False

        conn.execute(
            "DELETE FROM Customers WHERE customer_id = ?",
            (customer_id,)
        )

        conn.execute(
            "DELETE FROM Users WHERE user_id = ?",
            (customer["user_id"],)
        )

        return True