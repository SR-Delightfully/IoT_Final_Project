import paho.mqtt.client as mqtt
from imapclient import IMAPClient
import RPi.GPIO as GPIO
from email.message import EmailMessage
from email.header import decode_header
from email.utils import parseaddr
from contextlib import contextmanager
from itertools import takewhile
import smtplib
import email
import sqlite3
import subprocess
import threading
import os
import re
import time

me = 'example@gmail.com'
app_password = ''

BROKER = "10.108.22.132"
MOTOR_PINS = (22, 27, 17)
BCM_TO_BOARD = {22: 15, 27: 13, 17: 11}
POLL_SECONDS = 10

LIMITS = {
    "fridge_min_temperature": 1.0,
    "fridge_max_temperature": 20.0,
    "fridge_min_humidity": 30.0,
    "fridge_max_humidity": 70.0,
}
FRIDGES = [
    {"fridge_id": 1, "fridge_name": "Fridge 1", "fridge_location": "Kitchen", **LIMITS},
    {"fridge_id": 2, "fridge_name": "Fridge 2", "fridge_location": "Storage room", **LIMITS},
]

ALERT_EMAILS = [
    'example@gmail.com',
]
ALERT_SET = {a.lower() for a in ALERT_EMAILS}

TOPIC_RE = re.compile(r"^fridge/(\d+)/(temperature|humidity)$")
ALERT_ID_RE = re.compile(r"Fridge alert #(\d+)")
REPLY_RE = re.compile(r"^\s*re\s*:", re.IGNORECASE)
YES_RE = re.compile(r"\bYES\b", re.IGNORECASE)

DB_PATH = None
motor_running = False
pending = {}
last_uid = 0


