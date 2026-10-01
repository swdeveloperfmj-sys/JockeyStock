import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiChevronDown,
  FiEye,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const apiFetch = (input, options = {}) =>
  window.fetch(input, { ...options, credentials: "include" });
const money = (value) =>
  `LKR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const amountNumber = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const displayDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "—";

const downloadReportElement = async (element, grnNumber) => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: 1200,
    onclone: (clonedDocument) => {
      const sheet = clonedDocument.querySelector("[data-grn-pdf-sheet]");
      if (sheet) sheet.classList.add("is-pdf-export");
    },
  });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  const image = canvas.toDataURL("image/jpeg", 0.96);
  let remaining = imageHeight;
  let position = margin;
  pdf.addImage(image, "JPEG", margin, position, pageWidth, imageHeight, undefined, "FAST");
  remaining -= pageHeight;
  while (remaining > 0) {
    pdf.addPage();
    position = margin - (imageHeight - remaining);
    pdf.addImage(image, "JPEG", margin, position, pageWidth, imageHeight, undefined, "FAST");
    remaining -= pageHeight;
  }
  const safeNumber = String(grnNumber || "grn").replace(/[^a-z0-9_-]/gi, "-");
  pdf.save(`${safeNumber}.pdf`);
};

export default function GrnReportPage({ user }) {
  const [records, setRecords] = useState([]);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [expandedId, setExpandedId] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [documentGrn, setDocumentGrn] = useState(null);
  const [autoDownload, setAutoDownload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (range = dates) => {
    if (range.from && range.to && range.from > range.to) {
      setError("From date cannot be after To date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (range.from) query.set("from", range.from);
      if (range.to) query.set("to", range.to);
      const response = await apiFetch(
        `${API_URL}/grns${query.size ? `?${query}` : ""}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load GRNs.");
      setRecords(data);
      setExpandedId("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ from: "", to: "" });
  }, []);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") close();
    };
    // A mobile long-press emits a trailing click after `contextmenu`.
    // Register outside-click slightly later so that click cannot instantly
    // dismiss the menu that was just opened.
    const outsideClickTimer = window.setTimeout(
      () => window.addEventListener("click", close),
      500,
    );
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(outsideClickTimer);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const summary = useMemo(
    () =>
      records.reduce(
        (total, grn) => ({
          lineItems: total.lineItems + (grn.items?.length || 0),
          quantity: total.quantity + Number(grn.totalQuantity || 0),
          amount: total.amount + Number(grn.totalAmount || 0),
        }),
        { lineItems: 0, quantity: 0, amount: 0 },
      ),
    [records],
  );

  const resetDates = () => {
    const empty = { from: "", to: "" };
    setDates(empty);
    load(empty);
  };

  const openContextMenu = (grn, x, y) => {
    setContextMenu({
      grn,
      x: Math.max(8, Math.min(x, window.innerWidth - 150)),
      y: Math.max(8, Math.min(y, window.innerHeight - 70)),
    });
  };

  return (
    <section className="grn-report-page">
      <div className="grn-report-title">
        <div>
          <p className="eyebrow">INVENTORY &amp; SALES · TRANSACTION INQUIRY</p>
          <h2>Goods Received Note (GRN)</h2>
          <p>View saved GRNs and expand a row to inspect its received items.</p>
        </div>
      </div>

      <form
        className="grn-report-filters"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <label>
          From date
          <input
            type="date"
            value={dates.from}
            max={dates.to || undefined}
            onChange={(event) =>
              setDates((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={dates.to}
            min={dates.from || undefined}
            onChange={(event) =>
              setDates((current) => ({ ...current, to: event.target.value }))
            }
          />
        </label>
        <button type="submit" disabled={loading}>
          <FiSearch /> {loading ? "Loading..." : "Filter"}
        </button>
        <button type="button" className="cancel-button" onClick={resetDates}>
          <FiRefreshCw /> Clear
        </button>
      </form>

      {error && <p className="dashboard-error">{error}</p>}

      <div className="grn-report-summary">
        <article><span>Total GRNs</span><strong>{records.length}</strong></article>
        <article><span>Line Items</span><strong>{summary.lineItems}</strong></article>
        <article><span>Total Qty</span><strong>{summary.quantity.toLocaleString()}</strong></article>
        <article><span>Total Amount</span><strong>{money(summary.amount)}</strong></article>
      </div>

      <div className="grn-report-table-wrap">
        <table className="grn-report-table">
          <thead>
            <tr>
              <th>GRN No</th>
              <th>GRN Date</th>
              <th>Supplier Code</th>
              <th>Supplier Name</th>
              <th>Location</th>
              <th>Items</th>
              <th>Total Qty</th>
              <th>Total Amount</th>
              <th>Created By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loading && records.length === 0 && (
              <tr className="grn-report-empty"><td colSpan="10">No GRNs found for the selected date range.</td></tr>
            )}
            {records.map((grn) => {
              const expanded = expandedId === grn._id;
              return (
                <FragmentRow
                  key={grn._id}
                  grn={grn}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? "" : grn._id)}
                  onOpenMenu={(x, y) => openContextMenu(grn, x, y)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {contextMenu && (
        <div
          className="grn-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAutoDownload(window.matchMedia("(max-width: 760px)").matches);
              setDocumentGrn(contextMenu.grn);
              setContextMenu(null);
            }}
          >
            <FiEye /> View
          </button>
        </div>
      )}
      {documentGrn &&
        createPortal(
          <GrnDocument
            grn={documentGrn}
            printedBy={user.name}
            autoDownload={autoDownload}
            onClose={() => {
              setDocumentGrn(null);
              setAutoDownload(false);
            }}
          />,
          document.body,
        )}
    </section>
  );
}

function FragmentRow({ grn, expanded, onToggle, onOpenMenu }) {
  const longPressTimer = useRef(null);
  const pressOrigin = useRef(null);
  const clearLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  useEffect(() => clearLongPress, []);
  const startLongPress = (event) => {
    if (event.pointerType === "mouse") return;
    clearLongPress();
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    longPressTimer.current = window.setTimeout(() => {
      onOpenMenu(event.clientX, event.clientY);
      longPressTimer.current = null;
    }, 550);
  };
  const moveLongPress = (event) => {
    if (!pressOrigin.current) return;
    if (
      Math.abs(event.clientX - pressOrigin.current.x) > 10 ||
      Math.abs(event.clientY - pressOrigin.current.y) > 10
    ) clearLongPress();
  };
  return (
    <>
      <tr
        className={expanded ? "is-expanded" : ""}
        onPointerDown={startLongPress}
        onPointerMove={moveLongPress}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(event) => {
          event.preventDefault();
          clearLongPress();
          onOpenMenu(event.clientX || window.innerWidth / 2, event.clientY || window.innerHeight / 2);
        }}
        title="Right-click or long-press to view document"
      >
        <td><strong>{grn.grnNumber}</strong></td>
        <td>{displayDate(grn.grnDate)}</td>
        <td>{grn.supplierCode}</td>
        <td>{grn.supplierName}</td>
        <td>{grn.location}</td>
        <td>{grn.items?.length || 0}</td>
        <td>{Number(grn.totalQuantity || 0).toLocaleString()}</td>
        <td>{money(grn.totalAmount)}</td>
        <td>{grn.createdByName}</td>
        <td>
          <button
            type="button"
            className={`grn-report-expand${expanded ? " is-open" : ""}`}
            onClick={onToggle}
            aria-label={`${expanded ? "Hide" : "Show"} ${grn.grnNumber} details`}
          >
            <FiChevronDown />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="grn-report-detail-row">
          <td colSpan="10">
            <div className="grn-report-detail">
              <div className="grn-report-meta">
                <span>Remarks <b>{grn.remarks || "—"}</b></span>
                <span>Saved <b>{new Date(grn.createdAt).toLocaleString()}</b></span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Qty</th>
                    <th>Cost Price</th>
                    <th>Selling Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(grn.items || []).map((item, index) => (
                    <tr key={`${item.productId}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{item.productCode}</td>
                      <td>{item.productName}</td>
                      <td>{Number(item.quantity).toLocaleString()}</td>
                      <td>{money(item.costPrice)}</td>
                      <td>{money(item.sellingPrice)}</td>
                      <td>{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function GrnDocument({ grn, printedBy, autoDownload, onClose }) {
  const sheetRef = useRef(null);
  const autoDownloadStarted = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    if (!sheetRef.current || downloading) return;
    setDownloading(true);
    try {
      await document.fonts?.ready;
      await downloadReportElement(sheetRef.current, grn.grnNumber);
      if (autoDownload) onClose();
    } catch (error) {
      console.error("Unable to download GRN PDF", error);
    } finally {
      setDownloading(false);
    }
  };
  useEffect(() => {
    if (!autoDownload || autoDownloadStarted.current) return undefined;
    autoDownloadStarted.current = true;
    const timer = window.setTimeout(downloadPdf, 150);
    return () => window.clearTimeout(timer);
  }, [autoDownload]);
  return (
    <div className="modal-backdrop grn-document-backdrop" onClick={onClose}>
      <section
        className="grn-document-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grn-document-actions">
          <button type="button" onClick={autoDownload ? downloadPdf : () => window.print()} disabled={downloading}>
            <FiPrinter /> {downloading ? "Preparing PDF..." : "Print / Save PDF"}
          </button>
          <button type="button" className="cancel-button" onClick={onClose}>
            <FiX /> Close
          </button>
        </div>
        <article className="grn-print-sheet" ref={sheetRef} data-grn-pdf-sheet={grn._id}>
          <header className="grn-document-header">
            <div className="grn-document-brand">
              <strong>ROYAL LANKA AGENCIES</strong>
              <small>-''-</small>
              <h1>Goods Received Note</h1>
            </div>
            <div className="grn-document-print-info">
              <strong>Duplicate</strong>
              <span>Print Date Time - {new Date().toLocaleString()}</span>
              <span>Printed User - {printedBy}</span>
              <span>Current Location - {grn.location}</span>
              <span>Created User - {grn.createdByName}</span>
            </div>
          </header>

          <section className="grn-document-fields">
            <div>
              <p><b>Document</b><span>{grn.grnNumber}</span></p>
              <p><b>Date</b><span>{displayDate(grn.grnDate)}</span></p>
              <p><b>Remark</b><span>{grn.remarks || "—"}</span></p>
            </div>
            <div>
              <p><b>Supplier</b><span>{grn.supplierCode}</span></p>
              <p><b>Supplier Name</b><span>{grn.supplierName}</span></p>
            </div>
            <div>
              <p><b>Location</b><span>{grn.location}</span></p>
              <p><b>Created By</b><span>{grn.createdByName}</span></p>
            </div>
          </section>

          <table className="grn-document-items">
            <thead>
              <tr>
                <th>Pro.Code</th>
                <th>Pro.Name</th>
                <th>Qty</th>
                <th>C.Price</th>
                <th>S.Price</th>
                <th>Net Amt.</th>
              </tr>
            </thead>
            <tbody>
              {(grn.items || []).map((item, index) => (
                <tr key={`${item.productId}-${index}`}>
                  <td>{item.productCode}</td>
                  <td>{item.productName}</td>
                  <td>{amountNumber(item.quantity)}</td>
                  <td>{amountNumber(item.costPrice)}</td>
                  <td>{amountNumber(item.sellingPrice)}</td>
                  <td>{amountNumber(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td></td>
                <td>{amountNumber(grn.totalQuantity)}</td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <section className="grn-document-total">
            <div><span>No. of Items</span><strong>{grn.items?.length || 0}</strong></div>
            <div><span>Total Qty</span><strong>{amountNumber(grn.totalQuantity)}</strong></div>
            <div><span>Gross Amt.</span><strong>{amountNumber(grn.totalAmount)}</strong></div>
            <div className="is-net"><span>Net Amt.</span><strong>{amountNumber(grn.totalAmount)}</strong></div>
          </section>

          <footer className="grn-document-footer">
            <div className="grn-signature-group">
              <p><span></span><b>Issuer's Name</b></p>
              <p><span></span><b>Issuer's Signature</b></p>
            </div>
            <div className="grn-signature-group">
              <p><span></span><b>Recipient's Name</b></p>
              <p><span></span><b>Recipient's Signature</b></p>
              <p><span></span><b>Manager / Asst Signature</b></p>
            </div>
          </footer>
        </article>
      </section>
    </div>
  );
}
