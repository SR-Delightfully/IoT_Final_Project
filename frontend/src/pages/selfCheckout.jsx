import React, { useEffect, useRef, useState } from "react";
import { currentLang, localeFor, translate, useI18n } from "../utils/i18n";

  import { useToast } from "../components/Toaster";

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
  const emptyTotals = { subtotal: 0, gst: 0, qst: 0, total: 0 };
  const money = (amount) => {
      return new Intl.NumberFormat(localeFor(currentLang()), {
          style: "currency",
          currency: "CAD",
      }).format(Number(amount) || 0);
  };

  const normalizeProduct = (product) => {
      return {
          id: Number(product.product_id ?? product.id),
          name: product.product_name || product.name || "Unnamed product",
          category: product.product_category || product.category_name || product.category || "Uncategorized",
          description: product.product_description || product.description || "",
          company: product.product_company || product.company || "",
          price: Number(product.product_price ?? Number(product.product_price_cents) / 100) || 0,
          barcode: String(product.product_barcode || product.barcode_value || "").trim(),
          stock: Number(product.product_stock ?? product.product_stock_quantity ?? product.stock ?? 0) || 0,
          image: product.product_image_url || product.image || "",
      };
  };

  const normalizeCartItem = (item) => {
      return {
          ...normalizeProduct(item),
          quantity: Number(item.session_item_quantity ?? item.quantity) || 0,
      };
  };

  const ProductImage = ({ product }) => {
      const [broken, setBroken] = useState(false);
      if (!product.image || broken) {
          return (
              <span className="product-symbol">
                  {product.category === "Accessories" ? "◇" : "▤"}
              </span>
          );
      }
      return (
        <div className="product-image">
          <img
              className="product-art"
              src={product.image}
              alt={product.name}
              onError={() => setBroken(true)}
          />
          </div>
      );
  };

  const SelfCheckout = () => {
      const toast = useToast();
      const [screen, setscreen] = useState("welcome");
      // Shared with the rest of the site (navbar switch, saved in the browser).
      const { lang: language, setLang: setLanguage } = useI18n();
      const [account, setAccount] = useState(null);
      const [loyaltyMode, setLoyaltyMode] = useState("register");
      const [loyaltyEmail, setLoyaltyEmail] = useState("");
      const [loyaltyPassword, setLoyaltyPassword] = useState("");
      const [registration, setRegistration] = useState({
          first_name: "", last_name: "", email: "", password: "", confirm_password: ""
      });
      const [loyaltyLoading, setLoyaltyLoading] = useState(false);
      const [loyaltyMessage, setLoyaltyMessage] = useState("");
      const t = (english, params) => translate(english, params, language);
      const [products, setProducts] = useState([]);
      const [cart, setCart] = useState([]);
      const [totals, setTotals] = useState(emptyTotals);
      const [sessionId, setSessionId] = useState(null);
      const [sessionStatus, setSessionStatus] = useState("READY");
      const [serverStatus, setServerStatus] = useState("LOADING");
      const [loadingProducts, setLoadingProducts] = useState(true);
      const [sessionLoading, setSessionLoading] = useState(false);
      const [processing, setProcessing] = useState(false);
      const [updatingProduct, setUpdatingProduct] = useState(null);
      const [barcode, setBarcode] = useState("");
      const [barcodeMessage, setBarcodeMessage] = useState("");
      const [paymentMethod, setPaymentMethod] = useState("card");
      const [receipt, setReceipt] = useState(null);
      const [clock, setClock] = useState(new Date());
      const barcodeRef = useRef(null);
      const refreshInProgress = useRef(false);
      const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
      const statusLabel = sessionStatus === "ACTIVE"
          ? "READER SESSION ACTIVE"
          : sessionStatus === "ERROR"
              ? "SERVER UNAVAILABLE"
              : "READER READY";
      const notifyError = (message) => {
          if (message) toast.error(message);
      };
      const request = async (url, options = {}) => {
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
      };
      const loadProducts = async () => {
          setLoadingProducts(true);
          try {
              const data = await request("/products");
              const productList = Array.isArray(data) ? data : data.products;
              if (!Array.isArray(productList)) {
                  throw new Error("Invalid product data received from server.");
              }
              setProducts(productList.map(normalizeProduct));
              setServerStatus("ONLINE");
          } catch (error) {
              setServerStatus("OFFLINE");
              notifyError(error.message || "Could not load products.");
          } finally {
              setLoadingProducts(false);
          }
      };
      const applyCartData = (data) => {
          const cartItems = Array.isArray(data.items) ? data.items : [];
          setCart(cartItems.map(normalizeCartItem));
          setTotals({
              subtotal: Number(data.subtotal) / 100 || 0,
              gst: Number(data.gst) / 100 || 0,
              qst: Number(data.qst) / 100 || 0,
              total: Number(data.total) / 100 || 0,
          });
          setSessionStatus(data.session?.session_status || "ACTIVE");
      };
      const loadCart = async (id = sessionId) => {
          if (!id) return;
          const data = await request(`/checkout/session/${id}`);
          applyCartData(data);
          return data;
      };
      useEffect(() => {
          const loadInitialProducts = async () => {
              await loadProducts();
          };
          loadInitialProducts();
      }, []);
      useEffect(() => {
          const interval = window.setInterval(() => {
              setClock(new Date());
          }, 1000);
          return () => window.clearInterval(interval);
      }, []);
      useEffect(() => {
          if (!sessionId || sessionStatus !== "ACTIVE" || screen === "complete") {
              return;
          }
          let active = true;
          const refreshCart = async () => {
              if (refreshInProgress.current) return;
              refreshInProgress.current = true;
              try {
                  const data = await request(`/checkout/session/${sessionId}`);
                  if (active) {
                      applyCartData(data);
                  }
              } catch (error) {
                  if (active) {
                      notifyError(error.message || "Could not update the cart.");
                  }
              } finally {
                  refreshInProgress.current = false;
              }
          };
          refreshCart();
          const interval = window.setInterval(refreshCart, 1500);
          return () => {
              active = false;
              window.clearInterval(interval);
          };
      }, [sessionId, sessionStatus, screen]);
      useEffect(() => {
          if (screen === "scan") {
              barcodeRef.current?.focus();
          }
      }, [screen]);
      // Leaving this page (another page, closing or reloading the tab) cancels
      // the open sale so the RFID reader is free for the inventory dashboard.
      const openSessionRef = useRef(null);
      useEffect(() => {
          openSessionRef.current = sessionId && sessionStatus === "ACTIVE" ? sessionId : null;
      }, [sessionId, sessionStatus]);
      useEffect(() => {
          const cancelOpenSale = () => {
              const id = openSessionRef.current;
              if (!id) return;
              openSessionRef.current = null;
              fetch(`${API_URL}/checkout/session/${id}/cancel`, {
                  method: "POST",
                  keepalive: true,
              }).catch(() => {});
          };
          window.addEventListener("pagehide", cancelOpenSale);
          return () => {
              window.removeEventListener("pagehide", cancelOpenSale);
              cancelOpenSale();
          };
      }, []);
      const startSession = async () => {
          if (sessionLoading) return;
          setSessionLoading(true);
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
              setTotals(emptyTotals);
              setAccount(null);
              setLoyaltyMessage("");
              setLoyaltyMode("register");
              setLoyaltyEmail("");
              setLoyaltyPassword("");
              setRegistration({ first_name: "", last_name: "", email: "", password: "", confirm_password: "" });
              setBarcode("");
              setBarcodeMessage("");
              setscreen("scan");
          } catch (error) {
              notifyError(error.message || "Could not start the checkout session.");
              setSessionStatus("ERROR");
          } finally {
              setSessionLoading(false);
          }
      };
      const addProduct = async (product) => {
          if (!sessionId || sessionStatus !== "ACTIVE" || updatingProduct) return;
          const existingItem = cart.find((item) => item.id === product.id);
          if ((existingItem?.quantity || 0) >= product.stock) {
              throw new Error(`No more stock available for ${product.name}.`);
          }
          setUpdatingProduct(product.id);
          try {
              await request(`/checkout/session/${sessionId}/items`, {
                  method: "POST",
                  body: JSON.stringify({
                      product_id: product.id,
                      quantity: 1,
                  }),
              });
              await loadCart(sessionId);
          } finally {
              setUpdatingProduct(null);
          }
      };
      const scanMembershipCard = async (code) => {
          if (account) {
              setBarcodeMessage(t("An account is already signed in for this sale."));
              return;
          }
          try {
              const data = await request(`/checkout/session/${sessionId}/card`, {
                  method: "POST",
                  body: JSON.stringify({ code }),
              });
              setAccount(data.account || null);
              setBarcodeMessage(`${t("Welcome")}, ${data.account?.first_name || ""}!`);
          } catch (error) {
              setBarcodeMessage(error.message || t("Membership card not recognized."));
          }
      };
      const submitBarcode = async (event) => {
          event.preventDefault();
          const value = barcode.trim();
          if (!value) return;
          // Membership cards are 12-digit codes starting with 4.
          if (/^4\d{11}$/.test(value)) {
              await scanMembershipCard(value);
              setBarcode("");
              barcodeRef.current?.focus();
              return;
          }
          const product = products.find((item) => {
              return item.barcode.toLowerCase() === value.toLowerCase();
          });
          if (!product) {
              setBarcodeMessage(`No product found for barcode ${value}.`);
              setBarcode("");
              barcodeRef.current?.focus();
              return;
          }
          try {
              await addProduct(product);
              setBarcodeMessage(`${product.name} added to your cart.`);
          } catch (error) {
              setBarcodeMessage(error.message || "Could not add this product.");
          }
          setBarcode("");
          barcodeRef.current?.focus();
      };
      const updateQuantity = async (productId, quantity) => {
          if (!sessionId || sessionStatus !== "ACTIVE" || updatingProduct) return;
          setUpdatingProduct(productId);
          try {
              if (quantity <= 0) {
                  await request(`/checkout/session/${sessionId}/items/${productId}`, {
                      method: "DELETE",
                  });
              } else {
                  await request(`/checkout/session/${sessionId}/items/${productId}`, {
                      method: "PATCH",
                      body: JSON.stringify({ quantity }),
                  });
              }
              await loadCart(sessionId);
          } catch (error) {
              notifyError(error.message || "Could not update product quantity.");
          } finally {
              setUpdatingProduct(null);
          }
      };
      const loginMember = async () => {
          if (!sessionId || !loyaltyEmail.trim() || !loyaltyPassword || loyaltyLoading) return;
          setLoyaltyLoading(true);
          setLoyaltyMessage("");
          try {
              const data = await request(`/checkout/session/${sessionId}/login`, {
                  method: "POST",
                  body: JSON.stringify({ email: loyaltyEmail.trim(), password: loyaltyPassword }),
              });
              setAccount(data.account || null);
              setLoyaltyEmail("");
              setLoyaltyPassword("");
              setLoyaltyMessage(t("Signed in successfully. Your account is linked to this purchase."));
          } catch (error) {
              setLoyaltyMessage(error.message || t("Could not sign in."));
          } finally {
              setLoyaltyLoading(false);
          }
      };
      const registerMember = async (event) => {
          event.preventDefault();
          if (!sessionId || loyaltyLoading) return;
          setLoyaltyLoading(true);
          setLoyaltyMessage("");
          try {
              const data = await request(`/checkout/session/${sessionId}/register`, {
                  method: "POST",
                  body: JSON.stringify({ ...registration, address: "", phone: "", is_member: true }),
              });
              setAccount(data.account || null);
              setRegistration({ first_name: "", last_name: "", email: "", password: "", confirm_password: "" });
              setLoyaltyMessage(t("Membership created! You are now earning loyalty points."));
          } catch (error) {
              setLoyaltyMessage(error.message || t("Could not create your membership."));
          } finally {
              setLoyaltyLoading(false);
          }
      };
      const enrollMember = async () => {
          if (!sessionId || !account || loyaltyLoading) return;
          setLoyaltyLoading(true);
          try {
              const data = await request(`/checkout/session/${sessionId}/membership`, {
                  method: "POST",
                  body: JSON.stringify({}),
              });
              setAccount(data.account || account);
              setLoyaltyMessage(t("Your loyalty membership is now active."));
          } catch (error) {
              setLoyaltyMessage(error.message || t("Could not activate your membership."));
          } finally {
              setLoyaltyLoading(false);
          }
      };
      const completeCheckout = async () => {
          if (!cart.length || !sessionId || processing) return;
          setProcessing(true);
          try {
              const data = await request("/checkout", {
                  method: "POST",
                  body: JSON.stringify({
                      session_id: sessionId,
                      payment_method: paymentMethod,
                      language,
                  }),
              });
              const receiptItems = (data.items || cart).map((item) => {
                  return {
                      id: item.product_id ?? item.id,
                      name: item.product_name ?? item.name,
                      price: Number(item.product_price ?? item.price) || 0,
                      quantity: Number(item.session_item_quantity ?? item.quantity) || 0,
                  };
              });
              setReceipt({
                  number: data.receipt_number || sessionId,
                  date: data.receipt_created_at
                      ? new Date(data.receipt_created_at).toLocaleString(language === "fr" ? "fr-CA" : "en-CA")
                      : new Date().toLocaleString(language === "fr" ? "fr-CA" : "en-CA"),
                  items: receiptItems,
                  totals: {
                      subtotal: Number(data.subtotal) || totals.subtotal,
                      gst: Number(data.gst) || totals.gst,
                      qst: Number(data.qst) || totals.qst,
                      total: Number(data.total) || totals.total,
                  },
                  pointsEarned: Number(data.loyalty_points_earned) || 0,
                  pointsBalance: Number(data.loyalty_points_balance) || 0,
                  paymentMethod: paymentMethod,
              });
              setAccount((current) => current ? {
                  ...current,
                  loyalty_points: Number(data.loyalty_points_balance) || current.loyalty_points || 0,
              } : current);
              setSessionStatus("COMPLETED");
              setscreen("complete");
              await loadProducts();
          } catch (error) {
              notifyError(error.message || "Could not complete the purchase.");
          } finally {
              setProcessing(false);
          }
      };
      const startNewSale = () => {
          setReceipt(null);
          setSessionId(null);
          setSessionStatus("READY");
          setCart([]);
          setTotals(emptyTotals);
          setAccount(null);
          setLoyaltyMessage("");
          setLoyaltyMode("register");
          setLoyaltyEmail("");
          setLoyaltyPassword("");
          setRegistration({ first_name: "", last_name: "", email: "", password: "", confirm_password: "" });
          setBarcode("");
          setBarcodeMessage("");
          setPaymentMethod("card");
          setscreen("welcome");
      };
      return (
          <main className="self-checkout">
              <header className="checkout-header">
                  <div className="checkout-brandbar">
                      <div>
                          <h1>{t("Self-Checkout")}</h1>
                      </div>
                      <span>
                          <p className="brand-kicker">SMART TCG STORE</p>
                        <p className="brand-register">REGISTER / 01</p>
                      </span>
                  </div>
              </header>
              {screen === "welcome" && (
                  <section className="start-session is-visible">
                      <button
                          className="session-btn"
                          type="button"
                          onClick={startSession}
                          disabled={sessionLoading || serverStatus !== "ONLINE"}
                      >
                          <p>{sessionLoading ? t("Preparing...") : t("Start")}</p>
                          <span className="session-btn-bg" />
                      </button>
                      <button
                          className="session-lang-toggle"
                          type="button"
                          onClick={() => setLanguage((current) => current === "en" ? "fr" : "en")}
                      >
                          {language === "en" ? "Français" : "English"}
                      </button>
                      <span className="click-icon" aria-hidden="true" />
                      <p className="start-hint">
                          {serverStatus === "ONLINE"
                              ? t("Click start to begin your shopping session")
                              : loadingProducts
                                  ? t("Connecting to checkout service...")
                                  : t("Checkout service unavailable")}
                      </p>
                  </section>
              )}
              {screen === "welcome" && <span className="blur" />}
              {screen !== "welcome" && screen !== "complete" && (
                  <section className={`process-session screen-${screen}`}>
                      <div className="your-cart">
                          <div className="panel-heading">
                              <h2>{t("Place Your Articles in the Cart")}</h2>
                              <i>{t("If a product is not detected, scan the barcode or enter it manually.")}</i>
                          </div>
                              <form className="search-bar" onSubmit={submitBarcode}>
                                  <div className="barcode-input-wrap">
                                      <input
                                          ref={barcodeRef}
                                          id="barcode-entry"
                                          value={barcode}
                                          onChange={(event) => setBarcode(event.target.value)}
                                          placeholder={t("Can't find an item in your cart? Scan or type a barcode...")}
                                          autoComplete="off"
                                          disabled={screen !== "scan" || sessionStatus !== "ACTIVE"}
                                      />
                                      <button
                                          type="submit"
                                          disabled={!barcode.trim() || Boolean(updatingProduct)}
                                      >
                                          ADD
                                      </button>
                                  </div>
                              </form>
                              {barcodeMessage && (
                                  <span className="barcode-feedback">{barcodeMessage}</span>
                              )}
                          <div className="cart-live-heading">
                              <b>{t("YOUR CART")}</b>
                              <span>{itemCount} ITEMS</span>
                          </div>
                              <div className="scanned-items">
                          {cart.length ? (
                              <ul className="scan-list">
                                  {cart.map((item) => (
                                      <li className="scan-item" key={item.id}>
                                          <ProductImage product={item} />
                                          <div className="scan-item-info">
                                              <h4>{item.name}</h4>
                                              <i>{item.description}</i>
                                          </div>
                                          <b className="scan-item-price">
                                              {money(item.price * item.quantity)}
                                          </b>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <div className="empty-state">
                                  <span></span>
                                  <b>{t("Your cart is empty")}</b>
                                  <p>{t("Scanned RFID and barcode items will appear here.")}</p>
                              </div>
                          )}
</div>
                      </div>
                      {screen === "scan" && (
                <aside className={`loyalty-membership scan-help-panel ${cart.length === 0 ? "is-empty" : "has-items"}`}>
                    <div className="scan-guide-heading">
    <span>{t("HOW IT WORKS")}</span>
    <p>{t("Complete these three steps to complete your transaction.")}</p>
</div>
<div className="how-it-works">
    <div className="scan-guide-item scan-guide-place">
        <span className="scan-guide-number">01</span>
        <img src="https://www.svgrepo.com/show/533036/cart-arrow-down.svg" alt="" />
        <b>{t("Place items")}</b>
        <small>{t("Set items on the reader")}</small>
    </div>
    <div className="scan-guide-item scan-guide-review">
        <span className="scan-guide-number">02</span>
        <img src="https://www.svgrepo.com/show/533041/cart-check.svg" alt="" />
        <b>{t("Review cart")}</b>
        <small>{t("Check your items")}</small>
    </div>
    <div className="scan-guide-item scan-guide-payment">
        <span className="scan-guide-number">03</span>
        <img src="https://www.svgrepo.com/show/265743/payment-method-cash.svg" alt="" />
        <b>{t("Proceed to payment")}</b>
        <small>{t("Choose how to pay")}</small>
    </div>
</div>
                    <div className="scan-help-note">
                        <b>{t("Need a hand?")}</b>
                        <span>{t("Request assistance whenever you need it.")}</span>
                    </div>
                    <div className="scan-help-actions">
                        <button
                            className="checkout-action"
                            type="button"
                            onClick={() => setscreen("help")}
                            disabled={!cart.length || Boolean(updatingProduct)}
                        >
                            Help <span>→</span>
                        </button>
                        <button
                            className="checkout-action"
                            type="button"
                            onClick={() => setscreen("review")}
                            disabled={!cart.length || Boolean(updatingProduct)}
                        >
                            Review Cart <span>→</span>
                        </button>
                    </div>
                </aside>
                      )}
                      {screen === "review" && (
                          <aside className="review-your-cart">
                              <h2>{t("Review Your Cart")}</h2>
                              <ul className="review-list">
                                  {cart.map((item) => {
                                      const product = products.find((product) => product.id === item.id);
                                      const stock = product?.stock ?? item.quantity;
                                      return (
                                          <li className="review-item" key={item.id}>
                                              <ProductImage product={item} />
                                              <div className="review-item-info">
                                                  <b>{item.name}</b>
                                                  <span>{money(item.price)} each</span>
                                              </div>
                                              <div className="quantity-controls">
                                                  <button
                                                      type="button"
                                                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                      disabled={Boolean(updatingProduct)}
                                                  >
                                                      −
                                                  </button>
                                                  <span>{item.quantity}</span>
                                                  <button
                                                      type="button"
                                                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                      disabled={Boolean(updatingProduct) || item.quantity >= stock}
                                                  >
                                                      +
                                                  </button>
                                              </div>
                                              <b>{money(item.price * item.quantity)}</b>
                                              <button
                                                  className="remove-item"
                                                  type="button"
                                                  onClick={() => updateQuantity(item.id, 0)}
                                                  disabled={Boolean(updatingProduct)}
                                              >
                                                  ×
                                              </button>
                                          </li>
                                      );
                                  })}
                              </ul>
                              <div className="checkout-totals">
                                  <div>
                                      <span>{t("Subtotal")}</span>
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
                                  <div className="checkout-grand-total">
                                      <b>TOTAL</b>
                                      <b>{money(totals.total)}</b>
                                  </div>
                              </div>
                              <div className="action-row">
                                  <button
                                      className="secondary-action"
                                      type="button"
                                      onClick={() => setscreen("scan")}
                                  >
                                      Back to Scanning
                                  </button>
                                  <button
                                      className="checkout-action"
                                      type="button"
                                      onClick={() => setscreen("loyalty")}
                                      disabled={!cart.length}
                                  >
                                      Proceed to Checkout <span>→</span>
                                  </button>
                              </div>
                          </aside>
                      )}
                      {screen === "loyalty" && (
                          <aside className="loyalty-membership loyalty-panel">
                              <div className="lp-panel-header">
                                  <h2>{account ? t("Your Loyalty Membership") : t("Are You a Member?")}</h2>
                                  <i className="lp-panel-subtitle"><h6>{t("Join our Loyalty Program and start earning Today.")}</h6></i>
                              </div>
                              {account ? (
                                  <div className="loyalty-account-card">
                                      <div className="loyalty-account-details">
                                          <span className="loyalty-account-label">{t("MEMBER ACCOUNT")}</span>
                                          <strong>{account.first_name} {account.last_name}</strong>
                                          <span>{account.email}</span>
                                      </div>
                                      <div className="loyalty-account-points">
                                          <span>{t("LOYALTY POINTS")}</span>
                                          <strong>{Number(account.loyalty_points || 0).toLocaleString(language === "fr" ? "fr-CA" : "en-CA")}</strong>
                                      </div>
                                      {!account.is_member && (
                                          <button className="lp-actions-button" type="button" onClick={enrollMember} disabled={loyaltyLoading}>
                                              {loyaltyLoading ? t("Activating...") : t("Join Loyalty Membership")}
                                          </button>
                                      )}
                                  </div>
                              ) : loyaltyMode === "login" ? (
                                  <>
                                      <p className="loyalty-pitch">{t("Sign in to connect your existing customer account and loyalty points.")}</p>
                                      <div className="loyalty-points-registration">
                                          <div className="lp-email-wrapper">
                                              <label htmlFor="member-email-input" className="form-label">{t("Email")}</label>
                                              <input id="member-email-input" type="email" className="lp-email-input" placeholder={t("Enter your email address")} value={loyaltyEmail} onChange={(event) => setLoyaltyEmail(event.target.value)} autoComplete="email" required />
                                          </div>
                                          <div className="lp-form-field">
                                              <label htmlFor="member-password-input" className="form-label">{t("Password")}</label>
                                              <input id="member-password-input" type="password" value={loyaltyPassword} onChange={(event) => setLoyaltyPassword(event.target.value)} autoComplete="current-password" required />
                                          </div>
                                          <div className="lp-actions">
                                              <button className="lp-actions-button" type="button" onClick={loginMember} disabled={loyaltyLoading || !loyaltyEmail.trim() || !loyaltyPassword}>{loyaltyLoading ? t("Signing in...") : t("Sign In")}</button>
                                              <button className="lp-actions-button" type="button" onClick={() => { setLoyaltyMode("register"); setLoyaltyMessage(""); }}>{t("Create an Account")}</button>
                                          </div>
                                      </div>
                                  </>
                              ) : (
                                  <>
                                      <p className="loyalty-pitch">
                                          {t("Join our Loyalty Program and earn 1 point for every full $1 CAD spent.")}
                                      </p>
                                      <form className="loyalty-points-registration" onSubmit={registerMember}>
                                          <div className="lp-form-field">
                                              <label htmlFor="fname-input" className="form-label">{t("First Name")}</label>
                                              <input id="fname-input" placeholder={t("Ex. John, Jane, Jordan")} required type="text" value={registration.first_name} onChange={(event) => setRegistration({ ...registration, first_name: event.target.value })} autoComplete="given-name" />
                                          </div>
                                          <div className="lp-form-field">
                                              <label htmlFor="lname-input" className="form-label">{t("Last Name")}</label>
                                              <input id="lname-input" placeholder={t("Ex. Smith, Singh, Silva")} required type="text" value={registration.last_name} onChange={(event) => setRegistration({ ...registration, last_name: event.target.value })} autoComplete="family-name" />
                                          </div>
                                          <div className="lp-email-wrapper">
                                              <label htmlFor="lp-email-input" className="form-label">{t("Email")}</label>
                                              <input id="lp-email-input" type="email" className="lp-email-input" placeholder={t("Enter your email here to sign up!")} required value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} autoComplete="email" />
                                          </div>
                                          <div className="lp-form-field">
                                              <label htmlFor="register-password" className="form-label">{t("Password")}</label>
                                              <input id="register-password" type="password" minLength={8} required value={registration.password} onChange={(event) => setRegistration({ ...registration, password: event.target.value })} autoComplete="new-password" />
                                          </div>
                                          <div className="lp-form-field">
                                              <label htmlFor="register-confirm-password" className="form-label">{t("Confirm Password")}</label>
                                              <input id="register-confirm-password" type="password" minLength={8} required value={registration.confirm_password} onChange={(event) => setRegistration({ ...registration, confirm_password: event.target.value })} autoComplete="new-password" />
                                          </div>
                                          <div className="lp-actions">
                                              <button className="lp-actions-button already-lp-member" type="button" onClick={() => { setLoyaltyMode("login"); setLoyaltyMessage(""); }}>{t("Already a Member? Sign In")}</button>
                                              <button className="lp-actions-button register-lp-member" type="submit" disabled={loyaltyLoading}>{loyaltyLoading ? t("Creating Membership...") : t("Register Now")}</button>
                                          </div>
                                      </form>
                                  </>
                              )}
                              {loyaltyMessage && <p className="loyalty-feedback" role="status">{loyaltyMessage}</p>}
                              <div className="action-row loyalty-actions">
                                  <button className="secondary-action" type="button" onClick={() => setscreen("review")}>{t("Back")}</button>
                                  <button className="checkout-action" type="button" onClick={() => setscreen("checkout")}>
                                      {account ? t("Continue to Payment") : t("Continue as Guest")} <span>→</span>
                                  </button>
                              </div>
                          </aside>
                      )}
                      {screen === "checkout" && (
                          <aside className="checkout-cart">
                              <h2>{t("Select a Payment Method")}</h2>
                              <div className="payment-methods">
                                  {[
                                      {
                                          id: "card",
                                          title: "Debit / Credit",
                                          detail: "Pay at the external card terminal",
                                          symbol: "▣",
                                      },
                                      {
                                          id: "cash",
                                          title: "Cash",
                                          detail: "Complete payment with the cashier",
                                          symbol: "＄",
                                      },
                                      {
                                          id: "mobile",
                                          title: "Mobile Payment",
                                          detail: "Use the external payment terminal",
                                          symbol: "▱",
                                      },
                                  ].map((method) => (
                                      <button
                                          className={`payment-method ${paymentMethod === method.id ? "is-selected" : ""}`}
                                          type="button"
                                          key={method.id}
                                          onClick={() => setPaymentMethod(method.id)}
                                      >
                                          <span className="payment-method-symbol">{method.symbol}</span>
                                          <span>
                                              <b>{method.title}</b>
                                              <small>{method.detail}</small>
                                          </span>
                                          <i>{paymentMethod === method.id ? "●" : "○"}</i>
                                      </button>
                                  ))}
                              </div>
                              <div className="payment-instructions">
                                  <b>
                                      {paymentMethod === "cash"
                                          ? "Cash payment"
                                          : paymentMethod === "mobile"
                                              ? "Mobile payment"
                                              : "Debit / credit payment"}
                                  </b>
                                  <p>
                                      {paymentMethod === "cash"
                                          ? "Please take your items and this order summary to the cashier to complete your payment."
                                          : paymentMethod === "mobile"
                                              ? "Follow the prompts on the external payment terminal. This application does not process mobile payments."
                                              : "Please tap, insert, or swipe your card on the external payment terminal. This application does not process card payments."}
                                  </p>
                                  <span>{t("PAYMENT IS NOT PROCESSED BY THIS APPLICATION.")}</span>
                              </div>
                              <div className="checkout-totals compact-totals">
                                  <div>
                                      <span>{t("Total due")}</span>
                                      <b>{money(totals.total)}</b>
                                  </div>
                              </div>
                              <div className="action-row">
                                  <button
                                      className="secondary-action"
                                      type="button"
                                      onClick={() => setscreen("review")}
                                      disabled={processing}
                                  >
                                      Back
                                  </button>
                                  <button
                                      className="checkout-action"
                                      type="button"
                                      onClick={completeCheckout}
                                      disabled={processing || !cart.length}
                                  >
                                      {processing ? t("Processing...") : t("Confirm & Complete Sale")} <span>→</span>
                                  </button>
                              </div>
                          </aside>
                      )}
                  </section>
              )}
              {screen === "complete" && receipt && (
                  <section className="end-session is-visible">
                      <div className="receipt-success">✓</div>
                      <span className="screen-kicker">{t("TRANSACTION COMPLETE")}</span>
                      <h2>{t("Thank You for Shopping!")}</h2>
                      <p className="receipt-subtitle">
                          Please collect your articles and receipt before leaving.
                      </p>
                      <div className="receipt-paper">
                          <div className="receipt-header">
                              <b>SMART TCG STORE</b>
                              <span>{t("SELF-CHECKOUT RECEIPT")}</span>
                              <span>{receipt.date}</span>
                              <span>ORDER #{receipt.number}</span>
                          </div>
                          <div className="receipt-items">
                              {receipt.items.map((item, index) => (
                                  <div className="receipt-item" key={`${item.id}-${index}`}>
                                      <div>
                                          <b>{item.name}</b>
                                          <span>{item.quantity} × {money(item.price)}</span>
                                      </div>
                                      <b>{money(item.price * item.quantity)}</b>
                                  </div>
                              ))}
                          </div>
                          <div className="receipt-totals">
                              <div>
                                  <span>{t("Subtotal")}</span>
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
                                  <b>TOTAL</b>
                                  <b>{money(receipt.totals.total)}</b>
                              </div>
                              {receipt.pointsEarned > 0 && (
                                  <div>
                                      <span>{t("LOYALTY POINTS EARNED")}</span>
                                      <strong>+{receipt.pointsEarned}</strong>
                                  </div>
                              )}
                              <div>
                                  <span>{t("Payment method")}</span>
                                  <span>{receipt.paymentMethod.toUpperCase()}</span>
                              </div>
                          </div>
                      </div>
                      <button
                          className="checkout-action new-sale"
                          type="button"
                          onClick={startNewSale}
                      >
                          Start New Session <span>→</span>
                      </button>
                  </section>
              )}
                                <div className="checkout-botbar">
                      <span className={`reader-status ${sessionStatus === "ACTIVE" ? "is-active" : ""}`}>
                          <span/><i>{statusLabel}</i>
                      </span>
                      <div className="checkout-datetime">
                          <span>
                              {clock.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                              })}
                          </span>
                          <b>
                              {clock.toLocaleTimeString(language === "fr" ? "fr-CA" : "en-CA", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                              })}
                          </b>
                      </div>
                  </div>
          </main>
      );
  };
  export default SelfCheckout;
