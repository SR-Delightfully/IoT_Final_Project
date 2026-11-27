import { useI18n } from "../utils/i18n";
import { timeAgo as shortTimeAgo } from "../utils/notifications";
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
  const { t, locale } = useI18n();
  const timeAgo = (date) => (date ? shortTimeAgo(date, t, locale) : t("never"));
  const sensor = fridge.sensor;
  const lastSeen = parseDbTime(sensor.sensor_last_seen);
  const online = lastSeen && Date.now() - lastSeen.getTime() < OFFLINE_AFTER_MS;
  const lastMotion = parseDbTime(sensor.sensor_last_motion_at);
  const motionNow = sensor.sensor_motion === 1;
  const battery = sensor.sensor_battery;

  let lightValue = "—";
  let lightDetail = t("No light frame received");
  if (sensor.sensor_light != null) {
    lightValue = `${Math.round(sensor.sensor_light)} lx`;
    lightDetail = t(lightLabel(sensor.sensor_light));
  } else if (sensor.sensor_light_detected != null) {
    lightValue = sensor.sensor_light_detected === 1 ? t("Light") : t("Dark");
    lightDetail = t("Light on / off sensor");
  }

  return (
    <div className="sensor-card">
      <header className="sensor-card-header">
        <div>
          <h3>{t("MSP01 ·")} {fridge.fridge_name}</h3>
          <span className="sensor-card-location">
            {fridge.fridge_location || t("Location unassigned")}
          </span>
        </div>
        <span className={`sensor-status ${online ? "is-online" : "is-offline"}`}>
          <span className="device-status-dot" />
          {online ? t("ONLINE") : t("OFFLINE")} · {timeAgo(lastSeen)}
        </span>
      </header>

      <div className="sensor-tiles">
        <SensorTile
          label={t("Motion")}
          value={sensor.sensor_motion == null ? "—" : motionNow ? t("Detected") : t("None")}
          detail={t("Last motion: {0}", { 0: timeAgo(lastMotion) })}
          status={motionNow ? "is-alert" : ""}
        />
        <SensorTile label={t("Light")} value={lightValue} detail={lightDetail} />
        <SensorTile
          label={t("Temperature")}
          value={fridge.reading_temperature == null ? "—" : `${Number(fridge.reading_temperature).toFixed(1)}°C`}
          detail={t("Max {0}°C", { 0: fridge.fridge_max_temperature })}
          status={
            fridge.reading_temperature != null &&
            fridge.reading_temperature > fridge.fridge_max_temperature
              ? "is-alert"
              : ""
          }
        />
        <SensorTile
          label={t("Humidity")}
          value={fridge.reading_humidity == null ? "—" : `${Math.round(fridge.reading_humidity)}%`}
          detail={t("{0}–{1}% range", { 0: fridge.fridge_min_humidity, 1: fridge.fridge_max_humidity })}
        />
        <SensorTile
          label={t("Battery")}
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
  const { t } = useI18n();
  const withSensor = fridges.filter((fridge) => fridge.sensor);

  return (
    <div className="environment-sensor" id="environment-sensor">
      <header className="environment-sensor-header">
        <span className="dashboard-eyebrow">{t("BLE SENSOR · MINEW MSP01")}</span>
        <span className="dashboard-count">{withSensor.length} {t("REPORTING")}</span>
      </header>

      {withSensor.length === 0 ? (
        <p className="dashboard-empty">
          {t("No motion or light data yet. Check that the BLE ESP32 is running and that the MSP01 is set to broadcast its light and PIR frames in Minew BeaconSET.")}
        </p>
      ) : (
        withSensor.map((fridge) => <SensorCard key={fridge.fridge_id} fridge={fridge} />)
      )}
    </div>
  );
}

export default EnvironmentSensor;
