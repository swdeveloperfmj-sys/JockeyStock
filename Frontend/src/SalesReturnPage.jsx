import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiSave, FiX } from "react-icons/fi";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
export default function SalesReturnPage({ user }) {
  const empty = () => ({
    sourceType: "INVOICE",
    invoiceOrderId: "",
    returnDate: today(),
    location: user.location || "Head Office",
    customerName: "",
    remarks: "",
  });
  const [form, setForm] = useState(empty),
    [number, setNumber] = useState(""),
    [invoices, setInvoices] = useState([]),
    [products, setProducts] = useState([]),
    [locations, setLocations] = useState([]),
    [records, setRecords] = useState([]),
    [items, setItems] = useState([]),
    [scanCode, setScanCode] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [lookupOpen, setLookupOpen] = useState(false),
    [lookupSearch, setLookupSearch] = useState(""),
    [reversingId, setReversingId] = useState("");
  const load = async () => {
    const rs = await Promise.all(
        [
          "sales-returns/next-number",
          "sales-returns/invoices",
          "products",
          "locations",
          "sales-returns",
        ].map((p) => fetch(`${API_URL}/${p}`, { credentials: "include" })),
      ),
      d = await Promise.all(rs.map((r) => r.json())),
      bad = rs.findIndex((r) => !r.ok);
    if (bad >= 0) throw Error(d[bad].message);
    setNumber(d[0].returnNumber);
    setInvoices(d[1]);
    setProducts(d[2]);
    setLocations(d[3]);
    setRecords(d[4]);
  };
  const locationProducts = useMemo(
    () => products.filter((p) => p.plant === form.location),
    [products, form.location],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const scannedProduct = locationProducts.find(
    (product) =>
      String(product.productCode || product.sku).toUpperCase() ===
      scanCode.trim().toUpperCase(),
  );
  const visibleLookupProducts = useMemo(() => {
    const query = lookupSearch.trim().toLowerCase();
    return locationProducts.filter((product) =>
      [
        product.productCode,
        product.productName,
        product.style,
        product.color,
        product.size,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [locationProducts, lookupSearch]);
  useEffect(() => {
    const openLookup = (event) => {
      if (
        event.key !== "F3" ||
        document.activeElement?.getAttribute("placeholder") !==
          "Product Code (scan / F3)"
      )
        return;
      event.preventDefault();
      setLookupSearch("");
      setLookupOpen(true);
      return;
      const choices = locationProducts
          .slice(0, 80)
          .map(
            (p, index) => `${index + 1}. ${p.productCode} — ${p.productName}`,
          )
          .join("\n"),
        answer = window.prompt(
          `PRODUCT MASTER\n\nEnter product code, or select from this list:\n${choices}`,
        );
      if (answer !== null) setScanCode(answer.trim());
    };
    const addOnEnter = (event) => {
      if (
        event.key !== "Enter" ||
        !["Return quantity", "Reason"].includes(
          document.activeElement?.getAttribute("placeholder"),
        )
      )
        return;
      event.preventDefault();
      add();
    };
    window.addEventListener("keydown", openLookup, true);
    window.addEventListener("keydown", addOnEnter, true);
    return () => {
      window.removeEventListener("keydown", openLookup, true);
      window.removeEventListener("keydown", addOnEnter, true);
    };
  }, [locationProducts, scanCode, quantity, reason]);
  const invoice = invoices.find((x) => x._id === form.invoiceOrderId);
  const selectInvoice = (id) => {
    const x = invoices.find((i) => i._id === id);
    setForm((f) => ({
      ...f,
      invoiceOrderId: id,
      location: x?.location || f.location,
      customerName: x?.customerName || "",
    }));
    setItems(
      (x?.items || []).map((i) => ({
        productId: String(i.productId),
        productCode: i.productCode,
        productName: i.productName,
        quantity: 0,
        maxQuantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice || 0),
        reason: "",
      })),
    );
  };
  const update = (i, key, value) =>
    setItems((xs) =>
      xs.map((x, n) =>
        n === i
          ? {
              ...x,
              [key]: key === "quantity" ? Math.max(0, Number(value)) : value,
            }
          : x,
      ),
    );
  const add = () => {
    const code = scanCode.trim().toUpperCase(),
      p = locationProducts.find(
        (x) => String(x.productCode || x.sku).toUpperCase() === code,
      ),
      qty = Number(quantity);
    if (!p)
      return setError("Scanned product code was not found at this location.");
    if (!Number.isInteger(qty) || qty < 1)
      return setError("Enter a whole return quantity of at least 1.");
    setItems((xs) =>
      xs.some((x) => x.productId === p._id)
        ? xs.map((x) =>
            x.productId === p._id
              ? { ...x, quantity: x.quantity + qty, reason: reason || x.reason }
              : x,
          )
        : [
            ...xs,
            {
              productId: p._id,
              productCode: p.productCode,
              productName: p.productName,
              quantity: qty,
              unitPrice: Number(p.sellingPrice || 0),
              reason,
            },
          ],
    );
    setScanCode("");
    setQuantity("1");
    setReason("");
    setError("");
  };
  const save = async (e) => {
    e.preventDefault();
    const posted = items.filter((x) => Number(x.quantity) > 0);
    if (!posted.length) return setError("Add at least one returned item.");
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/sales-returns`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, items: posted }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setMessage(`${d.returnNumber} saved successfully.`);
      setForm(empty());
      setItems([]);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const reverseReturn = async (record) => {
    const reversalReason = window.prompt(
      `Reverse ${record.returnNumber}? Enter the reason:`,
    );
    if (reversalReason === null) return;
    if (!reversalReason.trim())
      return setError("Enter a reason for reversing the sales return.");
    setReversingId(record._id);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/sales-returns/${record._id}/reverse`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reversalReason }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.message);
      setMessage(`${record.returnNumber} reversed successfully.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReversingId("");
    }
  };
  const qty = items.reduce((s, x) => s + Number(x.quantity || 0), 0),
    total = items.reduce(
      (s, x) => s + Number(x.quantity || 0) * Number(x.unitPrice || 0),
      0,
    );
  return (
    <section className="grn-page sales-return-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">SALES RETURN</p>
          <h1>Sales Return Note</h1>
          <p className="page-description">
            Return sold items against an invoice, or scan a product for a manual
            customer return.
          </p>
        </div>
      </div>
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="stock-update-success">{message}</p>}
      <form onSubmit={save}>
        <section className="grn-details">
          <label>
            Sales Return No
            <input value={number} readOnly />
          </label>
          <label>
            Return type
            <select
              value={form.sourceType}
              onChange={(e) => {
                setForm({
                  ...form,
                  sourceType: e.target.value,
                  invoiceOrderId: "",
                  customerName: "",
                });
                setItems([]);
              }}
            >
              <option value="INVOICE">Invoice return</option>
              <option value="MANUAL">Manual return</option>
            </select>
          </label>
          {form.sourceType === "INVOICE" ? (
            <label>
              Invoice
              <select
                required
                value={form.invoiceOrderId}
                onChange={(e) => selectInvoice(e.target.value)}
              >
                <option value="">Select completed invoice</option>
                {invoices.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.orderNumber} — {x.customerName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Customer name
              <input
                value={form.customerName}
                placeholder="Optional customer name"
                onChange={(e) =>
                  setForm({ ...form, customerName: e.target.value })
                }
              />
            </label>
          )}
          <label>
            Return date
            <input
              type="date"
              value={form.returnDate}
              onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
            />
          </label>
          <label>
            Location
            <select
              disabled={
                user.role === "LOCATION_MANAGER" ||
                form.sourceType === "INVOICE"
              }
              value={form.location}
              onChange={(e) => {
                setForm({ ...form, location: e.target.value });
                setItems([]);
              }}
            >
              <option>Head Office</option>
              {locations
                .filter((x) => x.name !== "Head Office")
                .map((x) => (
                  <option key={x._id}>{x.name}</option>
                ))}
            </select>
          </label>
          <label className="grn-remarks">
            Remarks
            <input
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </label>
        </section>
        {form.sourceType === "MANUAL" && (
          <section className="grn-add-item sales-return-scanner">
            <input
              autoFocus
              value={scanCode}
              placeholder="Product Code (scan / F3)"
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document
                    .querySelector(
                      '.sales-return-scanner input[placeholder="Return quantity"]',
                    )
                    ?.focus();
                }
              }}
            />
            <input
              value={scannedProduct?.productName || ""}
              placeholder="Product Name"
              readOnly
            />
            <input
              type="number"
              min="1"
              value={quantity}
              placeholder="Return quantity"
              onChange={(e) => setQuantity(e.target.value)}
            />
            <input
              value={reason}
              placeholder="Reason"
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="button" onClick={add}>
              <FiPlus /> Add scanned item
            </button>
          </section>
        )}
        <section className="grn-preview">
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  {[
                    "Product Code",
                    "Product Name",
                    "Sold Qty",
                    "Return Qty",
                    "Unit Price",
                    "Reason",
                    "Amount",
                    "",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((x, i) => (
                  <tr key={x.productId}>
                    <td>{x.productCode}</td>
                    <td>{x.productName}</td>
                    <td>{x.maxQuantity ?? "—"}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={x.maxQuantity}
                        value={x.quantity}
                        onChange={(e) => update(i, "quantity", e.target.value)}
                      />
                    </td>
                    <td>LKR {Number(x.unitPrice).toLocaleString()}</td>
                    <td>
                      <input
                        value={x.reason}
                        placeholder="Reason"
                        onChange={(e) => update(i, "reason", e.target.value)}
                      />
                    </td>
                    <td>
                      LKR{" "}
                      {(
                        Number(x.quantity || 0) * Number(x.unitPrice || 0)
                      ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="close-modal"
                        onClick={() =>
                          setItems((xs) => xs.filter((_, n) => n !== i))
                        }
                      >
                        <FiX />
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan="8" className="pivot-empty">
                      {form.sourceType === "INVOICE"
                        ? "Select an invoice to load its sold items."
                        : "Scan a product code to add it to this return."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grn-total">
            <span className="grn-summary-item">
              No Of Items <b>{items.filter((x) => x.quantity > 0).length}</b>
            </span>
            <span className="grn-summary-item">
              Total Qty <b>{qty}</b>
            </span>
            <span className="grn-summary-item">
              Return Value{" "}
              <b>
                LKR{" "}
                {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </b>
            </span>
            <div className="grn-total-actions">
              <button disabled={saving}>
                <FiSave /> {saving ? "Saving..." : "Save Sales Return"}
              </button>
            </div>
          </div>
        </section>
      </form>
      <section className="grn-preview sales-return-history">
        <div className="grn-preview-heading">
          <h2>All Sales Returns</h2>
          <span>{records.length} records</span>
        </div>
        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Return No</th>
                <th>Date</th>
                <th>Type</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Qty</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  <td>{record.returnNumber}</td>
                  <td>
                    {new Date(record.returnDate).toLocaleDateString("en-GB")}
                  </td>
                  <td>{record.sourceType}</td>
                  <td>{record.invoiceNumber || "—"}</td>
                  <td>{record.customerName || "—"}</td>
                  <td>{record.location}</td>
                  <td>{Number(record.totalQuantity).toLocaleString()}</td>
                  <td>
                    LKR{" "}
                    {Number(record.totalAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <span
                      className={
                        record.status === "REVERSED"
                          ? "sales-register-status cancelled"
                          : "sales-register-status completed"
                      }
                    >
                      {record.status}
                    </span>
                  </td>
                  <td>
                    {user.role === "SUPER_ADMIN" &&
                      record.status !== "REVERSED" && (
                        <button
                          type="button"
                          className="cancel-button"
                          disabled={reversingId === record._id}
                          onClick={() => reverseReturn(record)}
                        >
                          {reversingId === record._id
                            ? "Reversing..."
                            : "Reverse"}
                        </button>
                      )}
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan="10" className="pivot-empty">
                    No sales returns have been created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {lookupOpen && (
        <div
          className="modal-backdrop grn-lookup-backdrop"
          onClick={() => setLookupOpen(false)}
        >
          <section
            className="grn-lookup-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="product-image-preview-header">
              <div>
                <p className="eyebrow">PRODUCT MASTER</p>
                <h2>Select product</h2>
                <p>Search and double-click a product to select it.</p>
              </div>
              <button
                type="button"
                className="close-modal"
                onClick={() => setLookupOpen(false)}
              >
                <FiX />
              </button>
            </div>
            <input
              autoFocus
              type="search"
              value={lookupSearch}
              onChange={(event) => setLookupSearch(event.target.value)}
              placeholder="Search code, name, style, colour or size..."
            />
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Style</th>
                    <th>Colour</th>
                    <th>Size</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLookupProducts.map((product) => (
                    <tr
                      key={product._id}
                      title="Double-click to select"
                      onDoubleClick={() => {
                        setScanCode(product.productCode || product.sku || "");
                        setLookupOpen(false);
                        window.setTimeout(
                          () =>
                            document
                              .querySelector(
                                '.sales-return-scanner input[placeholder="Return quantity"]',
                              )
                              ?.focus(),
                          0,
                        );
                      }}
                    >
                      <td>{product.productCode || product.sku}</td>
                      <td>{product.productName || product.name}</td>
                      <td>{product.style || "—"}</td>
                      <td>{product.color || "—"}</td>
                      <td>{product.size || "—"}</td>
                      <td>
                        {Number(product.openingStock || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
