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