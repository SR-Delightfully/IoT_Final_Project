import { useLocation, useNavigate } from "react-router";
import { useState } from "react";

// The backend address can be configured in the frontend .env file.
// If no VITE_API_URL is supplied, the local development server is used.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

/**
 * Displays the small SVG icon used by each payment option.
 * The `type` prop decides which icon is returned.
 */
function PaymentIcon({ type }) {
  // Shared SVG settings so all four icons have the same visual style.
  const common = {
    width: 64,
    height: 64,
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  // Return the SVG drawing that matches the selected payment type.
  switch (type) {
    case "cash":
      return (
        <svg {...common}>
          <rect x="5" y="14" width="54" height="36" rx="4" />
          <circle cx="32" cy="32" r="10" />
          <path d="M12 22h5M47 42h5" />
          <text
            x="32"
            y="37"
            textAnchor="middle"
            fontSize="15"
            fill="currentColor"
            stroke="none"
          >
            $
          </text>
        </svg>
      );

    case "card":
      return (
        <svg {...common}>
          <rect x="5" y="12" width="54" height="40" rx="5" />
          <path d="M5 25h54" />
          <path d="M13 39h17" />
          <path d="M45 39h6" />
        </svg>
      );

    case "gift":
      return (
        <svg {...common}>
          <rect x="8" y="25" width="48" height="32" rx="3" />
          <path d="M5 18h54v11H5z" />
          <path d="M32 18v39" />
          <path d="M32 18C17 18 13 3 22 3c7 0 10 15 10 15Z" />
          <path d="M32 18C47 18 51 3 42 3c-7 0-10 15-10 15Z" />
        </svg>
      );

    case "manual":
      return (
        <svg {...common}>
          <rect x="5" y="6" width="54" height="40" rx="4" />
          <path d="M5 16h54" />
          <path d="M25 56h14M32 46v10" />
          <circle cx="11" cy="11" r="1" fill="currentColor" />
        </svg>
      );

    // An unknown type has no icon to display.
    default:
      return null;
  }
}

function Payment() {
  // Navigation lets this page move to checkout, card entry, or the receipt.
  const navigate = useNavigate();
  // `location.state` contains information passed from the previous page.
  const location = useLocation();

  // The checkout session is needed by the backend to identify the purchase.
  const sessionId = location.state?.sessionId;

  // Track the request state to prevent duplicate payments and show feedback.
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  /**
   * Completes checkout using the payment method selected by the customer.
   * Manual card entry navigates to its own page; the other methods call the API.
   */
  async function completeCheckout(paymentMethod) {
    // Do nothing if the session is missing or a request is already running.
    if (!sessionId || processing) return;

    // Manual card details are handled on the separate Stripe payment page.
    if (paymentMethod === "manual-card") {
      navigate("/self-checkout/process-transaction", {
        state: { sessionId },
      });
      return;
    }

    // Show the processing state and clear any previous error message.
    setProcessing(true);
    setMessage("");

    try {
      // Send the session ID and selected method to the checkout endpoint.
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

      // Parse the response as JSON. Use an empty object if the body is not JSON.
      const data = await response.json().catch(() => ({}));

      // Convert an unsuccessful HTTP response into an error handled below.
      if (!response.ok) {
        throw new Error(data.error || "Could not complete purchase.");
      }

      // Convert the backend response into the structure expected by the receipt.
      const receiptData = {
        number: data.receipt_number,
        date: data.receipt_created_at
          ? new Date(data.receipt_created_at).toLocaleString("en-CA")
          : new Date().toLocaleString("en-CA"),

        // Normalize item values so prices and quantities are numbers.
        items: (data.items || []).map((item) => ({
          id: item.product_id,
          name: item.product_name,
          price: Number(item.product_price) || 0,
          quantity: Number(
            item.session_item_quantity ?? item.quantity
          ) || 0,
        })),

        // Normalize the monetary totals returned by the backend.
        totals: {
          subtotal: Number(data.subtotal) || 0,
          gst: Number(data.gst) || 0,
          qst: Number(data.qst) || 0,
          total: Number(data.total) || 0,
        },

        // Keep the chosen payment method for display on the receipt.
        paymentMethod,
      };

      // Save a copy in session storage in case the receipt page needs it.
      sessionStorage.setItem("receipt", JSON.stringify(receiptData));

      // Open the independent receipt route and pass the receipt data along.
      navigate("/receipt", {
        state: { receipt: receiptData },
      });
    } catch (error) {
      // Display an API or network error without leaving the payment page.
      setMessage(error.message || "Something went wrong.");
    } finally {
      // Re-enable the payment buttons whether the request succeeded or failed.
      setProcessing(false);
    }
  }

  // Return to the checkout page while preserving the current session ID.
  function cancelPayment() {
    navigate("/self-checkout", {
      state: { sessionId },
    });
  }

  // Data for the four buttons. The map below creates one button per entry.
  const paymentOptions = [
    { id: "cash", label: "Cash", icon: "cash" },
    { id: "card", label: "Debit / Credit", icon: "card" },
    { id: "gift-card", label: "Gift Card", icon: "gift" },
    { id: "manual-card", label: "Manual Card Entry", icon: "manual" },
  ];

  return (
    // The page wrapper fills the visible browser area; CSS centers the card.
    <main className="payment-page">
      {/* Main panel containing the heading, payment buttons, and messages. */}
      <section className="payment-card">
        {/* Store name and instructions shown above the payment choices. */}
        <header className="payment-header">
          <span className="payment-eyebrow">SMART TCG STORE</span>
          <h1>SELECT PAYMENT METHOD</h1>
          <p>Choose an option to complete your purchase.</p>
        </header>

        {/* Decorative line separating the heading from the payment buttons. */}
        <div className="payment-divider" />

        {/* Create the four payment buttons from the paymentOptions array. */}
        <div className="payment-grid">
          {paymentOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="payment-option"
              // Disable choices if there is no checkout session or a request is active.
              disabled={!sessionId || processing}
              // Pass this button's payment method to the checkout function.
              onClick={() => completeCheckout(option.id)}
            >
              {/* Render the icon and label associated with this payment method. */}
              <span className="payment-icon">
                <PaymentIcon type={option.icon} />
              </span>
              <span className="payment-label">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Show a status message while the checkout request is being processed. */}
        {processing && (
          <p className="payment-message">Processing transaction...</p>
        )}

        {/* Show an error returned by the API or caused by a network issue. */}
        {message && <p className="payment-error">{message}</p>}

        {/* Explain why payment choices are unavailable if no session was passed in. */}
        {!sessionId && (
          <p className="payment-error">
            No checkout session found. Please return to checkout.
          </p>
        )}
      </section>

      {/* Cancel button stays near the lower-left corner of the visible screen. */}
      <button
        type="button"
        className="payment-cancel"
        onClick={cancelPayment}
        disabled={processing}
      >
        ← Cancel
      </button>
    </main>
  );
}

export default Payment;
