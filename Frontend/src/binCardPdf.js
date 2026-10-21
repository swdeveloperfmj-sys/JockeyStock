import { jsPDF } from "jspdf";

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const LEFT = 17.55;
const RIGHT = 780.3;
const TABLE_TOP = 156.9;
const HEADER_BOTTOM = 173.55;
const PRODUCT_Y = 185.1;
const FIRST_ROW_Y = 197.65;
const ROW_HEIGHT = 13.2;

const columns = [
  { label: "Document No", x: 18.55, width: 86, align: "left" },
  { label: "Date", x: 108.55, width: 56, align: "left" },
  { label: "Description", x: 168.55, width: 145, align: "left" },
  { label: "Cost Price", x: 357, width: 40, align: "right" },
  { label: "Selling Price", x: 426, width: 50, align: "right" },
  { label: "Received", x: 493, width: 42, align: "right" },
  { label: "Issued", x: 550, width: 42, align: "right" },
  { label: "Cost Value", x: 626, width: 56, align: "right" },
  { label: "Selling Value", x: 710, width: 64, align: "right" },
  { label: "Balance", x: 779, width: 46, align: "right" },
];

const number = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateTime = (value, includeSeconds = true) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
      hour12: true,
    })
    .replace(" ", "");
  return `${datePart}  ${timePart}`;
};

const filterDate = (value) => {
  if (!value) return "All";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const fit = (doc, value, width) => {
  const text = String(value ?? "");
  if (doc.getTextWidth(text) <= width) return text;
  let clipped = text;
  while (clipped.length && doc.getTextWidth(`${clipped}...`) > width) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
};

const movementDescription = (movement) => {
  const description = movement.description || movement.transactionType || "Stock Update";
  return `${movement.transactionType || ""} ${description}`
    .toUpperCase()
    .includes("STOCK ADJUSTMENT")
    ? "SA"
    : description;
};

const drawLabelValue = (doc, label, value, x, valueX, y) => {
  doc.setFont("helvetica", "bold").text(label, x, y);
  doc.setFont("helvetica", "normal").text(String(value ?? ""), valueX, y);
};

const drawHeader = (doc, report, options, pageNo, pageCount) => {
  const product = report.product;
  const productText = `${product.productCode}   ${product.productName}`;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("ROYAL LANKA AGANCIES", LEFT, 22.4);
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  doc.text("-,-,-", LEFT, 34.4);
  doc.setTextColor(0, 0, 255).setFont("helvetica", "bold").setFontSize(14.75);
  doc.text("Bin Card Report", LEFT, 64.2);

  doc.setTextColor(0, 0, 0).setFont("helvetica", "italic").setFontSize(8.2);
  const meta = [
    `Print Date Time - ${dateTime()}`,
    `Printed User - ${options.userName || ""}`,
    `Current Location - ${String(product.location || options.location || "").toUpperCase()}`,
  ];
  meta.forEach((line, index) => doc.text(line, RIGHT, 51.4 + index * 11.9, { align: "right" }));

  doc.setFont("helvetica", "normal").setFontSize(8.2);
  drawLabelValue(doc, "Location", product.location || options.location || "", LEFT, 107.55, 105.9);
  drawLabelValue(
    doc,
    "Date Range",
    `${filterDate(options.from)}  -  ${filterDate(options.to)}`,
    LEFT,
    107.55,
    117.9,
  );
  drawLabelValue(doc, "Product", productText, LEFT, 107.55, 135.9);

  doc.setDrawColor(0).setLineWidth(0.45);
  doc.line(LEFT, TABLE_TOP, RIGHT, TABLE_TOP);
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  columns.forEach((column) => {
    doc.text(column.label, column.x, 168.25, { align: column.align });
  });
  doc.line(LEFT, HEADER_BOTTOM, RIGHT, HEADER_BOTTOM);

  doc.setFont("helvetica", "bold").setFontSize(8.2);
  doc.text(String(product.productCode || ""), 16.8, PRODUCT_Y);
  doc.text(String(product.productName || ""), 179.55, PRODUCT_Y);

  doc.setFont("helvetica", "italic").setFontSize(6.55);
  doc.text(
    "Retail IT Technologies Pvt Ltd. - 0112352326  # NO: 491, Galle Rd, Colombo - 03",
    LEFT,
    591.55,
  );
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  doc.text(`Page ${pageNo} of ${pageCount}`, RIGHT, 593.45, { align: "right" });
};

const drawRow = (doc, movement, product, y) => {
  const quantity = Number(movement.quantityAdded || 0);
  const received = Math.max(0, quantity);
  const issued = Math.max(0, -quantity);
  const units = Math.abs(quantity);
  const costPrice = Number(product.costPrice || 0);
  const sellingPrice = Number(product.sellingPrice || 0);
  const values = [
    movement.documentNo || String(movement._id || "").slice(-8).toUpperCase(),
    dateTime(movement.createdAt),
    movementDescription(movement),
    number(costPrice),
    number(sellingPrice),
    number(received),
    number(issued),
    number(units * costPrice),
    number(units * sellingPrice),
    number(movement.resultingStock),
  ];

  doc.setFont("helvetica", "normal").setFontSize(8.2);
  values.forEach((value, index) => {
    const column = columns[index];
    doc.text(fit(doc, value, column.width), column.x, y, { align: column.align });
  });
};

const drawTotals = (doc, movements, top) => {
  const totals = movements.reduce(
    (sum, movement) => {
      const quantity = Number(movement.quantityAdded || 0);
      sum.received += Math.max(0, quantity);
      sum.issued += Math.max(0, -quantity);
      return sum;
    },
    { received: 0, issued: 0 },
  );
  const receivedX = 493;
  const issuedX = 550;
  doc.setDrawColor(0).setLineWidth(0.35);
  doc.line(436, top, 554, top);
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  doc.text(number(totals.received), receivedX, top + 11, { align: "right" });
  doc.text(number(totals.issued), issuedX, top + 11, { align: "right" });
  doc.line(436, top + 15.15, 554, top + 15.15);
  doc.line(436, top + 17.15, 554, top + 17.15);
  doc.line(436, top + 18.15, 554, top + 18.15);
  doc.text(number(totals.received), receivedX, top + 29.15, { align: "right" });
  doc.text(number(totals.issued), issuedX, top + 29.15, { align: "right" });
  doc.line(436, top + 33.3, 554, top + 33.3);
  doc.line(436, top + 35.3, 554, top + 35.3);
};

export function createBinCardPdf(report, options = {}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    compress: true,
    putOnlyUsedFonts: true,
  });
  const movements = report.movements || [];
  const perPage = 25;
  const pages = movements.length
    ? Array.from({ length: Math.ceil(movements.length / perPage) }, (_, index) =>
        movements.slice(index * perPage, (index + 1) * perPage),
      )
    : [[]];

  pages.forEach((pageRows, pageIndex) => {
    if (pageIndex) doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
    drawHeader(doc, report, options, pageIndex + 1, pages.length);
    pageRows.forEach((movement, index) =>
      drawRow(doc, movement, report.product, FIRST_ROW_Y + index * ROW_HEIGHT),
    );
    if (pageIndex === pages.length - 1) {
      const lastRowY = pageRows.length
        ? FIRST_ROW_Y + (pageRows.length - 1) * ROW_HEIGHT
        : PRODUCT_Y;
      drawTotals(doc, movements, lastRowY + 4.2);
    }
  });

  return doc.output("blob");
}
