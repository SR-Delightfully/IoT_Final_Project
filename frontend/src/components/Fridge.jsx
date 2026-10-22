import { useState } from "react";
import TempGauge from "./TempGuage";
import HumidityBar from "./HumidityBar";
import Fan from "./Fan";

function Fridge({ fridge }) {
  const [fanStatus, setFanStatus] = useState(
    String(fridge.fan_status ?? "OFF").toUpperCase()
  );

  function toggleFan() {
    setFanStatus((current) => (current === "ON" ? "OFF" : "ON"));
  }

  return (
    <article className="fridge-card">
      <div className="fridge-card-body">
        <div className="fridge-title-wrapper">
          <h2 className="fridge-title">{fridge.fridge_name}</h2>
                    <span className="fridge-device-status">
            <span className="device-status-dot" />
            MONITORING
          </span>
        </div>
        <div className="fridge-ceiling">
          <span className="ceiling-label">INTERNAL COOLING UNIT</span>
          <Fan status={fanStatus} onToggle={toggleFan} />
        </div>

        <header className="fridge-header">
          <span className="fridge-unit-id">
            UNIT / {String(fridge.fridge_id).padStart(2, "0")}
          </span>

        </header>

        <section className="fridge-monitoring">
          <div className="gauge-container">
            <div className="gauge">
              <h4 className="fridge-subtitle">Temperature</h4>
              <TempGauge
                value={fridge.reading_temperature}
                min={fridge.fridge_min_temperature}
                max={fridge.fridge_max_temperature}
              />
            </div>

            <div className="gauge">
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
            <h3>CONFIGURATION</h3>
          </div>

          <div className="form-grid">
            <div className="form-field form-field-full">
              <label
                htmlFor={`min-temp-${fridge.fridge_id}`}
                className="form-label"
              >
                Minimum temperature (°C)
              </label>
              <input
                type="number"
                step="any"
                name="fridge_min_temperature"
                id={`min-temp-${fridge.fridge_id}`}
                defaultValue={fridge.fridge_min_temperature}
                required
              />
            </div>

            <input
              type="submit"
              id={`fridge-btn-${fridge.fridge_id}`}
              value="Save configuration"
            />
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