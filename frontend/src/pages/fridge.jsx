import { useEffect, useState } from "react";
import TempGauge from "../components/TempGuage";
import HumidityBar from "../components/HumidityBar";
import Fan from "../components/Fan";

function FridgeCard({ fridge }) {
  const [fanStatus, setFanStatus] = useState("OFF");

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

        <section className="fridge-ceiling">
          <span className="ceiling-label">
            INTERNAL COOLING UNIT
          </span>

          <Fan status={fanStatus} onToggle={toggleFan} />
        </section>

        <section className="fridge-monitoring">
          <div className="fridge-section-heading">
            <span>01</span>
            <h3>LIVE MONITORING</h3>
          </div>

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
            <div className="form-field">
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

          <span
            className={`footer-fan-state ${
              fanStatus === "ON" ? "active" : ""
            }`}
          >
            <span className="fan-status-dot" />
            FAN {fanStatus}
          </span>

          <span className="footer-unit">
            FB-{fridge.fridge_id}
          </span>
        </footer>
      </div>
    </article>
  );
}

function Fridge() {
  const [fridges, setFridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchFridges() {
      try {
        const response = await fetch("http://localhost:5050/fridges", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not fetch fridge data");
        }

        const data = await response.json();
        setFridges(Array.isArray(data.fridges) ? data.fridges : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load fridge data. Check the backend connection.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchFridges();

    return () => controller.abort();
  }, []);

  if (loading) {
    return <p>Loading fridge data...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (fridges.length === 0) {
    return <p>No fridges found.</p>;
  }

  return (
    <>
      <main className="fridge-page">
        <header className="fridge-page-header">
            <span className="page-eyebrow">FROSTBYTE / CONTROL CENTER</span>
            <h1>Fridge systems</h1>
            <p>Monitor internal conditions and manage cooling hardware.</p>
          </header>
          <article className="fridge-grid">
            {fridges.map((fridge) => (
              <FridgeCard key={fridge.fridge_id} fridge={fridge} />
            ))}
          </article>
      </main>
    </>
  );
}

export default Fridge;