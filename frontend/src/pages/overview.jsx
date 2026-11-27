import { useEffect, useState } from "react";
import { Link } from "react-router";
import { authHeaders } from "../utils/auth";
import { formatPrice } from "../utils/purchases";

const API = import.meta.env.VITE_API_URL;
const REFRESH_MS = 5000;
const SENSOR_OFFLINE_MS = 2 * 60 * 1000;

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(), cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `${path}: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function parseDbTime(value) {
  return value ? new Date(`${value.replace(" ", "T")}Z`) : null;
}

function isLowStock(p) {
  return (
    Boolean(p.product_active) &&
    p.quantity_in_stock <= (p.category_low_threshold ?? 5)
  );
}

function Tile({ to, label, value, detail, status = "" }) {
  return (
    <Link to={to} className={`overview-tile ${status}`}>
      <span className="overview-tile-label">{label}</span>
      <strong className="overview-tile-value">{value}</strong>
      <span className="overview-tile-detail">{detail}</span>
      <span className="overview-tile-link">Open →</span>
    </Link>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [denied, setDenied] = useState(!localStorage.getItem("token"));
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    if (denied) return;
    let active = true;

    async function refresh() {
      const today = todayIso();
      const results = await Promise.allSettled([
        getJson(`/admin/reports/sales?start_date=${today}&end_date=${today}`),
        getJson(`/admin/reports/customers?start_date=${today}&end_date=${today}`),
        getJson("/admin/products"),
        getJson("/alerts"),
        getJson("/fridges"),
      ]);
      if (!active) return;

      if (results.some((r) => r.status === "rejected" && r.reason?.status === 403)) {
        setDenied(true);
        return;
      }

      const [sales, customers, products, alerts, fridges] = results.map((r) =>
        r.status === "fulfilled" ? r.value : null
      );
      setData({ sales, customers, products, alerts, fridges: fridges?.fridges ?? null });
      setError(results.some((r) => r.status === "rejected") ? "Some widgets could not load." : "");
      setUpdated(new Date());
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [denied]);

  if (denied) {
    return (
      <main className="products-page">
        <div className="products-card">
          <div className="products-card-body">
            <h1 className="products-title">Access Denied</h1>
            <p className="products-message">Only admins can view the dashboard overview.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="overview-page">
        <p className="points-next">Loading overview...</p>
      </main>
    );
  }

  const { sales, customers, products, alerts, fridges } = data;
  const lowStock = products ? products.filter(isLowStock) : [];
  const activeAlerts = alerts ? alerts.filter((a) => a.alert_status !== "RESOLVED") : [];
  const unacknowledged = activeAlerts.filter((a) => a.alert_status === "UNACKNOWLEDGED");
  const fansOn = fridges ? fridges.filter((f) => Number(f.fridge_fan_on) === 1) : [];
  const sensorFridge = fridges?.find((f) => f.sensor);
  const sensor = sensorFridge?.sensor;
  const sensorSeen = parseDbTime(sensor?.sensor_last_seen);
  const sensorOnline = sensorSeen && Date.now() - sensorSeen.getTime() < SENSOR_OFFLINE_MS;

  let lightText = "—";
  if (sensor?.sensor_light != null) lightText = `${Math.round(sensor.sensor_light)} lx`;
  else if (sensor?.sensor_light_detected != null)
    lightText = sensor.sensor_light_detected === 1 ? "Light" : "Dark";

  return (
    <main className="overview-page">
      <header className="overview-header">
        <div>
          <span className="overview-eyebrow">SMART TCG STORE / CONTROL ROOM</span>
          <h1>Dashboard overview</h1>
          <p>Today at a glance. Each tile opens its full page.</p>
        </div>
        <span className="overview-updated">
          {updated && `Updated ${updated.toLocaleTimeString()}`}
          {error && ` · ${error}`}
        </span>
      </header>

      <h2 className="overview-section-title">Store</h2>
      <section className="overview-grid">
        <Tile
          to="/dashboard/reports"
          label="Sales today"
          value={sales ? formatPrice(sales.total_sales_cents) : "—"}
          detail={sales ? `${sales.total_units_sold} unit(s) sold` : "Unavailable"}
        />
        <Tile
          to="/dashboard/reports"
          label="Customers today"
          value={customers ? customers.total_customers + customers.guest_checkouts : "—"}
          detail={
            customers
              ? `${customers.new_customers} new · ${customers.returning_customers} returning · ${customers.guest_checkouts} guest`
              : "Unavailable"
          }
        />
        <Tile
          to="/dashboard/inventory"
          label="Low stock"
          value={products ? lowStock.length : "—"}
          detail={
            products
              ? lowStock.length
                ? lowStock.slice(0, 3).map((p) => p.product_name).join(", ") +
                  (lowStock.length > 3 ? "…" : "")
                : "All products above their low level"
              : "Unavailable"
          }
          status={lowStock.length ? "is-warning" : ""}
        />
      </section>

      <h2 className="overview-section-title">Equipment</h2>
      <section className="overview-grid">
        <Tile
          to="/dashboard/fridges"
          label="Active fridge alerts"
          value={alerts ? unacknowledged.length : "—"}
          detail={
            alerts
              ? `${activeAlerts.length - unacknowledged.length} acknowledged, not yet resolved`
              : "Unavailable"
          }
          status={unacknowledged.length ? "is-warning" : ""}
        />
        <Tile
          to="/dashboard/fridges"
          label="Fans running"
          value={fridges ? `${fansOn.length}/${fridges.length}` : "—"}
          detail={
            fansOn.length
              ? fansOn.map((f) => f.fridge_name).join(", ")
              : "All fans off"
          }
          status={fansOn.length ? "is-active" : ""}
        />
        <Tile
          to="/dashboard/fridges"
          label="MSP01 sensor"
          value={
            sensor
              ? sensor.sensor_motion === 1
                ? "Motion"
                : "No motion"
              : "—"
          }
          detail={
            sensor
              ? `Light ${lightText} · ${sensorOnline ? "online" : "offline"}`
              : "No motion/light data yet"
          }
          status={sensor?.sensor_motion === 1 ? "is-active" : ""}
        />
      </section>
    </main>
  );
}

export default Overview;
