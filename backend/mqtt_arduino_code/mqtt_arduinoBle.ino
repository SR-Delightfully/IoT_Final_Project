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
bool newSensorData = false;

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


// Decode Bluetooth temperature and humidity
bool decodeSensorData(const NimBLEAdvertisedDevice* device){

  // Check if the device contains service data
  if (!device->haveServiceData()) {
    return false;
  }

  // Retrieve Bluetooth service data
  std::string data = device->getServiceData();

  // Check that the packet contains enough bytes & Verify the sensor data header
  if (data.length() < 7 || (uint8_t)data[0] != 0xA1 || (uint8_t)data[1] != 0x01) {
    return false;
  }

  // Extract battery percentage
  battery = (uint8_t)data[2];

  // Extract temperature (16-bit big-endian)
  uint16_t tempRaw = ((uint8_t)data[3] << 8) | (uint8_t)data[4];

  // Convert temperature from Q8.8 format
  temperature = tempRaw / 256.0f;

  // Extract humidity (16-bit big-endian)
  uint16_t humRaw = ((uint8_t)data[5] << 8) | (uint8_t)data[6];

  // Convert humidity from Q8.8 format
  humidity = humRaw / 256.0f;

  // Display decoded readings
  Serial.println("Bluetooth sensor information:");

  Serial.print("Temperature: ");
  Serial.println(temperature);

  Serial.print("Humidity: ");
  Serial.println(humidity);

  Serial.print("Battery: ");
  Serial.print(battery);
  Serial.println("%");

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

    // Decode sensor readings
    if (decodeSensorData(device)) {
      newSensorData = true;
    }
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

  delay(2000);
}
