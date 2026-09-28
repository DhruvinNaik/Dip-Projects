import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { replaceEmployeeDocument } from "../lib/hrStorage";

const DOC_TYPES = [
  { key: "photo", label: "Photo", tone: "amber", icon: "user" },
  { key: "aadhar", label: "Aadhar Card", tone: "amber", icon: "id" },
  { key: "pan", label: "PAN Card", tone: "violet", icon: "card" },
  { key: "bank_passbook", label: "Bank Passbook", tone: "amber", icon: "bank" },
  { key: "appointment_letter", label: "Appointment Letter", tone: "amber", icon: "file" },
  { key: "medical_certificate", label: "Medical Certificate", tone: "amber", icon: "heart" },
  { key: "exp_certificate", label: "Exp Certificate", tone: "violet", icon: "award" },
  { key: "prev_exp_certificate", label: "Prev Exp Certificate", tone: "amber", icon: "award" },
  { key: "ayushman_card", label: "Ayushman Card", tone: "amber", icon: "shield" },
  { key: "other_docs", label: "Other Document", tone: "amber", icon: "folder" },
  { key: "education_docs", label: "Education Documents", tone: "violet", icon: "book" },
];

function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value != null && String(value).trim() !== "") return value;
  }
  return "";
}

function usernameOf(employee) {
  return String(pick(employee, "username", "user_name") || "").trim();
}

function roleCode(employee) {
  const raw = String(
    pick(employee, "designation", "role", "department") || "EMP",
  ).toLowerCase();
  if (raw.includes("site")) return "SITE";
  if (raw.includes("admin")) return "ADM";
  if (raw.includes("account")) return "ACC";
  if (raw.includes("hr")) return "HR";
  if (raw.includes("mdo") || raw.includes("office")) return "OFF";
  return raw.slice(0, 4).toUpperCase() || "EMP";
}

