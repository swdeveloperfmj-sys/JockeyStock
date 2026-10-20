import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiFilter, FiGrid, FiPlus, FiRefreshCw, FiX } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Keep the same selection/filter experience as the Sales Register, but use
// the fields that make sense for an on-hand inventory balance.
const FIELDS = [
  ["productCode", "Product Code", "text"], ["productName", "Product Name", "text"],
  ["style", "Style", "text"], ["packingQuantity", "Packing Quantity", "text"],
  ["cartonQuantity", "Carton Quantity", "text"], ["location", "Location", "text"],
  ["gender", "Gender", "text"], ["category", "Category", "text"],
  ["subCategory", "SubCategory", "text"], ["subSubCategory", "SubSubCategory", "text"],
  ["supplier", "Supplier", "text"], ["colour", "Colour", "text"], ["size", "Size", "text"],
  ["stockBalance", "Stock Balance", "number"], ["costPrice", "Cost Price", "number"],
  ["stockValue", "Stock Value", "number"], ["lastUpdated", "Last Updated", "date"],
].map(([key, label, type]) => ({ key, label, type }));

const fieldByKey = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
const numberConditions = ["Equals", "Greater than or equal", "Less than or equal", "Between"];
const dateConditions = ["Equals", "Before", "After", "Between"];
const money = (value) => Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateOnly = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const dateTime = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB"); };

function matchesFilter(row, filter) {
  const field = fieldByKey[filter.field];
  if (!field) return true;
  if (field.type === "text") return String(row[filter.field] ?? "") === String(filter.from ?? "");
  if (field.type === "date") {
    const current = dateOnly(row[filter.field]);
    if (filter.condition === "Before") return current <= filter.from;
    if (filter.condition === "After") return current >= filter.from;
    if (filter.condition === "Between") return current >= filter.from && current <= filter.to;
    return current === filter.from;
  }
  const current = Number(row[filter.field] || 0), from = Number(filter.from), to = Number(filter.to);
  if (filter.condition === "Greater than or equal") return current >= from;
  if (filter.condition === "Less than or equal") return current <= from;
  if (filter.condition === "Between") return current >= from && current <= to;
  return current === from;
}

function BalanceTable({ rows }) {
  return <table className="grn-report-table sales-register-table stock-balance-table"><thead><tr>{FIELDS.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{FIELDS.map((field) => <td key={field.key} className={field.type === "number" ? "number-cell" : ""}>{field.type === "number" ? (field.key === "stockBalance" ? Number(row[field.key] || 0).toLocaleString() : money(row[field.key])) : field.type === "date" ? dateTime(row[field.key]) : row[field.key] || "—"}</td>)}</tr>)}{!rows.length && <tr><td className="pivot-empty" colSpan={FIELDS.length}>No stock balance records match these filters.</td></tr>}</tbody></table>;
}

const PIVOT_LABELS = FIELDS.filter((field) => !["stockBalance", "costPrice", "stockValue", "lastUpdated"].includes(field.key));

