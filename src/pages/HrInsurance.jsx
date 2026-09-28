import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export const INSURANCE_TYPES = [
  "Accident Insurance",
  "Health Insurance",
  "Life Insurance",
  "Term Insurance",
  "Group Mediclaim",
];

const EMPTY_FORM = {
  user_name: "",
  insurance_type: "Accident Insurance",
  provider: "",
  policy_no: "",
  sum_insured: "",
  premium: "",
  start_date: "",
  renewal_date: "",
  ayushman_no: "",
  notes: "",
};

export function daysUntilRenewal(dateStr) {
  if (!dateStr) return null;
  const raw = String(dateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${raw}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

export function renewalStatus(dateStr) {
  const days = daysUntilRenewal(dateStr);
  if (days == null) return { key: "unknown", label: "No date", days: null };
  if (days < 0) return { key: "expired", label: "Expired", days };
  if (days < 4) return { key: "soon", label: days === 0 ? "Expires today" : `Renew in ${days}d`, days };
  return { key: "active", label: "Active", days };
}

function inr(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function fmtDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function usernameOf(employee) {
  return String(employee?.username || employee?.user_name || "").trim();
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
    shield: <path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6z" />,
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
    alert: (
      <>
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 4.8 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0z" />
      </>
    ),
    pencil: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.3" />
        <path d="M21 3v6h-6" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function HrInsurance({ employees = [], search = "", onChanged }) {
  const [rows, setRows] = useState([]);
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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: loadErr } = await supabase
      .from("hr_insurance")
      .select("*")
      .order("renewal_date", { ascending: true });
    if (loadErr) {
      setRows([]);
      setError("Insurance table is not ready. Run supabase/hr_insurance.sql in the Supabase SQL editor.");
    } else {
      setRows(data || []);
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
      return [row.employee_name, row.user_name, row.provider, row.policy_no, row.insurance_type]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      user_name: row.user_name || "",
      insurance_type: row.insurance_type || "Accident Insurance",
      provider: row.provider || "",
      policy_no: row.policy_no || "",
      sum_insured: row.sum_insured ?? "",
      premium: row.premium ?? "",
      start_date: fmtDate(row.start_date) === "—" ? "" : fmtDate(row.start_date),
      renewal_date: fmtDate(row.renewal_date) === "—" ? "" : fmtDate(row.renewal_date),
      ayushman_no: row.ayushman_no || "",
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const employee = employees.find((item) => usernameOf(item) === form.user_name);
    if (!form.user_name) {
      setError("Select an employee.");
      return;
    }
    if (!form.renewal_date) {
      setError("Renewal date is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      user_name: form.user_name,
      employee_name: employee?.name || form.user_name,
      insurance_type: form.insurance_type,
      provider: form.provider.trim(),
      policy_no: form.policy_no.trim(),
      sum_insured: form.sum_insured === "" ? null : Number(form.sum_insured),
      premium: form.premium === "" ? null : Number(form.premium),
      start_date: form.start_date || null,
      renewal_date: form.renewal_date,
      ayushman_no: form.ayushman_no.trim(),
      notes: form.notes.trim(),
    };
    const query = editing
      ? supabase.from("hr_insurance").update(payload).eq("id", editing.id)
      : supabase.from("hr_insurance").insert(payload);
    const { error: saveErr } = await query;
    setSaving(false);
    if (saveErr) {
      setError(saveErr.message || "Could not save insurance.");
      return;
    }
    setOpen(false);
    showToast(editing ? "Insurance updated" : "Insurance saved");
    await load();
    onChanged?.();
  };

  return (
    <div className="hri">
      <div className="hri-toolbar">
        <div className="hri-title">
          <span className="hri-title-ico">
            <Svg name="shield" size={18} />
          </span>
          <div>
            <h2>Insurance Tracker</h2>
            <p>Policies, renewal dates, and coverage for every employee.</p>
          </div>
        </div>
        <div className="hri-toolbar-actions">
          <span className="hri-date">
            <Svg name="calendar" size={14} />
            {todayLabel}
          </span>
          <button type="button" className="hri-add" onClick={openCreate}>
            <Svg name="plus" size={15} /> Add Insurance
          </button>
        </div>
      </div>

      {error && <div className="hr-data-alert">{error}</div>}

      {loading ? (
        <div className="hr-list-empty">Loading insurance…</div>
      ) : !visible.length ? (
        <div className="hr-list-empty">No insurance records yet.</div>
      ) : (
        <div className="hri-grid">
          {visible.map((row) => {
            const status = renewalStatus(row.renewal_date);
            return (
              <article className={`hri-card is-${status.key}`} key={row.id}>
                <header className="hri-card-head">
                  <div>
                    <strong>{row.insurance_type || "Insurance"}</strong>
                    <span>{row.provider || "Provider not set"}</span>
                  </div>
                  <em className={`hri-badge is-${status.key}`}>
                    {status.key === "expired" ? <Svg name="alert" size={12} /> : <Svg name="check" size={12} />}
                    {status.label}
                  </em>
                </header>
                <dl className="hri-meta">
                  <div><dt>Employee</dt><dd>{row.employee_name || row.user_name || "—"}</dd></div>
                  <div><dt>Policy No.</dt><dd>{row.policy_no || "—"}</dd></div>
                  <div><dt>Sum Insured</dt><dd>{inr(row.sum_insured)}</dd></div>
                  <div><dt>Renewal Date</dt><dd>{fmtDate(row.renewal_date)}</dd></div>
                  <div><dt>Premium / Year</dt><dd>{inr(row.premium)}</dd></div>
                </dl>
                <footer className="hri-card-actions">
                  {status.key === "expired" && (
                    <button type="button" className="hri-renew" onClick={() => openEdit(row)}>
                      <Svg name="refresh" size={13} /> Update Renewal Date
                    </button>
                  )}
                  <button type="button" className="hri-edit" onClick={() => openEdit(row)}>
                    <Svg name="pencil" size={13} /> Edit
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div className="hri-overlay" onClick={() => setOpen(false)} role="presentation">
          <div
            className="hri-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit insurance" : "Add insurance"}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hri-modal-head">
              <div>
                <span className="hri-modal-ico"><Svg name="shield" size={16} /></span>
                <strong>{editing ? "Edit Insurance" : "Add Insurance"}</strong>
              </div>
              <button type="button" className="hri-close" onClick={() => setOpen(false)} aria-label="Close">
                <Svg name="close" size={16} />
              </button>
            </header>
            <div className="hri-form">
              <label>
                Employee *
                <select value={form.user_name} onChange={(event) => setField("user_name", event.target.value)}>
                  <option value="">Select Employee</option>
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
                Insurance Type
                <select value={form.insurance_type} onChange={(event) => setField("insurance_type", event.target.value)}>
                  {INSURANCE_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Provider / Company
                <input value={form.provider} onChange={(event) => setField("provider", event.target.value)} placeholder="e.g. LIC, Star Health, IFCO" />
              </label>
              <label>
                Policy No.
                <input value={form.policy_no} onChange={(event) => setField("policy_no", event.target.value)} />
              </label>
              <label>
                Sum Insured (₹)
                <input type="number" min="0" value={form.sum_insured} onChange={(event) => setField("sum_insured", event.target.value)} />
              </label>
              <label>
                Premium (₹/year)
                <input type="number" min="0" value={form.premium} onChange={(event) => setField("premium", event.target.value)} />
              </label>
              <label>
                Start Date
                <input type="date" value={form.start_date} onChange={(event) => setField("start_date", event.target.value)} />
              </label>
              <label>
                Renewal Date *
                <input type="date" value={form.renewal_date} onChange={(event) => setField("renewal_date", event.target.value)} />
              </label>
              <label className="hri-span">
                Ayushman Card No.
                <input value={form.ayushman_no} onChange={(event) => setField("ayushman_no", event.target.value)} />
              </label>
              <label className="hri-span">
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>
            </div>
            <footer className="hri-modal-foot">
              <button type="button" className="hri-cancel" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="hri-save" disabled={saving} onClick={save}>
                <Svg name="check" size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </footer>
          </div>
        </div>
      )}
      {toast && <div className="hri-toast">{toast}</div>}
    </div>
  );
}
