// Turn a stored notification into a title and message in the visitor's language.
// notification_data = { kind, ...values }; the English columns are the fallback.

function money(value, locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "CAD" }).format(value);
}

export function describeNotification(n, t, locale) {
  const d = n.notification_data || {};

  switch (d.kind) {
    case "purchase":
      return {
        title: t("Purchase confirmed"),
        message: t("Receipt {receipt}: {total}, {points} point(s) earned.", {
          receipt: d.receipt,
          total: money(d.total, locale),
          points: d.points,
        }),
      };
    case "reward":
      return {
        title: t("Reward redeemed"),
        message: t("{reward} for {points} points. {balance} points left.", d),
      };
    case "low_stock":
      return {
        title: t("Low stock: {product}", d),
        message: t("{product} is down to {quantity} in stock.", d),
      };
    case "fridge_alert":
      return {
        title: t("Fridge alert: {fridge}", d),
        message: t("{fridge} is at {temperature}°C (max {max}°C).", d),
      };
    case "alert_email_failed":
      return {
        title: t("Alert email failed"),
        message: t("The alert email for {fridge} reached {sent} of {total} address(es).", d),
      };
    default:
      return {
        title: t(n.notification_title || "Notification"),
        message: t(n.notification_message_brief || ""),
      };
  }
}

// SQLite CURRENT_TIMESTAMP is UTC without a zone: "2026-11-27 14:03:22"
export function parseDbTime(value) {
  if (!value) return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timeAgo(date, t, locale) {
  if (!date) return "";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return t("just now");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("{n} min ago", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("{n} h ago", { n: hours });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
