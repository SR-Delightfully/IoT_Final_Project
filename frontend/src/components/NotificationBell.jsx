import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { authHeaders } from "../utils/auth";
import { useI18n } from "../utils/i18n";
import { describeNotification, parseDbTime, timeAgo } from "../utils/notifications";
import useClickAway from "../utils/useClickAway";
import { useToast } from "./Toaster";

const API = import.meta.env.VITE_API_URL;
const POLL_MS = 10000;

// Navbar bell: the signed-in user's notifications (fridge alerts and low stock
// for admins, purchase confirmations and rewards for customers).
function NotificationBell() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  // ids already shown, so only notifications that arrive later pop up
  const seen = useRef(null);

  useClickAway(ref, () => setOpen(false));

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/me/notifications`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();

      if (seen.current) {
        data.notifications
          .filter((n) => !n.notification_read_at && !seen.current.has(n.notification_id))
          .slice(0, 3)
          .forEach((n) => toast.info(describeNotification(n, t, locale).title));
      }
      seen.current = new Set(data.notifications.map((n) => n.notification_id));

      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // backend offline: keep the last list
    }
  }, [toast, t, locale]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function markRead(path) {
    await fetch(`${API}${path}`, { method: "PUT", headers: authHeaders() }).catch(() => {});
    load();
  }

  function openNotification(n) {
    if (!n.notification_read_at) markRead(`/me/notifications/${n.notification_id}/read`);
    setOpen(false);
    if (n.notification_link) navigate(n.notification_link);
  }

  return (
    <div className="nav-tool" ref={ref}>
      <button
        type="button"
        className="nav-tool-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("Notifications ({count} unread)", { count: unread })}
        title={t("Notifications")}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="nav-popover bell-popover" role="dialog" aria-label={t("Notifications")}>
          <header className="bell-header">
            <span className="nav-popover-title">{t("Notifications")}</span>
            <button
              type="button"
              className="bell-mark-all"
              disabled={unread === 0}
              onClick={() => markRead("/me/notifications/read-all")}
            >
              {t("Mark all read")}
            </button>
          </header>

          {items.length === 0 ? (
            <p className="bell-empty">{t("You're all caught up.")}</p>
          ) : (
            <ul className="bell-list">
              {items.slice(0, 20).map((n) => {
                const { title, message } = describeNotification(n, t, locale);
                const isUnread = !n.notification_read_at;
                return (
                  <li key={n.notification_id}>
                    <button
                      type="button"
                      className={`bell-item bell-item-${n.notification_data?.kind || "other"} ${isUnread ? "is-unread" : ""}`}
                      onClick={() => openNotification(n)}
                    >
                      <span className="bell-item-dot" aria-hidden="true" />
                      <span className="bell-item-text">
                        <strong>{title}</strong>
                        <span>{message}</span>
                        <time>{timeAgo(parseDbTime(n.notification_created_at), t, locale)}</time>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
