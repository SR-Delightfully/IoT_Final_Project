import { forwardRef, useEffect, useState } from "react";
import { IMaskInput } from "react-imask";
import { downloadPurchasesCsv, fetchAccount, formatDate, formatPrice } from "../utils/purchases";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Date input with fixed dashes and alsi it will be digit only .
const MaskedDateInput = forwardRef(function MaskedDateInput(
  { value, onChange, ...props },
  ref
) {
  return (
    <IMaskInput
      {...props}
      inputRef={ref}
      mask="YYYY-MM-DD"
      blocks={{
        YYYY: { mask: "0000", placeholderChar: "y" },
        MM: { mask: "00", placeholderChar: "m" },
        DD: { mask: "00", placeholderChar: "d" },
      }}
      lazy={false}
      placeholderChar="_"
      value={value || ""}
      onAccept={(maskedValue, mask, event) => {
        if (event) {
          onChange(event);
        }
      }}
    />
  );
});

function Purchases() {
  const [purchases, setPurchases] = useState(null);
  const [error, setError] = useState("");
  // Store the dates selected in the calendar inputs.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
 // Today's local date in YYYY-MM-DD format for the calendar limits.
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");


  useEffect(() => {
    fetchAccount()
      .then((data) => setPurchases(data.purchases))
      .catch((err) => setError(err.message));
  }, []);
// Convert a calendar selection to YYYY-MM-DD for our filters.
function formatFilterDate(selectedDate) {
  if (!selectedDate) return "";

  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const day = String(selectedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
  // Request purchases using the dates selected in the calendars.
  function applyFilters() {
  setError("");
  // Make sure the typed dates match dates accepted by the calendars.
for (const [inputId, selectedDate] of [
  ["start-date", startDate],
  ["end-date", endDate],
]) {
  const inputValue = document.getElementById(inputId).value;
  const typedDate = inputValue === "yyyy-mm-dd" || inputValue.trim() === "" ? "": inputValue;

  if (
    (typedDate && !/^\d{4}-\d{2}-\d{2}$/.test(typedDate)) ||
    typedDate !== selectedDate
  ) {
    setError("Enter a valid date in YYYY-MM-DD format, or clear the field.");
    return;
  }
}

  // Check both dates against the allowed range.
  for (const selectedDate of [startDate, endDate]) {
    if (selectedDate && (selectedDate < "1950-01-01" || selectedDate > today)) {
      setError("Dates must be between 1950-01-01 and today.");
      return;
    }
  }

  if (startDate && endDate && startDate > endDate) {
    setError("Start date must be on or before end date.");
    return;
  }

  setPurchases(null);

  fetchAccount(startDate, endDate)
    .then((data) => setPurchases(data.purchases))
    .catch((err) => setError(err.message));
}
  return (
    <main className="account-page">
      <div className="account-card">
        <div className="account-card-body">
          <h1 className="account-title">Purchase History</h1>
          <div className="purchase-date-filters">
            <div className="form-field">
              <label htmlFor="start-date">Start date</label>

              <DatePicker
                id="start-date"
                selected={startDate ? new Date(`${startDate}T00:00:00`) : null}
                onChange={(selectedDate) => setStartDate(formatFilterDate(selectedDate))}
                dateFormat="yyyy-MM-dd"
                customInput={<MaskedDateInput />}
                strictParsing                
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                placeholderText="YYYY-MM-DD"
                minDate={new Date(1950, 0, 1)}
                maxDate={new Date()}
                isClearable

              />
            </div>

            <div className="form-field">
              <label htmlFor="end-date">End date</label>

              <DatePicker
                id="end-date"
                selected={endDate ? new Date(`${endDate}T00:00:00`) : null}
                onChange={(selectedDate) => setEndDate(formatFilterDate(selectedDate))}
                dateFormat="yyyy-MM-dd"
                customInput={<MaskedDateInput />}
                strictParsing
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                placeholderText="YYYY-MM-DD"
                minDate={startDate ? new Date(`${startDate}T00:00:00`) : new Date(1950, 0, 1)}
                maxDate={new Date()}
                isClearable
              />
            </div>
          </div>
          

          <button
            type="button"
            className="account-button"
            onClick={applyFilters}
            disabled={purchases === null && !error}
          >
            Apply filters
          </button>
          {error || !purchases ? (
            <p className="account-subtitle purchase-filter-message">
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