function LegacyStockBalancePivotContent({ rows, filters = [], onClose, onConfiguration }) {
  const [tab, setTab] = useState("pivot");
  const [rowField, setRowField] = useState(null);
  const [columnField, setColumnField] = useState(null);
  const [valueField, setValueField] = useState(null);
  const [filterField, setFilterField] = useState(null);
  const [filterValue, setFilterValue] = useState("");
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState("");
  const [layoutName, setLayoutName] = useState("");
  const [layoutStatus, setLayoutStatus] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/reports/stock-balance/pivot-layouts`, { credentials: "include" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not load saved layouts."); if (active) setSavedLayouts(data); })
      .catch((error) => { if (active) setLayoutStatus(error.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    onConfiguration?.({ rowField, columnField, valueField, filterField, filterValue });
  }, [rowField, columnField, valueField, filterField, filterValue, onConfiguration]);
  useEffect(() => {
    const applyLayout = (event) => {
      const layout = event.detail;
      setRowField(layout.rowField || null); setColumnField(layout.columnField || null); setValueField(layout.valueField || null); setFilterField(layout.filterField || null); setFilterValue(layout.filterValue || "");
    };
    window.addEventListener("stock-balance-load-layout", applyLayout);
    return () => window.removeEventListener("stock-balance-load-layout", applyLayout);
  }, []);
  const dimensions = PIVOT_LABELS;
  const values = FIELDS.filter((field) => field.type === "number");
  const activeRows = useMemo(() => filterField && filterValue ? rows.filter((row) => String(row[filterField] || "Unspecified") === filterValue) : rows, [filterField, filterValue, rows]);
  const pivot = useMemo(() => {
    if (!rowField || !valueField) return { columns: [], groups: [], totals: {} };
    const columns = columnField ? [...new Set(activeRows.map((row) => String(row[columnField] || "Unspecified")))].sort() : [""];
    const groups = new Map();
    activeRows.forEach((row) => {
      const label = String(row[rowField] || "Unspecified"), column = columnField ? String(row[columnField] || "Unspecified") : "";
      if (!groups.has(label)) groups.set(label, Object.fromEntries(columns.map((item) => [item, 0])));
      groups.get(label)[column] += Number(row[valueField] || 0);
    });
    return { columns, groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })), totals: Object.fromEntries(columns.map((column) => [column, activeRows.filter((row) => !columnField || String(row[columnField] || "Unspecified") === column).reduce((sum, row) => sum + Number(row[valueField] || 0), 0)])) };
  }, [activeRows, columnField, rowField, valueField]);
  const format = (value) => valueField === "stockBalance" ? Number(value || 0).toLocaleString() : `LKR ${money(value)}`;
  const exportPivot = async () => {
    if (!rowField || !valueField) return;
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stock Balance Pivot");
    sheet.addRow([fieldByKey[rowField].label, ...pivot.columns, "Grand Total"]);
    pivot.groups.forEach(([label, cells]) => sheet.addRow([label, ...pivot.columns.map((column) => cells[column]), Object.values(cells).reduce((sum, value) => sum + value, 0)]));
    sheet.addRow(["Grand Total", ...pivot.columns.map((column) => pivot.totals[column]), Object.values(pivot.totals).reduce((sum, value) => sum + value, 0)]);
    sheet.getRow(1).font = { bold: true }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F75B5" } };
    const buffer = await workbook.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `stock-balance-pivot-${dateOnly(new Date())}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  };
  const loadLayout = (id) => {
    setSelectedLayoutId(id); const layout = savedLayouts.find((item) => item._id === id); if (!layout) return;
    setRowField(layout.rowField || null); setColumnField(layout.columnField || null); setValueField(layout.valueField || null); setFilterField(layout.filterField || null); setFilterValue(layout.filterValue || ""); setLayoutName(layout.name || ""); setLayoutStatus(`Loaded “${layout.name}”.`);
  };
  const saveLayout = async () => {
    const name = layoutName.trim(); if (!name) return setLayoutStatus("Enter a layout name or remark before saving.");
    setSavingLayout(true); setLayoutStatus("");
    try {
      const response = await fetch(`${API_URL}/reports/stock-balance/pivot-layouts`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, rowField, columnField, valueField, filterField, filterValue }) });
      const saved = await response.json(); if (!response.ok) throw new Error(saved.message || "Could not save this layout.");
      setSavedLayouts((current) => [saved, ...current.filter((item) => item._id !== saved._id && item.name !== saved.name)]); setSelectedLayoutId(saved._id); setLayoutName(saved.name); setLayoutStatus(`Saved “${saved.name}”.`);
    } catch (error) { setLayoutStatus(error.message); } finally { setSavingLayout(false); }
  };
  const drop = (setter, allowed) => (event) => { event.preventDefault(); const key = event.dataTransfer.getData("text/plain"); if (allowed.includes(key)) setter(key); };
  const FieldOption = ({ field }) => <label className="pivot-field-option" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", field.key)}><input type="checkbox" checked={[rowField, columnField, valueField, filterField].includes(field.key)} onChange={(event) => { if (!event.target.checked) { if (rowField === field.key) setRowField(null); if (columnField === field.key) setColumnField(null); if (valueField === field.key) setValueField(null); if (filterField === field.key) { setFilterField(null); setFilterValue(""); } } else if (field.type === "number") setValueField(field.key); else setRowField(field.key); }} /><span>{field.label}</span></label>;
  const Zone = ({ title, field, setter, allowed }) => <section className={`pivot-zone ${title === "Row Labels" ? "pivot-row-label-zone" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={drop(setter, allowed)}><h4>{title}</h4><div className="pivot-zone-content">{field ? <span className="pivot-field-chip" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", field)}>{fieldByKey[field].label}<button type="button" onClick={() => { setter(null); if (title === "Report Filter") setFilterValue(""); }}><FiX /></button></span> : <small>Drag fields here</small>}</div></section>;
  return <div className="modal-backdrop pivot-fullscreen" role="dialog" aria-modal="true" aria-label="Stock balance pivot designer"><div className="pivot-designer"><header className="pivot-topbar"><div><span>STOCK BALANCE REPORT</span><h2>Pivot Designer</h2></div><div className="pivot-top-actions"><button type="button" onClick={exportPivot} disabled={!rowField || !valueField}><FiDownload /> Export Pivot XLSX</button><button className="pivot-close" type="button" onClick={onClose}><FiX /></button></div></header><nav className="pivot-tabs"><button type="button" className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>Report Viewer</button><button type="button" className={tab === "pivot" ? "active" : ""} onClick={() => setTab("pivot")}>Pivot View</button></nav>{tab === "report" ? <div className="pivot-report-view"><p>{rows.length} filtered stock balance products</p><div className="grn-report-table-wrap"><BalanceTable rows={rows} /></div></div> : <div className="pivot-workspace"><main className="pivot-canvas"><div className="pivot-filter-strip"><div className="pivot-base-filters"><strong><FiFilter /> Applied selections</strong><span>{filters.length ? `${filters.length} filter${filters.length === 1 ? "" : "s"} applied` : "All stock balance records"}</span><b>{activeRows.length} products</b></div><div className="pivot-live-filters"><strong>Pivot filters</strong>{filterField ? <label>{fieldByKey[filterField].label}<select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}><option value="">All</option>{[...new Set(rows.map((row) => String(row[filterField] || "Unspecified")))].sort().map((value) => <option key={value}>{value}</option>)}</select></label> : <small>Drag another field into Report Filter for additional pivot filtering.</small>}</div></div><div className="pivot-result-wrap">{!rowField || !valueField ? <div className="pivot-start-state"><FiGrid /><h3>Build your pivot view</h3><p>Tick or drag at least one label field and one value field.</p></div> : <table className="pivot-result-table"><thead><tr><th>{fieldByKey[rowField].label}</th>{pivot.columns.map((column) => <th key={column}>{column || "Values"}</th>)}</tr></thead><tbody>{pivot.groups.map(([label, cells]) => <tr key={label}><td className="pivot-label-cell">{label}</td>{pivot.columns.map((column) => <td key={column}>{format(cells[column])}</td>)}</tr>)}</tbody><tfoot><tr><th>Grand Total</th>{pivot.columns.map((column) => <th key={column}>{format(pivot.totals[column])}</th>)}</tr></tfoot></table>}</div></main><aside className="pivot-builder"><section className="pivot-fields-panel"><h3>Choose fields</h3><p>Tick a field to add it, or drag it into an area below.</p><div className="pivot-fields-list">{dimensions.map((field) => <FieldOption field={field} key={field.key} />)}<div className="pivot-measure-heading">Measures</div>{values.map((field) => <FieldOption field={field} key={field.key} />)}</div></section><section className="pivot-zones-panel"><h3>Drag fields between areas below</h3><div className="pivot-zones-grid"><Zone title="Report Filter" field={filterField} setter={setFilterField} allowed={dimensions.map((field) => field.key)} /><Zone title="Column Labels" field={columnField} setter={setColumnField} allowed={dimensions.map((field) => field.key)} /><Zone title="Row Labels" field={rowField} setter={setRowField} allowed={dimensions.map((field) => field.key)} /><Zone title="Σ Values" field={valueField} setter={setValueField} allowed={values.map((field) => field.key)} /></div></section></aside></div>}<footer className="pivot-footer"><div className="pivot-footer-context"><span>{filters.length ? `${filters.length} additional filter${filters.length === 1 ? "" : "s"}` : "No additional filters"}</span></div><button type="button" onClick={onClose}>Close</button></footer></div></div>;
}

function StockBalancePivotContent({ rows, filters = [], onClose, onConfiguration }) {
  const [tab, setTab] = useState("pivot"), [rowFields, setRowFields] = useState([]), [columnFields, setColumnFields] = useState([]), [valueFields, setValueFields] = useState([]), [filterFields, setFilterFields] = useState([]), [filterValues, setFilterValues] = useState({});
  const dimensions = PIVOT_LABELS, values = FIELDS.filter((field) => field.type === "number");
  const allowedDimensions = dimensions.map((field) => field.key), allowedValues = values.map((field) => field.key);
  useEffect(() => { onConfiguration?.({ rowFields, columnFields, valueFields, filterFields, filterValues }); }, [rowFields, columnFields, valueFields, filterFields, filterValues, onConfiguration]);
  useEffect(() => {
    const listeners = [];
    const bindHeaders = () => document.querySelectorAll(".pivot-result-table thead th").forEach((header) => {
      if (header.dataset.pivotDragBound) return;
      const label = header.textContent.trim().replace(/^Sum of\s+/i, "");
      const key = Object.values(fieldByKey).find((field) => field.label.toLowerCase() === label.toLowerCase())?.key
        || (header.parentElement?.rowIndex === 0 && columnFields[0]);
      if (!key) return;
      header.draggable = true;
      header.dataset.pivotDragBound = "true";
      header.classList.add("pivot-draggable-header");
      const drag = (event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", key); };
      const dragOver = (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; };
      const drop = (event) => {
        event.preventDefault(); const source = event.dataTransfer.getData("text/plain"); if (!source || source === key) return;
        const groups = [[rowFields, setRowFields], [columnFields, setColumnFields], [valueFields, setValueFields]];
        const destination = groups.find(([items]) => items.includes(key)); if (!destination) return;
        const sourceGroup = groups.find(([items]) => items.includes(source));
        if (sourceGroup && sourceGroup[1] !== destination[1]) sourceGroup[1]((current) => current.filter((item) => item !== source));
        destination[1]((current) => { const without = current.filter((item) => item !== source); const at = without.indexOf(key); return at < 0 ? [...without, source] : [...without.slice(0, at), source, ...without.slice(at)]; });
      };
      header.addEventListener("dragstart", drag); header.addEventListener("dragover", dragOver); header.addEventListener("drop", drop); listeners.push([header, drag, dragOver, drop]);
    });
    const timer = window.setTimeout(bindHeaders, 0);
    const observer = new MutationObserver(bindHeaders);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); listeners.forEach(([header, drag, dragOver, drop]) => { header.removeEventListener("dragstart", drag); header.removeEventListener("dragover", dragOver); header.removeEventListener("drop", drop); delete header.dataset.pivotDragBound; }); };
  }, [rowFields, columnFields, valueFields, tab]);
  useEffect(() => { const apply = (event) => { const layout = event.detail; setRowFields(layout.rowFields || (layout.rowField ? [layout.rowField] : [])); setColumnFields(layout.columnFields || (layout.columnField ? [layout.columnField] : [])); setValueFields(layout.valueFields || (layout.valueField ? [layout.valueField] : [])); setFilterFields(layout.filterFields || (layout.filterField ? [layout.filterField] : [])); setFilterValues(layout.filterValues || (layout.filterField && layout.filterValue ? { [layout.filterField]: layout.filterValue } : {})); }; window.addEventListener("stock-balance-load-layout", apply); return () => window.removeEventListener("stock-balance-load-layout", apply); }, []);
  const activeRows = useMemo(() => rows.filter((row) => filterFields.every((key) => !filterValues[key] || String(row[key] || "Unspecified") === filterValues[key])), [rows, filterFields, filterValues]);
  const pivot = useMemo(() => { const groups = new Map(), columns = new Set(); activeRows.forEach((row) => { const rowParts = rowFields.map((key) => String(row[key] || "Unspecified")), column = columnFields.map((key) => String(row[key] || "Unspecified")).join(" / "), id = JSON.stringify(rowParts); columns.add(column); if (!groups.has(id)) groups.set(id, { rowParts, cells: {} }); const group = groups.get(id); if (!group.cells[column]) group.cells[column] = Object.fromEntries(valueFields.map((key) => [key, 0])); valueFields.forEach((key) => { group.cells[column][key] += Number(row[key] || 0); }); }); return { rows: [...groups.values()].sort((a, b) => a.rowParts.join("|").localeCompare(b.rowParts.join("|"))), columns: [...columns].sort(), totals: Object.fromEntries(valueFields.map((key) => [key, activeRows.reduce((sum, row) => sum + Number(row[key] || 0), 0)])) }; }, [activeRows, rowFields, columnFields, valueFields]);
  const ready = valueFields.length && (rowFields.length || columnFields.length), displayColumns = columnFields.length ? pivot.columns : [""];
  const format = (key, value) => key === "stockBalance" ? Number(value || 0).toLocaleString() : `LKR ${money(value)}`;
  const removeEverywhere = (key) => { [setRowFields, setColumnFields, setValueFields, setFilterFields].forEach((setter) => setter((current) => current.filter((item) => item !== key))); setFilterValues((current) => { const next = { ...current }; delete next[key]; return next; }); };
  const move = (event, target, allowed) => { event.preventDefault(); const key = event.dataTransfer.getData("text/plain"); if (!allowed.includes(key)) return; const setters = { rows: setRowFields, columns: setColumnFields, values: setValueFields, filters: setFilterFields }; Object.entries(setters).forEach(([name, setter]) => setter((current) => name === target ? (current.includes(key) ? current : [...current, key]) : current.filter((item) => item !== key))); };
  const selected = (key) => [...rowFields, ...columnFields, ...valueFields, ...filterFields].includes(key);
  const FieldOption = ({ field }) => <label className="pivot-field-option" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", field.key)}><input type="checkbox" checked={selected(field.key)} onChange={(event) => { if (!event.target.checked) removeEverywhere(field.key); else (field.type === "number" ? setValueFields : setRowFields)((current) => [...current, field.key]); }} /><span>{field.label}</span></label>;
  const Zone = ({ title, items, setter, allowed, target }) => <section className={`pivot-zone ${title === "Row Labels" ? "pivot-row-label-zone" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event, target, allowed)}><h4>{title}</h4><div className="pivot-zone-content">{items.map((key) => <span className="pivot-field-chip" draggable key={key} onDragStart={(event) => event.dataTransfer.setData("text/plain", key)}>{fieldByKey[key].label}<button type="button" onClick={() => { setter((current) => current.filter((item) => item !== key)); if (target === "filters") setFilterValues((current) => { const next = { ...current }; delete next[key]; return next; }); }}><FiX /></button></span>)}{!items.length && <small>Drag fields here</small>}</div></section>;
  const exportPivot = async () => { if (!ready) return; const { default: ExcelJS } = await import("exceljs"); const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Stock Balance Pivot"); sheet.addRow([...rowFields.map((key) => fieldByKey[key].label), ...displayColumns.flatMap((column) => valueFields.map((key) => `${column ? `${column} / ` : ""}${fieldByKey[key].label}`))]); pivot.rows.forEach((group) => sheet.addRow([...group.rowParts, ...displayColumns.flatMap((column) => valueFields.map((key) => group.cells[column]?.[key] || 0))])); const buffer = await workbook.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })), anchor = document.createElement("a"); anchor.href = url; anchor.download = `stock-balance-pivot-${dateOnly(new Date())}.xlsx`; anchor.click(); URL.revokeObjectURL(url); };
  return <div className="modal-backdrop pivot-fullscreen" role="dialog" aria-modal="true" aria-label="Stock balance pivot designer"><div className="pivot-designer"><header className="pivot-topbar"><div><span>STOCK BALANCE REPORT</span><h2>Pivot Designer</h2></div><div className="pivot-top-actions"><button type="button" onClick={exportPivot} disabled={!ready}><FiDownload /> Export Pivot XLSX</button><button className="pivot-close" type="button" onClick={onClose}><FiX /></button></div></header><nav className="pivot-tabs"><button type="button" className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>Report Viewer</button><button type="button" className={tab === "pivot" ? "active" : ""} onClick={() => setTab("pivot")}>Pivot View</button></nav>{tab === "report" ? <div className="pivot-report-view"><p>{rows.length} filtered stock balance products</p><div className="grn-report-table-wrap"><BalanceTable rows={rows} /></div></div> : <div className="pivot-workspace"><main className="pivot-canvas"><div className="pivot-filter-strip"><div className="pivot-base-filters"><strong><FiFilter /> Applied selections</strong><span>{filters.length ? `${filters.length} filter${filters.length === 1 ? "" : "s"} applied` : "All stock balance records"}</span><b>{activeRows.length} products</b></div><div className="pivot-live-filters"><strong>Pivot filters</strong>{filterFields.map((key) => <label key={key}>{fieldByKey[key].label}<select value={filterValues[key] || ""} onChange={(event) => setFilterValues((current) => ({ ...current, [key]: event.target.value }))}><option value="">All</option>{[...new Set(rows.map((row) => String(row[key] || "Unspecified")))].sort().map((value) => <option key={value}>{value}</option>)}</select></label>)}{!filterFields.length && <small>Drag another field into Report Filter for additional pivot filtering.</small>}</div></div><div className="pivot-result-wrap">{!ready ? <div className="pivot-start-state"><FiGrid /><h3>Build your pivot view</h3><p>Tick or drag at least one label field and one value field.</p></div> : <table className="pivot-result-table"><thead><tr>{rowFields.map((key) => <th key={key} rowSpan="2">{fieldByKey[key].label}</th>)}{displayColumns.map((column) => <th key={column} colSpan={valueFields.length}>{column || "Values"}</th>)}</tr><tr>{displayColumns.flatMap((column) => valueFields.map((key) => <th key={`${column}-${key}`}>Sum of {fieldByKey[key].label}</th>))}</tr></thead><tbody>{pivot.rows.map((group, index) => <tr key={index}>{group.rowParts.map((part, partIndex) => <td className="pivot-label-cell" key={partIndex}>{part}</td>)}{displayColumns.flatMap((column) => valueFields.map((key) => <td key={`${column}-${key}`}>{format(key, group.cells[column]?.[key])}</td>))}</tr>)}</tbody><tfoot><tr><th colSpan={Math.max(1, rowFields.length)}>Grand Total</th>{displayColumns.flatMap((column) => valueFields.map((key) => <th key={`${column}-${key}`}>{displayColumns.length === 1 ? format(key, pivot.totals[key]) : ""}</th>))}</tr></tfoot></table>}</div></main><aside className="pivot-builder"><section className="pivot-fields-panel"><h3>Choose fields</h3><p>Tick a field to add it, or drag it into an area below.</p><div className="pivot-fields-list">{dimensions.map((field) => <FieldOption field={field} key={field.key} />)}<div className="pivot-measure-heading">Measures</div>{values.map((field) => <FieldOption field={field} key={field.key} />)}</div></section><section className="pivot-zones-panel"><h3>Drag fields between areas below</h3><div className="pivot-zones-grid"><Zone title="Report Filter" items={filterFields} setter={setFilterFields} allowed={allowedDimensions} target="filters" /><Zone title="Column Labels" items={columnFields} setter={setColumnFields} allowed={allowedDimensions} target="columns" /><Zone title="Row Labels" items={rowFields} setter={setRowFields} allowed={allowedDimensions} target="rows" /><Zone title="Σ Values" items={valueFields} setter={setValueFields} allowed={allowedValues} target="values" /></div></section></aside></div>}<footer className="pivot-footer"><div className="pivot-footer-context"><span>{filters.length ? `${filters.length} additional filter${filters.length === 1 ? "" : "s"}` : "No additional filters"}</span></div><button type="button" onClick={onClose}>Close</button></footer></div></div>;
}

