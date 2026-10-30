
import { useMemo, useState } from "react";
import Header from "../layout/header";

const PRODUCTS = [
  { id: 1, name: "Booster Pack", category: "Cards", price: 7.99, barcode: "100000000001", stock: 24 },
  { id: 2, name: "Elite Trainer Box", category: "Cards", price: 54.99, barcode: "100000000002", stock: 8 },
  { id: 3, name: "Starter Deck", category: "Cards", price: 19.99, barcode: "100000000003", stock: 12 },
  { id: 4, name: "Deck Box", category: "Accessories", price: 12.99, barcode: "100000000004", stock: 15 },
  { id: 5, name: "Card Sleeves", category: "Accessories", price: 6.99, barcode: "100000000005", stock: 30 },
  { id: 6, name: "Playmat", category: "Accessories", price: 24.99, barcode: "100000000006", stock: 6 },
  { id: 7, name: "Energy Drink", category: "Drinks", price: 3.49, barcode: "100000000007", stock: 20 },
  { id: 8, name: "Bottled Water", category: "Drinks", price: 1.99, barcode: "100000000008", stock: 25 },
  { id: 9, name: "Chocolate Bar", category: "Snacks", price: 2.49, barcode: "100000000009", stock: 18 },
  { id: 10, name: "Chips", category: "Snacks", price: 2.99, barcode: "100000000010", stock: 16 },
];

const CATEGORIES = ["All", "Cards", "Accessories", "Drinks", "Snacks"];
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
  const qst = Math.round((subtotal + gst) * QST_RATE * 100) / 100;

  return {
    subtotal,
    gst,
    qst,
    total: Math.round((subtotal + gst + qst) * 100) / 100,
  };
}

