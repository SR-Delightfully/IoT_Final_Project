import { useEffect, useState } from "react";
import Fridge from "../components/Fridge";
import Header from "../layout/header";

const API = "http://localhost:5050";
const REFRESH_MS = 2000;

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function normalizeList(data, keys = []) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function Stat({ label, value, detail, status = "" }) {
  return (
    <article className={`dashboard-stat ${status}`}>
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-detail">{detail}</span>
    </article>
  );
}

function AlertCenter({ alerts, onAcknowledge, busyIds }) {
  const activeAlerts = alerts.filter(
    (alert) =>
      !["acknowledged", "resolved", "closed"].includes(
        String(alert.alert_status ?? "").toLowerCase()
      )
  );

  return (
    <section className="dashboard-panel" id="alerts">
      <header className="dashboard-panel-header">
        <div>
          <span className="dashboard-eyebrow">02 / SYSTEM EVENTS</span>
          <h2>Alert center</h2>
        </div>
        <span className="dashboard-count">{activeAlerts.length} ACTIVE</span>
      </header>

      {activeAlerts.length === 0 ? (
        <p className="dashboard-empty">No active alerts reported.</p>
      ) : (
        <div className="dashboard-list">
          {activeAlerts.map((alert) => (
            <article className="dashboard-alert" key={alert.alert_id}>
              <span className="dashboard-alert-indicator" />
              <div className="dashboard-list-content">
                <strong>{alert.alert_message || alert.alert_type || "Fridge alert"}</strong>
                <span>
                  {alert.fridge_name || `Fridge ${alert.fridge_id}`}
                  {alert.alert_value != null && ` · Value: ${alert.alert_value}`}
                  {alert.alert_condition && ` · ${alert.alert_condition}`}
                </span>
                <time>
                  {alert.alert_created_at
                    ? new Date(alert.alert_created_at).toLocaleString()
                    : "Time unavailable"}
                </time>
              </div>
              <button
                type="button"
                className="dashboard-action"
                disabled={busyIds.includes(alert.alert_id)}
                onClick={() => onAcknowledge(alert.alert_id)}
              >
                Acknowledge
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NotificationCenter({ notifications, onRead, busyIds }) {
  const unread = notifications.filter(
    (notification) =>
      !notification.notification_read_at &&
      !["read"].includes(
        String(notification.notification_status ?? "").toLowerCase()
      )
  );

  return (
    <section className="dashboard-panel" id="notifications">
      <header className="dashboard-panel-header">
        <div>
          <span className="dashboard-eyebrow">03 / MESSAGE LOG</span>
          <h2>Notifications</h2>
        </div>
        <span className="dashboard-count">{unread.length} UNREAD</span>
      </header>

      {notifications.length === 0 ? (
        <p className="dashboard-empty">No notifications returned by the API.</p>
      ) : (
        <div className="dashboard-list">
          {notifications.map((notification) => {
            const isUnread =
              !notification.notification_read_at &&
              String(notification.notification_status ?? "").toLowerCase() !== "read";

            return (
              <article
                className={`dashboard-notification ${isUnread ? "is-unread" : ""}`}
                key={notification.notification_id}
              >
                <span className="dashboard-notification-indicator" />
                <div className="dashboard-list-content">
                  <strong>
                    {notification.notification_type || "Notification"}
                  </strong>
                  <span>
                    {notification.alert_message ||
                      notification.message ||
                      `Alert #${notification.alert_id ?? "—"}`}
                  </span>
                  <span>
                    Status: {notification.notification_status || "unknown"}
                    {notification.notification_sent_at &&
                      ` · Sent ${new Date(
                        notification.notification_sent_at
                      ).toLocaleString()}`}
                  </span>
                </div>
                {isUnread && (
                  <button
                    type="button"
                    className="dashboard-action"
                    disabled={busyIds.includes(notification.notification_id)}
                    onClick={() => onRead(notification.notification_id)}
                  >
                    Mark read
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Dashboard() {
  const [fridges, setFridges] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertError, setAlertError] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyAlertIds, setBusyAlertIds] = useState([]);
  const [busyNotificationIds, setBusyNotificationIds] = useState([]);

  useEffect(() => {
    let active = true;
    let timer;

    async function refreshDashboard() {
      const results = await Promise.allSettled([
        fetchJson("/fridges"),
        fetchJson("/alerts"),
        fetchJson("/notifications"),
      ]);

      if (!active) return;

      const [fridgeResult, alertResult, notificationResult] = results;

      if (fridgeResult.status === "fulfilled") {
        setFridges(
          normalizeList(fridgeResult.value, ["fridges", "data"])
        );
        setError("");
      } else {
        setError("Unable to load fridges. Check the backend connection.");
      }

      if (alertResult.status === "fulfilled") {
        setAlerts(normalizeList(alertResult.value, ["alerts", "data"]));
        setAlertError("");
      } else {
        setAlertError("Alerts endpoint unavailable.");
      }

      if (notificationResult.status === "fulfilled") {
        setNotifications(
          normalizeList(notificationResult.value, ["notifications", "data"])
        );
        setNotificationError("");
      } else {
        setNotificationError("Notifications endpoint unavailable.");
      }

      setLastUpdated(new Date());
      setLoading(false);
    }

    refreshDashboard();
    timer = setInterval(refreshDashboard, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function updateRecord(path, method, setBusyIds, id, body = {}) {
    setBusyIds((current) => [...current, id]);

    try {
      const response = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Request failed");

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) await response.json();

      await Promise.resolve();
      return true;
    } catch {
      return false;
    } finally {
      setBusyIds((current) => current.filter((item) => item !== id));
    }
  }

  async function acknowledgeAlert(id) {
    const success = await updateRecord(
      `/alerts/${id}/acknowledge`,
      "POST",
      setBusyAlertIds,
      id
    );

    if (success) {
      setAlerts((current) =>
        current.map((alert) =>
          alert.alert_id === id
            ? { ...alert, alert_status: "acknowledged" }
            : alert
        )
      );
    } else {
      window.alert("Could not acknowledge this alert.");
    }
  }

  async function markNotificationRead(id) {
    const success = await updateRecord(
      `/notifications/${id}/read`,
      "PUT",
      setBusyNotificationIds,
      id
    );

    if (success) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.notification_id === id
            ? {
                ...notification,
                notification_status: "read",
                notification_read_at: new Date().toISOString(),
              }
            : notification
        )
      );
    } else {
      window.alert("Could not mark this notification as read.");
    }
  }

  const activeAlerts = alerts.filter(
    (alert) =>
      !["acknowledged", "resolved", "closed"].includes(
        String(alert.alert_status ?? "").toLowerCase()
      )
  );

  const unreadNotifications = notifications.filter(
    (notification) =>
      !notification.notification_read_at &&
      String(notification.notification_status ?? "").toLowerCase() !== "read"
  );

  if (loading) {
    return <main className="fridge-page"><p>Loading dashboard...</p></main>;
  }

  return (
    <main className="fridge-page dashboard-page">
      <Header
        eyebrow="SMART TCG STORE / CONTROL ROOM"
        title="System dashboard"
        subtitle="Monitor fridge conditions, manage thresholds, and review system alerts"
        misc={`Last updated: ${lastUpdated.toLocaleTimeString()}`}
      >
      </Header>


      <section className="dashboard-stats" aria-label="System overview">
        <Stat
          label="REGISTERED FRIDGES"
          value={fridges.length}
          detail="Connected to database"
        />
        <Stat
          label="ACTIVE ALERTS"
          value={activeAlerts.length}
          detail={alertError || "Require attention"}
          status={activeAlerts.length ? "has-warning" : ""}
        />
        <Stat
          label="UNREAD NOTIFICATIONS"
          value={unreadNotifications.length}
          detail={notificationError || "Notification queue"}
          status={unreadNotifications.length ? "has-warning" : ""}
        />
      </section>

      <AlertCenter
        alerts={alerts}
        onAcknowledge={acknowledgeAlert}
        busyIds={busyAlertIds}
      />

      {alertError && (
        <p className="dashboard-error">{alertError}</p>
      )}

      <NotificationCenter
        notifications={notifications}
        onRead={markNotificationRead}
        busyIds={busyNotificationIds}
      />

      {notificationError && (
        <p className="dashboard-error">{notificationError}</p>
      )}

      <section className="dashboard-panel" id="fridges">
        <header className="dashboard-panel-header">
          <div>
            <span className="dashboard-eyebrow">04 / HARDWARE MANAGEMENT</span>
            <h2>Fridge systems</h2>
          </div>
          <span className="dashboard-count">{fridges.length} UNITS</span>
        </header>

        {fridges.length === 0 ? (
          <p className="dashboard-empty">
            {error || "No fridges are currently available."}
          </p>
        ) : (
          <div className="fridge-grid">
            {fridges.map((fridge) => (
              <Fridge key={fridge.fridge_id} fridge={fridge} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;