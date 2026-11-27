import { useEffect, useState } from "react";
import {
  fetchAccount,
  fetchProductHistory,
  formatDateTime,
  formatPrice,
} from "../utils/purchases";
import ProductPriceChart from "./ProductPriceChart";

function ProductHistory() {
  const [purchases, setPurchases] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchAccount()
      .then((data) => setPurchases(data.purchases))
      .catch((err) => setError(err.message));
  }, []);

  // List each purchased product once.
  const productsById = {};

  for (const purchase of purchases || []) {
    if (purchase.purchase_payment_status !== "paid") continue;

    for (const item of purchase.items) {
      productsById[item.product_id] = {
        product_id: item.product_id,
        product_name: item.purchase_item_name,
      };
    }
  }

  // Match names without requiring the same capitalization.
  const matchingProducts = Object.values(productsById).filter((product) =>
    product.product_name.toLowerCase().includes(search.trim().toLowerCase())
  );

  function loadProductHistory(productId) {
    setReport(null);
    setReportError("");
    setReportLoading(true);

    fetchProductHistory(productId)
      .then(setReport)
      .catch((err) => setReportError(err.message))
      .finally(() => setReportLoading(false));
  }

  return (
    <section className="account-section product-history-section">
      <h2 className="account-section-title">Product Purchase History</h2>

      {error || !purchases ? (
        <p className="points-next">
          {error || "Loading purchased products..."}
        </p>
      ) : (
        <>
          <div className="form-field">
            <label htmlFor="product-history-search">
              Search a purchased product
            </label>
            <input
              id="product-history-search"
              type="search"
              placeholder="Enter a product name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {matchingProducts.length === 0 ? (
            <p className="points-next">No matching purchased products.</p>
          ) : (
            <ul className="purchase-items">
              {matchingProducts.map((product) => (
                <li key={product.product_id}>
                  <button
                    type="button"
                    className="account-button"
                    onClick={() => loadProductHistory(product.product_id)}
                    disabled={reportLoading}
                  >
                    {product.product_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {reportLoading && (
        <p className="points-next">Loading product history...</p>
      )}

      {reportError && (
        <p className="points-next">{reportError}</p>
      )}

      {report && (
        <div>
          <h3 className="account-section-title">
            {report.history[0]?.product_name || "Product History"}
          </h3>

          <p className="points-next">
            Purchased in {report.purchase_count} separate purchases.
            {" "}Total units: {report.total_quantity}.
          </p>

          {report.history.length === 0 ? (
            <p className="points-next">No purchases found for this product.</p>
          ) : (
            <ul className="purchase-items">
              {report.history.map((item, index) => (
                <li key={index}>
                  <span>
                    {formatDateTime(item.purchase_created_at)}
                    {" — "}Qty: {item.purchase_item_quantity}
                  </span>
                  <span>
                    {formatPrice(item.purchase_item_unit_price_cents)} each
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ProductPriceChart history={report.history} />
        </div>
      )}
    </section>
  );
}

export default ProductHistory;