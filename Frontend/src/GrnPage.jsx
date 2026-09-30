import { useEffect, useMemo, useState } from "react";
import { FiRotateCcw, FiSave, FiX } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const apiFetch = (input, options = {}) =>
  window.fetch(input, { ...options, credentials: "include" });
const GRN_DRAFT_KEY = "jockey-grn-draft";
const getGrnDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(GRN_DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};

export default function GrnPageNew({ user }) {
  const createEmptyForm = () => ({
    supplierCode: "",
    supplierName: "",
    remarks: "",
    grnDate: new Date().toISOString().slice(0, 10),
    location: user.location || "Head Office",
  });
  const savedDraft = useMemo(() => getGrnDraft(), []);
  const [products, setProducts] = useState([]),
    [locations, setLocations] = useState([]),
    [grnNumber, setGrnNumber] = useState(""),
    [items, setItems] = useState(() => savedDraft.items || []);
  const [entry, setEntry] = useState(
      savedDraft.entry || { code: "", quantity: "" },
    ),
    [lookupOpen, setLookupOpen] = useState(false),
    [lookupSearch, setLookupSearch] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const [form, setForm] = useState(
    savedDraft.form || createEmptyForm(),
  );

  useEffect(() => {
    sessionStorage.setItem(GRN_DRAFT_KEY, JSON.stringify({ form, entry, items }));
  }, [form, entry, items]);

  const load = async () => {
    const responses = await Promise.all([
      apiFetch(`${API_URL}/products`),
      apiFetch(`${API_URL}/locations`),
      apiFetch(`${API_URL}/grns/next-number`),
    ]);
    const data = await Promise.all(
      responses.map((response) => response.json()),
    );
    const failed = responses.findIndex((response) => !response.ok);
    if (failed >= 0) throw new Error(data[failed].message);
    setProducts(data[0]);
    setLocations(data[1]);
    setGrnNumber(data[2].grnNumber);
  };
  useEffect(() => {
    load().catch((requestError) => setError(requestError.message));
  }, []);

  const locationProducts = useMemo(
    () => products.filter((product) => product.plant === form.location),
    [products, form.location],
  );
  const selectedProduct = locationProducts.find(
    (product) =>
      String(product.productCode || product.sku || "").toLowerCase() ===
      entry.code.trim().toLowerCase(),
  );
  const lookupProducts = locationProducts.filter((product) =>
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
      .includes(lookupSearch.trim().toLowerCase()),
  );

  const addItem = () => {
    const quantity = Number(entry.quantity);
    if (!selectedProduct) return setError("Enter a valid Product Code.");
    if (!Number.isInteger(quantity) || quantity < 1)
      return setError("Enter a whole quantity of at least 1.");
    setItems((current) =>
      current.some((item) => item.productId === selectedProduct._id)
        ? current.map((item) =>
            item.productId === selectedProduct._id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [
            ...current,
            {
              productId: selectedProduct._id,
              productCode: selectedProduct.productCode,
              productName: selectedProduct.productName,
              quantity,
              costPrice: Number(selectedProduct.costPrice || 0),
              sellingPrice: Number(selectedProduct.sellingPrice || 0),
            },
          ],
    );
    setEntry({ code: "", quantity: "" });
    setError("");
  };
  const resetForm = () => {
    sessionStorage.removeItem(GRN_DRAFT_KEY);
    setForm(createEmptyForm());
    setEntry({ code: "", quantity: "" });
    setItems([]);
    setLookupOpen(false);
    setLookupSearch("");
  };
  const save = async (event) => {
    event.preventDefault();
    if (!items.length) return setError("Add at least one item.");
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/grns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (Array.isArray(data.updatedProducts)) {
        const updatedStock = new Map(
          data.updatedProducts.map((product) => [
            product.productId,
            Number(product.openingStock),
          ]),
        );
        setProducts((current) =>
          current.map((product) =>
            updatedStock.has(product._id)
              ? { ...product, openingStock: updatedStock.get(product._id) }
              : product,
          ),
        );
      }
      resetForm();
      setGrnNumber("");
      setMessage(`${data.grnNumber} saved successfully.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  const clearForm = () => {
    resetForm();
    setError("");
    setMessage("");
  };
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.costPrice,
      0,
    );

  return (
    <section className="grn-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">INVENTORY RECEIPT</p>
          <h1>Goods Received Note</h1>
        </div>
      </div>
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="stock-update-success">{message}</p>}
      <form onSubmit={save}>
        <section className="grn-details">
          <label>
            GRN No
            <input value={grnNumber} readOnly />
          </label>
          <label>
            Supplier Code
            <input
              required
              value={form.supplierCode}
              onChange={(event) =>
                setForm({ ...form, supplierCode: event.target.value })
              }
            />
          </label>
          <label>
            Supplier Name
            <input
              required
              value={form.supplierName}
              onChange={(event) =>
                setForm({ ...form, supplierName: event.target.value })
              }
            />
          </label>
          <label>
            GRN Date
            <input
              type="date"
              value={form.grnDate}
              onChange={(event) =>
                setForm({ ...form, grnDate: event.target.value })
              }
            />
          </label>
          <label>
            Location
            <select
              disabled={user.role === "LOCATION_MANAGER"}
              value={form.location}
              onChange={(event) => {
                setForm({ ...form, location: event.target.value });
                setEntry({ code: "", quantity: "" });
              }}
            >
              <option value="Head Office">Head Office</option>
              {locations
                .filter((location) => location.name !== "Head Office")
                .map((location) => (
                  <option key={location._id} value={location.name}>
                    {location.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grn-remarks">
            Remarks
            <input
              value={form.remarks}
              onChange={(event) =>
                setForm({ ...form, remarks: event.target.value })
              }
            />
          </label>
        </section>
        <section className="grn-add-item">
          <h2>Add item</h2>
          <input
            autoFocus
            value={entry.code}
            onChange={(event) =>
              setEntry({ ...entry, code: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "F3") {
                event.preventDefault();
                setLookupOpen(true);
              }
            }}
            placeholder="Product Code"
          />
          <input
            value={selectedProduct?.productName || ""}
            readOnly
            placeholder="Product Name"
          />
          <input
            type="number"
            min="1"
            step="1"
            value={entry.quantity}
            onChange={(event) =>
              setEntry({ ...entry, quantity: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                addItem();
              }
            }}
            placeholder="Quantity"
          />
          <input
            value={
              selectedProduct
                ? `LKR ${Number(selectedProduct.costPrice).toLocaleString()}`
                : ""
            }
            readOnly
            placeholder="Cost price"
          />
          <input
            value={
              selectedProduct
                ? `LKR ${Number(selectedProduct.sellingPrice).toLocaleString()}`
                : ""
            }
            readOnly
            placeholder="Selling price"
          />
        </section>
        <section className="grn-preview">
          <div className="grn-preview-heading">
            <h2>Preview</h2>
            <span>
              {items.length} items · {totalQuantity} pieces
            </span>
          </div>
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th>Qty</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.productId}>
                    <td>{index + 1}</td>
                    <td>{item.productCode}</td>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>LKR {item.costPrice.toLocaleString()}</td>
                    <td>LKR {item.sellingPrice.toLocaleString()}</td>
                    <td>
                      LKR {(item.quantity * item.costPrice).toLocaleString()}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="close-modal"
                        onClick={() =>
                          setItems((current) =>
                            current.filter(
                              (candidate) =>
                                candidate.productId !== item.productId,
                            ),
                          )
                        }
                      >
                        <FiX />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grn-total">
            <span className="grn-summary-item">
              No Of Items <b>{items.length}</b>
            </span>
            <span className="grn-summary-item">
              Total Qty <b>{totalQuantity}</b>
            </span>
            <span className="grn-summary-item">
              Gross Amount{" "}
              <b>
                LKR{" "}
                {totalAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </b>
            </span>
            <span className="grn-summary-item">
              Net Amount{" "}
              <b>
                LKR{" "}
                {totalAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </b>
            </span>
            <div className="grn-total-actions">
              <button type="button" className="cancel-button" onClick={clearForm}>
                <FiRotateCcw /> Clear
              </button>
              <button type="submit" disabled={saving}>
                <FiSave /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </section>
      </form>
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
                <p>Search, then double-click an item.</p>
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
              placeholder="Search code, name, style, colour..."
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
                  {lookupProducts.map((product) => (
                    <tr
                      key={product._id}
                      onDoubleClick={() => {
                        setEntry({ code: product.productCode, quantity: "" });
                        setLookupOpen(false);
                        setLookupSearch("");
                      }}
                    >
                      <td>{product.productCode}</td>
                      <td>{product.productName}</td>
                      <td>{product.style}</td>
                      <td>{product.color}</td>
                      <td>{product.size}</td>
                      <td>{product.openingStock}</td>
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
