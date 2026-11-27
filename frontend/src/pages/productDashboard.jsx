import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../components/Toaster";
import { authHeaders } from "../utils/auth";
import { downloadInventoryCsv } from "../utils/reports";

const API = import.meta.env.VITE_API_URL;
const OTHER_CATEGORY = "__other";
const EMPTY_SCAN = { active: false, tags: [], new_count: 0 };

const EMPTY_FORM = {
  name: "",
  category: "",
  newCategory: "",
  price: "",
  upc: "",
  producer: "",
  image_url: "",
};

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function toCents(dollars) {
  const value = Number(dollars);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : NaN;
}

async function adminRequest(path, method = "GET", body, options = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

// Stock level from the product's category thresholds:
// at or below low = red, at or below moderate = yellow, above = green.
function stockLevel(p) {
  const qty = p.quantity_in_stock;
  if (qty <= 0) return { key: "empty", label: "Out of stock" };
  if (qty <= (p.category_low_threshold ?? 5)) return { key: "low", label: "Low stock" };
  if (qty <= (p.category_moderate_threshold ?? 15)) return { key: "moderate", label: "Moderate stock" };
  return { key: "ok", label: "In stock" };
}

function isLowStock(p) {
  return Boolean(p.product_active) && ["empty", "low"].includes(stockLevel(p).key);
}

// Edit the low / moderate stock levels for each category.
function StockLevelSettings({ categories, onSaved, onError }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  function value(c, field) {
    return drafts[c.category_id]?.[field] ?? c[field] ?? "";
  }

  function change(c, field, text) {
    setDrafts((current) => ({
      ...current,
      [c.category_id]: { ...current[c.category_id], [field]: text },
    }));
  }

  async function save(c) {
    const low = Number(value(c, "category_low_threshold"));
    const moderate = Number(value(c, "category_moderate_threshold"));

    if (!Number.isInteger(low) || !Number.isInteger(moderate) || low < 0 || moderate < 0) {
      onError(new Error("Stock levels must be whole numbers of 0 or more."));
      return;
    }
    if (low > moderate) {
      onError(new Error("The low level must not be above the moderate level."));
      return;
    }

    setSavingId(c.category_id);
    try {
      await adminRequest(`/admin/categories/${c.category_id}/thresholds`, "PUT", {
        low_threshold: low,
        moderate_threshold: moderate,
      });
      onSaved(c, low, moderate);
      setDrafts((current) => {
        const next = { ...current };
        delete next[c.category_id];
        return next;
      });
    } catch (err) {
      onError(err);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <details className="account-section stock-level-settings">
      <summary className="account-section-title">Stock alert levels by category</summary>
      <p className="points-next">
        <span className="inventory-stock-low">Red</span> at or below the low level,{" "}
        <span className="inventory-stock-moderate">yellow</span> at or below the moderate level,{" "}
        <span className="inventory-stock-ok">green</span> above it.
      </p>
      <div className="history-scroll">
        <table className="history-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Low (red)</th>
              <th>Moderate (yellow)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.category_id}>
                <td>{c.category_name}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="stock-level-input"
                    aria-label={`${c.category_name} low stock level`}
                    value={value(c, "category_low_threshold")}
                    onChange={(e) => change(c, "category_low_threshold", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="stock-level-input"
                    aria-label={`${c.category_name} moderate stock level`}
                    value={value(c, "category_moderate_threshold")}
                    onChange={(e) => change(c, "category_moderate_threshold", e.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="dashboard-btn-small dashboard-btn-secondary"
                    disabled={savingId === c.category_id || !drafts[c.category_id]}
                    onClick={() => save(c)}
                  >
                    {savingId === c.category_id ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function findByUpc(products, upc) {
  const value = upc.trim();
  return value ? products.find((p) => p.product_upc === value) : undefined;
}

function productToForm(p) {
  return {
    ...EMPTY_FORM,
    name: p.product_name,
    category: p.product_category || "",
    price: (p.product_price_cents / 100).toFixed(2),
    upc: p.product_upc || "",
    producer: p.product_producer_company || "",
    image_url: p.product_image_url || "",
  };
}

function formToPayload(form) {
  return {
    name: form.name,
    category: form.category === OTHER_CATEGORY ? form.newCategory : form.category,
    price: toCents(form.price),
    upc: form.upc,
    producer: form.producer,
    image_url: form.image_url,
  };
}

// Admin stock-scan mode: while active, the RFID reader's tags are collected
// by the backend and shown here instead of going to the self-checkout.
function useTagScan(onError) {
  const [scan, setScan] = useState(EMPTY_SCAN);
  const activeRef = useRef(false);

  const call = useCallback(
    async (path, method = "POST", options) => {
      try {
        const data = await adminRequest(path, method, undefined, options);
        activeRef.current = data.active;
        setScan(data);
        return data;
      } catch (err) {
        onError(err);
        return null;
      }
    },
    [onError],
  );

  useEffect(() => {
    if (!scan.active) return;
    const interval = window.setInterval(() => call("/admin/scan", "GET"), 1000);
    return () => window.clearInterval(interval);
  }, [scan.active, call]);

  // Leaving the page hands the reader back to the self-checkout.
  useEffect(
    () => () => {
      if (activeRef.current) {
        adminRequest("/admin/scan/stop", "POST", undefined, { keepalive: true }).catch(() => { });
      }
    },
    [],
  );

  const reset = useCallback(async () => {
    await call("/admin/scan/stop");
    await call("/admin/scan/clear");
  }, [call]);

  return {
    scan,
    newEpcs: scan.tags.filter((t) => t.status === "new").map((t) => t.epc),
    start: () => call("/admin/scan/start"),
    stop: () => call("/admin/scan/stop"),
    clear: () => call("/admin/scan/clear"),
    remove: (epc) => call(`/admin/scan/tags/${encodeURIComponent(epc)}`, "DELETE"),
    reset,
  };
}

function ScanPanel({ tagScan, supplier, onSupplierChange }) {
  const { scan, start, stop, clear, remove } = tagScan;
  const registered = scan.tags.filter((t) => t.status === "registered");
  const fresh = scan.tags.filter((t) => t.status === "new");

  return (
    <div className="dashboard-scan">
      <div className="dashboard-scan-bar">
        {scan.active ? (
          <button type="button" className="dashboard-btn-small" onClick={stop}>
            Stop scanning
          </button>
        ) : (
          <button type="button" className="dashboard-btn-small" onClick={start}>
            Start scanning
          </button>
        )}
        <button
          type="button"
          className="dashboard-btn-small dashboard-btn-secondary"
          onClick={clear}
          disabled={!scan.tags.length}
        >
          Clear
        </button>
        <span className={`dashboard-scan-status ${scan.active ? "is-active" : ""}`}>
          {scan.active ? "Reader is scanning tags..." : "Reader idle"}
        </span>
        <span className="dashboard-scan-count">{fresh.length} new tag(s)</span>
      </div>

      {fresh.length > 0 && (
        <ul className="dashboard-tag-list">
          {fresh.map((tag) => (
            <li key={tag.epc}>
              <span className="dashboard-subtext">{tag.epc}</span>
              <button
                type="button"
                className="dashboard-tag-remove"
                onClick={() => remove(tag.epc)}
                aria-label={`Remove ${tag.epc}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {registered.length > 0 && (
        <div className="dashboard-error">
          Skipped {registered.length} tag(s) already registered:
          <ul className="dashboard-tag-list">
            {registered.map((tag) => (
              <li key={tag.epc}>
                <span className="dashboard-subtext">{tag.epc}</span> — {tag.product_name}
                <button
                  type="button"
                  className="dashboard-tag-remove"
                  onClick={() => remove(tag.epc)}
                  aria-label={`Remove ${tag.epc}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        className="dashboard-supplier"
        placeholder="Supplier (optional)"
        value={supplier}
        onChange={(e) => onSupplierChange(e.target.value)}
      />
    </div>
  );
}

function ProductForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
  categories,
  onUpcEnter,
  submitDisabled,
}) {
  const update = (e) => onChange({ ...form, [e.target.name]: e.target.value });
  const knownCategory =
    !form.category ||
    form.category === OTHER_CATEGORY ||
    categories.some((c) => c.category_name === form.category);

  return (
    <form className="dashboard-form" onSubmit={onSubmit}>
      <input name="name" placeholder="Name" value={form.name} onChange={update} required />
      <select name="category" value={form.category} onChange={update} required>
        <option value="" disabled>
          Category
        </option>
        {!knownCategory && <option value={form.category}>{form.category}</option>}
        {categories.map((c) => (
          <option key={c.category_id} value={c.category_name}>
            {c.category_name}
          </option>
        ))}
        <option value={OTHER_CATEGORY}>Other…</option>
      </select>
      {form.category === OTHER_CATEGORY && (
        <input
          name="newCategory"
          placeholder="New category name"
          value={form.newCategory}
          onChange={update}
          required
        />
      )}
      <input
        name="price"
        type="number"
        min="0"
        step="0.01"
        placeholder="Price ($)"
        value={form.price}
        onChange={update}
        required
      />
      <input
        name="upc"
        placeholder="UPC (scan or type 12-13 digits)"
        minLength={12}
        maxLength={13}
        value={form.upc}
        onChange={update}
        onKeyDown={(e) => {
          // Barcode scanners press Enter after the code; don't submit the form.
          if (e.key === "Enter" && onUpcEnter) {
            e.preventDefault();
            onUpcEnter(form.upc);
          }
        }}
        onBlur={() => onUpcEnter && onUpcEnter(form.upc)}
        required
      />
      <input
        name="producer"
        placeholder="Producer"
        value={form.producer}
        onChange={update}
        required
      />
      <input
        name="image_url"
        placeholder="Image URL (optional)"
        value={form.image_url}
        onChange={update}
      />
      <div className="dashboard-form-actions">
        <button type="submit" disabled={submitDisabled}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="dashboard-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ProductDashboard() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [denied, setDenied] = useState(!localStorage.getItem("token"));
  const toast = useToast();
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("receive");
  const [newProduct, setNewProduct] = useState(EMPTY_FORM);
  const [duplicate, setDuplicate] = useState(null);
  const [upcInput, setUpcInput] = useState("");
  const [upcMessage, setUpcMessage] = useState("");
  const [receiving, setReceiving] = useState(null);
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);


  // Remember the inventory search text and selected category.
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const upcRef = useRef(null);
  // Product ids already reported as low, so the toast only fires for new ones.
  const knownLowIds = useRef(null);

  const handleError = useCallback(
    (err) => {
      if (err.status === 403) {
        setDenied(true);
      } else {
        toast.error(err.message);
      }
    },
    [toast],
  );

  const tagScan = useTagScan(handleError);

  // Load product details, stock, restocking dates and category choices.
  const loadProducts = useCallback(() => {
    adminRequest("/admin/products")
      .then((data) => {
        setProducts(data);
        setDenied(false);
        setLoadError("");
      })
      .catch((err) => {
        if (err.status !== 403) setLoadError(err.message);
        handleError(err);
      });

    adminRequest("/admin/categories")
      .then(setCategories)
      .catch(() => { });
  }, [handleError]);

  // Toast when a product newly drops to low stock (e.g. after a checkout).
  useEffect(() => {
    if (!products) return;
    const lowNow = products.filter(isLowStock);

    if (knownLowIds.current) {
      lowNow
        .filter((p) => !knownLowIds.current.has(p.product_id))
        .forEach((p) =>
          toast.error(`Low stock: ${p.product_name} (${p.quantity_in_stock} left)`)
        );
    }
    knownLowIds.current = new Set(lowNow.map((p) => p.product_id));
  }, [products, toast]);

  // Refresh inventory every five seconds while this page is open.
  useEffect(() => {
    if (!localStorage.getItem("token")) return;

    loadProducts();

    const interval = setInterval(loadProducts, 5000);

    return () => clearInterval(interval);
  }, [loadProducts]);

  useEffect(() => {
    if (mode === "receive" && !receiving) upcRef.current?.focus();
  }, [mode, receiving, products]);

  const replaceProduct = (updated) =>
    setProducts((list) =>
      list.map((p) => (p.product_id === updated.product_id ? updated : p)),
    );

  const succeed = (text) => toast.success(text);

  const resetBatch = async () => {
    setSupplier("");
    await tagScan.reset();
  };

  const switchMode = async (next, product = null) => {
    await resetBatch();
    setMode(next);
    setDuplicate(null);
    setUpcMessage("");
    setUpcInput("");
    setReceiving(product);
  };

  // ---------- Receive stock of an existing product ----------

  const selectByUpc = (e) => {
    e.preventDefault();
    const product = findByUpc(products, upcInput);
    if (!product) {
      setUpcMessage(`No product has UPC ${upcInput.trim()}.`);
      return;
    }
    setReceiving(product);
    setUpcMessage("");
    setUpcInput("");
  };

  const confirmReceive = async () => {
    const epcs = tagScan.newEpcs;
    if (!receiving || !epcs.length) return;
    setSaving(true);
    try {
      const updated = await adminRequest(
        `/admin/products/${receiving.product_id}/receive`,
        "POST",
        { epcs, supplier },
      );
      replaceProduct(updated);
      succeed(`Received ${updated.received} × ${updated.product_name}.`);
      await switchMode("receive");
    } catch (err) {
      handleError(err);
      tagScan.stop();
    } finally {
      setSaving(false);
    }
  };

  // ---------- Add a new product ----------

  const checkUpc = (upc) => {
    setDuplicate(findByUpc(products, upc) || null);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const existing = findByUpc(products, newProduct.upc);
    if (existing) {
      setDuplicate(existing);
      return;
    }
    setSaving(true);
    try {
      const created = await adminRequest("/admin/products", "POST", {
        ...formToPayload(newProduct),
        epcs: tagScan.newEpcs,
        supplier,
      });
      setProducts((list) => [...list, created]);
      setNewProduct(EMPTY_FORM);
      succeed(`Added ${created.product_name} with ${created.quantity_in_stock} in stock.`);
      await resetBatch();
      loadProducts();
    } catch (err) {
      handleError(err);
      tagScan.stop();
    } finally {
      setSaving(false);
    }
  };

  // ---------- Inventory table ----------

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const updated = await adminRequest(
        `/admin/products/${editingId}`,
        "PUT",
        formToPayload(editForm),
      );
      replaceProduct(updated);
      setEditingId(null);
      succeed(`Saved ${updated.product_name}.`);
      loadProducts();
    } catch (err) {
      handleError(err);
    }
  };

  const toggleActive = async (p) => {
    try {
      const updated = await adminRequest(`/admin/products/${p.product_id}`, "PUT", {
        active: !p.product_active,
      });
      replaceProduct(updated);
      succeed(`${updated.product_name} is now ${updated.product_active ? "visible" : "hidden"}.`);
    } catch (err) {
      handleError(err);
    }
  };

  if (denied) {
    return (
      <main className="products-page">
        <div className="products-card">
          <div className="products-card-body">
            <h1 className="products-title">Access Denied</h1>
            <p className="products-message">Only admins can view the product dashboard.</p>
          </div>
        </div>
        <div className="products-links">
          <a href="/products">View products</a>
        </div>
      </main>
    );
  }
  // List each category once for the dropdown.
  const inventoryCategories = [
    ...new Set((products || []).map((p) => p.product_category).filter(Boolean)),
  ].sort();

  // Filter the displayed products by name and category.
  const filteredProducts = (products || []).filter((p) =>
    p.product_name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (category === "" || p.product_category === category)
  );

  const totalStock = (products || []).reduce((sum, p) => sum + p.quantity_in_stock, 0);
  const activeCount = (products || []).filter((p) => p.product_active).length;
  const outOfStock = (products || []).filter((p) => p.quantity_in_stock <= 0).length;
  // Visible products at or below their category's low level (includes out of stock).
  const lowStock = (products || []).filter(isLowStock);
  const newCount = tagScan.newEpcs.length;

  return (
    <main className="products-page">
      <div className="products-card dashboard-card">
        <div className="products-card-body">
          <h1 className="products-title">Product Dashboard</h1>

          <p className="products-subtitle">
            <i>manage the catalogue and stock.</i>
          </p>

          {!products ? (
            <p className="products-message">
              <i>{loadError ? "Could not load products." : "loading products..."}</i>
            </p>
          ) : (
            <>
              <section className="account-section">
                <h2 className="account-section-title">Overview</h2>
                <div className="points-summary">
                  <div className="points-stat">
                    <span className="form-label">Visible</span>
                    <span className="points-value">
                      {activeCount}/{products.length}
                    </span>
                  </div>
                  <div className="points-stat">
                    <span className="form-label">Units in stock</span>
                    <span className="points-value">{totalStock}</span>
                  </div>
                  <div className="points-stat">
                    <span className="form-label">Out of stock</span>
                    <span className="points-value">{outOfStock}</span>
                  </div>
                  <div className="points-stat">
                    <span className="form-label">Low stock</span>
                    <span className="points-value inventory-stock-low">{lowStock.length}</span>
                  </div>
                </div>
              </section>

              {lowStock.length > 0 && (
                <div className="low-stock-banner" role="alert">
                  <strong>
                    {lowStock.length} product{lowStock.length === 1 ? "" : "s"} low on stock:
                  </strong>{" "}
                  {lowStock
                    .slice(0, 6)
                    .map((p) => `${p.product_name} (${p.quantity_in_stock})`)
                    .join(", ")}
                  {lowStock.length > 6 && `, and ${lowStock.length - 6} more`}
                </div>
              )}

              <StockLevelSettings
                categories={categories}
                onSaved={(c, low, moderate) => {
                  // Show the saved values right away, then reload stock colours.
                  setCategories((current) =>
                    current.map((cat) =>
                      cat.category_id === c.category_id
                        ? { ...cat, category_low_threshold: low, category_moderate_threshold: moderate }
                        : cat
                    )
                  );
                  toast.success(`Stock levels saved for ${c.category_name}.`);
                  loadProducts();
                }}
                onError={handleError}
              />

              <section className="account-section">
                <h2 className="account-section-title">Add Products</h2>

                <div className="dashboard-mode">
                  <button
                    type="button"
                    className={`dashboard-btn-small ${mode === "receive" ? "" : "dashboard-btn-secondary"}`}
                    onClick={() => mode !== "receive" && switchMode("receive")}
                  >
                    Receiving stock of an existing product
                  </button>
                  <button
                    type="button"
                    className={`dashboard-btn-small ${mode === "new" ? "" : "dashboard-btn-secondary"}`}
                    onClick={() => mode !== "new" && switchMode("new")}
                  >
                    Adding a new product
                  </button>
                </div>

                {mode === "receive" && !receiving && (
                  <>
                    <form className="dashboard-stock dashboard-upc" onSubmit={selectByUpc}>
                      <input
                        ref={upcRef}
                        placeholder="Scan or type the product's UPC"
                        value={upcInput}
                        onChange={(e) => setUpcInput(e.target.value)}
                        autoComplete="off"
                      />
                      <button type="submit" className="dashboard-btn-small" disabled={!upcInput.trim()}>
                        Find
                      </button>
                    </form>
                    {upcMessage && (
                      <div className="dashboard-error">
                        {upcMessage}{" "}
                        <button
                          type="button"
                          className="dashboard-btn-small dashboard-btn-secondary"
                          onClick={async () => {
                            const upc = upcInput.trim();
                            await switchMode("new");
                            setNewProduct({ ...EMPTY_FORM, upc });
                          }}
                        >
                          Add it as a new product
                        </button>
                      </div>
                    )}
                  </>
                )}

                {mode === "receive" && receiving && (
                  <>
                    <div className="dashboard-selected">
                      <div>
                        <b>{receiving.product_name}</b>
                        <div className="dashboard-subtext">
                          UPC {receiving.product_upc} · {receiving.quantity_in_stock} in stock
                        </div>
                      </div>
                      <button
                        type="button"
                        className="dashboard-btn-small dashboard-btn-secondary"
                        onClick={() => switchMode("receive")}
                      >
                        Change product
                      </button>
                    </div>
                    <ScanPanel tagScan={tagScan} supplier={supplier} onSupplierChange={setSupplier} />
                    <div className="dashboard-form-actions">
                      <button
                        type="button"
                        className="dashboard-btn-small"
                        onClick={confirmReceive}
                        disabled={!newCount || saving}
                      >
                        Confirm receive ({newCount})
                      </button>
                    </div>
                  </>
                )}

                {mode === "new" && (
                  <>
                    <ProductForm
                      form={newProduct}
                      onChange={(form) => {
                        setNewProduct(form);
                        if (duplicate && form.upc !== newProduct.upc) setDuplicate(null);
                      }}
                      onSubmit={handleAdd}
                      submitLabel={`Create product (${newCount} tag${newCount === 1 ? "" : "s"})`}
                      submitDisabled={saving || Boolean(duplicate)}
                      categories={categories}
                      onUpcEnter={checkUpc}
                    />
                    {duplicate && (
                      <div className="dashboard-error">
                        {duplicate.product_name} already uses this UPC.{" "}
                        <button
                          type="button"
                          className="dashboard-btn-small dashboard-btn-secondary"
                          onClick={() => {
                            const product = duplicate;
                            setNewProduct(EMPTY_FORM);
                            switchMode("receive", product);
                          }}
                        >
                          Receive stock instead
                        </button>
                      </div>
                    )}
                    <ScanPanel tagScan={tagScan} supplier={supplier} onSupplierChange={setSupplier} />
                  </>
                )}
              </section>

              <section className="account-section">
                <h2 className="account-section-title">Inventory</h2>
                <button
                  type="button"
                  className="account-button inventory-export-button"
                  onClick={() => downloadInventoryCsv(filteredProducts)}
                  disabled={filteredProducts.length === 0}
                >
                  Download Inventory CSV
                </button>
                <div className="dashboard-form inventory-filters">
                  <div>
                    <label htmlFor="inventory-search">Search products</label>
                    <input
                      id="inventory-search"
                      type="search"
                      placeholder="Product name"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="inventory-category">Category</label>
                    <select
                      id="inventory-category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="">All categories</option>
                      {inventoryCategories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="history-scroll dashboard-scroll">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Last Restocked</th>
                        <th>Sold</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan={9}>No products match your filters.</td>
                        </tr>
                      )}
                      {filteredProducts.map((p) =>
                        editingId === p.product_id ? (
                          <tr key={p.product_id}>
                            <td colSpan={9}>
                              <ProductForm
                                form={editForm}
                                onChange={setEditForm}
                                onSubmit={handleSave}
                                submitLabel="Save"
                                onCancel={() => setEditingId(null)}
                                categories={categories}
                              />
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={p.product_id}
                            className={p.product_active ? "" : "dashboard-row-hidden"}
                          >
                            <td>{p.product_id}</td>
                            <td>
                              {p.product_name}
                              <div className="dashboard-subtext">{p.product_upc}</div>
                            </td>
                            <td>{p.product_category}</td>
                            <td>{formatPrice(p.product_price_cents)}</td>
                            <td>
                              <span
                                className={`inventory-stock-badge inventory-stock-${stockLevel(p).key}`}
                                title={`${stockLevel(p).label} (low ≤ ${p.category_low_threshold}, moderate ≤ ${p.category_moderate_threshold})`}
                              >
                                {p.quantity_in_stock}
                              </span>
                            </td>
                            <td>{p.last_restocked || "Never recorded"}</td>
                            <td>{p.total_sold}</td>
                            <td>
                              <button
                                type="button"
                                className="dashboard-btn-small dashboard-btn-secondary"
                                onClick={() => toggleActive(p)}
                              >
                                {p.product_active ? "Visible" : "Hidden"}
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="dashboard-btn-small dashboard-btn-secondary"
                                onClick={() => {
                                  setEditingId(p.product_id);
                                  setEditForm(productToForm(p));
                                }}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <div className="products-links">
        <a href="/products">View storefront</a>
        <a href="/home">Back to home</a>
      </div>
    </main>
  );
}

export default ProductDashboard;
