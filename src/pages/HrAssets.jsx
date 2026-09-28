import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";

const TYPE_STORE = "hr_asset_types";
const BASE_TYPES = ["Laptop", "Desktop", "Mobile", "Monitor", "Printer", "Furniture", "Vehicle"];
const CONDITIONS = ["New", "Good", "Fair", "Poor"];
const STATUSES = ["Assigned", "Available", "Under Repair", "Retired"];

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const EMPTY_FORM = {
  asset_name: "",
  asset_type: "Laptop",
  custom_type: "",
  serial_no: "",
  user_name: "",
  assign_date: "",
  condition: "New",
  purchase_value: "0",
  status: "Assigned",
  notes: "",
};

function inr(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function usernameOf(employee) {
  return String(employee?.username || employee?.user_name || "").trim();
}

function statusClass(status) {
  return String(status || "available").toLowerCase().replace(/\s+/g, "-");
}

function StatusPicker({ value, label, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const current = value || "Available";

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (buttonRef.current?.contains(event.target)) return;
      if (event.target?.closest?.(".hra-status-menu")) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`hra-status is-${statusClass(current)}`}
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen((prev) => !prev);
        }}
      >
        {current}
      </button>
      {open && (
        <div className="hra-status-menu" style={{ top: pos.top, left: pos.left }}>
          {STATUSES.map((item) => (
            <button
              key={item}
              type="button"
              className={`hra-status-opt is-${statusClass(item)}${item === current ? " is-current" : ""}`}
              onClick={() => {
                setOpen(false);
                onChange(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Svg({ name, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const paths = {
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    check: <path d="m5 12 5 5L20 7" />,
    pencil: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    box: (
      <>
        <path d="M21 8 12 3 3 8l9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function HrAssets({ employees = [], search = "" }) {
  const [rows, setRows] = useState([]);
  const [customTypes, setCustomTypes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TYPE_STORE) || "[]");
      return Array.isArray(saved) ? saved.filter((type) => typeof type === "string" && type.trim()) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const typeOptions = useMemo(() => {
    const extras = customTypes.filter(
      (type) => type && type.toLowerCase() !== "other" && !BASE_TYPES.some((base) => base.toLowerCase() === type.toLowerCase()),
    );
    return [...BASE_TYPES, ...extras, "Other"];
  }, [customTypes]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: loadErr } = await supabase
      .from("hr_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (loadErr) {
      setRows([]);
      setError("Asset table is not ready. Run supabase/hr_assets.sql in the Supabase SQL editor.");
    } else {
      const list = data || [];
      setRows(list);
      const savedTypes = list
        .map((row) => String(row.asset_type || "").trim())
        .filter((type) => type && !BASE_TYPES.some((base) => base.toLowerCase() === type.toLowerCase()));
      setCustomTypes((prev) => [...new Set([...prev, ...savedTypes])]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!q) return true;
      return [row.asset_name, row.asset_type, row.serial_no, row.employee_name, row.status, row.condition]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const rememberType = (type) => {
    const name = type.trim();
    if (!name || BASE_TYPES.some((base) => base.toLowerCase() === name.toLowerCase())) return name;
    setCustomTypes((prev) => {
      if (prev.some((item) => item.toLowerCase() === name.toLowerCase())) return prev;
      const next = [...prev, name];
      localStorage.setItem(TYPE_STORE, JSON.stringify(next));
      return next;
    });
    return name;
  };

  const addCustomType = () => {
    const name = form.custom_type.trim();
    if (!name) {
      setError("Enter a name for the new asset type.");
      return;
    }
    setError("");
    rememberType(name);
    setForm((prev) => ({ ...prev, asset_type: name, custom_type: "" }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, assign_date: todayKey() });
    setOpen(true);
  };

  const openEdit = (row) => {
    const type = row.asset_type || "Laptop";
    const known = BASE_TYPES.some((base) => base.toLowerCase() === type.toLowerCase()) || customTypes.some((item) => item.toLowerCase() === type.toLowerCase());
    setEditing(row);
    setForm({
      asset_name: row.asset_name || "",
      asset_type: known ? type : "Other",
      custom_type: known ? "" : type,
      serial_no: row.serial_no || "",
      user_name: row.user_name || "",
      assign_date: String(row.assign_date || "").slice(0, 10),
      condition: CONDITIONS.includes(row.condition) ? row.condition : "New",
      purchase_value: row.purchase_value ?? "",
      status: STATUSES.includes(row.status) ? row.status : "Available",
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const changeStatus = async (row, status) => {
    if (!row?.id || status === row.status) return;
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status } : item)));
    const { error: updErr } = await supabase.from("hr_assets").update({ status }).eq("id", row.id);
    if (updErr) {
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: row.status } : item)));
      setError(updErr.message || "Could not update status.");
      return;
    }
    showToast("Status updated");
  };

  const resolvedType = () => {
    if (form.asset_type !== "Other") return form.asset_type.trim();
    return form.custom_type.trim();
  };

  const save = async () => {
    if (!form.asset_name.trim()) {
      setError("Asset name is required.");
      return;
    }
    const assetType = resolvedType();
    if (!assetType) {
      setError("Enter the other asset type.");
      return;
    }
    const employee = employees.find((item) => usernameOf(item) === form.user_name);
    setSaving(true);
    setError("");
    rememberType(assetType);
    const payload = {
      asset_name: form.asset_name.trim(),
      asset_type: assetType,
      serial_no: form.serial_no.trim(),
      user_name: form.user_name || null,
      employee_name: employee?.name || (form.user_name ? form.user_name : "Unassigned"),
      assign_date: form.assign_date || null,
      condition: form.condition,
      purchase_value: form.purchase_value === "" ? null : Number(form.purchase_value),
      status: form.status,
      notes: form.notes.trim(),
    };
    const query = editing
      ? supabase.from("hr_assets").update(payload).eq("id", editing.id)
      : supabase.from("hr_assets").insert(payload);
    const { error: saveErr } = await query;
    setSaving(false);
    if (saveErr) {
      setError(saveErr.message || "Could not save asset.");
      return;
    }
    setOpen(false);
    showToast(editing ? "Asset updated" : "Asset saved");
    await load();
  };

  return (
    <div className="hra">
      <div className="hra-toolbar">
        <div className="hra-title">
          <span className="hra-title-ico">
            <Svg name="briefcase" size={18} />
          </span>
          <div>
            <h2>Asset Management</h2>
            <p>Track company assets, assignment, and condition.</p>
          </div>
        </div>
        <div className="hra-toolbar-actions">
          <span className="hra-date">
            <Svg name="calendar" size={14} />
            {todayLabel}
          </span>
          <button type="button" className="hra-add" onClick={openCreate}>
            <Svg name="plus" size={15} /> Add Asset
          </button>
        </div>
      </div>

      {error && !open && <div className="hr-data-alert">{error}</div>}

      <section className="hra-card">
        <header className="hra-card-head">
          <div>
            <Svg name="box" size={16} />
            <strong>Asset Management</strong>
          </div>
        </header>
        <div className="hra-table-wrap">
          <table className="hra-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Serial No.</th>
                <th>Assigned To</th>
                <th>Date</th>
                <th>Condition</th>
                <th>Value</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>{row.asset_name || "—"}</td>
                  <td>{row.asset_type || "—"}</td>
                  <td>{row.serial_no || "—"}</td>
                  <td>{row.employee_name || "Unassigned"}</td>
                  <td>{String(row.assign_date || "").slice(0, 10) || "—"}</td>
                  <td>{row.condition || "—"}</td>
                  <td>{inr(row.purchase_value)}</td>
                  <td>
                    <StatusPicker
                      value={row.status || "Available"}
                      label={`Change status for ${row.asset_name || "asset"}`}
                      onChange={(status) => changeStatus(row, status)}
                    />
                  </td>
                  <td>
                    <button type="button" className="hra-edit" onClick={() => openEdit(row)}>
                      <Svg name="pencil" size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !visible.length && <div className="hr-list-empty">No assets</div>}
          {loading && <div className="hr-list-empty">Loading assets…</div>}
        </div>
      </section>

      {open && (
        <div className="hra-overlay" onClick={() => setOpen(false)} role="presentation">
          <div
            className="hra-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit asset" : "Add asset"}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hra-modal-head">
              <div>
                <span className="hra-modal-ico"><Svg name="box" size={16} /></span>
                <strong>{editing ? "Edit Asset" : "Add Asset"}</strong>
              </div>
              <button type="button" className="hra-close" onClick={() => setOpen(false)} aria-label="Close">
                <Svg name="close" size={16} />
              </button>
            </header>
            <div className="hra-form">
              {error && <div className="hr-data-alert hra-span">{error}</div>}
              <label>
                Asset Name *
                <input value={form.asset_name} onChange={(event) => setField("asset_name", event.target.value)} />
              </label>
              <label>
                Asset Type
                <select value={typeOptions.includes(form.asset_type) ? form.asset_type : "Other"} onChange={(event) => setField("asset_type", event.target.value)}>
                  {typeOptions.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              {form.asset_type === "Other" && (
                <div className="hra-span hra-other">
                  <label>
                    Other type
                    <input
                      value={form.custom_type}
                      onChange={(event) => setField("custom_type", event.target.value)}
                      placeholder="Type a new asset name"
                    />
                  </label>
                  <button type="button" className="hra-type-add" onClick={addCustomType}>
                    <Svg name="plus" size={14} /> Add
                  </button>
                </div>
              )}
              <label>
                Serial / ID No.
                <input value={form.serial_no} onChange={(event) => setField("serial_no", event.target.value)} />
              </label>
              <label>
                Assigned To
                <select value={form.user_name} onChange={(event) => setField("user_name", event.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.map((employee) => {
                    const username = usernameOf(employee);
                    if (!username) return null;
                    return (
                      <option key={username} value={username}>
                        {employee.name || username}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                Assign Date
                <input type="date" value={form.assign_date} onChange={(event) => setField("assign_date", event.target.value)} />
              </label>
              <label>
                Condition
                <select value={form.condition} onChange={(event) => setField("condition", event.target.value)}>
                  {CONDITIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Purchase Value (₹)
                <input type="number" min="0" value={form.purchase_value} onChange={(event) => setField("purchase_value", event.target.value)} />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {STATUSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="hra-span">
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>
            </div>
            <footer className="hra-modal-foot">
              <button type="button" className="hra-cancel" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="hra-save" disabled={saving} onClick={save}>
                <Svg name="check" size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </footer>
          </div>
        </div>
      )}
      {toast && <div className="hra-toast">{toast}</div>}
    </div>
  );
}
