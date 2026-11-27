import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { localeFor, translate } from "./i18n";

const STORE_NAME = "TCG:GO";
const ACCENT = [138, 106, 28];   // dark gold, readable on white
const MARGIN = 14;

// Copy a Recharts chart (SVG) into an image for the PDF. The chart's colours are
// CSS variables, so each element gets its real computed colour first, and the
// text is made dark because the PDF page is white.
export async function chartToImage(container, width = 900) {
  const svg = container?.querySelector("svg.recharts-surface");
  if (!svg) return null;

  const clone = svg.cloneNode(true);
  const original = svg.querySelectorAll("*");
  const copies = clone.querySelectorAll("*");

  original.forEach((node, i) => {
    const style = getComputedStyle(node);
    const copy = copies[i];
    copy.setAttribute("fill", style.fill);
    copy.setAttribute("stroke", style.stroke);
    copy.removeAttribute("style");
    if (node.tagName.toLowerCase() === "text" || node.tagName.toLowerCase() === "tspan") {
      copy.setAttribute("fill", "#333333");
      copy.setAttribute("font-family", "Helvetica, Arial, sans-serif");
      copy.setAttribute("font-size", "12");
    }
  });

  const box = svg.getBoundingClientRect();
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", box.width);
  clone.setAttribute("height", box.height);

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" })
  );

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const scale = width / box.width;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(box.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // JPEG keeps the file small; the chart sits on a white background anyway.
    return { data: canvas.toDataURL("image/jpeg", 0.92), ratio: canvas.height / canvas.width };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function header(doc, title, subtitle, t, locale) {
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, width, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text(STORE_NAME, MARGIN, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    t("Generated {date}", { date: new Date().toLocaleString(locale) }),
    width - MARGIN,
    13,
    { align: "right" }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(25);
  doc.text(title, MARGIN, 24);

  let y = 24;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    y += 6;
    doc.text(subtitle, MARGIN, y);
  }
  return y + 6;
}

function sectionTitle(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT);
  doc.text(text, MARGIN, y);
  return y + 3;
}

function ensureSpace(doc, y, needed) {
  if (y + needed > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage();
    return 18;
  }
  return y;
}

function footer(doc, t) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`${STORE_NAME} · ${t("Smart Store")}`, MARGIN, height - 8);
    doc.text(t("Page {page} of {pages}", { page, pages }), width - MARGIN, height - 8, {
      align: "right",
    });
  }
}

// Build and download a report PDF.
//   summary: [[label, value], ...]
//   charts:  [{ title, element }]     (element = the DOM node around a chart)
//   tables:  [{ title, head: [...], body: [[...], ...] }]
export async function exportReportPdf({
  title,
  subtitle = "",
  summary = [],
  charts = [],
  tables = [],
  filename = "report.pdf",
  lang,
}) {
  const t = (text, params) => translate(text, params, lang);
  const locale = localeFor(lang);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;

  let y = header(doc, title, subtitle, t, locale);

  if (summary.length) {
    autoTable(doc, {
      startY: y,
      body: summary.map(([label, value]) => [label, String(value)]),
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 1.8 },
      columnStyles: {
        0: { textColor: 90, cellWidth: 70 },
        1: { fontStyle: "bold", textColor: 20 },
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  for (const chart of charts) {
    const image = await chartToImage(chart.element);
    if (!image) continue;
    const height = contentWidth * image.ratio;
    y = ensureSpace(doc, y, height + 10);
    y = sectionTitle(doc, chart.title, y);
    doc.addImage(image.data, "JPEG", MARGIN, y + 2, contentWidth, height);
    y += height + 10;
  }

  for (const table of tables) {
    y = ensureSpace(doc, y, 24);
    y = sectionTitle(doc, table.title, y);
    autoTable(doc, {
      startY: y + 2,
      head: [table.head],
      body: table.body.length ? table.body : [[{ content: t("No data"), colSpan: table.head.length }]],
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: ACCENT, textColor: 255 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  footer(doc, t);
  doc.save(filename);
}