function StockBalancePivot({ rows, filters = [], onClose }) {
  const [layouts, setLayouts] = useState([]), [layoutId, setLayoutId] = useState(""), [name, setName] = useState(""), [status, setStatus] = useState(""), [saving, setSaving] = useState(false);
  const [configuration, setConfiguration] = useState({ rowField: null, columnField: null, valueField: null, filterField: null, filterValue: "" });
  useEffect(() => {
    fetch(`${API_URL}/reports/stock-balance/pivot-layouts`, { credentials: "include" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not load saved layouts."); setLayouts(data); })
      .catch((error) => setStatus(error.message));
  }, []);
  const load = (id) => { setLayoutId(id); const layout = layouts.find((item) => item._id === id); if (!layout) return; setName(layout.name); setStatus(`Loaded “${layout.name}”.`); window.dispatchEvent(new CustomEvent("stock-balance-load-layout", { detail: layout })); };
  const save = async () => {
    const layoutName = name.trim(); if (!layoutName) return setStatus("Enter a layout name or remark before saving.");
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`${API_URL}/reports/stock-balance/pivot-layouts`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: layoutName, ...configuration }) });
      const saved = await response.json(); if (!response.ok) throw new Error(saved.message || "Could not save this layout.");
      setLayouts((current) => [saved, ...current.filter((item) => item._id !== saved._id && item.name !== saved.name)]); setLayoutId(saved._id); setName(saved.name); setStatus(`Saved “${saved.name}”.`);
    } catch (error) { setStatus(error.message); } finally { setSaving(false); }
  };
  return <><StockBalancePivotContent rows={rows} filters={filters} onClose={onClose} onConfiguration={setConfiguration} /><div className="pivot-stock-layout-controls"><small>{status}</small><select value={layoutId} onChange={(event) => load(event.target.value)} aria-label="Saved pivot layouts"><option value="">Load saved layout…</option>{layouts.map((layout) => <option key={layout._id} value={layout._id}>{layout.name}</option>)}</select><input type="text" maxLength="100" value={name} placeholder="Layout name / remark" onChange={(event) => { setName(event.target.value); setLayoutId(""); setStatus(""); }} /><button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Layout"}</button></div></>;
}

