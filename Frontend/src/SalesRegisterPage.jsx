import { useEffect, useMemo, useState } from "react";
import {
  FiDownload,
  FiFilter,
  FiGrid,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const FIELDS = [
  { key: "productCode", label: "Product Code", type: "text" },
  { key: "productName", label: "Product Name", type: "text" },
  { key: "style", label: "Style", type: "text" },
  { key: "packingQuantity", label: "Packing Quantity", type: "text" },
  { key: "cartonQuantity", label: "Carton Quantity", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "gender", label: "Gender", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "subCategory", label: "SubCategory", type: "text" },
  { key: "subSubCategory", label: "SubSubCategory", type: "text" },
  { key: "documentNo", label: "Document No", type: "text" },
  { key: "date", label: "Date", type: "date" },
  { key: "customer", label: "Customer", type: "text" },
  { key: "supplier", label: "Supplier", type: "text" },
  { key: "salesPerson", label: "SalesPerson", type: "text" },
  { key: "colour", label: "Colour", type: "text" },
  { key: "size", label: "Size", type: "text" },
  { key: "qty", label: "Qty", type: "number" },
  { key: "gross", label: "Gross Amt.", type: "number" },
  { key: "discount", label: "Dis. Amt.", type: "number" },
  { key: "net", label: "Net Amt.", type: "number" },
  { key: "sellingPrice", label: "Sel. Price", type: "number" },
  { key: "costPrice", label: "Cost Price", type: "number" },
];

const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
const NUMBER_CONDITIONS = ["Equals", "Greater than or equal", "Less than or equal", "Between"];
const DATE_CONDITIONS = ["Equals", "Before", "After", "Between"];
const DATE_PARTS = ["Year", "Quarter", "Month", "Week", "Day", "Hour"];
const VALUE_FIELDS = ["Qty", "Gross Amount", "Discount Amount", "Net Amount", "Selling Price", "Cost Price"];
const PIVOT_DIMENSIONS = [
  ...FIELDS.filter((field) => !["date", "qty", "gross", "discount", "net", "sellingPrice", "costPrice"].includes(field.key)).map((field) => field.label),
  ...DATE_PARTS,
];

const money = (value) => Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB");
};
const weekNumber = (value) => {
  const date = new Date(value);
  const first = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date - first) / 86400000) + first.getDay() + 1) / 7);
};

function rowFromOrder(order, item) {
  const product = item.product || {};
  const gross = Number(item.total ?? Number(item.unitPrice || 0) * Number(item.quantity || 0));
  const discount = gross * (Number(order.customerDiscount || 0) / 100);
  return {
    id: `${order._id || order.orderNumber}-${item.productId || item.productCode}-${item.size || ""}`,
    productCode: item.productCode || product.productCode || "",
    productName: item.productName || product.productName || "",
    style: item.style || product.style || "",
    packingQuantity: product.packingQuantity || "",
    cartonQuantity: product.cartonQuantity || "",
    location: order.location || product.plant || "",
    gender: product.gender || "",
    category: product.categoryCode || "",
    subCategory: product.subCategoryCode || "",
    subSubCategory: product.subSubCategory || "",
    documentNo: order.orderNumber || "",
    date: order.createdAt || "",
    customer: order.customerName || "",
    supplier: product.supplierCode || "",
    salesPerson: order.salesRepName || "",
    colour: item.color || product.color || "",
    size: item.size || product.size || "",
    qty: Number(item.quantity || 0),
    gross,
    discount,
    net: gross - discount,
    sellingPrice: Number(item.unitPrice ?? product.sellingPrice ?? 0),
    costPrice: Number(product.costPrice || 0),
  };
}

