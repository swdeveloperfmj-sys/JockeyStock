import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  Popup,
  useMap,
  Marker,
} from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FiBarChart2,
  FiBell,
  FiBox,
  FiCalendar,
  FiCamera,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiImage,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiPlusCircle,
  FiSearch,
  FiSun,
  FiTrash2,
  FiUploadCloud,
  FiUserPlus,
  FiUsers,
  FiX,
  FiMapPin,
  FiCodesandbox,
  FiLayers,
  FiTruck,
} from "react-icons/fi";
import "./style.css";
import GrnPageNew from "./GrnPage.jsx";
import PrnPage from "./PrnPage.jsx";
import SalesReturnPage from "./SalesReturnPage.jsx";
import GrnReportPage from "./GrnReportPage.jsx";
import SalesRegisterPage from "./SalesRegisterPage.jsx";
import StockBalanceReportPage from "./StockBalanceReportPage.jsx";
import StockMovementDetailsPage from "./StockMovementDetailsPage.jsx";
import StockAdjustmentPage from "./StockAdjustmentPage.jsx";
import StockAdjustmentReportPage from "./StockAdjustmentReportPage.jsx";
import SupplierWiseStockMovementPage from "./SupplierWiseStockMovementPage.jsx";
import GrnSeriesSettings from "./GrnSeriesSettings.jsx";
import PrnSeriesSettings from "./PrnSeriesSettings.jsx";
import SalesOrderSeriesSettings from "./SalesOrderSeriesSettings.jsx";
import CustomerSeriesSettings from "./CustomerSeriesSettings.jsx";
import StockAdjustmentSeriesSettings from "./StockAdjustmentSeriesSettings.jsx";
import CustomersPage from "./CustomersPage.jsx";
import { createShipmentInvoicePdf } from "./invoicePdf.js";
import logoUrl from "../assets/LOGO.png";
import loginBackgroundUrl from "../assets/background.png";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SIGN_IN_LOADER =
  "https://assets2.lottiefiles.com/packages/lf20_usmfx6bp.json";
