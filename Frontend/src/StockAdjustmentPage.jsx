import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  FiDownload,
  FiPlusCircle,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import { createStockAdjustmentPdf } from "./stockAdjustmentPdf.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const REASONS = [
  "Stock count correction",
  "Damaged stock",
  "Missing stock",
  "Found stock",
  "Data entry correction",
  "Other",
];

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState([]),
    [records, setRecords] = useState([]),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    productId: "",
    adjustmentType: "ADD",
    quantity: "",
    reason: "",
    remark: "",
  });
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filter, setFilter] = useState({
    search: "",
    type: "",
    reason: "",
    from: "",
    to: "",
  });
  const load = async () => {
    try {
      const query = new URLSearchParams();
      if (filter.from) query.set("from", filter.from);
      if (filter.to) query.set("to", filter.to);
      const [productsResponse, recordsResponse] = await Promise.all([
        fetch(`${API_URL}/products`, { credentials: "include" }),
        fetch(`${API_URL}/stock-adjustments?${query}`, {
          credentials: "include",
        }),
      ]);
      const productsData = await productsResponse.json(),
        recordsData = await recordsResponse.json();
      if (!productsResponse.ok)
        throw new Error(productsData.message || "Could not load products.");
      if (!recordsResponse.ok)
        throw new Error(
          recordsData.message || "Could not load adjustment audit.",
        );
      setProducts(productsData);
      setRecords(recordsData);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    }
  };
  useEffect(() => {
    load();
  }, [filter.from, filter.to]);
  const selectedProduct = products.find(
    (product) => product._id === form.productId,
  );
  const selectScannedProduct = (value) => {
    const code = String(value).trim();
    const product = products.find((item) =>
      [item.productCode, item.sku, item.barcode]
        .filter(Boolean)
        .map(String)
        .includes(code),
    );
    setProductSearch(value);
    setForm((current) => ({ ...current, productId: product?._id || "" }));
    setError(
      product || !code
        ? ""
        : "No product was found for that item code / barcode.",
    );
  };
  const rows = useMemo(
    () =>
      records.filter((record) => {
        const text =
          `${record.productCode} ${record.productName} ${record.reason} ${record.remark} ${record.managerName}`.toLowerCase();
        return (
          (!filter.search || text.includes(filter.search.toLowerCase())) &&
          (!filter.type || record.adjustmentType === filter.type) &&
          (!filter.reason || record.reason === filter.reason)
        );
      }),
    [records, filter],
  );
  const documents = useMemo(
    () =>
      Object.values(
        rows.reduce((groups, record) => {
          const key = record.documentNo || record._id;
          if (!groups[key])
            groups[key] = {
              documentNo: record.documentNo || "Legacy adjustment",
              createdAt: record.createdAt,
              managerName: record.managerName,
              location: record.location,
              items: [],
            };
          groups[key].items.push(record);
          return groups;
        }, {}),
      ),
    [rows],
  );
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const batch = form.productId ? [...items, form] : items;
    if (!batch.length) {
      setError("Add at least one product adjustment.");
      return;
    }
    if (form.productId && (!form.quantity || !form.reason)) {
      setError(
        "Complete the current item or add it to the adjustment list first.",
      );
      return;
    }
    try {
      const response = await fetch(`${API_URL}/stock-adjustments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: batch.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not save stock adjustment.");
      setForm({
        productId: "",
        adjustmentType: "ADD",
        quantity: "",
        reason: "",
        remark: "",
      });
      setProductSearch("");
      setItems([]);
      await load();
    } catch (submitError) {
      setError(submitError.message);
    }
  };
  const addCurrentItem = () => {
    if (!form.productId || !form.quantity || !form.reason) {
      setError("Select a product, quantity and reason before adding.");
      return;
    }
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) =>
          item.productId === form.productId &&
          item.adjustmentType === form.adjustmentType,
      );
      if (existingIndex < 0) return [...current, { ...form }];
      return current.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity: Number(item.quantity) + Number(form.quantity),
              reason: form.reason || item.reason,
              remark: form.remark || item.remark,
            }
          : item,
      );
    });
    setForm({
      productId: "",
      adjustmentType: "ADD",
      quantity: "",
      reason: "",
      remark: "",
    });
    setProductSearch("");
    setError("");
  };
  const download = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((record) => ({
        Date: new Date(record.createdAt).toLocaleString(),
        "Product Code": record.productCode,
        Product: record.productName,
        Type: record.adjustmentType,
        Quantity: Math.abs(record.quantityAdded),
        "Stock After": record.resultingStock,
        Reason: record.reason,
        Remark: record.remark,
        Location: record.location,
        "Adjusted By": record.managerName,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Stock Adjustments");
    XLSX.writeFile(
      book,
      `stock-adjustments-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };
  const openAdjustmentPdf = async (adjustment) => {
    const pdfTab = window.open("", "_blank");
    if (!pdfTab) {
      setError("Allow pop-ups to open the stock adjustment PDF.");
      return;
    }
    pdfTab.document.title = adjustment.documentNo || "Stock Adjustment";
    pdfTab.document.body.innerHTML =
      "<p style='font-family:Arial,sans-serif;padding:24px'>Preparing PDF...</p>";
    try {
      const blob = await createStockAdjustmentPdf(adjustment, products);
      const url = URL.createObjectURL(blob);
      pdfTab.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 300000);
    } catch (pdfError) {
      pdfTab.close();
      setError(
        pdfError.message || "Could not create the stock adjustment PDF.",
      );
    }
  };
  const printAdjustmentDocument = () => {
    document.getElementById("stock-adjustment-print-page")?.remove();
    const pageStyle = document.createElement("style");
    pageStyle.id = "stock-adjustment-print-page";
    pageStyle.textContent = "@page { size: Letter portrait; margin: 0; }";
    document.head.appendChild(pageStyle);
    const cleanup = () => pageStyle.remove();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 2000);
  };
  return (
    <section className="stock-adjustment-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">INVENTORY CONTROL</p>
          <h2>Stock Adjustment</h2>
          <p className="page-description">
            Correct stock variances and retain a complete adjustment audit
            trail.
          </p>
        </div>
      </div>
      <form
        className="stock-adjustment-card"
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.defaultPrevented) return;
          if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
            event.preventDefault();
            addCurrentItem();
          }
        }}
      >
        <div className="stock-adjustment-form">
          <label>
            Item code *
            <input
              list="stock-adjustment-products"
              value={productSearch}
              onChange={(e) => {
                const value = e.target.value;
                const product = products.find((item) =>
                  [item.productCode, item.sku, item.barcode]
                    .filter(Boolean)
                    .map(String)
                    .includes(value),
                );
                setProductSearch(value);
                setForm((current) => ({
                  ...current,
                  productId: product?._id || "",
                }));
              }}
              onBlur={(e) => selectScannedProduct(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectScannedProduct(e.currentTarget.value);
                  document
                    .querySelector(".stock-adjustment-form input[type=number]")
                    ?.focus();
                }
              }}
              placeholder="Scan or type item code..."
              required
            />
            <datalist id="stock-adjustment-products">
              {products.map((product) => (
                <option
                  key={product._id}
                  value={product.productCode || product.sku}
                  label={product.productName || product.name}
                />
              ))}
            </datalist>
          </label>
          <label>
            Product name
            <input
              value={
                selectedProduct?.productName || selectedProduct?.name || ""
              }
              placeholder="Auto-filled after item code"
              readOnly
            />
          </label>
          <label>
            Adjustment *
            <select
              value={form.adjustmentType}
              onChange={(e) =>
                setForm({ ...form, adjustmentType: e.target.value })
              }
            >
              <option value="ADD">Add stock</option>
              <option value="REDUCE">Reduce stock</option>
            </select>
          </label>
          <label>
            Quantity *
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </label>
          <label>
            Reason *
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
            >
              <option value="">Select reason</option>
              {REASONS.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <label>
            Remark
            <textarea
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="Optional note"
              rows="1"
            />
          </label>
          {selectedProduct && (
            <small>
              Selected: {selectedProduct.productName || selectedProduct.name} ·
              Available stock:{" "}
              {Number(selectedProduct.openingStock || 0).toLocaleString()}
            </small>
          )}
        </div>
        <section className="stock-adjustment-list">
          <div>
            <strong>Adjustment items</strong>
            <span>
              {items.length} item{items.length === 1 ? "" : "s"} ready
            </span>
          </div>
          {items.length ? (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reason</th>
                  <th>Remark</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const product = products.find(
                    (p) => p._id === item.productId,
                  );
                  return (
                    <tr key={`${item.productId}-${index}`}>
                      <td>
                        {product?.productCode} — {product?.productName}
                      </td>
                      <td>{item.adjustmentType}</td>
                      <td>{item.quantity}</td>
                      <td>{item.reason}</td>
                      <td>{item.remark || "—"}</td>
                      <td>
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() =>
                            setItems((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p>Add products above to prepare one adjustment batch.</p>
          )}
        </section>
        <footer>
          <button type="submit">
            <FiPlusCircle /> Save{" "}
            {items.length
              ? `${items.length}${form.productId ? " + 1" : ""}`
              : ""}{" "}
            adjustment{items.length === 1 && !form.productId ? "" : "s"}
          </button>
        </footer>
      </form>
      {error && <p className="form-error">{error}</p>}
      <div className="sales-register-actions">
        <button type="button" className="secondary-action" onClick={load}>
          <FiRefreshCw /> Refresh
        </button>
        <button type="button" onClick={download}>
          <FiDownload /> Download Excel
        </button>
      </div>
      <div className="sales-register-selection audit-filter">
        <label>
          Search
          <input
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Product, reason, user..."
          />
        </label>
        <label>
          Type
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          >
            <option value="">All</option>
            <option value="ADD">Add</option>
            <option value="REDUCE">Reduce</option>
          </select>
        </label>
        <label>
          Reason
          <select
            value={filter.reason}
            onChange={(e) => setFilter({ ...filter, reason: e.target.value })}
          >
            <option value="">All</option>
            {REASONS.map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
          />
        </label>
      </div>
      <div className="product-table-wrap">
        <table className="product-table adjustment-document-table">
          <thead>
            <tr>
              <th>Document no.</th>
              <th>Date & time</th>
              <th>Items</th>
              <th>Location</th>
              <th>Created by</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr
                key={document.documentNo}
                onDoubleClick={() => openAdjustmentPdf(document)}
                title="Double-click to open PDF in a new tab"
              >
                <td>
                  <strong>{document.documentNo}</strong>
                </td>
                <td>{new Date(document.createdAt).toLocaleString()}</td>
                <td>{document.items.length}</td>
                <td>{document.location}</td>
                <td>{document.managerName}</td>
              </tr>
            ))}
            {!documents.length && (
              <tr>
                <td colSpan="5" className="pivot-empty">
                  No stock adjustments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Legacy in-page preview is retained only for reference; documents now open as PDFs. */}
      {false && selectedDocument && (
        <div
          className="modal-backdrop adjustment-print-backdrop"
          onClick={() => setSelectedDocument(null)}
        >
          <article
            className="adjustment-print-preview"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <b>ROYAL LANKA AGENCIES</b>
                <small>JOCKEY STOCK</small>
                <h2>Stock Adjustment</h2>
              </div>
              <div>
                <b>Duplicate</b>
                <small>Print Date Time - {new Date().toLocaleString()}</small>
                <small>Printed User - {selectedDocument.managerName}</small>
                <small>Current Location - {selectedDocument.location}</small>
                <small>Created User - {selectedDocument.managerName}</small>
              </div>
            </header>
            <section className="adjustment-document-details">
              <div>
                <span>
                  <b>Document</b>
                  {selectedDocument.documentNo}
                </span>
                <span>
                  <b>Date</b>
                  {new Date(selectedDocument.createdAt).toLocaleDateString()}
                </span>
                <span>
                  <b>Narration</b>
                  {selectedDocument.items[0]?.reason || "Stock Adjustment"}
                </span>
                <span>
                  <b>Remark</b>
                  {selectedDocument.items[0]?.remark || ""}
                </span>
              </div>
              <div>
                <span>
                  <b>Reference No</b>
                  {selectedDocument.documentNo}
                </span>
                <span>
                  <b>Adjustment Mode</b>
                  {[
                    ...new Set(
                      selectedDocument.items.map((item) =>
                        item.adjustmentType === "ADD"
                          ? "Add Stock"
                          : "Reduce Stock",
                      ),
                    ),
                  ].join(" / ")}
                </span>
                <span>
                  <b>Location</b>
                  {selectedDocument.location}
                </span>
                <span>
                  <b>Adjustment Type</b>Default
                </span>
              </div>
            </section>
            <table>
              <thead>
                <tr>
                  <th>Pro.Code</th>
                  <th>Pro.Name</th>
                  <th>Unit</th>
                  <th>Cur:QTY</th>
                  <th>New Qty</th>
                  <th>V:Qty</th>
                  <th>S.Price</th>
                  <th>C.Price</th>
                  <th>S.Value</th>
                  <th>C.Value</th>
                </tr>
              </thead>
              <tbody>
                {selectedDocument.items.map((record) => {
                  const product = products.find(
                    (item) => item._id === String(record.productId),
                  );
                  const current = Number(
                    record.resultingStock - record.quantityAdded,
                  );
                  const selling = Number(product?.sellingPrice || 0),
                    cost = Number(product?.costPrice || 0);
                  return (
                    <tr key={record._id}>
                      <td>{record.productCode}</td>
                      <td>{record.productName}</td>
                      <td>Nos</td>
                      <td>{current.toFixed(2)}</td>
                      <td>{Number(record.resultingStock).toFixed(2)}</td>
                      <td>{Number(record.quantityAdded).toFixed(2)}</td>
                      <td>
                        {selling.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        {cost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        {(
                          Math.abs(Number(record.quantityAdded)) * selling
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        {(
                          Math.abs(Number(record.quantityAdded)) * cost
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="8">
                    Tot. S.Value
                    <br />
                    Tot. C.Value
                  </td>
                  <td>
                    {selectedDocument.items
                      .reduce((sum, item) => {
                        const product = products.find(
                          (p) => p._id === String(item.productId),
                        );
                        return (
                          sum +
                          Math.abs(Number(item.quantityAdded)) *
                            Number(product?.sellingPrice || 0)
                        );
                      }, 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <br />
                    {selectedDocument.items
                      .reduce((sum, item) => {
                        const product = products.find(
                          (p) => p._id === String(item.productId),
                        );
                        return (
                          sum +
                          Math.abs(Number(item.quantityAdded)) *
                            Number(product?.costPrice || 0)
                        );
                      }, 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <footer>
              <span>
                Issuer's Name
                <br />
                <br />
                Issuer's Signature
              </span>
              <span>
                Recipient's Name
                <br />
                <br />
                Recipient's Signature
              </span>
              <span>Manager / Asst Signature</span>
            </footer>
            <aside>Royal IT Technologies Pvt Ltd. - 0112253236</aside>
            <button type="button" onClick={printAdjustmentDocument}>
              Print
            </button>
          </article>
        </div>
      )}
    </section>
  );
}
