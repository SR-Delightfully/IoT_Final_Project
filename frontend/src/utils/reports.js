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
    ["Product ID", "Product Name", "Category", "Available Quantity", "Last Restocked"],
    ...products.map((p) => [
      p.product_id,
      p.product_name,
      p.product_category || "Uncategorized",
      p.quantity_in_stock,
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