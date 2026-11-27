import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "../utils/auth";

const API = import.meta.env.VITE_API_URL || "http://localhost:5050";

function randomEpc() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Types a code into a field the way a USB barcode scanner does:
// the characters, then Enter.
async function typeIntoField(field, code) {
  field.focus();
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(field, code);
  field.dispatchEvent(new Event("input", { bubbles: true }));

  // Let React apply the new value before Enter is handled.
  await wait(50);

  const enter = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  const handled = !field.dispatchEvent(enter);

  if (!handled && field.form) {
    field.form.requestSubmit();
  }
}

// Stand-in for the RFID reader and the USB barcode scanner, for testing
// without the hardware.
function ScannerSimulator() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("rfid");
  const [catalog, setCatalog] = useState({ products: [], cards: [] });
  const [productId, setProductId] = useState("");
  const [newCount, setNewCount] = useState(1);
  const [customEpc, setCustomEpc] = useState("");
  const [barcode, setBarcode] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [status, setStatus] = useState("");
  const panelRef = useRef(null);
  const targetRef = useRef(null);
  const tagCursor = useRef({});

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch(`${API}/simulate/catalog`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load catalog");
      setCatalog(data);
    } catch (err) {
      setStatus(err.message);
    }
  }, []);

  useEffect(() => {
    if (open) loadCatalog();
  }, [open, loadCatalog]);

  // Remember the last text field used outside the simulator; that is where
  // the "barcode scanner" types.
  useEffect(() => {
    const onFocus = (event) => {
      const el = event.target;
      if (panelRef.current?.contains(el)) return;
      const isText =
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement &&
          ["text", "search", "number", "tel", ""].includes(el.type));
      if (!isText) return;
      targetRef.current = el;
      setTargetLabel(el.placeholder || el.name || el.id || "text field");
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);

  const sendTags = async (epcs) => {
    try {
      const res = await fetch(`${API}/simulate/rfid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ epcs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send tags");
      const where = {
        "stock-scan": "stock scan",
        checkout: "self-checkout",
        ignored: "nobody (no scan or sale is active)",
      }[data.routed_to];
      setStatus(`Read ${data.count} tag(s) → ${where}`);
    } catch (err) {
      setStatus(err.message);
    }
  };

  const product = catalog.products.find((p) => String(p.product_id) === productId);

  // Each tap uses the product's next unsold tag, like picking up another unit.
  const tapProductTag = () => {
    if (!product?.tags.length) {
      setStatus("This product has no unsold tags.");
      return;
    }
    const index = tagCursor.current[product.product_id] || 0;
    tagCursor.current[product.product_id] = (index + 1) % product.tags.length;
    sendTags([product.tags[index]]);
  };

  const tapAllProductTags = () => {
    if (!product?.tags.length) {
      setStatus("This product has no unsold tags.");
      return;
    }
    sendTags(product.tags);
  };

  const tapNewTags = () => {
    const count = Math.min(Math.max(Number(newCount) || 1, 1), 50);
    sendTags(Array.from({ length: count }, randomEpc));
  };

  const scanBarcode = async (code) => {
    const value = (code ?? barcode).trim();
    if (!value) return;
    const field = targetRef.current;
    if (!field || !document.contains(field)) {
      setStatus("Click the field to scan into first.");
      return;
    }
    await typeIntoField(field, value);
    setStatus(`Scanned ${value}`);
  };

  if (!open) {
    return (
      <button type="button" className="scanner-sim-toggle" onClick={() => setOpen(true)}>
        Scanner simulator
      </button>
    );
  }

  return (
    <aside className="scanner-sim" ref={panelRef}>
      <div className="scanner-sim-header">
        <b>Scanner simulator</b>
        <button type="button" onClick={loadCatalog} title="Reload products and tags">
          ↻
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close simulator">
          ×
        </button>
      </div>

      <div className="scanner-sim-tabs">
        <button
          type="button"
          className={tab === "rfid" ? "is-active" : ""}
          onClick={() => setTab("rfid")}
        >
          RFID reader
        </button>
        <button
          type="button"
          className={tab === "barcode" ? "is-active" : ""}
          onClick={() => setTab("barcode")}
        >
          Barcode scanner
        </button>
      </div>

      {tab === "rfid" && (
        <div className="scanner-sim-body">
          <label>
            New tags (receiving stock)
            <div className="scanner-sim-row">
              <input
                type="number"
                min="1"
                max="50"
                value={newCount}
                onChange={(e) => setNewCount(e.target.value)}
              />
              <button type="button" onClick={tapNewTags}>
                Read new tags
              </button>
            </div>
          </label>

          <label>
            Existing product tag (checkout)
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choose a product…</option>
              {catalog.products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.tags.length} tags)
                </option>
              ))}
            </select>
            <div className="scanner-sim-row">
              <button type="button" onClick={tapProductTag} disabled={!product}>
                Read one
              </button>
              <button type="button" onClick={tapAllProductTags} disabled={!product}>
                Read all {product ? product.tags.length : ""}
              </button>
            </div>
          </label>

          <label>
            Custom EPC
            <div className="scanner-sim-row">
              <input
                value={customEpc}
                placeholder="Hex, up to 24 chars"
                onChange={(e) => setCustomEpc(e.target.value)}
              />
              <button
                type="button"
                onClick={() => customEpc.trim() && sendTags([customEpc.trim()])}
              >
                Read
              </button>
            </div>
          </label>
        </div>
      )}

      {tab === "barcode" && (
        <div className="scanner-sim-body">
          <p className="scanner-sim-target">
            Types into: <b>{targetLabel || "click a text field first"}</b>
          </p>

          <label>
            Product UPC
            <select
              value=""
              onChange={(e) => e.target.value && scanBarcode(e.target.value)}
            >
              <option value="">Scan a product…</option>
              {catalog.products
                .filter((p) => p.barcode)
                .map((p) => (
                  <option key={p.product_id} value={p.barcode}>
                    {p.product_name} — {p.barcode}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Membership card
            <select
              value=""
              onChange={(e) => e.target.value && scanBarcode(e.target.value)}
            >
              <option value="">Scan a card…</option>
              {catalog.cards.map((card) => (
                <option key={card.code} value={card.code}>
                  {card.name} — {card.code}
                </option>
              ))}
            </select>
          </label>

          <label>
            Custom code
            <div className="scanner-sim-row">
              <input
                value={barcode}
                placeholder="Any barcode"
                onChange={(e) => setBarcode(e.target.value)}
              />
              <button type="button" onClick={() => scanBarcode()}>
                Scan
              </button>
            </div>
          </label>
        </div>
      )}

      {status && <p className="scanner-sim-status">{status}</p>}
    </aside>
  );
}

export default ScannerSimulator;
