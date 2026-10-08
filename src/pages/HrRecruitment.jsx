import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import "./HrRecruitment.css";

/* Recruitment inbox — reads rows that the Gmail Apps Script saves into the
   `hr_applications` table. No Google sign-in or Cloud Console needed here. */
const MAILBOX = "dhruvinnaik2108@gmail.com";
const PAGE = 50;
// Web-app URL of the Apps Script (Deploy → Web app) + the SYNC_SECRET you set there.
const SYNC_URL = import.meta.env.VITE_GMAIL_SYNC_URL;
const SYNC_TOKEN = import.meta.env.VITE_GMAIL_SYNC_TOKEN;

const RANGES = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
  { value: 0, label: "All time" },
];

function initialsFor(name) {
  return (
    String(name || "NA")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NA"
  );
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fileIcon(mime = "", name = "") {
  if (/pdf/i.test(mime) || /\.pdf$/i.test(name)) return "PDF";
  if (/word|document/i.test(mime) || /\.docx?$/i.test(name)) return "DOC";
  if (/image/i.test(mime)) return "IMG";
  return "FILE";
}

const gmailUrl = (threadId) =>
  `https://mail.google.com/mail/?authuser=${encodeURIComponent(MAILBOX)}#all/${threadId}`;

function Files({ list }) {
  if (!list?.length) return <span className="hrr-muted">None</span>;
  return (
    <div className="hrr-files">
      {list.map((att) => (
        <a
          key={att.url}
          className="hrr-file"
          href={att.url}
          target="_blank"
          rel="noreferrer"
          title={`${att.name} ${fmtSize(att.size)}`}
        >
          <i>{fileIcon(att.mime, att.name)}</i>
          <span>
            {att.name}
            {fmtSize(att.size) ? ` · ${fmtSize(att.size)}` : ""}
          </span>
        </a>
      ))}
    </div>
  );
}

export default function HrRecruitment({ search = "" }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState(90);
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let query = supabase
      .from("hr_applications")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(limit + 1);
    if (range) {
      const since = new Date(Date.now() - range * 86400000).toISOString();
      query = query.gte("received_at", since);
    }
    const { data, error: err } = await query;
    if (err) {
      setError(err.message || "Could not load applications.");
      setApplications([]);
      setHasMore(false);
    } else {
      setHasMore((data || []).length > limit);
      setApplications((data || []).slice(0, limit));
    }
    setLoading(false);
  }, [range, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Ask Gmail (via the Apps Script) for new mails, then reload the table.
  const syncNow = useCallback(async () => {
    if (!SYNC_URL || !SYNC_TOKEN) {
      setSyncMsg("Live sync is not configured, showing saved mails only.");
      await load();
      return;
    }
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch(`${SYNC_URL}?token=${encodeURIComponent(SYNC_TOKEN)}`);
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "Sync failed");
      setSyncMsg(out.synced ? `${out.synced} new mail(s) fetched.` : "No new mails.");
    } catch (e) {
      setSyncMsg(`Could not fetch from Gmail: ${e.message}`);
    }
    setSyncing(false);
    await load();
  }, [load]);

  // Fetch fresh mail once when the page opens.
  useEffect(() => {
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (attachmentsOnly && !(a.attachments || []).length) return false;
      if (!q) return true;
      return [a.applicant_name, a.applicant_email, a.subject, a.position, a.phone]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [applications, search, attachmentsOnly]);

  const lastSynced = applications.reduce(
    (latest, a) => (a.created_at > latest ? a.created_at : latest),
    "",
  );

  return (
    <div className="hrr">
      <div className="hrr-toolbar">
        <div className="hrr-title">
          <div className="hrr-title-ico">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20c.6-3 2.5-5 6-5s5.4 2 6 5M19 11v6M16 14h6" />
            </svg>
          </div>
          <div>
            <h2>Job applications</h2>
            <p>
              Received at <b>{MAILBOX}</b>
              {lastSynced ? ` · last mail synced ${fmtDate(lastSynced)}` : ""}
            </p>
          </div>
        </div>
        <div className="hrr-toolbar-actions">
          <label className="hrr-field">
            <span>Period</span>
            <select value={range} onChange={(e) => { setLimit(PAGE); setRange(Number(e.target.value)); }}>
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="hrr-check">
            <input type="checkbox" checked={attachmentsOnly} onChange={(e) => setAttachmentsOnly(e.target.checked)} />
            With attachments only
          </label>
          <button type="button" className="hr-quiet-button" disabled={loading || syncing} onClick={syncNow}>
            {syncing ? "Fetching mail…" : "Refresh"}
          </button>
        </div>
      </div>

      {syncMsg && <div className="hrr-sync-note">{syncMsg}</div>}
      {error && <div className="hr-data-alert">Could not load applications: {error}</div>}

      <div className="hrr-card">
        <div className="hrr-card-head">
          <span>
            {loading && !applications.length
              ? "Loading applications…"
              : `${rows.length} application${rows.length === 1 ? "" : "s"}`}
          </span>
          <small>Refresh fetches new mail now · also syncs every 10 minutes</small>
        </div>
        <div className="hrr-table-wrap">
          <table className="hrr-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Subject / Position</th>
                <th>Phone</th>
                <th>Received</th>
                <th>Attachments</th>
                <th>Mail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="hrr-person">
                      <span className="hrr-avatar">{initialsFor(a.applicant_name)}</span>
                      <div>
                        <strong>{a.applicant_name || "Unknown"}</strong>
                        <small>{a.applicant_email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="hrr-subject" title={a.subject}>{a.subject}</div>
                    {a.position && <span className="hrr-position">{a.position}</span>}
                  </td>
                  <td>{a.phone || <span className="hrr-muted">—</span>}</td>
                  <td className="hrr-nowrap">{fmtDate(a.received_at)}</td>
                  <td><Files list={a.attachments} /></td>
                  <td>
                    <div className="hrr-actions">
                      <button type="button" className="hrr-view" onClick={() => setSelected(a)}>View</button>
                      <a className="hrr-gmail" href={gmailUrl(a.gmail_thread_id)} target="_blank" rel="noreferrer">
                        Open in Gmail
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !rows.length && (
            <div className="hr-list-empty">
              No job-application mails yet. Check that the Gmail script is running.
            </div>
          )}
        </div>
        {hasMore && (
          <div className="hrr-more">
            <button type="button" className="hr-quiet-button" disabled={loading} onClick={() => setLimit((l) => l + PAGE)}>
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="hrr-overlay" onClick={() => setSelected(null)}>
          <div className="hrr-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="hrr-modal-head">
              <div>
                <strong>{selected.applicant_name}</strong>
                <small>{selected.applicant_email}</small>
              </div>
              <button type="button" className="hrr-close" aria-label="Close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="hrr-modal-body">
              <h3>{selected.subject}</h3>
              <p className="hrr-modal-meta">
                {fmtDate(selected.received_at)}
                {selected.phone ? ` · ${selected.phone}` : ""}
                {selected.position ? ` · ${selected.position}` : ""}
              </p>
              <pre className="hrr-modal-text">{selected.body || "(empty message)"}</pre>
              <Files list={selected.attachments} />
            </div>
            <div className="hrr-modal-foot">
              <button type="button" className="hr-quiet-button" onClick={() => setSelected(null)}>Close</button>
              <a className="hr-primary-button" href={gmailUrl(selected.gmail_thread_id)} target="_blank" rel="noreferrer">
                Open in Gmail
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}