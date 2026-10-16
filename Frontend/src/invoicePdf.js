const COMPANY = {
  name: "Royal Lanka Agencies (Pvt) Ltd.",
  address: "289, Galle Road, Henamulla, Panadura, 12550, Sri Lanka",
  phones: "+94 38 2232 976  |  +94 38 2238 217  |  +94 38 7211 928",
  fax: "+94 38 2298 200",
  email: "fmjholdings@fmjgp.lk",
  tin: "114338192",
};

const money = (value) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDate = (date) => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(date);

const invoiceNumberFor = (order, date) => {
  const orderDigits = String(order.orderNumber || order._id || "1").replace(/\D/g, "").slice(-7).padStart(7, "0");
  return `I${String(date.getFullYear()).slice(-2)}${orderDigits}`;
};

export async function createShipmentInvoicePdf(order, issuedByName = "") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 10;
  const invoiceDate = new Date();
  const creditDays = Number.parseInt(order.customerPaymentTerm, 10) || 30;
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + creditDays);
  const invoiceNumber = invoiceNumberFor(order, invoiceDate);

  const drawHeader = (continuation = false) => {
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(COMPANY.name, 88, 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.text(COMPANY.address, 88, 15, { align: "center" });
    doc.text(`T  : ${COMPANY.phones}`, 88, 19, { align: "center" });
    doc.text(`F  : ${COMPANY.fax}`, 88, 23, { align: "center" });
    doc.text(`E  : ${COMPANY.email}`, 88, 27, { align: "center" });

    doc.setLineWidth(0.35);
    doc.rect(145, 12, 55, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(continuation ? "INVOICE - CONTINUED" : "SALES ORDER / INVOICE", 172.5, 18.5, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`TIN No: ${COMPANY.tin}`, 172.5, 27, { align: "center" });
  };

  const drawCustomerBlock = () => {
    const customerText = [
      order.customerCode,
      order.customerName,
      order.customerBranchName && order.customerBranchName !== "Billing address" ? `- ${order.customerBranchName}` : "",
      order.customerAddress ? `- ${order.customerAddress}` : "",
    ].filter(Boolean).join(" ");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Customer", margin, 42);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(customerText, 92), 38, 42);

    doc.setFont("helvetica", "bold");
    doc.text("S/O_INV_DATE", 138, 36);
    doc.text("S/O_INV_NO", 138, 44);
    doc.setFont("helvetica", "normal");
    doc.text(shortDate(invoiceDate), 166, 36);
    doc.text(invoiceNumber, 166, 44);
  };

  const drawTableHeading = (y) => {
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Pro.Code", margin, y + 5);
    doc.text("Pro.Name", 39, y + 5);
    doc.text("Qty", 123, y + 5, { align: "right" });
    doc.text("S.Price", 148, y + 5, { align: "right" });
    doc.text("Net Amt.", 200, y + 5, { align: "right" });
    doc.line(margin, y + 8, pageWidth - margin, y + 8);
    return y + 13;
  };

  drawHeader();
  drawCustomerBlock();
  let y = drawTableHeading(57);
  doc.setFontSize(7.5);

  order.items.forEach((item) => {
    if (y > 225) {
      doc.addPage();
      drawHeader(true);
      y = drawTableHeading(34);
    }
    doc.setFont("helvetica", "normal");
    doc.text(String(item.productCode || "-"), margin, y);
    doc.setFont("helvetica", "bold");
    const productName = doc.splitTextToSize(String(item.productName || "-"), 72)[0];
    doc.text(productName, 39, y);
    doc.setFont("helvetica", "normal");
    doc.text(money(item.quantity), 123, y, { align: "right" });
    doc.text(money(item.unitPrice), 148, y, { align: "right" });
    doc.text(money(item.total), 200, y, { align: "right" });
    y += 6;
  });
  doc.line(margin, y - 2, pageWidth - margin, y - 2);

  const grossAmount = order.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const discountPercent = Number(order.customerDiscount || 0);
  const discountAmount = grossAmount * discountPercent / 100;
  const subTotal = grossAmount - discountAmount;
  const netAmount = subTotal / 1.18;
  const vatAmount = subTotal - netAmount;
  let summaryTop;
  if (y + 8 > 176) {
    doc.addPage();
    drawHeader(true);
    summaryTop = 55;
  } else {
    summaryTop = y + 8;
  }
  const summaryX = 145;
  const valueX = 198;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Gross Amt.", summaryX, summaryTop);
  doc.text("Dis.%", summaryX, summaryTop + 6);
  doc.text("Dis.Amt.", summaryX, summaryTop + 12);
  doc.setFont("helvetica", "normal");
  doc.text(money(grossAmount), valueX, summaryTop, { align: "right" });
  doc.text(money(discountPercent), valueX, summaryTop + 6, { align: "right" });
  doc.text(money(discountAmount), valueX, summaryTop + 12, { align: "right" });
  doc.rect(143, summaryTop + 15, 57, 13);
  doc.setFont("helvetica", "bold");
  doc.text("Net Amount", summaryX, summaryTop + 20);
  doc.text("VAT +18%", summaryX, summaryTop + 26);
  doc.text("Sub Total", summaryX, summaryTop + 34);
  doc.setFont("helvetica", "normal");
  doc.text(money(netAmount), valueX, summaryTop + 20, { align: "right" });
  doc.text(money(vatAmount), valueX, summaryTop + 26, { align: "right" });
  doc.text(money(subTotal), valueX, summaryTop + 34, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Payment Type", 16, summaryTop + 20);
  doc.text("Cheque No", 52, summaryTop + 20);
  doc.text("Bank", 84, summaryTop + 20);
  doc.setFont("helvetica", "normal");
  doc.text("CREDIT", 16, summaryTop + 29);
  doc.text("DEFAULT", 84, summaryTop + 29);

  const commentsTop = summaryTop + 44;
  doc.rect(14, commentsTop, 63, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Comments", 16, commentsTop + 6);
  doc.setFontSize(7);
  doc.text("Credit Period", 16, commentsTop + 14);
  doc.text("Due Date", 16, commentsTop + 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(String(creditDays), 48, commentsTop + 14);
  doc.text("Days", 57, commentsTop + 14);
  doc.text(shortDate(dueDate), 48, commentsTop + 21);

  const signatureY = commentsTop + 45;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(6, signatureY, 32, signatureY);
  doc.line(68, signatureY, 94, signatureY);
  doc.line(132, signatureY, 162, signatureY);
  doc.line(168, signatureY, 198, signatureY);
  doc.setLineDashPattern([], 0);
  const issuedBy = String(issuedByName || "").trim();
  if (issuedBy) {
    doc.setFont("helvetica", "normal");
    let issuedByFontSize = 6.8;
    doc.setFontSize(issuedByFontSize);
    while (doc.getTextWidth(issuedBy) > 25 && issuedByFontSize > 4.5) {
      issuedByFontSize -= 0.3;
      doc.setFontSize(issuedByFontSize);
    }
    doc.text(issuedBy, 19, signatureY - 2, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("ISSUED BY", 19, signatureY + 5, { align: "center" });
  doc.text("AUTHORIZED BY", 81, signatureY + 5, { align: "center" });
  doc.text("CUSTOMER NAME", 147, signatureY + 5, { align: "center" });
  doc.text("SIGNATURE", 183, signatureY + 5, { align: "center" });

  const safeOrderNumber = String(order.orderNumber || "invoice").replace(/[^a-z0-9_-]/gi, "-");
  return {
    blob: doc.output("blob"),
    fileName: `Invoice-${safeOrderNumber}.pdf`,
    invoiceNumber,
  };
}
