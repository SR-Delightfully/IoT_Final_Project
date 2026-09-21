import sqlite3
from typing import Optional
from pathlib import Path
import datetime

# customer_model.py -> models -> backend -> IoT_Final_Project
BASE_DIR = Path(__file__).resolve().parents[2]
DB_FILE = BASE_DIR / "Database" / "Iot_Database.sql"

class Customer:
    id: int
    first_name: str
    last_name: str
    address: str
    phone: Optional[str]
    email: str
    created_at: datetime

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection as conn:
        conn()