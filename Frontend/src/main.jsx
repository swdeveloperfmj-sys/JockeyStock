import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
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
  FiBox,
  FiEdit2,
  FiFileText,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiPlusCircle,
  FiSun,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import "./style.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
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
  async function submit(x) {
    x.preventDefault();
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
      localStorage.setItem("jockeyToken", d.token);
      onLogin(d.user);
    } catch (a) {
      setE(a.message);
    }
  }
  return (
    <main className="login-page">
      <section className="brand-panel">
        <div className="login-theme">
          <ThemeButton theme={theme} setTheme={setTheme} />
        </div>
        <div className="brand">
          JOCKEY<span>®</span>
        </div>
        <p>STOCK MANAGEMENT SYSTEM</p>
        <h1>
          Move stock.
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
          <button>
            Sign in <span>→</span>
          </button>
        </form>
      </section>
    </main>
  );
}
const blank = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  contactNumber: "",
  location: "",
  role: "SALES_REP",
};
function UserModal({ user, onClose, onSaved }) {
  const [f, setF] = useState(
      user ? { ...user, password: "", confirmPassword: "" } : blank,
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
      setR(r);
      setL(l);
    });
  }, []);
  const u = (x) => setF({ ...f, [x.target.name]: x.target.value });
  async function submit(x) {
    x.preventDefault();
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
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>User management</h1>
          <p className="page-description">
            Create and manage access for your Jockey Stock team.
          </p>
        </div>
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
                      {u.role === "SUPER_ADMIN" ? "Super Admin" : "Sales Rep"}
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
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>Locations</h1>
          <p className="page-description">
            Maintain locations and optional arrival pins.
          </p>
        </div>
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
    [error, setE] = useState("");
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
  async function save(x) {
    const name = window.prompt(
      x ? "Edit role" : "New role name",
      x?.name || "",
    );
    if (!name?.trim()) return;
    const r = await fetch(`${API_URL}/roles${x ? `/${x._id}` : ""}`, {
      method: x ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) load();
    else setE((await r.json()).message);
  }
  async function del(x) {
    if (!window.confirm(`Delete ${x.name}?`)) return;
    await fetch(`${API_URL}/roles/${x._id}`, { method: "DELETE" });
    load();
  }
  return (
    <section className="users-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>Roles</h1>
          <p className="page-description">Maintain roles for team members.</p>
        </div>
        <button className="add-user" onClick={() => save()}>
          <FiPlusCircle /> Add role
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="settings-list">
        {items.map((x) => (
          <article key={x._id}>
            <strong>{x.name.replaceAll("_", " ")}</strong>
            <div className="table-actions">
              <button onClick={() => save(x)}>
                <FiEdit2 />
              </button>
              <button className="delete-action" onClick={() => del(x)}>
                <FiTrash2 />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Dashboard({ user, onLogout, theme, setTheme }) {
  const [c, setC] = useState(false),
    [m, setM] = useState(false),
    [confirm, setConfirm] = useState(false),
    [view, setV] = useState("Dashboard"),
    [dashboardData, setDashboardData] = useState(null),
    [dashboardError, setDashboardError] = useState(""),
    admin = user.role === "SUPER_ADMIN";
  const links = admin
    ? [
        [FiBarChart2, "Dashboard"],
        [FiBox, "Inventory"],
        [FiFileText, "Sales"],
        [FiUsers, "Users"],
        [FiBox, "Locations"],
        [FiUsers, "Roles"],
      ]
    : [
        [FiBarChart2, "Dashboard"],
        [FiPlusCircle, "Create Order"],
        [FiFileText, "Sales"],
      ];
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
  const header = (
    <header>
      <div>
        <p className="eyebrow">
          {admin ? "SUPER ADMIN" : "SALES REPRESENTATIVE"}
        </p>
        <h1>
          {["Users", "Locations", "Roles"].includes(view)
            ? `Manage ${view.toLowerCase()}.`
            : `Good morning, ${user.name.split(" ")[0]}.`}
        </h1>
      </div>
      <div className="header-actions">
        <button className="mobile-menu-button" onClick={() => setM(true)}>
          <FiMenu />
        </button>
        <ThemeButton theme={theme} setTheme={setTheme} />
        <div className="avatar">{user.name[0]}</div>
      </div>
    </header>
  );
  const displayedStats = admin ? liveAdminStats : stats;
  const content =
    view === "Users" ? (
      <UsersPage />
    ) : view === "Locations" ? (
      <SettingsPage type="locations" />
    ) : view === "Roles" ? (
      <SettingsPage type="roles" />
    ) : (
      <>
        <section className="stats">
          {displayedStats.map(([l, v]) => (
            <article key={l}>
              <p>{l}</p>
              <strong>{v}</strong>
              <small>Updated just now</small>
            </article>
          ))}
        </section>
        {admin && dashboardError && (
          <p className="dashboard-error">{dashboardError}</p>
        )}
        <section className="activity recent-activity">
          <h2>{admin ? "Recent Product Updates" : "Today’s activity"}</h2>
          {admin ? (
            dashboardData?.recentProducts?.length ? (
              <div className="recent-product-list">
                {dashboardData.recentProducts.map((product) => (
                  <article key={product._id}>
                    <div className="recent-product-main">
                      <span className="recent-sku">
                        {product.productCode || product.sku}
                      </span>
                      <div>
                        <strong>{product.productName || product.name}</strong>
                        <small>
                          {product.categoryCode || product.category}
                        </small>
                      </div>
                    </div>
                    <div className="recent-stock">
                      <strong>{formatNumber(product.openingStock)}</strong>
                      <small>{product.unit}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-dashboard-state">
                No products have been added yet.
              </p>
            )
          ) : (
            <p>Create customer orders and keep track of your sales progress.</p>
          )}
        </section>
      </>
    );
  return (
    <div className="dashboard">
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
      <aside className={`${c ? "collapsed" : ""} ${m ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            JOCKEY<span>®</span>
          </div>
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
                setV(l);
                setM(false);
              }}
            >
              <I />
              <span>{l}</span>
            </a>
          ))}
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
  orderPrice: "",
  averageCost: "",
  sellingPrice: "",
  wholesalePrice: "",
  minimumPrice: "",
});
const productPriceFields = [
  "costPrice",
  "orderPrice",
  "averageCost",
  "sellingPrice",
  "wholesalePrice",
  "minimumPrice",
];
function ProductMaster({ open }) {
  const [products, setProducts] = useState([]),
    [formOpen, setFormOpen] = useState(false),
    [editingProduct, setEditingProduct] = useState(null),
    [selected, setSelected] = useState([]),
    [deleteTargets, setDeleteTargets] = useState([]),
    [form, setForm] = useState(createEmptyProduct),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
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
      gender: product.gender || "",
      categoryCode: product.categoryCode || product.category || "",
      subCategoryCode: product.subCategoryCode || "",
      subSubCategory: product.subSubCategory || "",
      supplierCode: product.supplierCode || "JOCKEY",
      costPrice: product.costPrice ?? "",
      orderPrice: product.orderPrice ?? "",
      averageCost: product.averageCost ?? "",
      sellingPrice: product.sellingPrice ?? "",
      wholesalePrice: product.wholesalePrice ?? "",
      minimumPrice: product.minimumPrice ?? "",
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
  const toggleAll = () =>
    setSelected((current) =>
      current.length === products.length ? [] : products.map((p) => p._id),
    );
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
          <h1>FMJ New Plant Inventory</h1>
          <p>All products added here belong to FMJ New Plant.</p>
        </div>
        <button className="add-product-button" onClick={openAdd}>
          <FiPlusCircle /> Add Product
        </button>
      </div>
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
            <span>{products.length} items</span>
          </div>
        </div>
        {products.length ? (
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th className="select-column">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      checked={
                        products.length > 0 &&
                        selected.length === products.length
                      }
                      onChange={toggleAll}
                    />
                  </th>
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
                  <th className="price-column">Order Price</th>
                  <th className="price-column">Average Cost</th>
                  <th className="price-column">Selling Price</th>
                  <th className="price-column">Wholesale Price</th>
                  <th className="price-column">Minimum Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
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
                    <td data-label="Gender">{p.gender || "—"}</td>
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
                    <td className="price-column" data-label="Order Price">
                      {formatPrice(p.orderPrice)}
                    </td>
                    <td className="price-column" data-label="Average Cost">
                      {formatPrice(p.averageCost)}
                    </td>
                    <td className="price-column" data-label="Selling Price">
                      {formatPrice(p.sellingPrice)}
                    </td>
                    <td className="price-column" data-label="Wholesale Price">
                      {formatPrice(p.wholesalePrice)}
                    </td>
                    <td className="price-column" data-label="Minimum Price">
                      {formatPrice(p.minimumPrice)}
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
                  <option value="MEN">Mens</option>
                  <option value="WOMEN">Womens</option>
                  <option value="BOYS">Boys</option>
                  <option value="GIRLS">Girls</option>
                  <option value="UNISEX">Unisex</option>
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
                Order Price *
                <input
                  name="orderPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.orderPrice}
                  onChange={update}
                  required
                />
              </label>
              <label>
                Average Cost *
                <input
                  name="averageCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.averageCost}
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
              <label>
                Wholesale Price *
                <input
                  name="wholesalePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.wholesalePrice}
                  onChange={update}
                  required
                />
              </label>
              <label>
                Minimum Price *
                <input
                  name="minimumPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumPrice}
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
    </div>
  );
}
function ProductHeaderActions({ user, theme, setTheme }) {
  return (
    <div className="product-header-actions">
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
    localStorage.clear();
    setU(null);
    setInventory(false);
  };
  return user ? (
    <>
      <Dashboard user={user} onLogout={logout} theme={theme} setTheme={setT} />
      {user.role === "SUPER_ADMIN" && <ProductMaster open={inventory} />}{" "}
      {inventory && (
        <ProductHeaderActions user={user} theme={theme} setTheme={setT} />
      )}
    </>
  ) : (
    <Login onLogin={setU} theme={theme} setTheme={setT} />
  );
}
createRoot(document.querySelector("#app")).render(<App />);
