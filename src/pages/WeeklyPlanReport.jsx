import { useCallback, useEffect, useMemo, useState } from "react";
import { WeeklyPlanAttachmentPreview } from "../components/WeeklyPlanAttachmentPreview";
import { formatWeekDate } from "../lib/weeklyPlanPreview";
import { listWeeklyPlanSubmissions } from "../lib/eaMeeting";
import "./SiteMyTasks.css";

function mapSubmissionRows(items, user) {
  return (items || [])
    .map((row) => ({
      id: row.id,
      week: row.meeting_week_start || "—",
      week_start: row.meeting_week_start || null,
      week_end: row.meeting_week_end || null,
      employee_name: row.employee_name || row.employee_username || "—",
      employee_username: row.employee_username || "—",
      employee_role: row.employee_role || "—",
      site: row.employee_site_name || user?.site_name || "—",
      submitted_at: row.plan_submitted_at,
      file_1_name: row.attachment_1_name || "File 1",
      file_1_url: row.attachment_1_url || "",
      file_2_name: row.attachment_2_name || "File 2",
      file_2_url: row.attachment_2_url || "",
    }))
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
}

function fmt(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(ts);
  }
}

function normKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function WeeklyPlanReport({ user, mdo = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [engineerKey, setEngineerKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await listWeeklyPlanSubmissions(user, { allAssignedSites: mdo });
      setRows(mapSubmissionRows(items, user));
    } catch (err) {
      setError(err.message || "Could not load weekly plan submissions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, mdo]);

  useEffect(() => {
    load();
  }, [load]);

  const weekOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (!row.week_start) return;
      map.set(row.week_start, {
        value: row.week_start,
        label: `${formatWeekDate(row.week_start)} to ${formatWeekDate(row.week_end || row.week_start)}`,
      });
    });
    return [...map.values()].sort((a, b) => b.value.localeCompare(a.value));
  }, [rows]);

  const engineerOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const name = String(row.employee_name || "").trim();
      const username = String(row.employee_username || "").trim();
      const key = normKey(username) || normKey(name);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, name: name || username, username });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const selectedRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedWeek && row.week_start !== selectedWeek) return false;
      if (mdo && engineerKey) {
        const key = normKey(engineerKey);
        const same = normKey(row.employee_username) === key || normKey(row.employee_name) === key;
        if (!same) return false;
      }
      return Boolean(selectedWeek);
    });
  }, [rows, selectedWeek, engineerKey, mdo]);

  return (
    <div className="smt-page smt-page--wide">
      <div className="smt-head">
        <div>
          <h1 className="smt-title">Weekly Plan</h1>
          <p className="smt-sub">
            Submitted EM weekly plan files. The preview matches the uploaded Excel or PDF; click a plan cell to mark it completed.
          </p>
        </div>
        <button type="button" className="smt-refresh" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="smt-error">{error}</div> : null}

      {mdo ? (
        <div className="fgroup" style={{ maxWidth: 360, marginBottom: 12 }}>
          <label className="flabel">Engineer</label>
          <select className="finput" value={engineerKey} onChange={(e) => setEngineerKey(e.target.value)}>
            <option value="">Select engineer</option>
            {engineerOptions.map((eng) => (
              <option key={eng.key} value={eng.key}>
                {eng.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="fgroup" style={{ maxWidth: 360, marginBottom: 18 }}>
        <label className="flabel">Week</label>
        <select className="finput" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
          <option value="">Select week</option>
          {weekOptions.map((week) => (
            <option key={week.value} value={week.value}>
              {week.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="smt-empty">Loading weekly plan submissions…</div>
      ) : rows.length === 0 ? (
        <div className="smt-empty">No submitted weekly plans yet for this site.</div>
      ) : mdo && !engineerKey ? (
        <div className="smt-empty">Select an engineer to view the weekly plan.</div>
      ) : !selectedWeek ? (
        <div className="smt-empty">Select a week to view the weekly plan.</div>
      ) : selectedRows.length === 0 ? (
        <div className="smt-empty">No submitted weekly plans found for this selection.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", minWidth: 0 }}>
          {selectedRows.map((r) => (
            <div key={r.id} className="smt-excel-card">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Week: <strong>{r.week}</strong>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.employee_name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {r.employee_role} · {r.site}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Submitted {fmt(r.submitted_at)}</div>
              </div>

              {r.file_1_url ? (
                <WeeklyPlanAttachmentPreview
                  eaId={r.id}
                  sourceFile="attachment_1"
                  fileUrl={r.file_1_url}
                  fileName={r.file_1_name}
                />
              ) : null}

              {r.file_2_url ? (
                <div style={{ marginTop: 16 }}>
                  <WeeklyPlanAttachmentPreview
                    eaId={r.id}
                    sourceFile="attachment_2"
                    fileUrl={r.file_2_url}
                    fileName={r.file_2_name}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
