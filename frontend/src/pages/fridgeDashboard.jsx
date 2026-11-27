import { useEffect, useRef, useState } from "react";
import Fridge from "../components/Fridge";
import EnvironmentSensor from "../components/EnvironmentSensor";
import { useToast } from "../components/Toaster";
import Header from "../layout/header";
import { authHeaders } from "../utils/auth";
import { parseDbTime } from "../utils/time";
import { useI18n } from "../utils/i18n";

const API = "http://localhost:5050";
const REFRESH_MS = 2000;

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
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
  const { t, locale } = useI18n();
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
          <span className="dashboard-eyebrow">{t("02 / SYSTEM EVENTS")}</span>
          <h2>{t("Alert center")}</h2>
        </div>
        <span className="dashboard-count">{activeAlerts.length} {t("ACTIVE")}</span>
      </header>

      {activeAlerts.length === 0 ? (
        <p className="dashboard-empty">{t("No active alerts reported.")}</p>
      ) : (
        <div className="dashboard-list">
          {activeAlerts.map((alert) => (
            <article className="dashboard-alert" key={alert.alert_id}>
              <span className="dashboard-alert-indicator" />
              <div className="dashboard-list-content">
                <strong>{t(alert.alert_message) || alert.alert_type || t("Fridge alert")}</strong>
                <span>
                  {alert.fridge_name || t("Fridge {0}", { 0: alert.fridge_id })}
                  {alert.alert_value != null && t(" · Value: {0}", { 0: alert.alert_value })}
                  {alert.alert_condition && ` · ${t(CONDITION_LABELS[alert.alert_condition] || alert.alert_condition)}`}
                </span>
                <time>
                  {alert.alert_created_at
                    ? parseDbTime(alert.alert_created_at).toLocaleString(locale)
                    : t("Time unavailable")}
                </time>
              </div>
              <button
                type="button"
                className="dashboard-action"
                disabled={busyIds.includes(alert.alert_id)}
                onClick={() => onAcknowledge(alert.alert_id)}
              >
                {t("Acknowledge")}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// Readable names for the condition codes mqttProj stores on an alert
const CONDITION_LABELS = { ABOVE_MAX: "Above maximum", BELOW_MIN: "Below minimum" };
const STATUS_LABELS = { PENDING: "Pending", SENT: "Sent", READ: "Read", FAILED: "Failed" };
const NOTIFICATION_TYPES = { ALERT: "Dashboard alert", EMAIL: "Alert email", SYSTEM: "System" };

function NotificationCenter({ notifications, onRead, busyIds }) {
  const { t, locale } = useI18n();
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
          <span className="dashboard-eyebrow">{t("03 / MESSAGE LOG")}</span>
          <h2>{t("Notifications")}</h2>
        </div>
        <span className="dashboard-count">{unread.length} {t("UNREAD")}</span>
      </header>

      {notifications.length === 0 ? (
        <p className="dashboard-empty">{t("No fridge alert notifications yet.")}</p>
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
                    {notification.fridge_name || t("Fridge alert")}
                    {" · "}
                    {t(NOTIFICATION_TYPES[notification.notification_type] || "Notification")}
                  </strong>
                  <span>{t(notification.alert_message || notification.notification_message_brief)}</span>
                  <span>
                    {notification.notification_type === "EMAIL" && notification.user_email
                      ? `${notification.user_email} · `
                      : ""}
                    {t(STATUS_LABELS[notification.notification_status] || "unknown")}
                    {notification.notification_sent_at &&
                      ` · ${parseDbTime(notification.notification_sent_at).toLocaleString(locale)}`}
                  </span>
                </div>
                {isUnread && (
                  <button
                    type="button"
                    className="dashboard-action"
                    disabled={busyIds.includes(notification.notification_id)}
                    onClick={() => onRead(notification.notification_id)}
                  >
                    {t("Mark read")}
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

const CLOSED_ALERT_STATUSES = ["acknowledged", "resolved", "closed"];

function FridgeDashboard() {
  const { t, locale } = useI18n();
  const toast = useToast();
  // alert ids already seen, so only alerts that appear after the page loads pop up
  const seenAlertIds = useRef(null);
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
  const [busyFanIds, setBusyFanIds] = useState([]);
  const [savingLimitIds, setSavingLimitIds] = useState([]);

  // PUT a JSON body and return the parsed reply (throws with the backend's message).
  async function putJson(path, body) {
    const response = await fetch(`${API}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? t("Log in as an admin to change fridge settings.")
          : t(data.error || "Request failed")
      );
    }
    return data;
  }

  async function toggleFan(fridge, on) {
    setBusyFanIds((current) => [...current, fridge.fridge_id]);
    try {
      await putJson(`/fridges/${fridge.fridge_id}/fan`, { on });
      setFridges((current) =>
        current.map((f) =>
          f.fridge_id === fridge.fridge_id
            ? { ...f, fridge_fan_on: on ? 1 : 0, fridge_fan_source: on ? "dashboard" : null }
            : f
        )
      );
      toast.success(
        t(on ? "{name}: fan turned on." : "{name}: fan turned off.", { name: fridge.fridge_name })
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyFanIds((current) => current.filter((id) => id !== fridge.fridge_id));
    }
  }

  async function saveLimits(fridge, limits) {
    setSavingLimitIds((current) => [...current, fridge.fridge_id]);
    try {
      const data = await putJson(`/fridges/${fridge.fridge_id}/threshold`, limits);
      setFridges((current) =>
        current.map((f) =>
          f.fridge_id === fridge.fridge_id ? { ...f, ...(data.fridge || limits) } : f
        )
      );
      toast.success(t("{name}: limits saved.", { name: fridge.fridge_name }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingLimitIds((current) => current.filter((id) => id !== fridge.fridge_id));
    }
  }

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
        const alertList = normalizeList(alertResult.value, ["alerts", "data"]);

        if (seenAlertIds.current) {
          alertList
            .filter((alert) => !seenAlertIds.current.has(alert.alert_id))
            .filter((alert) => !CLOSED_ALERT_STATUSES.includes(String(alert.alert_status ?? "").toLowerCase()))
            .forEach((alert) =>
              toast.error(
                t("{fridge}: {message}", {
                  fridge: alert.fridge_name || t("Fridge {0}", { 0: alert.fridge_id }),
                  message: t(alert.alert_message || alert.alert_type || "New alert"),
                })
              )
            );
        }
        seenAlertIds.current = new Set(alertList.map((alert) => alert.alert_id));

        setAlerts(alertList);
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
  }, [toast, t]);

  async function updateRecord(path, method, setBusyIds, id, body = {}) {
    setBusyIds((current) => [...current, id]);

    try {
      const response = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
      toast.success("Alert acknowledged.");
    } else {
      toast.error("Could not acknowledge this alert.");
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
      toast.error("Could not mark this notification as read.");
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
    return <main className="fridge-page"><p>{t("Loading dashboard...")}</p></main>;
  }

  return (
    <main className="fridge-page dashboard-page">
      <Header
        eyebrow={t("SMART TCG STORE / CONTROL ROOM")}
        title={t("System dashboard")}
        subtitle={t("Monitor fridge conditions, manage thresholds, and review system alerts")}
        misc={t("Last updated: {0}", { 0: lastUpdated.toLocaleTimeString(locale) })}
      >
      </Header>


      <section className="dashboard-stats" aria-label={t("System overview")}>
        <Stat
          label={t("REGISTERED FRIDGES")}
          value={fridges.length}
          detail={t("Connected to database")}
        />
        <Stat
          label={t("ACTIVE ALERTS")}
          value={activeAlerts.length}
          detail={t(alertError || "Require attention")}
          status={activeAlerts.length ? "has-warning" : ""}
        />
        <Stat
          label={t("UNREAD NOTIFICATIONS")}
          value={unreadNotifications.length}
          detail={t(notificationError || "Notification queue")}
          status={unreadNotifications.length ? "has-warning" : ""}
        />
      </section>

      <AlertCenter
        alerts={alerts}
        onAcknowledge={acknowledgeAlert}
        busyIds={busyAlertIds}
      />

      {alertError && (
        <p className="dashboard-error">{t(alertError)}</p>
      )}

      <NotificationCenter
        notifications={notifications}
        onRead={markNotificationRead}
        busyIds={busyNotificationIds}
      />

      {notificationError && (
        <p className="dashboard-error">{t(notificationError)}</p>
      )}

      <section className="dashboard-panel" id="fridges">
        <header className="dashboard-panel-header">
          <div>
            <span className="dashboard-eyebrow">{t("04 / HARDWARE MANAGEMENT")}</span>
            <h2>{t("Fridge systems")}</h2>
          </div>
          <span className="dashboard-count">{fridges.length} {t("UNITS")}</span>
        </header>

        <EnvironmentSensor fridges={fridges} />

        {fridges.length === 0 ? (
          <p className="dashboard-empty">
            {t(error) || t("No fridges are currently available.")}
          </p>
        ) : (
          <div className="fridge-grid">
            {fridges.map((fridge) => (
              <Fridge
                key={fridge.fridge_id}
                fridge={fridge}
                onToggleFan={toggleFan}
                onSaveLimits={saveLimits}
                fanBusy={busyFanIds.includes(fridge.fridge_id)}
                savingLimits={savingLimitIds.includes(fridge.fridge_id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default FridgeDashboard;