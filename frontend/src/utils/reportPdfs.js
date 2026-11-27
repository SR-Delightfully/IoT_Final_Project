import { currentLang, localeFor, translate } from "./i18n";
import { exportReportPdf } from "./pdf";

// PDF versions of the admin reports and the customer's purchase history.
// Text follows the language picked on the site.

function tools() {
  const lang = currentLang();
  const locale = localeFor(lang);
  return {
    lang,
    t: (text, params) => translate(text, params, lang),
    money: (cents) =>
      new Intl.NumberFormat(locale, { style: "currency", currency: "CAD" }).format((cents || 0) / 100),
  };
}

function period(t, start, end) {
  if (start && end && start === end) return t("Date: {date}", { date: start });
  return t("Period: {start} to {end}", {
    start: start || t("first record"),
    end: end || t("today"),
  });
}

function stockLevelLabel(p, t) {
  const qty = p.quantity_in_stock;
  if (qty <= 0) return t("Out of stock");
  if (qty <= (p.category_low_threshold ?? 5)) return t("Low stock");
  if (qty <= (p.category_moderate_threshold ?? 15)) return t("Moderate stock");
  return t("In stock");
}

export function downloadInventoryPdf(products, { category = "", search = "" } = {}) {
  const { lang, t } = tools();
  const filters = [
    category ? t("Category: {name}", { name: category }) : t("All categories"),
    search ? t("Search: \"{text}\"", { text: search }) : null,
  ].filter(Boolean).join(" · ");

  const low = products.filter((p) => p.quantity_in_stock > 0 && stockLevelLabel(p, t) === t("Low stock"));

  return exportReportPdf({
    lang,
    title: t("Inventory Report"),
    subtitle: filters,
    filename: "inventory-report.pdf",
    summary: [
      [t("Products"), products.length],
      [t("Units in stock"), products.reduce((sum, p) => sum + p.quantity_in_stock, 0)],
      [t("Low stock"), low.length],
      [t("Out of stock"), products.filter((p) => p.quantity_in_stock <= 0).length],
    ],
    tables: [
      {
        title: t("Current Stock"),
        head: [t("ID"), t("Product"), t("Category"), t("Available"), t("Level"), t("Last Restocked")],
        body: products.map((p) => [
          p.product_id,
          p.product_name,
          p.product_category || t("Uncategorized"),
          p.quantity_in_stock,
          stockLevelLabel(p, t),
          p.last_restocked || t("Never recorded"),
        ]),
      },
    ],
  });
}

export function downloadSalesPdf({ report, products, mostSold, leastSold, category, salesCents, unitsSold, chartElement }) {
  const { lang, t, money } = tools();
  const row = (p) => [p.product_id, p.product_name, p.category_name || t("Uncategorized"), p.units_sold];
  const head = [t("ID"), t("Product"), t("Category"), t("Units Sold")];

  return exportReportPdf({
    lang,
    title: t("Sales Report"),
    subtitle: `${period(t, report.start_date, report.end_date)} · ${category || t("All categories")}`,
    filename: "sales-report.pdf",
    summary: [
      [t("Product sales (before tax and discounts)"), money(salesCents)],
      [t("Units sold"), unitsSold],
      [t("Total collected (all categories, with tax)"), money(report.total_sales_cents)],
    ],
    charts: chartElement ? [{ title: t("Daily Product Sales"), element: chartElement }] : [],
    tables: [
      { title: t("Most Sold Products"), head, body: mostSold.map(row) },
      { title: t("Least Sold Products"), head, body: leastSold.map(row) },
      { title: t("Units Sold by Product"), head, body: products.map(row) },
    ],
  });
}

export function downloadCustomerActivityPdf(report, { pieElement, barElement } = {}) {
  const { lang, t } = tools();
  const single = report.start_date === report.end_date;
  const day = (d) => (d ? t("{date} ({count} shopper(s))", { date: d.date, count: d.shoppers }) : "-");

  return exportReportPdf({
    lang,
    title: t("Customer Activity Report"),
    subtitle: period(t, report.start_date, report.end_date),
    filename: "customer-activity-report.pdf",
    summary: [
      [t("Customers who purchased"), report.total_customers],
      [t("New customers"), report.new_customers],
      [t("Returning customers"), report.returning_customers],
      [t("Guest checkouts"), report.guest_checkouts],
      ...(single ? [] : [
        [t("Most crowded day"), day(report.busiest_day)],
        [t("Least crowded day"), day(report.quietest_day)],
      ]),
    ],
    charts: [
      pieElement && { title: t("New vs Returning"), element: pieElement },
      !single && barElement && { title: t("Shoppers per Day"), element: barElement },
    ].filter(Boolean),
    tables: single ? [] : [
      {
        title: t("Daily Activity"),
        head: [t("Date"), t("Customers"), t("Guest Checkouts"), t("Shoppers")],
        body: report.daily.map((d) => [d.date, d.customers, d.guests, d.shoppers]),
      },
    ],
  });
}

function receiptRows(purchase, money) {
  return purchase.items.map((item) => [
    item.purchase_item_name,
    item.purchase_item_quantity,
    money(item.purchase_item_unit_price),
    money(item.purchase_item_unit_price * item.purchase_item_quantity),
  ]);
}

export function downloadPurchaseHistoryPdf(purchases, { startDate, endDate, chartElement } = {}) {
  const { lang, t, money } = tools();
  const paid = purchases.filter((p) => p.purchase_payment_status === "paid");

  return exportReportPdf({
    lang,
    title: t("Purchase History"),
    subtitle: period(t, startDate, endDate),
    filename: "purchase-history.pdf",
    summary: [
      [t("Purchases"), purchases.length],
      [t("Total spent"), money(paid.reduce((sum, p) => sum + p.purchase_total, 0))],
      [t("Points earned"), purchases.reduce((sum, p) => sum + (p.purchase_points_earned || 0), 0)],
    ],
    charts: chartElement ? [{ title: t("Spending Over Time"), element: chartElement }] : [],
    tables: [
      {
        title: t("Receipts"),
        head: [t("Receipt"), t("Date"), t("Items"), t("Points"), t("Total")],
        body: purchases.map((p) => [
          p.receipt_number,
          p.purchase_created_at,
          p.items.map((i) => `${i.purchase_item_name} x${i.purchase_item_quantity}`).join("\n"),
          p.purchase_points_earned,
          money(p.purchase_total),
        ]),
      },
    ],
  });
}

export function downloadReceiptPdf(purchase) {
  const { lang, t, money } = tools();

  return exportReportPdf({
    lang,
    title: t("Receipt {number}", { number: purchase.receipt_number }),
    subtitle: purchase.purchase_created_at,
    filename: `receipt-${purchase.receipt_number}.pdf`,
    summary: [
      [t("Total"), money(purchase.purchase_total)],
      [t("Points earned"), purchase.purchase_points_earned],
      [t("Status"), t(purchase.purchase_payment_status)],
    ],
    tables: [
      {
        title: t("Items"),
        head: [t("Product"), t("Quantity"), t("Unit Price"), t("Amount")],
        body: receiptRows(purchase, money),
      },
    ],
  });
}
