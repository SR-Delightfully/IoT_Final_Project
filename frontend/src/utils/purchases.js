import { authHeaders } from "./auth";
import { currentLang, localeFor, translate } from "./i18n";
import { localDate, localDateTime } from "./time";


const API = import.meta.env.VITE_API_URL;

// account info, points and purchase history for whoever is logged in, optional filtering by date
export async function fetchAccount(startDate = "", endDate = "") {
  // Include only the date filters the user selected.
  const params = new URLSearchParams(); //query parameters

  if (startDate) {
    params.set("start_date", startDate);
  }

  if (endDate) {
    params.set("end_date", endDate);
  }
    const queryString = params.toString();
  let url = `${API}/me/account`;

  if (queryString) {
    url += `?${queryString}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load account");
  return data;
}

// $12.99 in English, 12,99 $ in French
export function formatPrice(cents) {
  return new Intl.NumberFormat(localeFor(currentLang()), {
    style: "currency",
    currency: "CAD",
  }).format((cents || 0) / 100);
}

// Database times are UTC; show them in the store's local time.
export function formatDate(timestamp) {
  return localDate(timestamp);
}

export function formatDateTime(timestamp) {
  return localDateTime(timestamp);
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
  ].map((label) => translate(label));

  const rows = [];

  for (const p of purchases) {
    const base = [p.receipt_number, formatDate(p.purchase_created_at), translate(p.purchase_payment_status)];
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
export async function fetchProductHistory(productId, startDate = "", endDate = "") {
  const params = new URLSearchParams({ product_id: productId });

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${API}/me/account/product-history?${params}`, {
    headers: authHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Could not load product history");
  }

  return data;
}