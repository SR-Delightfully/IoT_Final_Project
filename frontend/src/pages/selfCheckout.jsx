
import { useEffect, useMemo, useState } from "react";
import Header from "../layout/header";

const API_URL = "http://localhost:5050";

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(amount) || 0);

function SelfCheckout() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [totals, setTotals] = useState({
    subtotal: 0,
    gst: 0,
    qst: 0,
    total: 0,
  });

  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("LOADING");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
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
          category: product.product_category || "Uncategorized",
          price: Number(product.product_price),
          barcode: product.product_barcode || "",
          stock: Number(product.product_stock ?? 0),
          image: product.product_image_url || "",
        }))
      );
    } catch (error) {
      setMessage(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function createCheckoutSession() {
    setSessionLoading(true);
    setSessionStatus("LOADING");

    try {
      const response = await fetch(`${API_URL}/checkout/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start checkout session.");
      }

      setSessionId(data.session_id);
      setSessionStatus(data.session_status || "ACTIVE");
      setMessage("");
    } catch (error) {
      setSessionId(null);
      setSessionStatus("ERROR");
      setMessage(error.message || "Could not start checkout session.");
    } finally {
      setSessionLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    createCheckoutSession();
  }, []);

  useEffect(() => {
    if (!sessionId || sessionStatus !== "ACTIVE") return;

    let active = true;
    let requestInProgress = false;

    async function loadCart() {
      if (requestInProgress) return;

      requestInProgress = true;

      try {
        const response = await fetch(
          `${API_URL}/checkout/session/${sessionId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load checkout cart.");
        }

        if (!active) return;

        setCart(
          data.items.map((item) => ({
            id: item.product_id,
            name: item.product_name,
            category: item.product_category || "Uncategorized",
            price: Number(item.product_price),
            quantity: Number(item.quantity),
            stock: Number(item.product_stock ?? 0),
            barcode: item.product_barcode || "",
            image: item.product_image_url || "",
          }))
        );

        setTotals({
          subtotal: Number(data.subtotal) || 0,
          gst: Number(data.gst) || 0,
          qst: Number(data.qst) || 0,
          total: Number(data.total) || 0,
        });

        setSessionStatus(data.session.session_status);
      } catch (error) {
        if (active) {
          setMessage(error.message || "Could not update checkout cart.");
        }
      } finally {
        requestInProgress = false;
      }
    }

    loadCart();

    const interval = setInterval(loadCart, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId, sessionStatus]);

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

  const itemCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  async function completeCheckout() {
    if (!cart.length || !sessionId || processing) return;

    setProcessing(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          payment_method: paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }

      setReceipt({
        number: data.receipt_number,
        date: data.receipt_created_at
          ? new Date(data.receipt_created_at).toLocaleString("en-CA")
          : new Date().toLocaleString("en-CA"),
        items: (data.items || []).map((item) => ({
          id: item.product_id,
          name: item.product_name,
          price: Number(item.product_price),
          quantity: Number(item.quantity),
        })),
        totals: {
          subtotal: Number(data.subtotal) || 0,
          gst: Number(data.gst) || 0,
          qst: Number(data.qst) || 0,
          total: Number(data.total) || 0,
        },
        paymentMethod,
      });

      setSessionStatus("COMPLETED");
      setCart([]);
      setCheckoutOpen(false);
      await loadProducts();
    } catch (error) {
      setMessage(error.message || "Could not complete purchase.");
    } finally {
      setProcessing(false);
    }
  }

  async function startNewSale() {
    setReceipt(null);
    setCart([]);
    setTotals({
      subtotal: 0,
      gst: 0,
      qst: 0,
      total: 0,
    });
    setSearch("");
    setCategory("All");
    setCheckoutOpen(false);
    setMessage("");
    setSessionId(null);

    await createCheckoutSession();
    await loadProducts();
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

          <div className="barcode-form">
            <span className="barcode-icon">▥</span>
            <span>
              <strong>RFID SCANNING ENABLED</strong>
              <small>
                Scan a tagged product at the reader to add it to your cart.
              </small>
            </span>
          </div>

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

          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}

          {loading ? (
            <div className="empty">
              <strong>Loading products...</strong>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(
                  (item) => item.id === product.id
                );
                const quantity = cartItem?.quantity || 0;
                const available = Math.max(
                  0,
                  product.stock - quantity
                );

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
                        <span className="in-cart">
                          {quantity} IN CART
                        </span>
                      )}
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <span className="stock">
                        {available} available
                      </span>
                      <div className="product-footer">
                        <strong>{money(product.price)}</strong>
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

          <div className="session-status">
            <span>
              {sessionStatus === "ACTIVE"
                ? "RFID SESSION ACTIVE"
                : sessionStatus === "LOADING"
                  ? "STARTING SESSION..."
                  : sessionStatus === "ERROR"
                    ? "SESSION UNAVAILABLE"
                    : sessionStatus}
            </span>
            {sessionId && <span>SESSION #{sessionId}</span>}
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="cart-empty-icon">▤</span>
              <strong>Your cart is empty</strong>
              <p>
                Scan a product with the RFID reader to add it to your
                purchase.
              </p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-main">
                    <div>
                      <h3>{item.name}</h3>
                      <span>
                        {item.quantity} × {money(item.price)}
                      </span>
                    </div>
                    <strong>
                      {money(item.price * item.quantity)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
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
            <p>Taxes are calculated by the checkout service.</p>
          </div>

          {!checkoutOpen ? (
            <button
              className="primary"
              type="button"
              onClick={() => {
                setMessage("");
                setCheckoutOpen(true);
              }}
              disabled={
                !cart.length ||
                loading ||
                sessionLoading ||
                sessionStatus !== "ACTIVE"
              }
            >
              Proceed to payment <span>→</span>
            </button>
          ) : (
            <div className="payment">
              <span className="eyebrow">03 / PAYMENT METHOD</span>
              <h3>How would you like to pay?</h3>

              {[
                {
                  id: "card",
                  title: "Credit / debit",
                  detail: "External card terminal",
                },
                {
                  id: "cash",
                  title: "Cash",
                  detail: "Pay at the cashier",
                },
                {
                  id: "mobile",
                  title: "Mobile payment",
                  detail: "External payment terminal",
                },
              ].map((method) => (
                <button
                  className={`payment-option ${
                    paymentMethod === method.id ? "is-selected" : ""
                  }`}
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
                disabled={processing || !cart.length}
              >
                {processing
                  ? "Processing..."
                  : `Complete purchase · ${money(totals.total)}`}
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

          <div className="cart-footer">
            SMART TCG STORE · REGISTER 01
          </div>
        </aside>
      </div>
    </main>
  );
}

export default SelfCheckout;
