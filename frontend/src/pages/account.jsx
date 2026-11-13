import { useEffect, useState } from "react";
import {
  downloadPurchasesCsv,
  fetchAccount,
  formatDate,
  formatPrice,
} from "../utils/purchases";

const TIERS = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 500 },
  { name: "Gold", min: 1500 },
  { name: "Mythic", min: 3000 },
];

function getTierInfo(points) {
  let current = TIERS[0];
  let next = null;

  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) {
      current = TIERS[i];
      next = TIERS[i + 1] || null;
    }
  }

  const progress = next
    ? Math.round(((points - current.min) / (next.min - current.min)) * 100)
    : 100;

  return { current, next, progress };
}

function Account() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAccount()
      .then(setAccount)
      .catch((err) => setError(err.message));
  }, []);

  if (error || !account) {
    return (
      <main className="account-page">
        <div className="account-card">
          <div className="account-card-body">
            <h1 className="account-title">Your Account</h1>
            <p className="account-subtitle">
              <i>{error || "loading your account..."}</i>
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { customer, purchases } = account;
  const points = account.points || 0;
  const { current, next, progress } = getTierInfo(points);

  const totalSpent = purchases
    .filter((p) => p.purchase_payment_status === "paid")
    .reduce((sum, p) => sum + p.purchase_total, 0);

  return (
    <main className="account-page">
      <div className="account-card">
        <div className="account-card-body">
          <a
            href="/account/settings"
            className="account-button account-settings-button"
          >
            Settings
          </a>

          <h1 className="account-title">Your Account</h1>

          <p className="account-subtitle">
            <i> welcome back, {customer.user_fname}.</i>
          </p>

          {customer.customer_code && (
            <p className="account-member">Member #{customer.customer_code}</p>
          )}

          <section className="account-section">
            <h2 className="account-section-title">Account Points</h2>

            <div className="points-summary">
              <div className="points-stat">
                <span className="form-label">Points</span>
                <span className="points-value">{points.toLocaleString()}</span>
              </div>

              <div className="points-stat">
                <span className="form-label">Tier</span>
                <span className="points-value">{current.name}</span>
              </div>

              <div className="points-stat">
                <span className="form-label">Total Spent</span>
                <span className="points-value">{formatPrice(totalSpent)}</span>
              </div>
            </div>

            <div className="points-bar">
              <div
                className="points-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="points-next">
              {next
                ? `${(next.min - points).toLocaleString()} points until ${next.name}`
                : "You have reached the highest tier!"}
            </p>
          </section>

          <section className="account-section">
            <h2 className="account-section-title">Purchase History</h2>

            {purchases.length === 0 ? (
              <p className="points-next">No purchases yet.</p>
            ) : (
              <div className="history-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.slice(0, 5).map((p) => (
                      <tr key={p.purchase_id}>
                        <td>{p.receipt_number}</td>
                        <td>{formatDate(p.purchase_created_at)}</td>
                        <td>
                          {p.items.length === 0
                            ? "-"
                            : p.items
                                .map(
                                  (item) =>
                                    `${item.purchase_item_name} x${item.purchase_item_quantity}`,
                                )
                                .join(", ")}
                        </td>
                        <td
                          className={`history-status history-status-${p.purchase_payment_status}`}
                        >
                          {p.purchase_payment_status}
                        </td>
                        <td>{formatPrice(p.purchase_total)}</td>
                        <td className="history-points">
                          +{p.purchase_points_earned}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {purchases.length > 0 && (
              <div className="history-actions">
                <a href="/account/purchases" className="account-button">
                  See all purchases
                </a>
                <button
                  type="button"
                  className="account-button"
                  onClick={() => downloadPurchasesCsv(purchases)}
                >
                  Download purchase history
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
      <div className="account-links">
        <a href="/home">Back to home</a>
      </div>
    </main>
  );
}

export default Account;
