import { useEffect, useState } from "react";
import { downloadPurchasesCsv, fetchAccount, formatDate, formatPrice } from "../utils/purchases";

function Purchases() {
  const [purchases, setPurchases] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAccount()
      .then((data) => setPurchases(data.purchases))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="account-page">
      <div className="account-card">
        <div className="account-card-body">
          <h1 className="account-title">Purchase History</h1>

          {error || !purchases ? (
            <p className="account-subtitle">
              <i>{error || "loading your purchases..."}</i>
            </p>
          ) : (
            <>
              <div className="purchases-header">
                <p className="points-next">
                  {purchases.length} purchase{purchases.length === 1 ? "" : "s"}
                </p>
                {purchases.length > 0 && (
                  <button
                    type="button"
                    className="account-button"
                    onClick={() => downloadPurchasesCsv(purchases)}
                  >
                    Download CSV
                  </button>
                )}
              </div>

              {purchases.length === 0 ? (
                <p className="points-next">No purchases yet.</p>
              ) : (
                <div className="purchase-list">
                  {purchases.map((p) => (
                    <article key={p.purchase_id} className="purchase-card">
                      <div className="purchase-card-top">
                        <span className="purchase-receipt">{p.receipt_number}</span>
                        <span>{formatDate(p.purchase_created_at)}</span>
                      </div>

                      <ul className="purchase-items">
                        {p.items.length === 0 ? (
                          <li>-</li>
                        ) : (
                          p.items.map((item, i) => (
                            <li key={i}>
                              <span>
                                {item.purchase_item_name} x{item.purchase_item_quantity}
                              </span>
                              <span>
                                {formatPrice(item.purchase_item_unit_price * item.purchase_item_quantity)}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>

                      <div className="purchase-card-bottom">
                        <span
                          className={`history-status history-status-${p.purchase_payment_status}`}
                        >
                          {p.purchase_payment_status}
                        </span>
                        <span className="history-points">+{p.purchase_points_earned} pts</span>
                        <span className="purchase-total">{formatPrice(p.purchase_total)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="account-links">
        <a href="/account">Back to account</a>
      </div>
    </main>
  );
}

export default Purchases;
