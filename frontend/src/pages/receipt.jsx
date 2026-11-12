
import { useLocation, useNavigate } from "react-router";

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(amount) || 0);

function Receipt() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get checkout page data.
  // Get sessionStorage for refreshes.
  const receipt =
    location.state?.receipt ||
    JSON.parse(sessionStorage.getItem("receipt") || "null");

  function startNewSale() {
    sessionStorage.removeItem("receipt");
    navigate("/self-checkout");
  }

  // Receipt page with no receipt data.
  if (!receipt) {
    return (
      <main className="self-checkout-page">
        <section className="receipt">
          <h1>No receipt found</h1>
          <p className="muted">
            There is no completed transaction to display.
          </p>

          <button
            className="primary new-sale"
            type="button"
            onClick={() => navigate("/self-checkout")}
          >
            Return to self-checkout
          </button>
        </section>
      </main>
    );
  }

  // Receipt page with receipt data.
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
              <div
                className="receipt-item"
                key={`${item.id}-${index}`}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.quantity} × {money(item.price)}
                  </span>
                </div>

                <strong>
                  {money(item.price * item.quantity)}
                </strong>
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

export default Receipt;
