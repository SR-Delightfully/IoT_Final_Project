
import { useLocation, useNavigate } from "react-router";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

// Payment icons
function PaymentIcon({ type }) {
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

    default:
      return null;
  }
}

function Payment() {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionId = location.state?.sessionId;

  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  // Complete checkout with selected method.
  async function completeCheckout(paymentMethod) {
    if (!sessionId || processing) return;

    // Manual entry gets its own Stripe page.
    if (paymentMethod === "manual-card") {
      navigate("/self-checkout/process-transaction", {
        state: { sessionId },
      });
      return;
    }

    // Other options continue through your existing checkout endpoint.
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not complete purchase.");
      }

      const receiptData = {
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
      };

      sessionStorage.setItem("receipt", JSON.stringify(receiptData));

      navigate("/receipt", {
        state: { receipt: receiptData },
      });
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  }

  // Return to checkout with the current session.
  function cancelPayment() {
    navigate("/self-checkout", {
      state: { sessionId },
    });
  }

  const paymentOptions = [
    {
      id: "cash",
      label: "Cash",
      icon: "cash",
    },
    {
      id: "card",
      label: "Debit / Credit",
      icon: "card",
    },
    {
      id: "gift-card",
      label: "Gift Card",
      icon: "gift",
    },
    {
      id: "manual-card",
      label: "Manual Card Entry",
      icon: "manual",
    },
  ];

  return (
    <main className="payment-page">
      <section className="payment-card">

        <header className="payment-header">
          <span className="payment-eyebrow">
            SMART TCG STORE
          </span>

          <h1>SELECT PAYMENT METHOD</h1>

          <p>
            Choose an option to complete your purchase.
          </p>
        </header>

        <div className="payment-divider" />

        {/* 4 payment options */}
        <div className="payment-grid">

          {paymentOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="payment-option"
              disabled={!sessionId || processing}
              onClick={() => completeCheckout(option.id)}
            >
              <span className="payment-icon">
                <PaymentIcon type={option.icon} />
              </span>

              <span className="payment-label">
                {option.label}
              </span>
            </button>
          ))}

        </div>

        {/* Process message or error message */}
        {processing && (
          <p className="payment-message">
            Processing transaction...
          </p>
        )}

        {message && (
          <p className="payment-error">
            {message}
          </p>
        )}

        {!sessionId && (
          <p className="payment-error">
            No checkout session found. Please return to checkout.
          </p>
        )}
      </section>

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
