import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiRefreshCw } from "react-icons/fi";
import * as XLSX from "xlsx";
import { createStockAdjustmentPdf } from "./stockAdjustmentPdf.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function StockAdjustmentReportPage() {
  const [products, setProducts] = useState([]);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    search: "",
    type: "",
    from: "",
    to: "",
  });

  const load = async () => {
    setLoading(true);
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
      const [productsData, recordsData] = await Promise.all([
        productsResponse.json(),
        recordsResponse.json(),
      ]);
      if (!productsResponse.ok)
        throw new Error(productsData.message || "Could not load products.");
      if (!recordsResponse.ok)
        throw new Error(
          recordsData.message || "Could not load stock adjustment report.",
        );
      setProducts(productsData);
      setRecords(recordsData);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter.from, filter.to]);

  const rows = useMemo(
    () =>
      records.filter((record) => {
        const text =
          `${record.productCode} ${record.productName} ${record.reason} ${record.remark} ${record.managerName}`.toLowerCase();
        return (
          (!filter.search || text.includes(filter.search.toLowerCase())) &&
          (!filter.type || record.adjustmentType === filter.type)
        );
      }),
    [records, filter.search, filter.type],
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

  const download = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((record) => ({
        Date: new Date(record.createdAt).toLocaleString(),
        "Document No.": record.documentNo,
        "Product Code": record.productCode,
        Product: record.productName,
        Type: record.adjustmentType,
        Quantity: Math.abs(record.quantityAdded),
        "Stock After": record.resultingStock,
        Remark: record.remark,
        Location: record.location,
        "Adjusted By": record.managerName,
      })),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Stock Adjustments");
    XLSX.writeFile(
      workbook,
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

  return (
    <section className="stock-adjustment-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">REPORT · TRANSACTION INQUIRY</p>
          <h2>Stock Adjustment</h2>
          <p className="page-description">
            Review stock adjustment transactions and open their documents.
          </p>
        </div>
      </div>
      <div className="sales-register-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={load}
          disabled={loading}
        >
          <FiRefreshCw /> {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button type="button" onClick={download} disabled={!rows.length}>
          <FiDownload /> Download Excel
        </button>
      </div>
      <div className="sales-register-selection audit-filter">
        <label>
          Search
          <input
            value={filter.search}
            onChange={(event) =>
              setFilter({ ...filter, search: event.target.value })
            }
            placeholder="Product, remark, user..."
          />
        </label>
        <label>
          Type
          <select
            value={filter.type}
            onChange={(event) =>
              setFilter({ ...filter, type: event.target.value })
            }
          >
            <option value="">All</option>
            <option value="ADD">Add</option>
            <option value="REDUCE">Reduce</option>
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filter.from}
            onChange={(event) =>
              setFilter({ ...filter, from: event.target.value })
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filter.to}
            onChange={(event) =>
              setFilter({ ...filter, to: event.target.value })
            }
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="product-table-wrap">
        <table className="product-table adjustment-document-table">
          <thead>
            <tr>
              <th>Document no.</th>
              <th>Date &amp; time</th>
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
                  {loading
                    ? "Loading stock adjustment records..."
                    : "No stock adjustments found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
