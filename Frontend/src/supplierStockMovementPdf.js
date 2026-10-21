import { jsPDF } from "jspdf";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const LEFT = 18;
const RIGHT = PAGE_WIDTH - 18;
const TABLE_WIDTH = RIGHT - LEFT;
const HEADER_HEIGHT = 42;
const number = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const date = (value) => {
  if (!value) return "All";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const fit = (doc, value, width) => {
  let text = String(value ?? "");
  if (doc.getTextWidth(text) <= width) return text;
  while (text.length && doc.getTextWidth(`${text}...`) > width)
    text = text.slice(0, -1);
  return `${text}...`;
};

const identityFields = [
  { key: "supplierCode", label: "Supplier", width: 108 },
  { key: "productName", label: "Product", width: 150 },
];

const fields = [
  { key: "purchaseQuantity", label: "Qty", width: 56, align: "right" },
  { key: "purchaseValue", label: "Value", width: 72, align: "right" },
  { key: "returnQuantity", label: "Qty", width: 56, align: "right" },
  { key: "returnValue", label: "Value", width: 72, align: "right" },
  { key: "netPurchaseQuantity", label: "Qty", width: 60, align: "right" },
  { key: "netPurchaseValue", label: "Value", width: 72, align: "right" },
  { key: "salesQuantity", label: "Qty", width: 56, align: "right" },
  { key: "salesValue", label: "Value", width: 72, align: "right" },
  { key: "salesReturnQuantity", label: "Qty", width: 56, align: "right" },
  { key: "salesReturnValue", label: "Value", width: 72, align: "right" },
  { key: "netSalesQuantity", label: "Qty", width: 56, align: "right" },
  { key: "netSalesCost", label: "Value (Cost)", width: 72, align: "right" },
  { key: "netSalesValue", label: "Value (Selling)", width: 76, align: "right" },
  { key: "stockQuantity", label: "Qty", width: 56, align: "right" },
  { key: "stockValue", label: "Value (Cost)", width: 72, align: "right" },
];

const groups = [
  { label: "PURCHASE", start: 2, count: 2 },
  { label: "PURCHASE RETURN", start: 4, count: 2 },
  { label: "NET PURCHASE", start: 6, count: 2 },
  { label: "SALES", start: 8, count: 2 },
  { label: "SALES RETURN", start: 10, count: 2 },
  { label: "NET SALES", start: 12, count: 3 },
  { label: "STOCK", start: 15, count: 2 },
];

const columns = (() => {
  const identityWidth = identityFields.reduce(
    (sum, field) => sum + field.width,
    0,
  );
  const metricWidth = fields.reduce((sum, field) => sum + field.width, 0);
  const scale = TABLE_WIDTH / (identityWidth + metricWidth);
  const identityWidths = identityFields.map((field) => field.width * scale);
  const metricWidths = fields.map((field) => field.width * scale);

  return [
    ...identityFields.map((field, index) => ({
      ...field,
      x:
        LEFT +
        identityWidths.slice(0, index).reduce((sum, width) => sum + width, 0),
      width: identityWidths[index],
    })),
    ...fields.map((field, index) => ({
      ...field,
      x:
        LEFT +
        identityWidth * scale +
        metricWidths.slice(0, index).reduce((sum, width) => sum + width, 0),
      width: metricWidths[index],
    })),
  ];
})();

const sumRows = (rows) =>
  fields.reduce((totals, field) => {
    totals[field.key] = rows.reduce(
      (sum, row) => sum + Number(row[field.key] || 0),
      0,
    );
    return totals;
  }, {});

const rowValues = (row) => [
  row.supplierCode,
  row.productName,
  ...fields.map((field) => number(row[field.key])),
];

export function createSupplierWiseStockMovementPdf(report, options = {}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  const supplierGroups = report.suppliers || [];
  const outputRows = [];

  supplierGroups.forEach((supplier) => {
    outputRows.push({
      type: "supplier",
      values: rowValues({
        supplierCode: `${supplier.supplierCode}  ${supplier.supplierName || ""}`,
        ...supplier.totals,
      }),
    });
    supplier.products.forEach((product) => {
      outputRows.push({
        type: "product",
        values: rowValues({
          ...product,
          productName: `${product.productCode || ""} ${product.productName || ""}`.trim(),
        }),
      });
    });
  });

  if (supplierGroups.length) {
    outputRows.push({
      type: "grand-total",
      values: rowValues({
        supplierCode: "Grand Total",
        ...sumRows(supplierGroups.map((supplier) => supplier.totals)),
      }),
    });
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("ROYAL LANKA AGANCIES", LEFT, 25);
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  doc.text("-,-,-", LEFT, 37);

  doc.setTextColor(0, 0, 255).setFont("helvetica", "bold").setFontSize(14.75);
  doc.text("SUPPLIER MOVEMENT REPORT", LEFT, 65);

  const location = options.location || "ALL LOCATIONS";
  doc.setTextColor(0, 0, 0).setFont("helvetica", "italic").setFontSize(8.2);
  doc.text(
    `Print Date Time - ${new Date().toLocaleString("en-GB")}`,
    RIGHT,
    48,
    { align: "right" },
  );
  doc.text(`Printed User - ${options.userName || ""}`, RIGHT, 60, {
    align: "right",
  });
  doc.text(`Current Location - ${location.toUpperCase()}`, RIGHT, 72, {
    align: "right",
  });

  doc.setFont("helvetica", "normal").setFontSize(8.2);
  doc.text(`Supplier  ${options.supplierCode || "All suppliers"}`, LEFT, 99);
  doc.text(`Date From  ${date(options.from)}`, LEFT, 112);
  doc.text(`Date To  ${date(options.to)}`, LEFT, 125);
  doc.text(`Location  ${location}`, LEFT, 138);

  const tableTop = 176;
  const footerY = PAGE_HEIGHT - 20;
  const availableRowsHeight = footerY - tableTop - HEADER_HEIGHT - 8;
  const rowHeight = Math.min(
    20,
    availableRowsHeight / Math.max(1, outputRows.length),
  );
  const rowFontSize = Math.max(4.25, Math.min(8, rowHeight * 0.38));

  doc.setFillColor(225, 238, 247);
  doc.rect(LEFT, tableTop, TABLE_WIDTH, HEADER_HEIGHT, "F");
  doc.setDrawColor(75).setLineWidth(0.65);
  doc.rect(LEFT, tableTop, TABLE_WIDTH, HEADER_HEIGHT);
  doc.setFont("helvetica", "bold").setFontSize(7.2).setTextColor(0, 0, 0);

  identityFields.forEach((field, index) => {
    const column = columns[index];
    doc.text(field.label, column.x + column.width / 2, tableTop + 29, {
      align: "center",
    });
  });
  groups.forEach((group) => {
    const first = columns[group.start];
    const last = columns[group.start + group.count - 1];
    doc.text(group.label, (first.x + last.x + last.width) / 2, tableTop + 14, {
      align: "center",
    });
  });
  fields.forEach((field, index) => {
    const column = columns[index + identityFields.length];
    doc.text(field.label, column.x + column.width / 2, tableTop + 34, {
      align: "center",
    });
  });
  doc.line(LEFT, tableTop + 20, RIGHT, tableTop + 20);
  doc.line(LEFT, tableTop + HEADER_HEIGHT, RIGHT, tableTop + HEADER_HEIGHT);

  let y = tableTop + HEADER_HEIGHT;
  outputRows.forEach((row, rowIndex) => {
    if (row.type === "supplier" || row.type === "grand-total") {
      doc.setFillColor(
        ...(row.type === "grand-total" ? [201, 235, 241] : [225, 239, 249]),
      );
      doc.rect(LEFT, y, TABLE_WIDTH, rowHeight, "F");
    } else if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 251, 253);
      doc.rect(LEFT, y, TABLE_WIDTH, rowHeight, "F");
    }
    doc.setDrawColor(150).setLineWidth(0.35);
    doc.line(LEFT, y + rowHeight, RIGHT, y + rowHeight);
    doc.setTextColor(0, 0, 0);
    doc
      .setFont("helvetica", row.type === "product" ? "normal" : "bold")
      .setFontSize(rowFontSize);

    row.values.forEach((value, index) => {
      const column = columns[index];
      const text = fit(doc, value, column.width - 8);
      const baseline = y + rowHeight * 0.68;
      if (column.align === "right") {
        doc.text(text, column.x + column.width - 4, baseline, {
          align: "right",
        });
      } else {
        doc.text(text, column.x + 4, baseline);
      }
    });
    y += rowHeight;
  });

  const tableBottom = y;
  columns.slice(1).forEach((column, index) => {
    const isGroupBoundary = groups.some(
      (group) =>
        group.start === index + 1 ||
        group.start + group.count === index + 1,
    );
    doc
      .setDrawColor(isGroupBoundary ? 75 : 175)
      .setLineWidth(isGroupBoundary ? 0.8 : 0.35)
      .line(column.x, tableTop, column.x, tableBottom);
  });

  if (!supplierGroups.length) {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(
      "No supplier movements match the selected filters.",
      LEFT + 4,
      tableBottom + 16,
    );
  }

  doc.setFont("helvetica", "italic").setFontSize(6.55);
  doc.text(
    "Retail IT Technologies Pvt Ltd. - 0112352326  # NO: 491, Galle Rd, Colombo - 03",
    LEFT,
    footerY,
  );
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  doc.text("Page 1 of 1", RIGHT, footerY, { align: "right" });

  return doc.output("blob");
}