@contextmanager
def db():
    path = os.path.abspath(DB_PATH)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Database not found: {path}")
    conn = sqlite3.connect(f"file:{path}?mode=rw", uri=True, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def setup_db():
    with db() as conn:
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(Fridges)")}
        if not cols:
            raise RuntimeError(f"No Fridges table in {DB_PATH} - run your schema first.")
        if "fridge_fan_on" not in cols:
            conn.execute("ALTER TABLE Fridges ADD COLUMN fridge_fan_on INTEGER NOT NULL DEFAULT 0")
            print("Added fridge_fan_on column to Fridges")

        for f in FRIDGES:
            updated = conn.execute(
                "UPDATE Fridges SET fridge_max_temperature = ? WHERE fridge_id = ?",
                (f["fridge_max_temperature"], f["fridge_id"]),
            ).rowcount
            if updated:
                print(f"Fridge {f['fridge_id']} max temperature set to {f['fridge_max_temperature']}°C")
            else:
                conn.execute(
                    f"INSERT INTO Fridges ({', '.join(f)}) VALUES ({', '.join('?' * len(f))})",
                    tuple(f.values()),
                )
                print(f"Added {f['fridge_name']} (id {f['fridge_id']}) to Fridges")

        closed = conn.execute(
            """UPDATE Alerts
               SET alert_resolved_at = COALESCE(alert_resolved_at, CURRENT_TIMESTAMP),
                   alert_status = CASE WHEN alert_acknowledged_at IS NULL
                                       THEN 'expired' ELSE alert_status END
               WHERE alert_resolved_at IS NULL
                  OR (alert_acknowledged_at IS NULL AND alert_status != 'expired')"""
        ).rowcount
        if closed:
            print(f"Restart: cleared {closed} old alert(s) - next reading above max sends a new email")

        conn.execute("UPDATE Fridges SET fridge_fan_on = 0")
        print("Restart: all fans set to OFF")


def find_user_id(conn, email_addr):
    row = conn.execute(
        "SELECT user_id FROM Users WHERE lower(user_email) = lower(?)", (email_addr,)
    ).fetchone()
    return row["user_id"] if row else None


def on_connect(client, userdata, flags, reason_code, properties):
    print("MQTT connected:", reason_code)
    client.subscribe("fridge/+/+")


def on_message(client, userdata, msg):
    match = TOPIC_RE.match(msg.topic)
    if not match:
        return
    fridge_id, kind = int(match[1]), match[2]
    try:
        value = float(msg.payload.decode())
    except ValueError:
        print(f"Bad payload on {msg.topic}: {msg.payload}")
        return

    reading = pending.setdefault(fridge_id, {})
    reading[kind] = value
    if len(reading) < 2:
        return
    del pending[fridge_id]
    try:
        handle_reading(fridge_id, reading["temperature"], reading["humidity"])
    except Exception as e:
        print(f"Error handling fridge {fridge_id}: {e}")


def handle_reading(fridge_id, temp, humidity):
    new_alert = None

    with db() as conn:
        fridge = conn.execute("SELECT * FROM Fridges WHERE fridge_id = ?", (fridge_id,)).fetchone()
        if fridge is None:
            print(f"Fridge {fridge_id} isn't in the Fridges table - ignoring")
            return
        name, max_temp = fridge["fridge_name"], fridge["fridge_max_temperature"]

        reading_id = conn.execute(
            "INSERT INTO FridgeReadings (fridge_id, reading_humidity, reading_temperature) VALUES (?, ?, ?)",
            (fridge_id, humidity, temp),
        ).lastrowid
        print(f"{name}: {temp}°C, {humidity}% (max {max_temp}°C) - saved as reading #{reading_id}")

        open_alert = conn.execute(
            """SELECT alert_id, alert_acknowledged_at FROM Alerts
               WHERE fridge_id = ? AND alert_type = 'temperature' AND alert_resolved_at IS NULL""",
            (fridge_id,),
        ).fetchone()

        if temp > max_temp:
            if open_alert:
                if open_alert["alert_acknowledged_at"] is None:
                    print(f"  -> still above max, alert #{open_alert['alert_id']} already sent - waiting for a reply")
            else:
                message = f"The current temperature is {temp}°C. Would you like to turn on the fan?"
                alert_id = conn.execute(
                    """INSERT INTO Alerts (fridge_id, reading_id, alert_type, alert_condition, alert_value, alert_message)
                       VALUES (?, ?, 'temperature', 'above_max', ?, ?)""",
                    (fridge_id, reading_id, temp, message),
                ).lastrowid
                recipients = [(addr, find_user_id(conn, addr)) for addr in ALERT_EMAILS]
                new_alert = (alert_id, fridge, temp, message, recipients)
        else:
            if open_alert:
                conn.execute(
                    "UPDATE Alerts SET alert_resolved_at = CURRENT_TIMESTAMP WHERE alert_id = ?",
                    (open_alert["alert_id"],),
                )
                print(f"{name}: back under the limit, alert #{open_alert['alert_id']} resolved")
            if fridge["fridge_fan_on"]:
                conn.execute("UPDATE Fridges SET fridge_fan_on = 0 WHERE fridge_id = ?", (fridge_id,))
                print(f"{name}: back under {max_temp}°C - fan OFF")

    if new_alert:
        send_alert(*new_alert)


def send_alert(alert_id, fridge, temp, message, recipients):
    sent = set()
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as s:
            s.starttls()
            s.login(me, app_password)
            for addr, _ in recipients:
                msg = EmailMessage()
                msg.set_content(message)
                msg['Subject'] = f"Fridge alert #{alert_id} - {fridge['fridge_name']}"
                msg['From'] = me
                msg['To'] = addr
                try:
                    s.send_message(msg)
                    sent.add(addr)
                    print(f"Email sent to {addr}")
                except Exception as e:
                    print(f"Couldn't email {addr}: {e}")
    except Exception as e:
        print(f"Couldn't connect to Gmail SMTP: {e}")

    with db() as conn:
        for addr, user_id in recipients:
            if user_id is None:
                print(f"{addr} isn't in Users - email only, no Notifications row")
            elif addr in sent:
                conn.execute(
                    """INSERT INTO Notifications (alert_id, user_id, notification_type, notification_status, notification_sent_at)
                       VALUES (?, ?, 'email', 'sent', CURRENT_TIMESTAMP)""",
                    (alert_id, user_id),
                )
            else:
                conn.execute(
                    """INSERT INTO Notifications (alert_id, user_id, notification_type, notification_status)
                       VALUES (?, ?, 'email', 'failed')""",
                    (alert_id, user_id),
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


@contextmanager
def inbox():
    with IMAPClient('imap.gmail.com') as server:
        server.login(me, app_password)
        server.select_folder('INBOX', readonly=True)
        yield server


def is_quote(line):
    return line.startswith(">") or (line.startswith("On ") and "wrote" in line)


def read_email(server, uid):
    msg = email.message_from_bytes(server.fetch([uid], ['RFC822'])[uid][b'RFC822'])

    subject, encoding = decode_header(msg['Subject'] or '')[0]
    if isinstance(subject, bytes):
        subject = subject.decode(encoding or 'utf-8', errors='ignore')
    from_addr = parseaddr(msg.get('From') or '')[1]

    if msg.is_multipart():
        part = next(
            (p for p in msg.walk()
             if p.get_content_type() == 'text/plain' and 'attachment' not in str(p.get('Content-Disposition'))),
            None,
        )
    else:
        part = msg
    body = (part.get_payload(decode=True) or b'').decode(errors='ignore') if part else ''

    typed = takewhile(lambda line: not is_quote(line), body.splitlines())
    return from_addr, subject, "\n".join(typed).strip()


def handle_reply(from_addr, subject, body):
    match = ALERT_ID_RE.search(subject)
    if not REPLY_RE.match(subject) or not match:
        print("  -> not a reply to a fridge alert, skipping")
        return
    if from_addr.lower() not in ALERT_SET:
        print(f"Reply from {from_addr} isn't in ALERT_EMAILS - ignoring")
        return

    alert_id = int(match[1])
    said_yes = bool(YES_RE.search(body))

    with db() as conn:
        alert = conn.execute(
            "SELECT fridge_id, alert_status FROM Alerts WHERE alert_id = ?", (alert_id,)
        ).fetchone()
        if alert is None:
            print(f"Alert #{alert_id} doesn't exist - ignoring reply")
            return
        if alert["alert_status"] != "unacknowledged":
            print(f"Alert #{alert_id} already handled ({alert['alert_status']}) - ignoring reply")
            return

        user_id = find_user_id(conn, from_addr)
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
        print(f"YES from {from_addr} for alert #{alert_id} (fridge {alert['fridge_id']}) - fan ON")
    else:
        print(f"No YES from {from_addr} for alert #{alert_id} - no action")


def init_inbox():
    global last_uid
    with inbox() as server:
        last_uid = max(server.search('ALL'), default=0)


def check_inbox():
    global last_uid
    with db() as conn:
        waiting = conn.execute(
            "SELECT 1 FROM Alerts WHERE alert_acknowledged_at IS NULL AND alert_status != 'expired' LIMIT 1"
        ).fetchone()
    if not waiting:
        return

    with inbox() as server:
        for uid in sorted(u for u in server.search(['UID', f'{last_uid + 1}:*']) if u > last_uid):
            from_addr, subject, body = read_email(server, uid)
            print(f"Email from {from_addr} | subject: {subject!r} | body: {body[:60]!r}")
            handle_reply(from_addr, subject, body)
            last_uid = uid


def set_motor(on):
    GPIO.setwarnings(False)
    if GPIO.getmode() is None:
        GPIO.setmode(GPIO.BCM)
    if GPIO.getmode() == GPIO.BOARD:
        pins = [BCM_TO_BOARD[p] for p in MOTOR_PINS]
    else:
        pins = list(MOTOR_PINS)
    GPIO.setup(pins, GPIO.OUT)
    level = GPIO.HIGH if on else GPIO.LOW
    GPIO.output(pins, (level, GPIO.LOW, level))
    return pins


def sync_motor():
    global motor_running
    with db() as conn:
        fan_on = conn.execute("SELECT 1 FROM Fridges WHERE fridge_fan_on = 1 LIMIT 1").fetchone() is not None
    pins = set_motor(fan_on)
    if fan_on != motor_running:
        motor_running = fan_on
        mode = "BOARD" if GPIO.getmode() == GPIO.BOARD else "BCM"
        levels = ", ".join(f"{p}={GPIO.input(p)}" for p in pins)
        print(f"Motor {'ON' if fan_on else 'OFF'} ({mode} mode, pins {levels})")


_stop_event = threading.Event()
_thread = None


def run(stop_event):
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
        client.connect_async(BROKER, 1883)
        client.loop_start()
        print("Fridge monitor running...")

        last_check = 0
        while not stop_event.is_set():
            try:
                sync_motor()
            except Exception as e:
                print(f"Motor error: {e}")
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
            GPIO.cleanup(set_motor(False))
        except Exception as e:
            print(f"GPIO cleanup error: {e}")
        print("Fridge monitor stopped")


def start(db_path):
    global _thread, DB_PATH
    if _thread and _thread.is_alive():
        return _thread
    DB_PATH = str(db_path)
    pending.clear()
    _stop_event.clear()
    _thread = threading.Thread(target=run, args=(_stop_event,), name="fridge-monitor", daemon=True)
    _thread.start()
    return _thread


def stop(timeout=5):
    _stop_event.set()
    if _thread:
        _thread.join(timeout)