import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/Toaster";
import { authHeaders } from "../utils/auth";

const API = import.meta.env.VITE_API_URL;

const EMPTY_FORM = {
  name: "",
  category: "",
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

async function adminRequest(path, method = "GET", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

function productToForm(p) {
  return {
    name: p.product_name,
    category: p.product_category,
    price: (p.product_price_cents / 100).toFixed(2),
    upc: p.product_upc,
    producer: p.product_producer_company,
    image_url: p.product_image_url || "",
  };
}

function formToPayload(form) {
  return {
    name: form.name,
    category: form.category,
    price: toCents(form.price),
    upc: form.upc,
    producer: form.producer,
    image_url: form.image_url,
  };
}

function ProductForm({ form, onChange, onSubmit, submitLabel, onCancel }) {
  const update = (e) => onChange({ ...form, [e.target.name]: e.target.value });

  return (
    <form className="dashboard-form" onSubmit={onSubmit}>
      <input name="name" placeholder="Name" value={form.name} onChange={update} required />
      <input
        name="category"
        placeholder="Category"
        value={form.category}
        onChange={update}
        required
      />
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
        placeholder="UPC (12-13 digits)"
        minLength={12}
        maxLength={13}
        value={form.upc}
        onChange={update}
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
        <button type="submit">{submitLabel}</button>
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
  const [denied, setDenied] = useState(!localStorage.getItem("token"));
  const toast = useToast();
  const [loadError, setLoadError] = useState("");
  const [newProduct, setNewProduct] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [stockInputs, setStockInputs] = useState({});

  const handleError = (err) => {
    if (err.status === 403) {
      setDenied(true);
    } else {
      toast.error(err.message);
    }
  };

  const loadProducts = useCallback(() => {
    adminRequest("/admin/products")
      .then((data) => {
        setProducts(data);
        setDenied(false);
      })
      .catch((err) => {
        if (err.status !== 403) setLoadError(err.message);
        handleError(err);
      });
  }, []);

  useEffect(() => {
    if (localStorage.getItem("token")) loadProducts();
  }, [loadProducts]);

  const replaceProduct = (updated) =>
    setProducts((list) =>
      list.map((p) => (p.product_id === updated.product_id ? updated : p)),
    );

  const succeed = (text) => toast.success(text);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const created = await adminRequest("/admin/products", "POST", formToPayload(newProduct));
      setProducts((list) => [...list, created]);
      setNewProduct(EMPTY_FORM);
      succeed(`Added ${created.product_name}.`);
    } catch (err) {
      handleError(err);
    }
  };

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

  const receiveStock = async (p) => {
    const quantity = Number(stockInputs[p.product_id]);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Enter a positive whole number to add stock.");
      return;
    }

    try {
      const updated = await adminRequest(`/admin/products/${p.product_id}/stock`, "POST", {
        quantity,
      });
      replaceProduct(updated);
      setStockInputs((inputs) => ({ ...inputs, [p.product_id]: "" }));
      succeed(`Added ${quantity} to ${updated.product_name}.`);
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

  const totalStock = (products || []).reduce((sum, p) => sum + p.quantity_in_stock, 0);
  const activeCount = (products || []).filter((p) => p.product_active).length;
  const outOfStock = (products || []).filter((p) => p.quantity_in_stock <= 0).length;

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
                </div>
              </section>

              <section className="account-section">
                <h2 className="account-section-title">Add Product</h2>
                <ProductForm
                  form={newProduct}
                  onChange={setNewProduct}
                  onSubmit={handleAdd}
                  submitLabel="Add product"
                />
              </section>

              <section className="account-section">
                <h2 className="account-section-title">Inventory</h2>
                <div className="history-scroll dashboard-scroll">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Sold</th>
                        <th>Status</th>
                        <th>Receive</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) =>
                        editingId === p.product_id ? (
                          <tr key={p.product_id}>
                            <td colSpan={9}>
                              <ProductForm
                                form={editForm}
                                onChange={setEditForm}
                                onSubmit={handleSave}
                                submitLabel="Save"
                                onCancel={() => setEditingId(null)}
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
                            <td className={p.quantity_in_stock <= 0 ? "product-stock-out" : ""}>
                              {p.quantity_in_stock}
                            </td>
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
                              <div className="dashboard-stock">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="Qty"
                                  value={stockInputs[p.product_id] || ""}
                                  onChange={(e) =>
                                    setStockInputs((inputs) => ({
                                      ...inputs,
                                      [p.product_id]: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="dashboard-btn-small"
                                  onClick={() => receiveStock(p)}
                                >
                                  Add
                                </button>
                              </div>
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
