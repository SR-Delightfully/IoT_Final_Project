import { authHeaders } from "./auth";

const API = import.meta.env.VITE_API_URL;

// Request the inventory report using the logged-in user's token.
export async function fetchInventoryReport() {
  const res = await fetch(`${API}/admin/reports/inventory`, {
    headers: authHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || "Could not load inventory report");
    error.status = res.status;
    throw error;
  }

  return data;
}
// Download the inventory rows currently displayed in the table.
export function downloadInventoryCsv(products) {
  const rows = [
    ["Product ID", "Product Name", "Category", "Available Quantity", "Stock Level", "Last Restocked"],
    ...products.map((p) => [
      p.product_id,
      p.product_name,
      p.product_category || "Uncategorized",
      p.quantity_in_stock,
      p.quantity_in_stock <= 0
        ? "Out of stock"
        : p.quantity_in_stock <= (p.category_low_threshold ?? 5)
          ? "Low"
          : p.quantity_in_stock <= (p.category_moderate_threshold ?? 15)
            ? "Moderate"
            : "OK",
      p.last_restocked || "Never recorded",
    ]),
  ];

  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");


  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}
// Request sales data for an optional date range.
export async function fetchSalesReport(startDate = "", endDate = "") {
  const params = new URLSearchParams();

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${API}/admin/reports/sales?${params}`, {
    headers: authHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || "Could not load sales report");
    error.status = res.status;
    throw error;
  }

  return data;
}
// Export report dates, overall totals and the filtered product quantities.
export function downloadSalesCsv(report, products, category, salesCents, unitsSold) {
  const rows = [
    ["Sales Report"],
    ["Start Date", report.start_date || "No start limit"],
    ["End Date", report.end_date || "No end limit"],
    ["Product Category", category || "All categories"],
    ["Product Sales CAD — Before Tax and Purchase-Level Discounts",
      (salesCents / 100).toFixed(2)],
    ["Units Sold — Selected Category", unitsSold],
    [],
    ["Product ID", "Product Name", "Category", "Units Sold"],
    ...products.map((p) => [
      p.product_id,
      p.product_name,
      p.category_name || "Uncategorized",
      p.units_sold,
    ]),
  ];

  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "sales-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}
// Check the typed date fields against the accepted calendar dates.
// Returns an error message, or "" when the filters are valid.
export function checkDateFilters(startDate, endDate) {
  for (const [id, selectedDate] of [
    ["start-date", startDate],
    ["end-date", endDate],
  ]) {
    const text = document.getElementById(id)?.value ?? "";
    const typedDate = text === "yyyy-mm-dd" ? "" : text.trim();

    if (
      typedDate !== selectedDate ||
      (selectedDate &&
        (selectedDate < "1950-01-01" ||
          new Date(`${selectedDate}T00:00:00`) > new Date()))
    ) {
      return "Enter a valid date between 1950-01-01 and today.";
    }
  }

  if (startDate && endDate && startDate > endDate) {
    return "Start date must be on or before end date.";
  }

  return "";
}

// Request the customer activity report for an optional date range.
export async function fetchCustomerActivity(startDate = "", endDate = "") {
  const params = new URLSearchParams();

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${API}/admin/reports/customers?${params}`, {
    headers: authHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || "Could not load customer activity report");
    error.status = res.status;
    throw error;
  }

  return data;
}

// Export the customer activity totals and the per-day counts.
export function downloadCustomerActivityCsv(report) {
  const rows = [
    ["Customer Activity Report"],
    ["Start Date", report.start_date],
    ["End Date", report.end_date],
    ["Total Customers", report.total_customers],
    ["New Customers", report.new_customers],
    ["Returning Customers", report.returning_customers],
    ["Guest Checkouts", report.guest_checkouts],
    ["Busiest Day", report.busiest_day?.date ?? "", report.busiest_day?.shoppers ?? ""],
    ["Quietest Day", report.quietest_day?.date ?? "", report.quietest_day?.shoppers ?? ""],
    [],
    ["Date", "Customers", "Guest Checkouts", "Shoppers"],
    ...report.daily.map((d) => [d.date, d.customers, d.guests, d.shoppers]),
  ];

  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "customer-activity-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}
