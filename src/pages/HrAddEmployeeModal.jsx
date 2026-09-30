import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const DEPARTMENTS = [
  { value: "admin", label: "Admin" },
  { value: "site engineer", label: "Site Engineer" },
  { value: "project head", label: "Project Head" },
  { value: "engineer office", label: "Engineer Office" },
  { value: "mdo office", label: "MDO Office" },
  { value: "hr", label: "HR" },
  { value: "client", label: "Client" },
];

const EMPTY = {
  name: "",
  username: "",
  password: "",
  role: "",
  department: "",
  site_names: [],
  status: "Active",
  emp_id: "",
  designation: "",
  phone: "",
  email: "",
  dob: "",
  joining_date: "",
  company: "",
  emp_type: "",
  salary: "",
  increment: "",
  manager: "",
  blood_group: "",
  emergency: "",
  pf_no: "",
  esic_no: "",
  bank: "",
  ifsc: "",
  acc_no: "",
};

function numericId(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const num = Number(text);
  return Number.isSafeInteger(num) ? num : null;
}

async function nextEmpId() {
  const [usersRes, profilesRes] = await Promise.all([
    supabase.from("user_details").select("id"),
    supabase.from("hr_employee_profiles").select("emp_id"),
  ]);
  let max = 0;
  (usersRes.data || []).forEach((row) => {
    const num = numericId(row.id);
    if (num != null && num > max) max = num;
  });
  (profilesRes.data || []).forEach((row) => {
    const num = numericId(row.emp_id);
    if (num != null && num > max) max = num;
  });
  return String(max + 1);
}