function SelfCheckout() {
  const [products] = useState(PRODUCTS);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");
  const [barcode, setBarcode] = useState("");

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

      if (product.stock < 1) {
        setMessage(`${product.name} is out of stock.`);
        return current;
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

  function completeDemoCheckout() {
    if (!cart.length) return;

    const completedItems = cart.map((item) => ({ ...item }));
    const completedTotals = calculateTotals(completedItems);

    setReceipt({
      number: `DEMO-${Date.now().toString().slice(-8)}`,
      date: new Date().toLocaleString("en-CA"),
      items: completedItems,
      totals: completedTotals,
      paymentMethod,
    });

    setCart([]);
    setCheckoutOpen(false);
    setMessage("");
  }

  function startNewSale() {
    setReceipt(null);
    setCart([]);
    setSearch("");
    setBarcode("");
    setCategory("All");
    setCheckoutOpen(false);
    setMessage("");
  }

  if (receipt) {
    return (
      <main className="fridge-page selfCheckout-page">
        <section className="sc-receipt">
          <div className="sc-success-icon">✓</div>
          <span className="sc-eyebrow">TRANSACTION COMPLETE</span>
          <h1>Thank you!</h1>
          <p className="sc-muted">
            This is a simulated transaction. No payment was processed.
          </p>

          <div className="sc-receipt-paper">
            <div className="sc-receipt-header">
              <strong>SMART TCG STORE</strong>
              <span>SELF-CHECKOUT RECEIPT</span>
              <span>{receipt.date}</span>
              <span>Order #{receipt.number}</span>
            </div>

            <div className="sc-receipt-items">
              {receipt.items.map((item) => (
                <div className="sc-receipt-item" key={item.id}>
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

            <div className="sc-receipt-totals">
              <div><span>Subtotal</span><span>{money(receipt.totals.subtotal)}</span></div>
              <div><span>GST (5%)</span><span>{money(receipt.totals.gst)}</span></div>
              <div><span>QST (9.975%)</span><span>{money(receipt.totals.qst)}</span></div>
              <div className="sc-receipt-total">
                <strong>TOTAL</strong>
                <strong>{money(receipt.totals.total)}</strong>
              </div>
              <div>
                <span>Payment method selected</span>
                <span>{receipt.paymentMethod.toUpperCase()}</span>
              </div>
            </div>
            <p className="sc-demo-notice">DEMO RECEIPT — NOT A VALID PROOF OF PURCHASE</p>
          </div>

          <button className="sc-primary sc-new-sale" onClick={startNewSale}>
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
      ></Header>

      <div className="sc-workspace">
        <section className="sc-catalog">
          <header className="sc-section-heading">
            <div>
              <span className="sc-eyebrow">01 / PRODUCT CATALOG</span>
              <h2>Find your items</h2>
            </div>
            <span className="sc-count">{filteredProducts.length} PRODUCTS</span>
          </header>

          <form className="sc-barcode-form" onSubmit={scanBarcode}>
            <span className="sc-barcode-icon">▥</span>
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Scan barcode or enter product code..."
              aria-label="Barcode"
            />
            <button type="submit">Add item</button>
          </form>

          <label className="sc-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                ×
              </button>
            )}
          </label>

          <div className="sc-categories" aria-label="Product categories">
            {CATEGORIES.map((item) => (
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
            <p className="sc-message" role="status">{message}</p>
          )}

          <div className="sc-product-grid">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((item) => item.id === product.id);
              const quantity = cartItem?.quantity || 0;
              const unavailable = quantity >= product.stock;

              return (
                <article className="sc-product" key={product.id}>
                  <div className="sc-product-art">
                    <span>{product.category.toUpperCase()}</span>
                    <span className="sc-product-symbol">
                      {product.category === "Cards"
                        ? "▤"
                        : product.category === "Accessories"
                          ? "◇"
                          : product.category === "Drinks"
                            ? "▥"
                            : "◈"}
                    </span>
                    {quantity > 0 && (
                      <span className="sc-in-cart">{quantity} IN CART</span>
                    )}
                  </div>
                  <div className="sc-product-info">
                    <h3>{product.name}</h3>
                    <span className="sc-stock">
                      {product.stock - quantity} available
                    </span>
                    <div className="sc-product-footer">
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

          {filteredProducts.length === 0 && (
            <div className="sc-empty">
              <strong>No products found</strong>
              <p>Try a different search or category.</p>
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

        <aside className="sc-cart">
          <header className="sc-section-heading">
            <div>
              <span className="sc-eyebrow">02 / YOUR PURCHASE</span>
              <h2>Shopping cart</h2>
            </div>
            <span className="sc-count">{itemCount} ITEMS</span>
          </header>

          {cart.length === 0 ? (
            <div className="sc-cart-empty">
              <span className="sc-cart-empty-icon">▤</span>
              <strong>Your cart is empty</strong>
              <p>Choose a product or scan a barcode to get started.</p>
            </div>
          ) : (
            <div className="sc-cart-items">
              {cart.map((item) => (
                <article className="sc-cart-item" key={item.id}>
                  <div className="sc-cart-item-main">
                    <div>
                      <h3>{item.name}</h3>
                      <span>{money(item.price)} each</span>
                    </div>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>

                  <div className="sc-cart-item-controls">
                    <div className="sc-quantity">
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
                      className="sc-remove"
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
              className="sc-clear-cart"
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

          <div className="sc-total-breakdown">
            <div><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div><span>GST (5%)</span><span>{money(totals.gst)}</span></div>
            <div><span>QST (9.975%)</span><span>{money(totals.qst)}</span></div>
            <div className="sc-grand-total">
              <span>Total</span>
              <strong>{money(totals.total)}</strong>
            </div>
            <p>Taxes are estimates for this demo checkout.</p>
          </div>

          {!checkoutOpen ? (
            <button
              className="sc-primary"
              type="button"
              onClick={beginCheckout}
              disabled={!cart.length}
            >
              Proceed to payment <span>→</span>
            </button>
          ) : (
            <div className="sc-payment">
              <span className="sc-eyebrow">03 / PAYMENT METHOD</span>
              <h3>How would you like to pay?</h3>

              {[
                { id: "card", title: "Credit / debit", detail: "External card terminal" },
                { id: "cash", title: "Cash", detail: "Pay at the cashier" },
                { id: "mobile", title: "Mobile payment", detail: "External payment terminal" },
              ].map((method) => (
                <button
                  className={`sc-payment-option ${paymentMethod === method.id ? "is-selected" : ""}`}
                  type="button"
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <span className="sc-payment-radio">
                    {paymentMethod === method.id ? "●" : "○"}
                  </span>
                  <span>
                    <strong>{method.title}</strong>
                    <small>{method.detail}</small>
                  </span>
                </button>
              ))}

              <p className="sc-demo-notice">
                DEMO MODE — this will not charge you or record a real payment.
              </p>

              <button
                className="sc-primary"
                type="button"
                onClick={completeDemoCheckout}
              >
                Simulate checkout · {money(totals.total)}
              </button>
              <button
                className="sc-secondary"
                type="button"
                onClick={() => setCheckoutOpen(false)}
              >
                Back to cart
              </button>
            </div>
          )}
          <div className="sc-cart-footer">SMART TCG STORE · REGISTER 01</div>
        </aside>
      </div>
    </main>
  );
}

export default SelfCheckout;
