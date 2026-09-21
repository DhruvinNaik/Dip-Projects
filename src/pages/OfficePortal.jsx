import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Navbar from "../components/Navbar";
import PortalFloaters from "../components/PortalFloaters";
import { supabase } from "../supabase";
import SiteReport from "./Sitereport";
import Checklists from "./Checklists";
import "./OfficePortal.css";
import { canAccessPortal, filterNav, hasPermission, hasAdminCapability } from "../access.js";
import { pickPermissionFields } from "../lib/permissions";
import PortalSwitcher from "../components/PortalSwitcher";
import {
  resolveApprovalChain,
  deriveLeaveStatus,
  mergeRejectionReason,
} from "./SitePortal";

// ── Nav Items ──────────────────────────────────────────────────────────────
const TASK_NAV = [
  {
    key: "my-tasks",
    label: "My Tasks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "recurring-tasks",
    label: "Recurring Tasks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
    {
      key: "all-tasks",
      label: "Tasks History",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16M4 12h16M4 19h16" />
          <circle cx="7" cy="5" r="1" fill="#2563eb" />
          <circle cx="7" cy="12" r="1" fill="#2563eb" />
          <circle cx="7" cy="19" r="1" fill="#2563eb" />
        </svg>
      ),
    },
  {
    key: "my-reschedules",
    label: "My Reschedule Requests",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M12 13a3 3 0 1 1-2.6 4.5" />
        <polyline points="9.5 17.5 9.5 14.5 12.5 14.5" />
      </svg>
    ),
  },
];
const VERIFIED_TASKS_ITEM = {
  key: "verified-tasks",
  label: "Verified Tasks",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
};