const SESSION_EXPIRED_EVENT = "jockey-session-expired";
const ORDER_DRAFT_KEY = "jockey-order-draft";
const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};
const getOrderDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(ORDER_DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};
const fetch = async (input, options = {}) => {
  const response = await window.fetch(input, {
    ...options,
    credentials: "include",
  });
  const isAuthRequest = String(input).includes("/auth/");
  if (response.status === 401 && !isAuthRequest) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
};
const locationPin = divIcon({
  className: "jockey-map-pin",
  html: "<span>📍</span>",
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  popupAnchor: [0, -40],
});
function CircleMarker({ center, children }) {
  return (
    <Marker position={center} icon={locationPin}>
      {children}
    </Marker>
  );
}
function MapContainer(props) {
  return <LeafletMapContainer {...props} scrollWheelZoom />;
}
function ThemeButton({ theme, setTheme }) {
  const d = theme === "dark";
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(d ? "light" : "dark")}
    >
      {d ? <FiSun /> : <FiMoon />}
      <span>{d ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
function Login({ onLogin, theme, setTheme }) {
  const [e, setE] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(x) {
    x.preventDefault();
    if (loading) return;
    setE("");
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            Object.fromEntries(new FormData(x.currentTarget)),
          ),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      localStorage.setItem("jockeyUser", JSON.stringify(d.user));
      localStorage.setItem("jockeySessionExpiresAt", String(d.expiresAt));
      onLogin(d.user);
    } catch (a) {
      setE(a.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="brand-panel" style={{ background: `linear-gradient(135deg, rgba(200, 16, 46, .22), rgba(115, 7, 24, .12)), url(${loginBackgroundUrl}) 76% center / cover no-repeat` }}>
        <div className="login-theme">
          <ThemeButton theme={theme} setTheme={setTheme} />
        </div>
        <div className="brand">JOCKEY<span>®</span></div>
        <p>STOCK MANAGEMENT SYSTEM</p>
        <h1>
          Move stock,
          <br />
          Grow sales.
        </h1>
        <small>Secure access for your Jockey retail team.</small>
      </section>
      <section className="form-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to Jockey Stock</h2>
          <label>
            Username
            <input name="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <p className="error">{e}</p>
          <button
            className="sign-in-button"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <DotLottieReact
                  className="sign-in-loader"
                  src={SIGN_IN_LOADER}
                  loop
                  autoplay
                  aria-hidden="true"
                />
                Signing in…
              </>
            ) : (
              <>
                Sign in <span>→</span>
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
const ROLE_SIDEBAR_PERMISSIONS = {
  SUPER_ADMIN: ["Dashboard", "Inventory", "Stock Updates", "Stock Adjustment", "Stock Adjustment Report", "Supplier Wise Stock Movement", "GRN", "PRN", "Sales Return", "Sales", "Customers", "Users", "Locations", "Roles", "Sales Register", "GRN Report", "Stock Balance Report", "Stock Movement Details"],
  LOCATION_MANAGER: ["Dashboard", "Stock Update", "GRN", "PRN", "Sales Return", "Create Order", "Pending Orders", "Shipment", "Sales Register", "GRN Report"],
  "SALES DEP": ["Shipment"],
  SALES_DEP: ["Shipment"],
  SALES_REP: ["Dashboard", "Create Order", "Sales"],
};
const ALL_SIDEBAR_PERMISSIONS = [
  ...ROLE_SIDEBAR_PERMISSIONS.SUPER_ADMIN,
  ...ROLE_SIDEBAR_PERMISSIONS.LOCATION_MANAGER.filter(
    (permission) => !ROLE_SIDEBAR_PERMISSIONS.SUPER_ADMIN.includes(permission),
  ),
  ...ROLE_SIDEBAR_PERMISSIONS.SALES_REP.filter(
    (permission) =>
      !ROLE_SIDEBAR_PERMISSIONS.SUPER_ADMIN.includes(permission) &&
      !ROLE_SIDEBAR_PERMISSIONS.LOCATION_MANAGER.includes(permission),
  ),
];
const sidebarPermissionsForRole = (role) => ROLE_SIDEBAR_PERMISSIONS[role] || ROLE_SIDEBAR_PERMISSIONS.SALES_REP;
const blank = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  contactNumber: "",
  location: "",
  role: "SALES_REP",
  sidebarPermissions: [...ROLE_SIDEBAR_PERMISSIONS.SALES_REP],
};
function UserModal({ user, onClose, onSaved }) {
  const [f, setF] = useState(
      user
        ? { ...user, password: "", confirmPassword: "", sidebarPermissions: Array.isArray(user.sidebarPermissions) ? user.sidebarPermissions : [...sidebarPermissionsForRole(user.role)] }
        : { ...blank, sidebarPermissions: [...blank.sidebarPermissions] },
    ),
    [roles, setR] = useState([]),
    [locs, setL] = useState([]),
    [e, setE] = useState(""),
    edit = !!user;
  useEffect(() => {
    Promise.all(
      ["roles", "locations"].map((x) =>
        fetch(`${API_URL}/${x}`).then((r) => r.json()),
      ),
    ).then(([r, l]) => {
      const requiredRoles = ["SUPER_ADMIN", "SALES_REP", "LOCATION_MANAGER"];
      setR([
        ...r,
        ...requiredRoles
          .filter((name) => !r.some((role) => role.name === name))
          .map((name) => ({ _id: name, name })),
      ]);
      setL(l);
    });
  }, []);
  const u = (x) => {
    if (x.target.name === "role") {
      setF({ ...f, role: x.target.value, sidebarPermissions: [...sidebarPermissionsForRole(x.target.value)] });
      return;
    }
    setF({ ...f, [x.target.name]: x.target.value });
  };
  const toggleSidebarPermission = (permission) => setF((current) => ({
    ...current,
    sidebarPermissions: current.sidebarPermissions.includes(permission)
      ? current.sidebarPermissions.filter((item) => item !== permission)
      : [...current.sidebarPermissions, permission],
  }));
  async function submit(x) {
    x.preventDefault();
    if (!f.sidebarPermissions.length) {
      setE("Select at least one left sidebar field.");
      return;
    }
    try {
      const r = await fetch(`${API_URL}/users${edit ? `/${user.id}` : ""}`, {
          method: edit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      onSaved(d);
    } catch (a) {
      setE(a.message);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className="user-modal">
        <div className="modal-title">
          <div>
            <p className="eyebrow">USER MANAGEMENT</p>
            <h2>{edit ? "Edit user" : "Add new user"}</h2>
          </div>
          <button className="close-modal" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form className="user-form" onSubmit={submit}>
          <label>
            Full name *
            <input name="name" value={f.name} onChange={u} required />
          </label>
          <label>
            Username *
            <input name="username" value={f.username} onChange={u} required />
          </label>
          <label>
            Password {edit ? "(leave blank to keep current)" : "*"}
            <input
              name="password"
              type="password"
              value={f.password}
              onChange={u}
              required={!edit}
            />
          </label>
          <label>
            Re-enter password
            <input
              name="confirmPassword"
              type="password"
              value={f.confirmPassword}
              onChange={u}
              required={!edit || !!f.password}
            />
          </label>
          <label>
            Email <small>(optional)</small>
            <input
              name="email"
              type="email"
              value={f.email || ""}
              onChange={u}
            />
          </label>
          <label>
            Contact number <small>(optional)</small>
            <input
              name="contactNumber"
              value={f.contactNumber || ""}
              onChange={u}
            />
          </label>
          <label>
            Role *
            <select name="role" value={f.role} onChange={u} required>
              <option value="">Select role</option>
              {roles.map((x) => (
                <option key={x._id} value={x.name}>
                  {x.name.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location *
            <select
              name="location"
              value={f.location || ""}
              onChange={u}
              required
            >
              <option value="">Select location</option>
              {locs.map((x) => (
                <option key={x._id} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sidebar-permission-fieldset">
            <legend>Left sidebar access *</legend>
            <p>Tick the menu fields this user should see after signing in.</p>
            <div className="sidebar-permission-grid">
              {ALL_SIDEBAR_PERMISSIONS.map((permission) => (
                <label key={permission}>
                  <input
                    type="checkbox"
                    checked={f.sidebarPermissions.includes(permission)}
                    onChange={() => toggleSidebarPermission(permission)}
                  />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="error">{e}</p>
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button className="confirm-button">
              {edit ? "Save changes" : "Create user"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function UsersPage() {
  const [users, setUsers] = useState([]),
    [loading, setL] = useState(true),
    [err, setE] = useState(""),
    [modal, setM] = useState(undefined);
  async function load() {
    try {
      const r = await fetch(`${API_URL}/users`),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setUsers(d);
    } catch (e) {
      setE(e.message);
    } finally {
      setL(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const saved = (u) => {
    setM(undefined);
    setUsers((o) =>
      o.some((x) => x.id === u.id)
        ? o.map((x) => (x.id === u.id ? u : x))
        : [u, ...o],
    );
  };
  async function del(u) {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    const r = await fetch(`${API_URL}/users/${u.id}`, { method: "DELETE" });
    if (r.ok) setUsers((o) => o.filter((x) => x.id !== u.id));
    else setE("Could not delete user.");
  }
  return (
    <section className="users-page">
      <div className="page-title">
        <button className="add-user" onClick={() => setM(null)}>
          <FiUserPlus /> Add user
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="user-table-wrap">
        {loading ? (
          <p className="table-message">Loading users…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">
                    <strong>{u.name}</strong>
                    <small>{u.email || "No email"}</small>
                  </td>
                  <td data-label="Username">{u.username}</td>
                  <td data-label="Role">
                    <span className="role-badge">
                      {u.role.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td data-label="Location">{u.location || "—"}</td>
                  <td data-label="Contact">{u.contactNumber || "—"}</td>
                  <td data-label="Actions" className="table-actions">
                    <button onClick={() => setM(u)}>
                      <FiEdit2 />
                    </button>
                    <button className="delete-action" onClick={() => del(u)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal !== undefined && (
        <UserModal
          user={modal}
          onClose={() => setM(undefined)}
          onSaved={saved}
        />
      )}
    </section>
  );
}
function LocationModal({ item, onClose, onSaved }) {
  const [f, setF] = useState(
      item || { name: "", address: "", latitude: "", longitude: "" },
    ),
    [e, setE] = useState("");
  const u = (x) => setF({ ...f, [x.target.name]: x.target.value });
  async function submit(x) {
    x.preventDefault();
    try {
      const r = await fetch(
          `${API_URL}/locations${item ? `/${item._id}` : ""}`,
          {
            method: item ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(f),
          },
        ),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      onSaved(d);
    } catch (a) {
      setE(a.message);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className="user-modal">
        <div className="modal-title">
          <div>
            <p className="eyebrow">LOCATION MANAGEMENT</p>
            <h2>{item ? "Edit location" : "Add location"}</h2>
          </div>
          <button className="close-modal" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form className="user-form location-form" onSubmit={submit}>
          <label>
            Location Name *
            <input name="name" value={f.name} onChange={u} required />
          </label>
          <label>
            Address / Area *
            <input name="address" value={f.address} onChange={u} required />
          </label>
          <label>
            Latitude (Arrival Pin) <small>(optional)</small>
            <input
              name="latitude"
              type="number"
              step="any"
              value={f.latitude ?? ""}
              onChange={u}
              placeholder="e.g. 6.9271"
            />
          </label>
          <label>
            Longitude (Arrival Pin) <small>(optional)</small>
            <input
              name="longitude"
              type="number"
              step="any"
              value={f.longitude ?? ""}
              onChange={u}
              placeholder="e.g. 79.8612"
            />
          </label>
          <p className="error">{e}</p>
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button className="confirm-button">
              {item ? "Save changes" : "Create location"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function FitLocationPins({ pins }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length > 1)
      map.fitBounds(
        pins.map((x) => [x.latitude, x.longitude]),
        { padding: [36, 36] },
      );
    else if (pins.length === 1)
      map.setView([pins[0].latitude, pins[0].longitude], 13);
  }, [map, pins]);
  return null;
}
function LocationsPage() {
  const [items, setItems] = useState([]),
    [modal, setModal] = useState(undefined),
    [toDelete, setToDelete] = useState(null),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const r = await fetch(`${API_URL}/locations`),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setItems(d);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const confirmDelete = async () => {
    const r = await fetch(`${API_URL}/locations/${toDelete._id}`, {
      method: "DELETE",
    });
    if (r.ok) {
      setToDelete(null);
      load();
    } else setError("Could not delete location.");
  };
  const pins = items.filter(
    (x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude),
  );
  const center = pins.length
    ? [pins[0].latitude, pins[0].longitude]
    : [7.8731, 80.7718];
  return (
    <section className="users-page">
      <div className="page-title">
        <button className="add-user" onClick={() => setModal(null)}>
          <FiPlusCircle /> Add location
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="settings-list">
        {items.map((x) => (
          <article key={x._id}>
            <div>
              <strong>{x.name}</strong>
              <small>{x.address}</small>
            </div>
            <div className="table-actions">
              <button onClick={() => setModal(x)} title="Edit location">
                <FiEdit2 />
              </button>
              <button
                className="delete-action"
                onClick={() => setToDelete(x)}
                title="Delete location"
              >
                <FiTrash2 />
              </button>
            </div>
          </article>
        ))}
      </div>
      {pins.length > 0 && (
        <section className="locations-map">
          <h2>Location map</h2>
          <MapContainer center={center} zoom={10} scrollWheelZoom={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {pins.map((x) => (
              <CircleMarker key={x._id} center={[x.latitude, x.longitude]}>
                <Popup>
                  <strong>{x.name}</strong>
                  <br />
                  {x.address}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </section>
      )}
      {modal !== undefined && (
        <LocationModal
          item={modal}
          onClose={() => setModal(undefined)}
          onSaved={() => {
            setModal(undefined);
            load();
          }}
        />
      )}
      {toDelete && (
        <div className="modal-backdrop">
          <section
            className="confirm-modal delete-confirm"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-icon">
              <FiTrash2 />
            </div>
            <p className="eyebrow">DELETE LOCATION</p>
            <h2>Delete {toDelete.name}?</h2>
            <p>
              This permanently removes the location and its arrival pin. This
              action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setToDelete(null)}
              >
                Cancel
              </button>
              <button className="confirm-button" onClick={confirmDelete}>
                Delete location
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
function SettingsPage({ type }) {
  return type === "locations" ? <LocationsPage /> : <RolesPage />;
}
function RolesPage() {
  const [items, setI] = useState([]),
    [error, setE] = useState(""),
    [modal, setModal] = useState(undefined),
    [roleName, setRoleName] = useState(""),
    [saving, setSaving] = useState(false);
  const load = async () => {
    try {
      const r = await fetch(`${API_URL}/roles`),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setI(d);
    } catch (e) {
      setE(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const openModal = (role = null) => {
    setModal(role);
    setRoleName(role?.name || "");
    setE("");
  };
  async function save(event) {
    event.preventDefault();
    if (!roleName.trim()) return setE("Enter a role name.");
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/roles${modal ? `/${modal._id}` : ""}`, {
        method: modal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roleName.trim() }),
      });
      if (r.ok) {
        setModal(undefined);
        load();
      } else setE((await r.json()).message);
    } catch (requestError) {
      setE(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  async function del(x) {
    if (!window.confirm(`Delete ${x.name}?`)) return;
    await fetch(`${API_URL}/roles/${x._id}`, { method: "DELETE" });
    load();
  }
  return (
    <section className="users-page">
      <div className="page-title">
        <button className="add-user" onClick={() => openModal()}>
          <FiPlusCircle /> Add role
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="settings-list">
        {items.map((x) => (
          <article key={x._id}>
            <strong>{x.name.replaceAll("_", " ")}</strong>
            <div className="table-actions">
              <button onClick={() => openModal(x)}>
                <FiEdit2 />
              </button>
              <button className="delete-action" onClick={() => del(x)}>
                <FiTrash2 />
              </button>
            </div>
          </article>
        ))}
      </div>
      {modal !== undefined && (
        <div className="modal-backdrop" onMouseDown={() => setModal(undefined)}>
          <section className="user-modal role-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <div><p className="eyebrow">ROLE MANAGEMENT</p><h2>{modal ? "Edit role" : "Add role"}</h2></div>
              <button type="button" className="close-modal" onClick={() => setModal(undefined)} aria-label="Close"><FiX /></button>
            </div>
            <form className="user-form" onSubmit={save}>
              <label>Role name<input autoFocus value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="e.g. Warehouse Manager" required /></label>
              {error && <p className="error">{error}</p>}
              <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModal(undefined)}>Cancel</button><button className="confirm-button" disabled={saving}>{saving ? "Saving..." : modal ? "Save changes" : "Add role"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
function SalesOrderPage({ onOrderCreated, editingOrder }) {
  const draft = editingOrder ? {} : getOrderDraft();
  const [products, setProducts] = useState([]),
    [customers, setCustomers] = useState([]),
    [selectedCustomerId, setSelectedCustomerId] = useState(() => draft.selectedCustomerId || ""),
    [customerSearch, setCustomerSearch] = useState(""),
    [customerDropdownOpen, setCustomerDropdownOpen] = useState(false),
    [selectedCustomerLocation, setSelectedCustomerLocation] = useState(() => draft.selectedCustomerLocation || "billing"),
    [cart, setCart] = useState(() => draft.cart || []),
    [customerName, setCustomerName] = useState(() => draft.customerName || ""),
    [customerPhone, setCustomerPhone] = useState(
      () => draft.customerPhone || "",
    ),
    [customerAddress, setCustomerAddress] = useState(
      () => draft.customerAddress || "",
    ),
    [customerLocked, setCustomerLocked] = useState(() =>
      Boolean(draft.customerLocked && draft.selectedCustomerId),
    ),
    [productSearch, setProductSearch] = useState(""),
    [selectedStyle, setSelectedStyle] = useState(""),
    [selectedPackingQuantity, setSelectedPackingQuantity] = useState(""),
    [selectedColor, setSelectedColor] = useState(""),
    [sizeQuantities, setSizeQuantities] = useState({}),
    [productImagePreview, setProductImagePreview] = useState(null),
    [showOrderItems, setShowOrderItems] = useState(false),
    [showResetConfirm, setShowResetConfirm] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const customerComboboxRef = useRef(null);
  useEffect(() => {
    sessionStorage.setItem(
      ORDER_DRAFT_KEY,
      JSON.stringify({
        cart,
        customerName,
        customerPhone,
        customerAddress,
        selectedCustomerId,
        selectedCustomerLocation,
        customerLocked,
      }),
    );
  }, [cart, customerName, customerPhone, customerAddress, selectedCustomerId, selectedCustomerLocation, customerLocked]);
  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        return d;
      })
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    fetch(`${API_URL}/customers`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.message);
        return data;
      })
      .then(setCustomers)
      .catch((requestError) => setError(requestError.message));
  }, []);
  useEffect(() => {
    if (!editingOrder || !products.length || !customers.length) return;
    setCart(editingOrder.items.map((item) => {
      const product = products.find((candidate) => candidate._id === item.productId);
      return { productId: item.productId, product: product || { ...item, _id: item.productId }, quantity: item.quantity };
    }));
    setCustomerName(editingOrder.customerName);
    setCustomerPhone(editingOrder.customerPhone || "");
    setCustomerAddress(editingOrder.customerAddress);
    const linkedCustomer = customers.find((customer) => String(customer._id) === String(editingOrder.customerId))
      || customers.find((customer) => customer.customerName === editingOrder.customerName);
    setSelectedCustomerId(linkedCustomer?._id || "");
    setSelectedCustomerLocation(editingOrder.customerBranchId || "billing");
    setCustomerLocked(Boolean(linkedCustomer));
    sessionStorage.removeItem(ORDER_DRAFT_KEY);
  }, [editingOrder, products, customers]);
  useEffect(() => {
    const closeCustomerDropdown = (event) => {
      if (!customerComboboxRef.current?.contains(event.target)) setCustomerDropdownOpen(false);
    };
    document.addEventListener("mousedown", closeCustomerDropdown);
    return () => document.removeEventListener("mousedown", closeCustomerDropdown);
  }, []);
  useEffect(() => {
    const events = new EventSource(`${API_URL}/stock-events`, {
      withCredentials: true,
    });
    events.addEventListener("stock-update", (event) => {
      const updates = JSON.parse(event.data);
      const stockById = new Map(
        updates.map((item) => [item.productId, Number(item.openingStock)]),
      );
      setProducts((items) =>
        items.map((item) =>
          stockById.has(item._id)
            ? { ...item, openingStock: stockById.get(item._id) }
            : item,
        ),
      );
      setCart((items) =>
        items.flatMap((item) => {
          const stock = stockById.get(item.productId);
          if (stock === undefined) return [item];
          return stock > 0
            ? [
                {
                  ...item,
                  quantity: Math.min(item.quantity, stock),
                  product: { ...item.product, openingStock: stock },
                },
              ]
            : [];
        }),
      );
    });
    return () => events.close();
  }, []);
  useEffect(() => {
    document.body.classList.toggle("selection-modal-open", Boolean(selectedStyle));
    return () => document.body.classList.remove("selection-modal-open");
  }, [selectedStyle]);
  const addQuantity = (product, delta) => {
    const current = cart.find((item) => item.productId === product._id);
    const next = (current?.quantity || 0) + delta;
    if (next > product.openingStock)
      return setError(
        `Only ${product.openingStock} ${product.unit} are available.`,
      );
    setCart((items) =>
      next <= 0
        ? items.filter((item) => item.productId !== product._id)
        : current
          ? items.map((item) =>
              item.productId === product._id
                ? { ...item, quantity: next }
                : item,
            )
          : [...items, { productId: product._id, product, quantity: next }],
    );
    setError("");
  };
  const total = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.product.sellingPrice || 0),
    0,
  );
  const selectedCustomer = customers.find((customer) => customer._id === selectedCustomerId);
  const matchingCustomers = customers.filter((customer) =>
    [customer.customerCode, customer.customerName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(customerSearch.trim().toLowerCase()),
  );
  const availableProducts = products.filter(
    (product) =>
      product.openingStock > 0 &&
      [
        product.productName,
        product.productCode,
        product.categoryCode,
        product.gender,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(productSearch.trim().toLowerCase()),
  );
  const styleProducts = availableProducts.filter(
    (product) => product.style === selectedStyle,
  );
  const packingProducts = styleProducts.filter(
    (product) => product.packingQuantity === selectedPackingQuantity,
  );
  const colorProducts = packingProducts.filter(
    (product) => product.color === selectedColor,
  );
  const selectedColorImages = Array.from(
    new Map(
      colorProducts.flatMap((product) => {
        const images = Array.isArray(product.images) && product.images.length
          ? product.images
          : product.imageUrl
            ? [{ _id: "legacy", url: product.imageUrl }]
            : [];
        return images.map((image) => [image.url, image]);
      }),
    ).values(),
  );
  const styleGroups = Array.from(
    availableProducts.reduce((groups, product) => {
      const style = product.style || product.productName?.split("-")[0] || "OTHER";
      const group = groups.get(style) || { style, products: [], pieces: 0 };
      group.products.push(product);
      group.pieces += Number(product.openingStock || 0);
      groups.set(style, group);
      return groups;
    }, new Map()).values(),
  );
  const groupBy = (items, key) => Array.from(
    items.reduce((groups, product) => {
      const value = product[key] || "OTHER";
      const group = groups.get(value) || { value, products: [], pieces: 0 };
      group.products.push(product);
      group.pieces += Number(product.openingStock || 0);
      groups.set(value, group);
      return groups;
    }, new Map()).values(),
  );
  const selectStyle = (style) => {
    setSelectedStyle(style);
    setSelectedPackingQuantity("");
    setSelectedColor("");
    setSizeQuantities({});
    setProductImagePreview(null);
  };
  const selectPacking = (packingQuantity) => {
    setSelectedPackingQuantity(packingQuantity);
    setSelectedColor("");
    setSizeQuantities({});
    setProductImagePreview(null);
  };
  const selectColor = (color) => {
    setSelectedColor(color);
    setSizeQuantities({});
    setProductImagePreview(null);
  };
  const addSelectedProduct = (product) => {
    const quantity = Number(sizeQuantities[product._id] || 0);
    if (!Number.isInteger(quantity) || quantity < 1)
      return setError("Enter a valid number of pieces.");
    if (quantity > product.openingStock)
      return setError(
        `Only ${product.openingStock} ${product.unit} are available.`,
      );
    setCart((items) =>
      items.some((item) => item.productId === product._id)
        ? items.map((item) =>
            item.productId === product._id
              ? { ...item, quantity, product }
              : item,
          )
        : [
            ...items,
            {
              productId: product._id,
              product,
              quantity,
            },
          ],
    );
    setSizeQuantities((quantities) => ({ ...quantities, [product._id]: "" }));
    setError("");
  };
  const addSelectedSizes = () => {
    const selectedItems = colorProducts
      .map((product) => ({ product, quantity: Number(sizeQuantities[product._id] || 0) }))
      .filter((item) => item.quantity > 0);
    if (!selectedItems.length) return setError("Enter pieces for at least one size.");
    const invalidItem = selectedItems.find(({ product, quantity }) =>
      !Number.isInteger(quantity) || quantity > product.openingStock,
    );
    if (invalidItem) return setError(`Only ${invalidItem.product.openingStock} ${invalidItem.product.unit} are available for ${invalidItem.product.size}.`);
    setCart((items) => {
      const nextItems = [...items];
      selectedItems.forEach(({ product, quantity }) => {
        const index = nextItems.findIndex((item) => item.productId === product._id);
        if (index >= 0) nextItems[index] = { ...nextItems[index], quantity, product };
        else nextItems.push({ productId: product._id, product, quantity });
      });
      return nextItems;
    });
    selectStyle("");
    setError("");
  };
  const selectCustomer = (customerId) => {
    const customer = customers.find((item) => item._id === customerId);
    setSelectedCustomerId(customerId);
    setCustomerSearch("");
    setCustomerDropdownOpen(false);
    setSelectedCustomerLocation("billing");
    setCustomerName(customer?.customerName || "");
    setCustomerPhone(customer?.contact || "");
    setCustomerAddress(customer?.billingAddress || "");
    setCustomerLocked(false);
    setError("");
  };
  const selectCustomerLocation = (locationId) => {
    if (!selectedCustomer) return;
    const branch = locationId === "billing" ? null : selectedCustomer.branches?.find((item) => item._id === locationId);
    setSelectedCustomerLocation(locationId);
    setCustomerPhone(branch?.contact || selectedCustomer.contact || "");
    setCustomerAddress(branch?.address || selectedCustomer.billingAddress || "");
    setError("");
  };
  const lockCustomer = () => {
    if (!selectedCustomerId || !customerName.trim() || !customerAddress.trim())
      return setError(
        "Select a customer and delivery location before continuing.",
      );
    setCustomerLocked(true);
    setError("");
  };
  const resetOrder = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setSelectedCustomerId("");
    setCustomerSearch("");
    setCustomerDropdownOpen(false);
    setSelectedCustomerLocation("billing");
    setCustomerLocked(false);
    setProductSearch("");
    setSelectedStyle("");
    setSelectedPackingQuantity("");
    setSelectedColor("");
    setSizeQuantities({});
    setShowOrderItems(false);
    setError("");
    sessionStorage.removeItem(ORDER_DRAFT_KEY);
    setShowResetConfirm(false);
  };
  async function submit(event) {
    event.preventDefault();
    if (!customerLocked)
      return setError("Lock customer details before saving the order.");
    if (!cart.length) return setError("Add at least one product to the order.");
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/orders${editingOrder ? `/${editingOrder._id}` : ""}`, {
        method: editingOrder ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          customerBranchId: selectedCustomerLocation,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const order = await response.json();
      if (!response.ok) throw Error(order.message);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setSelectedCustomerId("");
      setCustomerSearch("");
      setCustomerDropdownOpen(false);
      setSelectedCustomerLocation("billing");
      setCustomerLocked(false);
      sessionStorage.removeItem(ORDER_DRAFT_KEY);
      onOrderCreated(order);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="sales-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">SALES</p>
          <h1>{editingOrder ? "Edit order" : "Create order"}</h1>
          <p className="page-description">
            {editingOrder ? "Update the order details and items, then save your changes." : "Lock customer details, select products, then save the sales order."}
          </p>
        </div>
        <button
          type="button"
          className="reset-order-button"
          onClick={() => setShowResetConfirm(true)}
        >
          Reset order
        </button>
      </div>
      <form className="sales-order-form" onSubmit={submit}>
        <div className="sales-order-main">
          <section className="sales-order-card customer-card">
            <div className="sales-order-summary">
              <h2>Customer details</h2>
              {customerLocked ? (
                <button
                  type="button"
                  className="edit-customer"
                  onClick={() => setCustomerLocked(false)}
                >
                  Edit
                </button>
              ) : null}
            </div>
            <div className="customer-fields">
              <label className="customer-address">
                Select customer *
                <div className="customer-combobox" ref={customerComboboxRef}>
                  <button
                    type="button"
                    className="customer-combobox-trigger"
                    onClick={() => setCustomerDropdownOpen((open) => !open)}
                    disabled={customerLocked}
                    aria-haspopup="listbox"
                    aria-expanded={customerDropdownOpen}
                  >
                    <span>{selectedCustomer ? `${selectedCustomer.customerCode} — ${selectedCustomer.customerName}` : "Choose customer"}</span>
                    <FiChevronDown aria-hidden="true" />
                  </button>
                  {customerDropdownOpen && !customerLocked && (
                    <div className="customer-combobox-menu">
                      <div className="customer-combobox-search">
                        <FiSearch aria-hidden="true" />
                        <input
                          type="search"
                          value={customerSearch}
                          onChange={(event) => setCustomerSearch(event.target.value)}
                          placeholder="Search customer name or code"
                          aria-label="Search customer name or code"
                          autoFocus
                        />
                      </div>
                      <div className="customer-combobox-options" role="listbox">
                        {matchingCustomers.length ? matchingCustomers.map((customer) => (
                          <button
                            type="button"
                            key={customer._id}
                            className={customer._id === selectedCustomerId ? "is-selected" : ""}
                            onClick={() => selectCustomer(customer._id)}
                            role="option"
                            aria-selected={customer._id === selectedCustomerId}
                          >
                            <strong>{customer.customerCode}</strong>
                            <span>{customer.customerName}</span>
                          </button>
                        )) : <p>No matching customers</p>}
                      </div>
                    </div>
                  )}
                </div>
              </label>
              {selectedCustomer && <>
                <label>
                  Delivery location *
                  <select value={selectedCustomerLocation} onChange={(event) => selectCustomerLocation(event.target.value)} disabled={customerLocked}>
                    <option value="billing">Billing address</option>
                    {(selectedCustomer.branches || []).map((branch) => <option key={branch._id} value={branch._id}>{branch.branchName}</option>)}
                  </select>
                </label>
                <label>
                  Contact
                  <input value={customerPhone || "Not provided"} readOnly />
                </label>
                <label className="customer-address">
                  Delivery address
                  <textarea value={customerAddress} readOnly rows="3" />
                </label>
                <div className="selected-customer-summary">
                  <span><small>Customer code</small>{selectedCustomer.customerCode}</span>
                  <span><small>TIN No.</small>{selectedCustomer.tinNo || selectedCustomer.vatNo}</span>
                  <span><small>Discount</small>{Number(selectedCustomer.discount || 0).toLocaleString()}%</span>
                  <span><small>Payment term</small>{selectedCustomer.paymentTerm}</span>
                </div>
              </>}
            </div>
            {!customerLocked && (
              <button
                type="button"
                className="lock-customer"
                onClick={lockCustomer}
              >
                Lock customer details
              </button>
            )}
          </section>
          {customerLocked && (
            <section className="product-picker">
              <div className="sales-product-catalog-heading">
                <div>
                  <h2>Select products</h2>
                  <p>Choose style, pack, colour, then size.</p>
                </div>
                <span>{availableProducts.length} available</span>
              </div>
              <input
                className="order-product-filter"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search by product name, code, category or gender"
              />
              <button
                type="button"
                className="mobile-check-order-button"
                disabled={!cart.length}
                onClick={() => setShowOrderItems(true)}
              >
                Check order items ({cart.reduce((sum, item) => sum + item.quantity, 0)})
              </button>
              <div className="product-selection-flow">
                <section className="product-selection-step">
                  <div className="product-selection-title">
                    <span>1</span><div><h3>Style</h3><p>Select a style number.</p></div>
                  </div>
                  <div className="order-product-grid style-product-grid">
                    {styleGroups.map((group) => {
                      const image = group.products[0].images?.[0]?.url || group.products[0].imageUrl;
                      return <button type="button" className={`order-product-card ${selectedStyle === group.style ? "is-selected" : ""}`} key={group.style} onClick={() => selectStyle(group.style)}>
                        <div className="order-product-image">{image ? <img src={image} alt="" /> : <FiImage />}</div>
                        <div className="order-product-content"><span>STYLE</span><h3>{group.style}</h3><small>{group.products.length} variants</small><strong>{group.pieces.toLocaleString()} pieces available</strong></div>
                      </button>;
                    })}
                  </div>
                </section>
              </div>
              {!availableProducts.length && (
                <p className="empty-dashboard-state">
                  No matching products found.
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="sales-order-card order-summary-card">
          <div className="sales-order-summary">
            <div>
              <h2>Order items</h2>
              <small>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                selected
              </small>
            </div>
            <strong>
              LKR{" "}
              {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </strong>
          </div>
          {cart.length ? (
            <div className="sales-cart">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <strong>{item.product.productName}</strong>
                        <small>
                          LKR{" "}
                          {Number(
                            item.product.sellingPrice || 0,
                          ).toLocaleString()}{" "}
                          each
                        </small>
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        LKR{" "}
                        {(
                          item.quantity * Number(item.product.sellingPrice || 0)
                        ).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="remove-order-item"
                          onClick={() =>
                            addQuantity(item.product, -item.quantity)
                          }
                          aria-label={`Remove ${item.product.productName}`}
                        >
                          <FiX />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-dashboard-state">
              {customerLocked
                ? "No products added to this order."
                : "Lock customer details to select products."}
            </p>
          )}
          <button
            type="button"
            className="check-order-button"
            disabled={!customerLocked || !cart.length}
            onClick={() => setShowOrderItems(true)}
          >
            Check order items
          </button>
          {error && <p className="error">{error}</p>}
          <button
            className="inline-save-order"
            disabled={saving || !customerLocked || !cart.length}
          >
            {saving ? "Saving order…" : "Save sales order"}
          </button>
        </aside>
      </form>
      {showOrderItems && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowOrderItems(false)}
        >
          <section
            className="order-items-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">ORDER REVIEW</p>
                <h2>Order items</h2>
              </div>
              <button
                type="button"
                className="close-modal"
                onClick={() => setShowOrderItems(false)}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>
            <div className="sales-cart">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <strong>{item.product.productName}</strong>
                        <small>
                          LKR{" "}
                          {Number(
                            item.product.sellingPrice || 0,
                          ).toLocaleString()}{" "}
                          each
                        </small>
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        LKR{" "}
                        {(
                          item.quantity * Number(item.product.sellingPrice || 0)
                        ).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="remove-order-item"
                          onClick={() =>
                            addQuantity(item.product, -item.quantity)
                          }
                          aria-label={`Remove ${item.product.productName}`}
                        >
                          <FiX />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-review-total">
              <span>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
              <strong>
                LKR{" "}
                {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </strong>
            </div>
            {error && <p className="error">{error}</p>}
            <button
              type="button"
              className="save-order-button"
              disabled={saving || !cart.length}
              onClick={submit}
            >
              {saving ? "Saving order…" : "Save sales order"}
            </button>
          </section>
        </div>
      )}
      {showResetConfirm && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowResetConfirm(false)}
        >
          <section
            className="confirm-modal reset-order-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">RESET ORDER</p>
            <h2>Clear this order draft?</h2>
            <p>Customer details and all selected products will be removed.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-button"
                onClick={resetOrder}
              >
                Reset order
              </button>
            </div>
          </section>
        </div>
      )}
      {selectedStyle && (
        <div className="modal-backdrop product-modal-layer pack-modal-layer" onMouseDown={() => selectStyle("") }>
          <section className="product-selection-modal" role="dialog" aria-modal="true" aria-label={`Select ${selectedStyle} product`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <div><p className="eyebrow">STYLE {selectedStyle}</p><h2>Select pack</h2></div>
              <button type="button" className="close-modal" onClick={() => selectStyle("")} aria-label="Close"><FiX /></button>
            </div>
            <div className="product-selection-modal-body">
              <section className="product-selection-step">
                <div className="product-selection-title"><span>2</span><div><h3>Pack</h3><p>Select the packing quantity.</p></div></div>
                <div className="product-choice-grid">
                  {groupBy(styleProducts, "packingQuantity").map((group) => <button type="button" key={group.value} className={`product-choice-card ${selectedPackingQuantity === group.value ? "is-selected" : ""}`} onClick={() => selectPacking(group.value)}><strong>{group.value} pack</strong><small>{group.pieces.toLocaleString()} pieces available</small></button>)}
                </div>
              </section>
              {false && selectedPackingQuantity && <section className="product-selection-step">
                <div className="product-selection-title"><span>3</span><div><h3>Colour</h3><p>Select a colour for the {selectedPackingQuantity} pack.</p></div></div>
                <div className="product-choice-grid">
                  {groupBy(packingProducts, "color").map((group) => <button type="button" key={group.value} className={`product-choice-card ${selectedColor === group.value ? "is-selected" : ""}`} onClick={() => selectColor(group.value)}><strong>{group.value}</strong><small>{group.pieces.toLocaleString()} pieces available</small></button>)}
                </div>
              </section>}
              {false && selectedColor && <section className="product-selection-step size-selection-step">
                <div className="product-selection-title"><span>4</span><div><h3>Sizes & pieces</h3><p>Add pieces for each size.</p></div></div>
                <div className="size-quantity-list">
                  {colorProducts.map((product) => {
                    const cartItem = cart.find((item) => item.productId === product._id);
                    return <div className="size-quantity-row" key={product._id}><div><strong>{product.size}</strong><small>{product.productName} · {product.openingStock} {product.unit} available{cartItem ? ` · ${cartItem.quantity} in order` : ""}</small></div><label>Pieces<input type="number" min="1" max={product.openingStock} value={sizeQuantities[product._id] ?? cartItem?.quantity ?? ""} onChange={(event) => setSizeQuantities((quantities) => ({ ...quantities, [product._id]: event.target.value }))} /></label><button type="button" onClick={() => addSelectedProduct(product)}>Add</button></div>;
                  })}
                </div>
              </section>}
            </div>
          </section>
        </div>
      )}
      {selectedPackingQuantity && (
        <div className="modal-backdrop product-modal-layer color-modal-layer" onMouseDown={() => selectPacking("")}>
          <section className="product-selection-modal" role="dialog" aria-modal="true" aria-label="Select colour" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title"><div><p className="eyebrow">{selectedStyle} · {selectedPackingQuantity} PACK</p><h2>Select colour</h2></div><button type="button" className="close-modal" onClick={() => selectPacking("")} aria-label="Back to packs"><FiX /></button></div>
            <div className="product-selection-modal-body"><section className="product-selection-step"><div className="product-selection-title"><span>3</span><div><h3>Colour</h3><p>Select a colour for this pack.</p></div></div><div className="product-choice-grid">{groupBy(packingProducts, "color").map((group) => <button type="button" key={group.value} className={`product-choice-card ${selectedColor === group.value ? "is-selected" : ""}`} onClick={() => selectColor(group.value)}><strong>{group.value}</strong><small>{group.pieces.toLocaleString()} pieces available</small></button>)}</div></section></div>
          </section>
        </div>
      )}
      {selectedColor && (
        <div className="modal-backdrop product-modal-layer size-modal-layer" onMouseDown={() => selectColor("")}>
          <section className="product-selection-modal" role="dialog" aria-modal="true" aria-label="Select sizes" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title"><div><p className="eyebrow">{selectedStyle} · {selectedPackingQuantity} PACK · {selectedColor}</p><h2>Sizes & pieces</h2></div><div className="size-modal-actions">{selectedColorImages.length > 0 && <button type="button" className="size-modal-image-trigger" onClick={() => setProductImagePreview({ images: selectedColorImages, index: 0, name: `${selectedStyle} · ${selectedColor}` })} aria-label="View product image"><img src={selectedColorImages[0].url} alt="" /><span>View image</span></button>}<button type="button" className="close-modal" onClick={() => selectColor("")} aria-label="Back to colours"><FiX /></button></div></div>
            <div className="product-selection-modal-body"><section className="product-selection-step size-selection-step"><div className="product-selection-title"><span>4</span><div><h3>Sizes & pieces</h3><p>Enter pieces for the sizes you need.</p></div></div><div className="size-quantity-list">{colorProducts.map((product) => { const cartItem = cart.find((item) => item.productId === product._id); return <div className="size-quantity-row" key={product._id}><div><strong>{product.size}</strong><small>{product.productName} · {product.openingStock} {product.unit} available{cartItem ? ` · ${cartItem.quantity} in order` : ""}</small></div><label>Pieces<input type="number" min="0" max={product.openingStock} value={sizeQuantities[product._id] ?? cartItem?.quantity ?? ""} onChange={(event) => setSizeQuantities((quantities) => ({ ...quantities, [product._id]: event.target.value }))} /></label></div>; })}</div><button type="button" className="add-all-sizes-button" onClick={addSelectedSizes}>Add selected sizes to order</button></section></div>
          </section>
        </div>
      )}
      {productImagePreview && (
        <div className="modal-backdrop product-modal-layer product-image-preview-layer" onMouseDown={() => setProductImagePreview(null)}>
          <section className="product-image-preview-modal" role="dialog" aria-modal="true" aria-label={`${productImagePreview.name} images`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="product-image-preview-header"><div><p className="eyebrow">PRODUCT IMAGE</p><h2>{productImagePreview.name}</h2><p className="product-gallery-count">Image {productImagePreview.index + 1} of {productImagePreview.images.length}</p></div><button type="button" className="close-modal" onClick={() => setProductImagePreview(null)} aria-label="Close image preview"><FiX /></button></div>
            <div className="product-image-preview-canvas">{productImagePreview.images.length > 1 && <button type="button" className="gallery-arrow previous" onClick={() => setProductImagePreview((preview) => ({ ...preview, index: (preview.index - 1 + preview.images.length) % preview.images.length }))} aria-label="Previous image"><FiChevronLeft /></button>}<img src={productImagePreview.images[productImagePreview.index].url} alt={`${productImagePreview.name} ${productImagePreview.index + 1}`} />{productImagePreview.images.length > 1 && <button type="button" className="gallery-arrow next" onClick={() => setProductImagePreview((preview) => ({ ...preview, index: (preview.index + 1) % preview.images.length }))} aria-label="Next image"><FiChevronRight /></button>}</div>
            {productImagePreview.images.length > 1 && <div className="product-image-gallery-footer"><div className="product-image-thumbnails">{productImagePreview.images.map((image, index) => <button type="button" className={index === productImagePreview.index ? "active" : ""} key={image._id || image.url} onClick={() => setProductImagePreview((preview) => ({ ...preview, index }))} aria-label={`View image ${index + 1}`}><img src={image.url} alt="" /></button>)}</div></div>}
          </section>
        </div>
      )}
    </section>
  );
}
function SalesHistoryPage({ refreshKey, onOrderChanged, onEditOrder, isAdmin = false }) {
  const todayDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };
  const [orders, setOrders] = useState([]),
    [error, setError] = useState(""),
    [startDate, setStartDate] = useState(() => isAdmin ? "" : todayDate()),
    [endDate, setEndDate] = useState(() => isAdmin ? "" : todayDate()),
    [selectedOrder, setSelectedOrder] = useState(null),
    [reverseTarget, setReverseTarget] = useState(null),
    [reversing, setReversing] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams();
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    fetch(`${API_URL}/orders${query.size ? `?${query}` : ""}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        return d;
      })
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, [refreshKey, startDate, endDate]);
  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    const localDate = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
    return (
      (!startDate || localDate >= startDate) &&
      (!endDate || localDate <= endDate)
    );
  });
  const total = filteredOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );
  const isToday = (date) => {
    const value = new Date(date);
    const today = new Date();
    return value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
  };
  const downloadReport = () => {
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = filteredOrders.map((order) => [order.orderNumber, new Date(order.createdAt).toLocaleString(), order.customerName, order.customerPhone, order.salesRepName, order.location, order.status, order.totalQuantity, Number(order.totalAmount || 0).toFixed(2)]);
    const csv = [["Order number", "Created time", "Customer", "Phone", "Sales representative", "Location", "Status", "Items", "Total (LKR)"], ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-history${startDate ? `-${startDate}` : ""}${endDate ? `-to-${endDate}` : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const reverseOrder = async () => {
    if (!reverseTarget) return;
    setReversing(true);
    try {
      const response = await fetch(`${API_URL}/orders/${reverseTarget._id}/cancel`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.filter((order) => order._id !== reverseTarget._id));
      setSelectedOrder(null);
      setReverseTarget(null);
      onOrderChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReversing(false);
    }
  };
  return (
    <section className="sales-page">
      <div className="page-title">
        <div>
        </div>
        <strong className="sales-total">
          LKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </strong>
      </div>
      <div className="sales-history-filters">
        <label>
          From
          <span className="sales-date-input"><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /><FiCalendar aria-hidden="true" /></span>
        </label>
        <label>
          To
          <span className="sales-date-input"><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /><FiCalendar aria-hidden="true" /></span>
        </label>
        {(startDate || endDate) && (
          <button
            type="button"
            className="clear-sales-filter"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear filters
          </button>
        )}
        {isAdmin && <button type="button" className="download-sales-report" disabled={!filteredOrders.length} onClick={downloadReport}><FiDownload /> Download report</button>}
      </div>
      {error ? (
        <p className="dashboard-error">{error}</p>
      ) : filteredOrders.length ? (
        <div className="sales-history">
          {filteredOrders.map((order) => (
            <article
              key={order._id}
              className="sales-history-card"
              onClick={() => setSelectedOrder(order)}
              role="button"
              tabIndex="0"
              onKeyDown={(event) =>
                event.key === "Enter" && setSelectedOrder(order)
              }
            >
              <div>
                <strong>{order.orderNumber}</strong>
                <span>
                  {order.customerName}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                </span>
                <small>{new Date(order.createdAt).toLocaleString()}</small>
                <b className={`sales-order-status ${order.status === "HELD" ? "is-held" : ""}`}>{order.status === "HELD" ? "On hold" : order.status}</b>
                {order.status === "HELD" && <small className="sales-order-hold-reason">{order.hold?.items?.map((item) => item.productCode).join(", ") || order.hold?.productCode}: {order.hold?.reason}</small>}
              </div>
              <div>
                <span>{order.totalQuantity} items</span>
                <strong>
                  LKR{" "}
                  {Number(order.totalAmount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </strong>
                {!isAdmin && order.status === "PENDING" && isToday(order.createdAt) && (
                  <div className="sales-order-actions">
                    <button type="button" className="edit-sales-order" onClick={(event) => { event.stopPropagation(); onEditOrder(order); }} onKeyDown={(event) => event.stopPropagation()}>Edit order</button>
                    <button type="button" className="cancel-sales-order" onClick={(event) => { event.stopPropagation(); setReverseTarget(order); }} onKeyDown={(event) => event.stopPropagation()}>Cancel order</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-dashboard-state">
          No sales orders match the selected filter.
        </p>
      )}
      {selectedOrder && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSelectedOrder(null)}
        >
          <section
            className="order-details-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">SALES ORDER</p>
                <h2>{selectedOrder.orderNumber}</h2>
              </div>
              <button
                type="button"
                className="close-modal"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>
            <div className="order-detail-customer">
              <div>
                <small>Customer</small>
                <strong>{selectedOrder.customerName}</strong>
                {selectedOrder.customerPhone && (
                  <span>{selectedOrder.customerPhone}</span>
                )}
              </div>
              <div>
                <small>Delivery address</small>
                <strong>
                  {selectedOrder.customerAddress || "Not recorded"}
                </strong>
              </div>
              <div>
                <small>Created</small>
                <strong>
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </strong>
              </div>
            </div>
            {selectedOrder.status === "HELD" && <div className="order-detail-hold"><strong>Order on hold</strong><span>{selectedOrder.hold?.items?.length ? selectedOrder.hold.items.map((item) => `${item.productCode} — ${item.productName}${item.color ? ` (${item.color})` : ""}`).join(", ") : `${selectedOrder.hold?.productCode || ""} — ${selectedOrder.hold?.productName || ""}`}</span><p>{selectedOrder.hold?.reason}</p></div>}
            <div className="sales-cart">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <strong>{item.productName}</strong>
                        <small>{item.productCode}</small>
                      </td>
                      <td>{item.quantity}</td>
                      <td>LKR {Number(item.unitPrice).toLocaleString()}</td>
                      <td>LKR {Number(item.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-review-total">
              <span>{selectedOrder.totalQuantity} items</span>
              <strong>
                LKR{" "}
                {Number(selectedOrder.totalAmount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
            {!isAdmin && isToday(selectedOrder.createdAt) && (
              <button type="button" className="reverse-order-button" onClick={() => setReverseTarget(selectedOrder)}>
                Cancel today’s order
              </button>
            )}
          </section>
        </div>
      )}
      {reverseTarget && <OrderCancellationConfirm order={reverseTarget} actionLabel="Cancel order" busy={reversing} onClose={() => setReverseTarget(null)} onConfirm={reverseOrder} />}
    </section>
  );
}
function StockUpdatePage() {
  const [products, setProducts] = useState([]),
    [filters, setFilters] = useState({ search: "", category: "", gender: "", stock: "" }),
    [scannedCode, setScannedCode] = useState(""),
    [selectedProduct, setSelectedProduct] = useState(null),
    [quantity, setQuantity] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const load = async () => {
    try {
      const response = await fetch(`${API_URL}/products`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setProducts(data);
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const categories = [...new Set(products.map((product) => product.categoryCode || product.category).filter(Boolean))].sort();
  const genders = [...new Set(products.map((product) => product.gender).filter(Boolean))].sort();
  const filteredProducts = products.filter((product) => {
    const search = filters.search.trim().toLowerCase();
    const searchable = [product.productCode, product.sku, product.productName, product.name, product.style, product.color, product.size, product.categoryCode, product.category, product.gender].filter(Boolean).join(" ").toLowerCase();
    return (!search || searchable.includes(search)) &&
      (!filters.category || (product.categoryCode || product.category) === filters.category) &&
      (!filters.gender || product.gender === filters.gender) &&
      (!filters.stock || (filters.stock === "out" ? Number(product.openingStock || 0) === 0 : Number(product.openingStock || 0) > 0));
  });
  const openScannedProduct = (value = scannedCode) => {
    const code = value.trim();
    if (!code) return;
    const product = products.find((item) => String(item.productCode || item.sku || "").toLowerCase() === code.toLowerCase());
    if (!product) return setError(`No product was found for code ${code}.`);
    setSelectedProduct(product);
    setQuantity("");
    setScannedCode("");
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!selectedProduct) return;
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1)
      return setError("Enter a whole quantity of at least 1.");
    setSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/products/${selectedProduct._id}/stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: Number(quantity) }),
        },
      );
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.message);
      setProducts((items) =>
        items.map((product) =>
          product._id === updated._id ? updated : product,
        ),
      );
      setMessage(
        `${updated.productName || updated.name} stock is now ${Number(updated.openingStock).toLocaleString()} ${updated.unit || "Pieces"}.`,
      );
      setQuantity("");
      setSelectedProduct(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="stock-update-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">FACTORY INVENTORY</p>
          <h1>Update stock</h1>
          <p className="page-description">
            Double-click a product card to add received stock.
          </p>
        </div>
      </div>
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="stock-update-success">{message}</p>}
      <div className="stock-scan-form">
        <label>Scan barcode / enter 13-digit product code<input autoFocus value={scannedCode} onChange={(event) => { const code = event.target.value.replace(/\D/g, "").slice(0, 13); setScannedCode(code); if (code.length === 13) openScannedProduct(code); }} placeholder="Scan barcode" inputMode="numeric" maxLength="13" /></label>
      </div>
      <div className="stock-update-filters" aria-label="Filter products">
        <input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, code, style, colour..." aria-label="Search products" />
        <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} aria-label="Filter by category"><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
        <select value={filters.gender} onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))} aria-label="Filter by gender"><option value="">All genders</option>{genders.map((gender) => <option key={gender} value={gender}>{gender}</option>)}</select>
        <select value={filters.stock} onChange={(event) => setFilters((current) => ({ ...current, stock: event.target.value }))} aria-label="Filter by stock"><option value="">All stock</option><option value="in">In stock</option><option value="out">Out of stock</option></select>
      </div>
      <p className="stock-filter-count">{filteredProducts.length} of {products.length} products</p>
      <div className="factory-product-grid">
        {filteredProducts.map((product) => {
          const image = product.images?.[0]?.url || product.imageUrl;
          return (
            <article
              className="factory-product-card"
              key={product._id}
              onDoubleClick={() => {
                setSelectedProduct(product);
                setQuantity("");
                setError("");
              }}
              title="Double-click to update stock"
            >
              <div className="factory-product-image">
                {image ? (
                  <img
                    src={image}
                    alt={product.productName || product.name}
                    loading="lazy"
                  />
                ) : (
                  <FiImage aria-label="Product image unavailable" />
                )}
              </div>
              <div className="factory-product-content">
                <span>{product.productCode || product.sku}</span>
                <h2>{product.productName || product.name}</h2>
                <div>
                  <small>Category</small>
                  <b>{product.categoryCode || product.category || "—"}</b>
                  <small>Gender</small>
                  <b>{product.gender || "—"}</b>
                  <small>Style</small>
                  <b>{product.style || "—"}</b>
                  <small>Colour / Size</small>
                  <b>
                    {product.color || "—"} / {product.size || "—"}
                  </b>
                </div>
                <strong className="factory-stock">
                  {Number(product.openingStock).toLocaleString()}{" "}
                  <small>{product.unit || "Pieces"}</small>
                </strong>
              </div>
            </article>
          );
        })}
      </div>
      {!filteredProducts.length && <p className="empty-dashboard-state">No products match the selected filters.</p>}
      {selectedProduct && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedProduct(null)}
        >
          <section
            className="stock-update-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">STOCK UPDATE</p>
                <h2>{selectedProduct.productName || selectedProduct.name}</h2>
                <p className="stock-update-current">
                  Current stock:{" "}
                  <strong>
                    {Number(selectedProduct.openingStock).toLocaleString()}{" "}
                    {selectedProduct.unit || "Pieces"}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                className="close-modal"
                onClick={() => setSelectedProduct(null)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={submit}>
              <label>
                Quantity to add
                <input
                  autoFocus
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                  required
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setSelectedProduct(null)}
                >
                  Cancel
                </button>
                <button disabled={saving}>
                  {saving ? "Updating…" : "Add stock"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
function OrderCancellationConfirm({ order, actionLabel, busy, onClose, onConfirm }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="confirm-modal delete-confirm" role="dialog" aria-modal="true" aria-labelledby="order-cancel-title" onMouseDown={(event) => event.stopPropagation()}>
      <p className="eyebrow">CONFIRM ORDER CANCELLATION</p>
      <h2 id="order-cancel-title">{actionLabel} {order.orderNumber}?</h2>
      <p>The order will be cancelled and all {order.totalQuantity} items will be restored to factory stock.</p>
      <div className="modal-actions">
        <button type="button" className="cancel-button" disabled={busy} onClick={onClose}>Keep order</button>
        <button type="button" className="confirm-button" disabled={busy} onClick={onConfirm}>{busy ? "Restoring stock..." : actionLabel}</button>
      </div>
    </section>
  </div>;
}
function ReadyToShipConfirm({ order, busy, onClose, onConfirm }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="ready-to-ship-title" onMouseDown={(event) => event.stopPropagation()}>
      <p className="eyebrow">CONFIRM SHIPMENT</p>
      <h2 id="ready-to-ship-title">Mark {order.orderNumber} ready to ship?</h2>
      <p>This order will be removed from Pending Orders and added to the Shipment page.</p>
      <div className="modal-actions"><button type="button" className="cancel-button" disabled={busy} onClick={onClose}>Not now</button><button type="button" disabled={busy} onClick={onConfirm}>{busy ? "Preparing..." : "Confirm ready to ship"}</button></div>
    </section>
  </div>;
}
function OrderHoldModal({ order, busy, onClose, onConfirm }) {
  const [productIds, setProductIds] = useState(order.items[0]?.productId ? [String(order.items[0].productId)] : []);
  const [reason, setReason] = useState("");
  const toggleProduct = (productId) => setProductIds((items) => items.includes(String(productId)) ? items.filter((id) => id !== String(productId)) : [...items, String(productId)]);
  const submit = (event) => {
    event.preventDefault();
    onConfirm({ productIds, reason });
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="confirm-modal order-hold-modal" role="dialog" aria-modal="true" aria-labelledby="order-hold-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <p className="eyebrow">PLACE ORDER ON HOLD</p>
      <h2 id="order-hold-title">Hold {order.orderNumber}</h2>
      <p>The stock will remain reserved until this order is resumed or cancelled.</p>
      <fieldset className="hold-item-picker"><legend>Affected items <span>{productIds.length} selected</span></legend>{order.items.map((item) => { const id = String(item.productId); return <label className={productIds.includes(id) ? "is-selected" : ""} key={id}><input type="checkbox" checked={productIds.includes(id)} onChange={() => toggleProduct(id)} /><span><strong>{item.productName}</strong><small>{item.productCode} · {[item.color, item.size].filter(Boolean).join(" · ") || "Colour/size not recorded"} · {item.quantity} pcs</small></span></label>; })}</fieldset>
      <label>Reason<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} minLength="3" maxLength="500" rows="4" placeholder="e.g. Damaged items found during packing" required /></label>
      <div className="modal-actions"><button type="button" className="cancel-button" disabled={busy} onClick={onClose}>Keep pending</button><button type="submit" disabled={busy || !productIds.length || reason.trim().length < 3}>{busy ? "Placing on hold..." : "Place on hold"}</button></div>
    </form>
  </div>;
}
function PendingOrdersPage({ refreshKey, onOrderChanged, onReadyToShip }) {
  const [orders, setOrders] = useState([]), [error, setError] = useState(""), [cancelTarget, setCancelTarget] = useState(null), [cancelling, setCancelling] = useState(false), [readyTarget, setReadyTarget] = useState(null), [shippingId, setShippingId] = useState(""), [holdTarget, setHoldTarget] = useState(null), [holdingId, setHoldingId] = useState(""), [resumingId, setResumingId] = useState("");
  useEffect(() => {
    let active = true;
    const loadOrders = () => fetch(`${API_URL}/orders`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (active) setOrders(data);
      })
      .catch((requestError) => active && setError(requestError.message));
    loadOrders();
    const events = new EventSource(`${API_URL}/stock-events`, { withCredentials: true });
    events.addEventListener("order-update", loadOrders);
    // SSE updates immediately in the normal case. Polling is a fallback for
    // deployments that do not keep a server-sent-events connection alive.
    const refreshTimer = window.setInterval(loadOrders, 10000);
    return () => { active = false; events.close(); window.clearInterval(refreshTimer); };
  }, [refreshKey]);
  const cancelOrder = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const response = await fetch(`${API_URL}/orders/${cancelTarget._id}/cancel`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.filter((order) => order._id !== cancelTarget._id));
      setCancelTarget(null);
      onOrderChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCancelling(false);
    }
  };
  const markReadyToShip = async (order) => {
    setShippingId(order._id);
    setError("");
    try {
      const response = await fetch(`${API_URL}/orders/${order._id}/ready-to-ship`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.filter((item) => item._id !== order._id));
      setReadyTarget(null);
      onOrderChanged();
      onReadyToShip();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setShippingId("");
    }
  };
  const holdOrder = async ({ productIds, reason }) => {
    if (!holdTarget) return;
    setHoldingId(holdTarget._id); setError("");
    try {
      const response = await fetch(`${API_URL}/orders/${holdTarget._id}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds, reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.map((order) => order._id === data._id ? data : order));
      setHoldTarget(null);
      onOrderChanged();
    } catch (requestError) { setError(requestError.message); } finally { setHoldingId(""); }
  };
  const resumeOrder = async (order) => {
    setResumingId(order._id); setError("");
    try {
      const response = await fetch(`${API_URL}/orders/${order._id}/resume`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.map((item) => item._id === data._id ? data : item));
      onOrderChanged();
    } catch (requestError) { setError(requestError.message); } finally { setResumingId(""); }
  };
  const actionBusy = Boolean(shippingId || holdingId || resumingId || cancelling);
  return (
    <section className="pending-orders-page">
      <div className="page-title"><div><p className="eyebrow">SALES ORDERS</p><h1>Pending orders</h1><p className="page-description">Orders created by sales representatives for your location.</p></div></div>
      {error && <p className="dashboard-error">{error}</p>}
      <p className="pending-orders-count">{orders.filter((order) => order.status === "PENDING").length} pending · {orders.filter((order) => order.status === "HELD").length} on hold</p>
      {orders.length ? <div className="pending-orders-list">
        {orders.map((order) => <article className={`pending-order-card ${order.status === "HELD" ? "is-held" : ""}`} key={order._id}>
          <header className="pending-order-heading">
            <div><span className="pending-order-number">{order.orderNumber}</span><h2>{order.customerName}</h2><small>Placed {new Date(order.createdAt).toLocaleString()}</small></div>
            <b><i />{order.status === "HELD" ? "On hold" : "Pending review"}</b>
          </header>
          <div className="pending-order-body">
            <div className="pending-order-meta">
              <span><small>Sales representative</small>{order.salesRepName}</span>
              <span><small>Customer phone</small>{order.customerPhone || "Not provided"}</span>
              <span className="pending-order-address"><small><FiMapPin aria-hidden="true" /> Delivery address</small>{order.customerAddress}</span>
              {order.status === "HELD" && <span className="pending-order-hold-note"><small>Hold reason · {order.hold?.items?.map((item) => item.productCode).join(", ") || order.hold?.productCode}</small>{order.hold?.reason}</span>}
            </div>
            <div className="pending-order-items">
              <div className="pending-order-items-title"><span>Order items</span><small>{order.items.length} {order.items.length === 1 ? "product" : "products"}</small></div>
              {order.items.map((item) => <div className="pending-order-item" key={item.productId}><span>{item.productName}<small>{item.productCode}{[item.color, item.size].filter(Boolean).length ? ` · ${[item.color, item.size].filter(Boolean).join(" · ")}` : ""}</small></span><b>{item.quantity} <small>pcs</small></b></div>)}
            </div>
            <footer className="pending-order-footer">
              <div className="pending-order-total"><span>Total quantity <b>{order.totalQuantity} pieces</b></span><strong>LKR {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
              <div className="pending-order-actions">
                <button type="button" className="cancel-pending-order" disabled={actionBusy} onClick={() => setCancelTarget(order)}>Cancel order</button>
                {order.status === "HELD" ? <button type="button" className="resume-held-order" disabled={actionBusy} onClick={() => resumeOrder(order)}>{resumingId === order._id ? "Resuming..." : "Resume order"}</button> : <><button type="button" className="hold-pending-order" disabled={actionBusy} onClick={() => setHoldTarget(order)}>Put on hold</button><button type="button" className="ready-to-ship-order" disabled={actionBusy} onClick={() => setReadyTarget(order)}><FiTruck aria-hidden="true" />Ready to ship</button></>}
              </div>
            </footer>
          </div>
        </article>)}
      </div> : <p className="empty-dashboard-state">No pending orders for this location.</p>}
      {cancelTarget && <OrderCancellationConfirm order={cancelTarget} actionLabel="Cancel order" busy={cancelling} onClose={() => setCancelTarget(null)} onConfirm={cancelOrder} />}
      {holdTarget && <OrderHoldModal order={holdTarget} busy={holdingId === holdTarget._id} onClose={() => setHoldTarget(null)} onConfirm={holdOrder} />}
      {readyTarget && <ReadyToShipConfirm order={readyTarget} busy={shippingId === readyTarget._id} onClose={() => setReadyTarget(null)} onConfirm={() => markReadyToShip(readyTarget)} />}
    </section>
  );
}
function ShipmentItemsModal({ order, onClose }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="shipment-items-modal" role="dialog" aria-modal="true" aria-labelledby="shipment-items-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><p className="eyebrow">SHIPMENT ORDER ITEMS</p><h2 id="shipment-items-title">{order.orderNumber}</h2><p>{order.customerName} · {order.totalQuantity} pieces</p></div><button type="button" className="close-modal" onClick={onClose} aria-label="Close"><FiX /></button></div>
      <div className="shipment-items-table-wrap"><table className="shipment-items-table"><thead><tr><th>Product</th><th>Code / variant</th><th>Qty.</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.productId}><td>{item.productName}</td><td>{item.productCode}{[item.color, item.size].filter(Boolean).length ? <small>{[item.color, item.size].filter(Boolean).join(" · ")}</small> : null}</td><td>{item.quantity}</td><td>LKR {Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>LKR {Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>
      <div className="shipment-items-modal-total"><span>Order total</span><strong>LKR {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
    </section>
  </div>;
}
function LocationShipmentCards({ orders, onOpenItems, onViewInvoice }) {
  return <div className="shipment-list">
    {orders.map((order) => <article className={`shipment-card location-shipment-card ${order.invoice?.url ? "" : "awaiting-invoice"}`} data-order-id={order._id} key={order._id} onDoubleClick={() => onOpenItems(order)} title="Double-click or double-tap to view order items">
      <div className="shipment-card-main">
        <span>{order.orderNumber}</span>
        <h2>{order.customerName}</h2>
        <small>{order.customerPhone || "No phone number"}</small>
        <p><FiMapPin aria-hidden="true" />{order.customerAddress}</p>
      </div>
      <div className="shipment-total">
        <small>{order.totalQuantity} pieces · Order total</small>
        <strong>LKR {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
        {order.invoice?.url ? <b><FiTruck aria-hidden="true" /> Ready to ship</b> : <b className="shipment-waiting-status"><FiFileText aria-hidden="true" /> Waiting invoice</b>}
      </div>
      <div className="shipment-invoice" onDoubleClick={(event) => event.stopPropagation()}>
        {order.invoice?.url ? <><button type="button" className="invoice-view-button location-invoice-view" onClick={() => onViewInvoice(order)}>View invoice</button><small>{order.invoice.fileName} · Uploaded by {order.invoice.uploadedBy}</small></> : <small className="shipment-awaiting-copy">Invoice has not been uploaded yet.</small>}
      </div>
    </article>)}
  </div>;
}
function SalesShipmentCards({ orders, uploadingId, generatingId, onOpenItems, onViewInvoice, onUploadInvoice, onGenerateInvoice }) {
  const waitingInvoiceOrders = orders.filter((order) => !order.invoice?.url);
  const uploadedInvoiceOrders = orders.filter((order) => order.invoice?.url);
  const renderOrderCard = (order) => {
    const busy = Boolean(uploadingId || generatingId);
    return <article className={`shipment-card ${!order.invoice?.url ? "is-awaiting-invoice" : ""} ${uploadingId === order._id ? "is-uploading" : ""} ${generatingId === order._id ? "is-generating" : ""}`} data-order-id={order._id} key={order._id} onDoubleClick={() => onOpenItems(order)} title="Double-click or double-tap to view order items">
      <div className="shipment-card-main"><span>{order.orderNumber}</span><h2>{order.customerName}</h2><small>{order.customerPhone || "No phone number"}</small><p><FiMapPin aria-hidden="true" />{order.customerAddress}</p></div>
      <div className="shipment-total"><small>Order total</small><strong>LKR {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong><b><FiTruck aria-hidden="true" /> Ready to ship</b></div>
      <div className="shipment-invoice" onDoubleClick={(event) => event.stopPropagation()}>
        <div className="invoice-actions">
          {order.invoice?.url && <button type="button" className="invoice-view-button" onClick={() => onViewInvoice(order)}>View invoice</button>}
          <label className="invoice-upload-button"><FiUploadCloud aria-hidden="true" />{uploadingId === order._id ? "Uploading..." : order.invoice?.url ? "Replace invoice" : "Upload invoice"}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => onUploadInvoice(order, event.target.files?.[0])} /></label>
          <button type="button" className="invoice-generate-button" disabled={busy} onClick={() => onGenerateInvoice(order)}><FiFileText aria-hidden="true" />{generatingId === order._id ? "Generating..." : "Generate invoice"}</button>
        </div>
        {order.invoice?.url && <small>{order.invoice.fileName} · Uploaded by {order.invoice.uploadedBy}</small>}
      </div>
    </article>;
  };
  return <div className="sales-shipment-groups">
    <section className="shipment-status-group" aria-labelledby="waiting-invoice-heading">
      <div className="shipment-status-heading"><div><p className="eyebrow">ACTION REQUIRED</p><h2 id="waiting-invoice-heading">Waiting invoice</h2></div><span>{waitingInvoiceOrders.length}</span></div>
      {waitingInvoiceOrders.length ? <div className="shipment-list">{waitingInvoiceOrders.map(renderOrderCard)}</div> : <p className="shipment-group-empty">All ready shipments have an invoice.</p>}
    </section>
    <div className="shipment-status-divider" role="separator" aria-label="Uploaded invoices" />
    <section className="shipment-status-group uploaded-invoice-group" aria-labelledby="uploaded-invoice-heading">
      <div className="shipment-status-heading"><div><p className="eyebrow">COMPLETED</p><h2 id="uploaded-invoice-heading">Invoice uploaded</h2></div><span>{uploadedInvoiceOrders.length}</span></div>
      {uploadedInvoiceOrders.length ? <div className="shipment-list">{uploadedInvoiceOrders.map(renderOrderCard)}</div> : <p className="shipment-group-empty">No invoices have been uploaded yet.</p>}
    </section>
  </div>;
}
function ShipmentsPage({ refreshKey, canUploadInvoice = false, userName = "" }) {
  const [orders, setOrders] = useState([]), [error, setError] = useState(""), [uploadingId, setUploadingId] = useState(""), [generatingId, setGeneratingId] = useState(""), [selectedShipment, setSelectedShipment] = useState(null), [invoicePreview, setInvoicePreview] = useState(null), [generatedInvoicePreview, setGeneratedInvoicePreview] = useState(null);
  const lastShipmentTap = useRef({ orderId: "", time: 0 });
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/shipments`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (active) { setOrders(data); setError(""); }
    }).catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [refreshKey]);
  const uploadInvoice = async (order, file) => {
    if (!file) return;
    const uploadStartedAt = Date.now();
    setUploadingId(order._id); setError("");
    try {
      const formData = new FormData();
      formData.append("invoice", file);
      const response = await fetch(`${API_URL}/shipments/${order._id}/invoice`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.map((item) => item._id === data._id ? data : item));
    } catch (requestError) { setError(requestError.message); } finally {
      const remainingHighlightTime = Math.max(0, 1000 - (Date.now() - uploadStartedAt));
      window.setTimeout(() => setUploadingId(""), remainingHighlightTime);
    }
  };
  const generateInvoice = async (order) => {
    setGeneratingId(order._id);
    setError("");
    try {
      const generated = await createShipmentInvoicePdf(order, userName);
      setGeneratedInvoicePreview({ order, generated, previewUrl: URL.createObjectURL(generated.blob) });
    } catch (requestError) {
      setError(requestError.message || "Unable to prepare the invoice preview.");
    } finally {
      setGeneratingId("");
    }
  };
  const closeGeneratedInvoicePreview = () => {
    setGeneratedInvoicePreview((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  };
  const confirmGeneratedInvoice = async () => {
    if (!generatedInvoicePreview) return;
    const { order, generated } = generatedInvoicePreview;
    setGeneratingId(order._id);
    setError("");
    try {
      const formData = new FormData();
      formData.append("invoice", new File([generated.blob], generated.fileName, { type: "application/pdf" }));
      const response = await fetch(`${API_URL}/shipments/${order._id}/invoice`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOrders((items) => items.map((item) => item._id === data._id ? data : item));
      closeGeneratedInvoicePreview();
      setInvoicePreview({ ...data.invoice, viewUrl: `${API_URL}/shipments/${data._id}/invoice/view` });
    } catch (requestError) {
      setError(requestError.message || "Unable to confirm the invoice.");
    } finally {
      setGeneratingId("");
    }
  };
  const viewInvoice = (order) => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.location.assign(`${API_URL}/shipments/${order._id}/invoice/download`);
      return;
    }
    setInvoicePreview({ ...order.invoice, viewUrl: `${API_URL}/shipments/${order._id}/invoice/view` });
  };
  const openShipmentOnDoubleTap = (event) => {
    if (event.target.closest("button, label, a, input")) return;
    const shipmentElement = event.target.closest(".shipment-card, .shipment-table tbody tr");
    if (!shipmentElement) return;
    const orderId = shipmentElement.dataset.orderId;
    const shipmentIndex = Array.from(shipmentElement.parentElement.children).indexOf(shipmentElement);
    const order = orders.find((item) => item._id === orderId) || orders[shipmentIndex];
    if (!order) return;
    const now = Date.now();
    const previousTap = lastShipmentTap.current;
    if (previousTap.orderId === order._id && now - previousTap.time <= 500) {
      event.preventDefault();
      lastShipmentTap.current = { orderId: "", time: 0 };
      setSelectedShipment(order);
      return;
    }
    lastShipmentTap.current = { orderId: order._id, time: now };
  };
  if (!canUploadInvoice) return <section className="shipments-page" onTouchEnd={openShipmentOnDoubleTap}>
    <div className="page-title"><div><p className="eyebrow">ORDER FULFILMENT</p><h1>Shipment</h1><p className="page-description">Orders that are prepared and ready for dispatch.</p></div></div>
    {error && <p className="dashboard-error">{error}</p>}
    <p className="pending-orders-count">{orders.length} {orders.length === 1 ? "shipment" : "shipments"}</p>
    {orders.length ? <LocationShipmentCards orders={orders} onOpenItems={setSelectedShipment} onViewInvoice={viewInvoice} /> : <p className="empty-dashboard-state">No shipments are available yet.</p>}
    {selectedShipment && <ShipmentItemsModal order={selectedShipment} onClose={() => setSelectedShipment(null)} />}
    {invoicePreview && <InvoicePreviewModal invoice={invoicePreview} onClose={() => setInvoicePreview(null)} />}
  </section>;
  return <section className="shipments-page" onTouchEnd={openShipmentOnDoubleTap}>
    <div className="page-title"><div><p className="eyebrow">ORDER FULFILMENT</p><h1>Shipment</h1><p className="page-description">{canUploadInvoice ? "Upload an invoice for each shipment ready for dispatch." : "Orders that are prepared and ready for dispatch."}</p></div></div>
    {error && <p className="dashboard-error">{error}</p>}
    <p className="pending-orders-count">{orders.length} ready {orders.length === 1 ? "shipment" : "shipments"}</p>
    {orders.length ? <SalesShipmentCards orders={orders} uploadingId={uploadingId} generatingId={generatingId} onOpenItems={setSelectedShipment} onViewInvoice={viewInvoice} onUploadInvoice={uploadInvoice} onGenerateInvoice={generateInvoice} /> : <p className="empty-dashboard-state">No shipments are ready yet.</p>}
    {selectedShipment && <ShipmentItemsModal order={selectedShipment} onClose={() => setSelectedShipment(null)} />}
    {invoicePreview && <InvoicePreviewModal invoice={invoicePreview} onClose={() => setInvoicePreview(null)} />}
    {generatedInvoicePreview && <InvoicePreviewModal invoice={{ fileName: generatedInvoicePreview.generated.fileName, url: generatedInvoicePreview.previewUrl }} onClose={closeGeneratedInvoicePreview} onConfirm={confirmGeneratedInvoice} confirming={generatingId === generatedInvoicePreview.order._id} />}
  </section>;
}
function InvoicePreviewModal({ invoice, onClose, onConfirm, confirming = false }) {
  const isPdf = /\.pdf(?:$|\?)/i.test(invoice.fileName || invoice.url);
  const previewUrl = invoice.viewUrl || invoice.url;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className={`invoice-preview-modal ${onConfirm ? "invoice-preview-modal-fullscreen" : ""}`} role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><p className="eyebrow">{onConfirm ? "INVOICE PREVIEW" : "UPLOADED INVOICE"}</p><h2 id="invoice-preview-title">{invoice.fileName || "Invoice"}</h2></div><button type="button" className="close-modal" onClick={onClose} aria-label="Close invoice" disabled={confirming}><FiX /></button></div>
      <div className="invoice-preview-canvas">{isPdf ? <iframe src={previewUrl} title={invoice.fileName || "Invoice preview"} /> : <img src={previewUrl} alt={invoice.fileName || "Invoice"} />}</div>
      <div className="invoice-preview-footer">{onConfirm ? <><button type="button" className="invoice-preview-cancel" onClick={onClose} disabled={confirming}>Cancel</button><button type="button" className="invoice-preview-confirm" onClick={onConfirm} disabled={confirming}>{confirming ? "Confirming..." : "Confirm invoice"}</button></> : <a href={previewUrl} target="_blank" rel="noreferrer">Open in new tab</a>}</div>
    </section>
  </div>;
}
function StockUpdatesHistoryPage() {
  const [products, setProducts] = useState([]), [updates, setUpdates] = useState([]), [error, setError] = useState(""), [filters, setFilters] = useState({ productCode: "", productName: "", style: "", colour: "", size: "" }), [imagePreview, setImagePreview] = useState(null), [stockTarget, setStockTarget] = useState(null), [stockQuantity, setStockQuantity] = useState(""), [stockSaving, setStockSaving] = useState(false), [stockImport, setStockImport] = useState(null), [stockImporting, setStockImporting] = useState(false), [stockImportMessage, setStockImportMessage] = useState(""), [zeroingStock, setZeroingStock] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => Promise.all([fetch(`${API_URL}/products`), fetch(`${API_URL}/stock-updates`)])
      .then(async ([productsResponse, updatesResponse]) => {
        const [productsData, updatesData] = await Promise.all([productsResponse.json(), updatesResponse.json()]);
        if (!productsResponse.ok) throw new Error(productsData.message);
        if (!updatesResponse.ok) throw new Error(updatesData.message);
        if (active) { setProducts(productsData); setUpdates(updatesData); setError(""); }
      })
      .catch((requestError) => active && setError(requestError.message));
    load();
    const events = new EventSource(`${API_URL}/stock-events`, { withCredentials: true });
    events.addEventListener("stock-update", load);
    const refreshTimer = window.setInterval(load, 30000);
    return () => { active = false; events.close(); window.clearInterval(refreshTimer); };
  }, []);
  const latestUpdateByProduct = new Map();
  updates.forEach((update) => {
    if (!latestUpdateByProduct.has(String(update.productId))) latestUpdateByProduct.set(String(update.productId), update);
  });
  const colours = [...new Set(products.map((product) => product.color).filter(Boolean))].sort();
  const sizes = [...new Set(products.map((product) => product.size).filter(Boolean))].sort();
  const availableProducts = products.filter((product) => {
    return Number(product.openingStock || 0) > 0 && (!filters.productCode.trim() || String(product.productCode || product.sku || "").toLowerCase().includes(filters.productCode.trim().toLowerCase())) && (!filters.productName.trim() || String(product.productName || product.name || "").toLowerCase().includes(filters.productName.trim().toLowerCase())) && (!filters.style.trim() || String(product.style || "").toLowerCase().includes(filters.style.trim().toLowerCase())) && (!filters.colour || product.color === filters.colour) && (!filters.size || product.size === filters.size);
  });
  const saveStockQuantity = async (event) => {
    event.preventDefault();
    if (!stockTarget || !Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 0) return setError("Enter a whole quantity of zero or more.");
    setStockSaving(true);
    try {
      const response = await fetch(`${API_URL}/products/${stockTarget._id}/stock`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: Number(stockQuantity) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setProducts((current) => current.map((product) => product._id === data._id ? data : product));
      setStockTarget(null); setStockQuantity(""); setError("");
    } catch (requestError) { setError(requestError.message); } finally { setStockSaving(false); }
  };
  const readStockSheet = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setStockImportMessage(""); setStockImporting(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("The spreadsheet must be smaller than 10 MB.");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
      let data, headerRowIndex = -1, levelCodeColumn = -1, quantityColumn = -1;
      for (const sheetName of workbook.SheetNames) {
        const candidate = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
        const candidateHeaderRow = candidate.findIndex((row) => {
          const headers = row.map(normalizeSheetHeader);
          return headers.includes("levelcode") && headers.some((header) => header === "qty" || header === "quantity");
        });
        if (candidateHeaderRow < 0) continue;
        const headers = candidate[candidateHeaderRow].map(normalizeSheetHeader);
        data = candidate; headerRowIndex = candidateHeaderRow;
        levelCodeColumn = headers.findIndex((header) => header === "levelcode");
        quantityColumn = headers.findIndex((header) => header === "qty" || header === "quantity");
        break;
      }
      if (!data) throw new Error("No worksheet containing Level Code and Qty columns was found.");
      const knownProducts = new Map(products.map((product) => [String(product.productCode || product.sku || "").trim(), product]));
      const seen = new Set();
      const rows = data.slice(headerRowIndex + 1).map((values, index) => {
        const levelCode = String(values[levelCodeColumn] ?? "").trim();
        const quantityText = String(values[quantityColumn] ?? "").replace(/,/g, "").trim();
        if (!levelCode && !quantityText) return null;
        const quantity = Number(quantityText);
        const issues = [];
        if (!/^\d{13}$/.test(levelCode)) issues.push("Level Code must be 13 digits.");
        if (!Number.isInteger(quantity) || quantity < 0) issues.push("Qty must be a whole number of zero or more.");
        if (seen.has(levelCode)) issues.push("Duplicate Level Code in this sheet.");
        else if (levelCode) seen.add(levelCode);
        const product = knownProducts.get(levelCode);
        if (levelCode && !product) issues.push("Product not found.");
        return { rowNumber: headerRowIndex + index + 2, levelCode, quantity, product, issues };
      }).filter(Boolean);
      if (!rows.length) throw new Error("No stock rows were found below the headers.");
      if (rows.length > 5000) throw new Error("A maximum of 5,000 rows can be imported at once.");
      setStockImport({ fileName: file.name, rows });
    } catch (importError) { setError(importError.message); } finally { setStockImporting(false); }
  };
  const confirmStockImport = async () => {
    if (!stockImport) return;
    if (stockImport.rows.some((row) => row.issues.length)) {
      setError("Fix the rows marked in red before confirming the stock update.");
      return;
    }
    setStockImporting(true); setError(""); setStockImportMessage("");
    try {
      const response = await fetch(`${API_URL}/products/stock-import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: stockImport.rows.map(({ levelCode, quantity, rowNumber }) => ({ levelCode, quantity, rowNumber })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to update stock.");
      setProducts((current) => current.map((product) => { const row = stockImport.rows.find((item) => item.product?._id === product._id); return row ? { ...product, openingStock: row.quantity } : product; }));
      setStockImportMessage(`${result.updated} product${result.updated === 1 ? "" : "s"} updated. ${result.unchanged} unchanged.`); setStockImport(null);
    } catch (importError) { setError(importError.message); } finally { setStockImporting(false); }
  };
  const zeroAllAvailableStock = async () => {
    const stockedProducts = products.filter((product) => Number(product.openingStock || 0) > 0);
    if (!stockedProducts.length) return setStockImportMessage("All product stock is already zero.");
    if (!window.confirm(`Set the available stock of all ${stockedProducts.length} products to 0? This cannot be undone automatically.`)) return;
    setZeroingStock(true); setError(""); setStockImportMessage("");
    try {
      const response = await fetch(`${API_URL}/products/zero-all-stock`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to reset stock.");
      setProducts((current) => current.map((product) => Number(product.openingStock || 0) > 0 ? { ...product, openingStock: 0 } : product));
      setStockImportMessage(`${result.updated} product${result.updated === 1 ? "" : "s"} reset to zero.`);
    } catch (requestError) { setError(requestError.message); } finally { setZeroingStock(false); }
  };
  return <section className="stock-updates-history-page">
    <div className="page-title"><div><p className="eyebrow">INVENTORY AUDIT</p><h1>Available stock</h1><p className="page-description">Products with stock currently available, including the latest Location Manager update where recorded.</p></div></div>
    {error && <p className="dashboard-error">{error}</p>}
    <section className="stock-sheet-import" aria-labelledby="stock-sheet-import-title">
      <div><p className="eyebrow">BULK STOCK UPDATE</p><h2 id="stock-sheet-import-title">Upload stock sheet</h2><p>Upload an <b>.xls</b> or <b>.xlsx</b> file. The columns <b>Level Code</b> and <b>Qty</b> are detected automatically; Qty replaces the current stock quantity.</p></div>
      <div className="stock-sheet-actions"><button type="button" className="reset-all-stock" disabled={zeroingStock} onClick={zeroAllAvailableStock}>{zeroingStock ? "Resetting..." : "Set all stock to 0"}</button><label className="stock-sheet-upload"><FiUploadCloud aria-hidden="true" />{stockImporting ? "Reading..." : "Choose spreadsheet"}<input type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={stockImporting || zeroingStock} onChange={readStockSheet} /></label></div>
    </section>
    {stockImportMessage && <p className="stock-update-success">{stockImportMessage}</p>}
    {stockImport && <section className="stock-sheet-preview"><div className="stock-sheet-preview-heading"><div><p className="eyebrow">UPLOAD PREVIEW</p><h2>{stockImport.fileName}</h2><p>{stockImport.rows.length} rows · {stockImport.rows.filter((row) => row.issues.length).length} need attention</p></div><button type="button" className="close-modal" onClick={() => setStockImport(null)} aria-label="Close preview"><FiX /></button></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Sheet row</th><th>Level Code</th><th>Product</th><th>Current Qty</th><th>New Qty</th><th>Status</th></tr></thead><tbody>{stockImport.rows.map((row) => <tr key={row.rowNumber} className={row.issues.length ? "stock-sheet-row-error" : ""}><td>{row.rowNumber}</td><td>{row.levelCode || "—"}</td><td>{row.product?.productName || "—"}</td><td>{row.product ? Number(row.product.openingStock || 0).toLocaleString() : "—"}</td><td>{Number.isFinite(row.quantity) ? row.quantity.toLocaleString() : "—"}</td><td>{row.issues.length ? row.issues.join(" ") : row.product.openingStock === row.quantity ? "No change" : "Ready"}</td></tr>)}</tbody></table></div><footer className="stock-sheet-preview-footer"><span>{stockImport.rows.some((row) => row.issues.length) ? "Fix the red rows before confirming." : `${stockImport.rows.filter((row) => row.product.openingStock !== row.quantity).length} quantities will be updated.`}</span><button type="button" className={stockImport.rows.some((row) => row.issues.length) ? "is-disabled" : ""} disabled={stockImporting || stockImport.rows.some((row) => row.issues.length)} title={stockImport.rows.some((row) => row.issues.length) ? "Fix the red rows in the preview first." : "Update the displayed stock quantities."} onClick={confirmStockImport}>{stockImporting ? "Updating..." : "Confirm stock update"}</button></footer></section>}
    <div className="stock-update-filters stock-update-detail-filters"><input type="search" value={filters.productCode} onChange={(event) => setFilters((current) => ({ ...current, productCode: event.target.value }))} placeholder="Product code" /><input type="search" value={filters.productName} onChange={(event) => setFilters((current) => ({ ...current, productName: event.target.value }))} placeholder="Product name" /><input type="search" value={filters.style} onChange={(event) => setFilters((current) => ({ ...current, style: event.target.value }))} placeholder="Style" /><select value={filters.colour} onChange={(event) => setFilters((current) => ({ ...current, colour: event.target.value }))}><option value="">All colours</option>{colours.map((colour) => <option key={colour} value={colour}>{colour}</option>)}</select><select value={filters.size} onChange={(event) => setFilters((current) => ({ ...current, size: event.target.value }))}><option value="">All sizes</option>{sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
    <p className="stock-update-history-count">{availableProducts.length} products with stock available</p>
    {availableProducts.length ? <div className="product-list-card stock-update-product-list"><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Image</th><th>Product code</th><th>Product name</th><th>Style</th><th>Colour</th><th>Size</th><th>Category</th><th>Available stock</th><th>Last quantity added</th><th>Updated by</th><th>Updated time</th></tr></thead><tbody>{availableProducts.map((product) => {
      const update = latestUpdateByProduct.get(String(product._id));
      const images = Array.isArray(product.images) && product.images.length ? product.images : product.imageUrl ? [{ _id: "legacy", url: product.imageUrl }] : [];
      return <tr key={product._id}><td className="product-image-column">{images.length ? <button type="button" className="product-thumbnail" onClick={() => setImagePreview({ images, index: 0, name: product.productName || product.name })}><img src={images[0].url} alt={product.productName || product.name} loading="lazy" />{images.length > 1 && <span className="product-image-count">{images.length}</span>}</button> : <span className="product-image-placeholder"><FiImage /></span>}</td><td>{product.productCode || product.sku}</td><td><strong>{product.productName || product.name}</strong><small>{product.plant || "Head Office"}</small></td><td>{product.style || "—"}</td><td>{product.color || "—"}</td><td>{product.size || "—"}</td><td>{product.categoryCode || product.category || "—"}</td><td>{stockTarget?._id === product._id ? <form className="inline-stock-editor" onSubmit={saveStockQuantity}><input autoFocus type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setStockTarget(null); setStockQuantity(""); } }} onBlur={() => { if (!stockSaving) { setStockTarget(null); setStockQuantity(""); } }} /></form> : <button type="button" className="editable-stock-quantity" title="Double-click to update stock" onDoubleClick={() => { setStockTarget(product); setStockQuantity(String(product.openingStock || 0)); }}><strong>{Number(product.openingStock).toLocaleString()} {product.unit || "Pieces"}</strong></button>}</td><td>{update ? `${Number(update.quantityAdded) >= 0 ? "+" : ""}${Number(update.quantityAdded).toLocaleString()} pieces` : "Not recorded yet"}</td><td>{update?.managerName || "—"}</td><td>{update ? new Date(update.createdAt).toLocaleString() : "—"}</td></tr>;
    })}</tbody></table></div></div> : !error && <p className="empty-dashboard-state">No products with stock available yet.</p>}
    <section className="stock-update-history-section"><div className="page-title"><div><p className="eyebrow">INVENTORY AUDIT</p><h2>Update history</h2><p className="page-description">All stock additions made by Location Managers.</p></div></div>{updates.length ? <div className="product-list-card"><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Date & time</th><th>Product code</th><th>Product name</th><th>Quantity added</th><th>Stock after update</th><th>Location</th><th>Updated by</th></tr></thead><tbody>{updates.map((update) => <tr key={update._id}><td>{new Date(update.createdAt).toLocaleString()}</td><td>{update.productCode}</td><td>{update.productName}</td><td><strong>+{Number(update.quantityAdded).toLocaleString()} pieces</strong></td><td>{Number(update.resultingStock).toLocaleString()} pieces</td><td>{update.location}</td><td>{update.managerName}</td></tr>)}</tbody></table></div></div> : !error && <p className="empty-dashboard-state">No Location Manager stock updates have been recorded yet.</p>}</section>
    {imagePreview && <div className="modal-backdrop sales-image-preview-backdrop" onClick={() => setImagePreview(null)}><section className="sales-image-preview-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="product-image-preview-header"><div><p className="eyebrow">PRODUCT IMAGES</p><h2>{imagePreview.name}</h2><p className="product-gallery-count">Image {imagePreview.index + 1} of {imagePreview.images.length}</p></div><button type="button" className="close-modal" onClick={() => setImagePreview(null)}><FiX /></button></div><div className="product-image-preview-canvas">{imagePreview.images.length > 1 && <button type="button" className="gallery-arrow previous" onClick={() => setImagePreview((preview) => ({ ...preview, index: (preview.index - 1 + preview.images.length) % preview.images.length }))}><FiChevronLeft /></button>}<img src={imagePreview.images[imagePreview.index].url} alt={imagePreview.name} />{imagePreview.images.length > 1 && <button type="button" className="gallery-arrow next" onClick={() => setImagePreview((preview) => ({ ...preview, index: (preview.index + 1) % preview.images.length }))}><FiChevronRight /></button>}</div>{imagePreview.images.length > 1 && <div className="product-image-gallery-footer"><div className="product-image-thumbnails">{imagePreview.images.map((image, index) => <button type="button" className={index === imagePreview.index ? "active" : ""} key={image._id || image.url} onClick={() => setImagePreview((preview) => ({ ...preview, index }))}><img src={image.url} alt="" /></button>)}</div></div>}</section></div>}
  </section>;
}
function LegacyGrnPage({ user }) {
  const [grnNumber, setGrnNumber] = useState(""), [locations, setLocations] = useState([]), [products, setProducts] = useState([]), [items, setItems] = useState([]), [form, setForm] = useState({ supplierCode: "", supplierName: "", remarks: "", grnDate: new Date().toISOString().slice(0, 10), location: user.location || "Head Office" }), [draft, setDraft] = useState({ productId: "", quantity: "", costPrice: "", sellingPrice: "" }), [error, setError] = useState(""), [message, setMessage] = useState(""), [saving, setSaving] = useState(false);
  const load = () => Promise.all([fetch(`${API_URL}/grns/next-number`), fetch(`${API_URL}/locations`), fetch(`${API_URL}/products`)]).then(async ([numberResponse, locationsResponse, productsResponse]) => {
    const [numberData, locationsData, productsData] = await Promise.all([numberResponse.json(), locationsResponse.json(), productsResponse.json()]);
    if (!numberResponse.ok) throw new Error(numberData.message);
    if (!locationsResponse.ok) throw new Error(locationsData.message);
    if (!productsResponse.ok) throw new Error(productsData.message);
    setGrnNumber(numberData.grnNumber); setLocations(locationsData); setProducts(productsData);
  }).catch((requestError) => setError(requestError.message));
  useEffect(() => { load(); }, []);
  const selectedProduct = products.find((product) => product._id === draft.productId);
  const addItem = () => {
    if (!selectedProduct || !Number.isInteger(Number(draft.quantity)) || Number(draft.quantity) < 1) return setError("Select a product and enter a whole quantity of at least 1.");
    if (items.some((item) => item.productId === draft.productId)) return setError("This product is already in the GRN.");
    setItems((current) => [...current, { productId: selectedProduct._id, productCode: selectedProduct.productCode, productName: selectedProduct.productName, quantity: Number(draft.quantity), costPrice: Number(draft.costPrice || selectedProduct.costPrice || 0), sellingPrice: Number(draft.sellingPrice || selectedProduct.sellingPrice || 0) }]);
    setDraft({ productId: "", quantity: "", costPrice: "", sellingPrice: "" }); setError("");
  };
  const save = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!items.length) return setError("Add at least one product to the GRN.");
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/grns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, items }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setMessage(`${data.grnNumber} saved successfully.`); setItems([]); await load();
    } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  };
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0), totalAmount = items.reduce((total, item) => total + item.quantity * item.costPrice, 0);
  return <section className="grn-page"><div className="page-title"><div><p className="eyebrow">INVENTORY RECEIPT</p><h1>Goods Received Note</h1><p className="page-description">Record goods received and add them to stock.</p></div></div>{error && <p className="dashboard-error">{error}</p>}{message && <p className="stock-update-success">{message}</p>}<form onSubmit={save}><section className="grn-details"><label>GRN No<input value={grnNumber} readOnly /></label><label>Supplier Code<input value={form.supplierCode} onChange={(event) => setForm((current) => ({ ...current, supplierCode: event.target.value }))} required /></label><label>Supplier Name<input value={form.supplierName} onChange={(event) => setForm((current) => ({ ...current, supplierName: event.target.value }))} required /></label><label>GRN Date<input type="date" value={form.grnDate} onChange={(event) => setForm((current) => ({ ...current, grnDate: event.target.value }))} required /></label><label>Location<select value={form.location} disabled={user.role === "LOCATION_MANAGER"} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}>{locations.map((location) => <option key={location._id} value={location.name}>{location.name}</option>)}</select></label><label className="grn-remarks">Remarks<input value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} /></label></section><section className="grn-add-item"><h2>Add item</h2><select value={draft.productId} onChange={(event) => { const product = products.find((item) => item._id === event.target.value); setDraft({ productId: event.target.value, quantity: "", costPrice: product?.costPrice ?? "", sellingPrice: product?.sellingPrice ?? "" }); }}><option value="">Select product</option>{products.filter((product) => product.plant === form.location).map((product) => <option key={product._id} value={product._id}>{product.productCode} — {product.productName}</option>)}</select><input type="number" min="1" step="1" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantity" /><input type="number" min="0" step="0.01" value={draft.costPrice} onChange={(event) => setDraft((current) => ({ ...current, costPrice: event.target.value }))} placeholder="Cost price" /><input type="number" min="0" step="0.01" value={draft.sellingPrice} onChange={(event) => setDraft((current) => ({ ...current, sellingPrice: event.target.value }))} placeholder="Selling price" /><button type="button" onClick={addItem}>Add item</button></section><section className="grn-preview"><div className="grn-preview-heading"><h2>Preview</h2><span>{items.length} items · {totalQuantity.toLocaleString()} pieces</span></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Row</th><th>Product Code</th><th>Product Name</th><th>Order</th><th>Qty</th><th>Cost Price</th><th>Selling Price</th><th>Amount</th><th></th></tr></thead><tbody>{items.map((item, index) => <tr key={item.productId}><td>{index + 1}</td><td>{item.productCode}</td><td>{item.productName}</td><td>—</td><td>{item.quantity}</td><td>LKR {item.costPrice.toLocaleString()}</td><td>LKR {item.sellingPrice.toLocaleString()}</td><td>LKR {(item.quantity * item.costPrice).toLocaleString()}</td><td><button type="button" className="close-modal" onClick={() => setItems((current) => current.filter((entry) => entry.productId !== item.productId))}><FiX /></button></td></tr>)}</tbody></table></div><div className="grn-total"><span>Total Quantity <b>{totalQuantity.toLocaleString()}</b></span><span>Gross Amount <b>LKR {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></span><button disabled={saving}>{saving ? "Saving..." : "Save GRN"}</button></div></section></form></section>;
}
function GrnPage({ user }) {
  const [products, setProducts] = useState([]), [locations, setLocations] = useState([]), [number, setNumber] = useState(""), [items, setItems] = useState([]), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplierCode: "", supplierName: "", remarks: "", grnDate: new Date().toISOString().slice(0, 10), location: user.location || "Head Office" });
  const [entry, setEntry] = useState({ code: "", quantity: "" });
  useEffect(() => { Promise.all([fetch(`${API_URL}/products`), fetch(`${API_URL}/locations`), fetch(`${API_URL}/grns/next-number`)]).then(async ([p, l, n]) => { const [productsData, locationsData, numberData] = await Promise.all([p.json(), l.json(), n.json()]); if (!p.ok || !l.ok || !n.ok) throw new Error(productsData.message || locationsData.message || numberData.message); setProducts(productsData); setLocations(locationsData); setNumber(numberData.grnNumber); }).catch((e) => setError(e.message)); }, []);
  const product = products.find((item) => String(item.productCode || item.sku || "").toLowerCase() === entry.code.trim().toLowerCase() && item.plant === form.location);
  const addItem = () => { if (!product || !Number.isInteger(Number(entry.quantity)) || Number(entry.quantity) < 1) return setError("Enter a valid Product Code and quantity."); if (items.some((item) => item.productId === product._id)) return setError("This product is already added."); setItems((current) => [...current, { productId: product._id, productCode: product.productCode, productName: product.productName, quantity: Number(entry.quantity), costPrice: Number(product.costPrice || 0), sellingPrice: Number(product.sellingPrice || 0) }]); setEntry({ code: "", quantity: "" }); setError(""); };
  const save = async (event) => { event.preventDefault(); if (document.activeElement?.getAttribute("placeholder") === "Quantity") return addItem(); if (!items.length) return setError("Add at least one item."); setSaving(true); try { const response = await fetch(`${API_URL}/grns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, items }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setItems([]); setNumber(""); setError(""); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const total = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
  return <section className="grn-page"><div className="page-title"><div><p className="eyebrow">INVENTORY RECEIPT</p><h1>Goods Received Note</h1></div></div>{error && <p className="dashboard-error">{error}</p>}<form onSubmit={save}><section className="grn-details"><label>GRN No<input value={number} readOnly /></label><label>Supplier Code<input required value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} /></label><label>Supplier Name<input required value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></label><label>GRN Date<input type="date" value={form.grnDate} onChange={(e) => setForm({ ...form, grnDate: e.target.value })} /></label><label>Location<select disabled={user.role === "LOCATION_MANAGER"} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>{locations.map((l) => <option key={l._id} value={l.name}>{l.name}</option>)}</select></label><label className="grn-remarks">Remarks<input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label></section><section className="grn-add-item"><input value={entry.code} onChange={(e) => setEntry({ ...entry, code: e.target.value })} placeholder="Product Code" /><input value={product?.productName || ""} readOnly placeholder="Product Name" /><input type="number" min="1" value={entry.quantity} onChange={(e) => setEntry({ ...entry, quantity: e.target.value })} placeholder="Qty" /><input value={product ? `LKR ${Number(product.costPrice).toLocaleString()}` : ""} readOnly placeholder="Cost price" /><input value={product ? `LKR ${Number(product.sellingPrice).toLocaleString()}` : ""} readOnly placeholder="Selling price" /><button type="button" onClick={addItem}>Add item</button></section><section className="grn-preview"><div className="grn-preview-heading"><h2>Preview</h2><span>{items.length} items</span></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Row</th><th>Product Code</th><th>Product Name</th><th>Order</th><th>Qty</th><th>Cost Price</th><th>Selling Price</th><th>Amount</th><th></th></tr></thead><tbody>{items.map((item, i) => <tr key={item.productId}><td>{i + 1}</td><td>{item.productCode}</td><td>{item.productName}</td><td>-</td><td>{item.quantity}</td><td>LKR {item.costPrice.toLocaleString()}</td><td>LKR {item.sellingPrice.toLocaleString()}</td><td>LKR {(item.quantity * item.costPrice).toLocaleString()}</td><td><button type="button" className="close-modal" onClick={() => setItems(items.filter((x) => x.productId !== item.productId))}><FiX /></button></td></tr>)}</tbody></table></div><div className="grn-total"><span>Gross Amount <b>LKR {total.toLocaleString()}</b></span><button disabled={saving}>{saving ? "Saving..." : "Save GRN"}</button></div></section></form></section>;
}
function GrnProductLookup() {
  const [open, setOpen] = useState(false), [products, setProducts] = useState([]), [filter, setFilter] = useState("");
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Enter" && document.activeElement?.getAttribute("placeholder") === "Quantity") {
        event.preventDefault(); window.setTimeout(() => document.querySelector(".grn-add-item button")?.click(), 0); return;
      }
      if (event.key !== "F3" || document.activeElement?.getAttribute("placeholder") !== "Product Code") return;
      event.preventDefault(); setOpen(true);
      fetch(`${API_URL}/products`).then((response) => response.json()).then(setProducts).catch(() => setProducts([]));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  useEffect(() => {
    const form = document.querySelector(".grn-page form");
    const onSubmit = (event) => {
      if (document.activeElement?.getAttribute("placeholder") !== "Quantity") return;
      event.preventDefault(); event.stopPropagation();
      window.setTimeout(() => document.querySelector(".grn-add-item button")?.click(), 0);
    };
    form?.addEventListener("submit", onSubmit);
    return () => form?.removeEventListener("submit", onSubmit);
  }, []);
  useEffect(() => {
    const quantity = document.querySelector('.grn-add-item input[placeholder="Quantity"]');
    const onEnter = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault(); event.stopImmediatePropagation();
      document.querySelector(".grn-add-item button")?.click();
    };
    quantity?.addEventListener("keydown", onEnter, true);
    return () => quantity?.removeEventListener("keydown", onEnter, true);
  }, []);
  const selectProduct = (product) => {
    const input = document.querySelector('.grn-add-item input[placeholder="Product Code"]');
    if (input) { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, product.productCode || product.sku); input.dispatchEvent(new Event("input", { bubbles: true })); }
    setOpen(false); setFilter("");
  };
  const visible = products.filter((product) => [product.productCode, product.productName, product.style, product.color, product.size].filter(Boolean).join(" ").toLowerCase().includes(filter.toLowerCase()));
  return open && <div className="modal-backdrop grn-lookup-backdrop" onClick={() => setOpen(false)}><section className="grn-lookup-modal" onClick={(event) => event.stopPropagation()}><div className="product-image-preview-header"><div><p className="eyebrow">PRODUCT MASTER</p><h2>Select product</h2><p>Search, then double-click an item to add it to the GRN.</p></div><button type="button" className="close-modal" onClick={() => setOpen(false)}><FiX /></button></div><input autoFocus type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search code, name, style, colour..." /><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Product Code</th><th>Product Name</th><th>Style</th><th>Colour</th><th>Size</th><th>Stock</th></tr></thead><tbody>{visible.map((product) => <tr key={product._id} onDoubleClick={() => selectProduct(product)} title="Double-click to select"><td>{product.productCode || product.sku}</td><td>{product.productName || product.name}</td><td>{product.style || "-"}</td><td>{product.color || "-"}</td><td>{product.size || "-"}</td><td>{Number(product.openingStock || 0).toLocaleString()}</td></tr>)}</tbody></table></div></section></div>;
}
function Dashboard({ user, onLogout, theme, setTheme }) {
  const permissionConfigured = Array.isArray(user.sidebarPermissions);
  // Sales Return was introduced after some Super Admin accounts already had a
  // saved permission list. Keep it available to Super Admins without requiring
  // each existing account to be edited once.
  const canSeeSidebar = (permission) => {
    if (["Stock Adjustment Report", "Supplier Wise Stock Movement"].includes(permission))
      return user.role === "SUPER_ADMIN" || (
        permissionConfigured && user.sidebarPermissions.includes(permission)
      );
    return ["Sales Return", "Stock Movement Details", "Stock Adjustment"].includes(permission) && user.role === "SUPER_ADMIN"
      ? true
      : !permissionConfigured || user.sidebarPermissions.includes(permission);
  };
  const [c, setC] = useState(false),
    [m, setM] = useState(false),
    [headerHidden, setHeaderHidden] = useState(false),
    [confirm, setConfirm] = useState(false),
    [view, setV] = useState(() => {
      const roleFields = sidebarPermissionsForRole(user.role);
      const visibleFields = Array.isArray(user.sidebarPermissions)
        ? ALL_SIDEBAR_PERMISSIONS.filter((field) => user.sidebarPermissions.includes(field))
        : roleFields;
      return visibleFields.find((field) => field !== "Inventory") || visibleFields[0] || "Dashboard";
    }),
    [timeGreeting, setTimeGreeting] = useState(getTimeGreeting),
    [reportOpen, setReportOpen] = useState(false),
    [inventorySalesOpen, setInventorySalesOpen] = useState(false),
    [salesReportsOpen, setSalesReportsOpen] = useState(false),
    [stockReportsOpen, setStockReportsOpen] = useState(false),
    [transactionInquiryOpen, setTransactionInquiryOpen] = useState(false),
    [dashboardData, setDashboardData] = useState(null),
    [dashboardError, setDashboardError] = useState(""),
    [salesProducts, setSalesProducts] = useState([]),
    [salesProductsError, setSalesProductsError] = useState(""),
    [salesOrders, setSalesOrders] = useState([]),
    [salesOrdersError, setSalesOrdersError] = useState(""),
    [orderRefreshKey, setOrderRefreshKey] = useState(0),
    [orderToEdit, setOrderToEdit] = useState(null),
    [salesProductFilters, setSalesProductFilters] = useState({
      search: "",
      category: "",
      gender: "",
      stock: "",
    }),
    [salesImagePreview, setSalesImagePreview] = useState(null),
    [notifications, setNotifications] = useState([]),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [toastNotification, setToastNotification] = useState(null),
    admin = user.role === "SUPER_ADMIN",
    locationManager = user.role === "LOCATION_MANAGER",
    salesDepartment = ["SALES DEP", "SALES_DEP"].includes(user.role);
  useEffect(() => {
    const updateGreeting = () => setTimeGreeting(getTimeGreeting());
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const markNotificationRead = async (notification) => {
    if (notification.readAt) return;
    setNotifications((items) => items.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
    try { await fetch(`${API_URL}/notifications/${notification._id}/read`, { method: "PATCH" }); } catch { /* The notification remains visible and will retry on another click. */ }
  };
  const openNotification = (notification) => {
    markNotificationRead(notification);
    setNotificationsOpen(false);
    setToastNotification(null);
    if (notification.type === "ORDER" && locationManager) setV("Pending Orders");
    else if (notification.type === "ORDER" && !admin) setV("Sales");
    else if (notification.type === "STOCK" && admin) setV("Stock Updates");
    else if (notification.type === "STOCK" && locationManager) setV("Stock Update");
    else if (notification.type === "GRN" && (admin || locationManager)) {
      setReportOpen(true);
      setInventorySalesOpen(true);
      setTransactionInquiryOpen(true);
      setV("GRN Report");
    }
  };
  useEffect(() => {
    let active = true;
    const loadNotifications = async (showToast = false) => {
      try {
        const response = await fetch(`${API_URL}/notifications`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!active) return;
        setNotifications(data);
        if (showToast && data.find((notification) => !notification.readAt)) setToastNotification(data.find((notification) => !notification.readAt));
      } catch { /* Notifications must not block the dashboard. */ }
    };
    // Existing unread items remain available from the bell menu. Do not show
    // them again as a large toast whenever the page is refreshed.
    loadNotifications();
    const events = new EventSource(`${API_URL}/stock-events`, { withCredentials: true });
    events.addEventListener("notification-update", () => {
      loadNotifications(true);
      setOrderRefreshKey((key) => key + 1);
    });
    events.addEventListener("order-update", () => setOrderRefreshKey((key) => key + 1));
    events.addEventListener("stock-update", (event) => {
      const updates = JSON.parse(event.data);
      const stockById = new Map(updates.map((item) => [item.productId, Number(item.openingStock)]));
      setSalesProducts((items) => items.map((item) => stockById.has(item._id) ? { ...item, openingStock: stockById.get(item._id) } : item));
    });
    return () => { active = false; events.close(); };
  }, []);
  useEffect(() => {
    if (!toastNotification) return;
    const timer = window.setTimeout(() => setToastNotification(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toastNotification]);
  const roleLinks = admin
    ? [
        [FiCodesandbox, "Dashboard"],
        [FiBox, "Inventory"],
        [FiFileText, "Stock Updates"],
        [FiBox, "Stock Adjustment"],
        [FiFileText, "GRN"],
        [FiFileText, "PRN"],
        [FiFileText, "Sales Return"],
        [FiBarChart2 , "Sales"],
        [FiUsers, "Customers"],
        [FiUsers, "Users"],
        [FiMapPin, "Locations"],
        [FiUsers, "Roles"],
      ]
    : locationManager
      ? [
          [FiBarChart2, "Dashboard"],
          [FiBox, "Stock Update"],
          [FiFileText, "GRN"],
          [FiFileText, "PRN"],
          [FiFileText, "Sales Return"],
          [FiPlusCircle, "Create Order"],
          [FiLayers, "Pending Orders"],
          [FiTruck, "Shipment"],
        ]
      : salesDepartment
        ? [[FiTruck, "Shipment"]]
      : [
          [FiBarChart2, "Dashboard"],
          [FiPlusCircle, "Create Order"],
          [FiFileText, "Sales"],
        ];
  const configurableLinks = [
    [FiCodesandbox, "Dashboard"],
    [FiBox, "Inventory"],
    [FiFileText, "Stock Updates"],
    [FiBox, "Stock Adjustment"],
    [FiFileText, "GRN"],
    [FiFileText, "PRN"],
    [FiFileText, "Sales Return"],
    [FiBarChart2, "Sales"],
    [FiUsers, "Customers"],
    [FiUsers, "Users"],
    [FiMapPin, "Locations"],
    [FiUsers, "Roles"],
    [FiBox, "Stock Update"],
    [FiPlusCircle, "Create Order"],
    [FiLayers, "Pending Orders"],
    [FiTruck, "Shipment"],
  ];
  const links = (permissionConfigured ? configurableLinks : roleLinks)
    .filter(([, label]) => canSeeSidebar(label));
  useEffect(() => {
    let lastY = window.scrollY;
    const updateHeader = () => {
      if (window.innerWidth > 760) return setHeaderHidden(false);
      const currentY = window.scrollY;
      if (currentY < 24) setHeaderHidden(false);
      else if (currentY > lastY + 8) setHeaderHidden(true);
      else if (currentY < lastY - 8) setHeaderHidden(false);
      lastY = currentY;
    };
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader);
    return () => {
      window.removeEventListener("scroll", updateHeader);
      window.removeEventListener("resize", updateHeader);
    };
  }, []);
  useEffect(() => {
    if (!admin || view !== "Dashboard") return;
    let active = true;
    setDashboardError("");
    fetch(`${API_URL}/dashboard/summary`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (active) setDashboardData(data);
      })
      .catch((error) => active && setDashboardError(error.message));
    return () => {
      active = false;
    };
  }, [admin, view]);
  const catalogProducts = locationManager
    ? salesProducts
    : salesProducts.filter((product) => Number(product.openingStock || 0) > 0);
  const salesCategories = [
    ...new Set(
      catalogProducts
        .map((product) => product.categoryCode || product.category)
        .filter(Boolean),
    ),
  ].sort();
  const salesGenders = [
    ...new Set(
      catalogProducts.map((product) => product.gender).filter(Boolean),
    ),
  ].sort();
  const filteredSalesProducts = catalogProducts.filter((product) => {
    const search = salesProductFilters.search.trim().toLowerCase();
    const searchable = [
      product.productCode,
      product.sku,
      product.productName,
      product.name,
      product.style,
      product.color,
      product.size,
      product.categoryCode,
      product.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!search || searchable.includes(search)) &&
      (!salesProductFilters.category ||
        (product.categoryCode || product.category) ===
          salesProductFilters.category) &&
      (!salesProductFilters.gender ||
        product.gender === salesProductFilters.gender) &&
      (!salesProductFilters.stock ||
        (salesProductFilters.stock === "out" &&
          Number(product.openingStock || 0) === 0))
    );
  });
  useEffect(() => {
    if (admin || view !== "Dashboard") return;
    let active = true;
    setSalesProductsError("");
    fetch(`${API_URL}/products`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (active) setSalesProducts(data);
      })
      .catch((error) => active && setSalesProductsError(error.message));
    return () => {
      active = false;
    };
  }, [admin, view]);
  useEffect(() => {
    if (admin || view !== "Dashboard") return;
    let active = true;
    setSalesOrdersError("");
    fetch(`${API_URL}/orders`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (active) setSalesOrders(data);
      })
      .catch((error) => active && setSalesOrdersError(error.message));
    return () => {
      active = false;
    };
  }, [admin, view, orderRefreshKey]);
  const formatNumber = (value) =>
    value == null ? "—" : Number(value).toLocaleString();
  const liveAdminStats = [
    ["Master Products", formatNumber(dashboardData?.totalProducts)],
    ["Total Stock", formatNumber(dashboardData?.totalStock)],
    ["Low Stock Products", formatNumber(dashboardData?.lowStockProducts)],
    ["Sales Representatives", formatNumber(dashboardData?.salesReps)],
  ];
  const stats = admin
    ? [
        ["Total Products", "1,284"],
        ["Low Stock Items", "18"],
        ["Today’s Sales", "LKR 142,500"],
        ["Active Sales Reps", "12"],
      ]
    : [
        ["My Sales Today", "LKR 28,500"],
        ["Orders Created", "14"],
      ];
  const today = new Date();
  const isToday = (date) => {
    const value = new Date(date);
    return (
      value.getFullYear() === today.getFullYear() &&
      value.getMonth() === today.getMonth() &&
      value.getDate() === today.getDate()
    );
  };
  const todaysOrders = salesOrders.filter((order) => isToday(order.createdAt));
  const todaysSales = todaysOrders.reduce(
    (total, order) => total + Number(order.totalAmount || 0),
    0,
  );
  const salesStats = [
    [
      "Sales Today",
      `LKR ${todaysSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ],
    ["Orders Today", formatNumber(todaysOrders.length)],
    ["Available Products", formatNumber(catalogProducts.length)],
  ];
  const locationManagerStats = [
    ["Factory Products", formatNumber(salesProducts.length)],
    [
      "Total Factory Stock",
      formatNumber(
        salesProducts.reduce(
          (total, product) => total + Number(product.openingStock || 0),
          0,
        ),
      ),
    ],
    [
      "Out of Stock",
      formatNumber(
        salesProducts.filter(
          (product) => Number(product.openingStock || 0) === 0,
        ).length,
      ),
      () => setSalesProductFilters((filters) => ({
        ...filters,
        stock: filters.stock === "out" ? "" : "out",
      })),
    ],
    [
      "Pending Order Stock",
      formatNumber(salesOrders.reduce((total, order) => total + Number(order.totalQuantity || 0), 0)),
      () => setV("Pending Orders"),
    ],
  ];
  const header = (
    <header className={`dashboard-header ${headerHidden ? "is-hidden" : ""}`}>
      <div>
        <p className="eyebrow">
          {admin
            ? "SUPER ADMIN"
            : locationManager
              ? "LOCATION MANAGER"
              : salesDepartment
                ? "SALES DEPARTMENT"
              : "SALES REPRESENTATIVE"}
        </p>
        <h1>
          {["Users", "Customers", "Locations", "Roles"].includes(view)
            ? `Manage ${view.toLowerCase()}.`
            : view === "Stock Updates"
              ? "Review stock update history."
            : view === "Stock Adjustment"
              ? "Correct inventory stock variances."
            : view === "Stock Adjustment Report"
              ? "Stock adjustment transaction inquiry."
            : view === "GRN"
              ? "Create a goods received note."
              : view === "PRN"
                ? "Create a purchase return note."
            : view === "Sales Return"
                ? "Create a customer sales return."
            : view === "GRN Report"
              ? "Goods received note report."
            : view === "Sales Register"
              ? "Sales register report."
            : view === "Stock Balance Report"
              ? "Stock balance report."
            : view === "Supplier Wise Stock Movement"
              ? "Review supplier stock movement transactions."
            : view === "Stock Movement Details"
              ? "Review product stock movements."
            : view === "Stock Update"
              ? "Update factory stock."
              : view === "Pending Orders"
                ? "Review pending sales orders."
              : view === "Shipment"
                ? "Orders prepared for dispatch."
              : view === "Create Order"
                ? "Create sales order."
            : view === "Sales"
              ? "Sales history."
                : `${timeGreeting}, ${user.name.split(" ")[0]}.`}
        </h1>
      </div>
      <div className="header-actions">
        <button className="mobile-menu-button" onClick={() => setM(true)}>
          <FiMenu />
        </button>
        <div className="notification-menu">
          <button type="button" className="notification-bell" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications" aria-expanded={notificationsOpen}>
            <FiBell />
            {unreadNotifications.length > 0 && <b>{unreadNotifications.length > 99 ? "99+" : unreadNotifications.length}</b>}
          </button>
          {notificationsOpen && <section className="notification-dropdown" aria-label="Notifications">
            <div className="notification-dropdown-title"><div><h2>Notifications</h2><small>{unreadNotifications.length} unread</small></div><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><FiX /></button></div>
            <div className="notification-list">{notifications.length ? notifications.map((notification) => <button type="button" key={notification._id} className={`notification-item ${notification.readAt ? "is-read" : "is-unread"}`} onClick={() => openNotification(notification)}><strong>{notification.title}</strong><span>{notification.message}</span><small>{new Date(notification.createdAt).toLocaleString()}</small></button>) : <p>No notifications yet.</p>}</div>
          </section>}
        </div>
        <ThemeButton theme={theme} setTheme={setTheme} />
        <div className="avatar" title={user.name}>
          {user.name[0]}
        </div>
      </div>
    </header>
  );
  const displayedStats = admin
    ? liveAdminStats
    : locationManager
      ? locationManagerStats
      : salesStats;
  const content =
    view === "Users" ? (
      <UsersPage />
    ) : view === "Customers" && admin ? (
      <CustomersPage />
    ) : view === "Stock Updates" && admin ? (
      <StockUpdatesHistoryPage />
    ) : view === "Stock Adjustment" && (admin || canSeeSidebar("Stock Adjustment")) ? (
      <StockAdjustmentPage />
    ) : view === "Stock Adjustment Report" && (admin || canSeeSidebar("Stock Adjustment Report")) ? (
      <StockAdjustmentReportPage />
    ) : view === "GRN" && (admin || locationManager) ? (
      <GrnPageNew user={user} />
    ) : view === "PRN" && (admin || locationManager) ? (
      <PrnPage user={user} />
    ) : view === "Sales Return" && (admin || locationManager) ? (
      <SalesReturnPage user={user} />
    ) : view === "GRN Report" && (admin || locationManager || canSeeSidebar("GRN Report")) ? (
      <GrnReportPage user={user} />
    ) : view === "Sales Register" && (admin || locationManager || canSeeSidebar("Sales Register")) ? (
      <SalesRegisterPage />
    ) : view === "Stock Balance Report" && (admin || canSeeSidebar("Stock Balance Report")) ? (
      <StockBalanceReportPage />
    ) : view === "Supplier Wise Stock Movement" && (admin || canSeeSidebar("Supplier Wise Stock Movement")) ? (
      <SupplierWiseStockMovementPage user={user} />
    ) : view === "Stock Movement Details" && (admin || canSeeSidebar("Stock Movement Details")) ? (
      <StockMovementDetailsPage user={user} />
    ) : view === "Locations" ? (
      <SettingsPage type="locations" />
    ) : view === "Roles" ? (
      <SettingsPage type="roles" />
    ) : view === "Stock Update" && locationManager ? (
      <StockUpdatePage />
    ) : view === "Pending Orders" && locationManager ? (
      <PendingOrdersPage refreshKey={orderRefreshKey} onOrderChanged={() => setOrderRefreshKey((key) => key + 1)} onReadyToShip={() => setV("Shipment")} />
    ) : view === "Shipment" && (locationManager || salesDepartment) ? (
      <ShipmentsPage refreshKey={orderRefreshKey} canUploadInvoice={salesDepartment} userName={user.name} />
    ) : view === "Create Order" && !admin ? (
      <SalesOrderPage
        editingOrder={orderToEdit}
        onOrderCreated={() => {
          setOrderToEdit(null);
          setOrderRefreshKey((key) => key + 1);
          setV(locationManager ? "Pending Orders" : "Sales");
        }}
      />
    ) : view === "Sales" && !locationManager ? (
      <SalesHistoryPage refreshKey={orderRefreshKey} isAdmin={admin} onOrderChanged={() => setOrderRefreshKey((key) => key + 1)} onEditOrder={(order) => { setOrderToEdit(order); setV("Create Order"); }} />
    ) : (
      <>
        <section className="stats">
          {displayedStats.map(([l, v, onClick]) => (
            <article
              key={l}
              className={onClick && salesProductFilters.stock === "out" ? "is-active" : ""}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
              onClick={onClick}
              onKeyDown={(event) => {
                if (onClick && (event.key === "Enter" || event.key === " ")) onClick();
              }}
            >
              <p>{l}</p>
              <strong>{v}</strong>
              <small>Updated just now</small>
            </article>
          ))}
        </section>
        {admin && dashboardError && (
          <p className="dashboard-error">{dashboardError}</p>
        )}
        {admin && view === "Dashboard" && <>
          <GrnSeriesSettings />
          <PrnSeriesSettings />
          <SalesOrderSeriesSettings />
          <CustomerSeriesSettings />
          <StockAdjustmentSeriesSettings />
        </>}
        {!admin && view === "Dashboard" && (
          <section className="sales-product-catalog">
            <div className="sales-product-catalog-heading">
              <div>
                <h2>
                  {locationManager ? "Factory products" : "Available products"}
                </h2>
                <p>
                  {locationManager
                    ? salesProductFilters.stock === "out"
                      ? "Showing out-of-stock products. Click the Out of Stock card again to clear."
                      : `Products assigned to ${user.location}.`
                    : "Browse product details and available stock."}
                </p>
              </div>
              <span>
                {filteredSalesProducts.length} of {catalogProducts.length}{" "}
                products
              </span>
            </div>
            <div
              className="sales-product-filters"
              aria-label="Filter available products"
            >
              <input
                type="search"
                value={salesProductFilters.search}
                onChange={(event) =>
                  setSalesProductFilters((filters) => ({
                    ...filters,
                    search: event.target.value,
                  }))
                }
                placeholder="Search name, code, style, colour..."
                aria-label="Search available products"
              />
              <select
                value={salesProductFilters.category}
                onChange={(event) =>
                  setSalesProductFilters((filters) => ({
                    ...filters,
                    category: event.target.value,
                  }))
                }
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {salesCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={salesProductFilters.gender}
                onChange={(event) =>
                  setSalesProductFilters((filters) => ({
                    ...filters,
                    gender: event.target.value,
                  }))
                }
                aria-label="Filter by gender"
              >
                <option value="">All genders</option>
                {salesGenders.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
            </div>
            {salesProductsError ? (
              <p className="dashboard-error">{salesProductsError}</p>
            ) : filteredSalesProducts.length ? (
              <div className="sales-product-grid">
                {filteredSalesProducts.map((product) => {
                  const images =
                    Array.isArray(product.images) && product.images.length
                      ? product.images
                      : product.imageUrl
                        ? [{ _id: "legacy", url: product.imageUrl }]
                        : [];
                  const image = images[0]?.url;
                  return (
                    <article className="sales-product-card" key={product._id}>
                      <button
                        type="button"
                        className={`sales-product-image${image ? " is-viewable" : ""}`}
                        disabled={!image}
                        onClick={() =>
                          setSalesImagePreview({
                            images,
                            index: 0,
                            name: product.productName || product.name,
                          })
                        }
                        aria-label={`View images for ${product.productName || product.name}`}
                      >
                        {image ? (
                          <img
                            src={image}
                            alt={product.productName || product.name}
                            loading="lazy"
                          />
                        ) : (
                          <FiImage aria-label="Product image unavailable" />
                        )}
                        {images.length > 1 && (
                          <span className="sales-product-image-count">
                            {images.length} images
                          </span>
                        )}
                      </button>
                      <div className="sales-product-content">
                        <span className="sales-product-code">
                          {product.productCode || product.sku}
                        </span>
                        <h3>{product.productName || product.name}</h3>
                        <div className="sales-product-details">
                          <span>
                            Category{" "}
                            <b>
                              {product.categoryCode || product.category || "—"}
                            </b>
                          </span>
                          <span>
                            Gender <b>{product.gender || "—"}</b>
                          </span>
                          <span>
                            Style <b>{product.style || "—"}</b>
                          </span>
                          <span>
                            Colour <b>{product.color || "—"}</b>
                          </span>
                          <span>
                            Size <b>{product.size || "—"}</b>
                          </span>
                          <span>
                            Stock{" "}
                            <b>
                              {formatNumber(product.openingStock)}{" "}
                              {product.unit || "Pieces"}
                            </b>
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-dashboard-state">
                {catalogProducts.length
                  ? "No products match the selected filters."
                  : "No products are available yet."}
              </p>
            )}
          </section>
        )}
      </>
    );
  return (
    <div className="dashboard">
      {toastNotification && <div className="notification-toast" role="button" tabIndex="0" onClick={() => openNotification(toastNotification)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openNotification(toastNotification); }}><FiBell /><div><strong>{toastNotification.title}</strong><span>{toastNotification.message}</span></div><button type="button" onClick={(event) => { event.stopPropagation(); setToastNotification(null); }} aria-label="Dismiss notification"><FiX /></button></div>}
      {m && <button className="menu-overlay" onClick={() => setM(false)} />}{" "}
      {confirm && (
        <div className="modal-backdrop">
          <section className="confirm-modal">
            <div className="modal-icon">
              <FiLogOut />
            </div>
            <h2>Sign out?</h2>
            <p>Are you sure you want to sign out of Jockey Stock?</p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
              <button className="confirm-button" onClick={onLogout}>
                Yes, sign out
              </button>
            </div>
          </section>
        </div>
      )}
      {salesImagePreview && (
        <div
          className="modal-backdrop sales-image-preview-backdrop"
          onClick={() => setSalesImagePreview(null)}
        >
          <section
            className="sales-image-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${salesImagePreview.name} images`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="product-image-preview-header">
              <div>
                <p className="eyebrow">PRODUCT IMAGES</p>
                <h2>{salesImagePreview.name}</h2>
                <p className="product-gallery-count">
                  Image {salesImagePreview.index + 1} of{" "}
                  {salesImagePreview.images.length}
                </p>
              </div>
              <button
                type="button"
                className="close-modal"
                aria-label="Close image preview"
                onClick={() => setSalesImagePreview(null)}
              >
                <FiX />
              </button>
            </div>
            <div className="product-image-preview-canvas">
              {salesImagePreview.images.length > 1 && (
                <button
                  type="button"
                  className="gallery-arrow previous"
                  aria-label="Previous image"
                  onClick={() =>
                    setSalesImagePreview((preview) => ({
                      ...preview,
                      index:
                        (preview.index - 1 + preview.images.length) %
                        preview.images.length,
                    }))
                  }
                >
                  <FiChevronLeft />
                </button>
              )}
              <img
                src={salesImagePreview.images[salesImagePreview.index].url}
                alt={`${salesImagePreview.name} ${salesImagePreview.index + 1}`}
              />
              {salesImagePreview.images.length > 1 && (
                <button
                  type="button"
                  className="gallery-arrow next"
                  aria-label="Next image"
                  onClick={() =>
                    setSalesImagePreview((preview) => ({
                      ...preview,
                      index: (preview.index + 1) % preview.images.length,
                    }))
                  }
                >
                  <FiChevronRight />
                </button>
              )}
            </div>
            {salesImagePreview.images.length > 1 && (
              <div className="product-image-gallery-footer">
                <div className="product-image-thumbnails">
                  {salesImagePreview.images.map((image, index) => (
                    <button
                      type="button"
                      className={
                        index === salesImagePreview.index ? "active" : ""
                      }
                      key={image._id || image.url}
                      aria-label={`View image ${index + 1}`}
                      onClick={() =>
                        setSalesImagePreview((preview) => ({
                          ...preview,
                          index,
                        }))
                      }
                    >
                      <img src={image.url} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      <aside className={`${c ? "collapsed" : ""} ${m ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand"><img className="brand-logo" src={logoUrl} alt="Jockey logo" />JOCKEY<span>®</span></div>
          <button
            className="sidebar-toggle"
            onClick={() => (window.innerWidth <= 760 ? setM(!m) : setC(!c))}
          >
            <FiMenu />
          </button>
        </div>
        <p>{admin ? "ADMIN PORTAL" : "SALES PORTAL"}</p>
        <nav>
          {links.map(([I, l]) => (
            <a
              key={l}
              className={view === l ? "active" : ""}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setOrderToEdit(null);
                setReportOpen(false);
                setInventorySalesOpen(false);
                setTransactionInquiryOpen(false);
                setV(l);
                setM(false);
              }}
            >
              <I />
              <span>{l}</span>
            </a>
          ))}
          {(admin || (permissionConfigured && (canSeeSidebar("Sales Register") || canSeeSidebar("GRN Report") || canSeeSidebar("Stock Balance Report") || canSeeSidebar("Stock Adjustment Report") || canSeeSidebar("Supplier Wise Stock Movement"))) ||
            (!permissionConfigured && (admin || locationManager))) && (
            <div className="sidebar-menu-group">
              <button
                type="button"
                className="sidebar-menu-trigger"
                aria-expanded={reportOpen}
                onClick={() => {
                  if (c && window.innerWidth > 760) {
                    setC(false);
                    setReportOpen(true);
                    return;
                  }
                  setReportOpen((open) => !open);
                }}
              >
                <FiBarChart2 />
                <span>Report</span>
                <FiChevronDown className={`sidebar-menu-chevron${reportOpen ? " is-open" : ""}`} />
              </button>
              {reportOpen && (
                <div className="sidebar-submenu">
                  <button
                    type="button"
                    className="sidebar-menu-trigger sidebar-submenu-trigger"
                    aria-expanded={inventorySalesOpen}
                    onClick={() => setInventorySalesOpen((open) => !open)}
                  >
                    <span>Inventory &amp; Sales</span>
                    <FiChevronDown className={`sidebar-menu-chevron${inventorySalesOpen ? " is-open" : ""}`} />
                  </button>
                  {inventorySalesOpen && (
                    <div className="sidebar-submenu sidebar-submenu-deep">
                      {canSeeSidebar("Sales Register") && <>
                        <button
                          type="button"
                          className="sidebar-menu-trigger sidebar-submenu-trigger"
                          aria-expanded={salesReportsOpen}
                          onClick={() => setSalesReportsOpen((open) => !open)}
                        >
                          <span>Sales Reports</span>
                          <FiChevronDown className={`sidebar-menu-chevron${salesReportsOpen ? " is-open" : ""}`} />
                        </button>
                        {salesReportsOpen && (
                          <div className="sidebar-submenu sidebar-submenu-deep">
                            <a
                              className={`sidebar-report-link${view === "Sales Register" ? " active" : ""}`}
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setOrderToEdit(null);
                                setV("Sales Register");
                                setM(false);
                              }}
                            >
                              <FiFileText />
                              <span>Sales Register</span>
                            </a>
                          </div>
                        )}
                      </>}
                      {(admin || canSeeSidebar("Stock Balance Report") || canSeeSidebar("Stock Movement Details") || canSeeSidebar("Supplier Wise Stock Movement")) && <>
                        <button
                          type="button"
                          className="sidebar-menu-trigger sidebar-submenu-trigger"
                          aria-expanded={stockReportsOpen}
                          onClick={() => setStockReportsOpen((open) => !open)}
                        >
                          <span>Stock Reports</span>
                          <FiChevronDown className={`sidebar-menu-chevron${stockReportsOpen ? " is-open" : ""}`} />
                        </button>
                        {stockReportsOpen && (
                          <div className="sidebar-submenu sidebar-submenu-deep">
                            <a
                              className={`sidebar-report-link${view === "Stock Balance Report" ? " active" : ""}`}
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setOrderToEdit(null);
                                setV("Stock Balance Report");
                                setM(false);
                              }}
                            >
                              <FiFileText />
                              <span>Stock Balance Report</span>
                            </a>
                            {canSeeSidebar("Stock Movement Details") && <a
                              className={`sidebar-report-link${view === "Stock Movement Details" ? " active" : ""}`}
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setOrderToEdit(null);
                                setV("Stock Movement Details");
                                setM(false);
                              }}
                            >
                              <FiFileText />
                              <span>Stock Movement Details</span>
                            </a>}
                            {canSeeSidebar("Supplier Wise Stock Movement") && <a
                              className={`sidebar-report-link${view === "Supplier Wise Stock Movement" ? " active" : ""}`}
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setOrderToEdit(null);
                                setV("Supplier Wise Stock Movement");
                                setM(false);
                              }}
                            >
                              <FiFileText />
                              <span>Supplier Wise Stock Movement</span>
                            </a>}
                          </div>
                        )}
                      </>}
                      {(canSeeSidebar("GRN Report") || canSeeSidebar("Stock Adjustment Report")) && <>
                        <button
                          type="button"
                          className="sidebar-menu-trigger sidebar-submenu-trigger"
                          aria-expanded={transactionInquiryOpen}
                          onClick={() => setTransactionInquiryOpen((open) => !open)}
                        >
                          <span>Transaction Inquiry</span>
                          <FiChevronDown className={`sidebar-menu-chevron${transactionInquiryOpen ? " is-open" : ""}`} />
                        </button>
                        {transactionInquiryOpen && (
                          <div className="sidebar-submenu sidebar-submenu-deep">
                            {canSeeSidebar("GRN Report") && <a
                              className={`sidebar-report-link${view === "GRN Report" ? " active" : ""}`}
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setOrderToEdit(null);
                                setV("GRN Report");
                                setM(false);
                              }}
                            >
                              <FiFileText />
                              <span>Goods Received Note (GRN)</span>
                            </a>}
                            {canSeeSidebar("Stock Adjustment Report") && <a
                              className={`sidebar-report-link${view === "Stock Adjustment Report" ? " active" : ""}`}
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setOrderToEdit(null);
                                setV("Stock Adjustment Report");
                                setM(false);
                              }}
                            >
                              <FiFileText />
                              <span>Stock Adjustment</span>
                            </a>}
                          </div>
                        )}
                      </>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="side-actions">
          <button className="logout" onClick={() => setConfirm(true)}>
            <FiLogOut />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="dashboard-content">
        {header}
        {content}
      </main>
    </div>
  );
}
const emptyProductBreakdown = () => ({
  style: "",
  packingQuantity: "",
  cartonQuantity: "",
  color: "",
  size: "",
});
const parseProductNameDetails = (value = "") => {
  const productName = String(value).trim().toUpperCase();
  const match = productName.match(
    /^([A-Z0-9]+)-(\d{2})(\d{2})-([A-Z0-9]+)-([A-Z0-9]+)$/,
  );
  if (!match) return null;
  return {
    style: match[1],
    packingQuantity: match[2],
    cartonQuantity: match[3],
    color: match[4],
    size: match[5],
  };
};
const allowedProductGenders = ["MENS", "WOMENS", "BOYS", "GIRLS", "UNISEX"];
const normalizeProductGender = (value = "") => {
  const gender = String(value).trim().toUpperCase();
  if (gender === "MEN") return "MENS";
  if (gender === "WOMEN") return "WOMENS";
  return gender;
};
const createEmptyProduct = () => ({
  productCode: "",
  referenceCode1: "",
  productName: "",
  ...emptyProductBreakdown(),
  gender: "",
  categoryCode: "",
  subCategoryCode: "",
  subSubCategory: "",
  supplierCode: "JOCKEY",
  costPrice: "",
  sellingPrice: "",
});
const productPriceFields = [
  "costPrice",
  "sellingPrice",
];
const productImportColumns = [
  { header: "Product Code", key: "productCode", width: 19 },
  { header: "Product Name", key: "productName", width: 27 },
  { header: "Gender", key: "gender", width: 14 },
  { header: "Category Code", key: "categoryCode", width: 18 },
  { header: "Sub Category Code", key: "subCategoryCode", width: 21 },
  {
    header: "Sub Sub Category",
    key: "subSubCategory",
    width: 21,
    optional: true,
  },
  { header: "Supplier Code", key: "supplierCode", width: 17 },
  { header: "Cost Price", key: "costPrice", width: 15 },
  { header: "Selling Price", key: "sellingPrice", width: 16 },
];
const normalizeSheetHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const getSpreadsheetCellValue = (cell) => {
  let value = cell?.value;
  if (value && typeof value === "object") {
    if ("result" in value) value = value.result;
    else if (Array.isArray(value.richText)) {
      value = value.richText.map((part) => part.text).join("");
    } else value = cell.text;
  }
  return value == null ? "" : String(value).trim();
};
const getProductImages = (product) => {
  if (Array.isArray(product.images) && product.images.length) {
    return product.images.map((image) => ({
      _id: image._id,
      url: image.url,
    }));
  }
  return product.imageUrl ? [{ _id: "legacy", url: product.imageUrl }] : [];
};
function ProductMaster({ open }) {
  const [products, setProducts] = useState([]),
    [productFilter, setProductFilter] = useState(""),
    [formOpen, setFormOpen] = useState(false),
    [editingProduct, setEditingProduct] = useState(null),
    [selected, setSelected] = useState([]),
    [deleteTargets, setDeleteTargets] = useState([]),
    [form, setForm] = useState(createEmptyProduct),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [importing, setImporting] = useState(false),
    [importReport, setImportReport] = useState(null),
    [pendingImport, setPendingImport] = useState(null),
    [imageUploadingId, setImageUploadingId] = useState(null),
    [imagePreview, setImagePreview] = useState(null),
    [imageDeleteTarget, setImageDeleteTarget] = useState(null),
    [imageStatus, setImageStatus] = useState(null);
  const load = async () => {
    try {
      const r = await fetch(`${API_URL}/products`),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setProducts(d);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (open) load();
  }, [open]);
  const update = (e) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "productName") {
        const productName = value.toUpperCase();
        next.productName = productName;
        next.referenceCode1 = productName;
        Object.assign(
          next,
          parseProductNameDetails(productName) || emptyProductBreakdown(),
        );
      }

      return next;
    });
  };
  const formatPrice = (value) =>
    value == null
      ? "—"
      : Number(value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const openAdd = () => {
    setError("");
    setEditingProduct(null);
    setForm(createEmptyProduct());
    setFormOpen(true);
  };
  const openEdit = (product) => {
    setError("");
    setEditingProduct(product);
    const productName = product.productName || product.name || "";
    const parsedDetails =
      parseProductNameDetails(productName) || emptyProductBreakdown();
    setForm({
      productCode: product.productCode || product.sku || "",
      referenceCode1: productName,
      productName,
      style: product.style || parsedDetails.style,
      packingQuantity: product.packingQuantity || parsedDetails.packingQuantity,
      cartonQuantity: product.cartonQuantity || parsedDetails.cartonQuantity,
      color: product.color || parsedDetails.color,
      size: product.size || parsedDetails.size,
      gender: normalizeProductGender(product.gender),
      categoryCode: product.categoryCode || product.category || "",
      subCategoryCode: product.subCategoryCode || "",
      subSubCategory: product.subSubCategory || "",
      supplierCode: product.supplierCode || "JOCKEY",
      costPrice: product.costPrice ?? "",
      sellingPrice: product.sellingPrice ?? "",
    });
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditingProduct(null);
    setError("");
  };
  const toggleSelected = (id) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const filteredProducts = products.filter((product) => {
    const query = productFilter.trim().toLowerCase();
    if (!query) return true;
    return [
      product.productCode,
      product.sku,
      product.referenceCode1,
      product.productName,
      product.name,
      product.style,
      product.color,
      product.size,
      product.gender,
      product.categoryCode,
      product.category,
      product.subCategoryCode,
      product.subSubCategory,
      product.supplierCode,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const toggleAll = () =>
    setSelected((current) => {
      const visibleIds = filteredProducts.map((product) => product._id);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => current.includes(id));
      return allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])];
    });
  const downloadProductTemplate = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Jockey Stock";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Products", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = productImportColumns.map(({ header, key, width }) => ({
      header,
      key,
      width,
    }));
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: productImportColumns.length },
    };
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEA5A35" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    sheet.getColumn("productCode").numFmt = "@";
    sheet.getColumn("productName").numFmt = "@";
    for (let row = 2; row <= 2001; row += 1) {
      sheet.getCell(`C${row}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"MENS,WOMENS,BOYS,GIRLS,UNISEX"'],
      };
    }

    const instructions = workbook.addWorksheet("Instructions");
    instructions.columns = [
      { header: "Field", key: "field", width: 25 },
      { header: "Requirement", key: "requirement", width: 58 },
      { header: "Example", key: "example", width: 28 },
    ];
    instructions.addRows([
      {
        field: "Product Code",
        requirement: "Required. Exactly 13 digits. Keep the cell as text.",
        example: "1234567890123",
      },
      {
        field: "Product Name",
        requirement:
          "Required. STYLE + 2-digit packing + 2-digit carton + COLOR + SIZE.",
        example: "FP03-0205-ASSTD-XL",
      },
      {
        field: "Gender",
        requirement:
          "Required. Select MENS, WOMENS, BOYS, GIRLS, or UNISEX. Letter case is normalized automatically.",
        example: "MENS",
      },
      {
        field: "Sub Sub Category",
        requirement: "Optional. This cell may be left blank.",
        example: "",
      },
      {
        field: "Supplier Code",
        requirement: "Required. Use JOCKEY when no other supplier applies.",
        example: "JOCKEY",
      },
      {
        field: "Price columns",
        requirement: "Required. Enter a positive number or zero.",
        example: "1250.00",
      },
    ]);
    instructions.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF172030" },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "jockey-product-import-template.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };
  const importProductSheet = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportReport(null);
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("The XLSX file must be smaller than 10 MB.");
      }
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Products") || workbook.worksheets[0];
      if (!sheet) throw new Error("No worksheet was found in this file.");

      const headerIndexes = new Map();
      sheet.getRow(1).eachCell((cell, columnNumber) => {
        headerIndexes.set(normalizeSheetHeader(cell.text), columnNumber);
      });
      const missingHeaders = productImportColumns.filter(
        ({ header, optional }) =>
          !optional && !headerIndexes.has(normalizeSheetHeader(header)),
      );
      if (missingHeaders.length) {
        throw new Error(
          `Missing columns: ${missingHeaders.map(({ header }) => header).join(", ")}.`,
        );
      }

      const importedRows = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const values = Object.fromEntries(
          productImportColumns.map(({ header, key }) => {
            const columnNumber = headerIndexes.get(
              normalizeSheetHeader(header),
            );
            return [
              key,
              columnNumber
                ? getSpreadsheetCellValue(row.getCell(columnNumber))
                : "",
            ];
          }),
        );
        if (!Object.values(values).some(Boolean)) continue;
        importedRows.push({ ...values, rowNumber });
      }
      if (!importedRows.length) {
        throw new Error(
          "The Products worksheet does not contain any data rows.",
        );
      }
      if (importedRows.length > 2000) {
        throw new Error("A maximum of 2,000 products can be imported at once.");
      }
      const existingCodes = new Set(
        products.map((product) => product.productCode || product.sku),
      );
      const seenCodes = new Set();
      const previewRows = importedRows.map((row) => {
        const normalizedRow = Object.fromEntries(
          productImportColumns.map(({ key }) => [
            key,
            productPriceFields.includes(key)
              ? row[key]
              : String(row[key] || "").trim().toUpperCase(),
          ]),
        );
        const issues = [];
        const productCode = normalizedRow.productCode;
        const details = parseProductNameDetails(normalizedRow.productName);
        if (!/^\d{13}$/.test(productCode)) {
          issues.push("Product Code must contain exactly 13 numbers.");
        }
        if (seenCodes.has(productCode)) {
          issues.push("Duplicate Product Code in this sheet.");
        } else if (productCode) {
          seenCodes.add(productCode);
        }
        if (existingCodes.has(productCode)) {
          issues.push("Product Code already exists.");
        }
        if (!details) {
          issues.push("Invalid Product Name format.");
        }
        if (
          !allowedProductGenders.includes(normalizeProductGender(normalizedRow.gender))
        ) {
          issues.push("Invalid Gender.");
        }
        if (
          ["categoryCode", "subCategoryCode", "supplierCode"].some(
            (field) => !String(normalizedRow[field] || "").trim(),
          )
        ) {
          issues.push("A required classification field is empty.");
        }
        if (
          productPriceFields.some(
            (field) =>
              String(normalizedRow[field] ?? "").trim() === "" ||
              !Number.isFinite(Number(normalizedRow[field])) ||
              Number(normalizedRow[field]) < 0,
          )
        ) {
          issues.push("One or more prices are invalid.");
        }
        return {
          ...normalizedRow,
          gender: normalizeProductGender(normalizedRow.gender),
          details: details || emptyProductBreakdown(),
          issues,
        };
      });
      setPendingImport({ fileName: file.name, rows: previewRows });
    } catch (importError) {
      setImportReport({
        type: "error",
        message: importError.message,
        errors: [],
      });
    } finally {
      setImporting(false);
    }
  };
  const confirmSpreadsheetImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    setImportReport(null);
    try {
      const productsToImport = pendingImport.rows.map((row) =>
        Object.fromEntries([
          ...productImportColumns.map(({ key }) => [key, row[key]]),
          ["rowNumber", row.rowNumber],
        ]),
      );
      const response = await fetch(`${API_URL}/products/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: productsToImport }),
      });
      const result = await response.json();
      if (!response.ok && !result.errors) {
        throw new Error(
          result.message || "The spreadsheet could not be imported.",
        );
      }
      if (result.inserted) await load();
      setPendingImport(null);
      setImportReport({
        type: result.failed
          ? result.inserted
            ? "warning"
            : "error"
          : "success",
        message: `${result.inserted || 0} products imported. ${result.failed || 0} rows skipped.`,
        errors: result.errors || [],
      });
    } catch (importError) {
      setImportReport({
        type: "error",
        message: importError.message,
        errors: [],
      });
    } finally {
      setImporting(false);
    }
  };
  const uploadProductImage = async (product, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setImageStatus(null);
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setImageStatus({
        type: "error",
        message: "Only JPG, PNG, and WebP product images are allowed.",
      });
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setImageStatus({
        type: "error",
        message: "Each product image must be 5 MB or less.",
      });
      return;
    }
    const remainingSlots = 6 - getProductImages(product).length;
    if (files.length > remainingSlots) {
      setImageStatus({
        type: "error",
        message: `You can upload only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} for this product.`,
      });
      return;
    }
    setImageUploadingId(product._id);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("images", file));
      const response = await fetch(`${API_URL}/products/${product._id}/image`, {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await load();
      setImageStatus({
        type: "success",
        message: `${files.length} image${files.length === 1 ? "" : "s"} added to ${result.matchedProducts} product${result.matchedProducts === 1 ? "" : "s"} with Style ${result.style} and Packing Quantity ${result.packingQuantity}.`,
      });
    } catch (imageError) {
      setImageStatus({ type: "error", message: imageError.message });
    } finally {
      setImageUploadingId(null);
    }
  };
  const removeProductImage = async () => {
    if (!imageDeleteTarget) return;
    const { product, image } = imageDeleteTarget;
    setImageUploadingId(product._id);
    setImageStatus(null);
    try {
      const response = await fetch(
        image
          ? `${API_URL}/products/${product._id}/images/${image._id}`
          : `${API_URL}/products/${product._id}/image`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message);
      }
      if (image) await response.json();
      await load();
      setImageDeleteTarget(null);
      setImagePreview(null);
      setImageStatus({
        type: "success",
        message: image
          ? `${product.productName || product.name} image removed.`
          : `All images removed from ${product.productName || product.name}.`,
      });
    } catch (imageError) {
      setImageStatus({ type: "error", message: imageError.message });
    } finally {
      setImageUploadingId(null);
    }
  };
  async function confirmDelete() {
    setSaving(true);
    setError("");
    try {
      const responses = await Promise.all(
        deleteTargets.map((id) =>
          fetch(`${API_URL}/products/${id}`, { method: "DELETE" }),
        ),
      );
      if (responses.some((response) => !response.ok)) {
        throw new Error("Some products could not be deleted.");
      }
      setProducts((current) =>
        current.filter((product) => !deleteTargets.includes(product._id)),
      );
      setSelected((current) =>
        current.filter((id) => !deleteTargets.includes(id)),
      );
      setDeleteTargets([]);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    const parsedDetails = parseProductNameDetails(form.productName);
    if (!parsedDetails) {
      setError("Product Name must use the format FP03-0205-ASSTD-XL.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(
          `${API_URL}/products${editingProduct ? `/${editingProduct._id}` : ""}`,
          {
            method: editingProduct ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              ...parsedDetails,
              ...Object.fromEntries(
                productPriceFields.map((field) => [field, Number(form[field])]),
              ),
            }),
          },
        ),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setProducts((old) =>
        editingProduct
          ? old.map((product) => (product._id === d._id ? d : product))
          : [d, ...old],
      );
      setForm(createEmptyProduct());
      closeForm();
    } catch (x) {
      setError(x.message);
    } finally {
      setSaving(false);
    }
  }
  if (!open) return null;
  return (
    <div className="inventory-overlay">
      <div className="inventory-top">
        <div>
          <p className="eyebrow">PRODUCT MASTER FILE</p>
          <h1>Head Office Inventory</h1>
          <p>All products added here belong to Head Office.</p>
        </div>
        <div className="product-header-buttons">
          <button
            type="button"
            className="template-button"
            onClick={downloadProductTemplate}
          >
            <FiDownload /> XLSX Template
          </button>
          <label className={`xlsx-upload-button${importing ? " is-busy" : ""}`}>
            <FiUploadCloud />
            <span>{importing ? "Importing..." : "Upload XLSX"}</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={importProductSheet}
              disabled={importing}
            />
          </label>
          <button className="add-product-button" onClick={openAdd}>
            <FiPlusCircle /> Add Product
          </button>
        </div>
      </div>
      {importReport && (
        <div
          className={`import-report ${importReport.type}`}
          role="status"
          aria-live="polite"
        >
          <div className="import-report-heading">
            <div>
              <strong>Spreadsheet import</strong>
              <p>{importReport.message}</p>
            </div>
            <button
              type="button"
              aria-label="Close import report"
              onClick={() => setImportReport(null)}
            >
              <FiX />
            </button>
          </div>
          {importReport.errors.length > 0 && (
            <ul>
              {importReport.errors.slice(0, 8).map((item, index) => (
                <li key={`${item.row}-${item.productCode}-${index}`}>
                  <b>Row {item.row}</b>
                  <span>{item.productCode || "No product code"}</span>
                  <small>{item.message}</small>
                </li>
              ))}
            </ul>
          )}
          {importReport.errors.length > 8 && (
            <p className="remaining-import-errors">
              +{importReport.errors.length - 8} more skipped rows
            </p>
          )}
        </div>
      )}
      {imageStatus && (
        <div
          className={`product-image-status ${imageStatus.type}`}
          role="status"
        >
          <FiImage />
          <span>{imageStatus.message}</span>
          <button
            type="button"
            aria-label="Close image message"
            onClick={() => setImageStatus(null)}
          >
            <FiX />
          </button>
        </div>
      )}
      {pendingImport && (
        <div className="modal-backdrop xlsx-preview-backdrop">
          <section
            className="xlsx-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="xlsx-preview-title"
          >
            <div className="xlsx-preview-header">
              <div>
                <p className="eyebrow">REVIEW BEFORE IMPORT</p>
                <h2 id="xlsx-preview-title">Product import preview</h2>
                <p>
                  {pendingImport.fileName} · {pendingImport.rows.length} rows
                </p>
              </div>
              <button
                type="button"
                className="close-modal"
                aria-label="Close preview"
                disabled={importing}
                onClick={() => setPendingImport(null)}
              >
                <FiX />
              </button>
            </div>
            <div className="xlsx-preview-summary">
              <div className="valid">
                <span>Ready to import</span>
                <strong>
                  {
                    pendingImport.rows.filter((row) => !row.issues.length)
                      .length
                  }
                </strong>
              </div>
              <div className="invalid">
                <span>Needs attention</span>
                <strong>
                  {pendingImport.rows.filter((row) => row.issues.length).length}
                </strong>
              </div>
              <p>
                Rows marked “Needs attention” will be checked again and skipped
                by the server.
              </p>
            </div>
            <div className="xlsx-preview-table-wrap">
              <table className="xlsx-preview-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Style</th>
                    <th>Pack Qty</th>
                    <th>Carton Qty</th>
                    <th>Color</th>
                    <th>Size</th>
                    <th>Gender</th>
                    <th>Category</th>
                    <th>Sub Category</th>
                    <th>Supplier</th>
                    <th className="price-column">Cost Price</th>
                    <th className="price-column">Selling Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingImport.rows.map((row) => (
                    <tr
                      key={`${row.rowNumber}-${row.productCode}`}
                      className={
                        row.issues.length ? "invalid-row" : "valid-row"
                      }
                    >
                      <td>{row.rowNumber}</td>
                      <td>
                        <span
                          className={`preview-status ${row.issues.length ? "invalid" : "valid"}`}
                          title={row.issues.join(" ")}
                        >
                          {row.issues.length ? "Needs attention" : "Ready"}
                        </span>
                        {row.issues.length > 0 && (
                          <small className="preview-row-error">
                            {row.issues.join(" · ")}
                          </small>
                        )}
                      </td>
                      <td>{row.productCode || "—"}</td>
                      <td>{row.productName || "—"}</td>
                      <td>{row.details.style || "—"}</td>
                      <td>{row.details.packingQuantity || "—"}</td>
                      <td>{row.details.cartonQuantity || "—"}</td>
                      <td>{row.details.color || "—"}</td>
                      <td>{row.details.size || "—"}</td>
                      <td>{row.gender || "—"}</td>
                      <td>{row.categoryCode || "—"}</td>
                      <td>{row.subCategoryCode || "—"}</td>
                      <td>{row.supplierCode || "—"}</td>
                      {productPriceFields.map((field) => (
                        <td className="price-column" key={field}>
                          {row[field] || row[field] === 0 ? row[field] : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="xlsx-preview-actions">
              <button
                type="button"
                className="cancel-button"
                disabled={importing}
                onClick={() => setPendingImport(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-button"
                disabled={
                  importing ||
                  pendingImport.rows.every((row) => row.issues.length)
                }
                onClick={confirmSpreadsheetImport}
              >
                {importing ? "Importing..." : "Confirm Import"}
              </button>
            </div>
          </section>
        </div>
      )}
      <section className="product-list-card">
        <div className="product-list-title">
          <h2>Products</h2>
          <div className="product-list-tools">
            {selected.length > 0 && (
              <button
                className="bulk-delete-button"
                onClick={() => setDeleteTargets(selected)}
              >
                <FiTrash2 /> Delete selected ({selected.length})
              </button>
            )}
            <span>
              {productFilter.trim()
                ? `${filteredProducts.length} of ${products.length} items`
                : `${products.length} items`}
            </span>
          </div>
        </div>
        <div className="product-filter">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
            placeholder="Filter by code, name, style, colour, size, gender, category or supplier"
            aria-label="Filter products"
          />
        </div>
        {products.length ? (
          <>
            <div className="product-table-wrap">
              <table className="product-table">
              <thead>
                <tr>
                  <th className="select-column">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      checked={
                        filteredProducts.length > 0 &&
                        filteredProducts.every((product) =>
                          selected.includes(product._id),
                        )
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="product-image-column">Image</th>
                  <th>Product Code</th>
                  <th>Reference Code 1</th>
                  <th>Product Name</th>
                  <th>Style</th>
                  <th>Packing Quantity</th>
                  <th>Carton Quantity</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Gender</th>
                  <th>Category Code</th>
                  <th>Sub Category Code</th>
                  <th>Sub Sub Category</th>
                  <th>Supplier Code</th>
                  <th className="price-column">Cost Price</th>
                  <th className="price-column">Selling Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr
                    key={p._id}
                    className="editable-product-row"
                    title="Double-click to edit"
                    onDoubleClick={() => openEdit(p)}
                  >
                    <td className="select-column" data-label="Select">
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.productName || p.name}`}
                        checked={selected.includes(p._id)}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelected(p._id)}
                      />
                    </td>
                    <td
                      className="product-image-column"
                      data-label="Image"
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <div className="product-image-cell">
                        {getProductImages(p).length ? (
                          <button
                            type="button"
                            className="product-thumbnail"
                            title="View product image"
                            onClick={(event) => {
                              event.stopPropagation();
                              setImagePreview({
                                images: getProductImages(p),
                                index: 0,
                                name: p.productName || p.name,
                                product: p,
                              });
                            }}
                          >
                            <img
                              src={getProductImages(p)[0].url}
                              alt={p.productName || p.name}
                              loading="lazy"
                            />
                            {getProductImages(p).length > 1 && (
                              <span className="product-image-count">
                                {getProductImages(p).length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="product-image-placeholder">
                            <FiImage />
                          </span>
                        )}
                        <label
                          className={`product-image-upload${imageUploadingId === p._id ? " is-uploading" : ""}${getProductImages(p).length >= 6 ? " is-full" : ""}`}
                          title={
                            getProductImages(p).length >= 6
                              ? "Maximum 6 images reached"
                              : getProductImages(p).length
                                ? "Add more images"
                                : "Upload images"
                          }
                          onDoubleClick={(event) => event.stopPropagation()}
                        >
                          <FiCamera />
                          <span>
                            {imageUploadingId === p._id
                              ? "Uploading"
                              : getProductImages(p).length >= 6
                                ? "Full"
                                : getProductImages(p).length
                                  ? "Add"
                                  : "Upload"}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            disabled={
                              imageUploadingId === p._id ||
                              getProductImages(p).length >= 6
                            }
                            onChange={(event) => uploadProductImage(p, event)}
                          />
                        </label>
                        {getProductImages(p).length > 0 && (
                          <button
                            type="button"
                            className="remove-product-image"
                            title="Remove all images"
                            disabled={imageUploadingId === p._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setImageDeleteTarget({ product: p, image: null });
                            }}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                    <td data-label="Product Code">
                      {p.productCode || p.sku || "—"}
                    </td>
                    <td data-label="Reference Code 1">
                      {p.referenceCode1 || "—"}
                    </td>
                    <td data-label="Product Name">
                      <strong>{p.productName || p.name}</strong>
                    </td>
                    <td data-label="Style">{p.style || "—"}</td>
                    <td data-label="Packing Quantity">
                      {p.packingQuantity || "—"}
                    </td>
                    <td data-label="Carton Quantity">
                      {p.cartonQuantity || "—"}
                    </td>
                    <td data-label="Color">{p.color || "—"}</td>
                    <td data-label="Size">{p.size || "—"}</td>
                    <td data-label="Gender">
                      {normalizeProductGender(p.gender) || "—"}
                    </td>
                    <td data-label="Category Code">
                      {p.categoryCode || p.category || "—"}
                    </td>
                    <td data-label="Sub Category Code">
                      {p.subCategoryCode || "—"}
                    </td>
                    <td data-label="Sub Sub Category">
                      {p.subSubCategory || "—"}
                    </td>
                    <td data-label="Supplier Code">{p.supplierCode || "—"}</td>
                    <td className="price-column" data-label="Cost Price">
                      {formatPrice(p.costPrice)}
                    </td>
                    <td className="price-column" data-label="Selling Price">
                      {formatPrice(p.sellingPrice)}
                    </td>
                    <td data-label="Actions" className="product-actions">
                      <button
                        className="delete-action"
                        title={`Delete ${p.productName || p.name}`}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onClick={() => setDeleteTargets([p._id])}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 && (
              <p className="table-message product-filter-empty">
                No products match “{productFilter}”.
              </p>
            )}
          </>
        ) : (
          <p className="table-message">No products have been added yet.</p>
        )}
      </section>
      {formOpen && (
        <div className="modal-backdrop">
          <section className="user-modal product-modal">
            <div className="modal-title">
              <div>
                <p className="eyebrow">FMJ NEW PLANT</p>
                <h2>{editingProduct ? "Edit Product" : "Add Product"}</h2>
              </div>
              <button className="close-modal" onClick={closeForm}>
                <FiX />
              </button>
            </div>
            <form className="product-form" onSubmit={submit}>
              <div className="product-form-section">
                <span>01</span>
                <div>
                  <strong>Product Information</strong>
                  <small>Codes, classification and supplier details</small>
                </div>
              </div>
              <label>
                Product Code (13 numbers) *
                <input
                  name="productCode"
                  value={form.productCode}
                  onChange={update}
                  inputMode="numeric"
                  pattern="\d{13}"
                  maxLength="13"
                  placeholder="1234567890123"
                  required
                />
              </label>
              <label className="product-name-field">
                Product Name *
                <input
                  name="productName"
                  value={form.productName}
                  onChange={update}
                  pattern="[A-Za-z0-9]+-[0-9]{4}-[A-Za-z0-9]+-[A-Za-z0-9]+"
                  title="Use the format FP03-0205-ASSTD-XL"
                  placeholder="FP03-0205-ASSTD-XL"
                  required
                />
              </label>
              <label>
                Reference Code 1 *
                <input
                  name="referenceCode1"
                  value={form.referenceCode1}
                  readOnly
                  aria-readonly="true"
                  placeholder="Auto-filled from Product Name"
                  required
                />
              </label>
              <div className="product-form-section breakdown-section">
                <span>02</span>
                <div>
                  <strong>Product Name Breakdown</strong>
                  <small>Generated automatically from the product name</small>
                </div>
              </div>
              <label>
                Style *
                <input
                  name="style"
                  value={form.style}
                  readOnly
                  aria-readonly="true"
                  placeholder="Auto-filled"
                  required
                />
              </label>
              <label>
                Packing Quantity *
                <input
                  name="packingQuantity"
                  value={form.packingQuantity}
                  readOnly
                  aria-readonly="true"
                  placeholder="Auto-filled"
                  required
                />
              </label>
              <label>
                Carton Quantity *
                <input
                  name="cartonQuantity"
                  value={form.cartonQuantity}
                  readOnly
                  aria-readonly="true"
                  placeholder="Auto-filled"
                  required
                />
              </label>
              <label>
                Color *
                <input
                  name="color"
                  value={form.color}
                  readOnly
                  aria-readonly="true"
                  placeholder="Auto-filled"
                  required
                />
              </label>
              <label>
                Size *
                <input
                  name="size"
                  value={form.size}
                  readOnly
                  aria-readonly="true"
                  placeholder="Auto-filled"
                  required
                />
              </label>
              <div className="product-form-section classification-section">
                <span>03</span>
                <div>
                  <strong>Product Classification</strong>
                  <small>Gender, category and supplier details</small>
                </div>
              </div>
              <label>
                Gender *
                <select
                  name="gender"
                  value={form.gender}
                  onChange={update}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="MENS">MENS</option>
                  <option value="WOMENS">WOMENS</option>
                  <option value="BOYS">BOYS</option>
                  <option value="GIRLS">GIRLS</option>
                  <option value="UNISEX">UNISEX</option>
                </select>
              </label>
              <label>
                Category Code *
                <input
                  name="categoryCode"
                  value={form.categoryCode}
                  onChange={update}
                  required
                />
              </label>
              <label>
                Sub Category Code *
                <input
                  name="subCategoryCode"
                  value={form.subCategoryCode}
                  onChange={update}
                  required
                />
              </label>
              <label>
                Sub Sub Category <small>(optional)</small>
                <input
                  name="subSubCategory"
                  value={form.subSubCategory}
                  onChange={update}
                />
              </label>
              <label>
                Supplier Code *
                <input
                  name="supplierCode"
                  value={form.supplierCode}
                  onChange={update}
                  required
                />
              </label>
              <div className="product-form-section pricing-section">
                <span>04</span>
                <div>
                  <strong>Pricing Information</strong>
                  <small>Enter all prices in your base currency</small>
                </div>
              </div>
              <label>
                Cost Price *
                <input
                  name="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={update}
                  required
                />
              </label>
              <label>
                Selling Price *
                <input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={update}
                  required
                />
              </label>
              <p className="error">{error}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>
                <button className="confirm-button" disabled={saving}>
                  {saving
                    ? editingProduct
                      ? "Saving..."
                      : "Adding..."
                    : editingProduct
                      ? "Save Changes"
                      : "Add Product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleteTargets.length > 0 && (
        <div className="modal-backdrop">
          <section className="confirm-modal delete-confirm" role="dialog">
            <div className="modal-icon">
              <FiTrash2 />
            </div>
            <p className="eyebrow">DELETE PRODUCTS</p>
            <h2>
              Delete {deleteTargets.length} product
              {deleteTargets.length > 1 ? "s" : ""}?
            </h2>
            <p>
              This permanently removes the selected products from the master
              file.
            </p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setDeleteTargets([])}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                disabled={saving}
                onClick={confirmDelete}
              >
                {saving ? "Deleting..." : "Delete products"}
              </button>
            </div>
          </section>
        </div>
      )}
      {imagePreview && (
        <div
          className="modal-backdrop product-image-preview-backdrop"
          onClick={() => setImagePreview(null)}
        >
          <section
            className="product-image-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${imagePreview.name} product image`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="product-image-preview-header">
              <div>
                <p className="eyebrow">PRODUCT IMAGE</p>
                <h2>{imagePreview.name}</h2>
                <p className="product-gallery-count">
                  Image {imagePreview.index + 1} of {imagePreview.images.length}
                </p>
              </div>
              <button
                type="button"
                className="close-modal"
                aria-label="Close image preview"
                onClick={() => setImagePreview(null)}
              >
                <FiX />
              </button>
            </div>
            <div className="product-image-preview-canvas">
              {imagePreview.images.length > 1 && (
                <button
                  type="button"
                  className="gallery-arrow previous"
                  aria-label="Previous image"
                  onClick={() =>
                    setImagePreview((current) => ({
                      ...current,
                      index:
                        (current.index - 1 + current.images.length) %
                        current.images.length,
                    }))
                  }
                >
                  <FiChevronLeft />
                </button>
              )}
              <img
                src={imagePreview.images[imagePreview.index].url}
                alt={`${imagePreview.name} ${imagePreview.index + 1}`}
              />
              {imagePreview.images.length > 1 && (
                <button
                  type="button"
                  className="gallery-arrow next"
                  aria-label="Next image"
                  onClick={() =>
                    setImagePreview((current) => ({
                      ...current,
                      index: (current.index + 1) % current.images.length,
                    }))
                  }
                >
                  <FiChevronRight />
                </button>
              )}
            </div>
            <div className="product-image-gallery-footer">
              <div className="product-image-thumbnails">
                {imagePreview.images.map((image, index) => (
                  <button
                    type="button"
                    className={index === imagePreview.index ? "active" : ""}
                    key={image._id}
                    aria-label={`View image ${index + 1}`}
                    onClick={() =>
                      setImagePreview((current) => ({ ...current, index }))
                    }
                  >
                    <img src={image.url} alt="" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="remove-current-image"
                onClick={() =>
                  setImageDeleteTarget({
                    product: imagePreview.product,
                    image: imagePreview.images[imagePreview.index],
                  })
                }
              >
                <FiTrash2 /> Remove current
              </button>
            </div>
          </section>
        </div>
      )}
      {imageDeleteTarget && (
        <div className="modal-backdrop">
          <section className="confirm-modal delete-confirm" role="dialog">
            <div className="modal-icon">
              <FiImage />
            </div>
            <p className="eyebrow">REMOVE PRODUCT IMAGE</p>
            <h2>
              {imageDeleteTarget.image
                ? "Remove this image?"
                : "Remove all images?"}
            </h2>
            <p>
              {imageDeleteTarget.image ? "This image" : "All images"} for{" "}
              {imageDeleteTarget.product.productName ||
                imageDeleteTarget.product.name}{" "}
              will be permanently removed from Cloudinary.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                disabled={imageUploadingId === imageDeleteTarget.product._id}
                onClick={() => setImageDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-button"
                disabled={imageUploadingId === imageDeleteTarget.product._id}
                onClick={removeProductImage}
              >
                {imageUploadingId === imageDeleteTarget.product._id
                  ? "Removing..."
                  : imageDeleteTarget.image
                    ? "Remove image"
                    : "Remove all"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function ProductHeaderActions({ user, theme, setTheme, onClose }) {
  return (
    <div className="product-header-actions">
      <button
        type="button"
        className="product-back-button"
        onClick={onClose}
        aria-label="Back to dashboard"
        title="Back to dashboard"
      >
        <FiChevronLeft />
        <span>Dashboard</span>
      </button>
      <ThemeButton theme={theme} setTheme={setTheme} />
      <div className="avatar" title={user.name}>
        {user.name[0]}
      </div>
    </div>
  );
}
function App() {
  const [user, setU] = useState(() =>
      JSON.parse(localStorage.getItem("jockeyUser") || "null"),
    ),
    [theme, setT] = useState(
      () => localStorage.getItem("jockeyTheme") || "light",
    ),
    [inventory, setInventory] = useState(false);
  useEffect(() => {
    let icon = document.querySelector("link[rel='icon']");
    if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.appendChild(icon); }
    icon.href = logoUrl;
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("jockeyTheme", theme);
  }, [theme]);
  useEffect(() => {
    const click = (e) => {
      const link = e.target.closest("a");
      if (!link) return;
      if (link.textContent.trim() === "Inventory") setInventory(true);
      else if (link) setInventory(false);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  const logout = () => {
    window
      .fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      .catch(() => {});
    localStorage.removeItem("jockeyUser");
    localStorage.removeItem("jockeyToken");
    localStorage.removeItem("jockeySessionExpiresAt");
    setU(null);
    setInventory(false);
  };
  useEffect(() => {
    if (!user) return undefined;
    const expiresAt = Number(localStorage.getItem("jockeySessionExpiresAt"));
    if (!expiresAt || expiresAt <= Date.now()) {
      logout();
      return undefined;
    }
    const timer = window.setTimeout(logout, expiresAt - Date.now());
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
    };
  }, [user]);
  return user ? (
    <>
      <Dashboard user={user} onLogout={logout} theme={theme} setTheme={setT} />
      {user.role === "SUPER_ADMIN" && <ProductMaster open={inventory} />}{" "}
      {inventory && (
        <ProductHeaderActions
          user={user}
          theme={theme}
          setTheme={setT}
          onClose={() => setInventory(false)}
        />
      )}
    </>
  ) : (
    <Login onLogin={setU} theme={theme} setTheme={setT} />
  );
}
createRoot(document.querySelector("#app")).render(<App />);
