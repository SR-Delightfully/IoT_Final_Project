import TempGauge from "./TempGuage";
import HumidityBar from "./HumidityBar";
import Fan from "./Fan";
import { useI18n } from "../utils/i18n";

const LIMIT_FIELDS = [
  "fridge_min_temperature",
  "fridge_max_temperature",
  "fridge_min_humidity",
  "fridge_max_humidity",
];

// The fan state comes from the database on every dashboard refresh, so a fan
// turned on by an email "YES" shows here too.
function Fridge({ fridge, onToggleFan, onSaveLimits, fanBusy = false, savingLimits = false }) {
  const { t } = useI18n();
  const fanStatus = Number(fridge.fridge_fan_on) === 1 ? "ON" : "OFF";

  function toggleFan() {
    onToggleFan?.(fridge, fanStatus !== "ON");
  }

  function saveLimits(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const limits = Object.fromEntries(
      LIMIT_FIELDS.map((field) => [field, Number(form.get(field))])
    );
    onSaveLimits?.(fridge, limits);
  }

  return (
    <article className="fridge-card">
      <div className="fridge-card-body">
        <header className="fridge-title-wrapper">
          <h2 className="fridge-title">{fridge.fridge_name}</h2>
          <span className={`fridge-device-status ${fanStatus === "ON" ? "is-active" : ""}`}>
            <span className="device-status-dot" />
            {t("SYSTEM")} {fanStatus === "ON" ? t("ACTIVE") : t("STANDBY")}
          </span>
        </header>

        <div className="fridge-identity">
          <span className="fridge-unit-id">
            {t("UNIT /")} {String(fridge.fridge_id).padStart(2, "0")}
          </span>
          <span className="fridge-location">
            {fridge.fridge_location || fridge.location || t("LOCATION UNASSIGNED")}
          </span>
        </div>

        <section className="fridge-fan-panel">
          <span className="ceiling-label">{t("COOLING ASSEMBLY")}</span>
          <Fan status={fanStatus} onToggle={toggleFan} disabled={fanBusy} />
          {fridge.fridge_fan_on === 1 && fridge.fridge_fan_source && (
            <span className="fridge-fan-source">
              {t("Turned on by")} {fridge.fridge_fan_source === "email" ? t("email reply") : t("dashboard")}
            </span>
          )}
        </section>

        <section className="fridge-monitoring">
          <div className="fridge-section-heading">
            <span>01</span>
            <h3>{t("LIVE TELEMETRY")}</h3>
          </div>

          <div className="gauge-container">
            <div className="gauge temperature-panel">
              <h4 className="fridge-subtitle">{t("Temperature")}</h4>
              <TempGauge
                value={fridge.reading_temperature}
                min={fridge.fridge_min_temperature}
                max={fridge.fridge_max_temperature}
              />
            </div>

            <div className="gauge humidity-panel">
              <h4 className="fridge-subtitle">{t("Humidity")}</h4>
              <HumidityBar value={fridge.reading_humidity} />
            </div>
          </div>
        </section>

        <form
          id={`customer-fridge-${fridge.fridge_id}`}
          className="customer-fridge-form"
          onSubmit={saveLimits}
        >
          <div className="fridge-section-heading">
            <span>02</span>
            <h3>{t("OPERATING LIMITS")}</h3>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor={`min-temp-${fridge.fridge_id}`} className="form-label">
                {t("Minimum temperature (°C)")}
              </label>
              <input
                type="number"
                step="any"
                name="fridge_min_temperature"
                id={`min-temp-${fridge.fridge_id}`}
                defaultValue={fridge.fridge_min_temperature ?? ""}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor={`max-temp-${fridge.fridge_id}`} className="form-label">
                {t("Maximum temperature (°C)")}
              </label>
              <input
                type="number"
                step="any"
                name="fridge_max_temperature"
                id={`max-temp-${fridge.fridge_id}`}
                defaultValue={fridge.fridge_max_temperature ?? ""}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor={`min-humidity-${fridge.fridge_id}`} className="form-label">
                {t("Minimum humidity (%)")}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                name="fridge_min_humidity"
                id={`min-humidity-${fridge.fridge_id}`}
                defaultValue={fridge.fridge_min_humidity ?? ""}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor={`max-humidity-${fridge.fridge_id}`} className="form-label">
                {t("Maximum humidity (%)")}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                name="fridge_max_humidity"
                id={`max-humidity-${fridge.fridge_id}`}
                defaultValue={fridge.fridge_max_humidity ?? ""}
                required
              />
            </div>

            <button className="fridge-save-button" type="submit" disabled={savingLimits}>
              {savingLimits ? t("SAVING...") : t("SAVE LIMITS")}
            </button>
          </div>
        </form>

        <footer className="fridge-footer">
          <span className="footer-label">{t("HARDWARE STATUS")}</span>
          <span className={`footer-fan-state ${fanStatus === "ON" ? "active" : ""}`}>
            <span className="fan-status-dot" />
            {t("FAN")} {fanStatus}
          </span>
          <span className="footer-unit">{t("FB-")}{fridge.fridge_id}</span>
        </footer>
      </div>
    </article>
  );
}

export default Fridge;