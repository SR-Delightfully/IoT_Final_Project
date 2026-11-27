#include <WiFi.h>
#include <PubSubClient.h>
#include <NimBLEDevice.h>

// Bluetooth sensor MAC address
const char* TARGET_MAC = "c3:00:00:45:5d:a7";

const char* ssid = "";
const char* password = "";

// MQTT Broker IP address
const char* mqtt_server = "";

WiFiClient espClient;
PubSubClient client(espClient);

// Bluetooth sensor readings
float temperature = 0;
float humidity = 0;
int battery = 0;
bool motionDetected = false;
bool lightDetected = false;
uint16_t lightLevel = 0;

// Which values arrived since the last publish
bool newSensorData = false;   // temperature + humidity
bool newMotion = false;
bool newLight = false;
bool newLightDetected = false;
bool newBattery = false;

// Bluetooth scanner
NimBLEScan* pBLEScan;


// Function declarations
void setup_wifi();
void reconnect();
void scanBluetooth();
bool decodeSensorData(const NimBLEAdvertisedDevice* device);


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


// MQTT reconnection
void reconnect() {

  while (!client.connected()) {

    Serial.print("Attempting MQTT connection...");

    if (client.connect("ESP32Fridge3")) {

      Serial.println("connected");

    } else {

      Serial.print("failed, client state: ");
      Serial.print(client.state());

      Serial.println(" try again in 5 seconds");

      delay(5000);
    }
  }
}


// Read a signed 16-bit big-endian value in Q8.8 fixed point (e.g. 0xFF00 = -1.0)
float readSigned88(const std::string& data, size_t offset) {
  int16_t raw = (int16_t)(((uint8_t)data[offset] << 8) | (uint8_t)data[offset + 1]);
  return raw / 256.0f;
}

uint16_t readUInt16(const std::string& data, size_t offset) {
  return ((uint8_t)data[offset] << 8) | (uint8_t)data[offset + 1];
}

// Decode one Minew MSP01 frame. The sensor rotates through the frames it is
// configured to send (in Minew BeaconSET), so each scan may see a different one.
//   A1 01  temperature + humidity   (13 bytes)
//   A1 02  visible light yes/no     (10 bytes)
//   A1 05  illuminance in lux       (11 bytes)
//   A1 11  PIR motion               (11 bytes)
//   A1 19  photoresistor light      (11 bytes)
// Every frame carries the battery percentage in byte 2.
bool decodeSensorData(const NimBLEAdvertisedDevice* device){

  // Check if the device contains service data
  if (!device->haveServiceData()) {
    return false;
  }

  // Retrieve Bluetooth service data
  std::string data = device->getServiceData();

  // Every Minew frame starts with 0xA1, then the frame type
  if (data.length() < 3 || (uint8_t)data[0] != 0xA1) {
    return false;
  }

  uint8_t frameType = (uint8_t)data[1];
  battery = (uint8_t)data[2];
  newBattery = true;

  switch (frameType) {

    case 0x01:  // temperature + humidity
      if (data.length() < 7) return false;
      temperature = readSigned88(data, 3);
      humidity = readSigned88(data, 5);
      newSensorData = true;
      Serial.printf("Temperature: %.2f  Humidity: %.2f
", temperature, humidity);
      break;

    case 0x02:  // visible light detected (yes/no)
      if (data.length() < 4) return false;
      lightDetected = ((uint8_t)data[3] & 0x01) == 0x01;
      newLightDetected = true;
      Serial.printf("Light detected: %s
", lightDetected ? "yes" : "no");
      break;

    case 0x05:  // illuminance (lux)
    case 0x19:  // photoresistor (luminous flux)
      if (data.length() < 5) return false;
      lightLevel = readUInt16(data, 3);
      newLight = true;
      Serial.printf("Light level: %u
", lightLevel);
      break;

    case 0x11:  // PIR motion
      if (data.length() < 5) return false;
      motionDetected = (readUInt16(data, 3) & 0x0001) == 0x0001;
      newMotion = true;
      Serial.printf("Motion: %s
", motionDetected ? "yes" : "no");
      break;

    default:
      Serial.printf("Ignoring Minew frame type 0x%02X
", frameType);
      return false;
  }

  Serial.printf("Battery: %d%%
", battery);
  return true;
}


// Scan for the specified Bluetooth device
void scanBluetooth() {

  Serial.println("Scanning for Bluetooth sensor...");

  // Start Bluetooth scan
  bool scanSuccessful = pBLEScan->start(3, false);

  if (!scanSuccessful) {
    Serial.println("Bluetooth scan failed!");
    return;
  }

  // Retrieve scan results separately
  NimBLEScanResults results = pBLEScan->getResults();

  for (int i = 0; i < results.getCount(); i++) {

    // Get device as a pointer
    const NimBLEAdvertisedDevice* device = results.getDevice(i);

    // Skip invalid pointers
    if (device == nullptr) {
      continue;
    }

    String detectedMAC = String(device->getAddress().toString().c_str());

    // Ignore other Bluetooth devices
    if (!detectedMAC.equalsIgnoreCase(TARGET_MAC)) {
      continue;
    }

    Serial.println("Target Bluetooth sensor detected!");

    // Decode sensor readings (sets the matching new... flag)
    decodeSensorData(device);
  }

  // Clear previous scan results
  pBLEScan->clearResults();
}

// Main program loop
void loop() {

  if (!client.connected()) {
    reconnect();
  }

  client.loop();

  // Scan for Bluetooth sensor
  scanBluetooth();

  // Publish readings when new data is available
  if (newSensorData) {

    // Convert temperature to character array
    char tempString[16];

    dtostrf(temperature, 6, 2, tempString);

    Serial.print("Publishing Temperature: ");
    Serial.println(tempString);

    client.publish("fridge/3/temperature", tempString);

    // Convert humidity to character array
    char humString[16];

    dtostrf(humidity, 6, 2, humString);

    Serial.print("Publishing Humidity: ");
    Serial.println(humString);

    client.publish("fridge/3/humidity", humString);

    // Reset the flag
    newSensorData = false;
  }

  // MSP01 extras: motion, light and battery go on their own topics
  char valueString[16];

  if (newMotion) {
    client.publish("fridge/3/motion", motionDetected ? "1" : "0");
    Serial.printf("Publishing Motion: %d
", motionDetected);
    newMotion = false;
  }

  if (newLight) {
    snprintf(valueString, sizeof(valueString), "%u", lightLevel);
    client.publish("fridge/3/light", valueString);
    Serial.printf("Publishing Light: %s
", valueString);
    newLight = false;
  }

  if (newLightDetected) {
    client.publish("fridge/3/light_detected", lightDetected ? "1" : "0");
    Serial.printf("Publishing Light detected: %d
", lightDetected);
    newLightDetected = false;
  }

  if (newBattery) {
    snprintf(valueString, sizeof(valueString), "%d", battery);
    client.publish("fridge/3/battery", valueString);
    newBattery = false;
  }

  delay(2000);
}