function matchesFilter(row, filter) {
  const field = FIELD_BY_KEY[filter.field];
  if (!field) return true;
  if (field.type === "text") return String(row[filter.field] ?? "") === String(filter.from ?? "");
  if (field.type === "date") {
    const current = dateOnly(row[filter.field]);
    if (filter.condition === "Before") return current <= filter.from;
    if (filter.condition === "After") return current >= filter.from;
    if (filter.condition === "Between") return current >= filter.from && current <= filter.to;
    return current === filter.from;
  }
  const current = Number(row[filter.field]);
  const from = Number(filter.from);
  const to = Number(filter.to);
  if (filter.condition === "Greater than or equal") return current >= from;
  if (filter.condition === "Less than or equal") return current <= from;
  if (filter.condition === "Between") return current >= from && current <= to;
  return current === from;
}

function pivotDimension(row, label) {
  const date = new Date(row.date);
  if (label === "Year") return String(date.getFullYear());
  if (label === "Quarter") return `Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (label === "Month") return date.toLocaleString("en", { month: "long" });
  if (label === "Week") return `Week ${weekNumber(row.date)}`;
  if (label === "Day") return String(date.getDate()).padStart(2, "0");
  if (label === "Hour") return `${String(date.getHours()).padStart(2, "0")}:00`;
  const field = FIELDS.find((item) => item.label === label);
  return String(field ? row[field.key] ?? "" : "");
}

function pivotValue(row, label) {
  if (label === "Qty") return row.qty;
  if (label === "Gross Amount") return row.gross;
  if (label === "Discount Amount") return row.discount;
  if (label === "Net Amount") return row.net;
  if (label === "Selling Price") return row.sellingPrice;
  return row.costPrice;
}

function DropZone({ title, items, onDrop, onDropItem, onRemove, children }) {
  return (
    <section className={`pivot-zone ${title === "Row Labels" ? "pivot-row-label-zone" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <h4>{title}</h4>
      <div className="pivot-zone-content">
        {items.map((item) => (
          <span
            className="pivot-field-chip"
            draggable
            key={item}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDropItem(event, item);
            }}
          >
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}><FiX /></button>
          </span>
        ))}
        {!items.length && <small>Drag fields here</small>}
      </div>
      {children}
    </section>
  );
}

function PivotFieldOption({ field, checked, onToggle }) {
  return (
    <label
      className="pivot-field-option"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", field);
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(field, event.target.checked)}
        onDragStart={(event) => event.stopPropagation()}
      />
      <span>{field}</span>
    </label>
  );
}

