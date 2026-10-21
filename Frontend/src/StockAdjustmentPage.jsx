import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FiDownload, FiPlusCircle, FiRefreshCw, FiTrash2 } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const REASONS = ["Stock count correction", "Damaged stock", "Missing stock", "Found stock", "Data entry correction", "Other"];

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState([]), [records, setRecords] = useState([]), [error, setError] = useState("");
  const [form, setForm] = useState({ productId: "", adjustmentType: "ADD", quantity: "", reason: "", remark: "" });
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState({ search: "", type: "", reason: "", from: "", to: "" });
  const load = async () => {
    try {
      const query = new URLSearchParams(); if (filter.from) query.set("from", filter.from); if (filter.to) query.set("to", filter.to);
      const [productsResponse, recordsResponse] = await Promise.all([fetch(`${API_URL}/products`, { credentials: "include" }), fetch(`${API_URL}/stock-adjustments?${query}`, { credentials: "include" })]);
      const productsData = await productsResponse.json(), recordsData = await recordsResponse.json();
      if (!productsResponse.ok) throw new Error(productsData.message || "Could not load products.");
      if (!recordsResponse.ok) throw new Error(recordsData.message || "Could not load adjustment audit.");
      setProducts(productsData); setRecords(recordsData); setError("");
    } catch (loadError) { setError(loadError.message); }
  };
  useEffect(() => { load(); }, [filter.from, filter.to]);
  const selectedProduct = products.find((product) => product._id === form.productId);
  const rows = useMemo(() => records.filter((record) => {
    const text = `${record.productCode} ${record.productName} ${record.reason} ${record.remark} ${record.managerName}`.toLowerCase();
    return (!filter.search || text.includes(filter.search.toLowerCase())) && (!filter.type || record.adjustmentType === filter.type) && (!filter.reason || record.reason === filter.reason);
  }), [records, filter]);
  const submit = async (event) => {
    event.preventDefault(); setError("");
    const batch = form.productId ? [...items, form] : items;
    if (!batch.length) { setError("Add at least one product adjustment."); return; }
    if (form.productId && (!form.quantity || !form.reason)) { setError("Complete the current item or add it to the adjustment list first."); return; }
    try {
      const response = await fetch(`${API_URL}/stock-adjustments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: batch.map((item) => ({ ...item, quantity: Number(item.quantity) })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not save stock adjustment.");
      setForm({ productId: "", adjustmentType: "ADD", quantity: "", reason: "", remark: "" }); setProductSearch(""); setItems([]); await load();
    } catch (submitError) { setError(submitError.message); }
  };
  const download = () => {
    const sheet = XLSX.utils.json_to_sheet(rows.map((record) => ({ Date: new Date(record.createdAt).toLocaleString(), "Product Code": record.productCode, Product: record.productName, Type: record.adjustmentType, Quantity: Math.abs(record.quantityAdded), "Stock After": record.resultingStock, Reason: record.reason, Remark: record.remark, Location: record.location, "Adjusted By": record.managerName })));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Stock Adjustments"); XLSX.writeFile(book, `stock-adjustments-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  return <section className="stock-adjustment-page">
    <div className="page-title"><div><p className="eyebrow">INVENTORY CONTROL</p><h2>Stock Adjustment</h2><p className="page-description">Correct stock variances and retain a complete adjustment audit trail.</p></div></div>
    <form className="stock-adjustment-card" onSubmit={submit}>
      <div className="stock-adjustment-form">
      <label>Product / Item code *<input list="stock-adjustment-products" value={productSearch} onChange={(e) => { const value = e.target.value; const product = products.find((item) => `${item.productCode || item.sku} — ${item.productName || item.name}` === value || String(item.productCode || item.sku) === value); setProductSearch(value); setForm({ ...form, productId: product?._id || "" }); }} placeholder="Type item code..." required /><datalist id="stock-adjustment-products">{products.map((product) => <option key={product._id} value={`${product.productCode || product.sku} — ${product.productName || product.name}`} />)}</datalist></label>
      <label>Adjustment *<select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}><option value="ADD">Add stock</option><option value="REDUCE">Reduce stock</option></select></label>
      <label>Quantity *<input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
      <label>Reason *<select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required><option value="">Select reason</option>{REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
      <label>Remark<textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="Optional note" rows="1" /></label>
      <button type="button" className="secondary-action" onClick={() => { if (!form.productId || !form.quantity || !form.reason) { setError("Select a product, quantity and reason before adding."); return; } setItems((current) => [...current, { ...form }]); setForm({ productId: "", adjustmentType: "ADD", quantity: "", reason: "", remark: "" }); setProductSearch(""); }}><FiPlusCircle /> Add to list</button>
      {selectedProduct && <small>Available stock: {Number(selectedProduct.openingStock || 0).toLocaleString()}</small>}
      </div>
      <section className="stock-adjustment-list"><div><strong>Adjustment items</strong><span>{items.length} item{items.length === 1 ? "" : "s"} ready</span></div>{items.length ? <table><thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th><th>Remark</th><th></th></tr></thead><tbody>{items.map((item, index) => { const product = products.find((p) => p._id === item.productId); return <tr key={`${item.productId}-${index}`}><td>{product?.productCode} — {product?.productName}</td><td>{item.adjustmentType}</td><td>{item.quantity}</td><td>{item.reason}</td><td>{item.remark || "—"}</td><td><button type="button" aria-label="Remove item" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><FiTrash2 /></button></td></tr>; })}</tbody></table> : <p>Add products above to prepare one adjustment batch.</p>}</section>
      <footer><button type="submit"><FiPlusCircle /> Save {items.length ? `${items.length}${form.productId ? " + 1" : ""}` : ""} adjustment{items.length === 1 && !form.productId ? "" : "s"}</button></footer>
    </form>
    {error && <p className="form-error">{error}</p>}
    <div className="sales-register-actions"><button type="button" className="secondary-action" onClick={load}><FiRefreshCw /> Refresh</button><button type="button" onClick={download}><FiDownload /> Download Excel</button></div>
    <div className="sales-register-selection audit-filter"><label>Search<input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Product, reason, user..." /></label><label>Type<select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}><option value="">All</option><option value="ADD">Add</option><option value="REDUCE">Reduce</option></select></label><label>Reason<select value={filter.reason} onChange={(e) => setFilter({ ...filter, reason: e.target.value })}><option value="">All</option>{REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label><label>From<input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></label><label>To<input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></label></div>
    <div className="product-table-wrap"><table className="product-table"><thead><tr><th>Date & time</th><th>Product code</th><th>Product</th><th>Type</th><th>Quantity</th><th>Stock after</th><th>Reason</th><th>Remark</th><th>Location</th><th>Adjusted by</th></tr></thead><tbody>{rows.map((record) => <tr key={record._id}><td>{new Date(record.createdAt).toLocaleString()}</td><td>{record.productCode}</td><td>{record.productName}</td><td><strong className={record.adjustmentType === "REDUCE" ? "stock-adjustment-reduce" : "stock-adjustment-add"}>{record.adjustmentType}</strong></td><td>{Math.abs(Number(record.quantityAdded)).toLocaleString()}</td><td>{Number(record.resultingStock).toLocaleString()}</td><td>{record.reason}</td><td>{record.remark || "—"}</td><td>{record.location}</td><td>{record.managerName}</td></tr>)}{!rows.length && <tr><td colSpan="10" className="pivot-empty">No stock adjustments found.</td></tr>}</tbody></table></div>
  </section>;
}
