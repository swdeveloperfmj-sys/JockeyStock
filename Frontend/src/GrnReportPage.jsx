import { useEffect, useMemo, useState } from "react";
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

export default function GrnReportPage({ user }) {
  const [records, setRecords] = useState([]);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [expandedId, setExpandedId] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [documentGrn, setDocumentGrn] = useState(null);
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
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({
                      grn,
                      x: Math.min(event.clientX, window.innerWidth - 150),
                      y: Math.min(event.clientY, window.innerHeight - 70),
                    });
                  }}
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
            onClose={() => setDocumentGrn(null)}
          />,
          document.body,
        )}
    </section>
  );
}

function FragmentRow({ grn, expanded, onToggle, onContextMenu }) {
  return (
    <>
      <tr
        className={expanded ? "is-expanded" : ""}
        onContextMenu={onContextMenu}
        title="Right-click to view document"
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

function GrnDocument({ grn, printedBy, onClose }) {
  return (
    <div className="modal-backdrop grn-document-backdrop" onClick={onClose}>
      <section
        className="grn-document-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grn-document-actions">
          <button type="button" onClick={() => window.print()}>
            <FiPrinter /> Print / Save PDF
          </button>
          <button type="button" className="cancel-button" onClick={onClose}>
            <FiX /> Close
          </button>
        </div>
        <article className="grn-print-sheet">
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
