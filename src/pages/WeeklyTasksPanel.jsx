import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { TaskForm, EMPTY_FORM } from "./Taskformwithcheckpoints";

const PRIORITY = {
  high: { bg: "#fef2f2", color: "#dc2626" },
  medium: { bg: "#fffbeb", color: "#d97706" },
  low: { bg: "#f0fdf4", color: "#16a34a" },
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const Icon = ({ children, size = 14, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const IPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
const IEdit = (p) => <Icon {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>;
const ITrash = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></Icon>;
const IUser = (p) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
const ISearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
const ICal = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon>;
const IClose = (p) => <Icon {...p} sw={2.4}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const ICheck = (p) => <Icon {...p} sw={2.5}><path d="M20 6L9 17l-5-5" /></Icon>;
const IInbox = (p) => <Icon {...p} sw={1.5} size={34}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Icon>;

export function TaskModeToggle({ mode, onChange }) {
  const tabs = [
    { key: "assign", label: "Assign Tasks", icon: <path d="M12 5v14M5 12h14" /> },
    {
      key: "weekly",
      label: "Weekly Tasks",
      icon: (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      ),
    },
  ];
  return (
    <div role="tablist" aria-label="Task mode" style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
      {tabs.map((t) => {
        const on = mode === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
              fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8,
              background: on ? "#fff" : "transparent", color: on ? "#dc2626" : "#64748b",
              boxShadow: on ? "0 1px 3px rgba(0,0,0,.12)" : "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const CSS = `
.wk-root{display:flex;flex-direction:column;gap:14px}
.wk-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.wk-search{position:relative;flex:1 1 200px;min-width:180px}
.wk-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8}
.wk-search input{padding-left:32px;width:100%}
.wk-in{font:inherit;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;background:#fff;color:#1e293b;outline:none;box-sizing:border-box}
.wk-in:focus{border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.08)}
.wk-add{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:700;padding:8px 14px;border-radius:8px;background:#dc2626;color:#fff;border:none;cursor:pointer;white-space:nowrap}
.wk-add:hover{background:#b91c1c}
.wk-tablewrap{border:1px solid #e2e8f0;border-radius:10px;overflow:auto;max-height:52vh}
.wk-table{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
.wk-table th{position:sticky;top:0;background:#f8fafc;text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.wk-table td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}
.wk-table tr:last-child td{border-bottom:none}
.wk-title{font-weight:600;color:#1e293b}
.wk-sub{font-size:11.5px;color:#94a3b8;margin-top:2px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wk-pill{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:capitalize}
.wk-actions{display:flex;gap:6px;justify-content:flex-end}
.wk-ibtn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;font-weight:600;height:30px;padding:0 10px;border-radius:7px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer}
.wk-ibtn:hover{background:#f8fafc}
.wk-ibtn.sq{width:30px;padding:0;justify-content:center}
.wk-ibtn.assign{border-color:#bfdbfe;background:#eff6ff;color:#2563eb}
.wk-ibtn.assign:hover{background:#dbeafe}
.wk-ibtn.del{border-color:#fecaca;background:#fef2f2;color:#dc2626}
.wk-ibtn.del:hover{background:#fee2e2}
.wk-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 16px;color:#94a3b8;font-size:13px}
.wk-count{font-size:12px;color:#94a3b8}
.wk-pop{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:72px 16px 16px;overflow-y:auto}
.wk-popbox{background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:calc(100vh - 90px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.wk-popbox.sm{max-width:420px}
.wk-pophead{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9;font-weight:700;color:#1e293b}
.wk-popbody{padding:18px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.wk-lbl{font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px}
.wk-popfoot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #f1f5f9}
.wk-sec{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer}
[data-theme="dark"] .wk-popbox{background:#1e1c19;color:#f0ede8}
[data-theme="dark"] .wk-pophead{color:#f0ede8;border-color:#3a3631}
[data-theme="dark"] .wk-popfoot{border-color:#3a3631}
[data-theme="dark"] .wk-in,[data-theme="dark"] .wk-sec,[data-theme="dark"] .wk-ibtn{background:#2a2723;color:#f0ede8;border-color:#3a3631}
[data-theme="dark"] .wk-table th{background:#2a2723;color:#a8a29e;border-color:#3a3631}
[data-theme="dark"] .wk-table td{color:#e7e5e4;border-color:#3a3631}
[data-theme="dark"] .wk-title{color:#f0ede8}
[data-theme="dark"] .wk-tablewrap{border-color:#3a3631}
`;

async function uploadFile(bucket, file) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export default function WeeklyTasksPanel({ user, employees = [], sites = [], showToast = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [fSite, setFSite] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const [popup, setPopup] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [assignRow, setAssignRow] = useState(null);
  const [assignUser, setAssignUser] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assigning, setAssigning] = useState(false);

  const nameOf = useMemo(() => {
    const m = {};
    employees.forEach((e) => { m[e.username] = e.name || e.username; });
    return m;
  }, [employees]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("weekly_task_drafts")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      setLoadError(
        /relation|does not exist|schema cache/i.test(error.message)
          ? "Weekly tasks table is missing. Run supabase/weekly_task_drafts.sql in the Supabase SQL editor."
          : error.message,
      );
      setRows([]);
    } else {
      setLoadError("");
      setRows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (s && !`${r.title} ${r.description || ""}`.toLowerCase().includes(s)) return false;
      if (fSite && r.site_name !== fSite) return false;
      if (fPriority && r.priority !== fPriority) return false;
      if (fStatus === "unassigned" && r.assigned_to) return false;
      if (fStatus === "assigned" && !r.assigned_to) return false;
      if (fFrom && (!r.due_date || r.due_date < fFrom)) return false;
      if (fTo && (!r.due_date || r.due_date > fTo)) return false;
      return true;
    });
  }, [rows, q, fSite, fPriority, fStatus, fFrom, fTo]);

  const siteOptions = useMemo(
    () => sites.filter((s) => String(s.status || "").trim().toLowerCase() !== "inactive").map((s) => s.site_name).filter(Boolean).sort(),
    [sites],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "Inactive"),
    [employees],
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setPopup(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      ...EMPTY_FORM,
      title: r.title || "",
      description: r.description || "",
      site_name: r.site_name || "",
      priority: r.priority || "medium",
      due_date: r.due_date || "",
      hours_to_complete: r.hours_to_complete ?? "",
      reschedule_allowed: !!r.reschedule_allowed,
      enable_checkpoints: !!r.has_checkpoints,
    });
    setPopup(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const saveDraft = async () => {
    if (!form.title.trim()) { showToast("error", "Title is required."); return false; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        site_name: form.site_name.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        hours_to_complete: form.hours_to_complete ? parseFloat(form.hours_to_complete) : null,
        reschedule_allowed: !!form.reschedule_allowed,
        has_checkpoints: !!form.enable_checkpoints,
        updated_at: new Date().toISOString(),
      };
      if (form._audioFile) payload.audio_url = await uploadFile("task-audio", form._audioFile);
      if (form._docFile) payload.document_url = await uploadFile("task-documents", form._docFile);

      const res = editing
        ? await supabase.from("weekly_task_drafts").update(payload).eq("id", editing.id)
        : await supabase.from("weekly_task_drafts").insert([{ ...payload, created_by: user?.user_name || null }]);
      if (res.error) throw new Error(res.error.message);
      showToast("success", editing ? "Weekly task updated." : "Weekly task added.");
      await load();
      return true;
    } catch (err) {
      showToast("error", "Could not save task. " + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (r) => {
    if (!window.confirm(`Delete "${r.title}" from the weekly list?`)) return;
    const { error } = await supabase.from("weekly_task_drafts").delete().eq("id", r.id);
    if (error) return showToast("error", "Could not delete. " + error.message);
    setRows((p) => p.filter((x) => x.id !== r.id));
  };

  const openAssign = (r) => {
    setAssignRow(r);
    setAssignUser(r.assigned_to || "");
    setAssignDue(r.due_date || "");
  };

  const doAssign = async () => {
    if (!assignUser) return showToast("error", "Select an employee.");
    const r = assignRow;
    setAssigning(true);
    const { data: task, error } = await supabase
      .from("tasks")
      .insert([{
        title: r.title,
        description: r.description,
        assigned_to: assignUser,
        assigned_by: user?.user_name,
        site_name: r.site_name,
        priority: r.priority,
        status: "pending",
        due_date: assignDue || null,
        reschedule_allowed: !!r.reschedule_allowed,
        hours_to_complete: r.hours_to_complete,
        audio_url: r.audio_url,
        document_url: r.document_url,
      }])
      .select("id")
      .single();
    if (error) {
      setAssigning(false);
      return showToast("error", "Failed to assign task. " + error.message);
    }
    if (r.has_checkpoints) await supabase.from("tasks").update({ has_checkpoints: true }).eq("id", task.id);
    await supabase
      .from("weekly_task_drafts")
      .update({ assigned_to: assignUser, assigned_at: new Date().toISOString(), task_id: String(task.id), due_date: assignDue || null })
      .eq("id", r.id);
    setAssigning(false);
    setAssignRow(null);
    showToast("success", `"${r.title}" assigned to ${nameOf[assignUser] || assignUser}.`);
    load();
  };

  const clearFilters = () => { setQ(""); setFSite(""); setFPriority(""); setFStatus(""); setFFrom(""); setFTo(""); };
  const hasFilters = q || fSite || fPriority || fStatus || fFrom || fTo;

  return (
    <div className="wk-root">
      <style>{CSS}</style>

      <div className="wk-toolbar">
        <div className="wk-search">
          <ISearch size={14} />
          <input className="wk-in" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="wk-in" value={fSite} onChange={(e) => setFSite(e.target.value)}>
          <option value="">All sites</option>
          {siteOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="wk-in" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="wk-in" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
        </select>
        <input className="wk-in" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} title="Due from" />
        <input className="wk-in" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} title="Due to" />
        {hasFilters && <button type="button" className="wk-sec" onClick={clearFilters}>Clear</button>}
        <button type="button" className="wk-add" onClick={openAdd}><IPlus size={14} sw={2.5} /> Add Task</button>
      </div>

      <div className="wk-count">{filtered.length} of {rows.length} task{rows.length === 1 ? "" : "s"}</div>

      <div className="wk-tablewrap">
        {loading ? (
          <div className="wk-empty">Loading weekly tasks…</div>
        ) : loadError ? (
          <div className="wk-empty" style={{ color: "#dc2626" }}>{loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="wk-empty">
            <IInbox />
            {rows.length === 0 ? "No weekly tasks yet. Click “Add Task” to build this week's list." : "No tasks match these filters."}
          </div>
        ) : (
          <table className="wk-table">
            <thead>
              <tr>
                <th>#</th><th>Task</th><th>Site</th><th>Priority</th><th>Due</th><th>Hours</th><th>Assigned To</th><th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const p = PRIORITY[r.priority] || PRIORITY.medium;
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="wk-title">{r.title}</div>
                      {r.description && <div className="wk-sub" title={r.description}>{r.description}</div>}
                    </td>
                    <td>{r.site_name || "—"}</td>
                    <td><span className="wk-pill" style={{ background: p.bg, color: p.color }}>{r.priority}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.due_date)}</td>
                    <td>{r.hours_to_complete ? `${r.hours_to_complete}h` : "—"}</td>
                    <td>
                      {r.assigned_to ? (
                        <span className="wk-pill" style={{ background: "#eff6ff", color: "#2563eb" }}>
                          <ICheck size={11} /> {nameOf[r.assigned_to] || r.assigned_to}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="wk-actions">
                        <button type="button" className="wk-ibtn assign" onClick={() => openAssign(r)}>
                          <IUser size={13} /> {r.assigned_to ? "Reassign" : "Assign"}
                        </button>
                        <button type="button" className="wk-ibtn sq" onClick={() => openEdit(r)} title="Edit"><IEdit size={13} /></button>
                        <button type="button" className="wk-ibtn sq del" onClick={() => removeRow(r)} title="Delete"><ITrash size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {popup && (
        <div className="wk-pop" onClick={(e) => { if (e.target === e.currentTarget) setPopup(false); }}>
          <div className="wk-popbox" role="dialog" aria-modal="true">
            <div className="wk-pophead">
              <span>{editing ? "Edit Weekly Task" : "Add Weekly Task"}</span>
              <button type="button" className="wk-ibtn sq" onClick={() => setPopup(false)} aria-label="Close"><IClose size={14} /></button>
            </div>
            <div className="wk-popbody">
              <TaskForm
                key={formKey}
                form={form}
                handleFormChange={handleChange}
                setForm={setForm}
                handleSubmit={saveDraft}
                submitting={saving}
                onSuccess={() => {
                  if (editing) {
                    setPopup(false);
                  } else {
                    // keep the popup open so the whole week can be entered in one go
                    setForm({ ...EMPTY_FORM });
                    setFormKey((k) => k + 1);
                  }
                }}
                employees={[]}
                sites={sites}
                hideAssignTo
                submitLabel={editing ? "Save Changes" : "Add to Week"}
                submittingLabel="Saving…"
              />
            </div>
          </div>
        </div>
      )}

      {assignRow && (
        <div className="wk-pop" onClick={(e) => { if (e.target === e.currentTarget) setAssignRow(null); }}>
          <div className="wk-popbox sm" role="dialog" aria-modal="true">
            <div className="wk-pophead">
              <span>Assign Task</span>
              <button type="button" className="wk-ibtn sq" onClick={() => setAssignRow(null)} aria-label="Close"><IClose size={14} /></button>
            </div>
            <div className="wk-popbody">
              <div className="wk-title">{assignRow.title}</div>
              <div>
                <label className="wk-lbl">Assign to</label>
                <select className="wk-in" style={{ width: "100%" }} value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
                  <option value="">Select employee…</option>
                  {activeEmployees.map((e) => <option key={e.username} value={e.username}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="wk-lbl"><ICal size={12} /> Due date</label>
                <input className="wk-in" style={{ width: "100%" }} type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
              </div>
            </div>
            <div className="wk-popfoot">
              <button type="button" className="wk-sec" onClick={() => setAssignRow(null)}>Cancel</button>
              <button type="button" className="wk-add" onClick={doAssign} disabled={assigning}>
                {assigning ? "Assigning…" : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
