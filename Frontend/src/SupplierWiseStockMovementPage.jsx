import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiSearch } from "react-icons/fi";
import { createSupplierWiseStockMovementPdf } from "./supplierStockMovementPdf.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const PAGE_SIZE = 100;
const quantity = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SupplierWiseStockMovementPage({ user }) {
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState({
    supplierCode: "",
    location: "",
    from: "",
    to: "",
  });
  const [appliedFilter, setAppliedFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState({ movements: [], total: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API_URL}/products`, { credentials: "include" }),
      fetch(`${API_URL}/locations`, { credentials: "include" }),
    ])
      .then(async ([productsResponse, locationsResponse]) => {
        const [products, locationData] = await Promise.all([
          productsResponse.json(),
          locationsResponse.json(),
        ]);
        if (!productsResponse.ok)
          throw new Error(products.message || "Could not load suppliers.");
        if (!locationsResponse.ok)
          throw new Error(locationData.message || "Could not load locations.");
        if (!active) return;
        setSuppliers(
          [...new Set(products.map((product) => product.supplierCode).filter(Boolean))].sort(),
        );
        setLocations(locationData);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!appliedFilter) return undefined;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        Object.entries(appliedFilter).forEach(([key, value]) => {
          if (value) query.set(key, value);
        });
        const response = await fetch(
          `${API_URL}/reports/supplier-stock-movement?${query}`,
          { credentials: "include" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Could not load stock movements.");
        if (active) setReport(data);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [appliedFilter, page]);

  const pageCount = Math.max(1, Math.ceil(report.total / PAGE_SIZE));
  const view = async (event) => {
    event.preventDefault();
    const pdfTab = window.open("", "_blank");
    if (!pdfTab) {
      setError("Allow pop-ups to open the supplier movement report.");
      return;
    }
    pdfTab.document.title = "Preparing Supplier Movement Report";
    pdfTab.document.body.innerHTML =
      "<p style='font-family:Arial,sans-serif;padding:24px'>Preparing Supplier Movement Report...</p>";
    setPage(1);
    setAppliedFilter({ ...filter });
    setViewing(true);
    setError("");
    try {
      const query = new URLSearchParams();
      Object.entries(filter).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      const [reportResponse, pdfResponse] = await Promise.all([
        fetch(
          `${API_URL}/reports/supplier-stock-movement?page=1&pageSize=${PAGE_SIZE}&${query}`,
          { credentials: "include" },
        ),
        fetch(`${API_URL}/reports/supplier-stock-movement/pdf-data?${query}`, {
          credentials: "include",
        }),
      ]);
      const [reportData, pdfData] = await Promise.all([
        reportResponse.json(),
        pdfResponse.json(),
      ]);
      if (!reportResponse.ok)
        throw new Error(reportData.message || "Could not load stock movements.");
      if (!pdfResponse.ok)
        throw new Error(
          pdfData.message || "Could not prepare the supplier movement report.",
        );
      setReport(reportData);
      const blob = createSupplierWiseStockMovementPdf(pdfData, {
        ...filter,
        userName: user?.name,
        location: filter.location || user?.location || "All locations",
      });
      const pdfUrl = URL.createObjectURL(blob);
      pdfTab.location.replace(pdfUrl);
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 300000);
    } catch (viewError) {
      pdfTab.close();
      setError(viewError.message);
    } finally {
      setViewing(false);
    }
  };

  return (
    <section className="bin-card-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">REPORT · INVENTORY &amp; SALES · STOCK REPORTS</p>
          <h1>Supplier Wise Stock Movement</h1>
          <p className="page-description">
            Review stock transactions for products by supplier.
          </p>
        </div>
      </div>
      {error && <p className="dashboard-error">{error}</p>}
      <form className="bin-card-filters" onSubmit={view}>
        <label>
          Supplier
          <select
            value={filter.supplierCode}
            onChange={(event) =>
              setFilter({ ...filter, supplierCode: event.target.value })
            }
          >
            <option value="">All suppliers</option>
            {suppliers.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Location
          <select
            value={filter.location}
            onChange={(event) =>
              setFilter({ ...filter, location: event.target.value })
            }
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location._id} value={location.name}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date From
          <input
            type="date"
            value={filter.from}
            onChange={(event) =>
              setFilter({ ...filter, from: event.target.value })
            }
          />
        </label>
        <label>
          Date To
          <input
            type="date"
            value={filter.to}
            onChange={(event) =>
              setFilter({ ...filter, to: event.target.value })
            }
          />
        </label>
        <button type="submit" disabled={loading || viewing}>
          <FiSearch /> {viewing ? "Preparing PDF..." : loading ? "Loading..." : "View"}
        </button>
      </form>
      {appliedFilter && (
        <>
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Document No.</th>
                  <th>Date &amp; Time</th>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th>Transaction Type</th>
                  <th>Narration</th>
                  <th>Received</th>
                  <th>Issued</th>
                  <th>Balance</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {report.movements.map((movement) => (
                  <tr key={movement._id}>
                    <td>{movement.supplierCode}</td>
                    <td>{movement.documentNo || "—"}</td>
                    <td>{new Date(movement.createdAt).toLocaleString()}</td>
                    <td>{movement.productCode}</td>
                    <td>{movement.productName}</td>
                    <td>{movement.transactionType || "—"}</td>
                    <td>{movement.description || movement.reason || movement.remark || "—"}</td>
                    <td className="number-cell">
                      {quantity(Math.max(0, movement.quantityAdded))}
                    </td>
                    <td className="number-cell">
                      {quantity(Math.max(0, -movement.quantityAdded))}
                    </td>
                    <td className="number-cell">
                      {quantity(movement.resultingStock)}
                    </td>
                    <td>{movement.location}</td>
                  </tr>
                ))}
                {!report.movements.length && !loading && (
                  <tr>
                    <td colSpan="11" className="pivot-empty">
                      No stock movements match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="sales-register-actions">
            <span>
              {report.total
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                    page * PAGE_SIZE,
                    report.total,
                  )} of ${report.total}`
                : "No movements"}
            </span>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              aria-label="Previous page"
            >
              <FiChevronLeft /> Previous
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              disabled={loading || page >= pageCount}
              aria-label="Next page"
            >
              Next <FiChevronRight />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
