const PAGE = { width: 612, height: 792, left: 14.4, right: 597.6 };
const ROW_HEIGHT = 16.35;
const ROWS_PER_PAGE = 5;

const number = (value) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const date = (value) => new Date(value).toLocaleDateString("en-GB");

const dateTime = (value) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}:${part("second")}${part("dayPeriod").toUpperCase()}`;
};

const fit = (doc, value, width) => {
  const text = String(value ?? "");
  if (doc.getTextWidth(text) <= width) return text;
  let shortened = text;
  while (shortened.length && doc.getTextWidth(`${shortened}...`) > width) shortened = shortened.slice(0, -1);
  return `${shortened}...`;
};

export async function createStockAdjustmentPdf(adjustment, products = []) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", putOnlyUsedFonts: true });
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const items = adjustment.items || [];
  const pages = Array.from({ length: Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE)) }, (_, index) => items.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE));
  const modes = [...new Set(items.map((item) => item.adjustmentType === "ADD" ? "Add Stock" : "Reduce Stock"))].join(" / ");
  const totalSelling = items.reduce((sum, item) => sum + Math.abs(Number(item.quantityAdded)) * Number(productById.get(String(item.productId))?.sellingPrice || 0), 0);
  const totalCost = items.reduce((sum, item) => sum + Math.abs(Number(item.quantityAdded)) * Number(productById.get(String(item.productId))?.costPrice || 0), 0);

  const text = (value, x, y, options) => doc.text(String(value ?? ""), x, y, options);
  const setRegular = (size = 7.35, style = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(0, 0, 0); };
  const detail = (label, value, labelX, valueX, y) => {
    setRegular(7.35, "bold"); text(label, labelX, y);
    setRegular(7.35); text(fit(doc, value, 105), valueX, y);
  };

  const drawPage = (pageItems, pageIndex) => {
    if (pageIndex) doc.addPage("letter", "portrait");
    setRegular(9, "bold"); text("ROYAL LANKA AGANCIES", 14.4, 24.85);
    setRegular(8.2); text("-,-,-", 14.4, 35.9);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14.75); doc.setTextColor(0, 0, 255); text("Stock Adjustment", 14.4, 55.55);

    setRegular(8.2, "italic"); doc.setTextColor(128, 128, 128); text("Duplicate", PAGE.right, 47.9, { align: "right" });
    setRegular(8.2, "italic");
    text(`Print Date Time - ${dateTime(new Date())}`, PAGE.right, 59.4, { align: "right" });
    text(`Printed User - ${adjustment.managerName || ""}`, PAGE.right, 70.65, { align: "right" });
    text(`Current Location - ${adjustment.location || ""}`, PAGE.right, 81.9, { align: "right" });
    text(`Created User - ${adjustment.managerName || ""}`, PAGE.right, 93.15, { align: "right" });

    detail("Document", adjustment.documentNo, 20.4, 96.9, 105.4);
    detail("Date", date(adjustment.createdAt), 20.4, 96.9, 120.05);
    detail("Narration", items[0]?.reason || "Stock Adjustment", 20.4, 96.9, 134.7);
    detail("Remark", items[0]?.remark || "", 20.4, 96.9, 149.35);
    detail("Reference No", adjustment.documentNo, 410.4, 489.6, 105.4);
    detail("Adjustment Mode", modes, 410.4, 489.6, 120.05);
    detail("Location", adjustment.location, 410.4, 489.6, 134.7);
    detail("Adjustment Type", "Default", 410.4, 489.6, 149.35);

    doc.setLineWidth(0.5); doc.line(PAGE.left, 160.25, PAGE.right, 160.25);
    setRegular(7.35, "bold");
    const headings = [
      ["Pro.Code", 20.4], ["Pro.Name", 96.9], ["Unit", 249.15], ["Cur:QTY", 288.15],
      ["New Qty", 330.6], ["V:Qty", 374.9], ["S.Price", 414.25], ["C.Price", 463],
      ["S.Value", 513.5], ["C.Value", 568.6],
    ];
    headings.forEach(([heading, x]) => text(heading, x, 174.25));
    doc.line(PAGE.left, 181.75, PAGE.right, 181.75);

    setRegular(7.35);
    pageItems.forEach((item, index) => {
      const y = 192.7 + index * ROW_HEIGHT;
      const product = productById.get(String(item.productId));
      const variance = Number(item.quantityAdded || 0);
      const current = Number(item.resultingStock || 0) - variance;
      const selling = Number(product?.sellingPrice || 0);
      const cost = Number(product?.costPrice || 0);
      text(fit(doc, item.productCode, 70), 20.4, y);
      text(fit(doc, item.productName, 145), 96.9, y);
      text("Nos", 249.15, y);
      text(number(current), 326, y, { align: "right" });
      text(number(item.resultingStock), 370, y, { align: "right" });
      text(number(variance), 410, y, { align: "right" });
      text(number(selling), 460, y, { align: "right" });
      text(number(cost), 510, y, { align: "right" });
      text(number(Math.abs(variance) * selling), 562, y, { align: "right" });
      text(number(Math.abs(variance) * cost), 597.6, y, { align: "right" });
    });
    const tableBottom = 198.1 + Math.max(0, pageItems.length - 1) * ROW_HEIGHT;
    doc.line(PAGE.left, tableBottom, PAGE.right, tableBottom);

    const isLastPage = pageIndex === pages.length - 1;
    if (isLastPage) {
      setRegular(7.35);
      text("Tot. S.Value", 426, tableBottom + 13);
      text("Tot. C.Value", 426, tableBottom + 25);
      text(number(totalSelling), PAGE.right, tableBottom + 13, { align: "right" });
      text(number(totalCost), PAGE.right, tableBottom + 25, { align: "right" });

      doc.setLineDashPattern([2, 2], 0);
      doc.line(26.4, 302.25, 98.4, 302.25);
      doc.line(26.4, 352.25, 98.4, 352.25);
      doc.line(428.4, 302.25, 536.4, 302.25);
      doc.line(428.4, 352.25, 536.4, 352.25);
      doc.line(428.4, 402.25, 536.4, 402.25);
      doc.setLineDashPattern([], 0);
      setRegular(7.35);
      text("Issuer's Name", 62.4, 312, { align: "center" });
      text("Issuer's Signature", 62.4, 362, { align: "center" });
      text("Recipient's Name", 482.4, 312, { align: "center" });
      text("Recipient's Signature", 482.4, 362, { align: "center" });
      text("Manager / Asst Signature", 482.4, 412, { align: "center" });
    }

    setRegular(6.55, "italic");
    text("Retail IT Technologies Pvt Ltd. - 0112352326  # NO: 491, Galle Rd, Colombo - 03", 14.4, 767.4);
    setRegular(8.2); text(`Page ${pageIndex + 1} of ${pages.length}`, 597.6, 769.3, { align: "right" });
  };

  pages.forEach(drawPage);
  return doc.output("blob");
}
