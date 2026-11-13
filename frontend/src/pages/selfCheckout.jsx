
import { useEffect, useMemo, useState } from "react";
import Header from "../layout/header";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(amount) || 0);

function normalizeProduct(product) {
  return {
    id: Number(product.product_id ?? product.id),
    name: product.product_name || product.name || "Unnamed product",
    category:
      product.product_category ||
      product.category_name ||
      product.category ||
      "Uncategorized",
    categoryId: Number(product.category_id),
    categoryImage: product.category_image_url || "",
    description: product.product_description || product.description || "",
    company: product.product_company || product.company || "",
    price:
      Number(
        product.product_price ??
          (Number(product.product_price_cents) / 100)
      ) || 0,
    barcode: product.product_barcode || product.barcode_value || "",
    stock:
      Number(
        product.product_stock ??
          product.product_stock_quantity ??
          product.stock ??
          0
      ) || 0,
    image: product.product_image_url || product.image || "",
  };
}

function normalizeCartItem(item) {
  return {
    ...normalizeProduct(item),
    quantity: Number(
      item.session_item_quantity ?? item.quantity
    ) || 0,
  };
}

function getCategorySymbol(category) {
  const symbols = {
    Cards: "▤",
    Accessories: "◇",
    Drinks: "▥",
    Snacks: "◈",
    Uncategorized: "□",
  };

  return symbols[category] || "✧";
}

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
  const [serverStatus, setServerStatus] = useState("LOADING");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Browse");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [updatingProduct, setUpdatingProduct] = useState(null);

  async function request(url, options = {}) {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "The request could not be completed.");
    }

    return data;
  }

  async function loadProducts() {
    try {
      const data = await request("/products");
      const productList = Array.isArray(data)
        ? data
        : data.products;

      if (!Array.isArray(productList)) {
        throw new Error("Invalid product data received from server.");
      }

      setProducts(productList.map(normalizeProduct));
      setServerStatus("ACTIVE");
    } catch (error) {
      setMessage(error.message || "Could not load products.");
      setServerStatus("ERROR");
    } finally {
      setLoading(false);
    }
  }

  async function loadCart(id = sessionId) {
    if (!id) return;

    const data = await request(`/checkout/session/${id}`);
    const items = Array.isArray(data.items) ? data.items : [];

    setCart(items.map(normalizeCartItem));

    setTotals({
      subtotal: Number(data.subtotal) / 100 || 0,
      gst: Number(data.gst) / 100 || 0,
      qst: Number(data.qst) / 100 || 0,
      total: Number(data.total) / 100 || 0,
    });

    setSessionStatus(data.session?.session_status || "ACTIVE");

    return data;
  }

  async function createCheckoutSession() {
    setSessionLoading(true);
    setSessionStatus("LOADING");

    try {
      const data = await request("/checkout/session", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!data.session_id) {
        throw new Error("Server did not return a checkout session ID.");
      }

      setSessionId(data.session_id);
      setSessionStatus(data.session_status || "ACTIVE");
      setCart([]);
      setTotals({
        subtotal: 0,
        gst: 0,
        qst: 0,
        total: 0,
      });
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

    async function refreshCart() {
      if (requestInProgress) return;

      requestInProgress = true;

      try {
        const data = await request(`/checkout/session/${sessionId}`);

        if (!active) return;

        const items = Array.isArray(data.items) ? data.items : [];

        setCart(items.map(normalizeCartItem));

        setTotals({
          subtotal: Number(data.subtotal) / 100 || 0,
          gst: Number(data.gst) / 100 || 0,
          qst: Number(data.qst) / 100 || 0,
          total: Number(data.total) / 100 || 0,
        });

        setSessionStatus(data.session?.session_status || "ACTIVE");
      } catch (error) {
        if (active) {
          setMessage(error.message || "Could not update checkout cart.");
        }
      } finally {
        requestInProgress = false;
      }
    }

    refreshCart();

    const interval = setInterval(refreshCart, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId, sessionStatus]);

  async function addProduct(product) {
    if (!sessionId || sessionStatus !== "ACTIVE" || updatingProduct) return;

    const cartItem = cart.find((item) => item.id === product.id);
    const currentQuantity = cartItem?.quantity || 0;

    if (currentQuantity >= product.stock) {
      setMessage(`No more stock available for ${product.name}.`);
      return;
    }

    setUpdatingProduct(product.id);
    setMessage("");

    try {
      await request(`/checkout/session/${sessionId}/items`, {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity: 1,
        }),
      });

      await loadCart(sessionId);
    } catch (error) {
      setMessage(error.message || "Could not add product.");
    } finally {
      setUpdatingProduct(null);
    }
  }

  async function updateQuantity(productId, quantity) {
    if (!sessionId || sessionStatus !== "ACTIVE" || updatingProduct) return;

    setUpdatingProduct(productId);
    setMessage("");

    try {
      if (quantity <= 0) {
        await request(
          `/checkout/session/${sessionId}/items/${productId}`,
          { method: "DELETE" }
        );
      } else {
        await request(
          `/checkout/session/${sessionId}/items/${productId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ quantity }),
          }
        );
      }

      await loadCart(sessionId);
    } catch (error) {
      setMessage(error.message || "Could not update product quantity.");
    } finally {
      setUpdatingProduct(null);
    }
  }

  async function removeProduct(productId) {
    await updateQuantity(productId, 0);
  }

const categories = useMemo(() => {
  const categoryOrder = [
    "Pokémon",
    "Magic: The Gathering",
    "Yu-Gi-Oh!",
    "Riftbound",
    "Accessories",
  ];

  const uniqueCategories = [
    ...new Set(products.map((product) => product.category)),
  ];

  return uniqueCategories.sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);

    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });
}, [products]);

const categoryCounts = useMemo(
  () =>
    categories.map((item) => {
      const categoryProducts = products.filter(
        (product) => product.category === item
      );

      return {
        name: item,
        count: categoryProducts.length,
        preview: categoryProducts.find(
          (product) => product.categoryImage
        )?.categoryImage || "",
      };
    }),
  [products, categories]
);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "Browse" ||
        category === "All" ||
        product.category === category;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.company.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const showCategories = category === "Browse" && !search.trim();

  const itemCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  async function completeCheckout() {
    if (!cart.length || !sessionId || processing) return;

    setProcessing(true);
    setMessage("");

    try {
      const data = await request("/checkout", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          payment_method: paymentMethod,
        }),
      });

      setReceipt({
        number: data.receipt_number,
        date: data.receipt_created_at
          ? new Date(data.receipt_created_at).toLocaleString("en-CA")
          : new Date().toLocaleString("en-CA"),
        items: (data.items || []).map((item) => ({
          id: item.product_id,
          name: item.product_name,
          price: Number(item.product_price) || 0,
          quantity: Number(
            item.session_item_quantity ?? item.quantity
          ) || 0,
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
    setCategory("Browse");
    setCheckoutOpen(false);
    setMessage("");
    setSessionId(null);

    await createCheckoutSession();
    await loadProducts();
  }

  function selectCategory(item) {
    setCategory(item);
    setSearch("");
    setMessage("");
  }

  function backToCategories() {
    setCategory("Browse");
    setSearch("");
    setMessage("");
  }

  if (receipt) {
    return (
      <main className="self-checkout-page">
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
              {receipt.items.map((item, index) => (
                <div className="receipt-item" key={`${item.id}-${index}`}>
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

          <button
            className="primary new-sale"
            type="button"
            onClick={startNewSale}
          >
            Start new sale
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="self-checkout-page">
      <div className="workspace">
        <section className="catalog">
          <div className="catalog-heading">
            <div>
              <p>START SHOPPING NOW</p>
            </div>

            <span className="catalog-product-count">
              {products.length} AVAILABLE PRODUCTS
            </span>
          </div>
                         <div className="search-bar">
            <label className="search">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, categories, or SKU..."
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
              </div>
          {!showCategories && (
            <div className="catalog-navigation">
              <div className="breadcrumbs">
                <button
                  type="button"
                  onClick={backToCategories}
                >
                  ALL CATEGORIES
                </button>

                <span>/</span>

                <strong>
                  {search.trim()
                    ? "SEARCH RESULTS"
                    : category.toUpperCase()}
                </strong>
              </div>
                <span>{filteredProducts.length} PRODUCTS FOUND</span>
              

              <button
                className="back-categories"
                type="button"
                onClick={backToCategories}
              >
                ← Browse categories
              </button>
            </div>
          )}

          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}

          {loading ? (
            <div className="empty">
              <strong>Loading products...</strong>
            </div>
          ) : showCategories ? (
            <div className="category-view">
              <div className="category-grid">
                <button
                  className="category-card category-all"
                  type="button"
                  onClick={() => selectCategory("All")}
                >
                  <div className="category-card-art">
                    <span className="category-symbol">✧</span>
                    <span className="category-index">00 / ALL</span>
                  </div>

                  <div className="category-card-info">
                    <div>
                      <span className="category-card-label">THE COMPLETE COLLECTION</span>
                      <h3>All Products</h3>
                    </div>

                    <span className="category-card-count">
                      {products.length} ITEMS
                    </span>
                  </div>

                  <span className="category-card-arrow">↗</span>
                </button>

                {categoryCounts.map((item, index) => (
                  <button
                    className="category-card"
                    type="button"
                    key={item.name}
                    onClick={() => selectCategory(item.name)}
                  >
                    <div className="category-card-art">
                      {item.preview && (
                        <img
                          src={item.preview}
                          alt=""
                          loading="lazy"
                        />
                      )}

                      <span className="category-index">
                        {String(index + 1).padStart(2, "0")} / COLLECTION
                      </span>

                      <span className="category-art-count">
                        {String(item.count).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="category-card-info">
                      <div>
                        <span className="category-card-label">EXPLORE COLLECTION</span>
                        <h3>{item.name}</h3>
                      </div>

                      <span className="category-card-count">
                        {item.count} ITEMS
                      </span>
                    </div>

                    <span className="category-card-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {filteredProducts.length > 0 ? (
                <div className="products">
                <div className="product-grid">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find(
                      (item) => item.id === product.id
                    );

                    const quantity = cartItem?.quantity || 0;
                    const available = Math.max(0, product.stock - quantity);
                    const isUpdating = updatingProduct === product.id;

                    return (
                      <article className="product" key={product.id}>
                        <div className="product-art">
                            <img
                              className="product-image"
                              src={product.image}
                              alt={product.name}
                              loading="lazy"
                            />

                          {quantity > 0 && (
                            <span className="in-cart">
                              {quantity} IN CART
                            </span>
                          )}
                        </div>

                        <div className="product-info">
                          <h3>{product.name}</h3>

                          {product.company && (
                            <span className="product-company">
                              {product.company}
                            </span>
                          )}

                          {product.description && (
                            <p className="product-description">
                              {product.description}
                            </p>
                          )}

                          {product.barcode && (
                            <span className="product-barcode">
                              SKU / {product.barcode}
                            </span>
                          )}

                          <span className="stock">
                            {available} available
                          </span>

                          <div className="product-footer">
                            <strong>{money(product.price)}</strong>

                            <button
                              className="primary add-product"
                              type="button"
                              onClick={() => addProduct(product)}
                              disabled={
                                available <= 0 ||
                                sessionStatus !== "ACTIVE" ||
                                sessionLoading ||
                                Boolean(updatingProduct)
                              }
                            >
                              {isUpdating
                                ? "Adding..."
                                : available <= 0
                                  ? "Out of stock"
                                  : "Add to cart"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                </div>
              ) : (
                <div className="empty">
                  <strong>No products found</strong>

                  <p>
                    {products.length === 0
                      ? "No products have been added to the database yet."
                      : "Try another search or browse a different collection."}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategory("Browse");
                    }}
                  >
                    Back to categories
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="cart">
          <div className="section-heading">
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

            <div className="cart-heading">
              <h2>Review Products</h2>
              <span className="count">{itemCount} ITEMS</span>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="cart-empty-icon">▤</span>
              <strong>Your cart is empty</strong>
              <p>
                Add products manually or scan them with the RFID reader.
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

                  <div className="cart-item-controls">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() =>
                        updateQuantity(item.id, item.quantity - 1)
                      }
                      disabled={Boolean(updatingProduct)}
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() =>
                        updateQuantity(item.id, item.quantity + 1)
                      }
                      disabled={
                        Boolean(updatingProduct) ||
                        item.quantity >=
                          (products.find((product) => product.id === item.id)
                            ?.stock ?? item.quantity)
                      }
                    >
                      +
                    </button>

                    <button
                      className="remove-item"
                      type="button"
                      onClick={() => removeProduct(item.id)}
                      disabled={Boolean(updatingProduct)}
                    >
                      Remove
                    </button>
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

              <div className="payment-options">
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
              </div>
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
