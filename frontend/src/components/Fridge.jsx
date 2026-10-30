import { useState } from "react";
import TempGauge from "./TempGuage";
import HumidityBar from "./HumidityBar";
import Fan from "./Fan";

function Fridge({ fridge }) {
  const [fanStatus, setFanStatus] = useState(
    String(fridge.fridge_fan_on ?? fridge.fan_status ?? "OFF") === "1" ||
    String(fridge.fridge_fan_on ?? fridge.fan_status ?? "OFF").toUpperCase() === "ON"
      ? "ON"
      : "OFF"
  );

  function toggleFan() {
    setFanStatus((current) => (current === "ON" ? "OFF" : "ON"));
  }

  return (
    <article className="fridge-card">
      <div className="fridge-card-body">
        <header className="fridge-title-wrapper">
          <h2 className="fridge-title">{fridge.fridge_name}</h2>
          <span className={`fridge-device-status ${fanStatus === "ON" ? "is-active" : ""}`}>
            <span className="device-status-dot" />
            SYSTEM {fanStatus === "ON" ? "ACTIVE" : "STANDBY"}
          </span>
        </header>

        <div className="fridge-identity">
          <span className="fridge-unit-id">
            UNIT / {String(fridge.fridge_id).padStart(2, "0")}
          </span>
          <span className="fridge-location">
            {fridge.fridge_location || fridge.location || "LOCATION UNASSIGNED"}
          </span>
        </div>

        <section className="fridge-fan-panel">
          <span className="ceiling-label">COOLING ASSEMBLY</span>
          <Fan status={fanStatus} onToggle={toggleFan} />
        </section>

        <section className="fridge-monitoring">
          <div className="fridge-section-heading">
            <span>01</span>
            <h3>LIVE TELEMETRY</h3>
          </div>

          <div className="gauge-container">
            <div className="gauge temperature-panel">
              <h4 className="fridge-subtitle">Temperature</h4>
              <TempGauge
                value={fridge.reading_temperature}
                min={fridge.fridge_min_temperature}
                max={fridge.fridge_max_temperature}
              />
            </div>

            <div className="gauge humidity-panel">
              <h4 className="fridge-subtitle">Humidity</h4>
              <HumidityBar value={fridge.reading_humidity} />
            </div>
          </div>
        </section>

        <form
          id={`customer-fridge-${fridge.fridge_id}`}
          className="customer-fridge-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="fridge-section-heading">
            <span>02</span>
            <h3>OPERATING LIMITS</h3>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor={`min-temp-${fridge.fridge_id}`} className="form-label">
                Minimum temperature (°C)
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
                Maximum temperature (°C)
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
                Minimum humidity (%)
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
                Maximum humidity (%)
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

            <button className="fridge-save-button" type="submit">
              SAVE LIMITS
            </button>
          </div>
        </form>

        <footer className="fridge-footer">
          <span className="footer-label">HARDWARE STATUS</span>
          <span className={`footer-fan-state ${fanStatus === "ON" ? "active" : ""}`}>
            <span className="fan-status-dot" />
            FAN {fanStatus}
          </span>
          <span className="footer-unit">FB-{fridge.fridge_id}</span>
        </footer>
      </div>
    </article>
  );
}

export default Fridge;