function LegacyStockBalancePivot({ rows, onClose }) {
  const [rowField, setRowField] = useState("productName");
  const [columnField, setColumnField] = useState("location");
  const [valueField, setValueField] = useState("stockBalance");
  const pivot = useMemo(() => {
    const columns = [...new Set(rows.map((row) => String(row[columnField] || "Unspecified")))].sort();
    const groups = new Map();
    rows.forEach((row) => {
      const label = String(row[rowField] || "Unspecified");
      if (!groups.has(label)) groups.set(label, Object.fromEntries(columns.map((column) => [column, 0])));
      groups.get(label)[String(row[columnField] || "Unspecified")] += Number(row[valueField] || 0);
    });
    return { columns, groups: [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })), totals: Object.fromEntries(columns.map((column) => [column, rows.filter((row) => String(row[columnField] || "Unspecified") === column).reduce((sum, row) => sum + Number(row[valueField] || 0), 0)])) };
  }, [columnField, rowField, rows, valueField]);
  const valueLabel = fieldByKey[valueField].label;
  const number = (value) => valueField === "stockValue" || valueField === "costPrice" ? `LKR ${money(value)}` : Number(value || 0).toLocaleString();
  return <div className="modal-backdrop pivot-fullscreen" role="dialog" aria-modal="true" aria-label="Stock balance pivot view"><div className="pivot-designer"><header className="pivot-topbar"><div><span>STOCK BALANCE REPORT</span><h2>Pivot View</h2></div><div className="pivot-top-actions"><button className="pivot-close" type="button" onClick={onClose}><FiX /></button></div></header><div className="pivot-filter-strip"><label>Row labels<select value={rowField} onChange={(event) => setRowField(event.target.value)}>{PIVOT_LABELS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label><label>Column labels<select value={columnField} onChange={(event) => setColumnField(event.target.value)}>{PIVOT_LABELS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label><label>Values<select value={valueField} onChange={(event) => setValueField(event.target.value)}><option value="stockBalance">Sum of Stock Balance</option><option value="stockValue">Sum of Stock Value</option><option value="costPrice">Sum of Cost Price</option></select></label><b>{rows.length} filtered products</b></div><main className="pivot-canvas"><div className="pivot-result-wrap"><table className="pivot-result-table"><thead><tr><th>{fieldByKey[rowField].label}</th>{pivot.columns.map((column) => <th key={column}>{column}</th>)}<th>Grand Total</th></tr></thead><tbody>{pivot.groups.map(([label, values]) => <tr key={label}><td className="pivot-label-cell">{label}</td>{pivot.columns.map((column) => <td key={column}>{number(values[column])}</td>)}<td>{number(Object.values(values).reduce((sum, value) => sum + value, 0))}</td></tr>)}{!pivot.groups.length && <tr><td className="pivot-empty" colSpan={pivot.columns.length + 2}>No matching products</td></tr>}</tbody><tfoot><tr><th>Grand Total</th>{pivot.columns.map((column) => <th key={column}>{number(pivot.totals[column])}</th>)}<th>{number(Object.values(pivot.totals).reduce((sum, value) => sum + value, 0))}</th></tr></tfoot></table></div></main><footer className="pivot-footer"><span>Rows: {fieldByKey[rowField].label} · Columns: {fieldByKey[columnField].label} · Values: {valueLabel}</span><button type="button" onClick={onClose}>Close</button></footer></div></div>;
}

export default function StockBalanceReportPage() {
  const [rows, setRows] = useState([]), [dates, setDates] = useState({ from: "", to: "" }), [filters, setFilters] = useState([]);
  const [draft, setDraft] = useState({ field: "productCode", condition: "Equals", from: "", to: "" });
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [pivotOpen, setPivotOpen] = useState(false);
  const load = async (range = dates) => {
    if (range.from && range.to && range.from > range.to) return setError("From date cannot be after To date.");
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams(); if (range.from) query.set("from", range.from); if (range.to) query.set("to", range.to);
      const response = await fetch(`${API_URL}/reports/stock-balance${query.size ? `?${query}` : ""}`, { credentials: "include" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not load the stock balance report.");
      setRows(data);
    } catch (loadError) { setError(loadError.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const filteredRows = useMemo(() => rows.filter((row) => filters.every((filter) => matchesFilter(row, filter))), [rows, filters]);
  const draftField = fieldByKey[draft.field];
  const availableRows = useMemo(() => rows.filter((row) => filters.filter((filter) => filter.field !== draft.field).every((filter) => matchesFilter(row, filter))), [rows, filters, draft.field]);
  const options = useMemo(() => [...new Set(availableRows.map((row) => String(row[draft.field] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [availableRows, draft.field]);
  const totals = useMemo(() => filteredRows.reduce((total, row) => ({ quantity: total.quantity + Number(row.stockBalance || 0), cost: total.cost + Number(row.stockValue || 0) }), { quantity: 0, cost: 0 }), [filteredRows]);
  const changeField = (field) => setDraft({ field, condition: "Equals", from: "", to: "" });
  const filterDescription = (filter) => `${fieldByKey[filter.field]?.label || filter.field}${fieldByKey[filter.field]?.type === "text" ? ":" : ` ${filter.condition.toLowerCase()}:`} ${filter.from}${filter.condition === "Between" ? ` to ${filter.to}` : ""}`;
  const addFilter = () => { if (!draft.from || (draft.condition === "Between" && !draft.to)) return; setFilters((current) => [...current, { ...draft, id: `${Date.now()}-${Math.random()}` }]); setDraft((current) => ({ ...current, from: "", to: "" })); };
  const clear = () => { const empty = { from: "", to: "" }; setFilters([]); setDates(empty); setDraft({ field: "productCode", condition: "Equals", from: "", to: "" }); load(empty); };
  const download = async () => {
    const { default: ExcelJS } = await import("exceljs"); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Stock Balance", { views: [{ state: "frozen", ySplit: 4 }] });
    sheet.mergeCells(1, 1, 1, FIELDS.length); sheet.getCell("A1").value = "STOCK BALANCE REPORT"; sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.mergeCells(2, 1, 2, FIELDS.length); sheet.getCell("A2").value = `Date From: ${dates.from || "All"}   To: ${dates.to || "All"}`;
    sheet.mergeCells(3, 1, 3, FIELDS.length); sheet.getCell("A3").value = `Applied Filters: ${filters.length ? filters.map(filterDescription).join(" | ") : "None"}`;
    const header = sheet.addRow(FIELDS.map((field) => field.label)); header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F75B5" } };
    filteredRows.forEach((row) => sheet.addRow(FIELDS.map((field) => field.type === "date" ? new Date(row[field.key]) : row[field.key])));
    sheet.columns = FIELDS.map((field) => ({ width: field.key === "productName" ? 28 : field.type === "number" ? 16 : 18 })); sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: FIELDS.length } };
    const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `stock-balance-${dateOnly(new Date())}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <section className="sales-register-page"><div className="sales-register-selection audit-filter"><label>Selection<select value={draft.field} onChange={(event) => changeField(event.target.value)}>{FIELDS.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>{draftField.type !== "text" && <label>Condition<select value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value, to: "" }))}>{(draftField.type === "date" ? dateConditions : numberConditions).map((condition) => <option key={condition}>{condition}</option>)}</select></label>}<label>Value from{draftField.type === "text" ? <select value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}><option value="">Select a value</option>{options.map((option) => <option key={option}>{option}</option>)}</select> : <input type={draftField.type === "date" ? "date" : "number"} step="any" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />}</label>{draft.condition === "Between" && draftField.type !== "text" && <label>Value to<input type={draftField.type === "date" ? "date" : "number"} step="any" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} /></label>}<button type="button" onClick={addFilter} disabled={!draft.from || (draft.condition === "Between" && !draft.to)}><FiPlus /> Add selection</button></div><div className="sales-register-selection-list"><strong>Selected filters</strong>{filters.map((filter) => <span key={filter.id}>{filterDescription(filter)}<button type="button" onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}><FiX /></button></span>)}{!filters.length && <small>No additional filters applied.</small>}</div>{error && <p className="form-error">{error}</p>}<div className="sales-register-summary"><article><span>Products</span><strong>{filteredRows.length}</strong></article><article><span>Total Stock</span><strong>{totals.quantity.toLocaleString()}</strong></article><article><span>Stock Value</span><strong>LKR {money(totals.cost)}</strong></article><article><span>As at</span><strong>{new Date().toLocaleDateString("en-GB")}</strong></article></div><div className="sales-register-actions">{filters.length > 0 && <button className="pivot-view-button" type="button" onClick={() => setPivotOpen(true)} disabled={!filteredRows.length}><FiGrid /> Pivot View</button>}<button className="secondary-action" type="button" onClick={clear}><FiRefreshCw /> Clear</button><button type="button" onClick={download}><FiDownload /> Download Excel</button></div><div className="grn-report-table-wrap">{loading ? <p className="sales-register-loading">Loading stock balance report…</p> : <BalanceTable rows={filteredRows} />}</div>{pivotOpen && <StockBalancePivot rows={filteredRows} onClose={() => setPivotOpen(false)} />}</section>;
}
