import { useEffect, useState } from "react";
import { FiPlusCircle, FiTrash2 } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ productId: "", quantity: "" });
  const [adjustmentType, setAdjustmentType] = useState("ADD");
  const [remark, setRemark] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState([]);

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not load products.");
      setProducts(data);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

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

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const batch = form.productId ? [...items, form] : items;
    if (!batch.length) {
      setError("Add at least one product adjustment.");
      return;
    }
    if (form.productId && !form.quantity) {
      setError(
        "Complete the current item or add it to the adjustment list first.",
      );
      return;
    }
    if (!remark.trim()) {
      setError("Enter a common remark for this adjustment.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/stock-adjustments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentType,
          remark: remark.trim(),
          items: batch.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not save stock adjustment.");
      setForm({ productId: "", quantity: "" });
      setRemark("");
      setAdjustmentType("ADD");
      setProductSearch("");
      setItems([]);
      await loadProducts();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const addCurrentItem = () => {
    if (!form.productId || !form.quantity) {
      setError("Select a product and quantity before adding.");
      return;
    }
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.productId === form.productId,
      );
      if (existingIndex < 0) return [...current, { ...form }];
      return current.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity: Number(item.quantity) + Number(form.quantity),
            }
          : item,
      );
    });
    setForm({ productId: "", quantity: "" });
    setProductSearch("");
    setError("");
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
            Adjustment type *
            <select
              value={adjustmentType}
              onChange={(event) => setAdjustmentType(event.target.value)}
              disabled={items.length > 0}
            >
              <option value="ADD">Add stock</option>
              <option value="REDUCE">Reduce stock</option>
            </select>
          </label>
          <label>
            Item code *
            <input
              list="stock-adjustment-products"
              value={productSearch}
              onChange={(event) => {
                const value = event.target.value;
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
              onBlur={(event) => selectScannedProduct(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  selectScannedProduct(event.currentTarget.value);
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
            Quantity *
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(event) =>
                setForm({ ...form, quantity: event.target.value })
              }
              required
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
            <strong>
              Adjustment items -{" "}
              {adjustmentType === "ADD" ? "Add Stock" : "Reduce Stock"}
            </strong>
            <span>
              {items.length} item{items.length === 1 ? "" : "s"} ready
            </span>
          </div>
          <label className="stock-adjustment-common-remark">
            Common remark *
            <textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder="Enter the reason or note for this adjustment batch..."
              rows="2"
              required
            />
          </label>
          {items.length ? (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const product = products.find(
                    (candidate) => candidate._id === item.productId,
                  );
                  return (
                    <tr key={`${item.productId}-${index}`}>
                      <td>
                        {product?.productCode} — {product?.productName}
                      </td>
                      <td>{item.quantity}</td>
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
    </section>
  );
}