const TASK_CORRECTIONS_ITEM = {
  key: "task-corrections",
  label: "Task Corrections",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

const NEW_TICKETS_ITEM = {
  key: "new-tickets",
  label: "New Tickets",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const TICKETS_NAV = [
  {
    key: "raised-tickets",
    label: "Raised Tickets",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
        <path d="M12 7v10" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    key: "solved-tickets",
    label: "Solved Tickets",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

const VERIFY_REQUESTS_ITEM = {
  key: "verify-requests",
  label: "Reschedule Requests",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};
const LEAVE_NAV = [
  {
    key: "apply-leave",
    label: "Apply Leave",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="12" y1="14" x2="12" y2="18" />
        <line x1="10" y1="16" x2="14" y2="16" />
      </svg>
    ),
  },
  {
    key: "my-leaves",
    label: "My Leaves",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
  {
    key: "proxy-request",
    label: "Leave Approvals",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M19 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const REPORTS_NAV = [
  {
    key: "add-drawings",
    label: "Add Drawings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="12" height="14" rx="1" />
        <path d="M6 9h6M6 12h6M6 15h4" />
        <path d="M16 16l5-5 2 2-5 5-3 1z" />
      </svg>
    ),
  },
  {
    key: "all-drawings",
    label: "All Drawings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 9h18" />
        <path d="M9 3v18" />
        <path d="M15 3v18" />
        <path d="M3 15h18" />
      </svg>
    ),
  },
  {
    key: "site-report",
    label: "Site Report",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
        <polyline points="9 9 10 9 11 9" />
      </svg>
    ),
  },
  {
    key: "my-reports",
    label: "My Reports",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v3" />
        <polyline points="14 3 14 8 19 8" />
        <path d="M12 22l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "checklists",
    label: "Checklists",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
];

const REPORT_SUBMISSIONS_ITEM = {
  key: "report-submissions",
  label: "Report Submissions",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
};
const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Earned Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Compensatory Leave",
  "Unpaid Leave",
];

const PRIORITY_STYLES = {
  high: { bg: "#fef2f2", color: "#dc2626", dot: "#dc2626" },
  medium: { bg: "#fffbeb", color: "#d97706", dot: "#d97706" },
  low: { bg: "#f0fdf4", color: "#16a34a", dot: "#16a34a" },
};

const STATUS_STYLES = {
  pending: { bg: "#f1f5f9", color: "#64748b" },
  in_progress: { bg: "#eff6ff", color: "#2563eb" },
  completed: { bg: "#f0fdf4", color: "#16a34a" },
  not_applicable: { bg: "#f3f4f6", color: "#6b7280" },
};

const EMPTY_FILTERS = {
  dateFrom: "",
  dateTo: "",
  site: "",
  priority: "",
  status: "",
  assignedBy: "",
};
function buildDownloadUrl(url, filename) {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(filename || "report.pdf")}`;
}
function isOfficeDoc(url) {
  return /\.(pptx|ppt|docx|doc|xlsx|xls)(\?|$)/i.test(url || "");
}

function getViewUrl(url) {
  if (!url) return url;
  if (isOfficeDoc(url)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
  }
  return url; // pdf, images, etc. — browser can render natively
}
// ── Filter Bar ─────────────────────────────────────────────────────────────
function TaskFilterBar({
  filters,
  onChange,
  onClear,
  taskList,
  showAssignedBy,
  userMap = {},
}) {
  const sitesFiltered = applyFilters(taskList, { ...filters, site: "" });
  const priorityFiltered = applyFilters(taskList, { ...filters, priority: "" });
  const statusFiltered = applyFilters(taskList, { ...filters, status: "" });
  const assigneeFiltered = applyFilters(taskList, {
    ...filters,
    assignedBy: "",
  });

  const sites = useMemo(
    () =>
      [
        ...new Set(sitesFiltered.map((t) => t.site_name).filter(Boolean)),
      ].sort(),
    [JSON.stringify(sitesFiltered)],
  );
  const assignees = useMemo(
    () =>
      [
        ...new Set(assigneeFiltered.map((t) => t.assigned_by).filter(Boolean)),
      ].sort(),
    [JSON.stringify(assigneeFiltered)],
  );
  const priorities = useMemo(
    () =>
      [
        ...new Set(priorityFiltered.map((t) => t.priority).filter(Boolean)),
      ].sort(),
    [JSON.stringify(priorityFiltered)],
  );
  const statuses = useMemo(
    () =>
      [...new Set(statusFiltered.map((t) => t.status).filter(Boolean))].sort(),
    [JSON.stringify(statusFiltered)],
  );
  const isActive = Object.values(filters).some((v) => v !== "");

  return (
    <div className="tf-bar">
      {/* Date range */}
      <div className="tf-group">
        <span className="tf-label">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Due date
        </span>
        <input
          className="tf-input tf-date"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange("dateFrom", e.target.value)}
          title="From"
        />
        <span className="tf-sep-text">–</span>
        <input
          className="tf-input tf-date"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom}
          onChange={(e) => onChange("dateTo", e.target.value)}
          title="To"
        />
      </div>

      <div className="tf-divider" />

      {/* Site */}
      {sites.length > 0 && (
        <>
          <div className="tf-group">
            <span className="tf-label">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <select
              className="tf-select"
              value={filters.site}
              onChange={(e) => onChange("site", e.target.value)}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="tf-divider" />
        </>
      )}

      {/* Priority */}
      <div className="tf-group">
        <span className="tf-label">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </span>
        <select
          className="tf-select"
          value={filters.priority}
          onChange={(e) => onChange("priority", e.target.value)}
        >
          <option value="">All priorities</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="tf-divider" />


      {/* Given By — only for delegated tab */}
      {showAssignedBy && assignees.length > 0 && (
        <>
          <div className="tf-divider" />
          <div className="tf-group">
            <span className="tf-label">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Given by
            </span>
            <select
              className="tf-select"
              value={filters.assignedBy}
              onChange={(e) => onChange("assignedBy", e.target.value)}
            >
              <option value="">Anyone</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {userMap[a] || a}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Clear */}
      {isActive && (
        <button className="tf-clear" onClick={onClear}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Clear filters
        </button>
      )}
    </div>
  );
}

function applyFilters(tasks, filters) {
  return tasks.filter((t) => {
    if (filters.site && t.site_name !== filters.site) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.assignedBy && t.assigned_by !== filters.assignedBy)
      return false;
    if (filters.dateFrom && t.due_date && t.due_date < filters.dateFrom)
      return false;
    if (filters.dateTo && t.due_date && t.due_date > filters.dateTo)
      return false;
    return true;
  });
}
function getAdminRejectionReason(leave) {
  if (leave.admin_note) return leave.admin_note;
  if (Array.isArray(leave.rejection_reason)) {
    const found = leave.rejection_reason.find(
      (r) => r && typeof r === "object" && r.reason,
    );
    if (found) return found.reason;
  }
  if (
    typeof leave.rejection_reason === "string" &&
    leave.rejection_reason.trim()
  )
    return leave.rejection_reason;
  return null;
}
// ── Leave status helpers ───────────────────────────────────────────────────
function computeLeaveStatus(leave) {
  if (leave.level_approver_user_name || leave.head_approver_user_name) {
    const s = (leave.status || "").toLowerCase();
    if (s === "approved" || s === "rejected") return s;
    return "pending";
  }
  if (leave.admin_approved === false || leave.proxy_approved === false)
    return "rejected";
  const proxyDone = !leave.proxy_user_name || leave.proxy_approved === true;
  if (leave.admin_approved === true && proxyDone) return "approved";
  return "pending";
}

const LEAVE_STATUS_STYLE = {
  pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  approved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

function LeaveBadge({ leave }) {
  const status = computeLeaveStatus(leave);
  const st = LEAVE_STATUS_STYLE[status];
  const icons = {
    pending: (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    approved: (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    rejected: (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 20,
        background: st.bg,
        color: st.color,
        border: `1px solid ${st.border}`,
      }}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ApprovalPips({ leave }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      {leave.level_approver_user_name && (
        <ApprovalPip
          label={`${leave.level_approver_role || "Level"} (${leave.level_approver_name || leave.level_approver_user_name})`}
          state={leave.level_approved}
        />
      )}
      {leave.head_approver_user_name && (
        <ApprovalPip
          label={`${leave.head_approver_role || "Head"} (${leave.head_approver_name || leave.head_approver_user_name})`}
          state={leave.head_approved}
        />
      )}
    </div>
  );
}

function ApprovalPip({ label, state }) {
  const cfg =
    state === true
      ? { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", icon: "✓" }
      : state === false
        ? { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", icon: "✗" }
        : { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0", icon: "…" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 6,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.icon} {label}
    </span>
  );
}

// ── TaskCard ───────────────────────────────────────────────────────────────
function TaskCard({ task, onStatusChange, updating, onReschedule, onClick, userMap = {} }) {
  const p = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const s = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
  return (
    <div
      className="op-task-card"
      onClick={() => onClick?.(task)}
      style={{ cursor: "pointer" }}
    >
      <div className="op-task-top">
        <div className="op-task-title">{task.title}</div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {task.audio_url && (
            <span
              title="Has audio"
              style={{
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </span>
          )}
          {task.document_url && (
            <span
              title="Has document"
              style={{
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
          )}
          <span
            className="op-badge"
            style={{ background: p.bg, color: p.color }}
          >
            <span className="op-badge-dot" style={{ background: p.dot }} />
            {task.priority}
          </span>
        </div>
      </div>
      {task.description && <p className="op-task-desc">{task.description}</p>}
      <div className="op-task-meta">
        {task.hours_to_complete && (
          <span className="op-meta-pill">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {task.hours_to_complete} hrs
          </span>
        )}
        {task.due_date && (
          <span className="op-meta-pill">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {new Date(task.due_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
        {task.site_name && (
          <span className="op-meta-pill">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {task.site_name}
          </span>
        )}
        {task.assigned_by && (
          <span className="op-meta-pill">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            by {userMap[task.assigned_by] || task.assigned_by}
          </span>
        )}
        {task.is_recurring && task.recurrence && (
          <span className="op-meta-pill op-pill-blue">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {task.recurrence}
          </span>
        )}
        {task.reschedule_allowed && (
          <span
            className="op-meta-pill"
            style={{
              color: "#7c3aed",
              background: "#f5f3ff",
              borderColor: "#e0e7ff",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reschedule enabled
          </span>
        )}
      </div>
      <div className="op-task-footer" onClick={(e) => e.stopPropagation()}>
        <span className="op-badge" style={{ background: s.bg, color: s.color }}>
          {task.status
            ?.replace("_", " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        {updating === task.id && <span className="op-saving">saving…</span>}
        {task.reschedule_allowed && task.status !== "completed" && (
          <button
            className="op-reschedule-btn"
            onClick={(e) => {
              e.stopPropagation();
              onReschedule(task);
            }}
            title="Request reschedule"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reschedule
          </button>
        )}
      </div>
    </div>
  );
}
function TaskActionMenu({
  task,
  onAccept,
  onHold,
  onContinue,
  onReschedule,
  onSendVerification,
  onRaiseTicket,
  recurringMode = false,
  onDone,
  onNotApplicable,
  hasPendingVerification = false,
  hasPendingReschedule = false,
  hasOpenTicket = false,
  onRejectTask,   // ← add
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [hoveredKey, setHoveredKey] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isCompleted = task.status === "completed";
  const isNotApplicable = task.status === "not_applicable"; // ← add
  const isAccepted = !!task.accepted_at;
  const isHeld = !!task.is_held;
  const canReschedule = task.reschedule_allowed && !isCompleted;

  // ── Recurring tasks: only Done / Not Applicable ──────────────────────
  if (recurringMode) {
    if (isCompleted || isNotApplicable) {
      return (
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: isCompleted ? "#16a34a" : "#94a3b8",
          }}
        >
          {isCompleted ? "✓ Completed" : "— Not Applicable"}
        </span>
      );
    }
    return (
      <div
        style={{ display: "flex", gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onDone?.(task)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 7,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#16a34a",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Done
        </button>
        <button
          onClick={() => onNotApplicable?.(task)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 7,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            color: "#64748b",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Not Applicable
        </button>
      </div>
    );
  } 

  // Not yet accepted — standalone Accept button, no dropdown
  if (!isAccepted && !isCompleted) {
    return (
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onAccept(task)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 14px",
            borderRadius: 7,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#16a34a",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#dcfce7")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#f0fdf4")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
          </svg>
          Accept Task
        </button>
        <button
          onClick={() => {
            console.log("Reject clicked, onRejectTask is:", onRejectTask);
            onRejectTask?.(task);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 7,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#dc2626",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Reject
        </button>
      </div>
    );
  }

 const handleMenuOpen = (e) => {
    if (isCompleted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 210;
    setMenuPosition({
      top: spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: rect.right - 260, // ← widened from 220
    });
    setMenuOpen(true);
  };

  const items = [
  {
    key: "verify",
    label: hasPendingVerification ? "Verification Sent" : "Send for Verification",
    disabled: hasPendingVerification,
    disabledReason: "Already sent — waiting on admin review",
    color: "#16a34a",
    bg: "#f0fdf4",
    onClick: () => !hasPendingVerification && onSendVerification(task),
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    key: "hold",
    label: isHeld ? "Continue Task" : "Hold Task",
    color: isHeld ? "#2563eb" : "#d97706",
    bg: isHeld ? "#eff6ff" : "#fffbeb",
    onClick: () => (isHeld ? onContinue(task) : onHold(task)),
    icon: isHeld ? (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ) : (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
    ),
  },
  {
    key: "reschedule",
    label: hasPendingReschedule ? "Reschedule Requested" : "Reschedule",
    disabled: !canReschedule || hasPendingReschedule,
    disabledReason: hasPendingReschedule
      ? "Already requested — waiting on approval"
      : "Reschedule not enabled for this task",
    color: "#7c3aed",
    bg: "#f5f3ff",
    onClick: () => canReschedule && !hasPendingReschedule && onReschedule(task),
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
  {
    key: "ticket",
    label: hasOpenTicket ? "Ticket Raised" : "Raise Ticket",
    disabled: hasOpenTicket,
    disabledReason: "You already have an open ticket for this task",
    color: "#dc2626",
    bg: "#fef2f2",
    onClick: () => !hasOpenTicket && onRaiseTicket(task),
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        <line x1="12" y1="10" x2="12" y2="14" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];


  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
      {isHeld && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10.5,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 20,
            background: "#fffbeb",
            color: "#d97706",
            border: "1px solid #fde68a",
            marginRight: 8,
            whiteSpace: "nowrap",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          Held
        </span>
      )}
      <button
        className="tt-action-btn"
        onClick={handleMenuOpen}
        disabled={isCompleted}
        title={isCompleted ? "Task completed — no actions available" : "Actions"}
        style={isCompleted ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {menuOpen && !isCompleted && (
        <div
          className="tt-action-menu"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: 240,
            zIndex: 9999,
          }}
        >
          {items.map((item) => {
            const hovered = hoveredKey === item.key && !item.disabled;
            return (
              <button
                  key={item.key}
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledReason : undefined}   // ← add
                  onMouseEnter={() => setHoveredKey(item.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => {
                    if (item.disabled) return;
                    setMenuOpen(false);
                    item.onClick();
                  }}
                  style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: hovered ? item.bg : "transparent",
                  border: "none",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  color: item.disabled ? "#94a3b8" : hovered ? item.color : "#334155", // ← darker disabled text (was #cbd5e1)
                  opacity: item.disabled ? 1 : 1,
                  transition: "background .12s, color .12s",
                }}
              >
                <span style={{ display: "flex", flexShrink: 0, color: item.disabled ? "#94a3b8" : item.color }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function getActivityBadge(task, maps) {
  if (!maps) return null;
  const { verificationMap, rescheduleMap, ticketMap } = maps;
  if (verificationMap?.has(task.id)) {
    return { label: "Sent for Verification", bg: "#eff6ff", color: "#2563eb" };
  }
  if (rescheduleMap?.has(task.id)) {
    return { label: "Reschedule Requested", bg: "#f5f3ff", color: "#7c3aed" };
  }
  if (ticketMap?.has(task.id)) {
    return { label: "Ticket Raised", bg: "#fff7ed", color: "#ea580c" };
  }
  return null;
}
// ── Task Table ─────────────────────────────────────────────────────────────
function TaskTable({
  tasks,
  onStatusChange,
  updating,
  onReschedule,
  onClick,
  showAssignedBy,
  showRecurrence = true,
  userMap = {},
  onSendVerification,
  onRaiseTicket,
  onAccept,
  onHold,
  onContinue,
  recurringMode = false,
  onDone,               
  onNotApplicable,   
  activityMaps,     
  onRejectTask,
}) {
  const nameFor = (username) => userMap[username] || username || "—";

  return (
    <div className="tt-wrap">
      <table className="tt-table">
          <thead>
            <tr>
              <th>Title</th>
              {showAssignedBy && <th>Assigned To</th>}
              <th>Site</th>
              {showAssignedBy && <th>Given By</th>}
              {!recurringMode && <th>Hrs</th>}
              <th>Due Date</th>
              {!recurringMode && <th>Priority</th>}
              {!recurringMode && <th>Status</th>}
              <th style={!showRecurrence ? { display: "none" } : undefined}>Recurrence</th>
              {!recurringMode && <th>Files</th>}
              <th>Action</th>
            </tr>
          </thead>
        <tbody>
          {tasks.map((task) => {
            const p = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
            const s = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
            const activity = getActivityBadge(task, activityMaps);
            return (
              <tr key={task.id} className="tt-row" onClick={() => onClick?.(task)}>
                <td className="tt-title-cell">
                  <div className="tt-title">{task.title}</div>
                  {task.description && <div className="tt-desc">{task.description}</div>}
                </td>
                {showAssignedBy && <td>{nameFor(task.assigned_to)}</td>}
                <td>{task.site_name || "—"}</td>
                {showAssignedBy && <td>{nameFor(task.assigned_by)}</td>}
                {!recurringMode && ( <td>{task.hours_to_complete ? `${task.hours_to_complete} hrs` : "—"}</td>)}
                  <td>
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                {!recurringMode && (
                  <td>
                    <span className="op-badge" style={{ background: p.bg, color: p.color }}>
                      <span className="op-badge-dot" style={{ background: p.dot }} />
                      {task.priority}
                    </span>
                  </td>
                )}
                {!recurringMode && (
                  <td>
                    <span
                      className="op-badge"
                      style={{
                        background: activity ? activity.bg : s.bg,
                        color: activity ? activity.color : s.color,
                      }}
                    >
                      {activity
                        ? activity.label
                        : task.status?.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </td>
                )}
                <td style={!showRecurrence ? { display: "none" } : undefined}>
                  {task.recurrence ? (
                    <span className="op-meta-pill op-pill-blue">
                      {task.recurrence.charAt(0).toUpperCase() + task.recurrence.slice(1).toLowerCase()}
                    </span>
                  ) : isRecurringTask(task) ? (
                    <span
                      className="op-meta-pill"
                      style={{ color: "#d97706", background: "#fffbeb", borderColor: "#fde68a" }}
                      title="This recurring task has no frequency set"
                    >
                      ⚠ No frequency set
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                {!recurringMode && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {task.audio_url && (
                        <span title="Has audio" style={{ color: "#7c3aed" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          </svg>
                        </span>
                      )}
                      {task.document_url && (
                        <span title="Has document" style={{ color: "#2563eb" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                )}
                <td onClick={(e) => e.stopPropagation()}>
                  <TaskActionMenu
                    task={task}
                    onAccept={onAccept}
                    onHold={onHold}
                    onContinue={onContinue}
                    onReschedule={onReschedule}
                    onSendVerification={onSendVerification}
                    onRaiseTicket={onRaiseTicket}
                    recurringMode={recurringMode}
                    onDone={onDone}
                    onNotApplicable={onNotApplicable}
                    hasPendingVerification={!!activityMaps?.verificationMap?.has(task.id)}
                    hasPendingReschedule={!!activityMaps?.rescheduleMap?.has(task.id)}
                    hasOpenTicket={!!activityMaps?.ticketMap?.has(task.id)}
                    onRejectTask={onRejectTask}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
} 

function TaskHistoryTable({
  tasks,
  onDetailClick,
  onReschedule,
  onSendVerification,
  onRaiseTicket,
  onAccept,
  onHold,
  onContinue,
}) {
  const fmtDate = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const STOPPED_STATUSES = ["completed", "not_applicable"];
  const formatHours = (task) => {
    let seconds = Number(task.accumulated_seconds) || 0;
    // Only keep the live clock running while the task is actually
    // active — accepted, not held, and not in a terminal status.
    if (task.accepted_at && !task.is_held && !STOPPED_STATUSES.includes(task.status)) {
      seconds += Math.max(0, Math.floor((Date.now() - new Date(task.resumed_at || task.accepted_at)) / 1000));
    }
    if (seconds <= 0) return "—";
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(2)} hrs`;
  };
  const statusFor = (task) => {
    if (task.status === "completed") return "completed";
    if (task.status === "not_applicable") return "not applicable";
    if (task.accepted_at) return task.is_held ? "on hold" : "working";
    return task.status || "pending";
  };
  const statusLabel = (status) =>
    status.replace("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Site</th>
            <th>Priority</th>
            <th>Planned Hrs</th>
            <th>Due Date</th>
            <th>Hrs Taken</th>
            <th>Completed Date</th>
            <th>Status</th>
            <th>File</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const priority = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
            const status = statusFor(task);
            const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
            const completedDate = task.completed_at || task.completed_date || task.completion_date || (task.status === "completed" ? task.updated_at : null);
            const isPending = task.status === "pending" && !task.accepted_at;
            return (
              <tr key={task.id} className="tt-row" onClick={() => onDetailClick?.(task)}>
                <td className="tt-title-cell">
                  <div className="tt-title">{task.title}</div>
                  {task.description && <div className="tt-desc">{task.description}</div>}
                </td>
                <td>{task.site_name || "—"}</td>
                <td>
                  <span className="op-badge" style={{ background: priority.bg, color: priority.color }}>
                    <span className="op-badge-dot" style={{ background: priority.dot }} />
                    {task.priority || "Medium"}
                  </span>
                </td>
                <td>{task.hours_to_complete ? `${task.hours_to_complete} hrs` : "—"}</td>
                <td>{fmtDate(task.due_date)}</td>
                <td>{formatHours(task)}</td>
                <td>{fmtDate(completedDate)}</td>
                <td>
                  <span className="op-badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {statusLabel(status)}
                  </span>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {task.audio_url && <a href={task.audio_url} target="_blank" rel="noopener noreferrer">Audio</a>}
                    {task.document_url && <a href={task.document_url} target="_blank" rel="noopener noreferrer">Document</a>}
                    {!task.audio_url && !task.document_url && "—"}
                  </div>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  {task.status === "completed" ? (
                    <span style={{ color: "#16a34a", fontSize: 11.5, fontWeight: 700 }}>✓ Completed</span>
                  ) : task.status === "not_applicable" ? (
                    <span style={{ color: "#94a3b8", fontSize: 11.5, fontWeight: 600 }}>— Not Applicable</span>
                  ) : isPending ? (
                    <TaskActionMenu
                      task={task}
                      onAccept={onAccept}
                      onHold={onHold}
                      onContinue={onContinue}
                      onReschedule={onReschedule}
                      onSendVerification={onSendVerification}
                      onRaiseTicket={onRaiseTicket}
                    />
                  ) : (
                    <span style={{ color: "#64748b", fontSize: 11.5, fontWeight: 600 }}>
                      {task.is_held ? "On hold" : "In progress"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskList({
  tasks,
  loading,
  onStatusChange,
  updatingId,
  emptyText,
  filters,
  onFilterChange,
  onFilterClear,
  showAssignedBy,
  allTasks,
  onReschedule,
  onDetailClick,
  showRecurrence = true,
  userMap = {},
  onSendVerification,
  onRaiseTicket,
  onAccept,
  onHold,
  onContinue,
  recurringMode = false,   // ← add
  onDone,                  // ← add     
  onNotApplicable,         // ← add 
  activityMaps, 
  onRejectTask,
}) {
  const filtered = applyFilters(tasks, filters);
  const hasActiveFilters = Object.values(filters).some((v) => v !== "");
  if (loading)
    return (
      <div className="op-empty-state">
        <div className="op-spinner" />
        <p className="op-empty-text">Loading tasks…</p>
      </div>
    );
  return (
    <>
      {hasActiveFilters && (
        <p className="tf-count">
          Showing {filtered.length} of {tasks.length} task
          {tasks.length !== 1 ? "s" : ""}
        </p>
      )}
      {filtered.length === 0 ? (
        <div className="op-empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.3 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="13" y2="13" />
          </svg>
          <p className="op-empty-text">
            {hasActiveFilters
              ? "No tasks match the current filters."
              : emptyText}
          </p>
        </div>
      ) : (
        <TaskTable
          tasks={filtered}
          onStatusChange={onStatusChange}
          updating={updatingId}
          onReschedule={onReschedule}
          onClick={onDetailClick}
          showRecurrence={showRecurrence}
          userMap={userMap}
          onSendVerification={onSendVerification}
          onRaiseTicket={onRaiseTicket}
          onAccept={onAccept}
          onHold={onHold}
          onContinue={onContinue}
         recurringMode={recurringMode}     
          onDone={onDone}                      
          onNotApplicable={onNotApplicable}  
           activityMaps={activityMaps}
           onRejectTask={onRejectTask}
        />
      )}
    </>
  );
}
function MyLeaveTable({ leaves }) {
  const fmt = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Leave Type</th>
            <th>From</th>
            <th>To</th>
            <th>Days</th>
            <th>Reason</th>
            <th>Approval</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((l) => {
            const days =
              l.from_date && l.to_date
                ? Math.ceil(
                    (new Date(l.to_date) - new Date(l.from_date)) /
                      (1000 * 60 * 60 * 24),
                  ) + 1
                : null;
            return (
              <tr key={l.id} className="tt-row">
                <td className="tt-title-cell">
                  <div className="tt-title">{l.leave_type}</div>
                </td>
                <td>{fmt(l.from_date)}</td>
                <td>{fmt(l.to_date)}</td>
                <td>{days ? `${days} day${days > 1 ? "s" : ""}` : "—"}</td>
                <td style={{ maxWidth: 220 }}>
                  {l.reason ? (
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      {l.reason}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  {l.level_approver_user_name || l.head_approver_user_name ? (
                    <ApprovalPips leave={l} />
                  ) : computeLeaveStatus(l) === "rejected" ? (
                    <span style={{ fontSize: 12, color: "#dc2626" }}>
                      {getAdminRejectionReason(l) || "—"}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <LeaveBadge leave={l} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function NewTicketsTable({ tickets, onSolve, updatingId, canSolve }) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const statusStyle = {
    open: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    solved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  };

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Raised By</th>
            <th>Site</th>
            <th>Query</th>
            <th>Attachment</th>
            <th>Raised On</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const sc = statusStyle[t.status] || statusStyle.open;
            return (
              <tr key={t.id} className="tt-row">
                <td className="tt-title-cell">
                  <div className="tt-title">{t.task_title || "—"}</div>
                </td>
                <td>{t.raised_by_name || "—"}</td>
                <td>{t.site_name || "—"}</td>
                <td style={{ maxWidth: 220 }}>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>
                    {t.query}
                  </span>
                </td>
                <td>
                  {t.document_url ? (
                    <a
                      href={t.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: "#2563eb",
                        fontWeight: 600,
                      }}
                    >
                      View file
                    </a>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>{fmt(t.created_at)}</td>
                <td>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </span>
                  {t.status === "solved" && t.resolution_note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#16a34a",
                        marginTop: 4,
                        maxWidth: 180,
                      }}
                    >
                      {t.resolution_note}
                    </div>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {t.status === "open" ? (
                    canSolve ? (
                      <button
                        className="lv-btn-approve"
                        disabled={updatingId === t.id}
                        onClick={() => onSolve(t)}
                      >
                        Mark Solved
                      </button>
                    ) : (
                      <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Open</span>
                    )
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      ✓ Solved
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MyVerificationTable({
  verifications,
  onRowClick,
  allTasks,
  onReschedule,
  onSendVerification,
  onRaiseTicket,
  onAccept,
  onHold,
  onContinue,
  showAction = false,
}) {
  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const statusStyle = {
    pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "Pending" },
    completed: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Verified" },
    correction_sent: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "Correction Sent" },
  };

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Site</th>
            <th>Sent To</th>
            <th>Sent On</th>
            <th>Your Files</th>
            <th>Status</th>
            {showAction && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {verifications.map((v) => {
            const sc = statusStyle[v.status] || statusStyle.pending;
            const task = allTasks?.find((t) => t.id === v.task_id);
            return (
              <tr key={v.id} className="tt-row" onClick={() => onRowClick?.(v)} style={{ cursor: "pointer" }}>
                <td className="tt-title-cell">
                  <div className="tt-title">{v.task_title || "—"}</div>
                </td>
                <td>{v.site_name || "—"}</td>
                <td>{v.verifier_name || "—"}</td>
                <td>{fmt(v.created_at)}</td>
                <td>
                  {v.document_urls?.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {v.document_urls.map((url, i) => (
                        
                        <a  key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 11.5, fontWeight: 600, color: "#2563eb" }}
                        >
                          File {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700,
                      padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {sc.label}
                  </span>
                  {v.status === "correction_sent" && v.correction_note && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, maxWidth: 240 }}>
                      {v.correction_note}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {v.correction_audio_url && (
                      
                        <a href={v.correction_audio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#7c3aed",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#7c3aed"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                        <span>Audio</span>
                      </a>
                    )}
                    {v.correction_document_urls?.map((url, i) => (
                      
                        <a key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#0369a1",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0369a1"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Doc {i + 1}</span>
                      </a>
                    ))}
                  </div>
                  {v.status === "completed" && v.resolved_by && (
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>
                      Verified by {v.verifier_name || "—"}
                    </div>
                  )}
                </td>
                {showAction && (
                  <td onClick={(e) => e.stopPropagation()}>
                    {task ? (
                      <TaskActionMenu
                        task={task}
                        onAccept={onAccept}
                        onHold={onHold}
                        onContinue={onContinue}
                        onReschedule={onReschedule}
                        onSendVerification={onSendVerification}
                        onRaiseTicket={onRaiseTicket}
                      />
                    ) : (
                      <span style={{ fontSize: 11.5, color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RaisedTicketsTable({ tickets, onRowClick }) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const statusStyle = {
    open: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    solved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  };

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Sent To</th>
            <th>Site</th>
            <th>Query</th>
            <th>Attachment</th>
            <th>Raised On</th>
            <th>Status</th>
            <th>Resolution</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const sc = statusStyle[t.status] || statusStyle.open;
            return (
             <tr
              key={t.id}
              className="tt-row"
              onClick={() => {
                console.log("row clicked", t);
                onRowClick?.(t);
              }}
              style={{ cursor: "pointer" }}
            >
                <td className="tt-title-cell">
                  <div className="tt-title">{t.task_title || "—"}</div>
                </td>
                <td>{t.assigned_to_name || "—"}</td>
                <td>{t.site_name || "—"}</td>
                <td style={{ maxWidth: 220 }}>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>
                    {t.query}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {t.document_url ? (

                    <a  href={t.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: "#2563eb",
                        fontWeight: 600,
                      }}
                    >
                      View file
                    </a>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>{fmt(t.created_at)}</td>

                <td>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </span>
                </td>

                <td onClick={(e) => e.stopPropagation()}>
                  {t.status === "solved" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {t.resolution_note && (
                        <span style={{ fontSize: 11.5, color: "#16a34a" }}>
                          {t.resolution_note}
                        </span>
                      )}
                      {t.resolution_document_url ? (
                        
                        <a  href={t.resolution_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#2563eb",
                            fontWeight: 600,
                          }}
                        >
                          View resolution file
                        </a>
                      ) : !t.resolution_note ? (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      ) : null}
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VerifyRequestsTable({ requests, onApprove, onReject, updatingId, userMap = {} }) {
  const fmt = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const statusStyle = {
    pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    approved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  };

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Requested By</th>
            <th>Site</th>
            <th>Current Due</th>
            <th>Requested Date</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => {
            const sc = statusStyle[req.status] || statusStyle.pending;
            const isPending = req.status === "pending";
            return (
              <tr key={req.id} className="tt-row">
                <td className="tt-title-cell">
                  <div className="tt-title">
                    {req.tasks?.title || `Task #${req.task_id}`}
                  </div>
                </td>
                  <td>{userMap[req.requested_by] || req.requested_by}</td>
                <td>{req.tasks?.site_name || "—"}</td>
                <td>{fmt(req.current_due)}</td>
                <td style={{ color: "#7c3aed", fontWeight: 600 }}>
                  {fmt(req.requested_date)}
                </td>
                <td style={{ maxWidth: 200 }}>
                  {req.reason ? (
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      {req.reason}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                  {req.status === "rejected" && req.admin_note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#dc2626",
                        marginTop: 4,
                        maxWidth: 180,
                      }}
                    >
                      {req.admin_note}
                    </div>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {isPending ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="lv-btn-approve"
                        disabled={updatingId === req.id}
                        onClick={() => onApprove(req)}
                      >
                        Approve
                      </button>
                      <button
                        className="lv-btn-reject"
                        disabled={updatingId === req.id}
                        onClick={() => onReject(req)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      {req.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function ProxyLeaveTable({
  leaves,
  onApprove,
  onReject,
  updatingId,
  currentUser,
  onRowClick,
}) {
  const fmt = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Site</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Reason</th>
            <th>Approval</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((l) => {
            const days =
              l.from_date && l.to_date
                ? Math.ceil(
                    (new Date(l.to_date) - new Date(l.from_date)) /
                      (1000 * 60 * 60 * 24),
                  ) + 1
                : null;
                
            const isLevelSlot = l.level_approver_user_name === currentUser;
            const isHeadSlot = l.head_approver_user_name === currentUser;
            const isProxySlot = l.proxy_user_name === currentUser;
            const myState = isProxySlot ? l.proxy_approved : isHeadSlot ? l.head_approved : l.level_approved;
            const myTurn = (isLevelSlot || isHeadSlot || isProxySlot) && myState === null;

            return (
              <tr key={l.id} className="tt-row" onClick={() => onRowClick(l)}>
                <td className="tt-title-cell">
                   <div className="tt-title">{l.name || l.user_name}</div>
                </td>
                <td>{l.site_name || "—"}</td>
                <td>{l.leave_type}</td>
                <td>
                  {fmt(l.from_date)} → {fmt(l.to_date)}
                  {days && (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {days} day{days > 1 ? "s" : ""}
                    </div>
                  )}
                </td>
                <td style={{ maxWidth: 200 }}>
                  {l.reason ? (
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      {l.reason}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <ApprovalPips leave={l} />
                </td>
                <td>
                  <LeaveBadge leave={l} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {myTurn ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="lv-btn-approve"
                        disabled={updatingId === l.id}
                        onClick={() => onApprove(l)}
                      >
                        Approve
                      </button>
                      <button
                        className="lv-btn-reject"
                        disabled={updatingId === l.id}
                        onClick={() => onReject(l)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : isLevelSlot || isHeadSlot || isProxySlot ? (
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      {myState ? "✓ You approved" : "✗ You rejected"}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function MyRescheduleTable({
  reschedules,
  allTasks,
  onReschedule,
  onSendVerification,
  onRaiseTicket,
  onAccept,
  onHold,
  onContinue,
  userMap = {}
}) {
  const fmt = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const statusStyle = {
    pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    approved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  };

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Site</th>
            <th>Current Due</th>
            <th>Requested Date</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actioned By</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {reschedules.map((req) => {
            const sc = statusStyle[req.status] || statusStyle.pending;
            const task = allTasks?.find((t) => t.id === req.task_id);
            return (
              <tr key={req.id} className="tt-row">
                <td className="tt-title-cell">
                  <div className="tt-title">
                    {req.tasks?.title || `Task #${req.task_id}`}
                  </div>
                </td>
                <td>{req.tasks?.site_name || "—"}</td>
                <td>{fmt(req.current_due)}</td>
                <td style={{ color: "#7c3aed", fontWeight: 600 }}>
                  {fmt(req.requested_date)}
                </td>
                <td style={{ maxWidth: 200 }}>
                  {req.reason ? (
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      {req.reason}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                  {req.status === "rejected" && req.admin_note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#dc2626",
                        marginTop: 4,
                        maxWidth: 180,
                      }}
                    >
                      {req.admin_note}
                    </div>
                  )}
                </td>
                 <td>{userMap[req.actioned_by] || req.actioned_by || "—"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {task ? (
                      <TaskActionMenu
                        task={task}
                        onAccept={onAccept}
                        onHold={onHold}
                        onContinue={onContinue}
                        onReschedule={onReschedule}
                        onSendVerification={onSendVerification}
                        onRaiseTicket={onRaiseTicket}
                      />
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Leave Card ─────────────────────────────────────────────────────────────
function LeaveCard({
  leave,
  showActions,
  onApprove,
  onOpenReject,
  currentUser,
}) {
  const status = computeLeaveStatus(leave);
  const fmt = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const days =
    leave.from_date && leave.to_date
      ? Math.ceil(
          (new Date(leave.to_date) - new Date(leave.from_date)) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : null;
  const reasons = Array.isArray(leave.rejection_reason)
    ? leave.rejection_reason.filter((r) => r && typeof r === "object")
    : [];
  return (
    <div
      className="lv-card"
      style={{
        borderLeftColor:
          status === "approved"
            ? "#16a34a"
            : status === "rejected"
              ? "#dc2626"
              : "#f59e0b",
      }}
    >
      <div className="lv-card-top">
        <div>
          <div className="lv-card-title">{leave.leave_type}</div>
          {leave.user_name && leave.user_name !== leave.name && (
            <div className="lv-card-sub">
              by <strong>{leave.name}</strong>
            </div>
          )}
        </div>
        <LeaveBadge leave={leave} />
      </div>
      <div className="lv-card-dates">
        <span className="op-meta-pill">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {fmt(leave.from_date)} → {fmt(leave.to_date)}
        </span>
        {days && (
          <span className="op-meta-pill">
            {days} day{days > 1 ? "s" : ""}
          </span>
        )}
        {leave.site_name && (
          <span className="op-meta-pill">{leave.site_name}</span>
        )}
      </div>

      {leave.reason && <p className="lv-reason">"{leave.reason}"</p>}
      <ApprovalPips leave={leave} />
      {reasons.length > 0 &&
        reasons.map((r) => (
          <div key={r.slot} className="lv-rejection">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <strong>{r.slot === "head" ? "Head" : "Level"} rejection</strong> (
            {r.by}): {r.reason}
          </div>
        ))}
      {showActions &&
        (() => {
          const isLevelSlot = leave.level_approver_user_name === currentUser;
          const isHeadSlot = leave.head_approver_user_name === currentUser;
          const myState = isHeadSlot
            ? leave.head_approved
            : leave.level_approved;
          if (!isLevelSlot && !isHeadSlot) return null;
          if (myState === null)
            return (
              <div className="lv-actions">
                <button
                  className="lv-btn-approve"
                  onClick={() => onApprove(leave)}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Approve
                </button>
                <button
                  className="lv-btn-reject"
                  onClick={() => onOpenReject(leave)}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Reject
                </button>
              </div>
            );
          return (
            <div className="lv-already-responded">
              {myState ? "✓ You approved this" : "✗ You rejected this"}
            </div>
          );
        })()}
    </div>
  );
}

function isRecurringTask(t) {
  return (
    t.is_recurring === true ||
    t.is_recurring === "true" ||
    Boolean(t.recurrence) ||
    Boolean(t.parent_task_id)
  );
}

function isTodayOrPast(dateStr) {
  if (!dateStr) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return d <= today;
}
async function activateQueuedTask(supabaseClient, completedTaskId, userMap, notify) {
  const { data: queued, error } = await supabaseClient
    .from("tasks")
    .select("id, title, assigned_to")
    .eq("queued_after_task_id", completedTaskId)
    .is("accepted_at", null);
  if (error || !queued?.length) return;

  const nowIso = new Date().toISOString();
  for (const qt of queued) {
    await supabaseClient
      .from("tasks")
      .update({ accepted_at: nowIso, resumed_at: nowIso, queued_after_task_id: null })
      .eq("id", qt.id);
  }
  notify?.(
    `"${queued[0].title}" has started automatically for ${userMap[queued[0].assigned_to] || queued[0].assigned_to}.`,
  );
}
// ── Main Component ─────────────────────────────────────────────────────────
export default function OfficePortal() {
  const [hoveredNavKey, setHoveredNavKey] = useState(null);
  const [drawingForm, setDrawingForm] = useState({ site_name: "", date: "", files: [] });
const [drawingSubmitting, setDrawingSubmitting] = useState(false);
const [allDrawings, setAllDrawings] = useState([]);
const [loadingDrawings, setLoadingDrawings] = useState(false);
const [allSites, setAllSites] = useState([]);
const NAV_COLORS = {
  "my-tasks": "#2563eb",
  "recurring-tasks": "#2563eb",
  "all-tasks": "#2563eb",
  "my-reschedules": "#2563eb",
  "verify-requests": "#2563eb",
  "new-tickets": "#ea580c",
  "raised-tickets": "#ea580c",
  "solved-tickets": "#ea580c",
  "verified-tasks": "#16a34a",
  "task-corrections": "#16a34a",
  "apply-leave": "#7c3aed",
  "my-leaves": "#7c3aed",
  "proxy-request": "#7c3aed",
  "site-report": "#0891b2",
  "my-reports": "#0891b2",
  "checklists": "#0891b2",
  "report-submissions": "#0891b2",
  "add-drawings": "#d97706",
  "all-drawings": "#d97706",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function isImageFile(url) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop().toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
}

// AFTER
async function uploadDrawingFiles(supabaseClient, siteName, dateStr, files) {
  const bucket = slugify(siteName);
  if (!bucket) throw new Error("Site name is required to upload drawings.");

  const d = new Date(dateStr + "T00:00:00");
  const year = d.getFullYear();
  const month = MONTHS[d.getMonth()];
  const dayFolder = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${year}`;

  const uploaded = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${year}/${month}/${dayFolder}/drawings/${Date.now()}-${safeName}`;
    // AFTER
    const { error: upErr } = await supabaseClient.storage.from(bucket).upload(path, file);
    if (upErr) throw new Error(`Failed to upload ${file.name}: ${upErr.message} (make sure a public bucket named "${bucket}" exists)`); 
    const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    uploaded.push({ name: file.name, url: urlData.publicUrl, path });
  }
  return uploaded;
}
function NavButton({ itemKey, icon, label, isActive, isHovered, onEnter, onLeave, onClick, badge }) {
  const highlighted = isActive || isHovered;
  const color = NAV_COLORS[itemKey] || "#2563eb"; // fallback so it never silently breaks
  return (
    <button
      className={`op-nav-item${isActive ? " active" : ""}`}
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        background: highlighted ? `${color}18` : undefined,
        color: highlighted ? color : undefined,
      }}
    >
      <span className="op-nav-icon">{icon}</span>
      {label}
      {badge != null && badge > 0 && <span className="op-nav-badge">{badge}</span>}
    </button>
  );
}
  const [rejectTaskModal, setRejectTaskModal] = useState(null); // { task, reason }
  const [rejectingTaskId, setRejectingTaskId] = useState(null);
  const [rescheduleTask, setRescheduleTask] = useState(null); // task object or null
  const [rescheduleForm, setRescheduleForm] = useState({
    requested_date: "",
    reason: "",
    verify_with: "", // ← add this
  });
  const [rescheduleSub, setRescheduleSub] = useState(false);
  const [myReschedules, setMyReschedules] = useState([]);
  const [loadingReschedules, setLoadingReschedules] = useState(false);

  const [verifyModal, setVerifyModal] = useState(null); // { task, verifier, files: [], submitting }
  const [adminUsers, setAdminUsers] = useState([]);
  const [myVerifications, setMyVerifications] = useState([]);
const [loadingMyVerifications, setLoadingMyVerifications] = useState(false);
const [myVerificationDetail, setMyVerificationDetail] = useState(null);
const [ticketDetail, setTicketDetail] = useState(null);

  const [detailTask, setDetailTask] = useState(null); // for task detail popup
  const [reportTab, setReportTab] = useState("dpr");

  const [checklistModal, setChecklistModal] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [fetchingCPs, setFetchingCPs] = useState(false);

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 760,
  );
  const [activeTab, setActiveTab] = useState("my-tasks");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // Tasks
  const [myTasks, setMyTasks] = useState([]);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [allAssignedTasks, setAllAssignedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [engineerOfficeUsers, setEngineerOfficeUsers] = useState([]);
  const [verifyRequests, setVerifyRequests] = useState([]);
  const [loadingVerifyRequests, setLoadingVerifyRequests] = useState(false);
  const [updatingVerifyId, setUpdatingVerifyId] = useState(null);
  const [verifyRejectModal, setVerifyRejectModal] = useState(null); // { req, reason }

  const [ticketModal, setTicketModal] = useState(null); // { task, assigned_to, query, file, submitting }
  const [ticketSolveModal, setTicketSolveModal] = useState(null); // { ticket, note }
  const [allUsers, setAllUsers] = useState([]);
  const [newTickets, setNewTickets] = useState([]);
  const [loadingNewTickets, setLoadingNewTickets] = useState(false);
  const [raisedTickets, setRaisedTickets] = useState([]);
  const [loadingRaisedTickets, setLoadingRaisedTickets] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const mainRef = useRef(null);
  const [mdoOfficeUsers, setMdoOfficeUsers] = useState([]);
useEffect(() => {
  supabase
    .from("user_details")
    .select("username, name, department")
    .then(({ data, error }) => {
      if (!error && data) {
        setMdoOfficeUsers(
          data.filter(
            (u) => String(u.department || "").trim().toLowerCase() === "mdo office",
          ),
        );
      }
    });
}, []);

const proxyCandidates = useMemo(
  () =>
    [...engineerOfficeUsers, ...mdoOfficeUsers]
      .filter((u) => u.username !== user?.user_name)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
  [engineerOfficeUsers, mdoOfficeUsers, user],
);
  const canSwitchToAdmin = canAccessPortal(user, "admin") || hasAdminCapability(user);
  const canSwitchToMdo = hasPermission(user, "can_switch_office_mdo");
  const canSwitchToSite = hasPermission(user, "can_switch_office_site");
  const canResolveTickets =
    hasPermission(user, "can_resolve_tickets") ||
    hasPermission(user, "is_mis_executive");
  const canVerifyTasks = hasPermission(user, "can_verify");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const fetchNewTickets = useCallback(async (u) => {
    if (!u) return;
    setLoadingNewTickets(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("assigned_to", u.user_name)
      .order("created_at", { ascending: false });
    if (!error) setNewTickets(data || []);
    setLoadingNewTickets(false);
  }, []);

  const fetchRaisedTickets = useCallback(async (u) => {
    if (!u) return;
    setLoadingRaisedTickets(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("raised_by", u.user_name)
      .order("created_at", { ascending: false });
    if (!error) setRaisedTickets(data || []);
    setLoadingRaisedTickets(false);
  }, []);
const fetchMyVerifications = useCallback(async (u) => {
  if (!u) return;
  setLoadingMyVerifications(true);
  const { data, error } = await supabase
    .from("task_verifications")
    .select("*")
    .eq("sent_by", u.user_name)
    .order("created_at", { ascending: false });
  if (!error) setMyVerifications(data || []);
  setLoadingMyVerifications(false);
}, []);
  const fetchVerifyRequests = useCallback(async (u) => {
    if (!u) return;
    setLoadingVerifyRequests(true);
    const { data, error } = await supabase
      .from("reschedule_requests")
      .select(
        "id, task_id, status, reason, requested_date, current_due, admin_note, actioned_by, actioned_at, created_at, requested_by, verify_with, tasks(title, site_name, due_date)",
      )
      .eq("verify_with", u.user_name)
      .order("created_at", { ascending: false });
    if (!error) setVerifyRequests(data || []);
    setLoadingVerifyRequests(false);
  }, []);

  useEffect(() => {
    supabase
      .from("user_details")
      .select("username, name")
      .then(({ data, error }) => {
        if (!error && data) setAllUsers(data);
      });
  }, []);

  useEffect(() => {
  supabase
    .from("user_details")
    .select("username, name, department, can_verify")
    .then(({ data, error }) => {
      if (!error && data) {
        setAdminUsers(
          data.filter(
            (u) =>
              String(u.department || "")
                .trim()
                .toLowerCase() === "admin" ||
              !!u.can_verify,
          ),
        );
      }
    });
}, []);
const [technicalUsers, setTechnicalUsers] = useState([]);
useEffect(() => {
  supabase
    .from("user_details")
    .select("username, name, role, is_mis_executive, can_resolve_tickets")
    .then(({ data, error }) => {
      if (!error && data) {
        setTechnicalUsers(
          data.filter((u) => {
            const role = String(u.role || "").trim().toLowerCase();
            return (
              ["mis head", "mis executive"].includes(role) ||
              !!u.is_mis_executive ||
              !!u.can_resolve_tickets
            );
          }),
        );
      }
    });
}, []);
  useEffect(() => {
    supabase
      .from("user_details")
      .select("username, name, department")
      .then(({ data, error }) => {
        if (!error && data) {
          setEngineerOfficeUsers(
            data.filter(
              (u) =>
                String(u.department || "")
                  .trim()
                  .toLowerCase() === "engineer office",
            ),
          );
        }
      });
  }, []);
  // Filters — one set per task tab, reset independently
  const [myTaskFilters, setMyTaskFilters] = useState({ ...EMPTY_FILTERS });
  const [recurringFilters, setRecurringFilters] = useState({
    ...EMPTY_FILTERS,
  });
  const [allTaskFilters, setAllTaskFilters] = useState({ ...EMPTY_FILTERS });
  

  const [userMap, setUserMap] = useState({});
  useEffect(() => {
    supabase
      .from("user_details")
      .select("username, name")
      .then(({ data, error }) => {
        if (!error && data) {
          const map = {};
          data.forEach((u) => {
            map[u.username] = u.name;
          });
          setUserMap(map);
        }
      });
  }, []);
  // Leaves
  const [myLeaves, setMyLeaves] = useState([]);
  const [proxyLeaves, setProxyLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [leaveDetailModal, setLeaveDetailModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [updatingProxyId, setUpdatingProxyId] = useState(null);
  const [siteReports, setSiteReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState({
    type: "",
    site: "",
    month: "",
  });

  // ADD this fetch function:
  const fetchSiteReports = useCallback(async (u) => {
    if (!u || u.role?.toLowerCase().trim() !== "project head") return;
    setLoadingReports(true);

    const sites =
      Array.isArray(u.site_names) && u.site_names.length
        ? u.site_names
        : u.site_name
          ? [u.site_name]
          : [];

    if (!sites.length) {
      setLoadingReports(false);
      return;
    }

    const { data: dprData } = await supabase
      .from("dpr_reports")
      .select(
        "id, site, engineer, report_type, date, pdf_url, payload, created_at",
      )
      .in("site", sites)
      .order("created_at", { ascending: false });

    const { data: svrData } = await supabase
      .from("site_reports")
      .select(
        "id, site_name, reporter_name, designation, visit_date, visit_time, progress_of_work, quality_observations, safety_concerns, issues_concerns, site_visit_instructions, key_instructions, submitted_by_name, pdf_url, created_at",
      )
      .in("site_name", sites)
      .order("created_at", { ascending: false });

    // WPR — adjust table/column names to match your schema
    const { data: wprData } = await supabase
      .from("wpr_reports")
      .select(
        "id, site_name, engineer_name, created_at, presentation_url, created_at",
      )
      .in("site_name", sites)
      .order("created_at", { ascending: false });

    const normalized = [
      ...(dprData || [])
        .filter((r) => r.report_type !== "morning")
        .map((r) => ({
          id: r.id,
          site: r.site,
          engineer: r.engineer,
          report_type: r.report_type,
          date: r.date,
          pdf_url: r.pdf_url,
          payload: r.payload,
          created_at: r.created_at,
          source: "dpr",
        })),
      ...(svrData || []).map((r) => ({
        id: r.id,
        site: r.site_name,
        engineer: r.reporter_name,
        report_type: "site_visit",
        date: r.visit_date,
        pdf_url: r.pdf_url,
        created_at: r.created_at,
        source: "svr",
        designation: r.designation,
        visit_time: r.visit_time,
        progress_of_work: r.progress_of_work,
        quality_observations: r.quality_observations,
        safety_concerns: r.safety_concerns,
        issues_concerns: r.issues_concerns,
        site_visit_instructions: r.site_visit_instructions,
        key_instructions: r.key_instructions,
        submitted_by_name: r.submitted_by_name,
      })),
      ...(wprData || []).map((r) => ({
        id: `wpr-${r.id}`,
        site: r.site_name,
        engineer: r.engineer_name,
        date: r.created_at,
        created_at: r.created_at,
        pdf_url: r.presentation_url,
        report_type: "WPR",
        source: "wpr",
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setSiteReports(normalized);
    setLoadingReports(false);
  }, []);
  const [mySvrReports, setMySvrReports] = useState([]);
  const [loadingSvrReports, setLoadingSvrReports] = useState(false);

  const fetchDrawings = useCallback(async (u) => {
  if (!u) return;
  setLoadingDrawings(true);
  const sites = u.site_names?.length ? u.site_names : u.site_name ? [u.site_name] : [];
  if (!sites.length) {
    setAllDrawings([]);
    setLoadingDrawings(false);
    return;
  }
  const { data, error } = await supabase
    .from("drawings")
    .select("*")
    .in("site_name", sites)
    .order("date", { ascending: false });
  if (!error) setAllDrawings(data || []);
  setLoadingDrawings(false);
}, []);

const handleDrawingSubmit = async () => {
  if (!drawingForm.site_name) return showToast("error", "Please select a site.");
  if (!drawingForm.files.length)
    return showToast("error", "Please attach at least one drawing file.");

  const effectiveDate = drawingForm.date || new Date().toISOString().split("T")[0];
  setDrawingSubmitting(true);
  try {
    const uploaded = await uploadDrawingFiles(
      supabase,
      drawingForm.site_name,
      effectiveDate,
      drawingForm.files,
    );
    const { error } = await supabase.from("drawings").insert([
      {
        site_name: drawingForm.site_name,
        date: effectiveDate,
        file_urls: uploaded,
        uploaded_by: user.user_name,
      },
    ]);
    if (error) throw error;
    showToast(
      "success",
      `${uploaded.length} drawing${uploaded.length > 1 ? "s" : ""} uploaded for ${drawingForm.site_name}.`,
    );
    setDrawingForm({ site_name: "", date: "", files: [] });
    fetchDrawings(user);
    setActiveTab("all-drawings");
  } catch (err) {
    showToast("error", err.message);
  }
  setDrawingSubmitting(false);
};

  const fetchMySvrReports = useCallback(async (u) => {
    if (!u) return;
    setLoadingSvrReports(true);
    const { data, error } = await supabase
      .from("site_reports")
      .select(
        "id, site_name, reporter_name, designation, visit_date, visit_time, progress_of_work, quality_observations, safety_concerns, issues_concerns, site_visit_instructions, key_instructions, submitted_by, submitted_by_name, pdf_url, created_at",
      )
      .eq("submitted_by", u.user_name)
      .order("created_at", { ascending: false });
    if (!error) setMySvrReports(data || []);
    setLoadingSvrReports(false);
  }, []);
  // Leave form
const [leaveForm, setLeaveForm] = useState({
  leave_type: "",
  from_date: "",
  to_date: "",
  reason: "",
  proxy_user_name: "",
});

 useEffect(() => {
    const s = localStorage.getItem("user");
    if (!s) return;
    const parsed = JSON.parse(s);
    console.log("🔍 parsed user from localStorage:", parsed); 
    setUser(parsed);

    supabase
      .from("user_details")
      .select(
        "username, site_name, site_names, department, role, can_add_task, can_add_site, can_add_employee, can_resolve_tickets, can_verify, is_mis_executive, can_switch_office_site, can_switch_office_mdo",
      )
      .eq("username", parsed.user_name)
      .single()
      .then(({ data, error }) => {
        console.log("🔍 supabase user_details result:", { data, error }); 
        if (error) {
          console.error("Failed to refresh user site_names:", error.message);
          return;
        }
        if (!data) return;
        const updated = {
          ...parsed,
          site_name: data.site_name ?? parsed.site_name,
          site_names: data.site_names ?? (parsed.site_name ? [parsed.site_name] : []),
          department: data.department ?? parsed.department,
          role: data.role ?? parsed.role,
          ...pickPermissionFields(data),
        };
        console.log("🔍 updated user object:", updated); 
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
      });
  }, []);

// useEffect (()=>{
//     const s = localStorage.getItem("user");
//     if(!s)return;
//     const parsed = JSON.parse(s);
//     console.log("Parsed user from localStorage:", parsed);
//     setUser(parsed);
//     supabase.from("user_details")
//     .select("username", parsed.user_name)
//     .single()
// })

useEffect(() => {
  supabase
    .from("user_details")
    .select("site_name, site_names")
    .then(({ data, error }) => {
      if (error || !data) return;
      const set = new Set();
      data.forEach((u) => {
        if (Array.isArray(u.site_names)) {
          u.site_names.forEach((s) => s && set.add(s));
        } else if (u.site_name) {
          set.add(u.site_name);
        }
      });
      setAllSites([...set].sort());
    });
}, []);

  const fetchMyReschedules = useCallback(async (u) => {
    if (!u) return;
    setLoadingReschedules(true);
    const { data, error } = await supabase
      .from("reschedule_requests")
      .select(
        "id, task_id, status, reason, requested_date, current_due, admin_note, actioned_by, actioned_at, created_at, employee_read, tasks(title, site_name, due_date)",
      )
      .eq("requested_by", u.user_name)
      .order("created_at", { ascending: false });

    if (!error) setMyReschedules(data || []);
    setLoadingReschedules(false);
  }, []);

  const fetchTasks = useCallback(async (u) => {
    if (!u) return;
    setLoadingTasks(true);

    const { data: mineAll } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", u.user_name)
      .order("created_at", { ascending: false });

    const mine = mineAll || [];
    setAllAssignedTasks(mine);
    setMyTasks(mine.filter((t) => !isRecurringTask(t)));
    setRecurringTasks(
      mine.filter((t) => isRecurringTask(t) && isTodayOrPast(t.due_date)),
    );
    setLoadingTasks(false);
  }, []);

  const fetchLeaves = useCallback(async (u) => {
    if (!u) return;
    setLoadingLeaves(true);
    const { data: mine } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_name", u.user_name)
      .order("created_at", { ascending: false });
const { data: proxy } = await supabase
  .from("leaves")
  .select("*")
  .or(
    `level_approver_user_name.eq.${u.user_name},head_approver_user_name.eq.${u.user_name},proxy_user_name.eq.${u.user_name}`,
  )
  .order("created_at", { ascending: false });
    setMyLeaves(mine || []);
    setProxyLeaves(proxy || []);
    setLoadingLeaves(false);
  }, []);

useEffect(() => {
  if (user) {
    fetchTasks(user);
    fetchLeaves(user);
    fetchMyReschedules(user);
    fetchSiteReports(user);
    fetchMySvrReports(user);
    fetchVerifyRequests(user);
    fetchNewTickets(user);
    fetchRaisedTickets(user);
    fetchMyVerifications(user);
    fetchDrawings(user);
  }
}, [
  user,
  fetchTasks,
  fetchLeaves,
  fetchMyReschedules,
  fetchSiteReports,
  fetchMySvrReports,
  fetchVerifyRequests,
  fetchNewTickets,
  fetchRaisedTickets,
  fetchMyVerifications, 
  fetchDrawings,
]);
  useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel("office-realtime-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      () => fetchTasks(user),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "leaves" },
      () => fetchLeaves(user),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reschedule_requests" },
      () => {
        fetchMyReschedules(user);
        fetchVerifyRequests(user);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_verifications" },
      () => fetchMyVerifications(user),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tickets" },
      () => {
        fetchNewTickets(user);
        fetchRaisedTickets(user);
      },
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [
  user,
  fetchTasks,
  fetchLeaves,
  fetchMyReschedules,
  fetchVerifyRequests,
  fetchMyVerifications,
  fetchNewTickets,
  fetchRaisedTickets,
]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };
const handleSendVerification = (task) => {
  setVerifyModal({ task, verifier: "", files: [], submitting: false });
};

const handleVerifySubmit = async () => {
  if (!verifyModal.verifier)
    return showToast("error", "Please select who should verify this task.");

  setVerifyModal((p) => ({ ...p, submitting: true }));

  // Bucket already exists (created via dashboard) — the anon key can't
  // create buckets, so calling createBucket here always 400s. Just upload.
  const documentUrls = [];
  for (const file of verifyModal.files) {
    const path = `${user.user_name}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadErr } = await supabase.storage
      .from("task-verification-docs")
      .upload(path, file);
    if (uploadErr) {
      setVerifyModal((p) => ({ ...p, submitting: false }));
      return showToast("error", "File upload failed: " + uploadErr.message);
    }
    const { data: pub } = supabase.storage
      .from("task-verification-docs")
      .getPublicUrl(path);
    if (pub?.publicUrl) documentUrls.push(pub.publicUrl);
  }

  const recipient = adminUsers.find((u) => u.username === verifyModal.verifier);

  const { error } = await supabase.from("task_verifications").insert([
    {
      task_id: verifyModal.task?.id || null,
      task_title: verifyModal.task?.title || null,
      site_name: verifyModal.task?.site_name || null,
      sent_by: user.user_name,
      sent_by_name: user.name,
      verifier: verifyModal.verifier,
      verifier_name: recipient?.name || verifyModal.verifier,
      document_urls: documentUrls,
      status: "pending",
    },
  ]);

  setVerifyModal((p) => ({ ...p, submitting: false }));

  if (error) {
    showToast("error", "Failed to send for verification: " + error.message);
  } else {
    showToast("success", `"${verifyModal.task.title}" sent for verification.`);
    setVerifyModal(null);
    fetchMyVerifications(user); // ← add
  }
};
  const handleVerifyAction = async (req, approved) => {
    if (!approved) {
      setVerifyRejectModal({ req, reason: "" });
      return;
    }
    setUpdatingVerifyId(req.id);
    const payload = {
      status: "approved",
      actioned_by: user.user_name,
      actioned_at: new Date().toISOString(),
      admin_note: null,
    };
    const { error } = await supabase
      .from("reschedule_requests")
      .update(payload)
      .eq("id", req.id);
    if (!error) {
      await supabase
        .from("tasks")
        .update({ due_date: req.requested_date })
        .eq("id", req.task_id);
    }
    setUpdatingVerifyId(null);
    if (error) return showToast("error", "Failed to update: " + error.message);
    setVerifyRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, ...payload } : r)),
    );
    showToast("success", "Reschedule approved — task due date updated.");
  };

  const handleVerifyRejectConfirm = async () => {
    if (!verifyRejectModal.reason.trim()) return;
    const req = verifyRejectModal.req;
    const reason = verifyRejectModal.reason.trim();
    setVerifyRejectModal(null);
    setUpdatingVerifyId(req.id);
    const payload = {
      status: "rejected",
      actioned_by: user.user_name,
      actioned_at: new Date().toISOString(),
      admin_note: reason,
    };
    const { error } = await supabase
      .from("reschedule_requests")
      .update(payload)
      .eq("id", req.id);
    setUpdatingVerifyId(null);
    if (error) return showToast("error", "Failed to reject: " + error.message);
    setVerifyRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, ...payload } : r)),
    );
    showToast("success", "Reschedule rejected.");
  };
const handleRaiseTicket = (task) => {
    setTicketModal({
      task,
      recipientType: "admin",
      assigned_to: "",
      query: "",
      file: null,
      submitting: false,
    });
  };

  const handleTicketSubmit = async () => {
    if (!ticketModal.assigned_to)
      return showToast("error", "Please select who to send this ticket to.");
    if (!ticketModal.query.trim())
      return showToast("error", "Please describe your query.");

    setTicketModal((p) => ({ ...p, submitting: true }));

    let documentUrl = null;
    if (ticketModal.file) {
      const file = ticketModal.file;
      const ext = file.name.split(".").pop();
      const path = `${user.user_name}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("ticket-raised")
        .upload(path, file);
      if (uploadErr) {
        setTicketModal((p) => ({ ...p, submitting: false }));
        return showToast("error", "File upload failed: " + uploadErr.message);
      }
      const { data: pub } = supabase.storage
        .from("ticket-raised")
        .getPublicUrl(path);
      documentUrl = pub?.publicUrl || null;
    }

    const recipient = allUsers.find(
      (u) => u.username === ticketModal.assigned_to,
    );

    const { error } = await supabase.from("tickets").insert([
      {
        task_id: ticketModal.task?.id || null,
        task_title: ticketModal.task?.title || null,
        site_name: ticketModal.task?.site_name || null,
        raised_by: user.user_name,
        raised_by_name: user.name,
        assigned_to: ticketModal.assigned_to,
        assigned_to_name: recipient?.name || ticketModal.assigned_to,
        query: ticketModal.query.trim(),
        document_url: documentUrl,
        status: "open",
      },
    ]);

    setTicketModal((p) => ({ ...p, submitting: false }));

    if (error) {
      showToast("error", "Failed to raise ticket: " + error.message);
    } else {
      showToast("success", "Ticket raised successfully!");
      setTicketModal(null);
      fetchRaisedTickets(user);
    }
  };

  const handleMarkTicketSolved = async () => {
    if (!ticketSolveModal) return;
    const ticket = ticketSolveModal.ticket;
    const note = ticketSolveModal.note.trim();

    setUpdatingTicketId(ticket.id);

    let resolution_document_url = null;
    if (ticketSolveModal.file) {
      const file = ticketSolveModal.file;
      const path = `${user.user_name}/resolved_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("ticket-raised")
        .upload(path, file);
      if (uploadErr) {
        setUpdatingTicketId(null);
        return showToast("error", "File upload failed: " + uploadErr.message);
      }
      const { data: pub } = supabase.storage
        .from("ticket-raised")
        .getPublicUrl(path);
      resolution_document_url = pub?.publicUrl || null;
    }

    const payload = {
      status: "solved",
      resolution_note: note || null,
      resolution_document_url,
      resolved_by: user.user_name,
      resolved_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", ticket.id);
    setUpdatingTicketId(null);
    if (error) return showToast("error", "Failed: " + error.message);
    setNewTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, ...payload } : t)),
    );
    setTicketSolveModal(null);
    showToast("success", "Ticket marked as solved.");
  };
const handleNavClick = (key) => {
  setActiveTab(key);
  if (typeof window !== "undefined" && window.innerWidth <= 760)
    setSidebarOpen(false);
  if (key === "my-reschedules") markReschedulesRead();
  if (key === "my-leaves") markLeavesRead();
  if (key === "solved-tickets") markTicketsRead();
  if (key === "task-corrections") markCorrectionsRead();
  if (key === "add-drawings" || key === "all-drawings") fetchDrawings(user); // NEW
};
  const spawnNextRecurringInstance = async (task, nextDue) => {
    const { data: newTask, error: insertErr } = await supabase
      .from("tasks")
      .insert([
        {
          title: task.title,
          description: task.description || null,
          assigned_to: task.assigned_to,
          assigned_by: task.assigned_by || null,
          site_name: task.site_name || null,
          priority: task.priority || "medium",
          status: "pending",
          is_recurring: true,
          recurrence: task.recurrence,
          due_date: nextDue,
          audio_url: task.audio_url || null,
          document_url: task.document_url || null,
          has_checkpoints: task.has_checkpoints || false,
          reschedule_allowed: task.reschedule_allowed || false,
          parent_task_id: task.parent_task_id || task.id,
          recurrence_anchor: task.recurrence_anchor || task.due_date || nextDue,
          last_generated_date: nextDue,
        },
      ])
      .select()
      .single();

    if (insertErr || !newTask) return { error: insertErr, task: null };

    // Force the recurring fields, in case a DB trigger/default overwrote them
    if (newTask.is_recurring !== true || !newTask.recurrence) {
      const { data: fixed, error: fixErr } = await supabase
        .from("tasks")
        .update({
          is_recurring: true,
          recurrence: task.recurrence,
          parent_task_id: task.parent_task_id || task.id,
        })
        .eq("id", newTask.id)
        .select()
        .single();

      if (!fixErr && fixed) return { error: null, task: fixed };
    }

    return { error: null, task: newTask };
  };


  const handleChecklistConfirm = async () => {
  const task = checklistModal;
  const taskId = task.id;
  setChecklistModal(null);
  setUpdatingId(taskId);

  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", taskId);

  setUpdatingId(null);

  if (error) {
    showToast("error", "Failed: " + error.message);
    return;
  }

  const patch = (list) =>
    list.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t));
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));

  showToast("success", `"${task.title}" marked as completed.`);
  await activateQueuedTask(supabase, taskId, userMap, (msg) => showToast("success", msg));
};

  const getNextDueDate = (currentDue, recurrence) => {
    const base = currentDue ? new Date(currentDue + "T00:00:00") : new Date();
    switch ((recurrence || "").toLowerCase()) {
      case "daily":
        base.setDate(base.getDate() + 1);
        break;
      case "weekly":
        base.setDate(base.getDate() + 7);
        break;
      case "monthly":
        base.setMonth(base.getMonth() + 1);
        break;
      default:
        base.setDate(base.getDate() + 1);
    }
    return base.toISOString().split("T")[0];
  };
  const handleRejectTaskConfirm = async () => {
  if (!rejectTaskModal?.reason?.trim())
    return showToast("error", "Please provide a reason for rejecting this task.");

  const task = rejectTaskModal.task;
  const reason = rejectTaskModal.reason.trim();
  setRejectingTaskId(task.id);

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "rejected",
      employee_rejection_reason: reason,
      rejected_by: user.user_name,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  setRejectingTaskId(null);
  if (error) return showToast("error", "Failed to reject task: " + error.message);

  const patch = (list) => list.filter((t) => t.id !== task.id);
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));
  setAllAssignedTasks((p) =>
    p.map((t) => (t.id === task.id ? { ...t, status: "rejected", employee_rejection_reason: reason } : t)),
  );

  showToast("success", `"${task.title}" rejected and sent back to ${userMap[task.assigned_by] || task.assigned_by || "the assigner"}.`);
  setRejectTaskModal(null);
};
const handleAcceptTask = async (task) => {
  const nowIso = new Date().toISOString();
  setUpdatingId(task.id);
  const { error } = await supabase
    .from("tasks")
    .update({ accepted_at: nowIso, is_held: false, hold_started_at: null, resumed_at: nowIso })
    .eq("id", task.id);
  setUpdatingId(null);
  if (error) return showToast("error", "Failed to accept task: " + error.message);

  const patch = (list) =>
    list.map((t) =>
      t.id === task.id
        ? { ...t, accepted_at: nowIso, is_held: false, hold_started_at: null, resumed_at: nowIso }
        : t,
    );
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));
  showToast("success", `"${task.title}" accepted — timer started.`);
};

const handleHoldTask = async (task) => {
  const nowIso = new Date().toISOString();
  const lastStart = task.resumed_at || task.accepted_at;
  const elapsed = lastStart ? Math.floor((new Date(nowIso) - new Date(lastStart)) / 1000) : 0;
  const newAccumulated = (task.accumulated_seconds || 0) + Math.max(elapsed, 0);

  setUpdatingId(task.id);
  const { error } = await supabase
    .from("tasks")
    .update({ is_held: true, hold_started_at: nowIso, accumulated_seconds: newAccumulated })
    .eq("id", task.id);
  setUpdatingId(null);
  if (error) return showToast("error", "Failed to hold task: " + error.message);

  const patch = (list) =>
    list.map((t) =>
      t.id === task.id
        ? { ...t, is_held: true, hold_started_at: nowIso, accumulated_seconds: newAccumulated }
        : t,
    );
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));
  showToast("success", `"${task.title}" put on hold — timer paused.`);
};
const fetchCheckpointsForTask = async (task) => {
  setFetchingCPs(true);
  setCheckedItems({});
  const { data, error } = await supabase
    .from("checkpoints")
    .select("id, checkpoint")
    .eq("task_type", task.title)
    .order("id", { ascending: true });
  if (!error) setCheckpoints(data || []);
  else setCheckpoints([]);
  setFetchingCPs(false);
};

const handleCompleteTaskDirectly = async (task) => {
  setUpdatingId(task.id);
  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", task.id);
  setUpdatingId(null);
  if (error) return showToast("error", "Failed to complete task: " + error.message);

  const patch = (list) =>
    list.map((t) => (t.id === task.id ? { ...t, status: "completed" } : t));
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));
  showToast("success", `"${task.title}" marked as completed.`);
  await activateQueuedTask(supabase, task.id, userMap, (msg) => showToast("success", msg));
};

const handleMarkDone = (task) => {
  if (task.has_checkpoints) {
    setChecklistModal(task);
    fetchCheckpointsForTask(task);
  } else {
    handleCompleteTaskDirectly(task);
  }
};

const handleMarkNotApplicable = async (task) => {
  setUpdatingId(task.id);
  const { error } = await supabase
    .from("tasks")
    .update({ status: "not_applicable" })
    .eq("id", task.id);
  setUpdatingId(null);
  if (error)
    return showToast("error", "Failed to update: " + error.message);

  const patch = (list) =>
    list.map((t) =>
      t.id === task.id ? { ...t, status: "not_applicable" } : t,
    );
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));
  showToast("success", `"${task.title}" marked as not applicable.`);
};
const handleContinueTask = async (task) => {
  const nowIso = new Date().toISOString();
  setUpdatingId(task.id);
  const { error } = await supabase
    .from("tasks")
    .update({ is_held: false, hold_started_at: null, resumed_at: nowIso })
    .eq("id", task.id);
  setUpdatingId(null);
  if (error) return showToast("error", "Failed to resume task: " + error.message);

  const patch = (list) =>
    list.map((t) =>
      t.id === task.id
        ? { ...t, is_held: false, hold_started_at: null, resumed_at: nowIso }
        : t,
    );
  setMyTasks((p) => patch(p));
  setRecurringTasks((p) => patch(p));
  showToast("success", `"${task.title}" resumed — timer running.`);
};
const handleStatusChange = async (taskId, newStatus, e) => {
  e?.stopPropagation();

  if (newStatus === "completed") {
    return showToast(
      "error",
      "Tasks can only be marked completed after admin verification. Please use 'Send for Verification' instead.",
    );
  }

  const task = [...myTasks, ...recurringTasks].find((t) => t.id === taskId);

  setUpdatingId(taskId);
  const { error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", taskId);

  if (!error) {
    const patch = (list) =>
      list.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
    setMyTasks((p) => patch(p));
    setRecurringTasks((p) => patch(p));
  }
  setUpdatingId(null);
};
  const markTicketsRead = async () => {
    const unreadIds = raisedTickets
      .filter((t) => t.status === "solved" && t.raised_by_read !== true)
      .map((t) => t.id);
    if (!unreadIds.length) return;

    const { error } = await supabase
      .from("tickets")
      .update({ raised_by_read: true })
      .in("id", unreadIds);

    if (!error) {
      setRaisedTickets((prev) =>
        prev.map((t) =>
          unreadIds.includes(t.id) ? { ...t, raised_by_read: true } : t,
        ),
      );
    }
  };
  const markCorrectionsRead = async () => {
  const unreadIds = myVerifications
    .filter(
      (v) =>
        v.status === "correction_sent" &&
        v.correction_read !== true &&
        latestVerificationByTask.get(v.task_id)?.id === v.id,
    )
    .map((v) => v.id);
  if (!unreadIds.length) return;

  const { error } = await supabase
    .from("task_verifications")
    .update({ correction_read: true })
    .in("id", unreadIds);

  if (!error) {
    setMyVerifications((prev) =>
      prev.map((v) =>
        unreadIds.includes(v.id) ? { ...v, correction_read: true } : v,
      ),
    );
  }
};
  const markReschedulesRead = async () => {
    const unreadIds = myReschedules
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "rejected") &&
          r.employee_read !== true, // catches both false AND null
      )
      .map((r) => r.id);

    if (!unreadIds.length) return;

    const { error } = await supabase
      .from("reschedule_requests")
      .update({ employee_read: true })
      .in("id", unreadIds);

    if (!error) {
      setMyReschedules((prev) =>
        prev.map((r) =>
          unreadIds.includes(r.id) ? { ...r, employee_read: true } : r,
        ),
      );
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleForm.requested_date)
      return showToast("error", "Please select a new date.");
    if (!rescheduleForm.reason.trim())
      return showToast("error", "Please provide a reason.");
    if (
      rescheduleTask.due_date &&
      rescheduleForm.requested_date <= rescheduleTask.due_date
    )
      return showToast(
        "error",
        "Requested date must be after the current due date.",
      );

    setRescheduleSub(true);
    const { error } = await supabase.from("reschedule_requests").insert([
      {
        task_id: rescheduleTask.id,
        requested_by: user.user_name,
        assigned_by: rescheduleTask.assigned_by,
        current_due: rescheduleTask.due_date || null,
        requested_date: rescheduleForm.requested_date,
        reason: rescheduleForm.reason.trim(),
        status: "pending",
        verify_with: rescheduleForm.verify_with || null, // ← add this
      },
    ]);
    setRescheduleSub(false);

    if (error) {
      showToast("error", "Failed to submit reschedule: " + error.message);
    } else {
      showToast("success", "Reschedule request submitted!");
      setRescheduleTask(null);
      setRescheduleForm({ requested_date: "", reason: "", verify_with: "" });
    }
  };
  const unreadLeavesCount = myLeaves.filter(
    (l) =>
      (computeLeaveStatus(l) === "approved" ||
        computeLeaveStatus(l) === "rejected") &&
      l.employee_read !== true,
  ).length;

  const markLeavesRead = async () => {
    const unreadIds = myLeaves
      .filter(
        (l) =>
          (computeLeaveStatus(l) === "approved" ||
            computeLeaveStatus(l) === "rejected") &&
          l.employee_read !== true,
      )
      .map((l) => l.id);
    if (!unreadIds.length) return;

    const { error } = await supabase
      .from("leaves")
      .update({ employee_read: true })
      .in("id", unreadIds);
    if (!error) {
      setMyLeaves((prev) =>
        prev.map((l) =>
          unreadIds.includes(l.id) ? { ...l, employee_read: true } : l,
        ),
      );
    }
  };
const handleLeaveSubmit = async () => {
  if (!leaveForm.leave_type)
    return showToast("error", "Please select a leave type.");
  if (!leaveForm.from_date)
    return showToast("error", "Please select a start date.");
  if (!leaveForm.to_date)
    return showToast("error", "Please select an end date.");
  if (new Date(leaveForm.to_date) < new Date(leaveForm.from_date))
    return showToast("error", "End date must be after start date.");
  if (!leaveForm.proxy_user_name)
    return showToast("error", "Please select a proxy for your leave.");

  const site = user.site_names?.[0] || user.site_name || null;
  setLeaveSubmitting(true);

  const chain = await resolveApprovalChain(supabase, site, user.role, user.user_name);
  const initialLevel = chain.levelApprover ? null : true;
  const initialHead = chain.autoApproved ? true : chain.headApprover ? null : true;
  const proxyUser = proxyCandidates.find((u) => u.username === leaveForm.proxy_user_name);

  const payload = {
    user_name: user.user_name,
    name: user.name,
    site_name: site,
    leave_type: leaveForm.leave_type,
    from_date: leaveForm.from_date,
    to_date: leaveForm.to_date,
    reason: leaveForm.reason.trim() || null,
    level_approver_user_name: chain.levelApprover?.username || null,
    level_approver_role: chain.levelApprover?.role || null,
    level_approver_name: chain.levelApprover?.name || null,
    level_approved: initialLevel,
    head_approver_user_name: chain.headApprover?.username || null,
    head_approver_role: chain.headApprover?.role || null,
    head_approver_name: chain.headApprover?.name || null,
    head_approved: initialHead,
    admin_approved: null,
    proxy_user_name: leaveForm.proxy_user_name,
    proxy_name: proxyUser?.name || leaveForm.proxy_user_name,
    proxy_approved: null,
    status: deriveLeaveStatus(initialLevel, initialHead),
  };

  const { error } = await supabase.from("leaves").insert([payload]);
  setLeaveSubmitting(false);
  if (error) {
    showToast("error", "Failed to submit leave. " + error.message);
  } else {
    showToast(
      "success",
      chain.autoApproved
        ? "Leave application submitted and auto-approved!"
        : "Leave application submitted — awaiting proxy and admin approval.",
    );
    setLeaveForm({ leave_type: "", from_date: "", to_date: "", reason: "", proxy_user_name: "" });
    fetchLeaves(user);
    setActiveTab("my-leaves");
  }
};

  const openProxyReject = (leave) => {
    const isHeadSlot = leave.head_approver_user_name === user.user_name;
    setRejectTarget({ leave, isHead: isHeadSlot });
    setRejectReason("");
  };
const handleProxyApprove = async (leave) => {
  setUpdatingProxyId(leave.id);
  const isHeadSlot = leave.head_approver_user_name === user.user_name;
  const isProxySlot = leave.proxy_user_name === user.user_name;

  let payload;
  if (isProxySlot) {
    payload = { proxy_approved: true };
  } else {
    const field = isHeadSlot ? "head_approved" : "level_approved";
    const newLevel = isHeadSlot ? leave.level_approved : true;
    const newHead = isHeadSlot ? true : leave.head_approved;
    payload = { [field]: true, status: deriveLeaveStatus(newLevel, newHead) };
  }

  const { error } = await supabase.from("leaves").update(payload).eq("id", leave.id);
  setUpdatingProxyId(null);
  if (error) return showToast("error", "Action failed. " + error.message);

  const updatedLeave = { ...leave, ...payload };
  setProxyLeaves((p) => p.map((l) => (l.id === leave.id ? updatedLeave : l)));
  showToast("success", "Leave approved.");

  // Both sides now approved — hand off the applicant's tasks for the leave window.
  if (isLeaveFullyApproved(updatedLeave)) {
    await transferTasksToProxy(updatedLeave);
  }
};
function isLeaveFullyApproved(leave) {
  const proxyDone = !leave.proxy_user_name || leave.proxy_approved === true;
  if (!proxyDone) return false;

  const hasChain = !!(leave.level_approver_user_name || leave.head_approver_user_name);
  if (hasChain) {
    const levelDone = !leave.level_approver_user_name || leave.level_approved === true;
    const headDone = !leave.head_approver_user_name || leave.head_approved === true;
    return levelDone && headDone;
  }
  return leave.admin_approved === true;
}


async function transferTasksToProxy(leave) {
  if (!leave.proxy_user_name || !leave.from_date || !leave.to_date) return;

  const { data: tasksToMove, error } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("assigned_to", leave.user_name)
    .neq("status", "completed")
    .gte("due_date", leave.from_date)
    .lte("due_date", leave.to_date);

  if (error || !tasksToMove?.length) return;

  const ids = tasksToMove.map((t) => t.id);
  await supabase.from("tasks").update({ assigned_to: leave.proxy_user_name }).in("id", ids);

  showToast(
    "success",
    `${tasksToMove.length} task${tasksToMove.length > 1 ? "s" : ""} transferred to ${
      userMap[leave.proxy_user_name] || leave.proxy_name || leave.proxy_user_name
    } for the leave period.`,
  );
}

const confirmProxyReject = async () => {
  if (!rejectReason.trim()) return;
  const { leave } = rejectTarget;
  const isHeadSlot = leave.head_approver_user_name === user.user_name;
  const isProxySlot = leave.proxy_user_name === user.user_name;
  setUpdatingProxyId(leave.id);

  const slot = isProxySlot ? "proxy" : isHeadSlot ? "head" : "level";
  const merged = mergeRejectionReason(leave.rejection_reason, slot, user.name, rejectReason.trim());

  let payload = { rejection_reason: merged };
  if (isProxySlot) {
    payload.proxy_approved = false;
  } else {
    const field = isHeadSlot ? "head_approved" : "level_approved";
    const newLevel = isHeadSlot ? leave.level_approved : false;
    const newHead = isHeadSlot ? false : leave.head_approved;
    payload = { ...payload, [field]: false, status: deriveLeaveStatus(newLevel, newHead) };
  }

  const { error } = await supabase.from("leaves").update(payload).eq("id", leave.id);
  setUpdatingProxyId(null);
  if (!error) {
    setProxyLeaves((p) => p.map((l) => (l.id === leave.id ? { ...l, ...payload } : l)));
    showToast("success", "Leave rejected.");
  } else {
    showToast("error", "Action failed. " + error.message);
  }
  setRejectTarget(null);
};

const latestVerificationByTask = useMemo(() => {
  const map = new Map();
  myVerifications.forEach((v) => {
    if (!v.task_id) return;
    const existing = map.get(v.task_id);
    if (!existing || new Date(v.created_at) > new Date(existing.created_at)) {
      map.set(v.task_id, v);
    }
  });
  return map;
}, [myVerifications]);

const pendingVerificationByTask = useMemo(() => {
  const map = new Map();
  myVerifications.forEach((v) => {
    if (v.task_id && v.status === "pending") map.set(v.task_id, v);
  });
  return map;
}, [myVerifications]);

const pendingRescheduleByTask = useMemo(() => {
  const map = new Map();
  myReschedules.forEach((r) => {
    if (r.task_id && r.status === "pending") map.set(r.task_id, r);
  });
  return map;
}, [myReschedules]);

const openTicketByTask = useMemo(() => {
  const map = new Map();
  raisedTickets.forEach((t) => {
    if (t.task_id && t.status === "open") map.set(t.task_id, t);
  });
  return map;
}, [raisedTickets]);

const myTaskActivityMaps = useMemo(
  () => ({
    verificationMap: pendingVerificationByTask,
    rescheduleMap: pendingRescheduleByTask,
    ticketMap: openTicketByTask,
  }),
  [pendingVerificationByTask, pendingRescheduleByTask, openTicketByTask],
);

  const allTasks = useMemo(() => {
    const map = new Map();
    [...myTasks, ...recurringTasks].forEach((t) => map.set(t.id, t));
    return [...map.values()].sort(
      (a, b) =>
        new Date(a.due_date || a.created_at || 0) -
        new Date(b.due_date || b.created_at || 0),
    );
  }, [myTasks, recurringTasks]);

  if (!user)
    return (
      <h2 style={{ textAlign: "center", marginTop: 80, color: "#94a3b8" }}>
        Loading…
      </h2>
    );

  const activeItem = [
    ...TASK_NAV,
    ...LEAVE_NAV,
    ...REPORTS_NAV,
    REPORT_SUBMISSIONS_ITEM,
    VERIFY_REQUESTS_ITEM,
    NEW_TICKETS_ITEM,
    ...TICKETS_NAV,
      VERIFIED_TASKS_ITEM,
  TASK_CORRECTIONS_ITEM,
  ].find((n) => n.key === activeTab);

  const proxyPendingCount = proxyLeaves.filter(
    (l) =>
      (l.level_approver_user_name === user.user_name &&
        l.level_approved === null) ||
      (l.head_approver_user_name === user.user_name &&
        l.head_approved === null),
  ).length;
  const unreadReschedules = myReschedules.filter(
    (r) =>
      (r.status === "approved" || r.status === "rejected") &&
      r.employee_read !== true,
  ).length;

  // Filter change helpers
  const makeFilterChange = (setter) => (key, val) =>
    setter((prev) => ({ ...prev, [key]: val }));
  const makeFilterClear = (setter) => () => setter({ ...EMPTY_FILTERS });

  const renderContent = () => {
    switch (activeTab) {
    case "my-tasks": {
  return (
    <TaskList
      tasks={myTasks.filter((t) => t.status !== "completed" && t.status !== "rejected")}
      loading={loadingTasks}
      onStatusChange={handleStatusChange}
      updatingId={updatingId}
      emptyText="No tasks assigned to you yet."
      filters={myTaskFilters}
      onFilterChange={makeFilterChange(setMyTaskFilters)}
      onFilterClear={makeFilterClear(setMyTaskFilters)}
      showRecurrence={false}
      allTasks={myTasks}
      userMap={userMap}
      onSendVerification={handleSendVerification}
      onRaiseTicket={handleRaiseTicket}
      onAccept={handleAcceptTask}
      onHold={handleHoldTask}
      onContinue={handleContinueTask}
      activityMaps={myTaskActivityMaps}
      onRejectTask={(task) => setRejectTaskModal({ task, reason: "" })} 
      onReschedule={(task) => {
        setRescheduleTask(task);
        setRescheduleForm({ requested_date: "", reason: "", verify_with: "" });
      }}
      onDetailClick={(task) => setDetailTask(task)}
      
    />
  );
}

case "recurring-tasks":
  return (
    <TaskList
      tasks={recurringTasks.filter((t) => t.status == "pending")}
      loading={loadingTasks}
      onStatusChange={handleStatusChange}
      updatingId={updatingId}
      emptyText="No recurring tasks assigned to you."
      filters={recurringFilters}
      onFilterChange={makeFilterChange(setRecurringFilters)}
      onFilterClear={makeFilterClear(setRecurringFilters)}
      allTasks={recurringTasks}
      showRecurrence={true}
      onSendVerification={handleSendVerification}
      onRaiseTicket={handleRaiseTicket}
      onAccept={handleAcceptTask}
      onHold={handleHoldTask}
      onContinue={handleContinueTask}
      recurringMode={true}
      onDone={handleMarkDone}
      onNotApplicable={handleMarkNotApplicable}
      onReschedule={(task) => {
        setRescheduleTask(task);
        setRescheduleForm({ requested_date: "", reason: "", verify_with: "" });
      }}
      onDetailClick={(task) => setDetailTask(task)}
    />
  );
case "all-tasks":
  return (
    <>
      {loadingTasks ? (
        <div className="op-empty-state">
          <div className="op-spinner" />
          <p className="op-empty-text">Loading tasks…</p>
        </div>
      ) : applyFilters(allAssignedTasks, allTaskFilters).length === 0 ? (
        <div className="op-empty-state">
          <p className="op-empty-text">No tasks match the current filters.</p>
        </div>
      ) : (
        <TaskHistoryTable
          tasks={applyFilters(allAssignedTasks, allTaskFilters)}
          onDetailClick={(task) => setDetailTask(task)}
          onSendVerification={handleSendVerification}
          onRaiseTicket={handleRaiseTicket}
          onAccept={handleAcceptTask}
          onHold={handleHoldTask}
          onContinue={handleContinueTask}
          onReschedule={(task) => {
            setRescheduleTask(task);
            setRescheduleForm({ requested_date: "", reason: "", verify_with: "" });
          }}
        />
      )}
    </>
  );
  case "apply-leave":
        return (
          <div className="lv-form-wrap">
            <div className="lv-form-info">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Your leave application will be sent directly to the admin for
              approval.
            </div>
            <div className="lv-form-grid">
              <div className="lv-field lv-col-2">
                <label className="lv-label">
                  Leave Type <span className="lv-req">*</span>
                </label>
                <select
                  className="lv-input lv-select"
                  value={leaveForm.leave_type}
                  onChange={(e) =>
                    setLeaveForm((p) => ({ ...p, leave_type: e.target.value }))
                  }
                >
                  <option value="">Select leave type…</option>
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lv-field">
                <label className="lv-label">
                  From Date <span className="lv-req">*</span>
                </label>
                <input
                  className="lv-input"
                  type="date"
                  value={leaveForm.from_date}
                  onChange={(e) =>
                    setLeaveForm((p) => ({ ...p, from_date: e.target.value }))
                  }
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="lv-field">
                <label className="lv-label">
                  To Date <span className="lv-req">*</span>
                </label>
                <input
                  className="lv-input"
                  type="date"
                  value={leaveForm.to_date}
                  onChange={(e) =>
                    setLeaveForm((p) => ({ ...p, to_date: e.target.value }))
                  }
                  min={
                    leaveForm.from_date || new Date().toISOString().slice(0, 10)
                  }
                />
              </div>
              {leaveForm.from_date &&
                leaveForm.to_date &&
                new Date(leaveForm.to_date) >=
                  new Date(leaveForm.from_date) && (
                  <div className="lv-duration-preview lv-col-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {Math.ceil(
                      (new Date(leaveForm.to_date) -
                        new Date(leaveForm.from_date)) /
                        (1000 * 60 * 60 * 24),
                    ) + 1}{" "}
                    day(s) of leave
                  </div>
                )}
              <div className="lv-field lv-col-2">
                <label className="lv-label">Reason</label>
                <textarea
                  className="lv-input lv-textarea"
                  rows={3}
                  placeholder="Briefly describe the reason for your leave…"
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm((p) => ({ ...p, reason: e.target.value }))
                  }
                />
              </div>
              <div className="lv-field lv-col-2">
                <label className="lv-label">
                  Proxy (covers your tasks while on leave) <span className="lv-req">*</span>
                </label>
                <select
                  className="lv-input lv-select"
                  value={leaveForm.proxy_user_name}
                  onChange={(e) =>
                    setLeaveForm((p) => ({ ...p, proxy_user_name: e.target.value }))
                  }
                >
                  <option value="">Select a proxy…</option>
                  {proxyCandidates.map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Both your proxy and the admin must approve before this leave is confirmed.
                  Your pending tasks due during the leave period will be handed to them.
                </span>
              </div>
              <div className="lv-field lv-col-2 lv-actions-row">
                <button
                  className="lv-btn-reset"
                  onClick={() =>
                    setLeaveForm({
                      leave_type: "",
                      from_date: "",
                      to_date: "",
                      reason: "",
                      proxy_user_name: "",
                    })
                  }
                >
                  Reset
                </button>
                <button
                  className="lv-btn-submit"
                  onClick={handleLeaveSubmit}
                  disabled={leaveSubmitting}
                >
                  {leaveSubmitting ? (
                    <>
                      <span className="op-mini-spinner" />
                      &nbsp;Submitting…
                    </>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                      </svg>
                      &nbsp;Submit Application
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );

      case "my-leaves":
        if (loadingLeaves)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading…</p>
            </div>
          );
        if (!myLeaves.length)
          return (
            <div className="op-empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.3 }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="op-empty-text">
                You haven't applied for any leave yet.
              </p>
              <button
                className="lv-btn-submit"
                style={{ marginTop: 4 }}
                onClick={() => setActiveTab("apply-leave")}
              >
                Apply Now
              </button>
            </div>
          );
        return (
          <>
            <div className="lv-table-only">
              <MyLeaveTable leaves={myLeaves} />
            </div>
            <div className="lv-cards-only">
              {myLeaves.map((l) => (
                <LeaveCard key={l.id} leave={l} showActions={false} />
              ))}
            </div>
          </>
        );

      case "proxy-request":
        if (loadingLeaves)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading…</p>
            </div>
          );
        if (!proxyLeaves.length)
          return (
            <div className="op-empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.3 }}
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <p className="op-empty-text">
                No leave requests are routed to you for approval yet.
              </p>
            </div>
          );
        return (
          <>
            <div className="lv-table-only">
              <ProxyLeaveTable
                leaves={proxyLeaves}
                onApprove={handleProxyApprove}
                onReject={openProxyReject}
                updatingId={updatingProxyId}
                currentUser={user.user_name}
                onRowClick={setLeaveDetailModal}
              />
            </div>
            <div className="lv-cards-only">
              {proxyLeaves.map((l) => (
                <LeaveCard
                  key={l.id}
                  leave={l}
                  showActions={true}
                  onApprove={handleProxyApprove}
                  onOpenReject={openProxyReject}
                  currentUser={user.user_name}
                />
              ))}
            </div>
          </>
        );
      case "new-tickets":
        if (loadingNewTickets)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading…</p>
            </div>
          );
        if (!newTickets.length)
          return (
            <div className="op-empty-state">
              <p className="op-empty-text">
                No tickets have been raised to you yet.
              </p>
            </div>
          );
        return (
          <NewTicketsTable
            tickets={newTickets}
            updatingId={updatingTicketId}
            canSolve={canResolveTickets}
            onSolve={(t) =>
              setTicketSolveModal({ ticket: t, note: "", file: null })
            }
          />
        );

      case "raised-tickets": {
  const unsolved = raisedTickets.filter((t) => t.status !== "solved"); // ← add
  if (loadingRaisedTickets)
    return (
      <div className="op-empty-state">
        <div className="op-spinner" />
        <p className="op-empty-text">Loading…</p>
      </div>
    );
  if (!unsolved.length)
    return (
      <div className="op-empty-state">
        <p className="op-empty-text">
          You haven't raised any open tickets.
        </p>
      </div>
    );
  return (
    <RaisedTicketsTable tickets={unsolved} onRowClick={setTicketDetail} />
  );
}
      case "solved-tickets": {
  const solved = raisedTickets.filter((t) => t.status === "solved");
  if (loadingRaisedTickets)
    return (
      <div className="op-empty-state">
        <div className="op-spinner" />
        <p className="op-empty-text">Loading…</p>
      </div>
    );
  if (!solved.length)
    return (
      <div className="op-empty-state">
        <p className="op-empty-text">
          None of your raised tickets have been solved yet.
        </p>
      </div>
    );
  return <RaisedTicketsTable tickets={solved} onRowClick={setTicketDetail} />;
}
      case "verified-tasks": {
        const verified = myVerifications.filter((v) => v.status === "completed");
        if (loadingMyVerifications)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading…</p>
            </div>
          );
        if (!verified.length)
          return (
            <div className="op-empty-state">
              <p className="op-empty-text">No verified tasks yet.</p>
            </div>
          );
      return <MyVerificationTable verifications={verified} onRowClick={setMyVerificationDetail} />;
      }

      case "task-corrections": {
  const corrections = myVerifications.filter(
    (v) =>
      v.status === "correction_sent" &&
      latestVerificationByTask.get(v.task_id)?.id === v.id,
  );
  if (loadingMyVerifications)
    return (
      <div className="op-empty-state">
        <div className="op-spinner" />
        <p className="op-empty-text">Loading…</p>
      </div>
    );
  if (!corrections.length)
    return (
      <div className="op-empty-state">
        <p className="op-empty-text">No corrections sent back to you.</p>
      </div>
    );
  return (
    <MyVerificationTable
      verifications={corrections}
      onRowClick={setMyVerificationDetail}
      allTasks={allTasks}
      showAction={true}
      onReschedule={(task) => {
        setRescheduleTask(task);
        setRescheduleForm({ requested_date: "", reason: "", verify_with: "" });
      }}
      onSendVerification={handleSendVerification}
      onRaiseTicket={handleRaiseTicket}
    />
  );
}
      case "verify-requests": {
        const fmtDate = (d) =>
          d
            ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—";

        if (loadingVerifyRequests)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading…</p>
            </div>
          );
        if (!verifyRequests.length)
          return (
            <div className="op-empty-state">
              <p className="op-empty-text">
                No reschedule requests sent to you for verification.
              </p>
            </div>
          );

        return (
          <>
            <div className="lv-table-only">
              <VerifyRequestsTable
                requests={verifyRequests}
                onApprove={(req) => handleVerifyAction(req, true)}
                onReject={(req) => handleVerifyAction(req, false)}
                updatingId={updatingVerifyId}
                userMap={userMap}
              />
            </div>
            <div className="lv-cards-only">
              {verifyRequests.map((req) => {
                const isPending = req.status === "pending";
                const sc =
                  req.status === "approved"
                    ? { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" }
                    : req.status === "rejected"
                      ? { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }
                      : { bg: "#fffbeb", color: "#d97706", border: "#fde68a" };
                return (
                  <div
                    key={req.id}
                    className="lv-card"
                    style={{ borderLeftColor: sc.color }}
                  >
                    <div className="lv-card-top">
                      <div>
                        <div className="lv-card-title">
                          {req.tasks?.title || `Task #${req.task_id}`}
                        </div>
                        <div className="lv-card-sub">
                           Requested by {userMap[req.requested_by] || req.requested_by}
                          {req.tasks?.site_name && ` · ${req.tasks.site_name}`}
                        </div>
                      </div>
                      <span
                        className="ap-leave-status"
                        style={{
                          background: sc.bg,
                          color: sc.color,
                          borderColor: sc.border,
                        }}
                      >
                        {req.status.charAt(0).toUpperCase() +
                          req.status.slice(1)}
                      </span>
                    </div>

                    <div className="lv-card-dates">
                      <span className="op-meta-pill">
                        Current due: {fmtDate(req.current_due)}
                      </span>
                      <span
                        className="op-meta-pill"
                        style={{
                          color: "#7c3aed",
                          background: "#f5f3ff",
                          borderColor: "#e0e7ff",
                        }}
                      >
                        Requested: {fmtDate(req.requested_date)}
                      </span>
                    </div>

                    {req.reason && <p className="lv-reason">"{req.reason}"</p>}
                    {req.admin_note && (
                      <div className="lv-rejection">
                        <strong>Rejected:</strong> {req.admin_note}
                      </div>
                    )}

                    {isPending ? (
                      <div className="lv-actions">
                        <button
                          className="lv-btn-approve"
                          disabled={updatingVerifyId === req.id}
                          onClick={() => handleVerifyAction(req, true)}
                        >
                          Approve
                        </button>
                        <button
                          className="lv-btn-reject"
                          disabled={updatingVerifyId === req.id}
                          onClick={() => handleVerifyAction(req, false)}
                        >
                          Reject
                        </button>
                        {updatingVerifyId === req.id && (
                          <span className="ap-saving">saving…</span>
                        )}
                      </div>
                    ) : (
                      <div className="lv-already-responded">
                        {req.status === "approved"
                          ? `✓ Approved — due date updated to ${fmtDate(req.requested_date)}`
                          : "✗ Rejected"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      }
     case "add-drawings": {
  return (
    <div className="lv-form-wrap">
      <div className="lv-form-grid">
        <div className="lv-field">
          <label className="lv-label">
            Site Name <span className="lv-req">*</span>
          </label>
          <select
            className="lv-input lv-select"
            value={drawingForm.site_name}
            onChange={(e) =>
              setDrawingForm((p) => ({ ...p, site_name: e.target.value }))
            }
          >
            <option value="">Select site…</option>
            {allSites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="lv-field">
          <label className="lv-label">
            Date
            <span
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
              defaults to today
            </span>
          </label>
          <input
            className="lv-input"
            type="date"
            value={drawingForm.date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) =>
              setDrawingForm((p) => ({ ...p, date: e.target.value }))
            }
          />
        </div>

        <div className="lv-field lv-col-2">
          <label className="lv-label">
            Drawing Attachments <span className="lv-req">*</span>
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <rect x="3" y="5" width="12" height="14" rx="1" />
              <path d="M6 9h6M6 12h6M6 15h4" />
              <path d="M16 16l5-5 2 2-5 5-3 1z" />
            </svg>
            <input
              type="file"
              multiple
              accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              style={{
                flex: 1,
                fontSize: 12.5,
                color: "#475569",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
              }}
              onChange={(e) => {
                const newFiles = Array.from(e.target.files || []);
                setDrawingForm((p) => ({
                  ...p,
                  files: [...p.files, ...newFiles],
                }));
                e.target.value = "";
              }}
            />
          </div>
          {drawingForm.files.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                marginTop: 6,
              }}
            >
              {drawingForm.files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#475569",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "5px 10px",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name}
                  </span>
                  <button
                    onClick={() =>
                      setDrawingForm((p) => ({
                        ...p,
                        files: p.files.filter((_, idx) => idx !== i),
                      }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#dc2626",
                      fontWeight: 700,
                      padding: "0 2px",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
            Multiple files allowed — PDF, DWG, DXF, images, and Word docs supported.
          </span>
        </div>

        <div className="lv-field lv-col-2 lv-actions-row">
          <button
            className="lv-btn-reset"
            onClick={() => setDrawingForm({ site_name: "", date: "", files: [] })}
          >
            Reset
          </button>
          <button
            className="lv-btn-submit"
            onClick={handleDrawingSubmit}
            disabled={drawingSubmitting}
          >
            {drawingSubmitting ? (
              <>
                <span className="op-mini-spinner" />
                &nbsp;Uploading…
              </>
            ) : (
              "Upload Drawings"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

case "all-drawings":
  return loadingDrawings ? (
    <div className="op-empty-state">
      <div className="op-spinner" />
      <p className="op-empty-text">Loading drawings…</p>
    </div>
  ) : allDrawings.length === 0 ? (
    <div className="op-empty-state">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.3 }}
      >
        <rect x="3" y="5" width="12" height="14" rx="1" />
        <path d="M6 9h6M6 12h6M6 15h4" />
      </svg>
      <p className="op-empty-text">No drawings uploaded yet.</p>
      <button
        className="lv-btn-submit"
        style={{ marginTop: 4 }}
        onClick={() => setActiveTab("add-drawings")}
      >
        Add Drawings
      </button>
    </div>
  ) : (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))",
        gap: 12,
      }}
    >
      {allDrawings.flatMap((d) =>
        (d.file_urls || []).map((f, i) => {
          const isImg = isImageFile(f.url);
          return (
            <div
              key={`${d.id}-${i}`}
              style={{
                background: "#fff",
                border: "1.5px solid #e8edf3",
                borderTop: "3px solid #6d4aa8",
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {isImg ? (
                <img
                  src={f.url}
                  alt=""
                  style={{ width: "100%", height: 150, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    height: 150,
                    cursor: "pointer",
                  }}
                  onClick={() => window.open(getViewUrl(f.url), "_blank")}
                >
                  <iframe
                    src={`${f.url}#toolbar=0&navpanel=0&scrollbar=0&view=FitH`}
                    title={f.name}
                    loading="lazy"
                    scrolling="no"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: -20,
                      width: "calc(100% + 40px)",
                      height: "260%",
                      border: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              )}
              <div style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    alignSelf: "flex-start",
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: "#f1ecf9",
                    color: "#6d4aa8",
                  }}
                >
                  Drawing
                </span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{f.name}</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  {d.site_name} · {new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  
                  <a  href={getViewUrl(f.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 34,
                      borderRadius: 7,
                      fontSize: 11.5,
                      fontWeight: 700,
                      textDecoration: "none",
                      border: "1.5px solid #e2e8f0",
                      color: "#64748b",
                      background: "#f8fafc",
                    }}
                  >
                    View
                  </a>
                  
                  <a  href={f.url}
                    download
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 34,
                      borderRadius: 7,
                      fontSize: 11.5,
                      fontWeight: 700,
                      textDecoration: "none",
                      color: "#0369a1",
                      background: "#f0f9ff",
                      border: "1.5px solid #bae6fd",
                    }}
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
      case "site-report":
        return <SiteReport user={user} />;
      case "my-reports":
        if (loadingSvrReports)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading your reports…</p>
            </div>
          );
        if (!mySvrReports.length)
          return (
            <div className="op-empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.3 }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="op-empty-text">
                You haven't submitted any Site Visit Reports yet.
              </p>
            </div>
          );
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
              gap: 12,
            }}
          >
            {mySvrReports.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e8edf3",
                  borderLeft: "4px solid #16a34a",
                  borderRadius: 10,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 20,
                      background: "#f0fdf4",
                      color: "#16a34a",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    Site Visit
                  </span>
                  {r.site_name && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      {r.site_name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "#64748b" }}>
                  {r.visit_date
                    ? new Date(r.visit_date + "T00:00:00").toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" },
                      )
                    : "—"}
                </div>
                {r.progress_of_work && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      lineHeight: 1.5,
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {r.progress_of_work}
                  </p>
                )}
                {r.pdf_url ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={r.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#475569",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 7,
                        padding: "6px 12px",
                        textDecoration: "none",
                      }}
                    >
                      View
                    </a>
                    <a
                      href={buildDownloadUrl(
                        r.pdf_url,
                        `${r.site || "site"}-${r.source}-${r.date || r.id}.pdf`,
                      )}
                      download
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#2563eb",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 7,
                        padding: "6px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </a>
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      fontStyle: "italic",
                    }}
                  >
                    No PDF attached
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      case "checklists":
        return <Checklists user={user} />;

      case "my-reschedules":
        if (loadingReschedules)
          return (
            <div className="op-empty-state">
              <div className="op-spinner" />
              <p className="op-empty-text">Loading…</p>
            </div>
          );
        if (!myReschedules.length)
          return (
            <div className="op-empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.3 }}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <p className="op-empty-text">
                You haven't submitted any reschedule requests yet.
              </p>
            </div>
          );

        return (
          <>
            <div className="lv-table-only">
              <MyRescheduleTable
                reschedules={myReschedules}
                allTasks={allTasks}
                userMap={userMap}
                onReschedule={(task) => {
                  setRescheduleTask(task);
                  setRescheduleForm({ requested_date: "", reason: "", verify_with: "" });
                }}
                onSendVerification={handleSendVerification}
                onRaiseTicket={handleRaiseTicket}
              />
            </div>
            <div className="lv-cards-only">
              {myReschedules.map((req) => {
                const isPending = req.status === "pending";
                const isApproved = req.status === "approved";
                const isRejected = req.status === "rejected";
                const isUnread =
                  req.employee_read !== true && (isApproved || isRejected);

                const statusColors = {
                  pending: {
                    bg: "#fffbeb",
                    color: "#d97706",
                    border: "#fde68a",
                    leftBorder: "#f59e0b",
                  },
                  approved: {
                    bg: "#f0fdf4",
                    color: "#16a34a",
                    border: "#bbf7d0",
                    leftBorder: "#16a34a",
                  },
                  rejected: {
                    bg: "#fef2f2",
                    color: "#dc2626",
                    border: "#fecaca",
                    leftBorder: "#dc2626",
                  },
                };
                const sc = statusColors[req.status] || statusColors.pending;

                const fmtDate = (d) =>
                  d
                    ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                return (
                  <div
                    key={req.id}
                    className="lv-card"
                    style={{
                      borderLeftColor: sc.leftBorder,
                      // Subtle highlight for unread actioned cards
                      background: isUnread ? "#fafafa" : "#fff",
                      boxShadow: isUnread ? "0 0 0 2px #e0e7ff" : undefined,
                    }}
                  >
                    {/* ── Top: task name + status badge ── */}
                    <div className="lv-card-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <div className="lv-card-title">
                            {req.tasks?.title || `Task #${req.task_id}`}
                          </div>
                          {/* NEW badge for unread decisions */}
                          {isUnread && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "2px 7px",
                                borderRadius: 20,
                                background: "#7c3aed",
                                color: "#fff",
                                letterSpacing: ".04em",
                                flexShrink: 0,
                              }}
                            >
                              NEW
                            </span>
                          )}
                        </div>
                        {req.tasks?.site_name && (
                          <div className="lv-card-sub">
                            {req.tasks.site_name}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 20,
                          background: sc.bg,
                          color: sc.color,
                          border: `1px solid ${sc.border}`,
                        }}
                      >
                        {isPending && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        )}
                        {isApproved && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                        {isRejected && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        )}
                        {req.status.charAt(0).toUpperCase() +
                          req.status.slice(1)}
                      </span>
                    </div>

                    {/* ── Pending state: "awaiting admin review" banner ── */}
                    {isPending && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: 8,
                          padding: "10px 12px",
                          fontSize: 12.5,
                          color: "#92400e",
                          lineHeight: 1.5,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        <span>
                          <strong>Pending admin approval</strong> — your request
                          has been submitted and is awaiting review.
                        </span>
                      </div>
                    )}

                    {/* ── Approved state: confirmation banner ── */}
                    {isApproved && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 8,
                          padding: "10px 12px",
                          fontSize: 12.5,
                          color: "#166534",
                          lineHeight: 1.5,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span>
                          <strong>Approved!</strong> Your task due date has been
                          updated to{" "}
                          <strong>{fmtDate(req.requested_date)}</strong>.
                        </span>
                      </div>
                    )}

                    {/* ── Rejected state: rejection banner ── */}
                    {isRejected && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: 8,
                          padding: "10px 12px",
                          fontSize: 12.5,
                          color: "#991b1b",
                          lineHeight: 1.5,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0, marginTop: 1 }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>
                          <strong>Rejected.</strong>{" "}
                          {req.admin_note
                            ? `Reason: ${req.admin_note}`
                            : "Your reschedule request was not approved."}
                        </span>
                      </div>
                    )}

                    {/* ── Date pills ── */}
                    <div className="lv-card-dates">
                      <span className="op-meta-pill">
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Current due: {fmtDate(req.current_due)}
                      </span>
                      <span
                        className="op-meta-pill"
                        style={{
                          color: "#7c3aed",
                          background: "#f5f3ff",
                          borderColor: "#e0e7ff",
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Requested: {fmtDate(req.requested_date)}
                      </span>
                    </div>

                    {/* ── Reason ── */}
                    {req.reason && <p className="lv-reason">"{req.reason}"</p>}

                    {/* ── Actioned by / submitted on ── */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      {req.actioned_by && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {isApproved ? "Approved" : "Rejected"} by{" "}
                          {userMap[req.actioned_by] || req.actioned_by}
                          {req.actioned_at &&
                            ` · ${new Date(req.actioned_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                        Submitted{" "}
                        {new Date(req.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );

      // ADD before the default case:
      case "report-submissions": {
        if (user?.role?.toLowerCase().trim() !== "project head") return null;

        const fmtD = (d) =>
          d
            ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—";
        const fmtDT = (dt) =>
          dt
            ? new Date(dt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "—";

        // Filter by tab
        const tabFiltered = siteReports.filter((r) => {
          if (reportTab === "dpr")
            return r.source === "dpr" && r.report_type !== "morning";
          if (reportTab === "svr") return r.source === "svr";
          if (reportTab === "wpr") return r.source === "wpr";
          return true;
        });

        // Further filter by month + site
        const monthFiltered = tabFiltered.filter((r) => {
          if (reportFilter.site && r.site !== reportFilter.site) return false;
          if (
            reportFilter.month &&
            !(r.date || "").startsWith(reportFilter.month)
          )
            return false;
          return true;
        });

        const reportSites = [
          ...new Set(siteReports.map((r) => r.site).filter(Boolean)),
        ].sort();
        const withPdf = monthFiltered.filter((r) => r.pdf_url).length;

        // Group by date
        const grouped = {};
        monthFiltered.forEach((r) => {
          const d = r.date || r.created_at?.slice(0, 10) || "—";
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(r);
        });
        const sortedDates = Object.keys(grouped).sort((a, b) =>
          b.localeCompare(a),
        );

        const TAB_CONFIG = [
          {
            key: "dpr",
            label: "DPR",
            color: "#2563eb",
            bg: "#eff6ff",
            border: "#bfdbfe",
          },
          {
            key: "wpr",
            label: "WPR",
            color: "#7c3aed",
            bg: "#f5f3ff",
            border: "#e0e7ff",
          },
          {
            key: "svr",
            label: "SVR",
            color: "#16a34a",
            bg: "#f0fdf4",
            border: "#bbf7d0",
          },
        ];

        const DPR_TYPE_COLOR = {
          morning: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
          evening: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
          weekly: { bg: "#f5f3ff", color: "#7c3aed", border: "#e0e7ff" },
        };

        return (
          <div>
            {/* ── Professional overview banner ── */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 20,
                padding: "18px 22px",
                borderRadius: 14,
                background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
                color: "#fff",
              }}
            >
              <div style={{ minWidth: 200 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "#93c5fd",
                    marginBottom: 6,
                  }}
                >
                  Project Head Overview
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 5 }}>
                  Report Submissions
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "#cbd5e1",
                    lineHeight: 1.6,
                    maxWidth: 480,
                  }}
                >
                  Daily, weekly and site visit reports submitted across{" "}
                  <strong style={{ color: "#fff" }}>
                    {(user?.site_names?.length
                      ? user.site_names
                      : user?.site_name
                        ? [user.site_name]
                        : []
                    ).join(", ") || "your sites"}
                  </strong>
                  .
                </div>
              </div>

              {/* Quick stat chips */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  {
                    label: "DPR",
                    count: siteReports.filter((r) => r.source === "dpr").length,
                    color: "#60a5fa",
                  },
                  {
                    label: "WPR",
                    count: siteReports.filter((r) => r.source === "wpr").length,
                    color: "#c4b5fd",
                  },
                  {
                    label: "SVR",
                    count: siteReports.filter((r) => r.source === "svr").length,
                    color: "#86efac",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 64,
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        fontFamily: "'DM Mono',monospace",
                        color: s.color,
                      }}
                    >
                      {s.count}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: ".08em",
                        color: "#94a3b8",
                        marginTop: 2,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tab bar ── */}
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                borderRadius: 10,
                background: "#f1f5f9",
                border: "1px solid #e8edf3",
                marginBottom: 20,
              }}
            >
              {TAB_CONFIG.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setReportTab(t.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    borderRadius: 7,
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12.5,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    transition: "all .15s",
                    color: reportTab === t.key ? t.color : "#64748b",
                    background: reportTab === t.key ? "#fff" : "transparent",
                    boxShadow:
                      reportTab === t.key
                        ? "0 1px 6px rgba(0,0,0,.08)"
                        : "none",
                  }}
                >
                  {t.label}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 20,
                      background: reportTab === t.key ? t.bg : "#e2e8f0",
                      color: reportTab === t.key ? t.color : "#94a3b8",
                    }}
                  >
                    {siteReports.filter((r) => r.source === t.key).length}
                  </span>
                </button>
              ))}
            </div>

            {/* ── WPR coming soon ── */}
            {reportTab === "wpr" &&
              siteReports.filter((r) => r.source === "wpr").length === 0 && (
                <div className="op-empty-state">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.3 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                  <p className="op-empty-text" style={{ fontWeight: 700 }}>
                    No weekly reports yet
                  </p>
                  <p
                    className="op-empty-text"
                    style={{ fontSize: 12, marginTop: -4 }}
                  >
                    Weekly reports from your site(s) will appear here once
                    submitted.
                  </p>
                </div>
              )}

            {reportTab !== "wpr" ||
            siteReports.filter((r) => r.source === "wpr").length > 0 ? (
              <>
                {/* ── Filters ── */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 18,
                    padding: "10px 14px",
                    background: "#c9d0d4d0",
                    border: "1px solid #c9d0d4d0",
                    borderRadius: 10,
                  }}
                >
                  <input
                    type="month"
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12.5,
                      color: "#1e293b",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      padding: "5px 9px",
                      height: 32,
                      cursor: "pointer",
                      outline: "none",
                    }}
                    value={reportFilter.month}
                    onChange={(e) =>
                      setReportFilter((p) => ({ ...p, month: e.target.value }))
                    }
                  />
                  {reportSites.length > 1 && (
                    <select
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12.5,
                        color: "#1e293b",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        padding: "5px 9px",
                        height: 32,
                        cursor: "pointer",
                        outline: "none",
                      }}
                      value={reportFilter.site}
                      onChange={(e) =>
                        setReportFilter((p) => ({ ...p, site: e.target.value }))
                      }
                    >
                      <option value="">All Sites</option>
                      {reportSites.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                  {Object.values(reportFilter).some((v) => v) && (
                    <button
                      onClick={() =>
                        setReportFilter({ type: "", site: "", month: "" })
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#dc2626",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 6,
                        padding: "5px 11px",
                        height: 32,
                        cursor: "pointer",
                      }}
                    >
                      ✕ Clear
                    </button>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      color: "#94a3b8",
                      alignSelf: "center",
                    }}
                  >
                    {monthFiltered.length} of {tabFiltered.length} reports
                  </span>
                </div>

                {/* ── Content ── */}
                {loadingReports ? (
                  <div className="op-empty-state">
                    <div className="op-spinner" />
                    <p className="op-empty-text">Loading reports…</p>
                  </div>
                ) : monthFiltered.length === 0 ? (
                  <div className="op-empty-state">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.3 }}
                    >
                      <path d="M3 3v18h18" />
                      <path d="M7 16l4-4 4 4 4-4" />
                    </svg>
                    <p className="op-empty-text">
                      No {reportTab.toUpperCase()} reports found
                      {reportFilter.month ? " for this month" : ""}.
                    </p>
                  </div>
                ) : (
                  <div className="tt-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Engineer</th>
                          <th>Site</th>
                          <th>Files</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthFiltered.map((r) => {
                          const accent =
                            r.source === "svr"
                              ? "#16a34a"
                              : r.source === "wpr"
                                ? "#7c3aed"
                                : DPR_TYPE_COLOR[r.report_type]?.color ||
                                  "#2563eb";

                          const typeBadge =
                            r.source === "svr"
                              ? {
                                  bg: "#f0fdf4",
                                  color: "#16a34a",
                                  border: "#bbf7d0",
                                  label: "Site Visit",
                                }
                              : r.source === "wpr"
                                ? {
                                    bg: "#f5f3ff",
                                    color: "#7c3aed",
                                    border: "#e0e7ff",
                                    label: "Weekly Report",
                                  }
                                : r.report_type === "morning"
                                  ? {
                                      bg: "#fffbeb",
                                      color: "#d97706",
                                      border: "#fde68a",
                                      label: "Morning DPR",
                                    }
                                  : r.report_type === "evening"
                                    ? {
                                        bg: "#eff6ff",
                                        color: "#2563eb",
                                        border: "#bfdbfe",
                                        label: "Evening DPR",
                                      }
                                    : {
                                        bg: "#f8fafc",
                                        color: "#64748b",
                                        border: "#e8edf3",
                                        label: r.report_type || "Report",
                                      };

                          const preview =
                            r.source === "svr"
                              ? r.progress_of_work
                              : r.source === "dpr"
                                ? r.payload?.work_done
                                : null;

                          return (
                            <tr key={r.id} className="tt-row">
                              <td>
                                {fmtD(r.date || r.created_at?.slice(0, 10))}
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {new Date(r.created_at).toLocaleTimeString(
                                    "en-IN",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    },
                                  )}
                                </div>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "3px 9px",
                                    borderRadius: 20,
                                    background: typeBadge.bg,
                                    color: typeBadge.color,
                                    border: `1px solid ${typeBadge.border}`,
                                  }}
                                >
                                  {typeBadge.label}
                                </span>
                                {r.source === "wpr" && r.week_end && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#64748b",
                                      marginTop: 4,
                                    }}
                                  >
                                    {fmtD(r.week_start)} → {fmtD(r.week_end)}
                                  </div>
                                )}
                              </td>
                              <td>{r.engineer || "—"}</td>
                              <td>{r.site || "—"}</td>
                              <td>
                                {r.pdf_url ? (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <a
                                      href={getViewUrl(r.pdf_url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: "#475569",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: 6,
                                        padding: "4px 10px",
                                        textDecoration: "none",
                                      }}
                                    >
                                      View
                                    </a>

                                    <a
                                      href={r.pdf_url}
                                      download
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: "#2563eb",
                                        background: "#eff6ff",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: 6,
                                        padding: "4px 10px",
                                        textDecoration: "none",
                                      }}
                                    >
                                      Download
                                    </a>
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      color: "#94a3b8",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    No file
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <div className="op-root">
        <Navbar
          onMenuToggle={() => setSidebarOpen((p) => !p)}
          menuOpen={sidebarOpen}
        />
        {toast && (
          <div className={`op-toast op-toast-${toast.type}`}>
            {toast.type === "success" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {toast.msg}
          </div>
        )}

        <div className="op-body">
          {sidebarOpen && (
            <button
              className="op-sidebar-backdrop"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside className={`op-sidebar${sidebarOpen ? "" : " collapsed"}`}>
            <div className="op-sidebar-header">
              <button
                className="op-sidebar-close"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <PortalSwitcher
              items={[
                canSwitchToAdmin && {
                  key: "admin",
                  label: "Admin",
                  href: "/admin",
                  title: "Open Admin portal",
                },
                canSwitchToMdo && {
                  key: "mdo",
                  label: "MDO",
                  href: "/mdo",
                  title: "Open MDO portal",
                },
                canSwitchToSite && {
                  key: "site",
                  label: "Site",
                  href: "/site",
                  title: "Open Site portal",
                },
              ].filter(Boolean)}
            />
            <nav className="op-nav">
              <span className="op-nav-section">Tasks</span>
            {filterNav(TASK_NAV.filter(
              (item) => item.key !== "delegated-tasks" || user?.role?.toLowerCase().trim() === "admin",
            ), user, "office").map((item) => (
              <NavButton
                key={item.key}
                itemKey={item.key}
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.key}
                isHovered={hoveredNavKey === item.key}
                onEnter={() => setHoveredNavKey(item.key)}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick(item.key)}
              />
            ))}

            {((verifyRequests.length > 0 && filterNav([VERIFY_REQUESTS_ITEM], user, "office").length > 0) ||
              canVerifyTasks) && (
              <NavButton
                itemKey="verify-requests"
                icon={VERIFY_REQUESTS_ITEM.icon}
                label={VERIFY_REQUESTS_ITEM.label}
                isActive={activeTab === "verify-requests"}
                isHovered={hoveredNavKey === "verify-requests"}
                onEnter={() => setHoveredNavKey("verify-requests")}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick("verify-requests")}
                badge={verifyRequests.filter((r) => r.status === "pending").length}
              />
            )}

            <span className="op-nav-section" style={{ marginTop: 8 }}>Tickets</span>

            {((newTickets.length > 0 &&
              filterNav([NEW_TICKETS_ITEM], user, "office").length > 0) ||
              canResolveTickets) && (
              <NavButton
                itemKey="new-tickets"
                icon={NEW_TICKETS_ITEM.icon}
                label={NEW_TICKETS_ITEM.label}
                isActive={activeTab === "new-tickets"}
                isHovered={hoveredNavKey === "new-tickets"}
                onEnter={() => setHoveredNavKey("new-tickets")}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick("new-tickets")}
                badge={newTickets.filter((t) => t.status === "open").length}
              />
            )}

            {filterNav(TICKETS_NAV, user, "office").map((item) => (
              <NavButton
                key={item.key}
                itemKey={item.key}
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.key}
                isHovered={hoveredNavKey === item.key}
                onEnter={() => setHoveredNavKey(item.key)}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick(item.key)}
                badge={
                  item.key === "solved-tickets"
                    ? raisedTickets.filter((t) => t.status === "solved" && t.raised_by_read !== true).length
                    : undefined
                }
              />
            ))}

            {myVerifications.length > 0 && (
              <>
                <span className="op-nav-section" style={{ marginTop: 8 }}>Verification</span>
                <NavButton
                  itemKey="verified-tasks"
                  icon={VERIFIED_TASKS_ITEM.icon}
                  label={VERIFIED_TASKS_ITEM.label}
                  isActive={activeTab === "verified-tasks"}
                  isHovered={hoveredNavKey === "verified-tasks"}
                  onEnter={() => setHoveredNavKey("verified-tasks")}
                  onLeave={() => setHoveredNavKey(null)}
                  onClick={() => handleNavClick("verified-tasks")}
                />
                <NavButton
                  itemKey="task-corrections"
                  icon={TASK_CORRECTIONS_ITEM.icon}
                  label={TASK_CORRECTIONS_ITEM.label}
                  isActive={activeTab === "task-corrections"}
                  isHovered={hoveredNavKey === "task-corrections"}
                  onEnter={() => setHoveredNavKey("task-corrections")}
                  onLeave={() => setHoveredNavKey(null)}
                  onClick={() => handleNavClick("task-corrections")}
                  badge={
                    myVerifications.filter(
                      (v) =>
                        v.status === "correction_sent" &&
                        v.correction_read !== true &&
                        latestVerificationByTask.get(v.task_id)?.id === v.id,
                    ).length
                  }
                />
              </>
            )}

            <span className="op-nav-section" style={{ marginTop: 8 }}>Leave</span>
            {filterNav(LEAVE_NAV.filter(
              (item) => item.key !== "proxy-request" || proxyLeaves.length > 0,
            ), user, "office").map((item) => (
              <NavButton
                key={item.key}
                itemKey={item.key}
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.key}
                isHovered={hoveredNavKey === item.key}
                onEnter={() => setHoveredNavKey(item.key)}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick(item.key)}
                badge={
                  item.key === "my-leaves"
                    ? unreadLeavesCount
                    : item.key === "proxy-request"
                    ? proxyPendingCount
                    : undefined
                }
              />
            ))}

            <span className="op-nav-section" style={{ marginTop: 8 }}>Reports</span>
            {filterNav(REPORTS_NAV, user, "office").map((item) => (
              <NavButton
                key={item.key}
                itemKey={item.key}
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.key}
                isHovered={hoveredNavKey === item.key}
                onEnter={() => setHoveredNavKey(item.key)}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick(item.key)}
              />
            ))}

            {user?.role?.toLowerCase().trim() === "project head" && (
              <NavButton
                itemKey="report-submissions"
                icon={REPORT_SUBMISSIONS_ITEM.icon}
                label={REPORT_SUBMISSIONS_ITEM.label}
                isActive={activeTab === "report-submissions"}
                isHovered={hoveredNavKey === "report-submissions"}
                onEnter={() => setHoveredNavKey("report-submissions")}
                onLeave={() => setHoveredNavKey(null)}
                onClick={() => handleNavClick("report-submissions")}
              />
            )}
            </nav>
          </aside>

          <main className="op-main" ref={mainRef} >
            <div className="op-content-card">
              <div className="op-content-header">
                <div className="op-header-left">
                  <div className="op-content-icon">{activeItem?.icon}</div>
                  <span className="op-content-title">{activeItem?.label}</span>
                </div>
                {/* Show filter controls only on task tabs */}
                {["my-tasks", "recurring-tasks", "all-tasks"].includes(activeTab) && (
                  <>
                    <div className="tf-bar-inline" >
                      <TaskFilterBar
                      userMap={userMap}
                        filters={
                          activeTab === "my-tasks"
                            ? myTaskFilters
                            : activeTab === "recurring-tasks"
                            ? recurringFilters
                            : allTaskFilters
                        }
                        onChange={
                          activeTab === "my-tasks"
                            ? makeFilterChange(setMyTaskFilters)
                            : activeTab === "recurring-tasks"
                            ? makeFilterChange(setRecurringFilters)
                            : makeFilterChange(setAllTaskFilters)
                        }
                        onClear={
                          activeTab === "my-tasks"
                            ? makeFilterClear(setMyTaskFilters)
                            : activeTab === "recurring-tasks"
                            ? makeFilterClear(setRecurringFilters)
                            : makeFilterClear(setAllTaskFilters)
                        }
                        taskList={
                          activeTab === "my-tasks"
                            ? myTasks
                            : activeTab === "recurring-tasks"
                            ? recurringTasks
                            : allAssignedTasks
                        }
                      />
                    </div>

                    {/* Mobile: filter icon button + popup */}
                    <div
                      style={{
                        position: "relative",
                        marginLeft: "auto",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        className={`tf-mobile-btn${mobileFilterOpen ? " active" : ""}`}
                        onClick={() => setMobileFilterOpen((p) => !p)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        >
                          <line x1="4" y1="6" x2="20" y2="6" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                          <line x1="11" y1="18" x2="13" y2="18" />
                        </svg>
                      </button>
                      {mobileFilterOpen && (
                        <div className="tf-popup">
                          <TaskFilterBar
                            filters={
                              activeTab === "my-tasks"
                                ? myTaskFilters
                                : activeTab === "recurring-tasks"
                                ? recurringFilters
                                : allTaskFilters
                            }
                            onChange={
                              activeTab === "my-tasks"
                                ? makeFilterChange(setMyTaskFilters)
                                : activeTab === "recurring-tasks"
                                ? makeFilterChange(setRecurringFilters)
                                : makeFilterChange(setAllTaskFilters)
                            }
                            onClear={
                              activeTab === "my-tasks"
                                ? makeFilterClear(setMyTaskFilters)
                                : activeTab === "recurring-tasks"
                                ? makeFilterClear(setRecurringFilters)
                                : makeFilterClear(setAllTaskFilters)
                            }
                            taskList={
                              activeTab === "my-tasks"
                                ? myTasks
                                : activeTab === "recurring-tasks"
                                ? recurringTasks
                                : allAssignedTasks
                            }
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
      {rescheduleTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10030,
            background: "rgba(15,23,42,.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRescheduleTask(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#f5f3ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7c3aed",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </div>
                <span
                  style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}
                >
                  Request Reschedule
                </span>
              </div>
              <button
                onClick={() => setRescheduleTask(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Task info */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e8edf3",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}
                >
                  {rescheduleTask.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 4,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {rescheduleTask.due_date && (
                    <span>
                      Current due:{" "}
                      <strong>
                        {new Date(
                          rescheduleTask.due_date + "T00:00:00",
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                    </span>
                  )}
                  {rescheduleTask.site_name && (
                    <span>
                      Site: <strong>{rescheduleTask.site_name}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* New date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Requested New Date <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="date"
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13.5,
                    color: "#1e293b",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "9px 12px",
                    outline: "none",
                    width: "100%",
                  }}
                  min={
                    rescheduleTask.due_date
                      ? rescheduleTask.due_date
                      : new Date().toISOString().slice(0, 10)
                  }
                  value={rescheduleForm.requested_date}
                  onChange={(e) =>
                    setRescheduleForm((p) => ({
                      ...p,
                      requested_date: e.target.value,
                    }))
                  }
                />
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Must be after the current due date.
                </span>
              </div>

              {/* Reason */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Reason for Reschedule{" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly explain why you need a reschedule…"
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13.5,
                    color: "#1e293b",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "9px 12px",
                    outline: "none",
                    width: "100%",
                    resize: "vertical",
                    minHeight: 80,
                  }}
                  value={rescheduleForm.reason}
                  onChange={(e) =>
                    setRescheduleForm((p) => ({ ...p, reason: e.target.value }))
                  }
                />
              </div>
              {/* Send for verification */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Send for Verification To
                  <span
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
                <select
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13.5,
                    color: "#1e293b",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "9px 12px",
                    outline: "none",
                    width: "100%",
                    cursor: "pointer",
                  }}
                  value={rescheduleForm.verify_with}
                  onChange={(e) =>
                    setRescheduleForm((p) => ({
                      ...p,
                      verify_with: e.target.value,
                    }))
                  }
                >
                  <option value="">Select Engineer Office staff…</option>
                  {engineerOfficeUsers.map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Choose who should verify this task once rescheduled.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 22px 18px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={() => setRescheduleTask(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#f1f5f9",
                  color: "#475569",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={rescheduleSub}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "#7c3aed",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  opacity: rescheduleSub ? 0.6 : 1,
                }}
              >
                {rescheduleSub ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: 13,
                        height: 13,
                        border: "2px solid rgba(255,255,255,.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin .6s linear infinite",
                      }}
                    />{" "}
                    Submitting…
                  </>
                ) : (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>{" "}
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {verifyRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10040,
            background: "rgba(15,23,42,.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setVerifyRejectModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 24px 64px rgba(0,0,0,.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                Reject Reschedule Request
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {verifyRejectModal.req.tasks?.title ||
                  `Task #${verifyRejectModal.req.task_id}`}
              </div>
            </div>
            <div
              style={{
                padding: "16px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <label
                style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
              >
                Reason for Rejection <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                placeholder="Explain why this reschedule is being rejected…"
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  color: "#1e293b",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "9px 12px",
                  outline: "none",
                  width: "100%",
                  resize: "vertical",
                  minHeight: 90,
                }}
                value={verifyRejectModal.reason}
                onChange={(e) =>
                  setVerifyRejectModal((p) => ({
                    ...p,
                    reason: e.target.value,
                  }))
                }
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 22px 18px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={() => setVerifyRejectModal(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyRejectConfirm}
                disabled={!verifyRejectModal.reason.trim()}
                style={{
                  background: verifyRejectModal.reason.trim()
                    ? "#dc2626"
                    : "#f1f5f9",
                  color: verifyRejectModal.reason.trim() ? "#fff" : "#94a3b8",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: verifyRejectModal.reason.trim()
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
      {rejectTaskModal && (
  <div
    style={{
      position: "fixed", inset: 0, zIndex: 10040,
      background: "rgba(15,23,42,.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) setRejectTaskModal(null); }}
  >
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,.22)", overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Reject Task</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{rejectTaskModal.task.title}</div>
      </div>
      <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>
          Reason for Rejection <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <textarea
          rows={3}
          autoFocus
          placeholder="Explain why you can't take this task…"
          style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: "#1e293b",
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "9px 12px", outline: "none", width: "100%", resize: "vertical", minHeight: 90,
          }}
          value={rejectTaskModal.reason}
          onChange={(e) => setRejectTaskModal((p) => ({ ...p, reason: e.target.value }))}
        />
        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
          This will be visible to {userMap[rejectTaskModal.task.assigned_by] || rejectTaskModal.task.assigned_by || "the person who assigned this"}.
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 22px 18px", borderTop: "1px solid #f1f5f9" }}>
        <button
          onClick={() => setRejectTaskModal(null)}
          style={{ background: "#f1f5f9", color: "#475569", fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={handleRejectTaskConfirm}
          disabled={rejectingTaskId === rejectTaskModal.task.id || !rejectTaskModal.reason.trim()}
          style={{
            background: rejectTaskModal.reason.trim() ? "#dc2626" : "#f1f5f9",
            color: rejectTaskModal.reason.trim() ? "#fff" : "#94a3b8",
            fontSize: 13.5, fontWeight: 600, padding: "9px 20px", borderRadius: 8, border: "none",
            cursor: rejectTaskModal.reason.trim() ? "pointer" : "not-allowed",
          }}
        >
          {rejectingTaskId === rejectTaskModal.task.id ? "Rejecting…" : "Confirm Rejection"}
        </button>
      </div>
    </div>
  </div>
)}
      {ticketModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10040,
            background: "rgba(15,23,42,.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setTicketModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 24px 64px rgba(0,0,0,.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                Raise Ticket
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {ticketModal.task?.title}
              </div>
            </div>

            <div
              style={{
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Send To <span style={{ color: "#dc2626" }}>*</span>
                </label>

                {/* Recipient category toggle */}
                <div
                  style={{
                    display: "inline-flex",
                    gap: 4,
                    padding: 4,
                    borderRadius: 8,
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    width: "fit-content",
                  }}
                >
                  {[
                    { key: "admin", label: "Admins" },
                    { key: "technical", label: "Technical Team" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        setTicketModal((p) => ({
                          ...p,
                          recipientType: opt.key,
                          assigned_to: "",
                        }))
                      }
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12.5,
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        color:
                          ticketModal.recipientType === opt.key
                            ? "#2563eb"
                            : "#64748b",
                        background:
                          ticketModal.recipientType === opt.key
                            ? "#fff"
                            : "transparent",
                        boxShadow:
                          ticketModal.recipientType === opt.key
                            ? "0 1px 6px rgba(0,0,0,.08)"
                            : "none",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <select
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13.5,
                    color: "#1e293b",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "9px 12px",
                    outline: "none",
                    width: "100%",
                    cursor: "pointer",
                  }}
                  value={ticketModal.assigned_to}
                  onChange={(e) =>
                    setTicketModal((p) => ({
                      ...p,
                      assigned_to: e.target.value,
                    }))
                  }
                >
                  <option value="">
                    {ticketModal.recipientType === "technical"
                      ? "Select technical team member…"
                      : "Select admin…"}
                  </option>
                  {(ticketModal.recipientType === "technical"
                    ? technicalUsers
                    : adminUsers
                  )
                    .filter((u) => u.username !== user?.user_name)
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    .map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.name}
                      </option>
                    ))}
                </select>
                {(ticketModal.recipientType === "technical"
                  ? technicalUsers
                  : adminUsers
                ).length === 0 && (
                  <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                    {ticketModal.recipientType === "technical"
                      ? "No MIS Head / MIS Executive users found."
                      : "No Admin department users found."}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Your Query <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the issue or question…"
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13.5,
                    color: "#1e293b",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "9px 12px",
                    outline: "none",
                    width: "100%",
                    resize: "vertical",
                    minHeight: 90,
                  }}
                  value={ticketModal.query}
                  onChange={(e) =>
                    setTicketModal((p) => ({ ...p, query: e.target.value }))
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Attach Document
                  <span
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
                  type="file"
                  onChange={(e) =>
                    setTicketModal((p) => ({
                      ...p,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                  style={{ fontSize: 12.5 }}
                />
                {ticketModal.file && (
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>
                    {ticketModal.file.name}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 22px 18px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={() => setTicketModal(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTicketSubmit}
                disabled={ticketModal.submitting}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  opacity: ticketModal.submitting ? 0.6 : 1,
                }}
              >
                {ticketModal.submitting ? "Submitting…" : "Raise Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {verifyModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 10040,
      background: "rgba(15,23,42,.5)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) setVerifyModal(null);
    }}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
          Send for Verification
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
          {verifyModal.task?.title}
        </div>
      </div>

      <div
        style={{
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>
            Send To <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <select
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13.5,
              color: "#1e293b",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "9px 12px",
              outline: "none",
              width: "100%",
              cursor: "pointer",
            }}
            value={verifyModal.verifier}
            onChange={(e) =>
              setVerifyModal((p) => ({ ...p, verifier: e.target.value }))
            }
          >
            <option value="">Select admin…</option>
            {adminUsers.map((u) => (
              <option key={u.username} value={u.username}>
                {u.name}
              </option>
            ))}
          </select>
          {adminUsers.length === 0 && (
            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
              No Admin department users found.
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>
            Attach Documents
            <span
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
              optional, multiple allowed
            </span>
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => {
              const newFiles = Array.from(e.target.files || []);
              setVerifyModal((p) => ({
                ...p,
                files: [...p.files, ...newFiles],
              }));
              e.target.value = "";
            }}
            style={{ fontSize: 12.5 }}
          />
          {verifyModal.files.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                marginTop: 4,
              }}
            >
              {verifyModal.files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#475569",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "5px 10px",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name}
                  </span>
                  <button
                    onClick={() =>
                      setVerifyModal((p) => ({
                        ...p,
                        files: p.files.filter((_, idx) => idx !== i),
                      }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#dc2626",
                      fontWeight: 700,
                      padding: "0 2px",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          padding: "12px 22px 18px",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <button
          onClick={() => setVerifyModal(null)}
          style={{
            background: "#f1f5f9",
            color: "#475569",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13.5,
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleVerifySubmit}
          disabled={verifyModal.submitting}
          style={{
            background: "#16a34a",
            color: "#fff",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13.5,
            fontWeight: 600,
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            opacity: verifyModal.submitting ? 0.6 : 1,
          }}
        >
          {verifyModal.submitting ? "Sending…" : "Send for Verification"}
        </button>
      </div>
    </div>
  </div>
)}

      {ticketSolveModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10040,
            background: "rgba(15,23,42,.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setTicketSolveModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 24px 64px rgba(0,0,0,.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                Mark Ticket as Solved
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {ticketSolveModal.ticket.task_title}
              </div>
            </div>
            <div
              style={{
                padding: "16px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <label
                style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
              >
                Resolution Note
                <span
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
              <textarea
                rows={3}
                placeholder="How was this resolved?"
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  color: "#1e293b",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "9px 12px",
                  outline: "none",
                  width: "100%",
                  resize: "vertical",
                  minHeight: 80,
                }}
                value={ticketSolveModal.note}
                onChange={(e) =>
                  setTicketSolveModal((p) => ({ ...p, note: e.target.value }))
                }
              />
            </div>

            <div
              style={{
                padding: "0 22px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <label
                style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
              >
                Attach Resolution Document
                <span
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
                type="file"
                onChange={(e) =>
                  setTicketSolveModal((p) => ({
                    ...p,
                    file: e.target.files?.[0] || null,
                  }))
                }
                style={{ fontSize: 12.5 }}
              />
              {ticketSolveModal.file && (
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  {ticketSolveModal.file.name}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 22px 18px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={() => setTicketSolveModal(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkTicketSolved}
                disabled={updatingTicketId === ticketSolveModal.ticket.id}
                style={{
                  background: "#16a34a",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Confirm Solved
              </button>
            </div>
          </div>
        </div>
      )}
      {detailTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10030,
            background: "rgba(15,23,42,.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailTask(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 540,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 1,
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1e293b",
                    lineHeight: 1.3,
                  }}
                >
                  {detailTask.title}
                </div>
                {detailTask.site_name && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                    {detailTask.site_name}
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetailTask(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {/* Status + Priority row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(() => {
                  const p =
                    PRIORITY_STYLES[detailTask.priority] ||
                    PRIORITY_STYLES.medium;
                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: p.bg,
                        color: p.color,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: p.dot,
                          flexShrink: 0,
                        }}
                      />
                      {detailTask.priority} priority
                    </span>
                  );
                })()}
                {(() => {
                  const s =
                    STATUS_STYLES[detailTask.status] || STATUS_STYLES.pending;
                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: s.bg,
                        color: s.color,
                      }}
                    >
                      {detailTask.status
                        ?.replace("_", " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  );
                })()}
                {detailTask.is_recurring && detailTask.recurrence && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#eff6ff",
                      color: "#2563eb",
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    {detailTask.recurrence}
                  </span>
                )}
                {detailTask.has_checkpoints && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#f0fdf4",
                      color: "#16a34a",
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Has checklist
                  </span>
                )}
              </div>

              {/* Meta grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  {                  
                    label: "Assigned By",
                    value: userMap[detailTask.assigned_by] || detailTask.assigned_by || "—",
                  },
                  {
                    label: "Hours to Complete",
                    value: detailTask.hours_to_complete
                      ? `${detailTask.hours_to_complete} hrs`
                      : "—",
                  },
                  {
                    label: "Due Date",
                    value: detailTask.due_date
                      ? new Date(detailTask.due_date).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : "—",
                  },
                  { label: "Site", value: detailTask.site_name || "—" },
                  {
                    label: "Created",
                    value: detailTask.created_at
                      ? new Date(detailTask.created_at).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      background: "#dfd9d97a",
                      border: "1px solid #9d9da094",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

                
              {/* Description */}
              {detailTask.description && (
                <div
                  style={{
                    background: "#dfd9d97a",
                    border: "1px solid #9d9da094",  
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                      marginBottom: 8,
                    }}
                  >
                    Description
                  </div>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "#475569",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {detailTask.description}
                  </p>
                </div>
              )}

              {/* Audio player */}
              {detailTask.audio_url && (
                <div
                  style={{
                    background: "#f5f3ff",
                    border: "1px solid #e0e7ff",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "#7c3aed",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    Audio Instruction
                  </div>
                  <audio
                    controls
                    src={detailTask.audio_url}
                    style={{ width: "100%", borderRadius: 8, outline: "none" }}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {/* Document */}
              {detailTask.document_url && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "#2563eb",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Attached Document
                  </div>

                  <a
                    href={detailTask.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#2563eb",
                      color: "#fff",
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "9px 16px",
                      borderRadius: 8,
                      textDecoration: "none",
                      transition: "background .15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#1d4ed8")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#2563eb")
                    }
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Open / Download Document
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {myVerificationDetail && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 10030, background: "rgba(15,23,42,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={(e) => { if (e.target === e.currentTarget) setMyVerificationDetail(null); }}
          >
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
              {(() => {
                const v = myVerificationDetail;
                const statusStyle = {
                  pending: { bg: "#fffbeb", color: "#d97706", label: "Pending" },
                  completed: { bg: "#f0fdf4", color: "#16a34a", label: "Verified" },
                  correction_sent: { bg: "#fef2f2", color: "#dc2626", label: "Correction Sent" },
                };
                const sc = statusStyle[v.status] || statusStyle.pending;
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px 22px 14px", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 1, borderRadius: "16px 16px 0 0" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{v.task_title || "—"}</div>
                        {v.site_name && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{v.site_name}</div>}
                      </div>
                      <button onClick={() => setMyVerificationDetail(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>

                    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: sc.bg, color: sc.color, width: "fit-content" }}>
                        {sc.label}
                      </span>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          { label: "Sent To", value: v.verifier_name || v.verifier },
                          { label: "Sent On", value: v.created_at ? new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 10, padding: "14px 16px" }}>
                      
                        <div style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Your Submitted Files</div>
                        {v.document_urls?.length > 0 ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {v.document_urls.map((url, i) => (
                              
                              <a  key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: "#475569",
                                  background: "#fff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 7,
                                  padding: "6px 12px",
                                  textDecoration: "none",
                                }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#475569"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span>File {i + 1}</span>
                              </a>
                            ))}
                          </div>
                        ) : (
                      <span style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic" }}>No files attached</span>
                    )}
                  </div>

                    {v.status === "correction_sent" && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#dc2626", marginBottom: 8 }}>Admin's Correction</div>
                        {v.correction_note && <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: "0 0 10px" }}>{v.correction_note}</p>}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {v.correction_audio_url && (
                            
                            <a  href={v.correction_audio_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "#7c3aed",
                              }}
                            > 
                            
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#7c3aed"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                              </svg>
                              <span>Correction Audio</span>
                            </a>
                          )}
                          {v.correction_document_urls?.map((url, i) => (
                            
                            <a  key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "#0369a1",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#0369a1"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <span>Doc {i + 1}</span>
                            </a>
                          ))}
                        </div>
                        {v.resolved_by && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>by {v.resolved_by}</div>} 
                      </div>
                    )}
                      </div>


                      {v.status === "completed" && v.resolved_by && (
                        <div style={{ fontSize: 12.5, color: "#16a34a", fontWeight: 600 }}>✓ Verified by {v.resolved_by}</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
{ticketDetail && (
  <div
    style={{
      position: "fixed", inset: 0, zIndex: 10030,
      background: "rgba(15,23,42,.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) setTicketDetail(null); }}
  >
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
      {(() => {
        const t = ticketDetail;
        const statusStyle = {
          open: { bg: "#fffbeb", color: "#d97706", label: "Open" },
          solved: { bg: "#f0fdf4", color: "#16a34a", label: "Solved" },
        };
        const sc = statusStyle[t.status] || statusStyle.open;
        return (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px 22px 14px", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 1, borderRadius: "16px 16px 0 0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{t.task_title || "—"}</div>
                {t.site_name && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{t.site_name}</div>}
              </div>
              <button onClick={() => setTicketDetail(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: sc.bg, color: sc.color, width: "fit-content" }}>
                {sc.label}
              </span>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Sent To", value: t.assigned_to_name || t.assigned_to },
                  { label: "Raised On", value: t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{value}</div>
                  </div>
                ))}
              </div>

              {t.query && (
                <div style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Query</div>
                  <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: 0 }}>{t.query}</p>
                </div>
              )}

              {t.document_url && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#2563eb", marginBottom: 10 }}>Attachment</div>
                  
                  <a  href={t.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#2563eb" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>View file</span>
                  </a>
                </div>
              )}

              {t.status === "solved" && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#16a34a", marginBottom: 8 }}>Resolution</div>
                  {t.resolution_note && <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: "0 0 10px" }}>{t.resolution_note}</p>}
                  {t.resolution_document_url && (
                    
                    <a  href={t.resolution_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#2563eb" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>View resolution file</span>
                    </a>
                  )}
                  {t.resolved_by && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Resolved by {t.resolved_by}</div>}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  </div>
)}
      {checklistModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10030,
            background: "rgba(15,23,42,.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setChecklistModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#f0fdf4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#16a34a",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <span
                  style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}
                >
                  Complete Checklist
                </span>
              </div>
              <button
                onClick={() => setChecklistModal(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Task info */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e8edf3",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}
                >
                  {checklistModal.title}
                </div>
                {checklistModal.site_name && (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {checklistModal.site_name}
                  </div>
                )}
              </div>

              {/* Info banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 8,
                  padding: "10px 13px",
                  fontSize: 12.5,
                  color: "#92400e",
                  lineHeight: 1.5,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                  Tick all items below to confirm this task is complete before
                  submitting.
                </span>
              </div>

              {/* Checklist items */}
              {fetchingCPs ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "16px 0",
                  }}
                >
                  <div className="op-spinner" />
                </div>
              ) : checkpoints.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                    padding: "12px 0",
                  }}
                >
                  No checklist items found.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {checkpoints.map((cp, i) => {
                    const checked = !!checkedItems[cp.id];
                    return (
                      <label
                        key={cp.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: `1px solid ${checked ? "#bbf7d0" : "#e8edf3"}`,
                          background: checked ? "#f0fdf4" : "#fafafa",
                          cursor: "pointer",
                          transition: "all .15s",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCheckedItems((prev) => ({
                                ...prev,
                                [cp.id]: e.target.checked,
                              }))
                            }
                            style={{
                              width: 18,
                              height: 18,
                              accentColor: "#16a34a",
                              cursor: "pointer",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 13.5,
                            color: checked ? "#15803d" : "#334155",
                            fontWeight: checked ? 600 : 400,
                            lineHeight: 1.5,
                            textDecoration: checked ? "none" : "none",
                          }}
                        >
                          {i + 1}. {cp.checkpoint}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Progress indicator */}
              {checkpoints.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      background: "#e8edf3",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: "#16a34a",
                        borderRadius: 99,
                        width: `${(Object.values(checkedItems).filter(Boolean).length / checkpoints.length) * 100}%`,
                        transition: "width .2s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                      flexShrink: 0,
                    }}
                  >
                    {Object.values(checkedItems).filter(Boolean).length}/
                    {checkpoints.length}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 22px 18px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={() => setChecklistModal(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#f1f5f9",
                  color: "#475569",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleChecklistConfirm}
                disabled={
                  fetchingCPs ||
                  checkpoints.some((cp) => !checkedItems[cp.id])
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "#16a34a",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: fetchingCPs || checkpoints.some((cp) => !checkedItems[cp.id])
                    ? "not-allowed"
                    : "pointer",
                  opacity: fetchingCPs || checkpoints.some((cp) => !checkedItems[cp.id])
                    ? 0.5
                    : 1,
                  transition: "opacity .15s",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Mark as Done
              </button>
            </div>
          </div>
        </div>
      )}
      {leaveDetailModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10040,
            background: "rgba(15,23,42,.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLeaveDetailModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 24px 64px rgba(0,0,0,.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}
                >
                  {leaveDetailModal.name || leaveDetailModal.user_name}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {leaveDetailModal.leave_type} · {leaveDetailModal.site_name}
                </div>
              </div>
              <button
                onClick={() => setLeaveDetailModal(null)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div
              style={{
                padding: "16px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="op-meta-pill">
                  {leaveDetailModal.from_date} → {leaveDetailModal.to_date}
                </span>
                <LeaveBadge leave={leaveDetailModal} />
              </div>

              {leaveDetailModal.reason && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      marginBottom: 4,
                    }}
                  >
                    Employee's Reason
                  </div>
                  <p className="lv-reason" style={{ margin: 0 }}>
                    "{leaveDetailModal.reason}"
                  </p>
                </div>
              )}

              <ApprovalPips leave={leaveDetailModal} />

              {/* Rejection reasons — array of {slot, by, reason, at} from mergeRejectionReason */}
              {Array.isArray(leaveDetailModal.rejection_reason) &&
                leaveDetailModal.rejection_reason.filter(
                  (r) => r && typeof r === "object",
                ).length > 0 && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: ".05em",
                      }}
                    >
                      Rejection Reason
                      {leaveDetailModal.rejection_reason.length > 1 ? "s" : ""}
                    </div>
                    {leaveDetailModal.rejection_reason
                      .filter((r) => r && typeof r === "object")
                      .map((r) => {
                        const roleLabel =
                          r.slot === "head"
                            ? leaveDetailModal.head_approver_role || "Head"
                            : leaveDetailModal.level_approver_role || "Level";
                        return (
                          <div key={r.slot} className="lv-rejection">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <strong>{roleLabel} rejection</strong> ({r.by}):{" "}
                            {r.reason}
                          </div>
                        );
                      })}
                  </div>
                )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 22px 18px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={() => setLeaveDetailModal(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {rejectTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10030,
            background: "rgba(15,23,42,.45)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRejectTarget(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 420,
              padding: 24,
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 6,
              }}
            >
              Reject this leave application?
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
              <strong>{rejectTarget.leave.leave_type}</strong> ·{" "}
              {new Date(
                rejectTarget.leave.from_date + "T00:00:00",
              ).toLocaleDateString("en-IN")}{" "}
              →{" "}
              {new Date(
                rejectTarget.leave.to_date + "T00:00:00",
              ).toLocaleDateString("en-IN")}
            </div>
            <label className="lv-label">
              Reason for rejection <span className="lv-req">*</span>
            </label>
            <textarea
              className="lv-input lv-textarea"
              rows={3}
              placeholder="Explain why this leave is being rejected…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ marginBottom: 18 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="lv-btn-reset"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </button>
              <button
                className="lv-btn-submit"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  background: "#dc2626",
                }}
                disabled={!rejectReason.trim()}
                onClick={confirmProxyReject}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
      <PortalFloaters />
    </>
  );
}
