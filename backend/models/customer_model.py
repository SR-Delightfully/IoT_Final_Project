import sqlite3
import hashlib
import os
from typing import Optional
from pathlib import Path
import datetime

# customer_model.py -> models -> backend -> IoT_Final_Project
BASE_DIR = Path(__file__).resolve().parents[2]
DB_FILE = BASE_DIR / "Database" / "iot.db"



def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    DB_FILE.parent.mkdir(exist_ok=True)
    schema = (BASE_DIR / "Database" / "readable.sql").read_text(encoding="utf-8")
    with get_connection() as conn:
        conn.executescript(schema)

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return salt.hex() + ":" + hashed.hex()

def add_customer(first_name, last_name, address, phone, email, password):
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO customers (first_name, last_name, address, phone, email, password_hash) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (first_name, last_name, address, phone, email, hash_password(password)),
        )