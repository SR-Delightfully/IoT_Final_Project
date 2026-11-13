import { authHeaders } from "./auth";

const API = import.meta.env.VITE_API_URL;

// account info, points and purchase history for whoever is logged in
export async function fetchAccount() {
  const res = await fetch(`${API}/me/account`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load account");
  return data;
}

export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(timestamp) {
  return timestamp ? timestamp.split(" ")[0] : "";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// one row per item, so the file is easy to sort and total in a spreadsheet
export function downloadPurchasesCsv(purchases) {
  const header = [
    "Receipt",
    "Date",
    "Status",
    "Item",
    "Quantity",
    "Unit Price",
    "Purchase Total",
    "Points Earned",
  ];

  const rows = [];

  for (const p of purchases) {
    const base = [p.receipt_number, formatDate(p.purchase_created_at), p.purchase_payment_status];
    const tail = [formatPrice(p.purchase_total), p.purchase_points_earned];

    if (p.items.length === 0) {
      rows.push([...base, "", "", "", ...tail]);
    }

    for (const item of p.items) {
      rows.push([
        ...base,
        item.purchase_item_name,
        item.purchase_item_quantity,
        formatPrice(item.purchase_item_unit_price),
        ...tail,
      ]);
    }
  }

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `purchase-history-${new Date().toLocaleDateString("en-CA")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
