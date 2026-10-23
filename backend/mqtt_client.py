import paho.mqtt.subscribe as subscribe
#save fridge readings to the database
from models.fridge_reading_model import add_reading
#check if the fridge temperature is too high
from temperature_monitor import check_temperature
#save temperature alerts
from models.alert_model import add_alert, get_fridge_alerts, resolve_alert
#send temperature alert emails
from email_sender import send_email
import os

# Match MQTT topics to refrigerator IDs in the database
FRIDGE_IDS = {
    "Frig1": 1,
    "Frig2": 2
}
# Track which sensor value we're expecting next
next_measurement = {
    1: "temperature",
    2: "temperature"
}
# Email address that receives temperature alerts
ALERT_EMAIL = os.getenv("ALERT_EMAIL")
# Temporarily store temperature and humidity for each fridge
readings = {
    1: {"temperature": None, "humidity": None},
    2: {"temperature": None, "humidity": None}
}

# Called when a message is received from the mqtt
def on_message(client, userdata, msg):
    topic = msg.topic
    message = msg.payload.decode("utf-8")  # Readable text

    # Get the refrigerator ID based on the MQTT topic
    fridge_id = FRIDGE_IDS.get(topic)

    # Ignore messages from unknown refrigerators
    if fridge_id is None:
        print("Unknown refrigerator:", topic)
        return

    print("Fridge ID:", fridge_id)
    print("Topic:", topic)
    print("Message:", message)
        # Convert the received message into a number
    try:
        value = float(message)
    except ValueError:
        print("Invalid sensor reading:", message)
        return

    # Identify the expected measurement
    measurement = next_measurement[fridge_id]

    # Store the received value
    readings[fridge_id][measurement] = value

    if measurement == "temperature":
        next_measurement[fridge_id] = "humidity"

    else:
        # Both readings are available
        process_reading(
            fridge_id,
            readings[fridge_id]["humidity"],
            readings[fridge_id]["temperature"]
        )

        # Reset for the next readings
        readings[fridge_id] = {"temperature": None, "humidity": None}
        next_measurement[fridge_id] = "temperature"
# Save sensor readings and check the temperature
def process_reading(fridge_id, humidity, temperature):
    reading_id = add_reading(fridge_id, humidity, temperature)

    # Find existing temperature alerts that are still active
    active_alerts = [
        alert for alert in get_fridge_alerts(fridge_id)
        if alert["alert_type"] == "temperature"
        and alert["alert_condition"] == "above"
        and alert["alert_status"] != "resolved"
    ]

    if check_temperature(fridge_id, temperature):
        if not active_alerts:
            message = f"Fridge {fridge_id} temperature is {temperature}°C"

            alert_id = add_alert(
                fridge_id, reading_id,
                "temperature", "above",
                temperature, message
            )

            print(f"Alert {alert_id} created: {message}")
            #
            if ALERT_EMAIL:
                try:
                    send_email(ALERT_EMAIL, f"Fridge {fridge_id}", temperature, alert_id)
                    print("Alert email sent")
                except Exception as error:
                    print (f"Email failed: {error}")
            else:
                print("Alert email address not configured")

    else:
        # Resolve the alert when temperature returns to normal
        for alert in active_alerts:
            resolve_alert(alert["alert_id"])

    return reading_id

    # Connect to the MQTT broker and listen for both fridges
if __name__ == "__main__":
    broker_ip = os.getenv("MQTT_HOST")

    if broker_ip:
        subscribe.callback(
            on_message,
            ["Frig1", "Frig2"],
            hostname=broker_ip
        )
    else:
        print("MQTT broker IP not configured")