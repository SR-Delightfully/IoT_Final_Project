
import { useEffect, useMemo, useState } from "react";
import Header from "../layout/header";

const API_URL = "http://localhost:5050";
const GST_RATE = 0.05;
const QST_RATE = 0.09975;

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);

function calculateTotals(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const qst = Math.round(subtotal * QST_RATE * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst,
    qst,
    total: Math.round((subtotal + gst + qst) * 100) / 100,
  };
}

function SelfCheckout() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/products`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load products.");
      }

      const productList = Array.isArray(data) ? data : data.products;

      if (!Array.isArray(productList)) {
        throw new Error("Invalid product data received from server.");
      }

      setProducts(
        productList.map((product) => ({
          id: product.product_id,
          name: product.product_name,
          category: product.product_category,
          price: Number(product.product_price),
          barcode: product.product_barcode || "",
          stock: Number(product.product_stock ?? product.stock ?? 0),
        }))
      );
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.barcode.includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const totals = useMemo(() => calculateTotals(cart), [cart]);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product) {
    setMessage("");
    setReceipt(null);
    setCheckoutOpen(false);

    if (product.stock < 1) {
      setMessage(`${product.name} is out of stock.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          setMessage(`Maximum available quantity reached for ${product.name}.`);
          return current;
        }

        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });
  }

  function updateQuantity(id, change) {
    setMessage("");

    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== id) return item;

          const product = products.find((entry) => entry.id === id);
          const quantity = item.quantity + change;

          if (quantity > product.stock) {
            setMessage(`Only ${product.stock} units are available.`);
            return item;
          }

          return { ...item, quantity };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id) {
    setCart((current) => current.filter((item) => item.id !== id));
    setMessage("");
  }

  function scanBarcode(event) {
    event.preventDefault();

    const code = barcode.trim();
    if (!code) return;

    const product = products.find((item) => item.barcode === code);

    if (!product) {
      setMessage("Product not found. Check the barcode and try again.");
      return;
    }

    addToCart(product);
    setBarcode("");
    setSearch("");
    setCategory("All");
  }

  function beginCheckout() {
    if (!cart.length) return;

    setMessage("");
    setCheckoutOpen(true);
  }

  async function completeCheckout() {
    if (!cart.length || processing) return;

    setProcessing(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
          payment_method: paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }

      const completedTotals = data.totals || {
        subtotal: Number(data.purchase_subtotal ?? totals.subtotal),
        gst: Number(data.purchase_gst ?? totals.gst),
        qst: Number(data.purchase_qst ?? totals.qst),
        total: Number(data.purchase_total ?? totals.total),
      };

      setReceipt({
        number:
          data.receipt_number ||
          data.number ||
          data.purchase_id ||
          `ORDER-${Date.now()}`,
        date: data.receipt_created_at
          ? new Date(data.receipt_created_at).toLocaleString("en-CA")
          : new Date().toLocaleString("en-CA"),
        items: cart.map((item) => ({ ...item })),
        totals: completedTotals,
        paymentMethod,
      });

      setCart([]);
      setCheckoutOpen(false);
      await loadProducts();
    } catch (error) {
      setMessage(error.message || "Could not complete purchase.");
    } finally {
      setProcessing(false);
    }
  }

  function startNewSale() {
    setReceipt(null);
    setCart([]);
    setSearch("");
    setBarcode("");
    setCategory("All");
    setCheckoutOpen(false);
    setMessage("");
    loadProducts();
  }

  if (receipt) {
    return (
      <main className="fridge-page selfCheckout-page">
        <section className="receipt">
          <div className="success-icon">✓</div>
          <span className="eyebrow">TRANSACTION COMPLETE</span>
          <h1>Thank you!</h1>
          <p className="muted">
            Your purchase has been recorded successfully.
          </p>

          <div className="receipt-paper">
            <div className="receipt-header">
              <strong>SMART TCG STORE</strong>
              <span>SELF-CHECKOUT RECEIPT</span>
              <span>{receipt.date}</span>
              <span>Order #{receipt.number}</span>
            </div>

            <div className="receipt-items">
              {receipt.items.map((item) => (
                <div className="receipt-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity} × {money(item.price)}
                    </span>
                  </div>
                  <strong>{money(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>

            <div className="receipt-totals">
              <div>
                <span>Subtotal</span>
                <span>{money(receipt.totals.subtotal)}</span>
              </div>
              <div>
                <span>GST (5%)</span>
                <span>{money(receipt.totals.gst)}</span>
              </div>
              <div>
                <span>QST (9.975%)</span>
                <span>{money(receipt.totals.qst)}</span>
              </div>
              <div className="receipt-total">
                <strong>TOTAL</strong>
                <strong>{money(receipt.totals.total)}</strong>
              </div>
              <div>
                <span>Payment method selected</span>
                <span>{receipt.paymentMethod.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <button className="primary new-sale" onClick={startNewSale}>
            Start new sale
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="fridge-page selfCheckout-page">
      <Header
        eyebrow="SMART TCG STORE / REGISTER 01"
        title="Self Checkout"
        subtitle="Scan your items, review your cart then process"
      />

      <div className="workspace">
        <section className="catalog">
          <header className="section-heading">
            <div>
              <span className="eyebrow">01 / PRODUCT CATALOG</span>
              <h2>Find your items</h2>
            </div>
            <span className="count">
              {loading ? "LOADING..." : `${filteredProducts.length} PRODUCTS`}
            </span>
          </header>

          <form className="barcode-form" onSubmit={scanBarcode}>
            <span className="barcode-icon">▥</span>
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Scan barcode or enter product code..."
              aria-label="Barcode"
            />
            <button type="submit" disabled={loading}>
              Add item
            </button>
          </form>

          <label className="search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </label>

          <div className="categories" aria-label="Product categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "is-active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {message && <p className="message" role="status">{message}</p>}

          {loading ? (
            <div className="empty">
              <strong>Loading products...</strong>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => {
                const cartItem = cart.find((item) => item.id === product.id);
                const quantity = cartItem?.quantity || 0;
                const unavailable = quantity >= product.stock;

                return (
                  <article className="product" key={product.id}>
                    <div className="product-art">
                      <span>{product.category.toUpperCase()}</span>
                      <span className="product-symbol">
                        {product.category === "Cards"
                          ? "▤"
                          : product.category === "Accessories"
                            ? "◇"
                            : product.category === "Drinks"
                              ? "▥"
                              : "◈"}
                      </span>
                      {quantity > 0 && (
                        <span className="in-cart">{quantity} IN CART</span>
                      )}
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <span className="stock">
                        {Math.max(0, product.stock - quantity)} available
                      </span>
                      <div className="product-footer">
                        <strong>{money(product.price)}</strong>
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={unavailable}
                          aria-label={`Add ${product.name} to cart`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="empty">
              <strong>No products found</strong>
              <p>
                {products.length === 0
                  ? "No products have been added to the database yet."
                  : "Try a different search or category."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <aside className="cart">
          <header className="section-heading">
            <div>
              <span className="eyebrow">02 / YOUR PURCHASE</span>
              <h2>Shopping cart</h2>
            </div>
            <span className="count">{itemCount} ITEMS</span>
          </header>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="cart-empty-icon">▤</span>
              <strong>Your cart is empty</strong>
              <p>Choose a product or scan a barcode to get started.</p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-main">
                    <div>
                      <h3>{item.name}</h3>
                      <span>{money(item.price)} each</span>
                    </div>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>

                  <div className="cart-item-controls">
                    <div className="quantity">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="remove"
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <button
              className="clear-cart"
              type="button"
              onClick={() => {
                setCart([]);
                setMessage("");
                setCheckoutOpen(false);
              }}
            >
              Clear cart
            </button>
          )}

          <div className="total-breakdown">
            <div>
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div>
              <span>GST (5%)</span>
              <span>{money(totals.gst)}</span>
            </div>
            <div>
              <span>QST (9.975%)</span>
              <span>{money(totals.qst)}</span>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <strong>{money(totals.total)}</strong>
            </div>
            <p>Taxes are calculated from your cart subtotal.</p>
          </div>

          {!checkoutOpen ? (
            <button
              className="primary"
              type="button"
              onClick={beginCheckout}
              disabled={!cart.length || loading}
            >
              Proceed to payment <span>→</span>
            </button>
          ) : (
            <div className="payment">
              <span className="eyebrow">03 / PAYMENT METHOD</span>
              <h3>How would you like to pay?</h3>

              {[
                { id: "card", title: "Credit / debit", detail: "External card terminal" },
                { id: "cash", title: "Cash", detail: "Pay at the cashier" },
                { id: "mobile", title: "Mobile payment", detail: "External payment terminal" },
              ].map((method) => (
                <button
                  className={`payment-option ${paymentMethod === method.id ? "is-selected" : ""}`}
                  type="button"
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <span className="payment-radio">
                    {paymentMethod === method.id ? "●" : "○"}
                  </span>
                  <span>
                    <strong>{method.title}</strong>
                    <small>{method.detail}</small>
                  </span>
                </button>
              ))}

              <p className="demo-notice">
                PAYMENT IS NOT PROCESSED BY THIS APPLICATION.
              </p>

              <button
                className="primary"
                type="button"
                onClick={completeCheckout}
                disabled={processing}
              >
                {processing ? "Processing..." : `Complete purchase · ${money(totals.total)}`}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => setCheckoutOpen(false)}
                disabled={processing}
              >
                Back to cart
              </button>
            </div>
          )}
          <div className="cart-footer">SMART TCG STORE · REGISTER 01</div>
        </aside>
      </div>
    </main>
  );
}

export default SelfCheckout;
