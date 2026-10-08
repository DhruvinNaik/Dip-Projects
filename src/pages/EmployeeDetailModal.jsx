import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { replaceEmployeeDocument } from "../lib/hrStorage";
import { HrBirthdayCardPopup } from "./HrBirthdays";

const DOC_TYPES = [
  { key: "photo", label: "Photo" },
  { key: "aadhar", label: "Aadhar Card" },
  { key: "pan", label: "Pan Card" },
  { key: "bank_passbook", label: "Bank Passbook" },
  { key: "appointment_letter", label: "Appointment Letter" },
  { key: "medical_certificate", label: "Medical Certificate" },
  { key: "exp_certificate", label: "Exp Certificate" },
  { key: "prev_exp_certificate", label: "Prev Exp Certificate" },
  { key: "ayushman_card", label: "Ayushman Card" },
  { key: "other_docs", label: "Other Docs" },
  { key: "education_docs", label: "Education Docs" },
];

const TABS = [
  { key: "info", label: "Info" },
  { key: "attendance", label: "Attendance" },
  { key: "leaves", label: "Leaves" },
  { key: "documents", label: "Documents" },
];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value != null && String(value).trim() !== "") return value;
  }
  return null;
}

function display(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function formatDate(value) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}-${m}-${y}`;
  }
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function statusForDay(record) {
  if (!record?.clock_in) return "A";
  if (String(record.clock_in_status || "").toLowerCase() === "late") return "L";
  return "P";
}

function getMonthDays(year, month) {
  const total = new Date(year, month, 0).getDate();
  return Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month - 1, day);
    return {
      key: localDateKey(date),
      day,
      weekday: DAY_ABBR[date.getDay()],
      isWeekend: date.getDay() === 0,
    };
  });
}

function countLeaveDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (from > to) return 0;
  return Math.floor((to - from) / 86400000) + 1;
}

function getFiscalYearStart(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 3 ? year : year - 1;
}

function SvgIcon({ name, size = 16 }) {
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
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 4-6 8-6s6.5 2 8 6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    leave: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 14h8M8 18h5" />
      </>
    ),
    folder: (
      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
    gift: (
      <>
        <rect x="3" y="9" width="18" height="12" rx="2" />
        <path d="M12 9v12M3 13h18M12 9H8.5a2.5 2.5 0 1 1 2.5-2.5V9ZM12 9h3.5a2.5 2.5 0 1 0-2.5-2.5V9Z" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h6" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.3" />
        <path d="M21 3v6h-6" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    xcircle: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    pencil: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const DEPARTMENTS = [
  "Admin",
  "Site Engineer",
  "Project Head",
  "Engineer Office",
  "MDO Office",
  "HR",
  "Client",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EMP_TYPES = ["Permanent", "Contract", "Intern", "Probation", "Consultant"];

const INFO_FIELDS = [
  { key: "name", label: "Full Name", store: "user", column: "name" },
  { key: "emp_id", label: "Emp ID", store: "profile", column: "emp_id", fallback: ["employee_id", "employee_code", "id"] },
  { key: "department", label: "Department", store: "user", column: "department", type: "department" },
  { key: "designation", label: "Designation", store: "profile", column: "designation", fallback: ["role"] },
  { key: "phone", label: "Phone", store: "profile", column: "phone", fallback: ["mobile", "contact", "phone_number"] },
  { key: "email", label: "Email", store: "profile", column: "email", fallback: ["mail"] },
  { key: "dob", label: "DOB", store: "profile", column: "dob", type: "date", fallback: ["date_of_birth", "birth_date"] },
  { key: "joining_date", label: "Joining Date", store: "profile", column: "joining_date", type: "date", fallback: ["join_date", "date_of_joining", "created_at"] },
  { key: "company", label: "Company", store: "profile", column: "company", fallback: ["company_name", "organization"] },
  { key: "emp_type", label: "Emp Type", store: "profile", column: "emp_type", type: "emp_type", fallback: ["employment_type", "employee_type"] },
  { key: "salary", label: "Salary", store: "profile", column: "salary", fallback: ["basic_salary", "ctc"] },
  { key: "increment", label: "Increment", store: "profile", column: "increment", fallback: ["last_increment"] },
  { key: "manager", label: "Manager", store: "profile", column: "manager", fallback: ["reporting_head", "reporting_manager", "head"] },
  { key: "blood_group", label: "Blood Group", store: "profile", column: "blood_group", type: "blood", fallback: ["blood"] },
  { key: "emergency", label: "Emergency", store: "profile", column: "emergency", fallback: ["emergency_contact", "emergency_phone"] },
  { key: "pf_no", label: "PF No", store: "profile", column: "pf_no", fallback: ["pf_number", "uan", "pf"] },
  { key: "esic_no", label: "ESIC No", store: "profile", column: "esic_no", fallback: ["esic_number", "esic"] },
  { key: "bank", label: "Bank", store: "profile", column: "bank", fallback: ["bank_name"] },
  { key: "ifsc", label: "IFSC", store: "profile", column: "ifsc", fallback: ["ifsc_code", "bank_ifsc"] },
  { key: "acc_no", label: "Acc No", store: "profile", column: "acc_no", fallback: ["account_no", "account_number", "bank_account"] },
];

function rawFieldValue(field, record, profile) {
  if (field.store === "user") return pick(record, field.column);
  const stored = pick(profile, field.column);
  if (stored != null) return stored;
  return pick(record, field.column, ...(field.fallback || []));
}

function toDateInput(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export default function EmployeeDetailModal({ employee, onClose, onUpdated }) {
  const [tab, setTab] = useState("info");
  const [attYear, setAttYear] = useState(() => new Date().getFullYear());
  const [attMonth, setAttMonth] = useState(() => new Date().getMonth() + 1);
  const [attDays, setAttDays] = useState({});
  const [attCounts, setAttCounts] = useState({ present: 0, late: 0, absent: 0 });
  const [attLoading, setAttLoading] = useState(false);
  const [leaveUsed, setLeaveUsed] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState(60);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [docs, setDocs] = useState({});
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const [toast, setToast] = useState("");
  const [record, setRecord] = useState(employee);
  const [profile, setProfile] = useState(null);
  const [editingKey, setEditingKey] = useState("");
  const [draft, setDraft] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [showBdayCard, setShowBdayCard] = useState(false);
  const fileRefs = useRef({});

  const username = pick(record, "username", "user_name") || "";
  const fullName = pick(record, "name", "full_name") || username || "Employee";

  useEffect(() => {
    setRecord(employee);
  }, [employee]);

  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("hr_employee_profiles")
        .select("*")
        .eq("user_name", username)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setProfile(null);
        return;
      }
      setProfile(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const infoFields = useMemo(
    () => INFO_FIELDS.map((field) => {
      let raw = rawFieldValue(field, record, profile);
      if (field.key === "emp_id" && /^[0-9a-f]{8}-/i.test(String(raw || ""))) raw = null;
      return {
        ...field,
        raw,
        value: field.type === "date" ? formatDate(raw) : raw,
      };
    }),
    [record, profile],
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    async function loadAttendance() {
      setAttLoading(true);
      const days = getMonthDays(attYear, attMonth);
      const from = days[0]?.key;
      const to = days[days.length - 1]?.key;
      const { data, error } = await supabase
        .from("attendance")
        .select("date, clock_in, clock_out, clock_in_status")
        .eq("user_name", username)
        .gte("date", from)
        .lte("date", to);

      if (cancelled) return;
      if (error) {
        setAttDays({});
        setAttCounts({ present: 0, late: 0, absent: days.length });
        setAttLoading(false);
        return;
      }

      const map = {};
      (data || []).forEach((row) => {
        if (!row.date) return;
        map[row.date] = statusForDay(row);
      });

      let present = 0;
      let late = 0;
      let absent = 0;
      days.forEach((day) => {
        const status = map[day.key] || "A";
        if (status === "P") present += 1;
        else if (status === "L") late += 1;
        else absent += 1;
      });

      setAttDays(map);
      setAttCounts({ present, late, absent });
      setAttLoading(false);
    }

    loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [username, attYear, attMonth]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    async function loadLeaves() {
      setLeaveLoading(true);
      const fyStart = getFiscalYearStart();
      const from = `${fyStart}-04-01`;
      const to = `${fyStart + 1}-03-31`;
      const { data, error } = await supabase
        .from("leaves")
        .select("from_date, to_date, status")
        .eq("user_name", username)
        .gte("to_date", from)
        .lte("from_date", to);

      if (cancelled) return;
      if (error) {
        setLeaveUsed(0);
        setLeaveBalance(60);
        setLeaveLoading(false);
        return;
      }

      const used = (data || [])
        .filter((row) => String(row.status || "").trim().toLowerCase() === "approved")
        .reduce((sum, row) => {
          const start = row.from_date < from ? from : row.from_date;
          const end = row.to_date > to ? to : row.to_date;
          return sum + countLeaveDays(start, end);
        }, 0);

      setLeaveUsed(used);
      setLeaveBalance(Math.max(0, 60 - used));
      setLeaveLoading(false);
    }

    loadLeaves();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    async function loadDocs() {
      setDocsLoading(true);
      setDocsError("");
      const { data, error } = await supabase
        .from("hr_documents")
        .select("*")
        .eq("user_name", username)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Fallback: try URL fields on employee row
        const mapped = {};
        DOC_TYPES.forEach((doc) => {
          const url = pick(
            employee,
            `${doc.key}_url`,
            `${doc.key}_file`,
            doc.key,
          );
          if (url && String(url).startsWith("http")) {
            mapped[doc.key] = { url, file_name: doc.label, source: "profile" };
          }
        });
        setDocs(mapped);
        if (!Object.keys(mapped).length) {
          setDocsError("Documents table not connected yet. Uploads will be saved when available.");
        }
        setDocsLoading(false);
        return;
      }

      const mapped = {};
      (data || []).forEach((row) => {
        const typeKey = String(row.doc_type || row.type || row.category || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        const match = DOC_TYPES.find(
          (d) =>
            d.key === typeKey ||
            d.label.toLowerCase() === String(row.doc_type || row.type || row.name || "").toLowerCase(),
        );
        const key = match?.key;
        if (!key || mapped[key]) return;
        const url = pick(row, "file_url", "url", "public_url", "document_url", "file");
        if (!url) return;
        mapped[key] = {
          id: row.id,
          url,
          file_name: pick(row, "file_name", "name", "title") || match.label,
          source: "documents",
        };
      });
      setDocs(mapped);
      setDocsLoading(false);
    }

    loadDocs();
    return () => {
      cancelled = true;
    };
  }, [username, fullName, employee]);

  const monthDays = useMemo(() => getMonthDays(attYear, attMonth), [attYear, attMonth]);
  const firstWeekday = useMemo(() => {
    const first = new Date(attYear, attMonth - 1, 1);
    return first.getDay();
  }, [attYear, attMonth]);

  const startEdit = (field) => {
    setEditingKey(field.key);
    setDraft(field.type === "date" ? toDateInput(field.raw) : (field.raw == null ? "" : String(field.raw)));
  };

  const saveField = async (field) => {
    if (!username) return;
    const value = String(draft ?? "").trim();
    const stored = field.type === "date" ? (value || null) : value;
    setSavingKey(field.key);
    if (field.store === "user") {
      let query = supabase.from("user_details").update({ [field.column]: stored || null });
      query = record.id ? query.eq("id", record.id) : query.eq("username", username);
      const { error } = await query;
      setSavingKey("");
      if (error) {
        showToast(error.message || "Could not save.");
        return;
      }
      const next = { ...record, [field.column]: stored };
      setRecord(next);
      setEditingKey("");
      onUpdated?.(next);
      showToast("Saved");
      return;
    }

    const payload = {
      user_name: username,
      [field.column]: stored,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("hr_employee_profiles")
      .upsert(payload, { onConflict: "user_name" })
      .select("*")
      .maybeSingle();
    setSavingKey("");
    if (error) {
      showToast(error.message || "Run supabase/hr_employee_profiles.sql in the Supabase SQL editor.");
      return;
    }
    const nextProfile = { ...(profile || {}), ...(data || payload) };
    setProfile(nextProfile);
    setEditingKey("");
    onUpdated?.({ ...record, ...nextProfile, username });
    showToast("Saved");
  };

  const handleAction = (label) => {
    showToast(`${label} will open here once the template is connected.`);
  };

  const handleUpload = async (docKey, file) => {
    if (!file || !username) return;
    setUploadingKey(docKey);
    setDocsError("");
    try {
      const label = DOC_TYPES.find((d) => d.key === docKey)?.label || docKey;
      const saved = await replaceEmployeeDocument(supabase, {
        username,
        employeeName: fullName,
        docKey,
        docLabel: label,
        file,
      });
      setDocs((prev) => ({
        ...prev,
        [docKey]: { ...saved, source: "documents" },
      }));
      showToast("Document saved");
    } catch (err) {
      setDocsError(err.message || "Upload failed");
    } finally {
      setUploadingKey("");
    }
  };

  return (
    <div className="edm-overlay" onClick={onClose} role="presentation">
      <div
        className="edm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${fullName} details`}
      >
        <header className="edm-header">
          <div className="edm-header-left">
            <div className="edm-avatar">{fullName.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div>
              <h2>{fullName}</h2>
              <p>{display(pick(profile, "designation") || pick(record, "designation", "role", "department"))}</p>
            </div>
          </div>
          <button type="button" className="edm-close" onClick={onClose} aria-label="Close">
            <SvgIcon name="close" size={18} />
          </button>
        </header>

        <nav className="edm-tabs" aria-label="Employee sections">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`edm-tab${tab === item.key ? " active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              <SvgIcon
                name={
                  item.key === "info"
                    ? "user"
                    : item.key === "attendance"
                      ? "calendar"
                      : item.key === "leaves"
                        ? "leave"
                        : "folder"
                }
                size={15}
              />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="edm-body">
          {tab === "info" && (
            <div className="edm-section">
              <div className="edm-info-grid">
                {infoFields.map((field) => (
                  <div className="edm-info-item" key={field.key}>
                    <span>
                      {field.label}
                      {editingKey !== field.key && (
                        <button
                          type="button"
                          className="edm-info-edit"
                          aria-label={`Edit ${field.label}`}
                          onClick={() => startEdit(field)}
                        >
                          <SvgIcon name="pencil" size={13} />
                        </button>
                      )}
                    </span>
                    {editingKey === field.key ? (
                      <div className="edm-info-editor">
                        {field.type === "department" || field.type === "blood" || field.type === "emp_type" ? (
                          <select value={draft} onChange={(event) => setDraft(event.target.value)}>
                            <option value="">Select</option>
                            {(field.type === "department" ? DEPARTMENTS : field.type === "blood" ? BLOOD_GROUPS : EMP_TYPES)
                              .concat(draft && !(field.type === "department" ? DEPARTMENTS : field.type === "blood" ? BLOOD_GROUPS : EMP_TYPES).includes(draft) ? [draft] : [])
                              .map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === "date" ? "date" : "text"}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                          />
                        )}
                        <div className="edm-info-editor-actions">
                          <button type="button" className="edm-info-save" disabled={savingKey === field.key} onClick={() => saveField(field)}>
                            {savingKey === field.key ? "Saving…" : "Save"}
                          </button>
                          <button type="button" className="edm-info-cancel" onClick={() => setEditingKey("")}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <strong>{display(field.value)}</strong>
                    )}
                  </div>
                ))}
              </div>
              <div className="edm-actions">
                <button type="button" className="edm-action-btn" onClick={() => setShowBdayCard(true)}>
                  <SvgIcon name="gift" size={15} /> Birthday card
                </button>
                <button type="button" className="edm-action-btn" onClick={() => handleAction("Exp Certificate")}>
                  <SvgIcon name="file" size={15} /> Exp Certificate
                </button>
                <button type="button" className="edm-action-btn" onClick={() => handleAction("Offer Letter")}>
                  <SvgIcon name="file" size={15} /> Offer Letter
                </button>
              </div>
            </div>
          )}
 
          {tab === "attendance" && (
            <div className="edm-section">
              <div className="edm-att-summary">
                <div className="edm-att-stat is-present">
                  <SvgIcon name="check" size={16} />
                  <b>{attLoading ? "—" : attCounts.present}</b>
                  <small>Present</small>
                </div>
                <div className="edm-att-stat is-late">
                  <SvgIcon name="clock" size={16} />
                  <b>{attLoading ? "—" : attCounts.late}</b>
                  <small>Late</small>
                </div>
                <div className="edm-att-stat is-absent">
                  <SvgIcon name="xcircle" size={16} />
                  <b>{attLoading ? "—" : attCounts.absent}</b>
                  <small>Absent</small>
                </div>
              </div>

              <div className="edm-att-controls">
                <select
                  value={attMonth}
                  onChange={(e) => setAttMonth(Number(e.target.value))}
                  aria-label="Attendance month"
                >
                  {MONTH_LABELS.map((label, idx) => (
                    <option key={label} value={idx + 1}>{label}</option>
                  ))}
                </select>
                <select
                  value={attYear}
                  onChange={(e) => setAttYear(Number(e.target.value))}
                  aria-label="Attendance year"
                >
                  {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="edm-cal">
                <div className="edm-cal-head">
                  {DAY_ABBR.map((d) => <span key={d}>{d}</span>)}
                </div>
                <div className="edm-cal-grid">
                  {Array.from({ length: firstWeekday }).map((_, i) => (
                    <span key={`pad-${i}`} className="edm-cal-pad" />
                  ))}
                  {monthDays.map((day) => {
                    const status = attDays[day.key] || "A";
                    return (
                      <span
                        key={day.key}
                        className={`edm-cal-day status-${status.toLowerCase()}${day.isWeekend ? " is-weekend" : ""}`}
                        title={`${day.key}: ${status === "P" ? "Present" : status === "L" ? "Late" : "Absent"}`}
                      >
                        <b>{day.day}</b>
                        <i>{status}</i>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === "leaves" && (
            <div className="edm-section">
              <div className="edm-leave-cards">
                <div className="edm-leave-card is-used">
                  <SvgIcon name="leave" size={20} />
                  <div>
                    <small>Used</small>
                    <strong>{leaveLoading ? "—" : leaveUsed}</strong>
                    <span>days this leave cycle</span>
                  </div>
                </div>
                <div className="edm-leave-card is-balance">
                  <SvgIcon name="check" size={20} />
                  <div>
                    <small>Balance</small>
                    <strong>{leaveLoading ? "—" : leaveBalance}</strong>
                    <span>of 60 days remaining</span>
                  </div>
                </div>
              </div>
              <p className="edm-leave-note">
                Approved leaves only. Annual cycle Apr–Mar · 60 days / year.
              </p>
            </div>
          )}

          {tab === "documents" && (
            <div className="edm-section">
              {docsError && <div className="edm-alert">{docsError}</div>}
              {docsLoading ? (
                <div className="edm-empty">Loading documents…</div>
              ) : (
                <div className="edm-doc-grid">
                  {DOC_TYPES.map((doc) => {
                    const item = docs[doc.key];
                    const busy = uploadingKey === doc.key;
                    return (
                      <article className={`edm-doc-card${item ? " has-file" : ""}`} key={doc.key}>
                        <div className="edm-doc-icon">
                          <SvgIcon name={item ? "file" : "folder"} size={18} />
                        </div>
                        <strong>{doc.label}</strong>
                        <span className="edm-doc-status">
                          {item ? item.file_name || "Submitted" : "Not submitted"}
                        </span>
                        <div className="edm-doc-actions">
                          {item ? (
                            <>
                              <a
                                className="edm-doc-btn"
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <SvgIcon name="eye" size={14} /> Preview
                              </a>
                              <button
                                type="button"
                                className="edm-doc-btn"
                                disabled={busy}
                                onClick={() => fileRefs.current[doc.key]?.click()}
                              >
                                <SvgIcon name="refresh" size={14} />
                                {busy ? "Updating…" : "Update"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="edm-doc-btn is-add"
                              disabled={busy}
                              onClick={() => fileRefs.current[doc.key]?.click()}
                            >
                              <SvgIcon name={busy ? "upload" : "plus"} size={14} />
                              {busy ? "Uploading…" : "Add"}
                            </button>
                          )}
                        </div>
                        <input
                          ref={(el) => {
                            fileRefs.current[doc.key] = el;
                          }}
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) handleUpload(doc.key, file);
                          }}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
          {showBdayCard && (
            <HrBirthdayCardPopup
              employee={{ ...record, ...(profile || {}), name: fullName, username }}
              onClose={() => setShowBdayCard(false)}
            />
          )}
        {toast && <div className="edm-toast">{toast}</div>}
      </div>
    </div>
  );
}
