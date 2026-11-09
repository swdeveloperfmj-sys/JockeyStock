import { useEffect, useMemo, useState } from "react";
import { FiPrinter, FiSearch, FiX } from "react-icons/fi";
import { createBinCardPdf } from "./binCardPdf.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const dateValue = (date) => new Date(date).toLocaleDateString("en-GB");
const money = (value) =>
  `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const reportNumber = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function StockMovementDetailsPage({ user }) {
  const [products, setProducts] = useState([]),
    [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    location: user.location || "Head Office",
    productCode: "",
  });
  const [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [lookupOpen, setLookupOpen] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/products`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
      fetch(`${API_URL}/locations`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
    ])
      .then(([p, l]) => {
        setProducts(p);
        setLocations(l);
      })
      .catch((e) => setError(e.message));
  }, []);
  const locationProducts = useMemo(
    () => products.filter((product) => product.plant === filters.location),
    [products, filters.location],
  );
  const selectedProduct = locationProducts.find(
    (product) =>
      String(product.productCode || product.sku).toUpperCase() ===
      filters.productCode.trim().toUpperCase(),
  );
  const visibleProducts = locationProducts.filter((product) =>
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
      .includes(search.trim().toLowerCase()),
  );
  const view = async (event) => {
    event.preventDefault();
    if (!selectedProduct) return setError("Scan or select a valid product.");
    const pdfTab = window.open("", "_blank");
    if (!pdfTab) {
      setError("Please allow pop-ups to open the Bin Card PDF.");
      return;
    }
    pdfTab.document.title = "Preparing Bin Card Report";
    pdfTab.document.body.innerHTML =
      '<p style="font:16px Arial;padding:24px">Preparing Bin Card Report...</p>';
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        productCode: filters.productCode,
        location: filters.location,
      });
      if (filters.from) query.set("from", filters.from);
      if (filters.to) query.set("to", filters.to);
      const response = await fetch(`${API_URL}/reports/bin-card?${query}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message);
      const pdf = createBinCardPdf(data, {
        userName: user.name,
        location: filters.location,
        from: filters.from,
        to: filters.to,
      });
      const pdfUrl = URL.createObjectURL(pdf);
      pdfTab.location.replace(pdfUrl);
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 300000);
    } catch (e) {
      pdfTab.close();
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const totals = report?.movements.reduce(
    (sum, movement) => ({
      received: sum.received + Math.max(0, movement.quantityAdded),
      issued: sum.issued + Math.max(0, -movement.quantityAdded),
    }),
    { received: 0, issued: 0 },
  );
  return (
    <section className="bin-card-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">STOCK MOVEMENT DETAILS</p>
          <h1>Bin Card</h1>
          <p className="page-description">
            View the complete movement history and running balance of one
            product.
          </p>
        </div>
      </div>
      {error && <p className="dashboard-error">{error}</p>}
      <form className="bin-card-filters" onSubmit={view}>
        <label>
          Date From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          Date To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <label>
          Location
          <select
            disabled={user.role === "LOCATION_MANAGER"}
            value={filters.location}
            onChange={(e) => {
              setFilters({
                ...filters,
                location: e.target.value,
                productCode: "",
              });
              setReport(null);
            }}
          >
            <option>Head Office</option>
            {locations
              .filter((location) => location.name !== "Head Office")
              .map((location) => (
                <option key={location._id}>{location.name}</option>
              ))}
          </select>
        </label>
        <label>
          Product
          <input
            autoFocus
            value={filters.productCode}
            placeholder="Scan barcode / F3"
            onChange={(e) =>
              setFilters({ ...filters, productCode: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "F3") {
                e.preventDefault();
                setSearch("");
                setLookupOpen(true);
              }
            }}
          />
        </label>
        <label>
          Product Name
          <input
            value={selectedProduct?.productName || ""}
            readOnly
            placeholder="Auto-filled product name"
          />
        </label>
        <button type="submit" disabled={loading}>
          <FiSearch /> {loading ? "Loading..." : "View"}
        </button>
      </form>
      {report && (
        <div className="bin-card-report-viewer">
          <div className="bin-card-viewer-toolbar">
            <div>
              <strong>Report Viewer</strong>
            </div>
            <div>
              <button type="button" onClick={() => window.print()}>
                <FiPrinter /> Print
              </button>
              <button type="button" onClick={() => setReport(null)}>
                <FiX /> Close
              </button>
            </div>
          </div>
          <div className="bin-card-viewer-body">
            <aside className="bin-card-report-tree">
              <div>⊟&nbsp; {report.product.productCode}</div>
            </aside>
            <main className="bin-card-report-workspace">
              <div className="bin-card-report-tab">Main Report</div>
              <section className="bin-card-report">
                <header>
                  <div>
                    <span>ROYAL LANKA AGENCIES</span>
                    <h2>Bin Card Report</h2>
                  </div>
                  <div className="bin-card-print-meta">
                    <small>
                      Print Date Time - {new Date().toLocaleString("en-GB")}
                    </small>
                    <small>Printed User - {user.name}</small>
                    <small>Current Location - {report.product.location}</small>
                  </div>
                  <div>
                    <small>Location: {report.product.location}</small>
                    <small>
                      Date Range: {filters.from || "All"} —{" "}
                      {filters.to || "All"}
                    </small>
                    <small>
                      Product: {report.product.productCode} ·{" "}
                      {report.product.productName}
                    </small>
                  </div>
                </header>
                <div className="bin-card-report-parameters">
                  <span>Location</span>
                  <b>{report.product.location}</b>
                  <span>Date Range</span>
                  <b>
                    {filters.from || "All"} - {filters.to || "All"}
                  </b>
                  <span>Product</span>
                  <b>
                    {report.product.productCode}&nbsp;&nbsp;{" "}
                    {report.product.productName}
                  </b>
                </div>
                <div className="product-table-wrap">
                  <table className="product-table">
                    <thead>
                      <tr>
                        <th>Document No</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Batch No</th>
                        <th>Selling Price</th>
                        <th>Received</th>
                        <th>Issued</th>
                        <th>Selling Value</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bin-card-product-group">
                        <td>{report.product.productCode}</td>
                        <td></td>
                        <td colSpan="7">{report.product.productName}</td>
                      </tr>
                      {report.movements.map((movement) => {
                        const received = Math.max(0, movement.quantityAdded),
                          issued = Math.max(0, -movement.quantityAdded);
                        return (
                          <tr key={movement._id}>
                            <td>
                              {movement.documentNo ||
                                String(movement._id).slice(-8).toUpperCase()}
                            </td>
                            <td>{dateValue(movement.createdAt)}</td>
                            <td>
                              {movement.description ||
                                movement.transactionType ||
                                "Stock Update"}
                            </td>
                            <td>{movement.batchNo || ""}</td>
                            <td>{reportNumber(report.product.sellingPrice)}</td>
                            <td>{received || "0.00"}</td>
                            <td>{issued || "0.00"}</td>
                            <td>
                              {reportNumber(
                                issued * report.product.sellingPrice,
                              )}
                            </td>
                            <td>
                              {Number(movement.resultingStock).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      {!report.movements.length && (
                        <tr>
                          <td colSpan="9" className="pivot-empty">
                            No stock movements found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan="5"></th>
                        <th>{reportNumber(totals.received)}</th>
                        <th>{reportNumber(totals.issued)}</th>
                        <th>
                          {reportNumber(
                            totals.issued * report.product.sellingPrice,
                          )}
                        </th>
                        <th>
                          {report.movements.length
                            ? report.movements.at(-1).resultingStock
                            : "—"}
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </main>
          </div>
          <div className="bin-card-viewer-status">
            <span>Current Page No: 1</span>
            <span>Total Page No: 1</span>
            <span>Zoom Factor: 100%</span>
          </div>
        </div>
      )}
      {lookupOpen && (
        <div
          className="modal-backdrop grn-lookup-backdrop"
          onClick={() => setLookupOpen(false)}
        >
          <section
            className="grn-lookup-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="product-image-preview-header">
              <div>
                <p className="eyebrow">PRODUCT MASTER</p>
                <h2>Select product</h2>
                <p>Search and double-click a product.</p>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                  {visibleProducts.map((product) => (
                    <tr
                      key={product._id}
                      onDoubleClick={() => {
                        setFilters({
                          ...filters,
                          productCode: product.productCode || product.sku,
                        });
                        setLookupOpen(false);
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