function PivotDesigner({ rows, filters, filterLabels, dates, onClose, exportWorkbook }) {
  const [tab, setTab] = useState("pivot");
  const [rowFields, setRowFields] = useState([]);
  const [columnFields, setColumnFields] = useState([]);
  const [valueFields, setValueFields] = useState([]);
  const [reportFields, setReportFields] = useState([]);
  const [reportValues, setReportValues] = useState({});
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState("");
  const [layoutName, setLayoutName] = useState("");
  const [layoutStatus, setLayoutStatus] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/reports/sales-register/pivot-layouts`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load saved pivot layouts.");
        if (active) setSavedLayouts(data);
      })
      .catch((loadError) => { if (active) setLayoutStatus(loadError.message); });
    return () => { active = false; };
  }, []);

  const reportOptions = useMemo(() => Object.fromEntries(reportFields.map((field) => [
    field,
    [...new Set(rows.map((row) => pivotDimension(row, field)))].filter(Boolean).sort(),
  ])), [reportFields, rows]);

  const pivotData = useMemo(() => {
    const source = rows.filter((row) => reportFields.every((field) => !reportValues[field] || pivotDimension(row, field) === reportValues[field]));
    const groups = new Map();
    const columns = new Set();
    source.forEach((row) => {
      const rowParts = rowFields.map((field) => pivotDimension(row, field));
      const columnParts = columnFields.map((field) => pivotDimension(row, field));
      const columnKey = columnParts.join(" / ");
      const key = JSON.stringify(rowParts);
      columns.add(columnKey);
      if (!groups.has(key)) groups.set(key, { rowParts, cells: {} });
      const group = groups.get(key);
      if (!group.cells[columnKey]) group.cells[columnKey] = Object.fromEntries(valueFields.map((field) => [field, 0]));
      valueFields.forEach((field) => { group.cells[columnKey][field] += Number(pivotValue(row, field) || 0); });
    });
    return {
      rows: [...groups.values()].sort((a, b) => a.rowParts.join("|").localeCompare(b.rowParts.join("|"), undefined, { numeric: true })),
      columns: [...columns].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      totals: Object.fromEntries(valueFields.map((field) => [field, source.reduce((sum, row) => sum + Number(pivotValue(row, field) || 0), 0)])),
    };
  }, [columnFields, reportFields, reportValues, rowFields, rows, valueFields]);

  const displayColumns = columnFields.length ? pivotData.columns : [""];
  const isPivotReady = valueFields.length > 0 && (rowFields.length > 0 || columnFields.length > 0);

  const isSelected = (field) => rowFields.includes(field)
    || columnFields.includes(field)
    || reportFields.includes(field)
    || valueFields.includes(field);

  const removeEverywhere = (field) => {
    setRowFields((current) => current.filter((item) => item !== field));
    setColumnFields((current) => current.filter((item) => item !== field));
    setReportFields((current) => current.filter((item) => item !== field));
    setValueFields((current) => current.filter((item) => item !== field));
    setReportValues((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleField = (field, checked) => {
    if (!checked) {
      removeEverywhere(field);
      return;
    }
    if (VALUE_FIELDS.includes(field)) {
      setValueFields((current) => current.includes(field) ? current : [...current, field]);
    } else {
      setRowFields((current) => current.includes(field) ? current : [...current, field]);
    }
  };

  const positionField = (current, field, target) => {
    if (!target || target === field) {
      const withoutField = current.filter((item) => item !== field);
      return target === field ? current : [...withoutField, field];
    }
    const fromIndex = current.indexOf(field);
    const targetIndex = current.indexOf(target);
    if (fromIndex >= 0 && targetIndex >= 0) {
      const swapped = [...current];
      [swapped[fromIndex], swapped[targetIndex]] = [swapped[targetIndex], swapped[fromIndex]];
      return swapped;
    }
    const withoutField = current.filter((item) => item !== field);
    const insertAt = withoutField.indexOf(target);
    if (insertAt < 0) return [...withoutField, field];
    withoutField.splice(insertAt, 0, field);
    return withoutField;
  };

  const moveField = (event, destination, allowed, target = null) => {
    event.preventDefault();
    const field = event.dataTransfer.getData("text/plain");
    if (!field || !allowed.includes(field)) return;
    setRowFields((current) => destination === "rows" ? positionField(current, field, target) : current.filter((item) => item !== field));
    setColumnFields((current) => destination === "columns" ? positionField(current, field, target) : current.filter((item) => item !== field));
    setReportFields((current) => destination === "filters" ? positionField(current, field, target) : current.filter((item) => item !== field));
    setValueFields((current) => destination === "values" ? positionField(current, field, target) : current.filter((item) => item !== field));
    if (destination !== "filters") {
      setReportValues((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const remove = (setter) => (field) => setter((current) => current.filter((item) => item !== field));
  const exportPivot = () => exportWorkbook({ pivotRows: pivotData.rows, pivotTotals: pivotData.totals, rowFields, columnFields, displayColumns, valueFields });

  const loadSavedLayout = (layoutId) => {
    setSelectedLayoutId(layoutId);
    const layout = savedLayouts.find((item) => item._id === layoutId);
    if (!layout) return;
    setRowFields(layout.rowFields || []);
    setColumnFields(layout.columnFields || []);
    setValueFields(layout.valueFields || []);
    setReportFields(layout.reportFields || []);
    setReportValues(layout.reportValues || {});
    setLayoutName(layout.name || "");
    setLayoutStatus(`Loaded “${layout.name}”.`);
  };

  const saveLayout = async () => {
    const name = layoutName.trim();
    if (!name) {
      setLayoutStatus("Enter a layout name or remark before saving.");
      return;
    }
    setSavingLayout(true);
    setLayoutStatus("");
    try {
      const response = await fetch(`${API_URL}/reports/sales-register/pivot-layouts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rowFields, columnFields, valueFields, reportFields, reportValues }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.message || "Could not save this pivot layout.");
      setSavedLayouts((current) => [saved, ...current.filter((item) => item._id !== saved._id && item.name !== saved.name)]);
      setSelectedLayoutId(saved._id);
      setLayoutName(saved.name);
      setLayoutStatus(`Saved “${saved.name}”.`);
    } catch (saveError) {
      setLayoutStatus(saveError.message);
    } finally {
      setSavingLayout(false);
    }
  };

  return (
    <div className="modal-backdrop pivot-fullscreen" role="dialog" aria-modal="true" aria-label="Sales register pivot designer">
      <div className="pivot-designer">
        <header className="pivot-topbar">
          <div>
            <span>SALES REGISTER</span>
            <h2>Pivot Designer</h2>
          </div>
          <div className="pivot-top-actions">
            <button type="button" onClick={exportPivot} disabled={!isPivotReady}><FiDownload /> Export Pivot XLSX</button>
            <button className="pivot-close" type="button" onClick={onClose}><FiX /></button>
          </div>
        </header>

        <nav className="pivot-tabs">
          <button type="button" className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>Report Viewer</button>
          <button type="button" className={tab === "pivot" ? "active" : ""} onClick={() => setTab("pivot")}>Pivot View</button>
        </nav>

        {tab === "report" ? (
          <div className="pivot-report-view">
            <p>{rows.length} filtered sales register lines</p>
            <div className="grn-report-table-wrap"><ReportTable rows={rows} /></div>
          </div>
        ) : (
          <div className="pivot-workspace">
            <main className="pivot-canvas">
              <div className="pivot-filter-strip">
                <div className="pivot-base-filters">
                  <strong><FiFilter /> Applied selections</strong>
                  {filterLabels.length
                    ? filterLabels.map((label) => <span key={label}>{label}</span>)
                    : <small>All sales register records</small>}
                  <b>{rows.length} lines</b>
                </div>
                <div className="pivot-live-filters">
                  <strong>Pivot filters</strong>
                  {reportFields.map((field) => (
                    <label key={field}>{field}
                      <select value={reportValues[field] || ""} onChange={(event) => setReportValues((current) => ({ ...current, [field]: event.target.value }))}>
                        <option value="">All</option>
                        {(reportOptions[field] || []).map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                  ))}
                  {!reportFields.length && <small>Drag another field into Report Filter for additional pivot filtering.</small>}
                </div>
              </div>

              <div className="pivot-result-wrap">
                {!isPivotReady ? (
                  <div className="pivot-start-state">
                    <FiGrid />
                    <h3>Build your pivot view</h3>
                    <p>Tick or drag at least one label field and one value field.</p>
                  </div>
                ) : <table className="pivot-result-table">
                  <thead>
                    <tr>
                      {rowFields.map((field) => (
                        <th
                          className="pivot-draggable-header"
                          draggable
                          rowSpan="2"
                          key={field}
                          title="Drag this field to another area"
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", field)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => moveField(event, "rows", PIVOT_DIMENSIONS, field)}
                        >{field}</th>
                      ))}
                      {displayColumns.map((column) => (
                        <th
                          className={columnFields.length ? "pivot-draggable-header" : ""}
                          draggable={columnFields.length > 0}
                          colSpan={valueFields.length || 1}
                          key={column || "values"}
                          title={columnFields.length ? "Drag this column field to another area" : ""}
                          onDragStart={(event) => columnFields.length && event.dataTransfer.setData("text/plain", columnFields[0])}
                          onDragOver={(event) => columnFields.length && event.preventDefault()}
                          onDrop={(event) => columnFields.length && moveField(event, "columns", PIVOT_DIMENSIONS, columnFields[0])}
                        >{columnFields.length ? `${columnFields.join(" / ")}: ${column}` : "Values"}</th>
                      ))}
                    </tr>
                    <tr>
                      {displayColumns.flatMap((column) => valueFields.map((field) => (
                        <th
                          className="pivot-draggable-header"
                          draggable
                          key={`${column}-${field}`}
                          title="Drag this value to another area"
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", field)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => moveField(event, "values", VALUE_FIELDS, field)}
                        >Sum of {field}</th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.rows.map((group, index) => (
                      <tr key={`${group.rowParts.join("-")}-${index}`}>
                        {group.rowParts.map((part, partIndex) => <td className="pivot-label-cell" key={`${part}-${partIndex}`}>{part}</td>)}
                        {displayColumns.flatMap((column) => valueFields.map((field) => (
                          <td key={`${column}-${field}`}>{money(group.cells[column]?.[field] || 0)}</td>
                        )))}
                      </tr>
                    ))}
                    {!pivotData.rows.length && <tr><td className="pivot-empty" colSpan={Math.max(1, rowFields.length + displayColumns.length * Math.max(1, valueFields.length))}>No matching records</td></tr>}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={Math.max(1, rowFields.length)}>Grand Total</th>
                      {displayColumns.flatMap((column) => valueFields.map((field) => <th key={`${column}-${field}-total`}>{displayColumns.length === 1 ? money(pivotData.totals[field]) : ""}</th>))}
                    </tr>
                  </tfoot>
                </table>}
              </div>
            </main>

            <aside className="pivot-builder">
              <section className="pivot-fields-panel">
                <h3>Choose fields</h3>
                <p>Tick a field to add it, or drag it into an area below.</p>
                <div className="pivot-fields-list">
                  {PIVOT_DIMENSIONS.filter((field) => !DATE_PARTS.includes(field)).map((field) => (
                    <PivotFieldOption key={field} field={field} checked={isSelected(field)} onToggle={toggleField} />
                  ))}
                  <details open>
                    <summary>Date</summary>
                    {DATE_PARTS.map((field) => (
                      <PivotFieldOption key={field} field={field} checked={isSelected(field)} onToggle={toggleField} />
                    ))}
                  </details>
                  <div className="pivot-measure-heading">Measures</div>
                  {VALUE_FIELDS.map((field) => (
                    <PivotFieldOption key={field} field={field} checked={isSelected(field)} onToggle={toggleField} />
                  ))}
                </div>
              </section>

              <section className="pivot-zones-panel">
                <h3>Drag fields between areas below</h3>
                <div className="pivot-zones-grid">
                  <DropZone
                    title="Report Filter"
                    items={reportFields}
                    onDrop={(event) => moveField(event, "filters", PIVOT_DIMENSIONS)}
                    onDropItem={(event, target) => moveField(event, "filters", PIVOT_DIMENSIONS, target)}
                    onRemove={remove(setReportFields)}
                  />
                  <DropZone
                    title="Column Labels"
                    items={columnFields}
                    onDrop={(event) => moveField(event, "columns", PIVOT_DIMENSIONS)}
                    onDropItem={(event, target) => moveField(event, "columns", PIVOT_DIMENSIONS, target)}
                    onRemove={remove(setColumnFields)}
                  />
                  <DropZone
                    title="Row Labels"
                    items={rowFields}
                    onDrop={(event) => moveField(event, "rows", PIVOT_DIMENSIONS)}
                    onDropItem={(event, target) => moveField(event, "rows", PIVOT_DIMENSIONS, target)}
                    onRemove={remove(setRowFields)}
                  />
                  <DropZone
                    title="Σ Values"
                    items={valueFields}
                    onDrop={(event) => moveField(event, "values", VALUE_FIELDS)}
                    onDropItem={(event, target) => moveField(event, "values", VALUE_FIELDS, target)}
                    onRemove={remove(setValueFields)}
                  />
                </div>
              </section>
            </aside>
          </div>
        )}

        <footer className="pivot-footer">
          <div className="pivot-footer-context">
            <span>Date From: {dates.from || "All"} &nbsp; To: {dates.to || "All"} &nbsp; · &nbsp; {filters.length} additional filter{filters.length === 1 ? "" : "s"}</span>
            {layoutStatus && <small>{layoutStatus}</small>}
          </div>
          <div className="pivot-layout-save-controls">
            <select value={selectedLayoutId} onChange={(event) => loadSavedLayout(event.target.value)} aria-label="Saved pivot layouts">
              <option value="">Load saved layout…</option>
              {savedLayouts.map((layout) => <option value={layout._id} key={layout._id}>{layout.name}</option>)}
            </select>
            <input
              type="text"
              maxLength="100"
              value={layoutName}
              placeholder="Layout name / remark"
              onChange={(event) => {
                setLayoutName(event.target.value);
                setSelectedLayoutId("");
                setLayoutStatus("");
              }}
            />
            <button type="button" onClick={saveLayout} disabled={savingLayout}>{savingLayout ? "Saving…" : "Save Layout"}</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ReportTable({ rows }) {
  return (
    <table className="grn-report-table sales-register-table">
      <thead><tr>{FIELDS.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {FIELDS.map((field) => {
              const value = row[field.key];
              if (field.type === "number") return <td key={field.key} className="number-cell">{field.key === "qty" ? value : money(value)}</td>;
              if (field.type === "date") return <td key={field.key}>{dateTime(value)}</td>;
              return <td key={field.key}>{value || "—"}</td>;
            })}
          </tr>
        ))}
        {!rows.length && <tr><td className="pivot-empty" colSpan={FIELDS.length}>No sales register records match these filters.</td></tr>}
      </tbody>
    </table>
  );
}

export default function SalesRegisterPage() {
  const [rows, setRows] = useState([]);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState([]);
  const [draft, setDraft] = useState({ field: "customer", condition: "Equals", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pivotOpen, setPivotOpen] = useState(false);

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
      const response = await fetch(`${API_URL}/reports/sales-register${query.size ? `?${query}` : ""}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load the sales register.");
      setRows(data.flatMap((order) => (order.items || []).map((item) => rowFromOrder(order, item))));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredRows = useMemo(() => rows.filter((row) => filters.every((filter) => matchesFilter(row, filter))), [filters, rows]);
  const draftField = FIELD_BY_KEY[draft.field];
  const availableRows = useMemo(() => rows.filter((row) => filters.filter((filter) => filter.field !== draft.field).every((filter) => matchesFilter(row, filter))), [draft.field, filters, rows]);
  const options = useMemo(() => [...new Set(availableRows.map((row) => String(row[draft.field] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [availableRows, draft.field]);
  const totals = useMemo(() => filteredRows.reduce((result, row) => ({ qty: result.qty + row.qty, gross: result.gross + row.gross, discount: result.discount + row.discount, net: result.net + row.net }), { qty: 0, gross: 0, discount: 0, net: 0 }), [filteredRows]);

  const changeField = (field) => {
    const type = FIELD_BY_KEY[field].type;
    setDraft({ field, condition: type === "date" || type === "number" ? "Equals" : "Equals", from: "", to: "" });
  };

  const addFilter = () => {
    if (!draft.from || (draft.condition === "Between" && !draft.to)) return;
    setFilters((current) => [...current, { ...draft, id: `${Date.now()}-${Math.random()}` }]);
    setDraft((current) => ({ ...current, from: "", to: "" }));
  };

  const clear = () => {
    setFilters([]);
    const emptyDates = { from: "", to: "" };
    setDates(emptyDates);
    setDraft({ field: "customer", condition: "Equals", from: "", to: "" });
    load(emptyDates);
  };

  const filterDescription = (filter) => {
    const label = FIELD_BY_KEY[filter.field]?.label || filter.field;
    if (FIELD_BY_KEY[filter.field]?.type === "text") return `${label}: ${filter.from}`;
    return `${label} ${filter.condition.toLowerCase()}: ${filter.from}${filter.condition === "Between" ? ` to ${filter.to}` : ""}`;
  };

  const createWorkbook = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Jockey Stock";
    return { ExcelJS, workbook };
  };

  const saveWorkbook = async (workbook, name) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadReport = async () => {
    const { workbook } = await createWorkbook();
    const sheet = workbook.addWorksheet("Sales Register", { views: [{ state: "frozen", ySplit: 4 }] });
    sheet.mergeCells(1, 1, 1, FIELDS.length);
    sheet.getCell("A1").value = "SALES REGISTER";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.mergeCells(2, 1, 2, FIELDS.length);
    sheet.getCell("A2").value = `Date From: ${dates.from || "All"}   To: ${dates.to || "All"}`;
    sheet.mergeCells(3, 1, 3, FIELDS.length);
    sheet.getCell("A3").value = `Applied Filters: ${filters.length ? filters.map(filterDescription).join(" | ") : "None"}`;
    const header = sheet.addRow(FIELDS.map((field) => field.label));
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F75B5" } };

    const byDocument = new Map();
    filteredRows.forEach((row) => {
      if (!byDocument.has(row.documentNo)) byDocument.set(row.documentNo, []);
      byDocument.get(row.documentNo).push(row);
    });
    byDocument.forEach((documentRows, documentNo) => {
      documentRows.forEach((row) => {
        sheet.addRow(FIELDS.map((field) => field.type === "date" ? new Date(row[field.key]) : row[field.key]));
      });
      const sum = documentRows.reduce((result, row) => ({ qty: result.qty + row.qty, gross: result.gross + row.gross, discount: result.discount + row.discount, net: result.net + row.net }), { qty: 0, gross: 0, discount: 0, net: 0 });
      const discountValues = Array(FIELDS.length).fill("");
      discountValues[1] = "Subtotal Discount";
      discountValues[FIELDS.findIndex((field) => field.key === "documentNo")] = documentNo;
      discountValues[FIELDS.findIndex((field) => field.key === "discount")] = sum.discount;
      const discountRow = sheet.addRow(discountValues);
      discountRow.font = { italic: true, bold: true };
      const totalValues = Array(FIELDS.length).fill("");
      totalValues[1] = "Document Total";
      totalValues[FIELDS.findIndex((field) => field.key === "documentNo")] = documentNo;
      totalValues[FIELDS.findIndex((field) => field.key === "qty")] = sum.qty;
      totalValues[FIELDS.findIndex((field) => field.key === "gross")] = sum.gross;
      totalValues[FIELDS.findIndex((field) => field.key === "discount")] = sum.discount;
      totalValues[FIELDS.findIndex((field) => field.key === "net")] = sum.net;
      const totalRow = sheet.addRow(totalValues);
      totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } };
    });
    sheet.columns = FIELDS.map((field) => ({
      width: field.key === "productName" || field.key === "customer" ? 27
        : field.key === "date" ? 21
          : ["packingQuantity", "cartonQuantity"].includes(field.key) ? 18
            : field.type === "number" ? 14 : 16,
    }));
    sheet.getColumn(FIELDS.findIndex((field) => field.key === "date") + 1).numFmt = "dd/mm/yyyy hh:mm:ss";
    FIELDS.filter((field) => field.type === "number" && field.key !== "qty").forEach((field) => {
      sheet.getColumn(FIELDS.findIndex((item) => item.key === field.key) + 1).numFmt = "#,##0.00";
    });
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: FIELDS.length } };
    await saveWorkbook(workbook, `sales-register-${dateOnly(new Date())}.xlsx`);
  };

  const downloadPivot = async ({ pivotRows, pivotTotals, rowFields, columnFields, displayColumns, valueFields }) => {
    const { workbook } = await createWorkbook();
    const sheet = workbook.addWorksheet("Pivot View");
    const width = Math.max(1, rowFields.length + displayColumns.length * Math.max(1, valueFields.length));
    sheet.mergeCells(1, 1, 1, width);
    sheet.getCell("A1").value = "SALES REGISTER - PIVOT VIEW";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.mergeCells(2, 1, 2, width);
    sheet.getCell("A2").value = `Date From: ${dates.from || "All"}   To: ${dates.to || "All"}   |   Filters: ${filters.length ? filters.map(filterDescription).join("; ") : "None"}`;
    sheet.addRow([...rowFields, ...displayColumns.flatMap((column) => valueFields.map((value) => `${column ? `${column} - ` : ""}Sum of ${value}`))]);
    pivotRows.forEach((group) => sheet.addRow([
      ...group.rowParts,
      ...displayColumns.flatMap((column) => valueFields.map((field) => group.cells[column]?.[field] || 0)),
    ]));
    const grandTotals = valueFields.map((field) => Number(pivotTotals[field] || 0));
    sheet.addRow(["Grand Total", ...Array(Math.max(0, rowFields.length - 1)).fill(""), ...displayColumns.flatMap((column) => column ? valueFields.map(() => "") : grandTotals)]);
    sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F75B5" } };
    sheet.getRow(sheet.rowCount).font = { bold: true };
    sheet.columns.forEach((column) => { column.width = 20; });
    await saveWorkbook(workbook, `sales-register-pivot-${dateOnly(new Date())}.xlsx`);
  };

  return (
    <section className="sales-register-page">
      <div className="sales-register-selection audit-filter">
        <label>Selection
          <select value={draft.field} onChange={(event) => changeField(event.target.value)}>{FIELDS.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select>
        </label>
        {draftField.type !== "text" && (
          <label>Condition
            <select value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value, to: "" }))}>
              {(draftField.type === "date" ? DATE_CONDITIONS : NUMBER_CONDITIONS).map((condition) => <option key={condition}>{condition}</option>)}
            </select>
          </label>
        )}
        <label>Value from
          {draftField.type === "text" ? (
            <select value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}><option value="">Select a value</option>{options.map((option) => <option key={option}>{option}</option>)}</select>
          ) : <input type={draftField.type === "date" ? "date" : "number"} step="any" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />}
        </label>
        {draft.condition === "Between" && draftField.type !== "text" && (
          <label>Value to<input type={draftField.type === "date" ? "date" : "number"} step="any" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} /></label>
        )}
        <button type="button" onClick={addFilter} disabled={!draft.from || (draft.condition === "Between" && !draft.to)}><FiPlus /> Add selection</button>
      </div>

      <div className="sales-register-selection-list">
        <strong>Selected filters</strong>
        {filters.map((filter) => <span key={filter.id}>{filterDescription(filter)}<button type="button" onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}><FiX /></button></span>)}
        {!filters.length && <small>No additional filters applied.</small>}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="sales-register-summary">
        <article><span>Lines</span><strong>{filteredRows.length}</strong></article>
        <article><span>Total Qty</span><strong>{totals.qty.toLocaleString()}</strong></article>
        <article><span>Gross Amount</span><strong>LKR {money(totals.gross)}</strong></article>
        <article><span>Net Amount</span><strong>LKR {money(totals.net)}</strong></article>
      </div>

      <div className="sales-register-actions">
        {(filters.length > 0 || dates.from || dates.to) && <button className="pivot-view-button" type="button" onClick={() => setPivotOpen(true)}><FiGrid /> Pivot View</button>}
        <button className="secondary-action" type="button" onClick={clear}><FiRefreshCw /> Clear</button>
        <button type="button" onClick={downloadReport}><FiDownload /> Download Excel</button>
      </div>

      <div className="grn-report-table-wrap">
        {loading ? <p className="sales-register-loading">Loading sales register…</p> : <ReportTable rows={filteredRows} />}
      </div>

      {pivotOpen && (
        <PivotDesigner
          rows={filteredRows}
          filters={filters}
          filterLabels={[
            ...(dates.from || dates.to ? [`Date: ${dates.from || "All"} to ${dates.to || "All"}`] : []),
            ...filters.map(filterDescription),
          ]}
          dates={dates}
          onClose={() => setPivotOpen(false)}
          exportWorkbook={downloadPivot}
        />
      )}
    </section>
  );
}