function docKeyOf(row) {
  const raw = String(row.doc_type || row.type || row.category || row.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const match = DOC_TYPES.find(
    (doc) =>
      doc.key === raw ||
      doc.label.toLowerCase() === String(row.doc_type || row.type || row.name || "").toLowerCase(),
  );
  return match?.key || "";
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
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    user: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.2-3 3.2-4.5 7-4.5s5.8 1.5 7 4.5" />
      </>
    ),
    id: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="12" r="2" />
        <path d="M14 10h4M14 14h3" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    bank: (
      <>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v7M10 10v7M14 10v7M19 10v7M3 17h18M4 20h16" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    heart: (
      <>
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
        <path d="M9 12h2l1-2 1.5 4L15 12h1" />
      </>
    ),
    award: (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="m8.5 13.5-1.5 6 5-2.5 5 2.5-1.5-6" />
      </>
    ),
    shield: <path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6z" />,
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V5M7 10l5-5 5 5" />
        <path d="M5 19h14" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function HrDocuments({ employees = [], search = "", onAddEmployee }) {
  const [docsByUser, setDocsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [uploading, setUploading] = useState("");
  const [toast, setToast] = useState("");
  const fileRefs = useRef({});

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: docErr } = await supabase
        .from("hr_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (docErr) {
        setDocsByUser({});
        setError("The hr_documents table is missing. Run supabase/hr_documents.sql in the Supabase SQL editor, then upload again.");
        setLoading(false);
        return;
      }
      const grouped = {};
      (data || []).forEach((row) => {
        const user = String(row.user_name || row.username || "").trim();
        const key = docKeyOf(row);
        const url = pick(row, "file_url", "url", "public_url", "document_url");
        if (!user || !key || !url || grouped[user]?.[key]) return;
        if (!grouped[user]) grouped[user] = {};
        grouped[user][key] = {
          id: row.id,
          url,
          file_name: pick(row, "file_name", "name", "title") || key,
        };
      });
      setDocsByUser(grouped);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (employees || [])
      .map((employee) => {
        const username = usernameOf(employee);
        const name = pick(employee, "name", "full_name") || username || "Unnamed employee";
        const docs = docsByUser[username] || {};
        const submitted = DOC_TYPES.filter((doc) => docs[doc.key]).length;
        return { employee, username, name, docs, submitted };
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.username.toLowerCase().includes(q) ||
          roleCode(row.employee).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, docsByUser, search]);

  const toggleEmployee = (username) => {
    if (!username) return;
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const handleUpload = async (employee, doc, file) => {
    const username = usernameOf(employee);
    const name = pick(employee, "name", "full_name") || username;
    if (!file || !username) return;
    const busyKey = `${username}:${doc.key}`;
    setUploading(busyKey);
    setError("");
    try {
      const saved = await replaceEmployeeDocument(supabase, {
        username,
        employeeName: name,
        docKey: doc.key,
        docLabel: doc.label,
        file,
      });
      setDocsByUser((prev) => ({
        ...prev,
        [username]: {
          ...(prev[username] || {}),
          [doc.key]: saved,
        },
      }));
      showToast(`${doc.label} saved`);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading("");
    }
  };

  return (
    <div className="hrd">
      <div className="hrd-toolbar">
        <div className="hrd-title">
          <span className="hrd-title-ico">
            <Svg name="folder" size={18} />
          </span>
          <div>
            <h2>Documents Checklist & Upload</h2>
            <p>Manage employee files, previews, and missing documents.</p>
          </div>
        </div>
        <div className="hrd-toolbar-actions">
          <span className="hrd-date">
            <Svg name="calendar" size={14} />
            {todayLabel}
          </span>
          <button type="button" className="hrd-add" onClick={onAddEmployee}>
            <Svg name="plus" size={15} /> Add Employee
          </button>
        </div>
      </div>

      {error && <div className="hr-data-alert">{error}</div>}

      <div className="hrd-list">
        {loading && <div className="hr-list-empty">Loading documents…</div>}
        {!loading && !rows.length && (
          <div className="hr-list-empty">No employees match this search.</div>
        )}
        {rows.map((row) => {
          const rowId = row.username || row.name;
          const open = openKeys.has(rowId);
          const complete = row.submitted === DOC_TYPES.length;
          return (
            <article className={`hrd-emp${open ? " open" : ""}`} key={rowId}>
              <button
                type="button"
                className="hrd-emp-head"
                onClick={() => toggleEmployee(rowId)}
                aria-expanded={open}
              >
                <span className="hrd-emp-ico">
                  <Svg name="user" size={16} />
                </span>
                <strong>{row.name.toUpperCase()}</strong>
                <span className="hrd-role">{roleCode(row.employee)}</span>
                <span className={`hrd-count${complete ? " is-done" : ""}`}>
                  {row.submitted}/{DOC_TYPES.length} docs
                </span>
                <span className={`hrd-chevron${open ? " open" : ""}`}>
                  <Svg name="chevron" size={16} />
                </span>
              </button>
              {open && (
                <div className="hrd-grid">
                  {DOC_TYPES.map((doc) => {
                    const file = row.docs[doc.key];
                    const busy = uploading === `${row.username}:${doc.key}`;
                    const inputKey = `${row.username}:${doc.key}`;
                    return (
                      <div className={`hrd-card tone-${doc.tone}${file ? " has-file" : ""}`} key={doc.key}>
                        <div className="hrd-card-top">
                          <span className="hrd-card-ico">
                            <Svg name={doc.icon} size={16} />
                          </span>
                          <strong>{doc.label}</strong>
                        </div>
                        {file ? (
                          <a className="hrd-view" href={file.url} target="_blank" rel="noreferrer">
                            <Svg name="eye" size={13} /> View
                          </a>
                        ) : (
                          <span className="hrd-pending">Pending</span>
                        )}
                        <button
                          type="button"
                          className="hrd-upload"
                          disabled={busy || !row.username}
                          onClick={() => fileRefs.current[inputKey]?.click()}
                        >
                          <Svg name="upload" size={13} />
                          {busy ? "Uploading…" : "Upload"}
                        </button>
                        <input
                          ref={(el) => {
                            fileRefs.current[inputKey] = el;
                          }}
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          hidden
                          onChange={(event) => {
                            const next = event.target.files?.[0];
                            event.target.value = "";
                            if (next) handleUpload(row.employee, doc, next);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {toast && <div className="hrd-toast">{toast}</div>}
    </div>
  );
}
