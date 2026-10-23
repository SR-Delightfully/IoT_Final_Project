import paho.mqtt.client as mqtt
from imapclient import IMAPClient
import RPi.GPIO as GPIO
from email.message import EmailMessage
from email.header import decode_header
from email.utils import parseaddr
from contextlib import contextmanager
import smtplib
import email
import sqlite3
import subprocess
import threading
import os
import re
import time

# ---------------- Config ----------------
me = 'example@gmail.com'             # Gmail address that sends alerts and receives replies
app_password = ''   # Gmail app password (works for SMTP and IMAP)
 
BROKER = "10.108.22.132"
# Motor driver pins (BCM numbers) - same wiring as the motor lab
Motor1 = 22  # Enable pin
Motor2 = 27  # Input pin
Motor3 = 17  # Input pin
POLL_SECONDS = 10   # how often to check the inbox while an alert is waiting

FRIDGES = [
    {
        "fridge_id": 1,
        "fridge_name": "Fridge 1",
        "fridge_location": "Kitchen",
        "fridge_min_temperature": 1.0,
        "fridge_max_temperature": 20.0,
        "fridge_min_humidity": 30.0,
        "fridge_max_humidity": 70.0,
    },
    {
        "fridge_id": 2,
        "fridge_name": "Fridge 2",
        "fridge_location": "Storage room",
        "fridge_min_temperature": 1.0,
        "fridge_max_temperature": 20.0,
        "fridge_min_humidity": 30.0,
        "fridge_max_humidity": 70.0,
    },
]

# Who gets the alert emails (hardcoded). Only replies from these addresses count.
# If an address also exists in Users.user_email, the alert is logged in
# Notifications for that user and their reply fills alert_acknowledged_by.
ALERT_EMAILS = [
    'example@gmail.com',
]
 
# ESP32s publish to fridge/<fridge_id>/temperature and fridge/<fridge_id>/humidity
TOPIC_RE = re.compile(r"^fridge/(\d+)/(temperature|humidity)$")
ALERT_ID_RE = re.compile(r"Fridge alert #(\d+)")
YES_RE = re.compile(r"\bYES\b", re.IGNORECASE)
 
motor_running = False
 
