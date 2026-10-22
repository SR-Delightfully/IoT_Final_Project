import paho.mqtt.subscribe as subscribe
# Import function to save fridge readings to the database
from models.fridge_reading_model import add_reading
# Import function to check if the fridge temperature is too high
from temperature_monitor import check_temperature

# Match MQTT topics to refrigerator IDs in the database
FRIDGE_IDS = {
    "Frig1": 1,
    "Frig2": 2
}
# Temporarily store temperature and humidity for each fridge
readings = {
    1: {"temperature": None, "humidity": None},
    2: {"temperature": None, "humidity": None}
}

# Called when a message is received from the mqtt
# Called when a message is received from MQTT
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
# Save sensor readings and check the temperature
def process_reading(fridge_id, humidity, temperature):
    reading_id = add_reading(fridge_id, humidity, temperature)

    if check_temperature(fridge_id, temperature):
        print(f"Temperature too high in Fridge {fridge_id}: {temperature}°C")

    return reading_id

    # Connect to the MQTT broker and listen for both fridges
if __name__ == "__main__":
    subscribe.callback(
        on_message,
        ["Frig1", "Frig2"],
        hostname="RASPBERRY_PI_IP"
    )