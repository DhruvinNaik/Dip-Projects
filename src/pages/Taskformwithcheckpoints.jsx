

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
// ── helpers (copied from AdminPortal) ────────────────────────────────────────
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS   = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const EMPTY_FORM = {
  title: "", description: "", assigned_to: "", site_name: "", priority: "medium",
  due_date: "", status: "pending", is_recurring: false, recurrence: "",
  anchor_weekday: "1", anchor_day: "1", anchor_month: "1", anchor_month_day: "1",
  reschedule_allowed: false, enable_checkpoints: false,_audioFile: null, _docFile: null,hours_to_complete: "",
  _queueMode: null,
  _queueTargetTaskId: null,
  _queueRescheduleDate: "",
};

function daysInMonth(month) {
  return new Date(2001, parseInt(month, 10), 0).getDate();
}

function buildAnchor(form) {
  switch (form.recurrence) {
    case "daily":   return null;
    case "weekly":  return String(form.anchor_weekday);
    case "monthly": return String(form.anchor_day);
    case "yearly":  return `${String(form.anchor_month).padStart(2,"0")}-${String(form.anchor_month_day).padStart(2,"0")}`;
    default:        return null;
  }
}

function anchorDescription(recurrence, anchor) {
  if (!anchor) return null;
  switch (recurrence) {
    case "weekly":  return `every ${WEEKDAYS[parseInt(anchor, 10)]}`;
    case "monthly": return `on the ${anchor}${ordinal(parseInt(anchor,10))} of every month`;
    case "yearly": {
      const [mm, dd] = anchor.split("-");
      return `every year on ${MONTHS[parseInt(mm,10)-1]} ${parseInt(dd,10)}`;
    }
    default: return null;
  }
}

function getElapsedSeconds(task) {
  const accumulated = task.accumulated_seconds || 0;
  if (task.is_held) return accumulated;
  if (!task.accepted_at) return accumulated;
  const lastStart = task.resumed_at || task.accepted_at;
  const extra = Math.floor((Date.now() - new Date(lastStart).getTime()) / 1000);
  return accumulated + Math.max(extra, 0);
}

