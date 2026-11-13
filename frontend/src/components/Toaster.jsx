import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Pop-up notifications.
// Wrap the app in <ToastProvider>, then in any page:
//   const toast = useToast();
//   toast.success("Saved!");   toast.error("Something went wrong");   toast.info("FYI");
//
// Before a full page change (window.location.href = ...), use
//   flashToast("success", "Welcome back!")
// and the pop-up shows on the next page instead.

const ToastContext = createContext(null);

const ICONS = { success: "✓", error: "!", info: "i" };
const DURATION = { success: 4000, info: 4000, error: 6000 };
const FLASH_KEY = "toast_flash";

export function flashToast(type, message) {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message }));
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message) => {
      if (!message) return;
      const id = nextId.current++;

      // the same message twice in a row just restarts instead of stacking
      setToasts((list) => [...list.filter((t) => t.message !== message), { id, type, message }].slice(-4));
      setTimeout(() => dismiss(id), DURATION[type]);
    },
    [dismiss],
  );

  // show a message saved by flashToast() on the previous page
  useEffect(() => {
    const saved = sessionStorage.getItem(FLASH_KEY);
    if (!saved) return;
    sessionStorage.removeItem(FLASH_KEY);

    try {
      const { type, message } = JSON.parse(saved);
      show(DURATION[type] ? type : "info", message);
    } catch {
      // ignore a malformed value
    }
  }, [show]);

  const toast = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === "error" ? "alert" : "status"}>
            <span className="toast-icon">{ICONS[t.type]}</span>
            <p className="toast-message">{t.message}</p>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}

// For pages that keep a { error, success } status object: pops up whichever
// message is set, every time the status is updated.
export function useStatusToasts(status) {
  const toast = useToast();

  useEffect(() => {
    if (status?.error) toast.error(status.error);
    if (status?.success) toast.success(status.success);
  }, [status, toast]);
}
