// Widgets for the Minew MSP01 BLE sensor (temperature, humidity, light, motion).
// The ESP32 relays it over MQTT as fridge/<id>/..., so its values arrive on the
// fridge it is assigned to; this panel shows the extra sensor data on its own.

const OFFLINE_AFTER_MS = 2 * 60 * 1000;

// SQLite CURRENT_TIMESTAMP is UTC without a zone: "2026-11-27 14:03:22"
function parseDbTime(value) {
  if (!value) return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeAgo(date) {
  if (!date) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleString();
}

function lightLabel(lux) {
  if (lux == null) return "";
  if (lux < 10) return "Dark";
  if (lux < 200) return "Dim";
  if (lux < 1000) return "Indoor light";
  return "Bright";
}

function SensorTile({ label, value, detail, status = "" }) {
  return (
    <article className={`sensor-tile ${status}`}>
      <span className="sensor-tile-label">{label}</span>
      <strong className="sensor-tile-value">{value}</strong>
      {detail && <span className="sensor-tile-detail">{detail}</span>}
    </article>
  );
}

function SensorCard({ fridge }) {
  const sensor = fridge.sensor;
  const lastSeen = parseDbTime(sensor.sensor_last_seen);
  const online = lastSeen && Date.now() - lastSeen.getTime() < OFFLINE_AFTER_MS;
  const lastMotion = parseDbTime(sensor.sensor_last_motion_at);
  const motionNow = sensor.sensor_motion === 1;
  const battery = sensor.sensor_battery;

  let lightValue = "—";
  let lightDetail = "No light frame received";
  if (sensor.sensor_light != null) {
    lightValue = `${Math.round(sensor.sensor_light)} lx`;
    lightDetail = lightLabel(sensor.sensor_light);
  } else if (sensor.sensor_light_detected != null) {
    lightValue = sensor.sensor_light_detected === 1 ? "Light" : "Dark";
    lightDetail = "Light on / off sensor";
  }

  return (
    <div className="sensor-card">
      <header className="sensor-card-header">
        <div>
          <h3>MSP01 · {fridge.fridge_name}</h3>
          <span className="sensor-card-location">
            {fridge.fridge_location || "Location unassigned"}
          </span>
        </div>
        <span className={`sensor-status ${online ? "is-online" : "is-offline"}`}>
          <span className="device-status-dot" />
          {online ? "ONLINE" : "OFFLINE"} · {timeAgo(lastSeen)}
        </span>
      </header>

      <div className="sensor-tiles">
        <SensorTile
          label="Motion"
          value={sensor.sensor_motion == null ? "—" : motionNow ? "Detected" : "None"}
          detail={`Last motion: ${timeAgo(lastMotion)}`}
          status={motionNow ? "is-alert" : ""}
        />
        <SensorTile label="Light" value={lightValue} detail={lightDetail} />
        <SensorTile
          label="Temperature"
          value={fridge.reading_temperature == null ? "—" : `${Number(fridge.reading_temperature).toFixed(1)}°C`}
          detail={`Max ${fridge.fridge_max_temperature}°C`}
          status={
            fridge.reading_temperature != null &&
            fridge.reading_temperature > fridge.fridge_max_temperature
              ? "is-alert"
              : ""
          }
        />
        <SensorTile
          label="Humidity"
          value={fridge.reading_humidity == null ? "—" : `${Math.round(fridge.reading_humidity)}%`}
          detail={`${fridge.fridge_min_humidity}–${fridge.fridge_max_humidity}% range`}
        />
        <SensorTile
          label="Battery"
          value={battery == null ? "—" : `${battery}%`}
          detail={
            battery == null ? "" : (
              <span className="sensor-battery">
                <span
                  className={`sensor-battery-fill ${battery < 20 ? "is-low" : ""}`}
                  style={{ width: `${battery}%` }}
                />
              </span>
            )
          }
          status={battery != null && battery < 20 ? "is-alert" : ""}
        />
      </div>
    </div>
  );
}

function EnvironmentSensor({ fridges }) {
  const withSensor = fridges.filter((fridge) => fridge.sensor);

  return (
    <div className="environment-sensor" id="environment-sensor">
      <header className="environment-sensor-header">
        <span className="dashboard-eyebrow">BLE SENSOR · MINEW MSP01</span>
        <span className="dashboard-count">{withSensor.length} REPORTING</span>
      </header>

      {withSensor.length === 0 ? (
        <p className="dashboard-empty">
          No motion or light data yet. Check that the BLE ESP32 is running and that
          the MSP01 is set to broadcast its light and PIR frames in Minew BeaconSET.
        </p>
      ) : (
        withSensor.map((fridge) => <SensorCard key={fridge.fridge_id} fridge={fridge} />)
      )}
    </div>
  );
}

export default EnvironmentSensor;
