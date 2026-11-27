import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import Header from "../layout/header";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const REFRESH_INTERVAL = 15000;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(endpoint) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}`);
  }

  return response.json();
}

function getArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function getAlertSeverity(alert) {
  const value = String(
    alert.severity || alert.type || alert.status || ""
  ).toLowerCase();

  if (value.includes("critical") || value.includes("error")) return "critical";
  if (value.includes("warning") || value.includes("low")) return "warning";
  return "info";
}

function getAlertTitle(alert) {
  return (
    alert.title ||
    alert.message ||
    alert.alert_message ||
    alert.description ||
    "System notification"
  );
}

function getAlertDate(alert) {
  const value =
    alert.created_at ||
    alert.timestamp ||
    alert.date ||
    alert.updated_at;

  return value ? formatDate(value) : "Recently";
}

export default function OverviewDashboard() {
  const [products, setProducts] = useState([]);
  const [fridges, setFridges] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState([]);

  const loadDashboard = useCallback(async () => {
    const requests = await Promise.allSettled([
      fetchJson("/products"),
      fetchJson("/fridges"),
      fetchJson("/alerts"),
    ]);

    const failed = [];

    if (requests[0].status === "fulfilled") {
      setProducts(
        getArray(requests[0].value, ["products", "data"])
      );
    } else {
      failed.push("Products");
    }

    if (requests[1].status === "fulfilled") {
      setFridges(
        getArray(requests[1].value, ["fridges", "data"])
      );
    } else {
      failed.push("Fridges");
    }

    if (requests[2].status === "fulfilled") {
      setAlerts(
        getArray(requests[2].value, ["alerts", "data"])
      );
    } else {
      failed.push("Alerts");
    }

    setErrors(failed);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const lowStock = products.filter((product) => {
      const stock = Number(
        product.stock_quantity ??
        product.quantity ??
        product.stock ??
        0
      );

      return stock <= 5;
    });

    const activeFridges = fridges.filter((fridge) => {
      const status = String(
        fridge.status || fridge.connection_status || ""
      ).toLowerCase();

      return (
        fridge.is_online === true ||
        status === "online" ||
        status === "active" ||
        status === "connected"
      );
    });

    const activeAlerts = alerts.filter((alert) => {
      const status = String(alert.status || "").toLowerCase();

      return (
        status !== "resolved" &&
        status !== "dismissed" &&
        status !== "closed"
      );
    });

    return {
      products: products.length,
      lowStock: lowStock.length,
      fridges: fridges.length,
      activeFridges: activeFridges.length,
      alerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(
        (alert) => getAlertSeverity(alert) === "critical"
      ).length,
    };
  }, [products, fridges, alerts]);

  const recentAlerts = useMemo(() => {
    return [...alerts]
      .filter((alert) => {
        const status = String(alert.status || "").toLowerCase();
        return !["resolved", "dismissed", "closed"].includes(status);
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at || a.timestamp || a.date || 0
        );
        const dateB = new Date(
          b.created_at || b.timestamp || b.date || 0
        );

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [alerts]);

  const today = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="admin-overview">
      <Header />

      <div className="admin-overview-content">
        <section className="admin-overview-heading">
          <div>
            <span className="admin-eyebrow">
              STORE MANAGEMENT / OVERVIEW
            </span>
            <h1>Dashboard</h1>
            <p>
              Welcome back. Here's what's happening at your store.
            </p>
          </div>

          <div className="admin-overview-date">
            <span>{today}</span>
            <span className="admin-refresh-status">
              <span className="admin-status-dot" />
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Connecting..."}
            </span>
          </div>
        </section>

        {errors.length > 0 && (
          <div className="admin-error-banner">
            <span>Some dashboard information could not be loaded:</span>
            {" "}{errors.join(", ")}
            <button onClick={loadDashboard}>Retry</button>
          </div>
        )}

        <section className="admin-stats-grid">
          <article className="admin-stat-card">
            <div className="admin-stat-top">
              <span>PRODUCTS</span>
              <span className="admin-stat-icon">01</span>
            </div>
            <strong>{loading ? "—" : stats.products}</strong>
            <span className="admin-stat-description">
              Total registered products
            </span>
            <Link to="/dashboard/inventory">
              Manage inventory <span>→</span>
            </Link>
          </article>

          <article className="admin-stat-card">
            <div className="admin-stat-top">
              <span>LOW STOCK</span>
              <span className="admin-stat-icon warning">02</span>
            </div>
            <strong>{loading ? "—" : stats.lowStock}</strong>
            <span className="admin-stat-description">
              Products with 5 or fewer units
            </span>
            <Link to="/dashboard/inventory">
              Review inventory <span>→</span>
            </Link>
          </article>

          <article className="admin-stat-card">
            <div className="admin-stat-top">
              <span>FRIDGE DEVICES</span>
              <span className="admin-stat-icon">03</span>
            </div>
            <strong>
              {loading ? "—" : `${stats.activeFridges}/${stats.fridges}`}
            </strong>
            <span className="admin-stat-description">
              Connected devices
            </span>
            <Link to="/dashboard/fridges">
              View devices <span>→</span>
            </Link>
          </article>

          <article className="admin-stat-card">
            <div className="admin-stat-top">
              <span>ACTIVE ALERTS</span>
              <span className="admin-stat-icon danger">04</span>
            </div>
            <strong>{loading ? "—" : stats.alerts}</strong>
            <span className="admin-stat-description">
              {stats.criticalAlerts} critical alerts
            </span>
            <Link to="/dashboard/alerts">
              Review alerts <span>→</span>
            </Link>
          </article>
        </section>

        <section className="admin-overview-main">
          <div className="admin-overview-panel admin-alerts-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-eyebrow">SYSTEM MONITORING</span>
                <h2>Recent alerts</h2>
              </div>
              <Link to="/dashboard/alerts" className="admin-panel-link">
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="admin-empty-state">Loading alerts...</div>
            ) : recentAlerts.length === 0 ? (
              <div className="admin-empty-state">
                <span className="admin-empty-symbol">✓</span>
                <strong>All clear</strong>
                <p>There are no outstanding system alerts.</p>
              </div>
            ) : (
              <div className="admin-alert-list">
                {recentAlerts.map((alert, index) => {
                  const severity = getAlertSeverity(alert);

                  return (
                    <div
                      className="admin-alert-item"
                      key={alert.alert_id || alert.id || index}
                    >
                      <span className={`admin-alert-indicator ${severity}`} />
                      <div className="admin-alert-information">
                        <strong>{getAlertTitle(alert)}</strong>
                        <span>
                          {alert.fridge_name ||
                            alert.device_name ||
                            alert.product_name ||
                            "Store system"}
                        </span>
                      </div>
                      <time>{getAlertDate(alert)}</time>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-overview-panel admin-system-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-eyebrow">INFRASTRUCTURE</span>
                <h2>System status</h2>
              </div>
              <span className="admin-live-indicator">
                <span className="admin-status-dot" />
                LIVE
              </span>
            </div>

            <div className="admin-system-list">
              <div className="admin-system-item">
                <div>
                  <span className="admin-system-symbol">API</span>
                  <div>
                    <strong>Backend API</strong>
                    <span>Store services</span>
                  </div>
                </div>
                <span className="admin-system-status neutral">
                  MONITORING
                </span>
              </div>

              <div className="admin-system-item">
                <div>
                  <span className="admin-system-symbol">RFID</span>
                  <div>
                    <strong>RFID system</strong>
                    <span>Product identification</span>
                  </div>
                </div>
                <span className="admin-system-status neutral">
                  MONITORING
                </span>
              </div>

              <div className="admin-system-item">
                <div>
                  <span className="admin-system-symbol">DB</span>
                  <div>
                    <strong>Database</strong>
                    <span>Store records</span>
                  </div>
                </div>
                <span className="admin-system-status neutral">
                  MONITORING
                </span>
              </div>

              <div className="admin-system-item">
                <div>
                  <span className="admin-system-symbol">DEV</span>
                  <div>
                    <strong>Fridge devices</strong>
                    <span>
                      {stats.activeFridges} of {stats.fridges} connected
                    </span>
                  </div>
                </div>
                <span
                  className={`admin-system-status ${
                    stats.activeFridges === stats.fridges &&
                    stats.fridges > 0
                      ? "online"
                      : "warning"
                  }`}
                >
                  {stats.fridges > 0 &&
                  stats.activeFridges === stats.fridges
                    ? "ONLINE"
                    : "CHECK"}
                </span>
              </div>
            </div>

            <Link
              to="/dashboard/fridges"
              className="admin-system-footer"
            >
              Open device monitoring <span>→</span>
            </Link>
          </div>
        </section>

        <section className="admin-overview-panel admin-quick-actions">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">MANAGEMENT</span>
              <h2>Quick access</h2>
            </div>
          </div>

          <div className="admin-actions-grid">
            <Link to="/dashboard/inventory" className="admin-action">
              <span className="admin-action-number">01</span>
              <div>
                <strong>Inventory</strong>
                <span>Manage products and stock</span>
              </div>
              <span className="admin-action-arrow">↗</span>
            </Link>

            <Link to="/dashboard/users" className="admin-action">
              <span className="admin-action-number">02</span>
              <div>
                <strong>Customers</strong>
                <span>Manage customer accounts</span>
              </div>
              <span className="admin-action-arrow">↗</span>
            </Link>

            <Link to="/dashboard/fridges" className="admin-action">
              <span className="admin-action-number">03</span>
              <div>
                <strong>Fridge monitoring</strong>
                <span>Monitor temperature and humidity</span>
              </div>
              <span className="admin-action-arrow">↗</span>
            </Link>

            <Link to="/dashboard/reports" className="admin-action">
              <span className="admin-action-number">04</span>
              <div>
                <strong>Reports</strong>
                <span>View store performance</span>
              </div>
              <span className="admin-action-arrow">↗</span>
            </Link>
          </div>
        </section>

        <footer className="admin-overview-footer">
          <span>SMART TCG STORE</span>
          <span>ADMINISTRATION / CONTROL PANEL</span>
        </footer>
      </div>
    </main>
  );
}