latest_humidity = {}  # fridge_id -> last humidity value received
last_uid = 0          # highest inbox UID already looked at
 
 
# ---------------- Database ----------------
@contextmanager
def db():
    # mode=rw: open the existing database only - never create a new empty one
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found: {os.path.abspath(DB_PATH)}")
    conn = sqlite3.connect(f"file:{os.path.abspath(DB_PATH)}?mode=rw", uri=True, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
 
 
def setup_db():
    """Adds the fan status column to Fridges if it isn't there yet."""
    with db() as conn:
        cols = [row["name"] for row in conn.execute("PRAGMA table_info(Fridges)")]
        if not cols:
            raise RuntimeError(f"No Fridges table in {DB_PATH} - run your schema first.")
        if "fridge_fan_on" not in cols:
            conn.execute("ALTER TABLE Fridges ADD COLUMN fridge_fan_on INTEGER NOT NULL DEFAULT 0")
            print("Added fridge_fan_on column to Fridges")
        add_missing_fridges(conn)
        forget_old_alerts(conn)
        # Start with every fan OFF - the motor only runs after a new YES
        conn.execute("UPDATE Fridges SET fridge_fan_on = 0")
        print("Restart: all fans set to OFF")


def forget_old_alerts(conn):
    """On restart, close every open alert so the next high reading sends a new email.
    Unanswered ones are marked 'expired', so a late reply to an old email is ignored."""
    closed = conn.execute(
        """UPDATE Alerts
           SET alert_resolved_at = CURRENT_TIMESTAMP,
               alert_status = CASE WHEN alert_acknowledged_at IS NULL
                                   THEN 'expired' ELSE alert_status END
           WHERE alert_resolved_at IS NULL
              OR (alert_acknowledged_at IS NULL AND alert_status IN ('unacknowledged', 'resolved'))"""
    ).rowcount
    if closed:
        print(f"Restart: cleared {closed} old alert(s) - next reading above max sends a new email")

def add_missing_fridges(conn):
    """Inserts each fridge in FRIDGES whose fridge_id isn't in the table yet.
    Fridges that already exist get their max temperature set from FRIDGES."""
    for f in FRIDGES:
        exists = conn.execute(
            "SELECT 1 FROM Fridges WHERE fridge_id = ?", (f["fridge_id"],)
        ).fetchone()
        if exists:
            conn.execute(
                "UPDATE Fridges SET fridge_max_temperature = ? WHERE fridge_id = ?",
                (f["fridge_max_temperature"], f["fridge_id"]),
            )
            print(f"Fridge {f['fridge_id']} max temperature set to {f['fridge_max_temperature']}°C")
            continue
        conn.execute(
            """INSERT INTO Fridges (fridge_id, fridge_name, fridge_location,
                                    fridge_max_humidity, fridge_min_humidity,
                                    fridge_max_temperature, fridge_min_temperature)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (f["fridge_id"], f["fridge_name"], f["fridge_location"],
             f["fridge_max_humidity"], f["fridge_min_humidity"],
             f["fridge_max_temperature"], f["fridge_min_temperature"]),
        )
        print(f"Added {f['fridge_name']} (id {f['fridge_id']}) to Fridges")
 
def find_user_id(conn, email_addr):
    """Returns the Users.user_id for an email, or None if it isn't a registered user."""
    row = conn.execute(
        "SELECT user_id FROM Users WHERE lower(user_email) = lower(?)", (email_addr,)
    ).fetchone()
    return row["user_id"] if row else None


def get_recipients(conn):
    """Hardcoded ALERT_EMAILS, each paired with its user_id (or None)."""
    return [{"user_email": addr, "user_id": find_user_id(conn, addr)} for addr in ALERT_EMAILS]
 
 
# ---------------- MQTT: readings + threshold check ----------------
def on_connect(client, userdata, flags, reason_code, properties):
    print("MQTT connected:", reason_code)
    client.subscribe("fridge/+/temperature")
    client.subscribe("fridge/+/humidity")
 
 
def on_message(client, userdata, msg):
    try:
        match = TOPIC_RE.match(msg.topic)
        if not match:
            return
        fridge_id, kind = int(match.group(1)), match.group(2)
 
        try:
            value = float(msg.payload.decode())
        except ValueError:
            print(f"Bad payload on {msg.topic}: {msg.payload}")
            return
 
        if kind == "humidity":
            latest_humidity[fridge_id] = value
            return
 
        # FridgeReadings needs both values, so wait until humidity has arrived once
        if fridge_id not in latest_humidity:
            print(f"Fridge {fridge_id}: waiting for a humidity reading first")
            return
 
        handle_temperature(fridge_id, value, latest_humidity[fridge_id])
    except Exception as e:
        print(f"Error handling {msg.topic}: {e}")
 
 
def handle_temperature(fridge_id, temp, humidity):
    new_alert = None
 
    with db() as conn:
        fridge = conn.execute("SELECT * FROM Fridges WHERE fridge_id = ?", (fridge_id,)).fetchone()
        if fridge is None:
            print(f"Fridge {fridge_id} isn't in the Fridges table - ignoring")
            return
 
        reading_id = conn.execute(
            "INSERT INTO FridgeReadings (fridge_id, reading_humidity, reading_temperature) VALUES (?, ?, ?)",
            (fridge_id, humidity, temp),
        ).lastrowid
        print(f"{fridge['fridge_name']}: {temp}°C, {humidity}% (max {fridge['fridge_max_temperature']}°C)")
 
        open_alert = conn.execute(
            """SELECT alert_id, alert_acknowledged_at FROM Alerts
               WHERE fridge_id = ? AND alert_type = 'temperature' AND alert_resolved_at IS NULL""",
            (fridge_id,),
        ).fetchone()
 
        if temp > fridge["fridge_max_temperature"]:
            if open_alert:
                if open_alert["alert_acknowledged_at"] is None:  # only until a reply is read
                    print(f"  -> still above max, alert #{open_alert['alert_id']} already sent - waiting for a reply")
                return  # already alerted for this hot spell
            message = f"The current temperature is {temp}°C. Would you like to turn on the fan?"
            alert_id = conn.execute(
                """INSERT INTO Alerts (fridge_id, reading_id, alert_type, alert_condition, alert_value, alert_message)
                   VALUES (?, ?, 'temperature', 'above_max', ?, ?)""",
                (fridge_id, reading_id, temp, message),
            ).lastrowid
            new_alert = (alert_id, fridge, temp, message, get_recipients(conn))
 
        elif open_alert:
            # Back under the limit: close the alert so a future spike alerts again.
            # alert_status is left alone, so a YES that arrives later still works.
            conn.execute(
                "UPDATE Alerts SET alert_resolved_at = CURRENT_TIMESTAMP WHERE alert_id = ?",
                (open_alert["alert_id"],),
            )
            print(f"{fridge['fridge_name']}: back under the limit, alert #{open_alert['alert_id']} resolved")

        # Cooled down: turn this fridge's fan off
        if temp <= fridge["fridge_max_temperature"] and fridge["fridge_fan_on"]:
            conn.execute("UPDATE Fridges SET fridge_fan_on = 0 WHERE fridge_id = ?", (fridge_id,))
            print(f"{fridge['fridge_name']}: back under {fridge['fridge_max_temperature']}°C - fan OFF")
 
    if new_alert:
        send_alert(*new_alert)
 
 
# ---------------- Email + system notification ----------------
def send_alert(alert_id, fridge, temp, message, recipients):
    subject = f"Fridge alert #{alert_id} - {fridge['fridge_name']}"
    sent = set()  # email addresses that were sent successfully

    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as s:
            s.starttls()
            s.login(me, app_password)
            for r in recipients:
                msg = EmailMessage()
                msg.set_content(message)
                msg['Subject'] = subject
                msg['From'] = me
                msg['To'] = r["user_email"]
                try:
                    s.send_message(msg)
                    sent.add(r["user_email"])
                    print(f"Email sent to {r['user_email']}")
                except Exception as e:
                    print(f"Couldn't email {r['user_email']}: {e}")
    except Exception as e:
        print(f"Couldn't connect to Gmail SMTP: {e}")

    # Notifications.user_id must point at a real user, so only log registered users
    with db() as conn:
        for r in recipients:
            if r["user_id"] is None:
                print(f"{r['user_email']} isn't in Users - email only, no Notifications row")
                continue
            if r["user_email"] in sent:
                conn.execute(
                    """INSERT INTO Notifications (alert_id, user_id, notification_type, notification_status, notification_sent_at)
                       VALUES (?, ?, 'email', 'sent', CURRENT_TIMESTAMP)""",
                    (alert_id, r["user_id"]),
                )
            else:
                conn.execute(
                    """INSERT INTO Notifications (alert_id, user_id, notification_type, notification_status)
                       VALUES (?, ?, 'email', 'failed')""",
                    (alert_id, r["user_id"]),
                )

    print(f"Alert #{alert_id} emailed to {len(sent)}/{len(recipients)} address(es)")
    show_system_notification(
        f"Fridge alert: {fridge['fridge_name']}",
        f"Current temperature {temp}°C (max {fridge['fridge_max_temperature']}°C). "
        f"Email sent to {len(sent)} address(es).",
    )
 
 
def show_system_notification(title, body):
    try:
        subprocess.run(["notify-send", "-u", "critical", title, body], check=True, timeout=5)
    except Exception as e:
        print(f"[NOTIFICATION] {title} - {body}  (notify-send failed: {e})")
 
 
# ---------------- Inbox: YES replies ----------------
def read_email(server, uid):
    raw = server.fetch([uid], ['RFC822'])[uid][b'RFC822']
    msg = email.message_from_bytes(raw)
 
    subject, encoding = decode_header(msg['Subject'] or '')[0]
    if isinstance(subject, bytes):
        subject = subject.decode(encoding or 'utf-8', errors='ignore')
 
    from_addr = parseaddr(msg.get('From') or '')[1]
    body = ''
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain' and 'attachment' not in str(part.get('Content-Disposition')):
                body = part.get_payload(decode=True).decode(errors='ignore')
                break
    else:
        body = msg.get_payload(decode=True).decode(errors='ignore')
 
    # Keep only what the person typed, not the quoted original
    lines = []
    for line in body.splitlines():
        if line.startswith(">") or (line.startswith("On ") and "wrote" in line):
            break
        lines.append(line)
    return from_addr, subject, "\n".join(lines).strip()
 
 
def handle_reply(from_addr, subject, body):
    if not re.match(r"^\s*re\s*:", subject, re.IGNORECASE):
        print("  -> not a reply, skipping")
        return  # not a reply (e.g. the alert itself)
    match = ALERT_ID_RE.search(subject)
    if not match:
        print("  -> no 'Fridge alert #' in the subject, skipping")
        return
    alert_id = int(match.group(1))
 
    # Only the hardcoded recipients can answer
    if from_addr.lower() not in [a.lower() for a in ALERT_EMAILS]:
        print(f"Reply from {from_addr} isn't in ALERT_EMAILS - ignoring")
        return

    with db() as conn:
        user_id = find_user_id(conn, from_addr)  # None if not a registered user
        alert = conn.execute("SELECT * FROM Alerts WHERE alert_id = ?", (alert_id,)).fetchone()
        if alert is None:
            print(f"Alert #{alert_id} doesn't exist - ignoring reply")
            return
        # 'resolved' is accepted too, for alerts closed by older versions of this file
        if alert["alert_status"] not in ("unacknowledged", "resolved"):
            print(f"Alert #{alert_id} already handled ({alert['alert_status']}) - ignoring reply")
            return
 
        said_yes = bool(YES_RE.search(body))
        conn.execute(
            """UPDATE Alerts SET alert_status = ?, alert_acknowledged_at = CURRENT_TIMESTAMP,
                                 alert_acknowledged_by = ?
               WHERE alert_id = ?""",
            ("acknowledged" if said_yes else "declined", user_id, alert_id),
        )
        if user_id is not None:
            conn.execute(
                """UPDATE Notifications SET notification_read_at = CURRENT_TIMESTAMP
                   WHERE alert_id = ? AND user_id = ?""",
                (alert_id, user_id),
            )
        if said_yes:
            conn.execute("UPDATE Fridges SET fridge_fan_on = 1 WHERE fridge_id = ?", (alert["fridge_id"],))
 
    if said_yes:
        print(f"YES from {from_addr} for alert #{alert_id} - fan ON")
    else:
        print(f"No YES from {from_addr} for alert #{alert_id} - no action")
 
 
def init_inbox():
    global last_uid
    with IMAPClient('imap.gmail.com') as server:
        server.login(me, app_password)
        server.select_folder('INBOX', readonly=True)
        uids = server.search('ALL')
        last_uid = max(uids) if uids else 0
 
 
def check_inbox():
    global last_uid
    with db() as conn:
        # Any alert nobody has answered yet (even if the fridge already cooled down)
        waiting = conn.execute(
            "SELECT COUNT(*) FROM Alerts WHERE alert_acknowledged_at IS NULL AND alert_status != 'expired'"
        ).fetchone()[0]
    if not waiting:
        return

    with IMAPClient('imap.gmail.com') as server:
        server.login(me, app_password)
        server.select_folder('INBOX', readonly=True)  # readonly: don't mark emails as read
        uids = [u for u in server.search(['UID', f'{last_uid + 1}:*']) if u > last_uid]
        for uid in sorted(uids):
            from_addr, subject, body = read_email(server, uid)
            print(f"Email from {from_addr} | subject: {subject!r} | body: {body[:60]!r}")
            handle_reply(from_addr, subject, body)
        if uids:
            last_uid = max(uids)
 
 
# ---------------- Motor follows the database ----------------
# Same physical pins in BOARD numbering (used if other code switched GPIO to BOARD mode)
BCM_TO_BOARD = {22: 15, 27: 13, 17: 11}


def setup_motor_pins():
    """Sets up the motor pins and returns (enable, input, input) in whatever
    numbering mode GPIO is currently in. Done before every write, because other
    code (e.g. breadboardCode) can reset the pins or change the mode."""
    GPIO.setwarnings(False)
    mode = GPIO.getmode()
    if mode is None:
        GPIO.setmode(GPIO.BCM)
        mode = GPIO.BCM
    if mode == GPIO.BOARD:
        pins = [BCM_TO_BOARD[p] for p in (Motor1, Motor2, Motor3)]
    else:
        pins = [Motor1, Motor2, Motor3]
    for p in pins:
        GPIO.setup(p, GPIO.OUT)
    return pins


def motor_on():
    # Same as the first step of the motor lab: enable HIGH, spin one direction
    en, in1, in2 = setup_motor_pins()
    GPIO.output(en, GPIO.HIGH)
    GPIO.output(in1, GPIO.LOW)
    GPIO.output(in2, GPIO.HIGH)
    return [en, in1, in2]


def motor_off():
    en, in1, in2 = setup_motor_pins()
    GPIO.output(en, GPIO.LOW)
    GPIO.output(in1, GPIO.LOW)
    GPIO.output(in2, GPIO.LOW)
    return [en, in1, in2]


def sync_motor():
    global motor_running
    with db() as conn:
        fan_on = conn.execute("SELECT COUNT(*) FROM Fridges WHERE fridge_fan_on = 1").fetchone()[0] > 0
    # Re-apply the pins every loop so the motor recovers if other code reset them
    pins = motor_on() if fan_on else motor_off()
    if fan_on != motor_running:
        motor_running = fan_on
        mode = "BOARD" if GPIO.getmode() == GPIO.BOARD else "BCM"
        levels = ", ".join(f"{p}={GPIO.input(p)}" for p in pins)
        print(f"Motor {'ON' if fan_on else 'OFF'} ({mode} mode, pins {levels})")
 
 
# ---------------- Run loop ----------------
_stop_event = threading.Event()
_thread = None


def run(stop_event):
    """The whole monitor. Runs until stop_event is set."""
    client = None
    try:
        print(f"Fridge monitor using database: {os.path.abspath(DB_PATH)}")
        setup_db()
        try:
            init_inbox()
        except Exception as e:
            print(f"Couldn't log in to Gmail IMAP ({e}) - will retry on each inbox check")

        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect_async(BROKER, 1883)  # doesn't block; keeps retrying if the broker is down
        client.loop_start()                 # MQTT runs in its own background thread
        print("Fridge monitor running...")

        last_check = 0
        while not stop_event.is_set():
            try:
                sync_motor()
            except Exception as e:
                print(f"Motor error: {e}")  # keep monitoring even if GPIO fails once
            if time.time() - last_check >= POLL_SECONDS:
                last_check = time.time()
                try:
                    check_inbox()
                except Exception as e:
                    print(f"Inbox check failed: {e}")
            stop_event.wait(1)
    except Exception as e:
        print(f"Fridge monitor crashed: {e}")
    finally:
        if client:
            client.loop_stop()
            client.disconnect()
        try:
            GPIO.cleanup(motor_off())  # only our pins, so other GPIO code isn't reset
        except Exception as e:
            print(f"GPIO cleanup error: {e}")
        print("Fridge monitor stopped")


def start(db_path=None):
    """Starts the monitor in a background thread (call this from the backend).
    db_path = the database file the server uses."""
    global _thread, DB_PATH
    if _thread and _thread.is_alive():
        return _thread
    if db_path:
        DB_PATH = str(db_path)
    _stop_event.clear()
    _thread = threading.Thread(target=run, args=(_stop_event,), name="fridge-monitor", daemon=True)
    _thread.start()
    return _thread


def stop(timeout=5):
    """Stops the monitor and turns the motor off."""
    _stop_event.set()
    if _thread:
        _thread.join(timeout)


# Running this file by itself still works: python mqttProj.py
if __name__ == '__main__':
    start()
    try:
        while _thread.is_alive():
            _thread.join(1)
    except KeyboardInterrupt:
        print("Stopping...")
        stop()