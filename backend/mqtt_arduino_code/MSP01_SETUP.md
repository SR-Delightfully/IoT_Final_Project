# Minew MSP01 setup checklist

The BLE ESP32 (`mqtt_arduinoBle.ino`) only receives the frames the MSP01 is set up to broadcast. If the dashboard shows temperature and humidity but **no motion or light**, the sensor probably isn't sending those frames.

## 1. Turn on the frames in Minew BeaconSET

1. Install **BeaconSET+** (Minew) on a phone and connect to the sensor (MAC `C3:00:00:45:5D:A7`, default password `minew123`).
2. Open the slot list and give each of these frame types a slot:
   - **HT** (temperature + humidity): frame `A1 01`
   - **PIR / motion**: frame `A1 11`
   - **Light** (illuminance `A1 05`, or light on/off `A1 02`)
3. Use a short advertising interval (for example 1000 ms) and save.

More detail: https://reelyactive.github.io/diy/minew-msp01-config/

## 2. Flash the ESP32

Fill in `ssid`, `password` and `mqtt_server` (the Pi's IP) in `mqtt_arduinoBle.ino`, then upload. The Serial Monitor (115200 baud) prints every frame it decodes, for example `Motion: yes` or `Light level: 312`. A line like `Ignoring Minew frame type 0x..` means the sensor is sending a frame the sketch doesn't use.

## 3. What gets published

| Topic | Payload | Stored in |
|---|---|---|
| `fridge/3/temperature` | °C | `Readings` |
| `fridge/3/humidity` | % | `Readings` |
| `fridge/3/motion` | `1` / `0` | `SensorReadings.sensor_motion` |
| `fridge/3/light` | lux | `SensorReadings.sensor_light` |
| `fridge/3/light_detected` | `1` / `0` | `SensorReadings.sensor_light_detected` |
| `fridge/3/battery` | % | `SensorReadings.sensor_battery` |

The **Environment sensor (Minew MSP01)** panel on `/dashboard/fridges` shows these values.

## Quick test without the sensor

From the Pi:

```
mosquitto_pub -h localhost -t fridge/3/motion -m 1
mosquitto_pub -h localhost -t fridge/3/light -m 420
mosquitto_pub -h localhost -t fridge/3/battery -m 87
```
