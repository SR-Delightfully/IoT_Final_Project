import { useEffect, useRef, useState } from "react";
import TempGauge from "../components/TempGuage";
import HumidityBar from "../components/HumidityBar";
import Fan from "../components/Fan";

const API = "http://localhost:5050";
const REFRESH_MS = 2000; // how often to pull new readings

function FridgeCard({ fridge }) {
  // Fan state follows the database (fridge_fan_on) when the backend sends it,
  // so a YES email reply also shows up here.
  const serverFan =
    fridge.fridge_fan_on === undefined ? null : fridge.fridge_fan_on ? "ON" : "OFF";
  const [fanStatus, setFanStatus] = useState(serverFan ?? "OFF");
  const [fanBusy, setFanBusy] = useState(false);

  useEffect(() => {
    if (serverFan !== null && !fanBusy) setFanStatus(serverFan);
  }, [serverFan, fanBusy]);

  async function toggleFan() {
    const next = fanStatus === "ON" ? "OFF" : "ON";
    setFanStatus(next); // update the UI right away
    setFanBusy(true);
    try {
      const response = await fetch(`${API}/fridges/${fridge.fridge_id}/fan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next === "ON" }),
      });
      if (!response.ok) throw new Error("Fan toggle failed");
    } catch (error) {
      setFanStatus(next === "ON" ? "OFF" : "ON"); // undo if the server refused
      alert("Could not change the fan");
    } finally {
      setFanBusy(false);
    }
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
          <span className="ceiling-label">INTERNAL COOLING UNIT</span>

          <Fan status={fanStatus} onToggle={toggleFan} />
        </section>

        <section className="fridge-monitoring">
          <div className="fridge-section-heading">
            <h3>// LIVE MONITORING</h3>
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
          onSubmit={async (event) => {
            event.preventDefault();

            const minTemp = Number(
              event.currentTarget.elements.fridge_min_temperature.value
            );

            try {
              const response = await fetch(
                `${API}/fridges/${fridge.fridge_id}/threshold`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ min_temperature: minTemp }),
                }
              );

              if (!response.ok) throw new Error("Save failed");

              // No reload needed - the next refresh picks up the new value.
              alert("Minimum temperature saved!");
            } catch (error) {
              alert("Could not save temperature");
            }
          }}
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
            className={`footer-fan-state ${fanStatus === "ON" ? "active" : ""}`}
          >
            <span className="fan-status-dot" />
            FAN {fanStatus}
          </span>

          <span className="footer-unit">FB-{fridge.fridge_id}</span>
        </footer>
      </div>
    </article>
  );
}

function Fridge() {
  const [fridges, setFridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchFridges() {
      if (inFlight.current) return; // skip if the last request hasn't finished
      inFlight.current = true;
      try {
        const response = await fetch(`${API}/fridges`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not fetch fridge data");
        }

        const data = await response.json();
        setFridges(Array.isArray(data) ? data : []);
        setError("");
        setLastUpdated(new Date());
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load fridge data. Check the backend connection.");
        }
      } finally {
        inFlight.current = false;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchFridges();
    const timer = setInterval(fetchFridges, REFRESH_MS);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  if (loading) {
    return <p>Loading fridge data...</p>;
  }

  // Only replace the page with an error if we never got data.
  // If a refresh fails later, keep showing the last readings.
  if (error && fridges.length === 0) {
    return <p>{error}</p>;
  }

  if (fridges.length === 0) {
    return <p>No fridges found.</p>;
  }

  return (
    <main className="fridge-page">
      <header className="fridge-page-header">
        <span className="page-eyebrow">SMART TCG STORE / CONTROL ROOM</span>
        <h1>Fridge systems</h1>
        <p>Monitor internal conditions and manage cooling hardware.</p>
        <p className="fridge-last-updated">
          {error
            ? "Connection lost - showing last readings"
            : lastUpdated && `Last updated ${lastUpdated.toLocaleTimeString()}`}
        </p>
      </header>
      <article className="fridge-grid">
        {fridges.map((fridge) => (
          <FridgeCard key={fridge.fridge_id} fridge={fridge} />
        ))}
      </article>
    </main>
  );
}

export default Fridge;