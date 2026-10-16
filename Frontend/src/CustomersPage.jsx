import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiMapPin, FiPlus, FiSearch, FiTrash2, FiUsers, FiX } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const apiFetch = (input, options = {}) => window.fetch(input, { ...options, credentials: "include" });
const emptyForm = { customerName: "", billingAddress: "", contact: "", tinNo: "", discount: "0", paymentTerm: "30 DAYS" };
const emptyBranch = { branchName: "", address: "", contact: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [nextCode, setNextCode] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [branchDraft, setBranchDraft] = useState(emptyBranch);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadNextCode = () => apiFetch(`${API_URL}/customers/number-series`)
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setNextCode(data.nextNumber || "");
    });

  useEffect(() => {
    let active = true;
    Promise.all([apiFetch(`${API_URL}/customers`), apiFetch(`${API_URL}/customers/number-series`)])
      .then(async ([customersResponse, seriesResponse]) => {
        const [customersData, seriesData] = await Promise.all([customersResponse.json(), seriesResponse.json()]);
        if (!customersResponse.ok) throw new Error(customersData.message);
        if (!seriesResponse.ok) throw new Error(seriesData.message);
        if (active) {
          setCustomers(customersData);
          setNextCode(seriesData.nextNumber || "");
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const addBranch = () => {
    setError("");
    if (!branchDraft.branchName.trim()) {
      setError("Enter the branch name before adding the branch.");
      return;
    }
    setBranches((items) => [...items, { ...branchDraft, id: crypto.randomUUID() }]);
    setBranchDraft(emptyBranch);
  };

  const closeCustomerForm = () => {
    if (saving) return;
    setFormOpen(false);
    setForm(emptyForm);
    setBranchDraft(emptyBranch);
    setBranches([]);
    setEditingCustomer(null);
    setError("");
  };

  const openNewCustomer = () => {
    setForm(emptyForm);
    setBranchDraft(emptyBranch);
    setBranches([]);
    setEditingCustomer(null);
    setError("");
    setMessage("");
    setFormOpen(true);
  };

  const openCustomerEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({
      customerName: customer.customerName || "",
      billingAddress: customer.billingAddress || "",
      contact: customer.contact || "",
      tinNo: customer.tinNo || customer.vatNo || "",
      discount: String(customer.discount ?? 0),
      paymentTerm: customer.paymentTerm || "30 DAYS",
    });
    setBranches((customer.branches || []).map((branch) => ({
      id: branch._id || crypto.randomUUID(),
      branchName: branch.branchName || "",
      address: branch.address || "",
      contact: branch.contact || "",
    })));
    setBranchDraft(emptyBranch);
    setError("");
    setMessage("");
    setFormOpen(true);
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    if (branchDraft.branchName.trim() || branchDraft.address.trim() || branchDraft.contact.trim()) {
      setError("Add the branch draft or clear it before saving the customer.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(editingCustomer ? `${API_URL}/customers/${editingCustomer._id}` : `${API_URL}/customers`, {
        method: editingCustomer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, branches: branches.map(({ id, ...branch }) => branch) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setCustomers((items) => editingCustomer ? items.map((customer) => customer._id === data._id ? data : customer) : [data, ...items]);
      setForm(emptyForm);
      setBranches([]);
      setBranchDraft(emptyBranch);
      setMessage(`${data.customerCode} — ${data.customerName} ${editingCustomer ? "updated" : "added"} successfully.`);
      if (!editingCustomer) await loadNextCode();
      setEditingCustomer(null);
      setFormOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (customer) => {
    if (!window.confirm(`Delete ${customer.customerCode} — ${customer.customerName}? Existing orders will keep their saved customer details.`)) return;
    setDeletingId(customer._id);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/customers/${customer._id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setCustomers((items) => items.filter((item) => item._id !== customer._id));
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId("");
    }
  };

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [customer.customerCode, customer.customerName, customer.tinNo || customer.vatNo, customer.contact, customer.billingAddress]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [customers, search]);

  return <section className="customers-page">
    <div className="customers-page-heading">
      <div><p className="eyebrow">CUSTOMER MASTER</p><h2>Customers</h2><p>Create customer accounts and register their branches.</p></div>
      <div className="customers-page-actions"><span><FiUsers /> {customers.length} customers</span><button type="button" onClick={openNewCustomer}><FiPlus /> Add customer</button></div>
    </div>
    {error && !formOpen && <p className="dashboard-error">{error}</p>}
    {message && <p className="stock-update-success">{message}</p>}
    {formOpen && <div className="modal-backdrop customer-form-backdrop" onMouseDown={closeCustomerForm}>
    <form className="customer-form-card customer-form-modal" onSubmit={saveCustomer} onMouseDown={(event) => event.stopPropagation()}>
      <div className="customer-form-modal-heading"><div><p className="eyebrow">{editingCustomer ? "EDIT CUSTOMER" : "NEW CUSTOMER"}</p><h2>{editingCustomer ? "Update customer" : "Add customer"}</h2><p>Customer code <strong>{editingCustomer?.customerCode || (loading ? "Loading..." : nextCode)}</strong>{editingCustomer ? " remains unchanged." : " will be assigned automatically."}</p></div><button type="button" className="close-modal" onClick={closeCustomerForm} disabled={saving} aria-label="Close customer form"><FiX /></button></div>
      {error && <p className="dashboard-error customer-form-error">{error}</p>}
      <div className="customer-master-fields">
        <label className="customer-code-field">Customer Code<input value={editingCustomer?.customerCode || (loading ? "Loading..." : nextCode)} readOnly /></label>
        <label className="customer-name-field">Customer Name<input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} maxLength="200" required /></label>
        <label className="customer-address-field">Billing Address<textarea value={form.billingAddress} onChange={(event) => setForm((current) => ({ ...current, billingAddress: event.target.value }))} maxLength="500" required /></label>
        <label className="customer-contact-field"><span className="customer-field-label">Contact <small>(optional)</small></span><input value={form.contact} onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))} maxLength="80" /></label>
        <label className="customer-vat-field">TIN No.<input value={form.tinNo} onChange={(event) => setForm((current) => ({ ...current, tinNo: event.target.value }))} maxLength="80" /></label>
        <label className="customer-discount-field">Discount (%)<input type="number" min="0" max="100" step="0.01" value={form.discount} onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))} required /></label>
        <label className="customer-payment-field">Payment Term<select value={form.paymentTerm} onChange={(event) => setForm((current) => ({ ...current, paymentTerm: event.target.value }))}><option>30 DAYS</option><option>45 DAYS</option><option>60 DAYS</option><option>90 DAYS</option></select></label>
      </div>
      <section className="customer-branches-editor">
        <div className="customer-section-title"><div><h3>Add Branches</h3><p>Add branches one at a time. Branch address and contact are optional.</p></div><b>{branches.length}</b></div>
        <div className="customer-branch-draft">
          <label>Branch Name<input value={branchDraft.branchName} onChange={(event) => setBranchDraft((current) => ({ ...current, branchName: event.target.value }))} maxLength="120" /></label>
          <label><span className="customer-field-label">Branch Address <small>(optional)</small></span><input value={branchDraft.address} onChange={(event) => setBranchDraft((current) => ({ ...current, address: event.target.value }))} maxLength="500" /></label>
          <label><span className="customer-field-label">Contact <small>(optional)</small></span><input value={branchDraft.contact} onChange={(event) => setBranchDraft((current) => ({ ...current, contact: event.target.value }))} maxLength="80" /></label>
          <button type="button" onClick={addBranch}><FiPlus /> Add branch</button>
        </div>
        {branches.length > 0 && <div className="customer-branch-list">{branches.map((branch, index) => <article key={branch.id}><span>{index + 1}</span><div><strong>{branch.branchName}</strong><small>{[branch.address, branch.contact].filter(Boolean).join(" · ") || "No address or contact provided"}</small></div><button type="button" onClick={() => setBranches((items) => items.filter((item) => item.id !== branch.id))} aria-label={`Remove ${branch.branchName}`}><FiTrash2 /></button></article>)}</div>}
      </section>
      <div className="customer-form-actions"><span>{editingCustomer ? "The customer code cannot be changed." : "The code is assigned automatically when saved."}</span><button type="submit" disabled={loading || saving}>{saving ? "Saving customer..." : editingCustomer ? "Update customer" : "Add customer"}</button></div>
    </form></div>}
    <section className="customer-directory">
      <div className="customer-directory-heading"><div><h2>Customers</h2><p>{filteredCustomers.length} records shown</p></div><label><FiSearch /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, name, TIN..." /></label></div>
      {filteredCustomers.length ? <div className="customer-grid">{filteredCustomers.map((customer) => <article className="customer-card" key={customer._id}>
        <div className="customer-card-header"><div><span>{customer.customerCode}</span><h3>{customer.customerName}</h3></div><div className="customer-card-header-actions"><b>{Number(customer.discount || 0).toLocaleString()}% discount</b><button type="button" onClick={() => openCustomerEdit(customer)} disabled={Boolean(deletingId)}><FiEdit2 /> Edit</button><button type="button" className="customer-delete-button" onClick={() => deleteCustomer(customer)} disabled={Boolean(deletingId)}>{deletingId === customer._id ? "Deleting..." : <><FiTrash2 /> Delete</>}</button></div></div>
        <div className="customer-card-details"><p><small>Billing address</small>{customer.billingAddress}</p><p><small>Contact</small>{customer.contact || "Not provided"}</p><p><small>TIN No.</small>{customer.tinNo || customer.vatNo}</p><p><small>Payment term</small>{customer.paymentTerm}</p></div>
        <div className="customer-card-branches"><strong><FiMapPin /> Branches ({customer.branches?.length || 0})</strong>{customer.branches?.length ? customer.branches.map((branch) => <div key={branch._id || branch.branchName}><span>{branch.branchName}</span><small>{[branch.address, branch.contact].filter(Boolean).join(" · ") || "No address or contact provided"}</small></div>) : <p>No branches added.</p>}</div>
      </article>)}</div> : <p className="empty-dashboard-state">No customers match this search.</p>}
    </section>
  </section>;
}
