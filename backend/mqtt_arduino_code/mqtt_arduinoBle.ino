#include <WiFi.h>
#include <PubSubClient.h>
#include <NimBLEDevice.h>

// Bluetooth sensor MAC address
const char* TARGET_MAC = "c3:00:00:45:5d:a7";

// WiFi credentials
const char* ssid = ""; //INSERT HERE
const char* password = ""; //INSERT HERE

// MQTT broker IP address
const char* mqtt_server = "";

WiFiClient espClient;
PubSubClient client(espClient);

// Sensor readings
float temperature = 0;
float humidity = 0;

bool newSensorData = false;

// Bluetooth scanning
NimBLEScan* pBLEScan;


// Function declarations
void setup_wifi();
void reconnect();
void scanBluetooth();
bool decodeSensorData(NimBLEAdvertisedDevice* device);


void setup() {

    Serial.begin(115200);

    // Connect to WiFi
    setup_wifi();

    // Configure MQTT
    client.setServer(mqtt_server, 1883);

    // Initialize Bluetooth
    NimBLEDevice::init("");

    pBLEScan = NimBLEDevice::getScan();

    pBLEScan->setActiveScan(true);
    pBLEScan->setInterval(100);
    pBLEScan->setWindow(99);

    Serial.println("Bluetooth scanning initialized.");

}


void setup_wifi() {

    delay(10);

    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {

        delay(500);
        Serial.print(".");

    }

    Serial.println("");
    Serial.println("WiFi connected");

    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

}


void reconnect() {

    // Loop until reconnected
    while (!client.connected()) {

        Serial.print("Attempting MQTT connection...");

        if (client.connect("ESP32Fridge3")) {

            Serial.println("connected");

        } else {

            Serial.print("failed, rc=");
            Serial.print(client.state());

            Serial.println(" try again in 5 seconds");

            delay(5000);

        }

    }

}


// Decode Bluetooth sensor information
bool decodeSensorData(NimBLEAdvertisedDevice* device) {


    // need manufacturer's packet structure before assigning temperature and humidity.
    // need to see what the output of "console.log(raddec)" in bleFridge gives.
    // need to see what the output of "console.log(decoded)" after "advlibBLE.process()" in bleFridge gives.

    return false;

}


// Scan for the specified Bluetooth device
void scanBluetooth() {

    Serial.println("Scanning for Bluetooth sensor...");

    NimBLEScanResults results = pBLEScan->start(3, false);

    for (int i = 0; i < results.getCount(); i++) {

        NimBLEAdvertisedDevice device = results.getDevice(i);

        String detectedMAC = String(
            device.getAddress().toString().c_str()
        );

        // Ignore other Bluetooth devices
        if (!detectedMAC.equalsIgnoreCase(TARGET_MAC)) {
            continue;
        }

        Serial.println("Target Bluetooth sensor detected!");

        // Decode the sensor readings
        if (decodeSensorData(&device)) {

            newSensorData = true;

        }

    }

    pBLEScan->clearResults();

}


void loop() {

    if (!client.connected()) {
        reconnect();
    }

    client.loop();

    // Scan for Bluetooth sensor
    scanBluetooth();

    // Publish readings when new data is available
    if (newSensorData) {

        char tempString[8];
        dtostrf(temperature, 6, 2, tempString);

        Serial.print("Temperature: ");
        Serial.println(tempString);

        client.publish("fridge/3/temperature", tempString);


        char humString[8];
        dtostrf(humidity, 6, 2, humString);

        Serial.print("Humidity: ");
        Serial.println(humString);

        client.publish("fridge/3/humidity", humString);

        newSensorData = false;

    }

    delay(2000);

}
