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
  FiCamera,
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
  FiSun,
  FiTrash2,
  FiUploadCloud,
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
  { header: "Order Price", key: "orderPrice", width: 15 },
  { header: "Average Cost", key: "averageCost", width: 16 },
  { header: "Selling Price", key: "sellingPrice", width: 16 },
  { header: "Wholesale Price", key: "wholesalePrice", width: 18 },
  { header: "Minimum Price", key: "minimumPrice", width: 16 },
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
        const issues = [];
        const productCode = String(row.productCode || "").trim();
        const details = parseProductNameDetails(row.productName);
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
          !allowedProductGenders.includes(normalizeProductGender(row.gender))
        ) {
          issues.push("Invalid Gender.");
        }
        if (
          ["categoryCode", "subCategoryCode", "supplierCode"].some(
            (field) => !String(row[field] || "").trim(),
          )
        ) {
          issues.push("A required classification field is empty.");
        }
        if (
          productPriceFields.some(
            (field) =>
              String(row[field] ?? "").trim() === "" ||
              !Number.isFinite(Number(row[field])) ||
              Number(row[field]) < 0,
          )
        ) {
          issues.push("One or more prices are invalid.");
        }
        return {
          ...row,
          productName: String(row.productName || "").toUpperCase(),
          gender: normalizeProductGender(row.gender),
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
          <h1>FMJ New Plant Inventory</h1>
          <p>All products added here belong to FMJ New Plant.</p>
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
                    <th className="price-column">Order Price</th>
                    <th className="price-column">Average Cost</th>
                    <th className="price-column">Selling Price</th>
                    <th className="price-column">Wholesale Price</th>
                    <th className="price-column">Minimum Price</th>
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
