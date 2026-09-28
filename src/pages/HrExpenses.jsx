import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { uploadHrFile } from "../lib/hrStorage";

const CATEGORIES = [
  "Travel",
  "Food",
  "Fuel",
  "Accommodation",
  "Office Supplies",
  "Medical",
  "Communication",
  "Other",
];

const STATUSES = ["Pending", "Approved", "Rejected", "Reimbursed"];

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const EMPTY_FORM = {
  user_name: "",
  expense_date: todayKey(),
  category: "Travel",
  amount: "",
  status: "Pending",
  description: "",
};

function inr(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

function usernameOf(employee) {
  return String(employee?.username || employee?.user_name || "").trim();
}

function isProofFile(file) {
  if (!file) return false;
  if (file.type === "application/pdf") return true;
  if (file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || /\.(png|jpe?g|webp|gif|bmp|heic)$/.test(name);
}

function StatusPicker({ value, label, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const current = value || "Pending";

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (buttonRef.current?.contains(event.target)) return;
      if (event.target?.closest?.(".hre-status-menu")) return;
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
        className={`hre-status is-${current.toLowerCase()}`}
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
        <div className="hre-status-menu" style={{ top: pos.top, left: pos.left }}>
          {STATUSES.map((item) => (
            <button
              key={item}
              type="button"
              className={`hre-status-opt is-${item.toLowerCase()}${item === current ? " is-current" : ""}`}
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
    money: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9.5c-.5-.7-1.5-1.2-3-1.2-1.7 0-2.8.8-2.8 1.9 0 2.9 5.8 1.1 5.8 4 0 1.2-1.2 2-3 2-1.4 0-2.5-.4-3.1-1.2M12 6.5v11" />
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
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V5M7 10l5-5 5 5" />
        <path d="M5 19h14" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function HrExpenses({ employees = [], search = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [proofFile, setProofFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

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
      .from("hr_expenses")
      .select("*")
      .order("expense_date", { ascending: false });
    if (loadErr) {
      setRows([]);
      setError("Expense table is not ready. Run supabase/hr_expenses.sql in the Supabase SQL editor.");
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
      return [row.employee_name, row.user_name, row.category, row.description, row.status]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, expense_date: todayKey() });
    setProofFile(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setProofFile(null);
    setForm({
      user_name: row.user_name || "",
      expense_date: String(row.expense_date || "").slice(0, 10) || todayKey(),
      category: row.category || "Travel",
      amount: row.amount ?? "",
      status: row.status || "Pending",
      description: row.description || "",
    });
    setOpen(true);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const changeStatus = async (row, status) => {
    if (!row?.id || status === row.status) return;
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status } : item)));
    const { error: updErr } = await supabase.from("hr_expenses").update({ status }).eq("id", row.id);
    if (updErr) {
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: row.status } : item)));
      setError(updErr.message || "Could not update status.");
      return;
    }
    showToast("Status updated");
  };

  const onPickProof = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isProofFile(file)) {
      setError("Proof must be a PDF or an image.");
      return;
    }
    setError("");
    setProofFile(file);
  };

  const save = async () => {
    const employee = employees.find((item) => usernameOf(item) === form.user_name);
    if (!form.user_name) {
      setError("Select an employee.");
      return;
    }
    if (form.amount === "" || Number(form.amount) < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let proofUrl = editing?.proof_url || null;
      let proofName = editing?.proof_name || null;
      if (proofFile) {
        const ext = proofFile.name.split(".").pop() || "bin";
        const path = `hr_expenses/${form.user_name}/${Date.now()}.${ext}`;
        proofUrl = await uploadHrFile(supabase, path, proofFile);
        proofName = proofFile.name;
      }

      const payload = {
        user_name: form.user_name,
        employee_name: employee?.name || form.user_name,
        expense_date: form.expense_date || todayKey(),
        category: form.category,
        amount: Number(form.amount),
        status: form.status,
        description: form.description.trim(),
        proof_url: proofUrl,
        proof_name: proofName,
      };

      const query = editing
        ? supabase.from("hr_expenses").update(payload).eq("id", editing.id)
        : supabase.from("hr_expenses").insert(payload);
      const { error: saveErr } = await query;
      if (saveErr) throw saveErr;

      setOpen(false);
      showToast(editing ? "Expense updated" : "Expense saved");
      await load();
    } catch (err) {
      setError(err.message || "Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hre">
      <div className="hre-toolbar">
        <div className="hre-title">
          <span className="hre-title-ico">
            <Svg name="money" size={18} />
          </span>
          <div>
            <h2>Expense Tracker</h2>
            <p>Record employee expenses and attach a PDF or image as proof.</p>
          </div>
        </div>
        <div className="hre-toolbar-actions">
          <span className="hre-date">
            <Svg name="calendar" size={14} />
            {todayLabel}
          </span>
          <button type="button" className="hre-add" onClick={openCreate}>
            <Svg name="plus" size={15} /> Add Expense
          </button>
        </div>
      </div>

      {error && !open && <div className="hr-data-alert">{error}</div>}

      <section className="hre-card">
        <header className="hre-card-head">
          <div>
            <Svg name="file" size={16} />
            <strong>Expense Records</strong>
          </div>
        </header>
        <div className="hre-table-wrap">
          <table className="hre-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Proof</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>{String(row.expense_date || "").slice(0, 10) || "—"}</td>
                  <td>{row.employee_name || row.user_name || "—"}</td>
                  <td>{row.category || "—"}</td>
                  <td>{inr(row.amount)}</td>
                  <td className="hre-desc" title={row.description || ""}>{row.description || "—"}</td>
                  <td>
                    {row.proof_url ? (
                      <a className="hre-proof" href={row.proof_url} target="_blank" rel="noreferrer">
                        <Svg name="eye" size={13} /> View
                      </a>
                    ) : (
                      <span className="hre-muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusPicker
                      value={row.status || "Pending"}
                      label={`Change status for ${row.employee_name || "expense"}`}
                      onChange={(status) => changeStatus(row, status)}
                    />
                  </td>
                  <td>
                    <button type="button" className="hre-edit" onClick={() => openEdit(row)}>
                      <Svg name="pencil" size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !visible.length && <div className="hr-list-empty">No expense records</div>}
          {loading && <div className="hr-list-empty">Loading expenses…</div>}
        </div>
      </section>

      {open && (
        <div className="hre-overlay" onClick={() => setOpen(false)} role="presentation">
          <div
            className="hre-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit expense" : "Add expense"}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hre-modal-head">
              <div>
                <span className="hre-modal-ico"><Svg name="money" size={16} /></span>
                <strong>{editing ? "Edit Expense" : "Add Expense"}</strong>
              </div>
              <button type="button" className="hre-close" onClick={() => setOpen(false)} aria-label="Close">
                <Svg name="close" size={16} />
              </button>
            </header>
            <div className="hre-form">
              {error && <div className="hr-data-alert hre-span">{error}</div>}
              <label className="hre-span">
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
                Date
                <input type="date" value={form.expense_date} onChange={(event) => setField("expense_date", event.target.value)} />
              </label>
              <label>
                Category
                <select value={form.category} onChange={(event) => setField("category", event.target.value)}>
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Amount (₹) *
                <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField("amount", event.target.value)} placeholder="0.00" />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {STATUSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="hre-span">
                Description
                <textarea rows={3} value={form.description} onChange={(event) => setField("description", event.target.value)} />
              </label>
              <div className="hre-span hre-proof-field">
                <span>Proof document</span>
                <button type="button" className="hre-upload" onClick={() => fileRef.current?.click()}>
                  <Svg name="upload" size={14} />
                  {proofFile ? "Change file" : "Add PDF or image"}
                </button>
                <small>
                  {proofFile
                    ? proofFile.name
                    : editing?.proof_name
                      ? `Current: ${editing.proof_name}`
                      : "PDF or image only"}
                </small>
                {editing?.proof_url && !proofFile && (
                  <a className="hre-proof" href={editing.proof_url} target="_blank" rel="noreferrer">
                    <Svg name="eye" size={13} /> View current proof
                  </a>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  hidden
                  onChange={onPickProof}
                />
              </div>
            </div>
            <footer className="hre-modal-foot">
              <button type="button" className="hre-cancel" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="hre-save" disabled={saving} onClick={save}>
                <Svg name="check" size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </footer>
          </div>
        </div>
      )}
      {toast && <div className="hre-toast">{toast}</div>}
    </div>
  );
}