function toTitleCase(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  if (name === "close") {
    return (
      <svg {...common}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  if (name === "eye-off") {
    return (
      <svg {...common}>
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function HrAddEmployeeModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [sites, setSites] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, empId] = await Promise.all([
        supabase.from("site_details").select("id, site_name, status"),
        nextEmpId(),
      ]);
      if (cancelled) return;
      setSites((data || []).filter((site) => site.site_name));
      setForm((prev) => ({ ...prev, emp_id: empId }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim() || !form.role.trim() || !form.department.trim()) {
      setError("Fill name, username, password, role, and department.");
      return;
    }
    setSaving(true);
    setError("");
    const username = form.username.trim();
    const empId = await nextEmpId();
    setForm((prev) => ({ ...prev, emp_id: empId }));
    const { error: userErr } = await supabase.from("user_details").insert([
      {
        name: form.name.trim(),
        username,
        password: form.password.trim(),
        role: form.role.trim(),
        department: toTitleCase(form.department),
        site_name: form.site_names[0] || null,
        site_names: form.site_names.length ? form.site_names : null,
        status: toTitleCase(form.status) || "Active",
      },
    ]);
    if (userErr) {
      setSaving(false);
      setError(userErr.message || "Could not add employee.");
      return;
    }

    const { error: profileErr } = await supabase.from("hr_employee_profiles").insert([
      {
        user_name: username,
        emp_id: empId,
        designation: form.designation.trim() || form.role.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        dob: form.dob || null,
        joining_date: form.joining_date || null,
        company: form.company.trim() || null,
        emp_type: form.emp_type.trim() || null,
        salary: form.salary.trim() || null,
        increment: form.increment.trim() || null,
        manager: form.manager.trim() || null,
        blood_group: form.blood_group.trim() || null,
        emergency: form.emergency.trim() || null,
        pf_no: form.pf_no.trim() || null,
        esic_no: form.esic_no.trim() || null,
        bank: form.bank.trim() || null,
        ifsc: form.ifsc.trim() || null,
        acc_no: form.acc_no.trim() || null,
      },
    ]);
    setSaving(false);
    if (profileErr) {
      setError("Employee login was created, but extra details were not saved. Run supabase/hr_employee_profiles.sql, then edit the employee card.");
      onSaved?.();
      return;
    }
    onSaved?.();
    onClose?.();
  };

  return (
    <div className="hrae-overlay" onClick={onClose} role="presentation">
      <div className="hrae-modal" role="dialog" aria-modal="true" aria-label="Add employee" onClick={(event) => event.stopPropagation()}>
        <header className="hrae-head">
          <strong>Add Employee</strong>
          <button type="button" className="hrae-close" onClick={onClose} aria-label="Close">
            <Svg name="close" size={16} />
          </button>
        </header>
        <div className="hrae-form">
          {error && <div className="hr-data-alert hrae-span">{error}</div>}
          <label>
            Full Name *
            <input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. John Doe" />
          </label>
          <label>
            Username *
            <input value={form.username} autoComplete="off" onChange={(event) => setField("username", event.target.value)} placeholder="e.g. john.doe" />
          </label>
          <label>
            Password *
            <span className="hrae-password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <Svg name={showPassword ? "eye-off" : "eye"} size={16} />
              </button>
            </span>
          </label>
          <label>
            Role *
            <input value={form.role} onChange={(event) => setField("role", event.target.value)} placeholder="e.g. Site Engineer" />
          </label>
          <label>
            Department *
            <select value={form.department} onChange={(event) => setField("department", event.target.value)}>
              <option value="">Select department…</option>
              {DEPARTMENTS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <div className="hrae-span">
            <span className="hrae-label">Site(s) Assigned</span>
            <div className="hrae-sites">
              {!form.site_names.length && <em>No sites assigned yet</em>}
              {form.site_names.map((site) => (
                <span key={site}>
                  {site}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, site_names: prev.site_names.filter((item) => item !== site) }))}
                    aria-label={`Remove ${site}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                if (value === "__ALL__") {
                  const all = [...new Set(sites.filter((site) => (site.status || "Active") === "Active").map((site) => site.site_name))];
                  setForm((prev) => ({ ...prev, site_names: [...new Set([...prev.site_names, ...all])] }));
                  return;
                }
                setForm((prev) => (
                  prev.site_names.includes(value) ? prev : { ...prev, site_names: [...prev.site_names, value] }
                ));
              }}
            >
              <option value="">+ Add a site…</option>
              <option value="__ALL__">—— Assign All Sites ——</option>
              {sites
                .filter((site) => (site.status || "Active") === "Active" && !form.site_names.includes(site.site_name))
                .sort((a, b) => a.site_name.localeCompare(b.site_name))
                .map((site) => (
                  <option key={site.id || site.site_name} value={site.site_name}>{site.site_name}</option>
                ))}
            </select>
          </div>

          <p className="hrae-section hrae-span">Additional info</p>
          <label>
            Emp ID
            <input value={form.emp_id} readOnly placeholder="Assigning…" />
          </label>
          <label>
            Designation
            <input value={form.designation} onChange={(event) => setField("designation", event.target.value)} placeholder="Defaults to role" />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(event) => setField("email", event.target.value)} />
          </label>
          <label>
            DOB
            <input type="date" value={form.dob} onChange={(event) => setField("dob", event.target.value)} />
          </label>
          <label>
            Joining Date
            <input type="date" value={form.joining_date} onChange={(event) => setField("joining_date", event.target.value)} />
          </label>
          <label>
            Company
            <input value={form.company} onChange={(event) => setField("company", event.target.value)} />
          </label>
          <label>
            Emp Type
            <select value={form.emp_type} onChange={(event) => setField("emp_type", event.target.value)}>
              <option value="">Select</option>
              {["Permanent", "Contract", "Intern", "Probation", "Consultant"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Salary
            <input value={form.salary} onChange={(event) => setField("salary", event.target.value)} />
          </label>
          <label>
            Increment
            <input value={form.increment} onChange={(event) => setField("increment", event.target.value)} />
          </label>
          <label>
            Manager
            <input value={form.manager} onChange={(event) => setField("manager", event.target.value)} />
          </label>
          <label>
            Blood Group
            <select value={form.blood_group} onChange={(event) => setField("blood_group", event.target.value)}>
              <option value="">Select</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Emergency
            <input value={form.emergency} onChange={(event) => setField("emergency", event.target.value)} />
          </label>
          <label>
            PF No
            <input value={form.pf_no} onChange={(event) => setField("pf_no", event.target.value)} />
          </label>
          <label>
            ESIC No
            <input value={form.esic_no} onChange={(event) => setField("esic_no", event.target.value)} />
          </label>
          <label>
            Bank
            <input value={form.bank} onChange={(event) => setField("bank", event.target.value)} />
          </label>
          <label>
            IFSC
            <input value={form.ifsc} onChange={(event) => setField("ifsc", event.target.value)} />
          </label>
          <label>
            Acc No
            <input value={form.acc_no} onChange={(event) => setField("acc_no", event.target.value)} />
          </label>
        </div>
        <footer className="hrae-foot">
          <button type="button" className="hrae-reset" onClick={async () => { setError(""); const empId = await nextEmpId(); setForm({ ...EMPTY, emp_id: empId }); }}>Reset</button>
          <button type="button" className="hrae-save" disabled={saving} onClick={save}>{saving ? "Saving…" : "Add Employee"}</button>
        </footer>
      </div>
    </div>
  );
}
