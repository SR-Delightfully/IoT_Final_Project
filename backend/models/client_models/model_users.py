import hashlib
import hmac
from models.database import fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Users"
PRIMARY_KEY = "user_id"

def get_all_users():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_user(user_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, user_id)

def add_user(user_role, first_name, last_name, email, password_hash, is_verified=0):
    return insert_record(TABLE, {
        "user_role": user_role,
        "user_fname": first_name,
        "user_lname": last_name,
        "user_email": email.strip().lower(),
        "user_password_hash": password_hash,
        "user_is_verified": is_verified
    })

def get_user_by_email(email):
    from models.database import db_connection

    with db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM Users WHERE user_email = ?",
            (email.strip().lower(),)
        ).fetchone()
        return dict(row) if row else None

def update_user(user_id, values):
    return update_record(TABLE, PRIMARY_KEY, user_id, values)

def delete_user(user_id):
    return delete_record(TABLE, PRIMARY_KEY, user_id)
# Check if the entered password matches the password hash stored in the database.
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
# Check login details and return user information if they are correct.
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