function formatDuration(totalSeconds) {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(totalSeconds);
  const hrs = Math.floor(abs / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  return `${sign}${hrs}h ${mins}m`;
}

function getTimeLeftLabel(task) {
  if (!task.hours_to_complete) return "No time budget set";
  const budgetSeconds = task.hours_to_complete * 3600;
  const remaining = budgetSeconds - getElapsedSeconds(task);
  return `${formatDuration(remaining)}${remaining < 0 ? " overdue" : " left"}`;
}

function ordinal(n) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
} 
// ── CheckpointManager ─────────────────────────────────────────────────────────
export function CheckpointManager({ taskTitle, onCountChange }) {
  const [items, setItems]       = useState([]);   // { id, checkpoint, isNew, editing, draft }
  const [loading, setLoading]   = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [adding, setAdding]     = useState(false);
  const [savingId, setSavingId] = useState(null);
  const addRef = useRef(null);

  // ── fetch existing checkpoints for this task_type ──
  useEffect(() => {
    if (!taskTitle?.trim()) { setItems([]); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("checkpoints")
        .select("id, checkpoint, task_type")
        .ilike("task_type", taskTitle.trim())
        .order("id", { ascending: true });
      setItems(
        (data || []).map(r => ({ id: r.id, checkpoint: r.checkpoint, editing: false, draft: r.checkpoint }))
      );
      setLoading(false);
    })();
  }, [taskTitle]);

  useEffect(() => {
    onCountChange(items.length);
  }, [items.length]);

  // ── add new ──
  const handleAdd = async () => {
    const text = addDraft.trim();
    if (!text) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("checkpoints")
      .insert([{ task_type: taskTitle.trim(), checkpoint: text }])
      .select()
      .single();
    setAdding(false);
    if (error) return;
    setItems(p => [...p, { id: data.id, checkpoint: data.checkpoint, editing: false, draft: data.checkpoint }]);
    setAddDraft("");
  };

  // ── save edit ──
  const handleSave = async (item) => {
    const text = item.draft.trim();
    if (!text) return;
    setSavingId(item.id);
    const { error } = await supabase
      .from("checkpoints")
      .update({ checkpoint: text })
      .eq("id", item.id);
    setSavingId(null);
    if (error) return;
    setItems(p => p.map(i => i.id === item.id ? { ...i, checkpoint: text, editing: false, draft: text } : i));
  };

  // ── delete ──
  const handleDelete = async (id) => {
    setSavingId(id);
    await supabase.from("checkpoints").delete().eq("id", id);
    setSavingId(null);
    setItems(p => p.filter(i => i.id !== id));
  };

  const startEdit = (id) => setItems(p => p.map(i => i.id === id ? { ...i, editing: true } : i));
  const cancelEdit = (id) => setItems(p => p.map(i => i.id === id ? { ...i, editing: false, draft: i.checkpoint } : i));
  const setDraft = (id, val) => setItems(p => p.map(i => i.id === id ? { ...i, draft: val } : i));

  if (!taskTitle?.trim()) return (
    <div className="cp-empty-hint">Enter a task title above to manage checkpoints.</div>
  );

  return (
    <div className="cp-root">
      {/* Header */}
      <div className="cp-header">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Checkpoints for <strong>"{taskTitle}"</strong>
        <span className="cp-count">{items.length}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="cp-loading">
          <span className="cp-spinner"/>Loading checkpoints…
        </div>
      ) : items.length === 0 ? (
        <div className="cp-no-items">No checkpoints yet. Add one below.</div>
      ) : (
        <div className="cp-list">
          {items.map((item, idx) => (
            <div key={item.id} className="cp-item">
              <span className="cp-item-num">{idx + 1}</span>
              {item.editing ? (
                <input
                  className="cp-item-input"
                  value={item.draft}
                  autoFocus
                  onChange={e => setDraft(item.id, e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter") handleSave(item); if(e.key==="Escape") cancelEdit(item.id); }}
                />
              ) : (
                <span className="cp-item-text">{item.checkpoint}</span>
              )}
              <div className="cp-item-actions">
                {item.editing ? (
                  <>
                    <button className="cp-btn cp-btn-save" disabled={savingId===item.id} onClick={() => handleSave(item)} title="Save">
                      {savingId===item.id
                        ? <span className="cp-spinner"/>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                    <button className="cp-btn cp-btn-cancel" onClick={() => cancelEdit(item.id)} title="Cancel">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="cp-btn cp-btn-edit" onClick={() => startEdit(item.id)} title="Edit">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="cp-btn cp-btn-delete" disabled={savingId===item.id} onClick={() => handleDelete(item.id)} title="Delete">
                      {savingId===item.id
                        ? <span className="cp-spinner"/>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="cp-add-row">
        <input
          ref={addRef}
          className="cp-add-input"
          placeholder="Add a new checkpoint…"
          value={addDraft}
          onChange={e => setAddDraft(e.target.value)}
          onKeyDown={e => { if(e.key==="Enter") handleAdd(); }}
        />
        <button className="cp-btn-add" disabled={adding || !addDraft.trim()} onClick={handleAdd}>
          {adding
            ? <span className="cp-spinner"/>
            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add</>}
        </button>
      </div>
    </div>
  );
}

export function AudioRecorder({ onRecorded }) {
  const [state, setState]         = useState("idle");
  const [seconds, setSeconds]     = useState(0);
  const [audioURL, setAudioURL]   = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const mediaRef   = useRef(null);
  const chunksRef  = useRef([]);
  const timerRef   = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url  = URL.createObjectURL(blob);
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        setAudioURL(url);
        setAudioFile(file);
        onRecorded(file);
        setState("recorded");
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone permission.");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
  };

  const discard = () => {
    setAudioURL(null);
    setAudioFile(null);
    setSeconds(0);
    setState("idle");
    onRecorded(null);
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if (state === "idle") return (
    <button type="button" onClick={startRecording}
      style={{display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"11px 14px",cursor:"pointer",width:"100%",transition:"border .15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="#dc2626"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}
    >
      <span style={{width:32,height:32,borderRadius:"50%",background:"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </span>
      <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>Click to start recording</span>
    </button>
  );

  if (state === "recording") return (
    <div style={{display:"flex",alignItems:"center",gap:12,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"11px 14px"}}>
      {/* Pulsing red dot */}
      <span style={{width:10,height:10,borderRadius:"50%",background:"#dc2626",flexShrink:0,animation:"pulse 1s ease-in-out infinite"}}/>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
      <span style={{fontSize:13,fontWeight:600,color:"#dc2626",flex:1}}>Recording… {fmt(seconds)}</span>
      <button type="button" onClick={stopRecording}
        style={{display:"inline-flex",alignItems:"center",gap:6,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",cursor:"pointer",fontSize:12.5,fontWeight:600}}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        Stop
      </button>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:8,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"12px 14px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span style={{fontSize:13,fontWeight:600,color:"#15803d"}}>Recorded ({fmt(seconds)})</span>
        </div>
        <button type="button" onClick={discard}
          style={{display:"inline-flex",alignItems:"center",gap:5,background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Discard
        </button>
      </div>
      <audio controls src={audioURL} style={{width:"100%",height:36,borderRadius:6,outline:"none"}}/>
    </div>
  );
}

function PendingTaskQueuePanel({ assignedTo, employeeName, form, setForm }) {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assignedTo) { setPendingTasks([]); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, hours_to_complete, accepted_at, resumed_at, accumulated_seconds, is_held, hold_started_at, status, is_recurring, parent_task_id")
        .eq("assigned_to", assignedTo)
        .neq("status", "completed")
        .neq("status", "not_applicable")
        .order("due_date", { ascending: true });
      if (!error) {
        setPendingTasks(
          (data || []).filter((t) => !t.is_recurring && !t.parent_task_id),
        );
      }
      setLoading(false);
    })();
  }, [assignedTo]);

  if (!assignedTo) return null;

  const selectMode = (task, mode) => {
    setForm((p) => ({
      ...p,
      _queueMode: mode,
      _queueTargetTaskId: task.id,
      _queueRescheduleDate: mode === "pause_and_prioritize" ? (task.due_date || "") : "",
    }));
  };

  const clearSelection = () => {
    setForm((p) => ({ ...p, _queueMode: null, _queueTargetTaskId: null, _queueRescheduleDate: "" }));
  };

  return (
    <div className="ap-form-row ap-col-1">
      <div className="ap-field">
        <label className="ap-label">
          {employeeName ? `${employeeName}'s` : "Employee's"} Pending Tasks
        </label>

        {loading ? (
          <div style={{ fontSize: 12.5, color: "#94a3b8", padding: "8px 0" }}>
            Loading pending tasks…
          </div>
        ) : pendingTasks.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#94a3b8", padding: "8px 0" }}>
            No pending tasks — the new task can start right away.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingTasks.map((t) => {
              const isSelected = form._queueTargetTaskId === t.id;
              const timeLeft = getTimeLeftLabel(t);
              const isOverdue = timeLeft.includes("overdue");
              return (
                <div
                  key={t.id}
                  style={{
                    border: `1px solid ${isSelected ? "#dc2626" : "#e2e8f0"}`,
                    background: isSelected ? "#fef2f2" : "#dadada93",
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                > 
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{t.title}</div>
                    <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "#64748b" }}>
                      <span>
                        Due: {t.due_date ? new Date(t.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </span>
                      <span style={{ color: isOverdue ? "#dc2626" : "#2563eb", fontWeight: 600 }}>
                        {timeLeft}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => selectMode(t, "continue_after")}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7,
                        border: `1px solid ${isSelected && form._queueMode === "continue_after" ? "#2563eb" : "#e2e8f0"}`,
                        background: isSelected && form._queueMode === "continue_after" ? "#eff6ff" : "#fff",
                        color: isSelected && form._queueMode === "continue_after" ? "#2563eb" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Continue after this task completes
                    </button>
                    <button
                      type="button"
                      onClick={() => selectMode(t, "pause_and_prioritize")}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7,
                        border: `1px solid ${isSelected && form._queueMode === "pause_and_prioritize" ? "#dc2626" : "#e2e8f0"}`,
                        background: isSelected && form._queueMode === "pause_and_prioritize" ? "#fef2f2" : "#fff",
                        color: isSelected && form._queueMode === "pause_and_prioritize" ? "#dc2626" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Pause & do new task first
                    </button>
                  </div>

                  {isSelected && form._queueMode === "pause_and_prioritize" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 6, borderTop: "1px dashed #e2e8f0" }}>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>
                        New due date for "{t.title}" <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="ap-input"
                        value={form._queueRescheduleDate}
                        min={t.due_date || new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setForm((p) => ({ ...p, _queueRescheduleDate: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {form._queueTargetTaskId && (
          <button
            type="button"
            onClick={clearSelection}
            style={{
              alignSelf: "flex-start", fontSize: 11.5, color: "#94a3b8", background: "none",
              border: "none", cursor: "pointer", marginTop: 6, textDecoration: "underline",
            }}
          >
            Clear queue selection
          </button>
        )}
      </div>
    </div>
  );
}

// ── TaskForm (drop-in replacement) ────────────────────────────────────────────
export function TaskForm({ form, handleFormChange, setForm, handleSubmit, submitting, onSuccess, employees = [], sites = [], hideAssignTo = false, submitLabel = "Assign Task", submittingLabel = "Assigning…" }) {
  const [cpCount, setCpCount] = useState(0);  

  const liveAnchor    = form.is_recurring ? buildAnchor(form) : null;
  const anchorPreview = form.is_recurring && form.recurrence ? anchorDescription(form.recurrence, liveAnchor) : null;
  const monthDays     = daysInMonth(form.anchor_month);

  return (
    <>
      {/* ── inject checkpoint styles once ── */}
      <style>{`
        .cp-root { background:#f8fafc; border:1px solid #c9d0d4d0; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:12px; }
        .cp-header { display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; color:#475569; }
        .cp-header strong { color:#1e293b; }
        .cp-count { margin-left:auto; background:#c9d0d4d0; color:#64748b; font-size:11px; font-weight:700; border-radius:20px; padding:1px 8px; }
        .cp-loading { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#94a3b8; padding:8px 0; }
        .cp-no-items { font-size:12.5px; color:#94a3b8; padding:6px 0; }
        .cp-empty-hint { font-size:12px; color:#94a3b8; font-style:italic; padding:6px 0; }
        .cp-list { display:flex; flex-direction:column; gap:6px; }
        .cp-item { display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #e8edf3; border-radius:8px; padding:8px 10px; }
        .cp-item-num { font-size:11px; font-weight:700; color:#94a3b8; min-width:18px; text-align:center; font-family:'DM Mono',monospace; }
        .cp-item-text { flex:1; font-size:13px; color:#334155; line-height:1.4; }
        .cp-item-input { flex:1; font-family:'DM Sans',sans-serif; font-size:13px; color:#1e293b; background:#f8fafc; border:1.5px solid #dc2626; border-radius:6px; padding:5px 8px; outline:none; }
        .cp-item-actions { display:flex; gap:4px; flex-shrink:0; }
        .cp-btn { width:26px; height:26px; border-radius:6px; border:1px solid; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .15s; flex-shrink:0; }
        .cp-btn:disabled { opacity:.5; cursor:not-allowed; }
        .cp-btn-save   { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
        .cp-btn-save:hover:not(:disabled)   { background:#dcfce7; }
        .cp-btn-cancel { background:#f8fafc; color:#64748b; border-color:#c9d0d4d0; }
        .cp-btn-cancel:hover { background:#f1f5f9; }
        .cp-btn-edit   { background:#eff6ff; color:#2563eb; border-color:#bfdbfe; }
        .cp-btn-edit:hover { background:#dbeafe; }
        .cp-btn-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
        .cp-btn-delete:hover:not(:disabled) { background:#fee2e2; }
        .cp-add-row { display:flex; gap:8px; }
        .cp-add-input { flex:1; font-family:'DM Sans',sans-serif; font-size:13px; color:#1e293b; background:#fff; border:1.5px solid #c9d0d4d0; border-radius:8px; padding:8px 12px; outline:none; transition:border .15s; }
        .cp-add-input:focus { border-color:#dc2626; box-shadow:0 0 0 3px rgba(220,38,38,.08); }
        .cp-btn-add { display:inline-flex; align-items:center; gap:6px; font-family:'DM Sans',sans-serif; font-size:12.5px; font-weight:700; padding:8px 14px; border-radius:8px; background:#dc2626; color:#fff; border:none; cursor:pointer; white-space:nowrap; transition:background .15s; }
        .cp-btn-add:hover:not(:disabled) { background:#b91c1c; }
        .cp-btn-add:disabled { opacity:.5; cursor:not-allowed; }
        .cp-spinner { display:inline-block; width:12px; height:12px; border:2px solid rgba(0,0,0,.15); border-top-color:currentColor; border-radius:50%; animation:spin .6s linear infinite; }
        .cp-info-banner { display:flex; align-items:flex-start; gap:8px; background:#f5f3ff; border:1px solid #e0e7ff; border-radius:8px; padding:10px 12px; font-size:12.5px; color:#6d28d9; line-height:1.5; }
        .cp-info-banner svg { flex-shrink:0; margin-top:1px; }
      `}</style>

      <div className="ap-form-grid">
        {!hideAssignTo && (
        <div className="ap-field ap-field-center">
            <label className="ap-label">Recurring Task</label>
            <label className="ap-toggle">
              <input type="checkbox" name="is_recurring" checked={form.is_recurring} onChange={handleFormChange}/>
              <span className="ap-toggle-track"><span className="ap-toggle-thumb"/></span>
              <span className="ap-toggle-label">{form.is_recurring ? "Yes" : "No"}</span>
            </label>
          </div>
        )}

        {/* ── Title + Assigned To ── */}
        <div className={`ap-form-row ${hideAssignTo ? "ap-col-1" : "ap-col-2"}`}>
          <div className="ap-field">
            <label className="ap-label">Task Title <span className="ap-req">*</span></label>
            <input className="ap-input" name="title" value={form.title} onChange={handleFormChange} placeholder="e.g. Inspect electrical panel"/>
          </div>
          {!hideAssignTo && (
          <div className="ap-field">
            <label className="ap-label">Assign To <span className="ap-req">*</span></label>
            <select
              className="ap-input ap-select"
              name="assigned_to"
              value={form.assigned_to}
              onChange={handleFormChange}
            >
              <option value="">Select employee…</option>
              {employees
                .filter(e => e.status !== "Inactive")
                .map(e => (
                  <option key={e.username} value={e.username}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>
          )}
        </div>

         {!hideAssignTo && !form.is_recurring && (
            <PendingTaskQueuePanel
              assignedTo={form.assigned_to}
              employeeName={employees.find((e) => e.username === form.assigned_to)?.name}
              form={form}
              setForm={setForm}
            />
          )}
        {/* ── Description ── */}
        <div className="ap-form-row ap-col-1">
          <div className="ap-field">
            <label className="ap-label">Description</label>
            <textarea className="ap-input ap-textarea" name="description" value={form.description} onChange={handleFormChange} placeholder="Add task details, instructions, or notes…" rows={3}/>
          </div>
        </div>

        {/* ── Site / Priority / Status ── */}
        <div className="ap-form-row ap-col-3">
          <div className="ap-field">
            <label className="ap-label">Site Name</label>
            <select className="ap-input ap-select" name="site_name" value={form.site_name} onChange={handleFormChange}>
              <option value="">Select site…</option>
              {sites
                .filter((s) => String(s.status || "").trim().toLowerCase() !== "inactive")
                .sort((a, b) => (a.site_name || "").localeCompare(b.site_name || ""))
                .map((s) => (
                  <option key={s.id} value={s.site_name}>
                    {s.site_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="ap-field">
            <label className="ap-label">Priority</label>
            <select className="ap-input ap-select" name="priority" value={form.priority} onChange={handleFormChange}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        
        <div className="ap-form-row ap-col-2">
        <div className="ap-field">
          <label className="ap-label">
            Hours to Complete
            <span
              className="ap-optional"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#94a3b8",
                background: "#f1f5f9",
                borderRadius: 4,
                padding: "1px 6px",
                marginLeft: 6,
              }}
            >
              optional
            </span>
          </label>
          <input
            className="ap-input"
            type="number"
            min="0"
            step="0.5"
            name="hours_to_complete"
            value={form.hours_to_complete}
            onChange={handleFormChange}
            placeholder="e.g. 4"
          />
        </div>
      </div>
        {/* ── Due Date + Recurring toggle ── */}
        <div className="ap-form-row ap-col-2">
          <div className="ap-field">
            <label className="ap-label">Due Date</label>
            <input className="ap-input" type="date" name="due_date" value={form.due_date} onChange={handleFormChange}/>
          </div>
          
        </div>

        {/* ── Recurrence settings ── */}
        {!hideAssignTo && form.is_recurring && (
          <>
            <div className="ap-recurrence-divider">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Recurrence Schedule
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">Recurrence Pattern <span className="ap-req">*</span></label>
                <div className="ap-recurrence-pills">
                {["daily","weekly","monthly","yearly"].map(r => (
                  <button key={r} type="button" className={`ap-rpill${form.recurrence===r?" Active":""}`} onClick={() => setForm(p=>({...p,recurrence:r}))}>
                    {r.charAt(0).toUpperCase()+r.slice(1)}
                  </button>
                ))}
                </div>
              </div>
            </div>
            {form.recurrence === "weekly" && (
  <div className="ap-form-row ap-col-1">
    <div className="ap-field">
      <label className="ap-label">Repeat on which day?</label>
      <div className="ap-weekday-grid">
        {WEEKDAYS.map((day, i) => (
          <button
            key={day}
            type="button"
            className={`ap-wday${String(form.anchor_weekday) === String(i) ? " Active" : ""}`}
            onClick={() => setForm((p) => ({ ...p, anchor_weekday: String(i) }))}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  </div>
)}

{form.recurrence === "monthly" && (
  <div className="ap-form-row ap-col-2">
    <div className="ap-field">
      <label className="ap-label">Repeat on day of month</label>
      <select
        className="ap-input ap-select"
        name="anchor_day"
        value={form.anchor_day}
        onChange={handleFormChange}
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}{ordinal(d)}</option>
        ))}
      </select>
    </div>
  </div>
)}

{form.recurrence === "yearly" && (
  <div className="ap-form-row ap-col-2">
    <div className="ap-field">
      <label className="ap-label">Month</label>
      <select
        className="ap-input ap-select"
        name="anchor_month"
        value={form.anchor_month}
        onChange={handleFormChange}
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
    </div>
    <div className="ap-field">
      <label className="ap-label">Day</label>
      <select
        className="ap-input ap-select"
        name="anchor_month_day"
        value={form.anchor_month_day}
        onChange={handleFormChange}
      >
        {Array.from({ length: monthDays }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}{ordinal(d)}</option>
        ))}
      </select>
    </div>
  </div>
)}

            {anchorPreview && (
              <div className="ap-anchor-preview">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                This task will auto-generate a new instance <strong>{anchorPreview}</strong>.
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            ── CHECKPOINTS SECTION (new) ──
        ══════════════════════════════════════════════ */}
        <div className="ap-recurrence-divider" style={{marginTop:4}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Task Checkpoints
        </div>

        <div className="ap-form-row ap-col-2">
          <div className="ap-field ap-field-center">
            <label className="ap-label">Reschedule Request</label>
            <label className="ap-toggle">
              <input
                type="checkbox"
                name="reschedule_allowed"
                checked={!!form.reschedule_allowed}
                onChange={handleFormChange}
              />
              <span className="ap-toggle-track"><span className="ap-toggle-thumb"/></span>
              <span className="ap-toggle-label">
                {form.reschedule_allowed ? "Yes — employee can request reschedule" : "No"}
              </span>
            </label>
          </div>

          <div className="ap-field ap-field-center">
            <label className="ap-label">Enable Checkpoints</label>
            <label className="ap-toggle">
              <input
                type="checkbox"
                name="enable_checkpoints"
                checked={!!form.enable_checkpoints}
                onChange={handleFormChange}
              />
              <span className="ap-toggle-track"><span className="ap-toggle-thumb"/></span>
              <span className="ap-toggle-label">{form.enable_checkpoints ? "Yes" : "No"}</span>
            </label>
          </div>
        </div>

        {/* Info pill when checkpoints enabled */}
        {form.enable_checkpoints && (
          <div className="ap-form-row ap-col-1">
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6d28d9",background:"#f5f3ff",border:"1px solid #e0e7ff",borderRadius:8,padding:"7px 12px",width:"fit-content"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {cpCount > 0 ? `${cpCount} checkpoint${cpCount>1?"s":""} defined` : "No checkpoints yet"}
            </div>
          </div>
        )}

        {/* Checkpoint manager panel */}
        {form.enable_checkpoints && (
          <div className="ap-form-row ap-col-1">
            <div className="ap-field">
              <CheckpointManager
                taskTitle={form.title}
                onCountChange={setCpCount}
              />
            </div>
          </div>
        )}

      {/* ── Audio + Document attachments ── */}
<div className="ap-form-row ap-col-2">
  {/* ── Audio Recording ── */}
<div className="ap-field">
  <label className="ap-label">
    Audio Instruction
    <span style={{fontSize:11,fontWeight:500,color:"#94a3b8",background:"#f1f5f9",borderRadius:4,padding:"1px 6px",marginLeft:6}}>optional</span>
  </label>
  <AudioRecorder onRecorded={(file) => setForm(p => ({...p, _audioFile: file}))} />
  <span style={{fontSize:11.5,color:"#94a3b8"}}>Record a voice instruction for this task.</span>
</div>

  <div className="ap-field">
    <label className="ap-label">
      Document Attachment
      <span style={{fontSize:11,fontWeight:500,color:"#94a3b8",background:"#f1f5f9",borderRadius:4,padding:"1px 6px",marginLeft:6}}>optional</span>
    </label>
    <label style={{display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",transition:"border .15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="#dc2626"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2574e2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
      <span style={{flex:1,fontSize:13,color: form._docFile ? "#16a34a" : "#94a3b8",fontWeight: form._docFile ? 600 : 400}}>
        {form._docFile ? `✓ ${form._docFile.name}` : "Click to attach document…"}
      </span>
      <input
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
        style={{display:"none"}}
        onChange={e => setForm(p => ({...p, _docFile: e.target.files[0] || null}))}
      />
    </label>
    {form._docFile && (
      <button
        type="button"
        onClick={() => setForm(p => ({...p, _docFile: null}))}
        style={{alignSelf:"flex-start",fontSize:11.5,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:4}}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Remove document
      </button>
    )}
    <span style={{fontSize:11.5,color:"#94a3b8"}}>PDF, Word, Excel, images. Max 20MB.</span>
  </div>
</div>

        {/* ── Actions ── */}
        <div className="ap-form-row ap-col-1 ap-form-actions">
          <button className="ap-btn-secondary" onClick={() => setForm({ ...EMPTY_FORM })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Reset
          </button>
          <button className="ap-btn-primary" onClick={async () => { const ok = await handleSubmit(); if(ok && onSuccess) onSuccess(); }} disabled={submitting}>
            {submitting
              ? <><span className="ap-mini-spinner"/> {submittingLabel}</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg> {submitLabel}</>}
          </button>
        </div>
      </div>
    </>
  );
}