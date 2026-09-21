import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import PortalFloaters from "../components/PortalFloaters";
import { supabase } from "../supabase";
import { useRecurringTasks } from "../hooks/useRecurringTasks";
import SiteReport from "./Sitereport";
import "./AdminPortal.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { canAccessPortal, filterNav, getAllowedKeys, isAdminUser } from "../access.js";
import { pickPermissionFields } from "../lib/permissions";
import OrgHierarchy from "./OrgHierarchy";
import PermissionsPanel from "../components/PermissionsPanel";
import PortalSwitcher from "../components/PortalSwitcher";
import {
  TaskForm as TaskFormWithCheckpoints,
  EMPTY_FORM,
  AudioRecorder,
} from "./Taskformwithcheckpoints.jsx";
const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    color: "#be3d3d",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#be3d3d"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "assign-task",
    label: "Assign Task",
    color: "#2563eb",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    key: "all-tasks",
    label: "All Tasks",
    color: "#2563eb",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "recurring-tasks",
    label: "All Recurring Tasks",
    color: "#2563eb",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
  {
    key: "leave-requests",
    label: "Leave Requests",
    color: "#7c3aed",   
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "reschedule-requests",
    label: "Reschedule Requests",
    color: "#7c3aed",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    key: "add-employee",
    label: "Add Employee",
    color: "#db4086",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#db4086"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    key: "manage-employees",
    label: "Manage Employees",
    color:"#db4086",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#db4086"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "org-hierarchy",
    label: "Organization Hierarchy",
    color: "#db4086",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#db4086"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="4" rx="1" />
        <rect x="2" y="18" width="6" height="4" rx="1" />
        <rect x="9" y="18" width="6" height="4" rx="1" />
        <rect x="16" y="18" width="6" height="4" rx="1" />
        <line x1="12" y1="6" x2="12" y2="11" />
        <line x1="5" y1="18" x2="5" y2="14" />
        <line x1="12" y1="18" x2="12" y2="14" />
        <line x1="19" y1="18" x2="19" y2="14" />
        <line x1="5" y1="14" x2="19" y2="14" />
      </svg>
    ),
  },
  {
    key: "add-site",
    label: "Add Site",
    color: "#0891b2",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0891b2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="3" width="10" height="18" rx="2" />
        <path d="M8 7h2M8 11h2M8 15h2" />
        <path d="M19 8v6" />
        <path d="M16 11h6" />
      </svg>
    ),
  },
  {
    key: "manage-sites",
    label: "Manage Sites",
    color: "#0891b2",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0891b2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="7" height="16" rx="1" />
        <rect x="14" y="8" width="7" height="12" rx="1" />
        <path d="M6 8h1M6 12h1M6 16h1" />
        <path d="M17 12h1M17 16h1" />
      </svg>
    ),
  },
];

const REPORTS_NAV = [
  {
    key: "add-drawings",
    label: "Add Drawings",
     color: "#d97706",  
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="12" height="14" rx="1" />
        <path d="M6 9h6M6 12h6M6 15h4" />
        <path d="M16 16l5-5 2 2-5 5-3 1z" />
      </svg>
    ),
  },
  {
    key: "all-drawings",
    label: "All Drawings",
     color: "#d97706",  
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
    label: "Site Visit Report",
     color: "#d97706",  
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
  {
    key: "my-reports",
    label: "My Reports",
     color: "#d97706",  
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v3" />
        <polyline points="14 3 14 8 19 8" />
        <path d="M12 22l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "report-submissions",
    label: "Report Submissions",
     color: "#d97706",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  
];
// const INSIGHTS_NAV = [
//   {
//     key: "delay-report",
//     label: "Delay Report",
//     color: "#dc2626",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <circle cx="12" cy="12" r="9" />
//         <path d="M12 7v5l3 2" />
//       </svg>
//     ),
//   },
//   {
//     key: "mis-report",
//     label: "MIS Report",
//     color: "#7c3aed",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <rect x="3" y="12" width="4" height="9" rx="1" />
//         <rect x="10" y="7" width="4" height="14" rx="1" />
//         <rect x="17" y="3" width="4" height="18" rx="1" />
//       </svg>
//     ),
//   },
//   {
//     key: "daily-report",
//     label: "Daily Report",
//     color: "#0891b2",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <rect x="3" y="4" width="18" height="18" rx="2" />
//         <line x1="16" y1="2" x2="16" y2="6" />
//         <line x1="8" y1="2" x2="8" y2="6" />
//         <line x1="3" y1="10" x2="21" y2="10" />
//         <path d="M8 14h2M8 18h2M14 14h2M14 18h2" />
//       </svg>
//     ),
//   },
//   {
//     key: "work-verification",
//     label: "Work & Verification",
//     color: "#16a34a",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <path d="M9 12l2 2 4-4" />
//         <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" />
//       </svg>
//     ),
//   },
//   {
//     key: "fms-tracker",
//     label: "FMS Tracker",
//     color: "#ea580c",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <path d="M1 3h13v13H1z" />
//         <path d="M14 8h4l3 3v5h-7V8z" />
//         <circle cx="5.5" cy="18.5" r="1.5" />
//         <circle cx="17.5" cy="18.5" r="1.5" />
//       </svg>
//     ),
//   },
//   {
//     key: "permissions",
//     label: "Permissions",
//     color: "#020202",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#020202" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//         <rect x="4" y="10" width="16" height="11" rx="2" />
//         <path d="M8 10V6a4 4 0 0 1 8 0v4" />
//       </svg>
//     ),
//   },
// ];
const INSIGHTS_NAV = [
  {
    key: "delay-report",
    label: "Delay Report",
    color: "#0f766e",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    key: "mis-report",
    label: "MIS Report",
    color: "#0f766e",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    key: "daily-report",
    label: "Daily Report",
    color: "#0f766e",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h2M8 18h2M14 14h2M14 18h2" />
      </svg>
    ),
  },
  {
    key: "work-verification",
    label: "Work & Verification",
    color: "#0f766e",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 12l2 2 4-4" />
        <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" />
      </svg>
    ),
  },
  {
    key: "fms-tracker",
    label: "FMS Tracker",
    color: "#0f766e",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 3h13v13H1z" />
        <path d="M14 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="1.5" />
        <circle cx="17.5" cy="18.5" r="1.5" />
      </svg>
    ),
  },
  {
    key: "permissions",
    label: "Permissions",
    color: "#000000",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
];
const TICKETS_NAV = [
  {
    key: "new-tickets",
    label: "New Tickets",
    color: "#eaa40c",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#eaa40c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
        <path d="M12 7v10" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    key: "solved-ticket",
    label: "Solved Tickets",
    color: "#eaa40c",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#eaa40c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];
const VERIFICATION_STATUS_STYLE = {
  pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "Pending Verification" },
  completed: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Verified" },
  correction_sent: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "Correction Sent" },
};
async function transferTasksToProxy(supabaseClient, leave, userMap, notify) {
  if (!leave.proxy_user_name || !leave.from_date || !leave.to_date) return;

  const { data: tasksToMove, error } = await supabaseClient
    .from("tasks")
    .select("id, title")
    .eq("assigned_to", leave.user_name)
    .neq("status", "completed")
    .gte("due_date", leave.from_date)
    .lte("due_date", leave.to_date);

  if (error || !tasksToMove?.length) return;

  const ids = tasksToMove.map((t) => t.id);
  await supabaseClient.from("tasks").update({ assigned_to: leave.proxy_user_name }).in("id", ids);

  notify?.(
    `${tasksToMove.length} task${tasksToMove.length > 1 ? "s" : ""} transferred to ${
      userMap[leave.proxy_user_name] || leave.proxy_name || leave.proxy_user_name
    } for the leave period.`,
  );
}
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
function VerificationBadge({ verification, onClick }) {
  if (!verification) {
    return (
      <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
        Not sent
      </span>
    );
  }
  const sc = VERIFICATION_STATUS_STYLE[verification.status] || VERIFICATION_STATUS_STYLE.pending;
  return (
    <span
      onClick={onClick}
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
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
      }}
    >
      {sc.label}
    </span>
  );
}
const VERIFICATION_NAV = [
  {
    key: "pending-verification",
    label: "Pending Verification",
    color: "#16a34a",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2h12" />
        <path d="M6 22h12" />
        <path d="M8 2v4l4 4 4-4V2" />
        <path d="M8 22v-4l4-4 4 4v4" />
      </svg>
    ),
  },
  {
    key: "rejected-tasks",
    label: "Rejected Tasks",
    color: "#16a34a",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    key: "overdue-tasks",
    label: "Overdue Tasks",
    color: "#16a34a",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
        <path d="M19 5l2-2" />
      </svg>
    ),
  },
];
const PRIORITY_STYLES = {
  high: { bg: "#fef2f2", color: "#dc2626", dot: "#dc2626" },
  medium: { bg: "#fffbeb", color: "#d97706", dot: "#d97706" },
  low: { bg: "#f0fdf4", color: "#16a34a", dot: "#16a34a" },
};

const STATUS_STYLES = {
  pending: { bg: "#f1f5f9", color: "#64748b" },
  completed: { bg: "#f0fdf4", color: "#16a34a" },
  not_applicable: { bg: "#f3f4f6", color: "#d61818" },
  rejected: { bg: "#fef2f2", color: "#dc2626" },
};

// ← add this block
const ACTIVITY_STYLES = {
  not_started: { bg: "#f1f5f9", color: "#64748b", label: "Not Started" },
  working: { bg: "#eff6ff", color: "#2563eb", label: "Working" },
  held: { bg: "#fffbeb", color: "#d97706", label: "On Hold" },
  completed: { bg: "#f0fdf4", color: "#16a34a", label: "Completed" },
};

function getTaskActivity(task) {
  if (task.status === "completed") return ACTIVITY_STYLES.completed;
  if (task.is_held) return ACTIVITY_STYLES.held;
  if (task.accepted_at) return ACTIVITY_STYLES.working;
  return ACTIVITY_STYLES.not_started;
}

function formatElapsedSince(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

const LEAVE_STATUS_STYLES = {
  pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  approved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EMPTY_TASK_FILTERS = {
  dateFrom: "",
  dateTo: "",
  assignedTo: "",
  site: "",
  priority: "",
  status: "",
  verification: "", // ← new
};
// ── helpers ────────────────────────────────────────────────────────────────
function daysInMonth(month) {
  return new Date(2001, parseInt(month, 10), 0).getDate();
}
function nameFor(userMap, username) {
  return (userMap && userMap[username]) || username || "—";
}
function buildAnchor(form) {
  switch (form.recurrence) {
    case "daily":
      return null;
    case "weekly":
      return String(form.anchor_weekday);
    case "monthly":
      return String(form.anchor_day);
    case "yearly":
      return `${String(form.anchor_month).padStart(2, "0")}-${String(form.anchor_month_day).padStart(2, "0")}`;
    default:
      return null;
  }
}

function anchorDescription(recurrence, anchor) {
  if (recurrence === "daily") return "every day"; // ← add this line
  if (!anchor) return null;
  switch (recurrence) {
    case "weekly":
      return `every ${WEEKDAYS[parseInt(anchor, 10)]}`;
    case "monthly":
      return `on the ${anchor}${ordinal(parseInt(anchor, 10))} of every month`;
    case "yearly": {
      const [mm, dd] = anchor.split("-");
      return `every year on ${MONTHS[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`;
    }
    default:
      return null;
  }
}

const APPROVAL_SLOT_LABELS = {
  level: "Level Approver",
  head: "Site Head",
  admin: "Admin",
  proxy: "Proxy Approver",
};

function slotLabel(slot) {
  return APPROVAL_SLOT_LABELS[slot] || slot;
}
function ordinal(n) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function computeLeaveStatus(leave) {
  const hasChain = !!(leave.level_approver_user_name || leave.head_approver_user_name);
  const storedStatus = normalizeText(leave.status);

  if (
    leave.admin_approved === false ||
    leave.proxy_approved === false ||
    storedStatus === "rejected"
  )
    return "rejected";

  if (hasChain) {
    const proxyDone = !leave.proxy_user_name || leave.proxy_approved === true;
    if ((leave.admin_approved === true || storedStatus === "approved") && proxyDone)
      return "approved";
    return "pending";
  }

  // Admin-direct leave (no approval chain) — only a real admin action counts.
  if (leave.admin_approved === true) return "approved";
  return "pending";
}
function formatLeaveDate(date) {
  return date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "N/A";
}

function getLeaveDays(leave) {
  if (!leave.from_date || !leave.to_date) return null;
  return (
    Math.ceil(
      (new Date(leave.to_date) - new Date(leave.from_date)) /
        (1000 * 60 * 60 * 24),
    ) + 1
  );
}

function formatSubmissionDate(d) {
  if (!d) return "—";
  const date = String(d).includes("T")
    ? new Date(d)
    : new Date(d + "T00:00:00");
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
function getFileExt(url) {
  if (!url) return "file";
  const clean = url.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "file";
}

function buildDownloadUrl(url, filename) {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(filename || "report.pdf")}`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isSiteEngineerLeave(leave) {
  return [
    leave.role,
    leave.designation,
    leave.user_role,
    leave.user_designation,
  ]
    .map(normalizeText)
    .some((value) => value === "site engineer" || value === "site_engineer");
}

function getHeadApprovalText(leave) {
  const storedStatus = normalizeText(leave.status);
  const headName = leave.proxy_user_name || leave.head_user_names;
  if (leave.proxy_approved === true || storedStatus === "approved")
    return "Head: Approved";
  if (leave.proxy_approved === false || storedStatus === "rejected")
    return "Head: Rejected";
  return headName ? `Head (${headName}): Pending` : "Head: Pending";
}

function getHeadApprovalClass(leave) {
  const storedStatus = normalizeText(leave.status);
  if (leave.proxy_approved === true || storedStatus === "approved") return "ok";
  if (leave.proxy_approved === false || storedStatus === "rejected")
    return "no";
  return "";
}

function isFinalLeaveStatus(leave) {
  const hasChain = !!(leave.level_approver_user_name || leave.head_approver_user_name);
  if (!hasChain) {
    // Admin-direct leave — final only once admin has actually approved/rejected.
    return leave.admin_approved === true || leave.admin_approved === false;
  }
  const storedStatus = normalizeText(leave.status);
  return storedStatus === "approved" || storedStatus === "rejected";
}
function applySubmissionFilters(rows, filters) {
  return rows.filter((r) => {
    if (filters.site && r.site !== filters.site) return false;
    if (filters.engineer && r.engineer !== filters.engineer) return false;
    if (filters.reportType && r.source !== filters.reportType) return false;
    if (filters.dateFrom && r.date && r.date < filters.dateFrom) return false;
    if (filters.dateTo && r.date && r.date > filters.dateTo) return false;
    return true;
  });
}
function applyTaskFilters(tasks, filters, verificationMap) {
  return tasks.filter((t) => {
    if (filters.assignedTo && t.assigned_to !== filters.assignedTo)
      return false;
    if (filters.site && t.site_name !== filters.site) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.status && displayStatus(t.status) !== filters.status)
      return false;
    if (filters.dateFrom && t.due_date && t.due_date < filters.dateFrom)
      return false;
    if (filters.dateTo && t.due_date && t.due_date > filters.dateTo)
      return false;
    if (filters.verification) {
      const v = verificationMap?.get(t.id);
      const vStatus = v ? v.status : "not_sent";
      if (filters.verification !== vStatus) return false;
    }
    return true;
  });
}

function getNextDueDate(currentDue, recurrence) {
  const base = currentDue ? new Date(currentDue + "T00:00:00") : new Date();
  // Guard: if date parsing produced Invalid Date, return null instead of throwing
  if (isNaN(base.getTime())) return null;
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
    `"${queued[0].title}" has started automatically for ${nameFor(userMap, queued[0].assigned_to)}.`,
  );
}
async function spawnNextRecurringInstance(task, nextDue) {
  const { data: newTask, error } = await supabase
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
  return { error, task: newTask };
}

function toDateStr(d) {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const OFFICE_HOURS = { startHour: 9, startMin: 30, endHour: 18, endMin: 30 };
const LUNCH = { startHour: 13, startMin: 0, endHour: 14, endMin: 0 };

function isWorkingDay(date) {
  return date.getDay() !== 0; // Mon–Sat, Sunday off
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function clampToOfficeWindow(date) {
  const d = new Date(date);
  const officeStart = OFFICE_HOURS.startHour * 60 + OFFICE_HOURS.startMin;
  const officeEnd = OFFICE_HOURS.endHour * 60 + OFFICE_HOURS.endMin;
  let mins = minutesSinceMidnight(d);

  if (!isWorkingDay(d) || mins >= officeEnd) {
    // push to next working day's opening time
    do {
      d.setDate(d.getDate() + 1);
    } while (!isWorkingDay(d));
    d.setHours(OFFICE_HOURS.startHour, OFFICE_HOURS.startMin, 0, 0);
    return d;
  }
  if (mins < officeStart) {
    d.setHours(OFFICE_HOURS.startHour, OFFICE_HOURS.startMin, 0, 0);
    return d;
  }
  return d;
}

// Adds `hours` of business time (office hours, skipping lunch, Sundays) to a start Date.
function addBusinessHours(startDate, hours) {
  if (!startDate || !hours) return null;
  let remainingMins = Math.round(hours * 60);
  let cursor = clampToOfficeWindow(startDate);

  const lunchStart = LUNCH.startHour * 60 + LUNCH.startMin;
  const lunchEnd = LUNCH.endHour * 60 + LUNCH.endMin;
  const officeEnd = OFFICE_HOURS.endHour * 60 + OFFICE_HOURS.endMin;

  while (remainingMins > 0) {
    let curMins = minutesSinceMidnight(cursor);
    // skip lunch
    if (curMins >= lunchStart && curMins < lunchEnd) {
      cursor.setHours(LUNCH.endHour, LUNCH.endMin, 0, 0);
      curMins = lunchEnd;
    }
    const segmentEnd = curMins < lunchStart ? lunchStart : officeEnd;
    const availableInSegment = segmentEnd - curMins;
    const take = Math.min(availableInSegment, remainingMins);
    cursor = new Date(cursor.getTime() + take * 60000);
    remainingMins -= take;

    if (remainingMins > 0) {
      cursor = clampToOfficeWindow(cursor);
    }
  }
  return cursor;
}

function formatDurationShort(mins) {
  const totalMins = Math.round(Math.abs(mins));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDT(date) {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
function buildDailyReportRows(tasks, fromDate, toDate, userMap) {
  const todayStr = new Date().toISOString().split("T")[0];
  const inRange = tasks.filter((t) => t.due_date && t.due_date >= fromDate && t.due_date <= toDate);

  return inRange
    .slice()
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .map((t, i) => {
      const targetDate = t.due_date;
      const prevDate = t.created_at ? t.created_at.split("T")[0] : targetDate;

      let delayLabel = "Upcoming";
      let delayStyle = { bg: "#eff6ff", color: "#2563eb" };
      if (t.status === "completed") {
        delayLabel = "Completed";
        delayStyle = { bg: "#f0fdf4", color: "#16a34a" };
      } else if (targetDate === todayStr) {
        delayLabel = "Today";
        delayStyle = { bg: "#fffbeb", color: "#d97706" };
      } else if (targetDate < todayStr) {
        const days = Math.floor((new Date(todayStr) - new Date(targetDate)) / 86400000);
        delayLabel = `${days}d overdue`;
        delayStyle = { bg: "#fef2f2", color: "#dc2626" };
      }

      return {
        sr: i + 1,
        id: t.id,
        prevDate,
        targetDate,
        title: t.title,
        description: t.description,
        siteName: t.site_name,
        assignee: nameFor(userMap, t.assigned_to),
        delayLabel,
        delayStyle,
      };
    });
}
function buildDelayRow(task, index, userMap) {
  const assignedAt = task.created_at ? new Date(task.created_at) : null;
  const acceptedAt = task.accepted_at ? new Date(task.accepted_at) : null;
  const hoursToComplete = task.hours_to_complete ? parseFloat(task.hours_to_complete) : null;

  // Due = employee's acceptance time + allotted business hours (falls back to assigned time if never accepted)
  const dueBasis = acceptedAt || assignedAt;
  const dueDateTime = dueBasis && hoursToComplete ? addBusinessHours(dueBasis, hoursToComplete) : null;

  const submittedAt =
    task.status === "completed"
      ? new Date(task.completed_at || task.completion_date || task.updated_at || task.created_at)
      : null;

  const now = new Date();
  const isPending = task.status !== "completed";
  const comparisonPoint = isPending ? now : submittedAt;

  let statusLabel = "N/A";
  let delayLabel = "—";
  if (dueDateTime && comparisonPoint) {
    const diffMins = (comparisonPoint - dueDateTime) / 60000;
    if (diffMins > 0) {
      statusLabel = "Delayed";
      delayLabel = formatDurationShort(diffMins);
    } else {
      statusLabel = "On Time";
      delayLabel = isPending ? "Within deadline" : `${formatDurationShort(diffMins)} early`;
    }
  }

  const totalHoldSecs = Number(task.accumulated_seconds) || 0;

  return {
    sr: index + 1,
    id: task.id,
    employee: userMap[task.assigned_to] || task.assigned_to || "—",
    project: task.site_name || task.title || "—",
    assignedAt,
    acceptedAt,
    hoursToComplete,
    holdResume: task.is_held ? "On hold" : totalHoldSecs > 0 ? "Resumed" : "—",
    totalHold: totalHoldSecs > 0 ? formatDurationShort(totalHoldSecs / 60) : "—",
    dueDateTime,
    submittedAt,
    isPending,
    statusLabel,
    delayLabel,
    rescheduleCount: task._rescheduleCount || 0,
  };
}
function getMonthWeeks(monthStr) {
  // monthStr = "YYYY-MM"
  const [yearStr, monStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monStr, 10) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  const dow = firstDay.getDay(); // 0=Sun..6=Sat
  const daysBack = dow === 0 ? 6 : dow - 1; // back to Monday
  let cursor = new Date(firstDay);
  cursor.setDate(cursor.getDate() - daysBack);

  const weeks = [];
  let weekNum = 1;
  while (cursor <= lastDay) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({
      key: `w${weekNum}`,
      label: `Week ${weekNum}`,
      from: weekStart,
      to: weekEnd,
      includesPrevMonth: weekStart < firstDay,
      includesNextMonth: weekEnd > lastDay,
    });
    cursor = new Date(cursor.getTime());
    cursor.setDate(cursor.getDate() + 7);
    weekNum++;
  }
  return weeks;
}

function formatWeekRange(week) {
  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(week.from)} – ${fmt(week.to)}`;
}

function classifyMisTask(task, todayEnd) {
  if (normalizeText(task.status) === "not_applicable") return "na";
  const dueDateTime = task.due_date ? new Date(task.due_date + "T23:59:59") : null;
  if (task.status === "completed") {
    const completedAt = task.completed_at || task.completion_date || task.updated_at || null;
    if (dueDateTime && completedAt && new Date(completedAt) > dueDateTime) return "delayed_done";
    return "on_time";
  }
  if (dueDateTime && todayEnd > dueDateTime) return "delayed";
  return "pending";
}

function buildMisWeekStats(tasks, week, taskType) {
  const todayEnd = new Date();
  const weekTasks = tasks.filter((t) => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date + "T00:00:00");
    if (due < week.from || due > week.to) return false;
    if (taskType === "delegated" && t._source !== "task") return false;
    if (taskType === "recurring" && t._source !== "instance") return false;
    return true;
  });

  const byEmployee = new Map();
  weekTasks.forEach((t) => {
    const key = t.assigned_to || "unassigned";
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        username: key,
        total: 0, onTime: 0, delayedDone: 0, delayed: 0, pending: 0, na: 0,
        delegatedCount: 0, recurringCount: 0,
      });
    }
    const b = byEmployee.get(key);
    b.total += 1;
    if (t._source === "task") b.delegatedCount += 1;
    if (t._source === "instance") b.recurringCount += 1;
    const cls = classifyMisTask(t, todayEnd);
    if (cls === "on_time") b.onTime += 1;
    else if (cls === "delayed_done") b.delayedDone += 1;
    else if (cls === "delayed") b.delayed += 1;
    else if (cls === "pending") b.pending += 1;
    else if (cls === "na") b.na += 1;
  });

  const rows = [...byEmployee.values()].map((b) => {
    const done = b.onTime + b.delayedDone;
    const openDenom = b.total - b.na;
    return {
      ...b,
      done,
      openPct: openDenom > 0 ? ((b.delayed + b.pending) / openDenom) * 100 : 0,
      onTimePct: done > 0 ? (b.onTime / done) * 100 : null,
    };
  });

  return { week, rows };
}

function computeMisGrand(rows) {
  const grand = rows.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.onTime += r.onTime;
      acc.delayedDone += r.delayedDone;
      acc.delayed += r.delayed;
      acc.pending += r.pending;
      acc.na += r.na;
      return acc;
    },
    { total: 0, onTime: 0, delayedDone: 0, delayed: 0, pending: 0, na: 0 },
  );
  const done = grand.onTime + grand.delayedDone;
  const openDenom = grand.total - grand.na;
  return {
    ...grand,
    done,
    openPct: openDenom > 0 ? ((grand.delayed + grand.pending) / openDenom) * 100 : 0,
    onTimePct: done > 0 ? (grand.onTime / done) * 100 : null,
    employeeCount: rows.length,
  };
}

function sortMisRows(rows, sortKey) {
  const arr = [...rows];
  switch (sortKey) {
    case "name_desc": return arr.sort((a, b) => b.name.localeCompare(a.name));
    case "open_desc": return arr.sort((a, b) => b.openPct - a.openPct);
    case "total_desc": return arr.sort((a, b) => b.total - a.total);
    case "name_asc":
    default: return arr.sort((a, b) => a.name.localeCompare(b.name));
  }
}
function formatNextDue(date) {
  if (!date) return "—";

  const dueDate = date instanceof Date ? date : new Date(date);

  if (isNaN(dueDate)) return "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const diff = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

  const label = dueDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (diff === 0)
    return { label, badge: "Today", color: "#dc2626", bg: "#fef2f2" };

  if (diff === 1)
    return { label, badge: "Tomorrow", color: "#d97706", bg: "#fffbeb" };

  if (diff <= 7 && diff > 1)
    return {
      label,
      badge: `In ${diff} days`,
      color: "#2563eb",
      bg: "#eff6ff",
    };

  return { label, badge: null };
}
function EmployeeFilterBar({
  filters,
  onChange,
  onClear,
  employees,
  sites,
  inline,
  mobileOpen,
  onMobileToggle,
}) {
  const isActive = Object.values(filters).some((v) => v !== "");

  const empSiteNames = (emp) =>
    emp.site_names?.length
      ? emp.site_names
      : emp.site_name
        ? [emp.site_name]
        : [];

  // Names available given the current site filter (but ignoring name filter itself)
  const namesFiltered = employees.filter((emp) =>
    filters.site ? empSiteNames(emp).includes(filters.site) : true,
  );
  const names = [
    ...new Set(namesFiltered.map((e) => e.name).filter(Boolean)),
  ].sort();

  // Sites available given the current name filter (but ignoring site filter itself)
  const sitesFiltered = employees.filter((emp) =>
    filters.name ? emp.name === filters.name : true,
  );
  const siteNames = [
    ...new Set(
      sitesFiltered.flatMap((emp) => empSiteNames(emp)).filter(Boolean),
    ),
  ].sort();

  const fields = (
    <>
      <div className="tf-group">
        <span className="tf-label">Name</span>
        <select
          className="tf-select"
          value={filters.name}
          onChange={(e) => onChange("name", e.target.value)}
        >
          <option value="">All names</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="tf-divider" />
      <div className="tf-group">
        <span className="tf-label">Site</span>
        <select
          className="tf-select"
          value={filters.site}
          onChange={(e) => onChange("site", e.target.value)}
        >
          <option value="">All sites</option>
          {siteNames.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
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
          Clear
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <>
        <div className="tf-bar-inline">{fields}</div>
        <div
          style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}
        >
          <button
            className={`tf-mobile-btn${mobileOpen ? " Active" : ""}`}
            onClick={onMobileToggle}
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
            {isActive && <span className="tf-mobile-badge" />}
          </button>
          {mobileOpen && (
            <div className="tf-popup">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="tf-bar tf-bar-fixed">{fields}</div>;
}
function displayStatus(status) {
  if (status === "completed") return "completed";
  if (status === "not_applicable") return "not_applicable";
  return "pending";
}

function formatStatus(status) {
  return displayStatus(status)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function SiteFilterBar({
  filters,
  onChange,
  onClear,
  employees,
  sites,
  inline,
  mobileOpen,
  onMobileToggle,
}) {
  const isActive = Object.values(filters).some((v) => v !== "");
  const siteNames = [
    ...new Set((sites || []).map((s) => s.site_name).filter(Boolean)),
  ].sort();

  const fields = (
    <>
      <div className="tf-group">
        <span className="tf-label">Site</span>
        <select
          className="tf-select"
          value={filters.site}
          onChange={(e) => onChange("site", e.target.value)}
        >
          <option value="">All sites</option>
          {siteNames.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="tf-divider" />
      <div className="tf-group">
        <span className="tf-label">Assigned User</span>
        <select
          className="tf-select"
          value={filters.assignedUser}
          onChange={(e) => onChange("assignedUser", e.target.value)}
        >
          <option value="">All users</option>
          {employees.map((e) => (
            <option key={e.username} value={e.username}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
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
          Clear
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <>
        <div className="tf-bar-inline">{fields}</div>
        <div
          style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}
        >
          <button
            className={`tf-mobile-btn${mobileOpen ? " Active" : ""}`}
            onClick={onMobileToggle}
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
            {isActive && <span className="tf-mobile-badge" />}
          </button>
          {mobileOpen && (
            <div className="tf-popup">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="tf-bar tf-bar-fixed">{fields}</div>;
}
function SubmissionFilterBar({
  filters,
  onChange,
  onClear,
  rows,
  inline,
  mobileOpen,
  onMobileToggle,
}) {
  const sitesFiltered = applySubmissionFilters(rows, { ...filters, site: "" });
  const engineersFiltered = applySubmissionFilters(rows, {
    ...filters,
    engineer: "",
  });
  const typesFiltered = applySubmissionFilters(rows, {
    ...filters,
    reportType: "",
  });

  const sites = [
    ...new Set(sitesFiltered.map((r) => r.site).filter(Boolean)),
  ].sort();
  const engineers = [
    ...new Set(engineersFiltered.map((r) => r.engineer).filter(Boolean)),
  ].sort();
  const types = [
    ...new Set(typesFiltered.map((r) => r.source).filter(Boolean)),
  ].sort();

  const isActive = Object.values(filters).some((v) => v !== "");

  const fields = (
    <>
      <div className="tf-group">
        <span className="tf-label">Site</span>
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
      <div className="tf-group">
        <span className="tf-label">Engineer</span>
        <select
          className="tf-select"
          value={filters.engineer}
          onChange={(e) => onChange("engineer", e.target.value)}
        >
          <option value="">All engineers</option>
          {engineers.map((e2) => (
            <option key={e2} value={e2}>
              {e2}
            </option>
          ))}
        </select>
      </div>
      <div className="tf-divider" />
      <div className="tf-group">
        <span className="tf-label">Type</span>
        <select
          className="tf-select"
          value={filters.reportType}
          onChange={(e) => onChange("reportType", e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="tf-divider" />
      <div className="tf-group">
        <span className="tf-label">Date</span>
        <input
          className="tf-input tf-date"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange("dateFrom", e.target.value)}
        />
        <span className="tf-sep-text">–</span>
        <input
          className="tf-input tf-date"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom}
          onChange={(e) => onChange("dateTo", e.target.value)}
        />
      </div>
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
          Clear
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <>
        <div className="tf-bar-inline">{fields}</div>
        <div
          style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}
        >
          <button
            className={`tf-mobile-btn${mobileOpen ? " Active" : ""}`}
            onClick={onMobileToggle}
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
            {isActive && <span className="tf-mobile-badge" />}
          </button>
          {mobileOpen && (
            <div className="tf-popup">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="tf-bar tf-bar-fixed">{fields}</div>;
}
function LeaveFilterBar({
  filters,
  onChange,
  onClear,
  leaves,
  inline,
  mobileOpen,
  onMobileToggle,
}) {
  const isActive = Object.values(filters).some((v) => v !== "");
  const names = [
    ...new Set(leaves.map((l) => l.name || l.user_name).filter(Boolean)),
  ].sort();

  const fields = (
    <>
      <div className="tf-group">
        <span className="tf-label">Name</span>
        <select
          className="tf-select"
          value={filters.name}
          onChange={(e) => onChange("name", e.target.value)}
        >
          <option value="">All names</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="tf-divider" />
      <div className="tf-group">
        <span className="tf-label">Date</span>
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
          Clear
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <>
        <div className="tf-bar-inline">{fields}</div>
        <div
          style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}
        >
          <button
            className={`tf-mobile-btn${mobileOpen ? " Active" : ""}`}
            onClick={onMobileToggle}
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
            {isActive && <span className="tf-mobile-badge" />}
          </button>
          {mobileOpen && (
            <div className="tf-popup">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="tf-bar tf-bar-fixed">{fields}</div>;
}
function RescheduleFilterBar({
  filters,
  onChange,
  onClear,
  reschedules,
  userMap,
  inline,
  mobileOpen,
  onMobileToggle,
}) {
  const isActive = Object.values(filters).some((v) => v !== "");
  const names = [
    ...new Set(
      reschedules.map((r) => nameFor(userMap, r.requested_by)).filter(Boolean),
    ),
  ].sort();

  const fields = (
    <>
      <div className="tf-group">
        <span className="tf-label">Name</span>
        <select
          className="tf-select"
          value={filters.name}
          onChange={(e) => onChange("name", e.target.value)}
        >
          <option value="">All names</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="tf-divider" />
      <div className="tf-group">
        <span className="tf-label">Status</span>
        <select
          className="tf-select"
          value={filters.status}
          onChange={(e) => onChange("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
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
          Clear
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <>
        <div className="tf-bar-inline">{fields}</div>
        <div
          style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}
        >
          <button
            className={`tf-mobile-btn${mobileOpen ? " Active" : ""}`}
            onClick={onMobileToggle}
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
            {isActive && <span className="tf-mobile-badge" />}
          </button>
          {mobileOpen && (
            <div className="tf-popup">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="tf-bar tf-bar-fixed">{fields}</div>;
}


// ── Task Filter Bar ────────────────────────────────────────────────────────
function TaskFilterBar({
  filters,
  onChange,
  onClear,
  sites,
  priorities,
  statuses,
  assignees,
    userMap = {}, 
  inline,
  mobileOpen,
  onMobileToggle,
}) {
  const isActive = Object.values(filters).some((v) => v !== "");

  const fields = (
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
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Due
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
        </span>
        <select
          className="tf-select"
          value={filters.assignedTo}
          onChange={(e) => onChange("assignedTo", e.target.value)}
        >
          <option value="">All users</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {userMap[a] || a}
            </option>
          ))}
        </select>
      </div>
      {sites.length > 0 && (
        <>
          <div className="tf-divider" />
          <div className="tf-group">
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
        </>
      )}
      <div className="tf-divider" />
      <div className="tf-group">
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
      <div className="tf-group">
        <select
          className="tf-select"
          value={filters.status}
          onChange={(e) => onChange("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>
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
          Clear
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <>
        <div className="tf-bar-inline">{fields}</div>
        <div
          style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}
        >
          <button
            className={`tf-mobile-btn${mobileOpen ? " Active" : ""}`}
            onClick={onMobileToggle}
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
            {isActive && <span className="tf-mobile-badge" />}
          </button>
          {mobileOpen && (
            <div className="tf-popup">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="tf-bar tf-bar-fixed">{fields}</div>;
}
function MisCountPill({ value, bg, color, icon }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        minWidth: 26,
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 20,
        background: bg,
        color,
      }}
    >
      {icon}
      {value}
    </span>
  );
}

function MisWeekCard({ weekData, taskType }) {
  const { week, rows } = weekData;
  const grand = computeMisGrand(rows);

  const openColor = (pct) => (pct === 0 ? "#16a34a" : pct < 15 ? "#d97706" : "#dc2626");

  const COLS = "2fr 0.7fr 0.8fr 0.9fr 0.9fr 0.8fr 0.8fr 0.7fr 1.4fr";

  const renderRow = (r, isGrand) => {
    const oc = openColor(r.openPct);
    return (
      <div
        key={isGrand ? "grand" : r.username}
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          alignItems: "center",
          gap: 10,
          padding: "14px 20px",
          background: isGrand ? "#f8fafc" : "#fff",
          borderTop: isGrand ? "2px solid #e2e8f0" : "1px solid #f1f5f9",
          fontWeight: isGrand ? 700 : 400,
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 700 }}>
            {isGrand ? `Grand Total (${grand.employeeCount} employees)` : r.name}
          </div>
          {!isGrand && (
            <>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                {r.username}
                {r.department ? ` · ${r.department}` : ""}
              </div>
              <div style={{ fontSize: 10.5, color: "#cbd5e1", marginTop: 1 }}>
                Delegated {r.delegatedCount} · Recurring {r.recurringCount}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <MisCountPill value={r.total} bg="#eff6ff" color="#2563eb" />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <MisCountPill value={`✓${r.done}`} bg="#f0fdf4" color="#16a34a" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <MisCountPill value={r.onTime} bg="#f0fdf4" color="#16a34a" />
          {r.onTimePct != null && (
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>
              {r.onTimePct.toFixed(2)}%
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <MisCountPill value={r.delayedDone} bg="#fff7ed" color="#d97706" />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MisCountPill value={r.delayed} bg="#fef2f2" color="#dc2626" />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MisCountPill value={r.pending} bg="#fff7ed" color="#d97706" />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MisCountPill value={r.na} bg="#f5f3ff" color="#7c3aed" />
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: oc, textAlign: "right" }}>
            {r.openPct.toFixed(2)}%
          </div>
          <div style={{ width: "100%", height: 5, background: "#e2e8f0", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(r.openPct, 100)}%`,
                height: "100%",
                background: oc,
                borderRadius: 3,
                marginLeft: "auto",
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
      {/* Week header band — softer, less saturated blue */}
      <div
        style={{
          background: "linear-gradient(90deg, #334155, #475569)",
          color: "#fff",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {week.label} ({formatWeekRange(week)})
          {week.includesPrevMonth && (
            <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}> · includes previous month</span>
          )}
          {week.includesNextMonth && (
            <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}> · extends into next month</span>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {grand.employeeCount} employee{grand.employeeCount !== 1 ? "s" : ""} · {grand.total} task{grand.total !== 1 ? "s" : ""} · Open {grand.openPct.toFixed(2)}%
        </div>
      </div>

      {/* Column headers — real shaded row, aligned to the same grid as data rows */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: 10,
          padding: "11px 20px",
          background: "#f1f5f9",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {["EMPLOYEE", "TOTAL", "DONE", "ON-TIME", "DELAYED DONE", "DELAYED", "PENDING", "N/A", "OPEN % (0=ALL DONE)"].map(
          (h, i) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                letterSpacing: ".04em",
                textAlign: i === 0 ? "left" : i === 8 ? "right" : "center",
              }}
            >
              {h}
            </div>
          ),
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          No {taskType !== "all" ? taskType + " " : ""}tasks due in this week.
        </div>
      ) : (
        <>
          {rows.map((r) => renderRow(r, false))}
          {renderRow(grand, true)}
        </>
      )}
    </div>
  );
}
// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }) {
  return (
    <div className="ap-stat-card" style={{ borderTopColor: accent }}>
      <div
        className="ap-stat-icon"
        style={{ background: accent + "18", color: accent }}
      >
        {icon}
      </div>
      <div className="ap-stat-body">
        <div className="ap-stat-value">{value}</div>
        <div className="ap-stat-label">{label}</div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  verification, 
  onMarkDone,
  onEdit,
  onReassign,
  onReschedule,
  onReject,
  userMap,
  onClick,
  onVerificationClick,
}) {
  const p = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const s = STATUS_STYLES[displayStatus(task.status)];
  return (
    <tr
      className="ap-tr"
      onClick={() => onClick?.(task)}
      style={{ cursor: "pointer" }}
    >
      <td className="ap-td ap-td-title">
        {task.parent_task_id && (
          <span className="ap-child-badge" title="Auto-generated instance">
            ↳
          </span>
        )}
        {task.title}
        <div
          style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}
        >
          {task.audio_url && (
            <a
              href={task.audio_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "#7c3aed",
                background: "#f5f3ff",
                border: "1px solid #ddd6fe",
                borderRadius: 5,
                padding: "2px 7px",
                textDecoration: "none",
              }}
              title="Play audio instruction"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              Audio
            </a>
          )}
          {task.document_url && (
            <a
              href={task.document_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "#0369a1",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: 5,
                padding: "2px 7px",
                textDecoration: "none",
              }}
              title="View document"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Doc
            </a>
          )}
        </div>
      </td>
      <td className="ap-td">{nameFor(userMap, task.assigned_to)}</td>
      <td className="ap-td">{task.site_name || "—"}</td>
      {/* <td className="ap-td">{nameFor(userMap, task.assigned_by)}</td> */}
      <td className="ap-td">
        <span className="ap-badge" style={{ background: p.bg, color: p.color }}>
          <span className="ap-badge-dot" style={{ background: p.dot }} />
          {task.priority}
        </span>
      </td>
      <td className="ap-td">
        <span className="ap-badge" style={{ background: s.bg, color: s.color }}>
          {formatStatus(task.status)}
        </span>
      </td>
      <td className="ap-td">
        {(() => {
          const a = getTaskActivity(task);
          const elapsed = task.is_held
            ? formatElapsedSince(task.hold_started_at)
            : task.accepted_at
              ? formatElapsedSince(task.resumed_at || task.accepted_at)
              : null;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                className="ap-badge"
                style={{
                  background: a.bg,
                  color: a.color,
                  width: "fit-content",
                }}
              >
                {a.label}
              </span>
              {elapsed && (
                <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                  {task.is_held ? "held" : "running"} {elapsed}
                </span>
              )}
            </div>
          );
        })()}
      </td>
      <td className="ap-td">
        {task.hours_to_complete ? `${task.hours_to_complete} hrs` : "—"}
      </td>
      <td className="ap-td">
        {task.due_date
          ? new Date(task.due_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—"}
      </td>
      <td className="ap-td" onClick={(e) => e.stopPropagation()}>
        <VerificationBadge
          verification={verification}
          onClick={verification ? () => onVerificationClick(verification, task) : undefined}
        />
      </td>
      <td className="ap-td">
        {task.is_recurring ? (
          <span className="ap-pill-blue">
            {anchorDescription(task.recurrence, task.recurrence_anchor) ||
              task.recurrence}
          </span>
        ) : task.parent_task_id ? (
          <span className="ap-pill-orange">instance</span>
        ) : (
          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
        )}
      </td>
      <td className="ap-td" onClick={(e) => e.stopPropagation()}>
        <TaskActionsMenu
          task={task}
          onMarkDone={onMarkDone}
          onEdit={onEdit}
          onReassign={onReassign}
          onReschedule={onReschedule}
          onReject={onReject}
        />
      </td>
    </tr>
  );
}

function RecurringTaskCard({ task, next, p, onDelete, userMap }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="ap-task-card-mobile"
      onClick={() => setExpanded((e) => !e)}
      style={{ cursor: "pointer" }}
    >
      {/* Compact header — always visible */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ap-task-card-title" style={{ marginBottom: 5 }}>
            {task.title}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              alignItems: "center",
            }}
          >
            <span
              className="ap-badge"
              style={{ background: p.bg, color: p.color }}
            >
              <span className="ap-badge-dot" style={{ background: p.dot }} />
              {task.priority}
            </span>
            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
              {task.assigned_to}
            </span>
            {next?.label && (
              <span
                style={{ fontSize: 11.5, color: "#64748b", marginLeft: "auto" }}
              >
                {next.label}
                {next.badge && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: next.bg,
                      color: next.color,
                      borderRadius: 20,
                      padding: "1px 5px",
                    }}
                  >
                    {next.badge}
                  </span>
                )}
              </span>
            )}
          </div>
          {(task.audio_url || task.document_url) && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10.5,
                fontWeight: 600,
                color: "#94a3b8",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: "1px 5px",
                marginTop: 5,
              }}
            >
              📎{" "}
              {[task.audio_url && "audio", task.document_url && "doc"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            className="ap-del-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            title="Delete"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
          <button
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="ap-task-card-badges">
            <span className="ap-pill-blue">
              {anchorDescription(task.recurrence, task.recurrence_anchor) ||
                task.recurrence}
            </span>
          </div>
          <div className="ap-task-card-meta">
            <div>
              <span>Site</span>
              <strong>{task.site_name || "Not assigned"}</strong>
            </div>
            <div>
              <span>Next Due</span>
              <strong>
                {next?.label || "—"}
                {next?.badge && (
                  <span
                    style={{
                      marginLeft: 5,
                      fontSize: 10,
                      fontWeight: 700,
                      background: next.bg,
                      color: next.color,
                      borderRadius: 20,
                      padding: "1px 6px",
                    }}
                  >
                    {next.badge}
                  </span>
                )}
              </strong>
            </div>
          </div>
          {task.description && (
            <div
              style={{
                fontSize: 12.5,
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: 6,
                padding: "8px 10px",
                borderLeft: "3px solid #e2e8f0",
                lineHeight: 1.5,
              }}
            >
              {task.description}
            </div>
          )}
          {(task.audio_url || task.document_url) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {task.audio_url && (
                <a
                  href={task.audio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#7c3aed",
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: 7,
                    padding: "6px 12px",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  Audio Instruction
                </a>
              )}
              {task.document_url && (
                <a
                  href={task.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#0369a1",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: 7,
                    padding: "6px 12px",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Document
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskActionsMenu({
  task,
  onMarkDone,
  onEdit,
  onReassign,
  onReschedule,
  onReject,
  busy,
}) {
  const [open, setOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    openUpward: false,
  });
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = [
    {
      key: "done",
      label: "Mark as Done",
      hidden: task.status === "completed",
      onClick: () => onMarkDone(task),
      color: "#16a34a",
      bg: "#f0fdf4",
      icon: (
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      ),
    },
    {
      key: "edit",
      label: "Edit Task",
      onClick: () => onEdit(task),
      color: "#2563eb",
      bg: "#eff6ff",
      icon: (
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
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      key: "reassign",
      label: "Reassign",
      onClick: () => onReassign(task),
      color: "#e73f8b",
      bg: "#fdf2f8",
      icon: (
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
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      key: "reschedule",
      label: "Reschedule",
      onClick: () => onReschedule(task),
      color: "#7c3aed",
      bg: "#f5f3ff",
      icon: (
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
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      key: "reject",
      label: "Reject Task",
      onClick: () => onReject(task),
      color: "#dc2626",
      bg: "#fef2f2",
      icon: (
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
  ].filter((i) => !i.hidden);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    const menuHeight = items.length * 40 + 12; // approx row height + padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    setMenuPosition({
      top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.min(rect.right - 190, window.innerWidth - 200), // keep on-screen horizontally too
      openUpward,
    });
    setOpen(true);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Actions"
        disabled={busy}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          cursor: busy ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            minWidth: 190,
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {items.map((item) => {
            const isHovered = hoveredKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: isHovered ? item.bg : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isHovered ? item.color : "#334155",
                  transition: "background .12s, color .12s",
                }}
              >
                <span
                  style={{ display: "flex", flexShrink: 0, color: item.color }}
                >
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

function TaskCard({
  task,
  onMarkDone,
  onEdit,
  onReassign,
  onReschedule,
  onReject,
  onOpenDetail,
   onVerificationClick,
}) {
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const s = STATUS_STYLES[displayStatus(task.status)];

  return (
    <div className="ap-task-card-mobile">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          onClick={() => onOpenDetail?.(task)}
        >
          <div className="ap-task-card-title" style={{ marginBottom: 5 }}>
            {task.parent_task_id && <span className="ap-child-badge">↳</span>}
            {task.title}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              alignItems: "center",
            }}
          >
            <span
              className="ap-badge"
              style={{ background: p.bg, color: p.color }}
            >
              <span className="ap-badge-dot" style={{ background: p.dot }} />
              {task.priority}
            </span>
            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
              {task.assigned_to}
            </span>
            {task.due_date && (
              <span
                style={{ fontSize: 11.5, color: "#64748b", marginLeft: "auto" }}
              >
                {new Date(task.due_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {(task.audio_url || task.document_url) && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#94a3b8",
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                📎{" "}
                {[task.audio_url && "audio", task.document_url && "doc"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <TaskActionsMenu
            task={task}
            onMarkDone={onMarkDone}
            onEdit={onEdit}
            onReassign={onReassign}
            onReschedule={onReschedule}
            onReject={onReject}
          />
          <button
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              transition: "transform .2s",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="ap-task-card-badges">
            <span
              className="ap-badge"
              style={{ background: s.bg, color: s.color }}
            >
              {formatStatus(task.status)}
            </span>
            {task.is_recurring ? (
              <span className="ap-pill-blue">
                {anchorDescription(task.recurrence, task.recurrence_anchor) ||
                  task.recurrence}
              </span>
            ) : task.parent_task_id ? (
              <span className="ap-pill-orange">instance</span>
            ) : (
              <span className="ap-mobile-pill-muted">one-time</span>
            )}
          </div>
          <div className="ap-task-card-badges">
            <VerificationBadge
              verification={task._verification}
              onClick={
                task._verification
                  ? () => onVerificationClick(task._verification, task)
                  : undefined
              }
            />
          </div>  
          <div className="ap-task-card-meta">
            <div>
              <span>Site</span>
              <strong>{task.site_name || "Not assigned"}</strong>
            </div>
            <div>
              <span>Hours to Complete</span>
              <strong>
                {task.hours_to_complete
                  ? `${task.hours_to_complete} hrs`
                  : "Not set"}
              </strong>
            </div>
            <div>
              <span>Due Date</span>
              <strong>
                {task.due_date
                  ? new Date(task.due_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not set"}
              </strong>
            </div>
          </div>
          {task.description && (
            <div
              style={{
                fontSize: 12.5,
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: 6,
                padding: "8px 10px",
                borderLeft: "3px solid #e2e8f0",
                lineHeight: 1.5,
              }}
            >
              {task.description}
            </div>
          )}
          {(task.audio_url || task.document_url) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {task.audio_url && (
                <a
                  href={task.audio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#7c3aed",
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: 7,
                    padding: "6px 12px",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  Audio Instruction
                </a>
              )}
              {task.document_url && (
                <a
                  href={task.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#0369a1",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: 7,
                    padding: "6px 12px",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Document
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function formatAuditEntries(value, roleByName = {}, userMap = {}) {
  if (value == null || value === "") return null;

  const renderEntry = (entry, key) => {
    if (typeof entry === "string") return <div key={key}>{entry}</div>;
    const { by, slot, reason, at } = entry || {};
    const displayName = userMap[by] || by; // resolves username -> name if needed
    const dateStr = at
      ? new Date(at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
    const roleLabel = roleByName[displayName] || roleByName[by];
    return (
      <div key={key} style={{ marginBottom: 6 }}>
        <strong>{displayName || "Unknown"}</strong>
        {roleLabel ? (
          <span style={{ color: "#94a3b8" }}> ({roleLabel})</span>
        ) : slot ? (
          <span style={{ color: "#94a3b8" }}> ({slotLabel(slot)})</span>
        ) : null}
        {reason && <>: {reason}</>}
        {dateStr && (
          <span style={{ color: "#94a3b8", fontSize: 11 }}> — {dateStr}</span>
        )}
      </div>
    );
  };

  // already a plain string — could be plain text, or a stringified JSON array
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return <>{parsed.map((entry, i) => renderEntry(entry, i))}</>;
      }
      if (parsed && typeof parsed === "object")
        return renderEntry(parsed, "single");
    } catch {
      return value;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return <>{value.map((entry, i) => renderEntry(entry, i))}</>;
  }

  if (typeof value === "object") {
    return renderEntry(value, "single");
  }

  return String(value);
}
function displayReason(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return (
      <>
        {value.reason}
        {value.by && (
          <span style={{ color: "#94a3b8" }}> — requested by {value.by}</span>
        )}
      </>
    );
  }
  return "";
}
function LeaveStatusBadge({ leave }) {
  const status = computeLeaveStatus(leave);
  const style = LEAVE_STATUS_STYLES[status];
  return (
    <span
      className="ap-leave-status"
      style={{
        background: style.bg,
        color: style.color,
        borderColor: style.border,
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function VerificationCard({
  verification,
  task,
  userMap,
  onComplete,
  onCorrect,
  updatingId,
  currentUser,
}) {
  const isPending = verification.status === "pending";
  const canAct = isPending && verification.verifier === currentUser;
  const isCompleted = verification.status === "completed";
  const isCorrection = verification.status === "correction_sent";

  const p = task
    ? PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
    : null;
  const s = task ? STATUS_STYLES[task.status] || STATUS_STYLES.pending : null;

  const statusColor = isCompleted
    ? "#16a34a"
    : isCorrection
      ? "#dc2626"
      : "#f59e0b";

  return (
    <div className="ap-leave-card" style={{ borderLeftColor: statusColor }}>
      <div className="ap-leave-card-top">
        <div>
          <div className="ap-leave-title">
            {task?.title || verification.task_title || "Untitled task"}
          </div>
          <div className="ap-leave-sub">
            Sent by{" "}
            <strong>{verification.sent_by_name || verification.sent_by}</strong>
            {verification.site_name ? ` · ${verification.site_name}` : ""}
          </div>
        </div>
        <span
          className="ap-leave-status"
          style={{
            background: isCompleted
              ? "#f0fdf4"
              : isCorrection
                ? "#fef2f2"
                : "#fffbeb",
            color: statusColor,
            borderColor: isCompleted
              ? "#bbf7d0"
              : isCorrection
                ? "#fecaca"
                : "#fde68a",
          }}
        >
          {isCompleted
            ? "Completed"
            : isCorrection
              ? "Correction Sent"
              : "Pending"}
        </span>
      </div>

      {task && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              margin: "8px 0",
            }}
          >
            {p && (
              <span
                className="ap-badge"
                style={{ background: p.bg, color: p.color }}
              >
                <span className="ap-badge-dot" style={{ background: p.dot }} />
                {task.priority}
              </span>
            )}
            {s && (
              <span
                className="ap-badge"
                style={{ background: s.bg, color: s.color }}
              >
                {formatStatus(task.status)}
              </span>
            )}
            {task.hours_to_complete && (
              <span className="ap-pill-blue">{task.hours_to_complete} hrs</span>
            )}
          </div>

          <div className="ap-leave-meta">
            <span>Assigned to: {nameFor(userMap, task.assigned_to)}</span>
            {task.due_date && (
              <span>
                Due:{" "}
                {new Date(task.due_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {task.description && (
            <p className="ap-leave-reason">{task.description}</p>
          )}

          {(task.audio_url || task.document_url) && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              {task.audio_url && (
                <a
                  href={task.audio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#7c3aed",
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: 6,
                    padding: "3px 9px",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
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
                  <span>Original audio</span>
                </a>
              )}
              {task.document_url && (
                <a
                  href={task.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#0369a1",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: 6,
                    padding: "3px 9px",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
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
                  <span>Original document</span>
                </a>
              )}
            </div>
          )}
        </>
      )}

      {verification.document_urls?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              marginBottom: 4,
            }}
          >
            VERIFICATION ATTACHMENTS
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {verification.document_urls.map((url, i) => (
              <a
                key={i}
                href={url}
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
                  padding: "3px 9px",
                  textDecoration: "none",
                }}
              >
                <svg
                  width="12"
                  height="12"
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
        </div>
      )}

      {isCorrection && (
        <div className="lv-rejection" style={{ marginTop: 8 }}>
          <strong>Correction sent:</strong> {verification.correction_note}
          {(verification.correction_audio_url ||
            verification.correction_document_urls?.length > 0) && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              {verification.correction_audio_url && (
                <a
                  href={verification.correction_audio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#7c3aed",
                  }}
                >
                  <svg
                    width="11"
                    height="11"
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
                  <span>Correction audio</span>
                </a>
              )}
              {verification.correction_document_urls?.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#2563eb",
                  }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>&nbsp;&nbsp;Correction doc {i + 1}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {isPending ? (
        canAct ? (
          <div className="ap-leave-actions">
            <button
              className="ap-btn-approve"
              disabled={updatingId === verification.id}
              onClick={() => onComplete(verification)}
            >
              Mark Completed
            </button>
            <button
              className="ap-btn-reject"
              disabled={updatingId === verification.id}
              onClick={() => onCorrect(verification)}
            >
              Send Correction
            </button>
            {updatingId === verification.id && (
              <span className="ap-saving">saving...</span>
            )}
          </div>
        ) : (
          <div className="ap-leave-done">
            Waiting on {verification.verifier_name || verification.verifier} to
            review this.
          </div>
        )
      ) : (
        <div className="ap-leave-done">
          {isCompleted ? "✓ Marked completed" : "✗ Correction sent back"} by{" "}
          {verification.resolved_by}
        </div>
      )}
    </div>
  );
}
// ── Site badge list (collapsed by default) ─────────────────────────────────
function SiteBadgeList({ sites, max = 3 }) {
  const [expanded, setExpanded] = useState(false);
  if (!sites || sites.length === 0) {
    return <span style={{ color: "#94a3b8" }}>—</span>;
  }

  const visible = expanded ? sites : sites.slice(0, max);
  const remaining = sites.length - max;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
        maxWidth: 320,
      }}
    >
      {visible.map((s) => (
        <span key={s} className="ap-pill-blue" title={s}>
          {s.toUpperCase()}
        </span>
      ))}
      {!expanded && remaining > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          title={sites.slice(max).join(", ")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#64748b",
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 20,
            padding: "2px 9px",
            cursor: "pointer",
          }}
        >
          +{remaining} more
        </button>
      )}
      {expanded && sites.length > max && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#64748b",
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 20,
            padding: "2px 9px",
            cursor: "pointer",
          }}
        >
          Show less
        </button>
      )}
    </div>
  );
}
function LeaveRequestCard({ leave, onAction, updating, roleByName, userMap }) {
  const status = computeLeaveStatus(leave);
  const days = getLeaveDays(leave);
  const managedByHead = isSiteEngineerLeave(leave);
  const canAct =
    !managedByHead &&
    (leave.admin_approved === null || leave.admin_approved === undefined) &&
    !isFinalLeaveStatus(leave);

  return (
    <div
      className="ap-leave-card"
      style={{
        borderLeftColor:
          status === "approved"
            ? "#16a34a"
            : status === "rejected"
              ? "#dc2626"
              : "#f59e0b",
      }}
    >
      <div className="ap-leave-card-top">
        <div>
          <div className="ap-leave-title">
            {leave.name || leave.user_name || "Employee"}
          </div>
          <div className="ap-leave-sub">
            {leave.user_name || "No username"}
            {leave.site_name ? ` - ${leave.site_name}` : ""}
          </div>
        </div>
        <LeaveStatusBadge leave={leave} />
      </div>
      <div className="ap-leave-meta">
        {(leave.role || leave.designation) && (
          <span>{leave.role || leave.designation}</span>
        )}
        <span>{leave.leave_type || "Leave"}</span>
        <span>
          {formatLeaveDate(leave.from_date)} to {formatLeaveDate(leave.to_date)}
        </span>
        {days && (
          <span>
            {days} day{days > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {leave.reason && (
        <p className="ap-leave-reason">
          {formatAuditEntries(leave.reason, roleByName, userMap)}
        </p>
      )}
      <div className="ap-leave-approvals">
        {managedByHead ? (
          <span className={`ap-approval-pill ${getHeadApprovalClass(leave)}`}>
            {getHeadApprovalText(leave)}
          </span>
        ) : (
          <>
            {leave.admin_approved === true && (
              <span className="ap-approval-pill ok">Admin: Approved</span>
            )}
            {leave.admin_approved === false && (
              <span className="ap-approval-pill no">Admin: Rejected</span>
            )}
            {leave.proxy_user_name ? (
              <span
                className={`ap-approval-pill ${leave.proxy_approved === true ? "ok" : leave.proxy_approved === false ? "no" : ""}`}
              >
                Proxy ({leave.proxy_user_name}):{" "}
                {leave.proxy_approved === true
                  ? "Accepted"
                  : leave.proxy_approved === false
                    ? "Declined"
                    : "Pending"}
              </span>
            ) : leave.admin_approved === null ||
              leave.admin_approved === undefined ? (
              <span className="ap-approval-pill">Admin: Pending</span>
            ) : null}
          </>
        )}
      </div>
      {leave.rejection_reason && (
        <div className="lv-rejection">
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
          <strong>Rejected:</strong>{" "}
          {formatAuditEntries(leave.rejection_reason, roleByName, userMap)}
        </div>
      )}
      {canAct ? (
        <div className="ap-leave-actions">
          <button
            className="ap-btn-approve"
            disabled={updating === leave.id}
            onClick={() => onAction(leave, true)}
          >
            Approve
          </button>
          <button
            className="ap-btn-reject"
            disabled={updating === leave.id}
            onClick={() => onAction(leave, false)}
          >
            Reject
          </button>
          {updating === leave.id && (
            <span className="ap-saving">saving...</span>
          )}
        </div>
      ) : managedByHead ? (
        <div className="ap-leave-done">
          Managed by site head - admin can view status only.
        </div>
      ) : (
        <div className="ap-leave-done">Admin decision already submitted.</div>
      )}
    </div>
  );
}

// ── Shared task form JSX (used in both assign-task tab and modal) ───────────
function TaskForm({
  form,
  handleFormChange,
  setForm,
  handleSubmit,
  submitting,
  onSuccess,
  employees,
  sites = [],
}) {
  const liveAnchor = form.is_recurring ? buildAnchor(form) : null;
  const anchorPreview =
    form.is_recurring && form.recurrence
      ? anchorDescription(form.recurrence, liveAnchor)
      : null;
  const monthDays = daysInMonth(form.anchor_month);

  return (
    <div className="ap-form-grid">
      <div className="ap-field">
        <label className="ap-label">
          Assign To <span className="ap-req">*</span>
        </label>
        <select
          className="ap-input ap-select"
          name="assigned_to"
          value={form.assigned_to}
          onChange={handleFormChange}
        >
          <option value="">Select employee…</option>
          {employees
            .filter((e) => e.status !== "Inactive") // optional: hide inactive staff
            .map((e) => (
              <option key={e.username} value={e.username}>
                {e.name}
              </option>
            ))}
        </select>
      </div>
      <div className="ap-form-row ap-col-2">
        <div className="ap-field ap-field-center">
          <label className="ap-label">Reschedule Request</label>
          <label className="ap-toggle">
            <input
              type="checkbox"
              name="reschedule_allowed"
              checked={form.reschedule_allowed || false}
              onChange={handleFormChange}
            />
            <span className="ap-toggle-track">
              <span className="ap-toggle-thumb" />
            </span>
            <span className="ap-toggle-label">
              {form.reschedule_allowed
                ? "Yes — employee can request reschedule"
                : "No"}
            </span>
          </label>
        </div>
      </div>
      {/* Audio attachment */}
      <div className="ap-form-row ap-col-2">
        <div className="ap-field">
          <label className="ap-label">
            Audio Instruction
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
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <input
              type="file"
              accept="audio/*"
              style={{
                flex: 1,
                fontSize: 12.5,
                color: "#475569",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
              }}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  _audioFile: e.target.files[0] || null,
                }))
              }
            />
          </div>
          {form._audioFile && (
            <span style={{ fontSize: 11.5, color: "#16a34a" }}>
              ✓ {form._audioFile.name}
            </span>
          )}
          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
            MP3, WAV, M4A supported. Max 50MB.
          </span>
        </div>

        <div className="ap-field">
          <label className="ap-label">
            Document Attachment
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
              style={{
                flex: 1,
                fontSize: 12.5,
                color: "#475569",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
              }}
              onChange={(e) =>
                setForm((p) => ({ ...p, _docFile: e.target.files[0] || null }))
              }
            />
          </div>
          {form._docFile && (
            <span style={{ fontSize: 11.5, color: "#16a34a" }}>
              ✓ {form._docFile.name}
            </span>
          )}
          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
            PDF, Word, Excel, images supported. Max 20MB.
          </span>
        </div>
      </div>
      <div className="ap-form-row ap-col-1">
        <div className="ap-field">
          <label className="ap-label">Description</label>
          <textarea
            className="ap-input ap-textarea"
            name="description"
            value={form.description}
            onChange={handleFormChange}
            placeholder="Add task details, instructions, or notes…"
            rows={3}
          />
        </div>
      </div>
      <div className="ap-form-row ap-col-3">
        <div className="ap-field">
          <label className="ap-label">Site Name</label>
          <select
            className="ap-input ap-select"
            name="site_name"
            value={form.site_name}
            onChange={handleFormChange}
          >
            <option value="">Select site…</option>
            {sites
              .filter((s) => (s.status || "Active") === "Active")
              .map((s) => (
                <option key={s.id} value={s.site_name}>
                  {s.site_name}
                </option>
              ))}
          </select>
        </div>
        <div className="ap-field">
          <label className="ap-label">Priority</label>
          <select
            className="ap-input ap-select"
            name="priority"
            value={form.priority}
            onChange={handleFormChange}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="ap-field">
          <label className="ap-label">Initial Status</label>
          <select
            className="ap-input ap-select"
            name="status"
            value={form.status}
            onChange={handleFormChange}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="ap-form-row ap-col-2">
        <div className="ap-field">
          <label className="ap-label">Start / Due Date</label>
          <input
            className="ap-input"
            type="date"
            name="due_date"
            value={form.due_date}
            onChange={handleFormChange}
          />
        </div>
        <div className="ap-field ap-field-center">
          <label className="ap-label">Recurring Task</label>
          <label className="ap-toggle">
            <input
              type="checkbox"
              name="is_recurring"
              checked={form.is_recurring}
              onChange={handleFormChange}
            />
            <span className="ap-toggle-track">
              <span className="ap-toggle-thumb" />
            </span>
            <span className="ap-toggle-label">
              {form.is_recurring ? "Yes" : "No"}
            </span>
          </label>
        </div>
      </div>
      {form.is_recurring && (
        <>
          <div className="ap-recurrence-divider">
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
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Recurrence Schedule
          </div>
          <div className="ap-form-row ap-col-2">
            <div className="ap-field">
              <label className="ap-label">
                Recurrence Schedule <span className="ap-req">*</span>
              </label>
              <div className="ap-recurrence-pills">
                {["daily", "weekly", "monthly", "yearly"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`ap-rpill${form.recurrence === r ? " Active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, recurrence: r }))}
                  >
                    {r === "daily" && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      >
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                      </svg>
                    )}
                    {r === "weekly" && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    )}
                    {r === "monthly" && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="12" y1="14" x2="12" y2="18" />
                      </svg>
                    )}

                    {r === "yearly" && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    )}
                    {r.charAt(0).toUpperCase() + r.slice(1)}
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
                      onClick={() =>
                        setForm((p) => ({ ...p, anchor_weekday: String(i) }))
                      }
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
                    <option key={d} value={d}>
                      {d}
                      {ordinal(d)}
                    </option>
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
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
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
                  {Array.from({ length: monthDays }, (_, i) => i + 1).map(
                    (d) => (
                      <option key={d} value={d}>
                        {d}
                        {ordinal(d)}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          )}
          {anchorPreview && (
            <div className="ap-anchor-preview">
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
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              This task will auto-generate a new instance{" "}
              <strong>{anchorPreview}</strong>. If the previous instance is
              still pending, a warning note will be added.
            </div>
          )}
        </>
      )}
      <div className="ap-form-row ap-col-1 ap-form-actions">
        <button
          className="ap-btn-secondary"
          onClick={() => setForm({ ...EMPTY_FORM })}
        >
          <svg
            width="14"
            height="14"
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
          Reset
        </button>
        <button
          className="ap-btn-primary"
          onClick={async () => {
            const ok = await handleSubmit();
            if (ok && onSuccess) onSuccess();
          }}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="ap-mini-spinner" /> Assigning…
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
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>{" "}
              Assign Task
            </>
          )}
        </button>
      </div>
    </div>
  );
}

const RESCHED_STATUS_STYLES = {
  pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  approved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};
function toTitleCase(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function generateJobNo(siteName, existingSites) {
  let maxNum = 0;
  (existingSites || []).forEach((s) => {
    const m = /^DIP-(\d+)\|/.exec(s.job_no || "");
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  const nextNum = String(maxNum + 1).padStart(3, "0");
  const year = new Date().getFullYear();
  const cleanName = (siteName || "").replace(/\s+/g, "");
  return `DIP-${nextNum}|${year}|${cleanName}`;
}

async function addSiteToUser(supabaseClient, username, siteName) {
  if (!username || !siteName) return;
  const { data: userRow, error } = await supabaseClient
    .from("user_details")
    .select("id, site_name, site_names")
    .eq("username", username)
    .single();
  if (error || !userRow) return;

  const current = userRow.site_names?.length
    ? userRow.site_names
    : userRow.site_name
      ? [userRow.site_name]
      : [];

  if (current.includes(siteName)) return; // already has it, nothing to do

  const updated = [...current, siteName];

  await supabaseClient
    .from("user_details")
    .update({
      site_names: updated,
      site_name: userRow.site_name || updated[0], // keep legacy single-site column populated
    })
    .eq("id", userRow.id);
}

async function removeSiteFromUser(supabaseClient, username, siteName) {
  if (!username || !siteName) return;
  const { data: userRow, error } = await supabaseClient
    .from("user_details")
    .select("id, site_name, site_names")
    .eq("username", username)
    .single();
  if (error || !userRow) return;

  const current = userRow.site_names?.length
    ? userRow.site_names
    : userRow.site_name
      ? [userRow.site_name]
      : [];

  const updated = current.filter((s) => s !== siteName);

  await supabaseClient
    .from("user_details")
    .update({
      site_names: updated.length ? updated : null,
      site_name:
        userRow.site_name === siteName ? updated[0] || null : userRow.site_name,
    })
    .eq("id", userRow.id);
}

function findUsernameByEmployeeName(employeesList, name) {
  if (!name) return null;
  const match = employeesList.find((e) => e.name === name);
  return match?.username || null;
}

async function syncAllSiteUsers(
  supabaseClient,
  payload,
  employeesList,
  onError,
) {
  const usernamesToSync = new Set();
  if (payload.user_name) usernamesToSync.add(payload.user_name);

  const headUsername = findUsernameByEmployeeName(
    employeesList,
    payload.head_name,
  );
  if (headUsername) usernamesToSync.add(headUsername);

  const coordinatorUsername = findUsernameByEmployeeName(
    employeesList,
    payload.coordinator_name,
  );
  if (coordinatorUsername) usernamesToSync.add(coordinatorUsername);

  const pcUsername = findUsernameByEmployeeName(employeesList, payload.pc_name);
  if (pcUsername) usernamesToSync.add(pcUsername);
  
  console.log("syncAllSiteUsers: usernames to sync", [...usernamesToSync]);

  for (const uname of usernamesToSync) {
    const syncResult = await syncUserSiteNames(
      supabaseClient,
      uname,
      payload.site_name,
    );
    if (!syncResult.ok && syncResult.reason !== "already_present") {
      onError?.(
        `Site saved, but failed to sync "${uname}"'s site list: ${syncResult.reason}`,
      );
    }
  }
}
async function syncUserSiteNames(supabaseClient, username, siteName) {
  if (!username || !siteName) {
    console.warn("syncUserSiteNames: missing username or siteName", {
      username,
      siteName,
    });
    return { ok: false, reason: "missing_args" };
  }

  const { data: userRow, error: fetchErr } = await supabaseClient
    .from("user_details")
    .select("id, site_name, site_names")
    .eq("username", username)
    .maybeSingle();

  if (fetchErr) {
    console.error("syncUserSiteNames: fetch failed", fetchErr);
    return { ok: false, reason: fetchErr.message };
  }
  if (!userRow) {
    console.warn(
      "syncUserSiteNames: no user_details row for username",
      username,
    );
    return { ok: false, reason: "user_not_found" };
  }

  const current = Array.isArray(userRow.site_names)
    ? userRow.site_names
    : userRow.site_name
      ? [userRow.site_name]
      : [];

  if (current.includes(siteName)) {
    console.log("syncUserSiteNames: already present, skipping", {
      username,
      siteName,
      current,
    });
    return { ok: true, reason: "already_present" };
  }

  const updated = [...current, siteName];

  const { error: updateErr } = await supabaseClient
    .from("user_details")
    .update({
      site_names: updated,
      site_name: userRow.site_name || siteName,
    })
    .eq("id", userRow.id);

  if (updateErr) {
    console.error("syncUserSiteNames: update failed", updateErr);
    return { ok: false, reason: updateErr.message };
  }

  console.log("syncUserSiteNames: success", { username, updated });
  return { ok: true, updated };
}

async function uploadDrawingFiles(supabaseClient, siteName, dateStr, files) {
  const bucket = slugify(siteName);
  if (!bucket) throw new Error("Site name is required to upload drawings.");

  const { error: bucketErr } = await supabaseClient.storage.createBucket(bucket, { public: true });
  if (bucketErr && !/already exists/i.test(bucketErr.message || "")) {
    throw new Error(`Could not create bucket "${bucket}": ${bucketErr.message}`);
  }

  const d = new Date(dateStr + "T00:00:00");
  const year = d.getFullYear();
  const month = MONTHS[d.getMonth()];
  const dayFolder = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${year}`;

  const uploaded = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${year}/${month}/${dayFolder}/drawings/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseClient.storage.from(bucket).upload(path, file);
    if (upErr) throw new Error(`Failed to upload ${file.name}: ${upErr.message}`);
    const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    uploaded.push({ name: file.name, url: urlData.publicUrl, path });
  }
  return uploaded;
}

async function uploadSiteImage(supabaseClient, siteName, file) {
  const bucket = slugify(siteName);
  if (!bucket) throw new Error("Enter a site name before uploading an image.");

  const { error: bucketErr } = await supabaseClient.storage.createBucket(
    bucket,
    {
      public: true,
    },
  );
  if (bucketErr && !/already exists/i.test(bucketErr.message || "")) {
    throw new Error(
      `Could not create bucket "${bucket}": ${bucketErr.message}`,
    );
  }

  const ext = file.name.split(".").pop();
  const path = `SiteImg/site_title.${ext}`;
  const { error: upErr } = await supabaseClient.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (upErr) throw upErr;

  const { data: urlData } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(path);
  return urlData.publicUrl;
}

function LeaveRow({ leave, onAction, updating, roleByName, userMap, onRowClick }) {
  const status = computeLeaveStatus(leave);
  const style = LEAVE_STATUS_STYLES[status];
  const days = getLeaveDays(leave);
  const managedByHead = isSiteEngineerLeave(leave);
  const canAct =
    !managedByHead &&
    (leave.admin_approved === null || leave.admin_approved === undefined) &&
    !isFinalLeaveStatus(leave);

  return (
    <tr
      className="ap-tr"
      onClick={() => onRowClick?.(leave)}
      style={{ cursor: "pointer" }}
    >
      <td className="ap-td ap-td-title">
        {leave.name || leave.user_name || "Employee"}
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
          {leave.user_name}
        </div>
      </td>
      <td className="ap-td">{leave.site_name || "—"}</td>
      <td className="ap-td">{leave.leave_type || "Leave"}</td>
      <td className="ap-td">
        {formatLeaveDate(leave.from_date)} → {formatLeaveDate(leave.to_date)}
        {days && (
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
            {days} day{days > 1 ? "s" : ""}
          </div>
        )}
      </td>
      <td className="ap-td" style={{ maxWidth: 220 }}>
        {leave.reason ? (
          <span style={{ fontSize: 12.5, color: "#64748b" }}>
            {formatAuditEntries(leave.reason, roleByName, userMap)}
          </span>
        ) : (
          <span style={{ color: "#94a3b8" }}>—</span>
        )}
      </td>
      <td className="ap-td">
        {managedByHead ? (
          <span className={`ap-approval-pill ${getHeadApprovalClass(leave)}`}>
            {getHeadApprovalText(leave)}
          </span>
        ) : (
          <>
            {leave.admin_approved === true && (
              <span className="ap-approval-pill ok">Admin: Approved</span>
            )}
            {leave.admin_approved === false && (
              <span className="ap-approval-pill no">Admin: Rejected</span>
            )}
            {(leave.admin_approved === null ||
              leave.admin_approved === undefined) && (
              <span className="ap-approval-pill">Admin: Pending</span>
            )}
          </>
        )}
      </td>
      <td className="ap-td">
        <span
          className="ap-leave-status"
          style={{
            background: style.bg,
            color: style.color,
            borderColor: style.border,
          }}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {leave.rejection_reason && (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, maxWidth: 180 }}>
             {formatAuditEntries(leave.rejection_reason, roleByName, userMap)}
          </div>
        )}
      </td>
      <td className="ap-td" onClick={(e) => e.stopPropagation()}>
        {canAct ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ap-btn-approve" disabled={updating === leave.id} onClick={() => onAction(leave, true)} style={{ padding: "5px 10px", fontSize: 11.5 }}>
              Approve
            </button>
            <button className="ap-btn-reject" disabled={updating === leave.id} onClick={() => onAction(leave, false)} style={{ padding: "5px 10px", fontSize: 11.5 }}>
              Reject
            </button>
            {updating === leave.id && <span className="ap-saving">saving…</span>}
          </div>
        ) : managedByHead ? (
          <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
            Managed by site head
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
            Actioned
          </span>
        )}
      </td>
    </tr>
  );
}

function RescheduleRow({ req, onAction, updating, userMap }) {
  const ss = RESCHED_STATUS_STYLES[req.status] || RESCHED_STATUS_STYLES.pending;
  const fmtDate = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const taskTitle = req.tasks?.title || `Task #${req.task_id}`;
  const siteName = req.tasks?.site_name;

  return (
    <tr className="ap-tr">
      <td className="ap-td ap-td-title">
        {nameFor(userMap, req.requested_by)}
      </td>
      <td className="ap-td">
        {taskTitle}
        {siteName && (
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
            {siteName}
          </div>
        )}
      </td>
      <td className="ap-td">{fmtDate(req.current_due)}</td>
      <td className="ap-td" style={{ color: "#7c3aed", fontWeight: 600 }}>
        {fmtDate(req.requested_date)}
      </td>
      <td className="ap-td" style={{ maxWidth: 220 }}>
        {req.reason ? (
          <span style={{ fontSize: 12.5, color: "#64748b" }}>
            {formatAuditEntries(req.reason)}
          </span>
        ) : (
          <span style={{ color: "#94a3b8" }}>—</span>
        )}
      </td>
      <td className="ap-td">
        <span
          className="ap-leave-status"
          style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}
        >
          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
        </span>
      </td>
      <td className="ap-td">
        {req.status === "pending" ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="ap-btn-approve"
              disabled={updating === req.id}
              onClick={() => onAction(req, true)}
              style={{ padding: "5px 10px", fontSize: 11.5 }}
            >
              Approve
            </button>
            <button
              className="ap-btn-reject"
              disabled={updating === req.id}
              onClick={() => onAction(req, false)}
              style={{ padding: "5px 10px", fontSize: 11.5 }}
            >
              Reject
            </button>
            {updating === req.id && <span className="ap-saving">saving…</span>}
          </div>
        ) : (
          <span
            style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}
          >
            {req.status === "approved"
              ? `Approved by ${nameFor(userMap, req.actioned_by)}`
              : `Rejected by ${nameFor(userMap, req.actioned_by)}`}
          </span>
        )}
      </td>
    </tr>
  );
}

function RescheduleRequestCard({
  req,
  onAction,
  updating,
  roleByName,
  userMap,
}) {
  const ss = RESCHED_STATUS_STYLES[req.status] || RESCHED_STATUS_STYLES.pending;
  const fmtDate = (d) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const taskTitle = req.tasks?.title || `Task #${req.task_id}`;
  const siteName = req.tasks?.site_name;

  return (
    <div
      className="ap-leave-card"
      style={{
        borderLeftColor:
          req.status === "approved"
            ? "#16a34a"
            : req.status === "rejected"
              ? "#dc2626"
              : "#f59e0b",
      }}
    >
      <div className="ap-leave-card-top">
        <div>
          <div className="ap-leave-title">
            {nameFor(userMap, req.requested_by)}
          </div>
          <div className="ap-leave-sub">
            Task: <strong>{taskTitle}</strong>
            {siteName && ` · ${siteName}`}
          </div>
        </div>
        <span
          className="ap-leave-status"
          style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}
        >
          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
        </span>
      </div>

      <div className="ap-leave-meta">
        <span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 3 }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Current: {fmtDate(req.current_due)}
        </span>
        <span
          style={{
            color: "#2563eb",
            background: "#eff6ff",
            borderColor: "#bfdbfe",
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
            style={{ marginRight: 3 }}
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Requested: {fmtDate(req.requested_date)}
        </span>
        <span>
          {new Date(req.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      {req.reason && (
        <p className="ap-leave-reason">
          {formatAuditEntries(req.reason, roleByName)}
        </p>
      )}
      {req.admin_note && (
        <div className="ap-leave-rejection">
          {formatAuditEntries(req.admin_note, roleByName)}
        </div>
      )}

      {req.status === "pending" ? (
        <div className="ap-leave-actions">
          <button
            className="ap-btn-approve"
            disabled={updating === req.id}
            onClick={() => onAction(req, true)}
          >
            Approve & Update Due Date
          </button>
          <button
            className="ap-btn-reject"
            disabled={updating === req.id}
            onClick={() => onAction(req, false)}
          >
            Reject
          </button>
          {updating === req.id && <span className="ap-saving">saving…</span>}
        </div>
      ) : (
        <div className="ap-leave-done">
          {req.status === "approved"
            ? `✓ Approved by ${nameFor(userMap, req.actioned_by)} — due date updated to ${fmtDate(req.requested_date)}`
            : `✗ Rejected by ${nameFor(userMap, req.actioned_by)}`}
        </div>
      )}
    </div>
  );
}

function VerificationTable({
  verifications,
  allTasks,
  userMap,
  onComplete,
  onCorrect,
  updatingId,
  showAction = true,
  onRowClick,
  currentUser,
}) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const statusStyle = {
    pending: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    completed: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    correction_sent: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  };
  const statusLabel = {
    pending: "Pending",
    completed: "Completed",
    correction_sent: "Correction Sent",
  };
  const taskFor = (v) => allTasks.find((t) => t.id === v.task_id);

  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>
            {[
              "Task",
              "Site",
              "Sent By",
              "Assigned To",
              "Priority",
              "Attachments",
              "Sent On",
              "Status",
              showAction ? "Action" : null,
            ]
              .filter(Boolean)
              .map((h) => (
                <th key={h} className="ap-th">
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {verifications.map((v) => {
            const task = taskFor(v);
            const sc = statusStyle[v.status] || statusStyle.pending;
            const p = task
              ? PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
              : null;
            return (
              <tr
                key={v.id}
                className="ap-tr"
                onClick={() => onRowClick?.(v, task)}
                style={{ cursor: "pointer" }}
              >
                <td className="ap-td ap-td-title">
                  {task?.title || v.task_title || "—"}
                </td>
                <td className="ap-td">
                  {task?.site_name || v.site_name || "—"}
                </td>
                <td className="ap-td">{v.sent_by_name || v.sent_by}</td>
                <td className="ap-td">
                  {task ? nameFor(userMap, task.assigned_to) : "—"}
                </td>
                <td className="ap-td">
                  {p ? (
                    <span
                      className="ap-badge"
                      style={{ background: p.bg, color: p.color }}
                    >
                      <span
                        className="ap-badge-dot"
                        style={{ background: p.dot }}
                      />
                      {task.priority}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td className="ap-td" onClick={(e) => e.stopPropagation()}>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {/* Files the employee submitted with this verification */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {v.document_urls?.length > 0 ? (
                        v.document_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#475569",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              padding: "2px 8px",
                              textDecoration: "none",
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
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
                        ))
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 11.5 }}>
                          No files
                        </span>
                      )}
                    </div>

                    {/* Admin's correction attachments — only relevant when a correction was sent */}
                    {v.status === "correction_sent" &&
                      (v.correction_audio_url ||
                        v.correction_document_urls?.length > 0) && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            paddingTop: 4,
                            borderTop: "1px dashed #e2e8f0",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#dc2626",
                              width: "100%",
                            }}
                          >
                            ADMIN CORRECTION
                          </span>
                          {v.correction_audio_url && (
                            <a
                              href={v.correction_audio_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#7c3aed",
                                background: "#f5f3ff",
                                border: "1px solid #ddd6fe",
                                borderRadius: 6,
                                padding: "2px 8px",
                                textDecoration: "none",
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
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
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#0369a1",
                                background: "#f0f9ff",
                                border: "1px solid #bae6fd",
                                borderRadius: 6,
                                padding: "2px 8px",
                                textDecoration: "none",
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
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
                              <span>&nbsp;&nbsp;Doc {i + 1}</span>
                            </a>
                          ))}
                        </div>
                      )}
                  </div>
                </td>
                <td className="ap-td">{fmt(v.created_at)}</td>
                <td className="ap-td">
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
                    {statusLabel[v.status] || v.status}
                  </span>
                  {v.status === "correction_sent" && v.correction_note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#dc2626",
                        marginTop: 4,
                        maxWidth: 220,
                      }}
                    >
                      {v.correction_note}
                    </div>
                  )}
                  {v.status !== "pending" && v.resolved_by && (
                    <div
                      style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}
                    >
                      by {nameFor(userMap, v.resolved_by)}
                    </div>
                  )}
                </td>
                {showAction && (
                  <td className="ap-td" onClick={(e) => e.stopPropagation()}>
                    {v.status === "pending" ? (
                      v.verifier === currentUser ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="ap-btn-approve"
                            disabled={updatingId === v.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onComplete(v);
                            }}
                            style={{ padding: "5px 10px", fontSize: 11.5 }}
                          >
                            Complete
                          </button>
                          <button
                            className="ap-btn-reject"
                            disabled={updatingId === v.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCorrect(v);
                            }}
                            style={{ padding: "5px 10px", fontSize: 11.5 }}
                          >
                            Correct
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "#94a3b8",
                            fontStyle: "italic",
                          }}
                          title="Only the admin this task was sent to can action it"
                        >
                          Assigned to {v.verifier_name || v.verifier}
                        </span>
                      )
                    ) : (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        {v.status === "completed" ? "✓ Done" : "✗ Sent back"}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile fallback — reuse the existing card layout */}
      <div className="ap-task-mobile-grid">
        {verifications.map((v) => (
          <VerificationCard
            key={v.id}
            verification={v}
            task={taskFor(v)}
            userMap={userMap}
            onComplete={onComplete}
            onCorrect={onCorrect}
            updatingId={updatingId}
            onClick={() => onRowClick?.(v, taskFor(v))}
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  );
}

function AdminTicketsTable({
  tickets,
  onSolve,
  updatingId,
  showAction = true,
}) {
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
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>
            {[
              "Task",
              "Raised By",
              "Sent To",
              "Site",
              "Query",
              "Attachment",
              "Raised On",
              "Status",
              showAction ? "Action" : null,
            ]
              .filter(Boolean)
              .map((h) => (
                <th key={h} className="ap-th">
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const sc = statusStyle[t.status] || statusStyle.open;
            return (
              <tr key={t.id} className="ap-tr">
                <td className="ap-td ap-td-title">{t.task_title || "—"}</td>
                <td className="ap-td">{t.raised_by_name || t.raised_by}</td>
                <td className="ap-td">{t.assigned_to_name || t.assigned_to}</td>
                <td className="ap-td">{t.site_name || "—"}</td>
                <td className="ap-td" style={{ maxWidth: 220 }}>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>
                    {t.query}
                  </span>
                </td>
                <td className="ap-td">
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

                <td className="ap-td">{fmt(t.created_at)}</td>
                <td className="ap-td">
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
                        maxWidth: 200,
                      }}
                    >
                      {t.resolution_note}
                    </div>
                  )}
                  {t.status === "solved" && t.resolution_document_url && (
                    <a
                      href={t.resolution_document_url}
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
                  )}
                  {t.status === "solved" && t.resolved_by && (
                    <div
                      style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}
                    >
                      by {t.resolved_by}
                    </div>
                  )}
                </td>
                {showAction && (
                  <td className="ap-td">
                    {t.status === "open" ? (
                      <button
                        className="ap-btn-approve"
                        disabled={updatingId === t.id}
                        onClick={() => onSolve(t)}
                        style={{ padding: "5px 10px", fontSize: 11.5 }}
                      >
                        Mark Solved
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        ✓ Solved
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ap-task-mobile-grid">
        {tickets.map((t) => {
          const sc = statusStyle[t.status] || statusStyle.open;
          return (
            <div key={t.id} className="ap-task-card-mobile">
              <div className="ap-task-card-head">
                <div>
                  <div className="ap-task-card-title">
                    {t.task_title || "—"}
                  </div>
                  <div className="ap-task-card-sub">
                    {t.raised_by_name || t.raised_by} →{" "}
                    {t.assigned_to_name || t.assigned_to}
                  </div>
                </div>
                <span
                  style={{
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
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>{t.query}</div>
              {t.document_url && (
                <a
                  href={t.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}
                >
                  View attachment
                </a>
              )}
              {showAction && t.status === "open" && (
                <button
                  className="ap-btn-approve"
                  disabled={updatingId === t.id}
                  onClick={() => onSolve(t)}
                  style={{ width: "100%" }}
                >
                  Mark Solved
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function AdminPortal() {
  const [allReschedules, setAllReschedules] = useState([]);
  const [loadingReschedules, setLoadingReschedules] = useState(false);
  const [updatingRescheduleId, setUpdatingRescheduleId] = useState(null);
  const [recurringMobileFilterOpen, setRecurringMobileFilterOpen] =
    useState(false);
  const [showRecurringInAllTasks, setShowRecurringInAllTasks] = useState(false);
  const [user, setUser] = useState(null);
  const canSwitchToOffice = canAccessPortal(user, "office");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 760,
  );
const [hoveredNavKey, setHoveredNavKey] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);

  const [overdueRescheduleModal, setOverdueRescheduleModal] = useState(null);
  const [overdueRejectModal, setOverdueRejectModal] = useState(null); // { task, note }
  const [updatingRejectId, setUpdatingRejectId] = useState(null);
  const [updatingOverdueId, setUpdatingOverdueId] = useState(null);
  const [overdueTasksSeen, setOverdueTasksSeen] = useState(false);

  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [updatingVerificationId, setUpdatingVerificationId] = useState(null);
  const [correctionModal, setCorrectionModal] = useState(null);

  const [recurringTemplates, setRecurringTemplates] = useState([]); // from recurring_tasks
  const [editingTaskType, setEditingTaskType] = useState(null);     // 'task' | 'template' | 'instance'
  const [allSites, setAllSites] = useState([]);
  const [leaveDetailModal, setLeaveDetailModal] = useState(null);

    const latestVerificationByTask = useMemo(() => {
    const map = new Map();
    pendingVerifications.forEach((v) => {
      if (!v.task_id) return;
      const existing = map.get(v.task_id);
      if (!existing || new Date(v.created_at) > new Date(existing.created_at)) {
        map.set(v.task_id, v);
      }
    });
    return map;
  }, [pendingVerifications]);

  const [allTickets, setAllTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketSolveModal, setTicketSolveModal] = useState(null);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [leaveRejectModal, setLeaveRejectModal] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const mainRef = useRef(null);

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [reassignModal, setReassignModal] = useState(null); // { task, newAssignee }
  const [rescheduleTaskModal, setRescheduleTaskModal] = useState(null); // { task, newDate }
  const [updatingReassignId, setUpdatingReassignId] = useState(null);

  const [updatingRescheduleTaskId, setUpdatingRescheduleTaskId] =
    useState(null);
  const [updatingMarkDoneId, setUpdatingMarkDoneId] = useState(null);

  const [drawingForm, setDrawingForm] = useState({ site_name: "", date: "", files: [] });
const [drawingSubmitting, setDrawingSubmitting] = useState(false);
const [allDrawings, setAllDrawings] = useState([]);
const [loadingDrawings, setLoadingDrawings] = useState(false);

  const [seenOverdueIds, setSeenOverdueIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("seenOverdueTaskIds") || "[]");
    } catch {
      return [];
    }
  });
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
      setAllSites([...set].sort((a, b) => a.localeCompare(b)));
    });
}, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);
  const [empForm, setEmpForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "",
    department: "",
    site_name: "",
    site_names: [],
    status: "Active",
  });
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [mySvrReports, setMySvrReports] = useState([]);
  const [loadingSvrReports, setLoadingSvrReports] = useState(false);
  const [rescheduleFilters, setRescheduleFilters] = useState({
    name: "",
    status: "",
  });
  const [rescheduleMobileFilterOpen, setRescheduleMobileFilterOpen] =
    useState(false);
  const [leaveFilters, setLeaveFilters] = useState({
    name: "",
    dateFrom: "",
    dateTo: "",
  });
  const [leaveMobileFilterOpen, setLeaveMobileFilterOpen] = useState(false);
  const [submissionMobileFilterOpen, setSubmissionMobileFilterOpen] =
    useState(false);
  const [employeeFilters, setEmployeeFilters] = useState({
    name: "",
    site: "",
  });
  const [employeeMobileFilterOpen, setEmployeeMobileFilterOpen] =
    useState(false);

  const [siteFiltersState, setSiteFiltersState] = useState({
    site: "",
    assignedUser: "",
  });
  const [siteMobileFilterOpen, setSiteMobileFilterOpen] = useState(false);

  const fetchAllReportSubmissions = useCallback(async (u) => {
    if (!u || u.role?.toLowerCase().trim() !== "admin") return;
    setLoadingSubmissions(true);

    const [dprRes, svrRes, wprRes] = await Promise.allSettled([
      supabase
        .from("dpr_reports")
        .select("id, site, engineer, report_type, date, pdf_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("site_reports")
        .select("id, site_name, reporter_name, visit_date, pdf_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("wpr_reports")
        .select(
          "id, site_name, engineer_name, created_at, presentation_url, created_at",
        )
        .order("created_at", { ascending: false }),
    ]);

    const dprData =
      dprRes.status === "fulfilled" && !dprRes.value.error
        ? dprRes.value.data
        : [];
    const svrData =
      svrRes.status === "fulfilled" && !svrRes.value.error
        ? svrRes.value.data
        : [];
    const wprData =
      wprRes.status === "fulfilled" && !wprRes.value.error
        ? wprRes.value.data
        : [];

    const normalized = [
      ...(dprData || [])
        .filter((r) => normalizeText(r.report_type) !== "morning")
        .map((r) => ({
          id: `dpr-${r.id}`,
          site: r.site,
          engineer: r.engineer,
          date: r.date,
          created_at: r.created_at,
          pdf_url: r.pdf_url,
          report_type: r.report_type
            ? `DPR (${toTitleCase(r.report_type)})`
            : "DPR",
          source: "dpr",
        })),
      ...(svrData || []).map((r) => ({
        id: `svr-${r.id}`,
        site: r.site_name,
        engineer: r.reporter_name,
        date: r.visit_date,
        created_at: r.created_at,
        pdf_url: r.pdf_url,
        report_type: "SVR",
        source: "svr",
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
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    setAllSubmissions(normalized);
    setLoadingSubmissions(false);
  }, []);

  const fetchMySvrReports = useCallback(async (u) => {
    if (!u) return;
    setLoadingSvrReports(true);
    const { data, error } = await supabase
      .from("site_reports")
      .select(
        "id, site_name, reporter_name, designation, visit_date, visit_time, progress_of_work, quality_observations, safety_concerns, issues_concerns, site_visit_instructions, key_instructions, submitted_by, submitted_by_name, pdf_url, created_at",
      )
      .eq("submitted_by", u.user_name) // ✅ matches what's actually stored
      .order("created_at", { ascending: false });
    if (!error) setMySvrReports(data || []);
    setLoadingSvrReports(false);
  }, []);
  const EMPTY_SITE_FORM = {
    site_name: "",
    user_name: "",
    role: "",
    job_no: "",
    started_date: "",
    client_name: "",
    head_name: "",
    site_image_url: "",
    coordinator_name: "",
    head_contact_no: "",
    coordinator_contact_no: "",
    pc_name: "",
    pc_contact_no: "",
    status: "Active",
    _imageFile: null,
  };
  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [siteForm, setSiteForm] = useState({ ...EMPTY_SITE_FORM });
  const [siteSubmitting, setSiteSubmitting] = useState(false);
  const [uploadingSiteImage, setUploadingSiteImage] = useState(false);

  useEffect(() => {
    if (editingSite) return;
    if (!siteForm.site_name.trim()) return;
    setSiteForm((p) => ({ ...p, job_no: generateJobNo(p.site_name, sites) }));
  }, [siteForm.site_name, sites, editingSite]);

  const regenerateJobNo = () => {
    setSiteForm((p) => ({ ...p, job_no: generateJobNo(p.site_name, sites) }));
  };

  const [allTasks, setAllTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [allLeaves, setAllLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [updatingLeaveId, setUpdatingLeaveId] = useState(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  //Report submission
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionFilters, setSubmissionFilters] = useState({
    site: "",
    engineer: "",
    reportType: "",
    dateFrom: "",
    dateTo: "",
  });
  const [misMonth, setMisMonth] = useState(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});
const [misWeekPill, setMisWeekPill] = useState("all");
const [misDepartment, setMisDepartment] = useState("");
const [misTaskType, setMisTaskType] = useState("all");
const [misSort, setMisSort] = useState("name_asc");
const [misReportMonth, setMisReportMonth] = useState(null);
const [misGenerating, setMisGenerating] = useState(false);
const [dailyReportMode, setDailyReportMode] = useState("single"); // 'single' | 'range'
const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().split("T")[0]);
const [dailyReportFrom, setDailyReportFrom] = useState("");
const [dailyReportTo, setDailyReportTo] = useState("");
const [dailyReportRows, setDailyReportRows] = useState(null); // null = not generated yet
const [dailyReportRemarks, setDailyReportRemarks] = useState({}); // { [taskId]: remarkText }
  const [delayRange, setDelayRange] = useState("this_month");
const [delayEmployee, setDelayEmployee] = useState("");
const [delayReportRows, setDelayReportRows] = useState(null); // null = not generated yet
const [delayReportMeta, setDelayReportMeta] = useState(null);
  const [visibleTaskCount, setVisibleTaskCount] = useState(30);
  const [visibleOverdueCount, setVisibleOverdueCount] = useState(30);
  const [visiblePendingVerificationCount, setVisiblePendingVerificationCount] =
    useState(30);
  const [
    visibleResolvedVerificationCount,
    setVisibleResolvedVerificationCount,
  ] = useState(30);
  // Task filters
  const [taskFilters, setTaskFilters] = useState({ ...EMPTY_TASK_FILTERS });
  const total = allTasks.length;
  const roleByName = employees.reduce(
    (map, e) => ({ ...map, [e.name]: e.role }),
    {},
  );
  const filteredEmployees = employees
    .filter((emp) => {
      if (employeeFilters.name && emp.name !== employeeFilters.name)
        return false;
      if (employeeFilters.site) {
        const empSites = emp.site_names?.length
          ? emp.site_names
          : emp.site_name
            ? [emp.site_name]
            : [];
        if (!empSites.includes(employeeFilters.site)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

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

  const filteredReschedules = allReschedules.filter((r) => {
    if (
      rescheduleFilters.name &&
      nameFor(userMap, r.requested_by) !== rescheduleFilters.name
    )
      return false;
    if (rescheduleFilters.status && r.status !== rescheduleFilters.status)
      return false;
    return true;
  });
  const filteredLeaves = allLeaves.filter((l) => {
    if (leaveFilters.name && (l.name || l.user_name) !== leaveFilters.name)
      return false;
    if (leaveFilters.dateTo && l.from_date && l.from_date > leaveFilters.dateTo)
      return false;
    if (leaveFilters.dateFrom && l.to_date && l.to_date < leaveFilters.dateFrom)
      return false;
    return true;
  });
  const filteredSites = sites
    .filter((site) => {
      if (siteFiltersState.site && site.site_name !== siteFiltersState.site)
        return false;
      if (
        siteFiltersState.assignedUser &&
        site.user_name !== siteFiltersState.assignedUser
      )
        return false;
      return true;
    })
    .sort((a, b) => (a.site_name || "").localeCompare(b.site_name || ""));
  const assignableEmployees = employees;
  const EMPTY_RECURRING_FILTERS = {
    dueSoon: false,
    site: "",
    assignedTo: "",
    recurrence: "",
  };
  const [visibleRecurringCount, setVisibleRecurringCount] = useState(30);
  const [recurringFilters, setRecurringFilters] = useState({
    ...EMPTY_RECURRING_FILTERS,
  });
  const [verificationDetail, setVerificationDetail] = useState(null);
  const [resolvedFilterTab, setResolvedFilterTab] = useState("all");
  const [detailTask, setDetailTask] = useState(null);
  useEffect(() => {
    const s = localStorage.getItem("user");
    if (!s) return;
    const parsed = JSON.parse(s);
    setUser(parsed);

    supabase
      .from("user_details")
      .select(
        "username, site_name, site_names, department, role, can_add_task, can_add_site, can_add_employee, can_resolve_tickets, can_verify, is_mis_executive, can_switch_office_site, can_switch_office_mdo",
      )
      .eq("username", parsed.user_name)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const updated = {
          ...parsed,
          site_name: data.site_name ?? parsed.site_name,
          site_names: data.site_names ?? (parsed.site_name ? [parsed.site_name] : []),
          department: data.department ?? parsed.department,
          role: data.role ?? parsed.role,
          ...pickPermissionFields(data),
        };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));

        // Permission-only users: land on first allowed section, not full dashboard.
        if (!isAdminUser(updated)) {
          const allowed = getAllowedKeys(updated, "admin");
          if (allowed.length && !allowed.includes("dashboard")) {
            setActiveTab(allowed[0]);
          }
        }
      });
  }, []);
  const fetchPendingVerifications = useCallback(async () => {
    setLoadingVerifications(true);
    const { data, error } = await supabase
      .from("task_verifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setPendingVerifications(data || []);
    setLoadingVerifications(false);
  }, []);
  const fetchAllTasks = useCallback(async () => {
  setLoadingTasks(true);
  try {
    const [oneTimeRes, instancesRes, templatesRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("recurring_task_instances").select("*").order("created_at", { ascending: false }),
      supabase.from("recurring_tasks").select("*").order("created_at", { ascending: false }),
    ]);

    const oneTime = (oneTimeRes.data || []).map((t) => ({ ...t, _source: "task" }));
    const instances = (instancesRes.data || []).map((t) => ({
      ...t,
      _source: "instance",
      is_recurring: true, // keeps existing pills/badges ("instance" chip, recurrence icon) working unchanged
    }));
    const templates = (templatesRes.data || []).map((t) => ({ ...t, _source: "template" }));

    setAllTasks([...oneTime, ...instances]);
    setRecurringTemplates(templates);
  } catch (err) {
    showToast("error", "Failed to load tasks: " + err.message);
  }
  setLoadingTasks(false);
}, []);
  useEffect(() => {
    setVisibleTaskCount(30);
  }, [taskFilters, showRecurringInAllTasks]);

  useEffect(() => {
    setVisibleRecurringCount(30);
  }, [recurringFilters]);

  useEffect(() => {
    setVisibleResolvedVerificationCount(30);
  }, [resolvedFilterTab]);

  const fetchAllTickets = useCallback(async () => {
    setLoadingTickets(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setAllTickets(data || []);
    setLoadingTickets(false);
  }, []);
  const fetchAllReschedules = useCallback(async () => {
    setLoadingReschedules(true);
    const { data } = await supabase
      .from("reschedule_requests")
      .select("*, tasks(title, site_name)")
      .is("verify_with", null) // ← only requests with no specific verifier
      .order("created_at", { ascending: false });
    setAllReschedules(data || []);
    setLoadingReschedules(false);
  }, []);

  const fetchAllLeaves = useCallback(async () => {
    setLoadingLeaves(true);
    const { data, error } = await supabase
      .from("leaves")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      showToast("error", "Failed to load leaves. " + error.message);
    } else {
      const leaves = data || [];
      const userNames = [
        ...new Set(leaves.map((l) => l.user_name).filter(Boolean)),
      ];
      let siteNames = [
        ...new Set(leaves.map((l) => l.site_name).filter(Boolean)),
      ];
      let usersByName = {};
      let headsBySite = {};

      if (userNames.length) {
        const { data: users } = await supabase
          .from("user_details")
          .select("username, role, site_name")
          .in("username", userNames);
        usersByName = (users || []).reduce(
          (map, item) => ({ ...map, [item.username]: item }),
          {},
        );
        siteNames = [
          ...new Set([
            ...siteNames,
            ...(users || []).map((u) => u.site_name).filter(Boolean),
          ]),
        ];
      }
      if (siteNames.length) {
        const { data: heads } = await supabase
          .from("site_details")
          .select("site_name, user_name, role")
          .in("site_name", siteNames)
          .eq("role", "Project Head");
        headsBySite = (heads || []).reduce(
          (map, item) => ({
            ...map,
            [item.site_name]: [...(map[item.site_name] || []), item.user_name],
          }),
          {},
        );
      }

      setAllLeaves(
        leaves.map((leave) => ({
          ...leave,
          role: leave.role || usersByName[leave.user_name]?.role || "",
          site_name:
            leave.site_name || usersByName[leave.user_name]?.site_name || "",
          head_user_names:
            headsBySite[
              leave.site_name || usersByName[leave.user_name]?.site_name
            ]?.join(", ") || "",
        })),
      );
    }
    setLoadingLeaves(false);
  }, []);
  const headEmployees = employees.filter(
    (e) => normalizeText(e.role) === "project head",
  );
  const inchargeEmployees = employees.filter(
    (e) => normalizeText(e.role) === "site incharge",
  );
  const pcEmployees = employees.filter(
    (e) => normalizeText(e.role) === "process controller",
  );
  const fetchSites = useCallback(async () => {
    setLoadingSites(true);
    const { data } = await supabase
      .from("site_details")
      .select("*")
      .order("created_at", { ascending: false });
    setSites(data || []);
    setLoadingSites(false);
  }, []);

  const handleSiteFormChange = (e) => {
    const { name, value } = e.target;
    setSiteForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "user_name") {
        const match = employees.find((emp) => emp.username === value);
        if (match?.role) next.role = match.role;
      }
      return next;
    });
  };

  const handleSiteSubmit = async () => {
    if (!siteForm.site_name.trim())
      return showToast("error", "Site name is required.");

    setSiteSubmitting(true);

    let site_image_url = siteForm.site_image_url || null;
    if (siteForm._imageFile) {
      try {
        setUploadingSiteImage(true);
        site_image_url = await uploadSiteImage(
          supabase,
          siteForm.site_name,
          siteForm._imageFile,
        );
      } catch (err) {
        setUploadingSiteImage(false);
        setSiteSubmitting(false);
        return showToast("error", err.message);
      }
      setUploadingSiteImage(false);
    }

    const payload = {
      site_name: siteForm.site_name.trim(),
      user_name: siteForm.user_name || null,
      role: siteForm.role.trim() || null,
      job_no: siteForm.job_no.trim() || null,
      started_date: siteForm.started_date || null,
      client_name: siteForm.client_name.trim() || null,
      head_name: siteForm.head_name.trim() || null,
      site_image_url,
      coordinator_name: siteForm.coordinator_name.trim() || null,
      head_contact_no: siteForm.head_contact_no.trim() || null,
      coordinator_contact_no: siteForm.coordinator_contact_no.trim() || null,
      pc_name: siteForm.pc_name.trim() || null,
      pc_contact_no: siteForm.pc_contact_no.trim() || null,
      status: toTitleCase(siteForm.status) || "Active",
    };

    if (editingSite) {
      const { error } = await supabase
        .from("site_details")
        .update(payload)
        .eq("id", editingSite.id);
      setSiteSubmitting(false);
      if (error)
        return showToast("error", "Failed to update site. " + error.message);

      if (payload.user_name) {
        const syncResult = await syncUserSiteNames(
          supabase,
          payload.user_name,
          payload.site_name,
        );
        if (!syncResult.ok) {
          showToast(
            "error",
            "Site saved, but failed to sync user's site list: " +
              syncResult.reason,
          );
        }
      }

      showToast("success", "Site updated successfully!");
    } else {
      const { error } = await supabase.from("site_details").insert([payload]);
      setSiteSubmitting(false);
      await syncAllSiteUsers(supabase, payload, employees, (msg) =>
        showToast("error", msg),
      );

      showToast("success", "Site updated successfully!");
    }
    setSiteForm({ ...EMPTY_SITE_FORM });
    setEditingSite(null);
    fetchSites();
    fetchEmployees();
    setActiveTab("manage-sites");
  };

  const handleSiteEdit = (site) => {
    setEditingSite(site);
    setSiteForm({
      _imageFile: null,
      site_name: site.site_name || "",
      user_name: site.user_name || "",
      role: site.role || "",
      job_no: site.job_no || "",
      started_date: site.started_date || "",
      client_name: site.client_name || "",
      head_name: site.head_name || "",
      site_image_url: site.site_image_url || "",
      coordinator_name: site.coordinator_name || "",
      head_contact_no: site.head_contact_no || "",
      coordinator_contact_no: site.coordinator_contact_no || "",
      pc_name: site.pc_name || "",
      pc_contact_no: site.pc_contact_no || "",
      status: site.status || "Active",
    });
    setActiveTab("add-site");
  };

  const handleSiteDelete = async (id) => {
    if (!window.confirm("Delete this site?")) return;
    const site = sites.find((s) => s.id === id);
    await supabase.from("site_details").delete().eq("id", id);
    if (site?.user_name) {
      await removeSiteFromUser(supabase, site.user_name, site.site_name);
    }
    setSites((p) => p.filter((s) => s.id !== id));
    fetchEmployees();
    showToast("success", "Site deleted.");
  };

  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    const { data } = await supabase
      .from("user_details") // ← must be "users" not "user_details"
      .select("*")
      .order("name", { ascending: true });
    setEmployees(data || []);
    setLoadingEmployees(false);
  }, []);

  const handleEmpFormChange = (e) => {
    const { name, value } = e.target;
    setEmpForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmpSubmit = async () => {
    if (
      !empForm.name.trim() ||
      !empForm.username.trim() ||
      !empForm.password.trim() ||
      !empForm.role.trim() ||
      !empForm.department.trim()
    )
      return showToast("error", "Please fill all required fields.");
    setEmpSubmitting(true);

    if (editingEmployee) {
      const { error } = await supabase
        .from("user_details")
        .update({
          name: empForm.name.trim(),
          username: empForm.username.trim(),
          password: empForm.password.trim(),
          role: empForm.role.trim(),
          department: toTitleCase(empForm.department),
          site_name: empForm.site_names[0] || empForm.site_name.trim() || null,
          site_names: empForm.site_names.length ? empForm.site_names : null,
          status: toTitleCase(empForm.status) || "Active",
        })
        .eq("id", editingEmployee.id);
      setEmpSubmitting(false);
      if (error)
        return showToast("error", "Failed to update. " + error.message);
      showToast("success", "Employee updated successfully!");
    } else {
      const { error } = await supabase.from("user_details").insert([
        {
          name: empForm.name.trim(),
          username: empForm.username.trim(),
          password: empForm.password.trim(),
          role: empForm.role.trim(),
          department: toTitleCase(empForm.department),
          site_name: empForm.site_names[0] || empForm.site_name.trim() || null,
          site_names: empForm.site_names.length ? empForm.site_names : null,
          status: toTitleCase(empForm.status) || "Active",
        },
      ]);
      setEmpSubmitting(false);
      if (error) return showToast("error", "Failed to save. " + error.message);
      showToast("success", "Employee added successfully!");
    }

    setEmpForm({
      name: "",
      username: "",
      password: "",
      role: "",
      department: "",
      site_name: "",
      status: "Active",
    });
    setEditingEmployee(null);
    fetchEmployees();
    setActiveTab("manage-employees");
  };

  const handleEmpEdit = (emp) => {
    setEditingEmployee(emp);
    setEmpForm({
      name: emp.name || "",
      username: emp.username || "",
      password: emp.password || "",
      role: emp.role || "",
      department: emp.department || "",
      site_name: emp.site_name || "",
      site_names: emp.site_names || (emp.site_name ? [emp.site_name] : []),
      status: emp.status || "Active",
    });
    setActiveTab("add-employee");
  };

  const handleEmpDelete = async (id) => {
    if (!window.confirm("Delete this employee?")) return;
    const { error } = await supabase.from("user_details").delete().eq("id", id);
    if (error) {
      showToast("error", "Failed to delete employee. " + error.message);
      return;
    }
    setEmployees((p) => p.filter((e) => e.id !== id));
    showToast("success", "Employee deleted.");
  };

  useEffect(() => {
    if (user) {
      fetchAllTasks();
      fetchAllLeaves();
      fetchEmployees();
      fetchAllReschedules();
      fetchSites();
      fetchMySvrReports(user);
      fetchAllReportSubmissions(user);
      fetchAllTickets();
      fetchPendingVerifications(); // ← add
    }
  }, [
    user,
    fetchAllTasks,
    fetchAllLeaves,
    fetchEmployees,
    fetchAllReschedules,
    fetchSites,
    fetchMySvrReports,
    fetchAllReportSubmissions,
    fetchAllTickets,
    fetchPendingVerifications, // ← add
  ]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("admin-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchAllTasks(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaves" },
        () => fetchAllLeaves(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reschedule_requests" },
        () => fetchAllReschedules(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_verifications" },
        () => fetchPendingVerifications(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => fetchAllTickets(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_details" },
        () => fetchEmployees(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_details" },
        () => fetchSites(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_tasks" }, () => fetchAllTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_task_instances" }, () => fetchAllTasks())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [
    user,
    fetchAllTasks,
    fetchAllLeaves,
    fetchAllReschedules,
    fetchPendingVerifications,
    fetchAllTickets,
    fetchEmployees,
    fetchSites,
  ]);
  useRecurringTasks(user, fetchAllTasks);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

const handleNavClick = (key) => {
    setActiveTab(key);

    switch (key) {
      case "dashboard":
        fetchAllTasks();
        fetchAllLeaves();
        break;
      case "assign-task":
        fetchEmployees();
        fetchSites();
        break;
      case "all-tasks":
        fetchAllTasks();
        fetchPendingVerifications();
        break;
      case "recurring-tasks":
        fetchAllTasks();
        break;
      case "leave-requests":
        fetchAllLeaves();
        break;
      case "reschedule-requests":
        fetchAllReschedules();
        break;
      case "add-employee":
      case "manage-employees":
        fetchEmployees();
        break;
      case "org-hierarchy":
        fetchEmployees();
        break;
      case "permissions":
        fetchEmployees();
        break;
      case "add-site":
      case "manage-sites":
        fetchSites();
        fetchEmployees();
        break;
      case "site-report":
        break;
      case "my-reports":
        fetchMySvrReports(user);
        break;
      case "report-submissions":
        fetchAllReportSubmissions(user);
        break;
      case "new-tickets":
      case "solved-ticket":
        fetchAllTickets();
        break;
      case "pending-verification":
        fetchPendingVerifications();
        fetchAllTasks();
        setVisiblePendingVerificationCount(20);
        break;
      case "add-drawings":
        fetchSites();
        break;
      case "all-drawings":
        fetchDrawings();
        break;
      case "rejected-tasks":
        fetchAllTasks();
        break;
        case "mis-report":
          fetchAllTasks();
          fetchEmployees();
          break;
        case "overdue-tasks": {
          fetchAllTasks();
          const ids = overdueTasks.map((t) => t.id);
          setSeenOverdueIds(ids);
          localStorage.setItem("seenOverdueTaskIds", JSON.stringify(ids));
          setVisibleOverdueCount(20);
          break;
        }
        case "daily-report":
          fetchAllTasks();
          fetchEmployees();
        break;
      default:
        break;
    }

    if (key === "add-employee") {
      setEditingEmployee(null);
      setEmpForm({
        name: "",
        username: "",
        password: "",
        role: "",
        department: "",
        site_name: "",
        site_names: [],
        status: "active",
      });
    }
    if (key === "add-site") {
      setEditingSite(null);
      setSiteForm({ ...EMPTY_SITE_FORM });
    }
    if (typeof window !== "undefined" && window.innerWidth <= 760)
      setSidebarOpen(false);
  };

const handleFormChange = (e) => {
  const { name, value, type, checked } = e.target;
  setForm((prev) => ({
    ...prev,
    [name]: type === "checkbox" ? checked : value,
    ...(name === "is_recurring" && !checked ? { recurrence: "" } : {}),
    ...(name === "is_recurring" && checked
      ? { _queueMode: null, _queueTargetTaskId: null, _queueRescheduleDate: "" }
      : {}),
  }));
};

const fetchDrawings = useCallback(async () => {
  setLoadingDrawings(true);
  const { data, error } = await supabase
    .from("drawings")
    .select("*")
    .order("date", { ascending: false });
  if (!error) setAllDrawings(data || []);
  setLoadingDrawings(false);
}, []);
function getRangeDates(rangeKey) {
  const now = new Date();
  if (rangeKey === "this_month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
  if (rangeKey === "last_month") {
    return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
  }
  return { from: new Date(now.getTime() - 30 * 86400000), to: now };
}
const handleGenerateMisReport = async () => {
  setMisGenerating(true);
  await fetchAllTasks();
  await fetchEmployees();
  setMisReportMonth(misMonth);
  setMisWeekPill("all");
  setMisGenerating(false);
};

const handleExportMisCsv = () => {
  if (!misReportMonth) return showToast("error", "Generate the report first.");
  const lines = [[
    "Week", "Employee", "Username", "Department", "Total", "Done",
    "On-Time", "On-Time %", "Delayed Done", "Delayed", "Pending", "N/A", "Open %",
  ].join(",")];

  misVisibleWeeks.forEach((wd) => {
    wd.rows.forEach((r) => {
      lines.push([
        `"${wd.week.label} (${formatWeekRange(wd.week)})"`,
        `"${r.name}"`,
        r.username,
        `"${r.department || ""}"`,
        r.total, r.done, r.onTime,
        r.onTimePct != null ? r.onTimePct.toFixed(2) : "",
        r.delayedDone, r.delayed, r.pending, r.na,
        r.openPct.toFixed(2),
      ].join(","));
    });
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mis-report-${misReportMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleGenerateDelayReport = () => {
  const { from, to } = getRangeDates(delayRange);
  const inRange = allTasks.filter((t) => {
    if (!t.created_at) return false;
    const created = new Date(t.created_at);
    if (created < from || created > to) return false;
    if (delayEmployee && t.assigned_to !== delayEmployee) return false;
    return true;
  });
  const rows = inRange
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((t, i) => buildDelayRow(t, i, userMap));

  const delayed = rows.filter((r) => r.statusLabel === "Delayed").length;
  const onTime = rows.filter((r) => r.statusLabel === "On Time").length;
  const na = rows.filter((r) => r.statusLabel === "N/A").length;

  setDelayReportRows(rows);
  setDelayReportMeta({ from, to, total: rows.length, delayed, onTime, na });
};

const handleGenerateDailyReport = () => {
  const from = dailyReportMode === "single" ? dailyReportDate : dailyReportFrom;
  const to = dailyReportMode === "single" ? dailyReportDate : dailyReportTo;
  if (!from || !to) {
    return showToast("error", `Please select a date${dailyReportMode === "range" ? " range" : ""}.`);
  }
  const rows = buildDailyReportRows(allTasks, from, to, userMap);
  setDailyReportRows(rows);
};

const handleDailyReportPdf = () => {
  if (!dailyReportRows) return showToast("error", "Generate the report first.");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const label =
    dailyReportMode === "single"
      ? new Date(dailyReportDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : `${toDateStr(new Date(dailyReportFrom))} → ${toDateStr(new Date(dailyReportTo))}`;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Daily Task Report", margin, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(label, margin, 48);

  autoTable(doc, {
    startY: 84,
    margin: { left: margin, right: margin },
    head: [["SR", "Prev. Date", "Target Date", "Task", "Site", "Assignee", "Status", "Remarks"]],
    body: dailyReportRows.map((r) => [
      r.sr,
      formatSubmissionDate(r.prevDate),
      formatSubmissionDate(r.targetDate),
      r.description ? `${r.title} — ${r.description}` : r.title,
      r.siteName || "—",
      r.assignee,
      r.delayLabel,
      dailyReportRemarks[r.id] || "",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [51, 65, 85] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 180 },
      6: { cellWidth: 70, fontStyle: "bold" },
    },
  });

  doc.save(`daily-report-${dailyReportMode === "single" ? dailyReportDate : `${dailyReportFrom}_to_${dailyReportTo}`}.pdf`);
};

const handleDelayReportPdf = () => {
  if (!delayReportRows || !delayReportMeta) {
    return showToast("error", "Generate the report first.");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const s = delayReportMeta;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── Header band ──────────────────────────────────────────────
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 64, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Task Delay Report", margin, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `${toDateStr(s.from)}  →  ${toDateStr(s.to)}`,
    margin,
    48,
  );

  const generatedLabel = `Generated ${new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  doc.setFontSize(8.5);
  doc.text(generatedLabel, pageWidth - margin, 48, { align: "right" });

  // ── Summary stat chips ───────────────────────────────────────
  const chips = [
    { label: "Total Tasks", value: s.total, color: [37, 99, 235] },
    { label: "Delayed", value: s.delayed, color: [220, 38, 38] },
    { label: "On Time", value: s.onTime, color: [22, 163, 74] },
    { label: "N/A", value: s.na, color: [100, 116, 139] },
  ];
  const chipW = 130;
  const chipH = 34;
  const chipGap = 12;
  let chipX = margin;
  const chipY = 78;

  chips.forEach((c) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(chipX, chipY, chipW, chipH, 4, 4, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(c.label.toUpperCase(), chipX + 10, chipY + 13);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(String(c.value), chipX + 10, chipY + 27);

    chipX += chipW + chipGap;
  });

  // ── Table ────────────────────────────────────────────────────
  const statusColors = {
    Delayed: [220, 38, 38],
    "On Time": [22, 163, 74],
    "N/A": [148, 163, 184],
  };

  autoTable(doc, {
    startY: chipY + chipH + 20,
    margin: { left: margin, right: margin },
    head: [[
      "SR", "Employee", "Project", "Assigned",
      "Accepted", "Hrs", "Hold/Resume",
      "Total Hold", "Due", "Submitted", "Status", "Delay",
    ]],
    body: delayReportRows.map((r) => [
      r.sr,
      r.employee,
      r.project,
      fmtDT(r.assignedAt),
      fmtDT(r.acceptedAt),
      r.hoursToComplete ? `+${r.hoursToComplete}h` : "—",
      r.holdResume,
      r.totalHold,
      fmtDT(r.dueDateTime),
      r.submittedAt ? fmtDT(r.submittedAt) : "Pending",
      r.statusLabel,
      r.delayLabel,
    ]),
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      valign: "middle",
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26, halign: "center", fontStyle: "bold", textColor: [37, 99, 235] },
      1: { cellWidth: 78, fontStyle: "bold" },
      2: { cellWidth: 78 },
      3: { cellWidth: 68 },
      4: { cellWidth: 68 },
      5: { cellWidth: 34, halign: "center" },
      6: { cellWidth: 54 },
      7: { cellWidth: 48, halign: "center" },
      8: { cellWidth: 68 },
      9: { cellWidth: 78 },
      10: { cellWidth: 52, halign: "center", fontStyle: "bold" },
      11: { cellWidth: 66 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 10) {
        const color = statusColors[data.cell.raw];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = "bold";
        }
      }
      if (data.section === "body" && data.column.index === 9 && data.cell.raw === "Pending") {
        data.cell.styles.textColor = [37, 99, 235];
        data.cell.styles.fontStyle = "italic";
      }
    },
    didDrawPage: (data) => {
      // Footer: page number + branding
      const pageCount = doc.internal.getNumberOfPages();
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${pageNum} of ${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" },
      );
      doc.text(
        "Task Delay Report",
        margin,
        doc.internal.pageSize.getHeight() - 16,
      );
    },
  });

  const rangeLabel = delayRange.replace(/_/g, "-");
  doc.save(`task-delay-report-${rangeLabel}-${toDateStr(new Date())}.pdf`);
};

const handleSendDelayWA = () => {
  showToast("error", "WhatsApp sending isn't configured yet — connect a WhatsApp API integration to enable this.");
};
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
    fetchDrawings();
    setActiveTab("all-drawings");
  } catch (err) {
    showToast("error", err.message);
  }
  setDrawingSubmitting(false);
};

  const handleSubmit = async () => {
    if (!form.title.trim()) return showToast("error", "Title is required.");
    if (!form.assigned_to.trim())
      return showToast("error", "Assigned To is required.");
    if (form.is_recurring && !form.recurrence)
      return showToast("error", "Please select a recurrence Schedule.");

    const anchor = form.is_recurring ? buildAnchor(form) : null;
    const computedDueDate = form.is_recurring
      ? getNextDueDate(null, form.recurrence) // ← fixed: returns a date string directly
      : form.due_date || null;
    setSubmitting(true);

    // Upload audio if provided
    let audio_url = null;
    if (form._audioFile) {
      const ext = form._audioFile.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("task-audio")
        .upload(path, form._audioFile);
      if (upErr) {
        setSubmitting(false);
        return showToast("error", "Audio upload failed: " + upErr.message);
      }
      const { data: urlData } = supabase.storage
        .from("task-audio")
        .getPublicUrl(path);
      audio_url = urlData.publicUrl;
    }

    // Upload document if provided
    let document_url = null;
    if (form._docFile) {
      const ext = form._docFile.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("task-documents")
        .upload(path, form._docFile);
      if (upErr) {
        setSubmitting(false);
        return showToast("error", "Document upload failed: " + upErr.message);
      }
      const { data: urlData } = supabase.storage
        .from("task-documents")
        .getPublicUrl(path);
      document_url = urlData.publicUrl;
    }

if (form.is_recurring) {
  if (!form.recurrence) {
    setSubmitting(false);
    return showToast("error", "Please select a recurrence Schedule.");
  }
  const firstDueDate = getNextDueDate(null, form.recurrence);

  const templatePayload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    assigned_to: form.assigned_to.trim(),
    assigned_by: user.user_name,
    site_name: form.site_name.trim() || null,
    priority: form.priority,
    recurrence: form.recurrence,
    recurrence_anchor: anchor,
    audio_url,
    document_url,
    has_checkpoints: !!form.enable_checkpoints,
    reschedule_allowed: form.reschedule_allowed || false,
    hours_to_complete: form.hours_to_complete ? parseFloat(form.hours_to_complete) : null,
    due_date: firstDueDate,
    is_active: true,
  };

  // ── editing an existing template ──
  if (editingTaskId && editingTaskType === "template") {
    const patch = { ...templatePayload };
    if (!audio_url) delete patch.audio_url;       // don't clobber an existing file if none re-uploaded
    if (!document_url) delete patch.document_url;
    const { error } = await supabase.from("recurring_tasks").update(patch).eq("id", editingTaskId);
    setSubmitting(false);
    if (error) { showToast("error", "Failed to update recurring task. " + error.message); return false; }
    showToast("success", `Recurring task "${form.title}" updated!`);
    fetchAllTasks();
    setEditingTaskId(null);
    setEditingTaskType(null);
    return true;
  }

  // ── editing an existing instance (title/desc/priority/due date/hours only — not the schedule) ──
  if (editingTaskId && editingTaskType === "instance") {
    const instancePatch = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date || null,
      reschedule_allowed: form.reschedule_allowed || false,
      hours_to_complete: form.hours_to_complete ? parseFloat(form.hours_to_complete) : null,
    };
    if (audio_url) instancePatch.audio_url = audio_url;
    if (document_url) instancePatch.document_url = document_url;
    const { error } = await supabase.from("recurring_task_instances").update(instancePatch).eq("id", editingTaskId);
    setSubmitting(false);
    if (error) { showToast("error", "Failed to update task instance. " + error.message); return false; }
    showToast("success", `Task "${form.title}" updated!`);
    fetchAllTasks();
    setEditingTaskId(null);
    setEditingTaskType(null);
    return true;
  }

  // ── creating a new recurring template ──
  const { data: insertedTemplate, error } = await supabase
    .from("recurring_tasks")
    .insert([templatePayload])
    .select()
    .single();
  setSubmitting(false);
  if (error) { showToast("error", "Failed to create recurring task. " + error.message); return false; }

  // Spawn the first instance immediately so there's something actionable
  // right away rather than waiting for the next scheduled trigger day.
  const { error: instErr } = await supabase.from("recurring_task_instances").insert([
    {
      recurring_task_id: insertedTemplate.id,
      title: insertedTemplate.title,
      description: insertedTemplate.description,
      assigned_to: insertedTemplate.assigned_to,
      assigned_by: insertedTemplate.assigned_by,
      site_name: insertedTemplate.site_name,
      priority: insertedTemplate.priority,
      status: "pending",
      due_date: firstDueDate,
      audio_url: insertedTemplate.audio_url,
      document_url: insertedTemplate.document_url,
      has_checkpoints: insertedTemplate.has_checkpoints,
      reschedule_allowed: insertedTemplate.reschedule_allowed,
      hours_to_complete: insertedTemplate.hours_to_complete,
    },
  ]);
  if (!instErr) {
    await supabase
      .from("recurring_tasks")
      .update({ last_generated_date: firstDueDate })
      .eq("id", insertedTemplate.id);
  } else {
    showToast("error", "Recurring task created, but the first instance failed to generate: " + instErr.message);
  }

  const desc = anchorDescription(form.recurrence, anchor);
  showToast("success", `Recurring task "${form.title}" created${desc ? ` — repeats ${desc}` : ""}!`);
  fetchAllTasks();
  return true;
}

// ── one-time task: unchanged, still writes to `tasks` ──────────────────
const basePayload = {
  title: form.title.trim(),
  description: form.description.trim() || null,
  assigned_to: form.assigned_to.trim(),
  site_name: form.site_name.trim() || null,
  priority: form.priority,
  status: form.status,
  due_date: computedDueDate,
  reschedule_allowed: form.reschedule_allowed || false,
  hours_to_complete: form.hours_to_complete ? parseFloat(form.hours_to_complete) : null,
};

if (editingTaskId && editingTaskType !== "template" && editingTaskType !== "instance") {
  const editPayload = { ...basePayload };
  if (audio_url) editPayload.audio_url = audio_url;
  if (document_url) editPayload.document_url = document_url;

  const { error } = await supabase.from("tasks").update(editPayload).eq("id", editingTaskId);
  setSubmitting(false);
  if (error) { showToast("error", "Failed to update task. " + error.message); return false; }
  showToast("success", `Task "${form.title}" updated!`);
  fetchAllTasks();
  setEditingTaskId(null);
  setEditingTaskType(null);
  return true;
}

const payload = { ...basePayload, assigned_by: user.user_name, audio_url, document_url };

const { data: insertedTask, error } = await supabase.from("tasks").insert([payload]).select("id").single();
setSubmitting(false);
if (error) { showToast("error", "Failed to assign task. " + error.message); return false; }

if (form.enable_checkpoints) {
  await supabase.from("tasks").update({ has_checkpoints: true }).eq("id", insertedTask.id);
}

// Queue handling stays exactly as-is — only applies to `tasks` rows,
// since `queued_after_task_id` only exists on that table.
if (form._queueMode === "continue_after" && form._queueTargetTaskId) {
  await supabase.from("tasks").update({ queued_after_task_id: form._queueTargetTaskId }).eq("id", insertedTask.id);
} else if (form._queueMode === "pause_and_prioritize" && form._queueTargetTaskId) {
  const targetId = form._queueTargetTaskId;
  const { data: targetTask } = await supabase
    .from("tasks")
    .select("accepted_at, resumed_at, accumulated_seconds, is_held")
    .eq("id", targetId)
    .single();
  if (targetTask) {
    const nowIso = new Date().toISOString();
    const lastStart = targetTask.resumed_at || targetTask.accepted_at;
    const elapsed = lastStart && !targetTask.is_held
      ? Math.floor((new Date(nowIso) - new Date(lastStart)) / 1000)
      : 0;
    const newAccumulated = (targetTask.accumulated_seconds || 0) + Math.max(elapsed, 0);
    await supabase.from("tasks").update({
      is_held: true,
      hold_started_at: nowIso,
      accumulated_seconds: newAccumulated,
      ...(form._queueRescheduleDate ? { due_date: form._queueRescheduleDate } : {}),
    }).eq("id", targetId);
  }
  const startIso = new Date().toISOString();
  await supabase.from("tasks").update({ accepted_at: startIso, resumed_at: startIso, is_held: false }).eq("id", insertedTask.id);
}

showToast("success", `Task "${form.title}" assigned!`);
fetchAllTasks();
return true;
  };
  const handleOverdueRejectConfirm = async () => {
    if (!overdueRejectModal) return;
    const { task, note } = overdueRejectModal;
    setUpdatingRejectId(task.id);
    setUpdatingRejectId(null);
    showToast(
      "success",
      `"${task.title}" — no extension granted. Original due date stands.`,
    );
    setOverdueRejectModal(null);
  };
  const handleOverdueRescheduleSubmit = async () => {
    if (!overdueRescheduleModal?.newDate)
      return showToast("error", "Please pick a new due date.");
    const { task, newDate } = overdueRescheduleModal;
    setUpdatingOverdueId(task.id);
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: newDate })
      .eq("id", task.id);
    setUpdatingOverdueId(null);
    if (error)
      return showToast("error", "Failed to reschedule: " + error.message);
    setAllTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, due_date: newDate } : t)),
    );
    showToast(
      "success",
      `Due date updated to ${new Date(newDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
    );
    setOverdueRescheduleModal(null);
  };

const handleMarkTaskDone = async (task) => {
  setUpdatingMarkDoneId(task.id);
  const table = task._source === "instance" ? "recurring_task_instances" : "tasks";
  const { error } = await supabase.from(table).update({ status: "completed" }).eq("id", task.id);
  setUpdatingMarkDoneId(null);
  if (error) return showToast("error", "Failed to mark done: " + error.message);

  if (table === "tasks") {
    await activateQueuedTask(supabase, task.id, userMap, (msg) => showToast("success", msg));
  }
  setAllTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "completed" } : t)));
  showToast("success", `"${task.title}" marked as completed.`);
};

  const openEditTaskModal = (task) => {
  const isTemplateOrInstance = task._source === "template" || task._source === "instance";
  setForm({
    ...EMPTY_FORM,
    title: task.title || "",
    description: task.description || "",
    assigned_to: task.assigned_to || "",
    site_name: task.site_name || "",
    priority: task.priority || "medium",
    status: task.status || "pending",
    due_date: task.due_date || "",
    is_recurring: isTemplateOrInstance,
    recurrence: task.recurrence || "",
    reschedule_allowed: task.reschedule_allowed || false,
    hours_to_complete: task.hours_to_complete || "",
  });
  setEditingTaskId(task.id);
  setEditingTaskType(task._source === "template" ? "template" : task._source === "instance" ? "instance" : "task");
  setShowTaskModal(true);
};

  const openReassignModal = (task) => {
    setReassignModal({ task, newAssignee: task.assigned_to || "" });
  };

const handleReassignSubmit = async () => {
  if (!reassignModal?.newAssignee) return showToast("error", "Please select an employee.");
  const { task, newAssignee } = reassignModal;
  const table = task._source === "instance" ? "recurring_task_instances" : "tasks";
  setUpdatingReassignId(task.id);
  const { error } = await supabase.from(table).update({ assigned_to: newAssignee }).eq("id", task.id);
  setUpdatingReassignId(null);
  if (error) return showToast("error", "Failed to reassign: " + error.message);
  setAllTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, assigned_to: newAssignee } : t)));
  showToast("success", `"${task.title}" reassigned to ${nameFor(userMap, newAssignee)}.`);
  setReassignModal(null);
};

  const openRescheduleTaskModal = (task) => {
    setRescheduleTaskModal({ task, newDate: task.due_date || "" });
  };

const handleRescheduleTaskSubmit = async () => {
  if (!rescheduleTaskModal?.newDate) return showToast("error", "Please pick a new due date.");
  const { task, newDate } = rescheduleTaskModal;
  const table = task._source === "instance" ? "recurring_task_instances" : "tasks";
  setUpdatingRescheduleTaskId(task.id);
  const { error } = await supabase.from(table).update({ due_date: newDate }).eq("id", task.id);
  setUpdatingRescheduleTaskId(null);
  if (error) return showToast("error", "Failed to reschedule: " + error.message);
  setAllTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, due_date: newDate } : t)));
  showToast("success", `Due date updated to ${new Date(newDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`);
  setRescheduleTaskModal(null);
};
  
const handleRejectTask = async (task) => {
  if (!window.confirm(`Reject and remove "${task.title}"?`)) return;
  const table = task._source === "instance" ? "recurring_task_instances" : "tasks";
  await supabase.from(table).delete().eq("id", task.id);
  setAllTasks((p) => p.filter((t) => t.id !== task.id));
  showToast("success", "Task rejected and removed.");
};

const handleClearRejection = async (task) => {
  const table = task._source === "instance" ? "recurring_task_instances" : "tasks";
  const { error } = await supabase.from(table).update({ status: "pending", employee_rejection_reason: null }).eq("id", task.id);
  if (error) return showToast("error", "Failed: " + error.message);
  setAllTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "pending", employee_rejection_reason: null } : t)));
  showToast("success", `"${task.title}" reopened as pending.`);
};

const handleDelete = async (id) => {
  if (!window.confirm("Delete this task?")) return;
  const task = allTasks.find((t) => t.id === id);
  const table = task?._source === "instance" ? "recurring_task_instances" : "tasks";
  await supabase.from(table).delete().eq("id", id);
  setAllTasks((p) => p.filter((t) => t.id !== id));
  showToast("success", "Task deleted.");
};
const handleDeleteTemplate = async (id) => {
  if (!window.confirm("Delete this recurring task? Existing instances remain, but no new ones will be generated.")) return;
  await supabase.from("recurring_tasks").delete().eq("id", id);
  setRecurringTemplates((p) => p.filter((t) => t.id !== id));
  showToast("success", "Recurring task deleted.");
};
  const handleRescheduleAction = async (req, approved) => {
    if (!approved) {
      // Open the reject modal instead of window.prompt
      setRejectModal({ req, reason: "" });
      return;
    }
    // Approve path — unchanged
    setUpdatingRescheduleId(req.id);
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
      fetchAllTasks();
    }
    setUpdatingRescheduleId(null);
    if (error) {
      showToast("error", "Failed to update: " + error.message);
      return;
    }
    setAllReschedules((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, ...payload } : r)),
    );
    showToast("success", "Reschedule approved — task due date updated.");
  };

  // Add this new function for confirming the rejection:
  const handleRejectConfirm = async () => {
    if (!rejectModal.reason.trim()) return; // button is disabled, but guard anyway
    const req = rejectModal.req;
    const reason = rejectModal.reason.trim();
    setRejectModal(null);
    setUpdatingRescheduleId(req.id);
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
    setUpdatingRescheduleId(null);
    if (error) {
      showToast("error", "Failed to reject: " + error.message);
      return;
    }
    setAllReschedules((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, ...payload } : r)),
    );
    showToast("success", "Reschedule rejected.");
  };

  const handleMarkVerificationCompleted = async (verification) => {
    if (verification.verifier !== user.user_name)
      return showToast(
        "error",
        "Only the assigned admin can complete this task.",
      );
    setUpdatingVerificationId(verification.id);
    const payload = {
      status: "completed",
      resolved_by: user.user_name,
      resolved_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("task_verifications")
      .update(payload)
      .eq("id", verification.id);

if (!error && verification.task_id) {
  const task = allTasks.find((t) => t.id === verification.task_id);
  const table = task?._source === "instance" ? "recurring_task_instances" : "tasks";

  await supabase.from(table).update({ status: "completed" }).eq("id", verification.task_id);

  if (table === "tasks") {
    await activateQueuedTask(supabase, verification.task_id, userMap, (msg) => showToast("success", msg));
  }
  // Next-instance generation is no longer triggered from here — the
  // useRecurringTasks hook spawns the next instance on its scheduled
  // trigger day, independent of when the current one gets verified.
  fetchAllTasks();
}

    setUpdatingVerificationId(null);
    if (error)
      return showToast("error", "Failed to mark completed: " + error.message);

    setPendingVerifications((prev) =>
      prev.map((v) => (v.id === verification.id ? { ...v, ...payload } : v)),
    );
    showToast("success", "Task marked as completed.");
  };

  const openCorrectionModal = (verification) => {
    if (verification.verifier !== user.user_name)
      return showToast(
        "error",
        "Only the assigned admin can send a correction.",
      );
    setCorrectionModal({
      verification,
      note: "",
      audioFile: null,
      docFiles: [],
      submitting: false,
    });
  };

  const handleCorrectionSubmit = async () => {
    if (!correctionModal.note.trim())
      return showToast("error", "Please write a correction note.");

    setCorrectionModal((p) => ({ ...p, submitting: true }));

    let audio_url = null;
    if (correctionModal.audioFile) {
      const file = correctionModal.audioFile;
      const path = `${user.user_name}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("task-verification-docs")
        .upload(path, file);
      if (upErr) {
        setCorrectionModal((p) => ({ ...p, submitting: false }));
        return showToast("error", "Audio upload failed: " + upErr.message);
      }
      const { data: pub } = supabase.storage
        .from("task-verification-docs")
        .getPublicUrl(path);
      audio_url = pub?.publicUrl || null;
    }

    const documentUrls = [];
    for (const file of correctionModal.docFiles) {
      const path = `${user.user_name}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("task-verification-docs")
        .upload(path, file);
      if (upErr) {
        setCorrectionModal((p) => ({ ...p, submitting: false }));
        return showToast("error", "Document upload failed: " + upErr.message);
      }
      const { data: pub } = supabase.storage
        .from("task-verification-docs")
        .getPublicUrl(path);
      if (pub?.publicUrl) documentUrls.push(pub.publicUrl);
    }

    const payload = {
      status: "correction_sent",
      correction_note: correctionModal.note.trim(),
      correction_audio_url: audio_url,
      correction_document_urls: documentUrls,
      resolved_by: user.user_name,
      resolved_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("task_verifications")
      .update(payload)
      .eq("id", correctionModal.verification.id);

    setCorrectionModal((p) => (p ? { ...p, submitting: false } : p));
    if (error)
      return showToast("error", "Failed to send correction: " + error.message);

    setPendingVerifications((prev) =>
      prev.map((v) =>
        v.id === correctionModal.verification.id ? { ...v, ...payload } : v,
      ),
    );
    showToast(
      "success",
      `Correction sent to ${correctionModal.verification.sent_by_name || correctionModal.verification.sent_by}.`,
    );
    setCorrectionModal(null);
  };
  const handleLeaveAction = async (leave, approved) => {
  if (!approved) {
    setLeaveRejectModal({ leave, reason: "" });
    return;
  }
  setUpdatingLeaveId(leave.id);
  const payload = {
    admin_approved: true,
    approved_by: user.user_name,
    rejection_reason: null,
    status: "Approved",
  };
  const { error } = await supabase.from("leaves").update(payload).eq("id", leave.id);
  setUpdatingLeaveId(null);
  if (error) {
    showToast("error", "Failed to update leave. " + error.message);
    return;
  }
  const updatedLeave = { ...leave, ...payload };
  setAllLeaves((prev) => prev.map((item) => (item.id === leave.id ? updatedLeave : item)));
  showToast("success", "Leave approved.");

  if (isLeaveFullyApproved(updatedLeave)) {
    await transferTasksToProxy(supabase, updatedLeave, userMap, (msg) => showToast("success", msg));
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
    setAllTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, ...payload } : t)),
    );
    setTicketSolveModal(null);
    showToast("success", "Ticket marked as solved.");
  };
  const handleLeaveRejectConfirm = async () => {
    if (!leaveRejectModal.reason.trim()) return;
    const leave = leaveRejectModal.leave;
    const reason = leaveRejectModal.reason.trim();
    setLeaveRejectModal(null);
    setUpdatingLeaveId(leave.id);
    const payload = {
      admin_approved: false,
      approved_by: null,
      rejection_reason: reason,
      status: "Rejected",
    };
    const { error } = await supabase
      .from("leaves")
      .update(payload)
      .eq("id", leave.id);
    setUpdatingLeaveId(null);
    if (error) {
      showToast("error", "Failed to reject leave. " + error.message);
      return;
    }
    setAllLeaves((prev) =>
      prev.map((item) =>
        item.id === leave.id ? { ...item, ...payload } : item,
      ),
    );
    showToast("success", "Leave rejected.");
  };

  if (!user)
    return (
      <h2 style={{ textAlign: "center", marginTop: 80, color: "#94a3b8" }}>
        Loading…
      </h2>
    );

  const activeItem = [
    ...NAV_ITEMS,
    ...REPORTS_NAV,
    ...INSIGHTS_NAV,
    ...VERIFICATION_NAV,
    ...TICKETS_NAV,
  ].find((n) => n.key === activeTab);

  const pending = allTasks.filter((t) => t.status === "pending").length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const completed = allTasks.filter((t) => t.status === "completed").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const rejectedTasks = allTasks.filter((t) => t.status === "rejected");
  const overdueTasks = allTasks.filter(
    (t) =>
      t.due_date &&
      t.due_date < todayStr &&
      t.status !== "completed" &&
      t._source !== "instance" &&
      !t.recurring_task_id,
  );
  const unseenOverdueCount = overdueTasks.filter(
    (t) => !seenOverdueIds.includes(t.id),
  ).length;

  const leaveTotal = allLeaves.length;
  const leavePending = allLeaves.filter(
    (l) => computeLeaveStatus(l) === "pending",
  ).length;
  const leavePendingForAdmin = allLeaves.filter(
    (l) => computeLeaveStatus(l) === "pending" && !isSiteEngineerLeave(l),
  ).length;
  const leaveApproved = allLeaves.filter(
    (l) => computeLeaveStatus(l) === "approved",
  ).length;
  const leaveRejected = allLeaves.filter(
    (l) => computeLeaveStatus(l) === "rejected",
  ).length;
  const reschedPending = allReschedules.filter(
    (r) => r.status === "pending",
  ).length;
  const recentLeaves = allLeaves.slice(0, 4);
  const verificationsPending = pendingVerifications.filter(
    (v) => v.status === "pending",
  );
  const verificationsCompleted = pendingVerifications.filter(
    (v) => v.status === "completed",
  );
  const verificationsCorrection = pendingVerifications.filter(
    (v) => v.status === "correction_sent",
  );

  const taskForVerification = (v) => allTasks.find((t) => t.id === v.task_id);
  // Filtered tasks for the all-tasks tab
  const baseAllTasks = showRecurringInAllTasks
    ? allTasks
    : allTasks.filter((t) => !t.is_recurring && !t.parent_task_id);
  const filteredTasks = applyTaskFilters(baseAllTasks, taskFilters)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const hasActiveFilters = Object.values(taskFilters).some((v) => v !== "");
  // Replace the 4 lines that compute tfSites/tfPriorities/tfStatuses/tfAssignees:

  // Each filter sees data filtered by everything EXCEPT itself
  const tasksForSites = applyTaskFilters(baseAllTasks, {
    ...taskFilters,
    site: "",
  });
  const tasksForPriorities = applyTaskFilters(baseAllTasks, {
    ...taskFilters,
    priority: "",
  });
  const tasksForStatuses = applyTaskFilters(baseAllTasks, {
    ...taskFilters,
    status: "",
  });
  const tasksForAssignees = applyTaskFilters(baseAllTasks, {
    ...taskFilters,
    assignedTo: "",
  });
const employeeByUsername = new Map(employees.map((e) => [e.username, e]));
const misWeeksAll = misReportMonth ? getMonthWeeks(misReportMonth) : [];
const misWeeklyDataRaw = misReportMonth
  ? misWeeksAll.map((week) => buildMisWeekStats(allTasks, week, misTaskType))
  : [];

const misWeeklyData = misWeeklyDataRaw.map((wd) => ({
  week: wd.week,
  rows: sortMisRows(
    wd.rows
      .map((r) => {
        const emp = employeeByUsername.get(r.username);
        return { ...r, name: emp?.name || r.username, department: emp?.department || "" };
      })
      .filter((r) => !misDepartment || normalizeText(r.department) === normalizeText(misDepartment)),
    misSort,
  ),
}));

const misVisibleWeeks =
  misWeekPill === "all" ? misWeeklyData : misWeeklyData.filter((wd) => wd.week.key === misWeekPill);

const misDepartmentOptions = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort();
  const tfSites = [
    ...new Set(tasksForSites.map((t) => t.site_name).filter(Boolean)),
  ].sort();
  const tfPriorities = [
    ...new Set(tasksForPriorities.map((t) => t.priority).filter(Boolean)),
  ].sort();
  const tfStatuses = [
    ...new Set(
      tasksForStatuses.map((t) => displayStatus(t.status)).filter(Boolean),
    ),
  ].sort();
  const tfAssignees = [
    ...new Set(tasksForAssignees.map((t) => t.assigned_to).filter(Boolean)),
  ].sort();

  const recurringTasks = recurringTemplates;

  const filteredRecurring = recurringTasks
    .filter((t) => {
      if (recurringFilters.site && t.site_name !== recurringFilters.site)
        return false;
      if (
        recurringFilters.assignedTo &&
        t.assigned_to !== recurringFilters.assignedTo
      )
        return false;
      if (
        recurringFilters.recurrence &&
        t.recurrence !== recurringFilters.recurrence
      )
        return false;
      if (recurringFilters.dueSoon) {
        const nextDateStr = getNextDueDate(t.due_date, t.recurrence);
        if (!nextDateStr) return false;
        const next = new Date(nextDateStr + "T00:00:00");
        const diff = Math.round(
          (next - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
        );
        if (diff > 7) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const rfSites = [
    ...new Set(recurringTasks.map((t) => t.site_name).filter(Boolean)),
  ].sort();
  const rfAssignees = [
    ...new Set(recurringTasks.map((t) => t.assigned_to).filter(Boolean)),
  ].sort();

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <>
            <div className="ap-stats-row">
              <StatCard
                label="Total Tasks"
                value={total}
                accent="#2563eb"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                }
              />
              <StatCard
                label="Pending"
                value={pending}
                accent="#f59e0b"
                icon={
                  <svg
                    width="20"
                    height="20"
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
                }
              />
              <StatCard
                label="In Progress"
                value={inProgress}
                accent="#6366f1"
                icon={
                  <svg
                    width="20"
                    height="20"
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
                }
              />
              <StatCard
                label="Completed"
                value={completed}
                accent="#16a34a"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                }
              />
              <StatCard
                label="Pending Admin Leaves"
                value={leavePendingForAdmin}
                accent="#dc2626"
                icon={
                  <svg
                    width="20"
                    height="20"
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
                }
              />
            </div>
            <div className="ap-leave-summary">
              <div>
                <span>Total leave requests</span>
                <strong>{leaveTotal}</strong>
              </div>
              <div>
                <span>Approved</span>
                <strong>{leaveApproved}</strong>
              </div>
              <div>
                <span>Rejected</span>
                <strong>{leaveRejected}</strong>
              </div>
              <div>
                <span>Pending admin action</span>
                <strong>{leavePendingForAdmin}</strong>
              </div>
            </div>
            {recentLeaves.length > 0 && (
              <div className="ap-recent-leaves">
                <div className="ap-section-title">Recent Leave Requests</div>
                <div className="ap-recent-list">
                  {recentLeaves.map((leave) => (
                    <div key={leave.id} className="ap-recent-leave">
                      <div>
                        <strong>
                          {leave.name || leave.user_name || "Employee"}
                        </strong>
                        <span>
                          {leave.leave_type} -{" "}
                          {formatLeaveDate(leave.from_date)} to{" "}
                          {formatLeaveDate(leave.to_date)}
                        </span>
                      </div>
                      <LeaveStatusBadge leave={leave} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="ap-dash-hint">
              <svg
                width="16"
                height="16"
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
              Recurring tasks auto-generate new instances on their scheduled
              day. If the previous instance is incomplete, the new one includes
              a warning note.
            </div>
          </>
        );
      case "assign-task":
        return (
          <TaskFormWithCheckpoints
            form={form}
            handleFormChange={handleFormChange}
            setForm={setForm}
            handleSubmit={handleSubmit}
            submitting={submitting}
            onSuccess={() => setShowTaskModal(false)}
            employees={assignableEmployees}
            sites={sites}
          />
        );

      case "all-tasks":
        return loadingTasks ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading tasks…</p>
          </div>
        ) : (
          <>
            {hasActiveFilters && (
              <p className="tf-count">
                Showing {filteredTasks.length} of {baseAllTasks.length} task
                {baseAllTasks.length !== 1 ? "s" : ""}
              </p>
            )}
            {filteredTasks.length === 0 ? (
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
                    : "No tasks found. Start by assigning one."}
                </p>
                {hasActiveFilters && (
                  <button
                    className="tf-clear"
                    style={{ marginTop: 4 }}
                    onClick={() => setTaskFilters({ ...EMPTY_TASK_FILTERS })}
                  >
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
            ) : (
              <>
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        {[
                          "Title",
                          "Assigned To",
                          "Site",
                          // "Given By",
                          "Priority",
                          "Status",
                          "Activity",
                          "Hours",
                          "Due Date",
                          "Verification",
                          "Schedule",
                          "",
                        ].map((h) => (
                          <th key={h} className="ap-th">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                     {filteredTasks.slice(0, visibleTaskCount).map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          verification={latestVerificationByTask.get(t.id)}
                          onMarkDone={handleMarkTaskDone}
                          onEdit={openEditTaskModal}
                          onReassign={openReassignModal}
                          onReschedule={openRescheduleTaskModal}
                          onReject={handleRejectTask}
                          userMap={userMap}
                          onClick={setDetailTask}
                          onVerificationClick={(v, task) => setVerificationDetail({ v, task })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ap-task-mobile-grid">
                  {filteredTasks.slice(0, visibleTaskCount).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={{ ...t, _verification: latestVerificationByTask.get(t.id) }}
                      onMarkDone={handleMarkTaskDone}
                      onEdit={openEditTaskModal}
                      onReassign={openReassignModal}
                      onReschedule={openRescheduleTaskModal}
                      onReject={handleRejectTask}
                      onOpenDetail={setDetailTask}
                      onVerificationClick={(v, task) => setVerificationDetail({ v, task })}
                    />
                  ))}
                </div>
                {visibleTaskCount < filteredTasks.length && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: 16,
                    }}
                  >
                    <button
                      className="ap-btn-secondary"
                      onClick={() => setVisibleTaskCount((c) => c + 10)}
                    >
                      Load 10 more ({filteredTasks.length - visibleTaskCount}{" "}
                      remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        );

      case "recurring-tasks":
        return (
          <>
            {/* Header row: count + filter icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                gap: 10,
              }}
            >
              <p className="tf-count" style={{ margin: 0 }}>
                {filteredRecurring.length} of {recurringTasks.length} recurring
                task{recurringTasks.length !== 1 ? "s" : ""}
              </p>

              {/* Filter icon button (always visible, especially useful on mobile) */}
              <div style={{ position: "relative" }}>
                <button
                  className={`tf-mobile-btn recurring-mobile-filter-btn${recurringMobileFilterOpen ? " Active" : ""}`}
                  onClick={() => setRecurringMobileFilterOpen((p) => !p)}
                  title="Filter"
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
                  {Object.values(recurringFilters).some(
                    (v) => v !== "" && v !== false,
                  ) && <span className="tf-mobile-badge" />}
                </button>

                {/* Dropdown filter panel */}
                {recurringMobileFilterOpen && (
                  <div className="tf-popup" style={{ width: 280 }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div className="tf-group" style={{ width: "100%" }}>
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
                          Assignee
                        </span>
                        <select
                          className="tf-select"
                          style={{ flex: 1 }}
                          value={recurringFilters.assignedTo}
                          onChange={(e) =>
                            setRecurringFilters((p) => ({
                              ...p,
                              assignedTo: e.target.value,
                            }))
                          }
                        >
                          <option value="">All users</option>
                          {rfAssignees.map((a) => (
                            <option key={a} value={a}>
                              {userMap[a] || a}
                            </option>
                          ))}
                        </select>
                      </div>

                      {rfSites.length > 0 && (
                        <div className="tf-group" style={{ width: "100%" }}>
                          <span className="tf-label">Site</span>
                          <select
                            className="tf-select"
                            style={{ flex: 1 }}
                            value={recurringFilters.site}
                            onChange={(e) =>
                              setRecurringFilters((p) => ({
                                ...p,
                                site: e.target.value,
                              }))
                            }
                          >
                            <option value="">All sites</option>
                            {rfSites.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="tf-group" style={{ width: "100%" }}>
                        <span className="tf-label">Schedule</span>
                        <select
                          className="tf-select"
                          style={{ flex: 1 }}
                          value={recurringFilters.recurrence}
                          onChange={(e) =>
                            setRecurringFilters((p) => ({
                              ...p,
                              recurrence: e.target.value,
                            }))
                          }
                        >
                          <option value="">All Schedules</option>
                          {["daily", "weekly", "monthly", "yearly"].map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: recurringFilters.dueSoon
                            ? "#dc2626"
                            : "#64748b",
                          background: recurringFilters.dueSoon
                            ? "#fef2f2"
                            : "#f8fafc",
                          border: `1px solid ${recurringFilters.dueSoon ? "#fecaca" : "#e2e8f0"}`,
                          borderRadius: 8,
                          padding: "8px 12px",
                          transition: "all .15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={recurringFilters.dueSoon}
                          onChange={(e) =>
                            setRecurringFilters((p) => ({
                              ...p,
                              dueSoon: e.target.checked,
                            }))
                          }
                          style={{
                            accentColor: "#dc2626",
                            width: 14,
                            height: 14,
                          }}
                        />
                        Due within 7 days
                      </label>

                      {Object.values(recurringFilters).some(
                        (v) => v !== "" && v !== false,
                      ) && (
                        <button
                          className="tf-clear"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            marginLeft: 0,
                          }}
                          onClick={() => {
                            setRecurringFilters({ ...EMPTY_RECURRING_FILTERS });
                            setRecurringMobileFilterOpen(false);
                          }}
                        >
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
                  </div>
                )}
              </div>
            </div>

            {/* Desktop filter bar — hidden on mobile via CSS */}
            <div
              className="tf-bar recurring-desktop-bar"
              style={{
                marginBottom: 16,
                position: "fixed",
                top: "120px",
                right: "80px",
              }}
            >
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
                </span>
                <select
                  className="tf-select"
                  value={recurringFilters.assignedTo}
                  onChange={(e) =>
                    setRecurringFilters((p) => ({
                      ...p,
                      assignedTo: e.target.value,
                    }))
                  }
                >
                  <option value="">All users</option>
                  {rfAssignees.map((a) => (
                    <option key={a} value={a}>
                     {userMap[a] || a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tf-divider" />
              {rfSites.length > 0 && (
                <>
                  <div className="tf-group">
                    <select
                      className="tf-select"
                      value={recurringFilters.site}
                      onChange={(e) =>
                        setRecurringFilters((p) => ({
                          ...p,
                          site: e.target.value,
                        }))
                      }
                    >
                      <option value="">All sites</option>
                      {rfSites.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tf-divider" />
                </>
              )}
              <div className="tf-group">
                <select
                  className="tf-select"
                  value={recurringFilters.recurrence}
                  onChange={(e) =>
                    setRecurringFilters((p) => ({
                      ...p,
                      recurrence: e.target.value,
                    }))
                  }
                >
                  <option value="">All Schedules</option>
                  {["daily", "weekly", "monthly", "yearly"].map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tf-divider" />
              <div className="tf-group">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: recurringFilters.dueSoon ? "#dc2626" : "#64748b",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={recurringFilters.dueSoon}
                    onChange={(e) =>
                      setRecurringFilters((p) => ({
                        ...p,
                        dueSoon: e.target.checked,
                      }))
                    }
                    style={{ accentColor: "#dc2626" }}
                  />
                  Due within 7 days
                </label>
              </div>
              {Object.values(recurringFilters).some(
                (v) => v !== "" && v !== false,
              ) && (
                <button
                  className="tf-clear"
                  onClick={() =>
                    setRecurringFilters({ ...EMPTY_RECURRING_FILTERS })
                  }
                >
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
                  Clear
                </button>
              )}
            </div>

            {filteredRecurring.length === 0 ? (
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
                  {recurringTasks.length === 0
                    ? "No recurring tasks yet. Create one from Assign Task."
                    : "No tasks match the current filters."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        {[
                          "Title",
                          "Assigned To",
                          "Site",
                          "Priority",
                          "Schedule",
                          "Next Due",
                          "",
                        ].map((h) => (
                          <th key={h} className="ap-th">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecurring
                        .slice(0, visibleRecurringCount)
                        .map((task) => {
                          const nextDate = getNextDueDate(
                            task.due_date,
                            task.recurrence,
                          ); // ← fixed
                          const next = formatNextDue(nextDate);
                          const p =
                            PRIORITY_STYLES[task.priority] ||
                            PRIORITY_STYLES.medium;
                          return (
                            <tr key={task.id} className="ap-tr">
                              <td className="ap-td ap-td-title">
                                {task.title}
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 4,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {task.audio_url && (
                                    <a
                                      href={task.audio_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#7c3aed",
                                        background: "#f5f3ff",
                                        border: "1px solid #ddd6fe",
                                        borderRadius: 5,
                                        padding: "2px 7px",
                                        textDecoration: "none",
                                      }}
                                    >
                                      <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                      </svg>
                                      Audio
                                    </a>
                                  )}
                                  {task.document_url && (
                                    <a
                                      href={task.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#0369a1",
                                        background: "#f0f9ff",
                                        border: "1px solid #bae6fd",
                                        borderRadius: 5,
                                        padding: "2px 7px",
                                        textDecoration: "none",
                                      }}
                                    >
                                      <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                      </svg>
                                      Doc
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="ap-td">
                                {nameFor(userMap, task.assigned_to)}
                              </td>
                              <td className="ap-td">{task.site_name || "—"}</td>
                              <td className="ap-td">
                                <span
                                  className="ap-badge"
                                  style={{ background: p.bg, color: p.color }}
                                >
                                  <span
                                    className="ap-badge-dot"
                                    style={{ background: p.dot }}
                                  />
                                  {task.priority}
                                </span>
                              </td>
                              <td className="ap-td">
                                <span className="ap-pill-blue">
                                  {anchorDescription(
                                    task.recurrence,
                                    task.recurrence_anchor,
                                  ) || task.recurrence}
                                </span>
                              </td>
                              <td className="ap-td">
                                {next?.label ? (
                                  <span
                                    style={{ fontSize: 13, color: "#334155" }}
                                  >
                                    {next.label}
                                    {next.badge && (
                                      <span
                                        style={{
                                          marginLeft: 6,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          background: next.bg,
                                          color: next.color,
                                          borderRadius: 20,
                                          padding: "2px 7px",
                                        }}
                                      >
                                        {next.badge}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="ap-td">
                                <button
                                  className="ap-del-btn"
                                  onClick={() => handleDelete(task.id)}
                                  title="Delete"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4h6v2" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="ap-task-mobile-grid">
                  <div className="ap-task-mobile-grid">
                    {filteredRecurring
                      .slice(0, visibleRecurringCount)
                      .map((task) => {
                        const nextDate = getNextDueDate(
                          task.due_date,
                          task.recurrence,
                        ); // ← fixed
                        const next = formatNextDue(nextDate);
                        const p =
                          PRIORITY_STYLES[task.priority] ||
                          PRIORITY_STYLES.medium;
                        return (
                          <RecurringTaskCard
                            key={task.id}
                            task={task}
                            next={next}
                            p={p}
                            onDelete={handleDelete}
                            userMap={userMap}
                          />
                        );
                      })}
                  </div>
                </div>
              </>
            )}
            {visibleRecurringCount < filteredRecurring.length && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                <button
                  className="ap-btn-secondary"
                  onClick={() => setVisibleRecurringCount((c) => c + 10)}
                >
                  Load 10 more (
                  {filteredRecurring.length - visibleRecurringCount} remaining)
                </button>
              </div>
            )}
          </>
        );
      case "leave-requests":
        return loadingLeaves ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading leaves...</p>
          </div>
        ) : allLeaves.length === 0 ? (
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
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p className="op-empty-text">No leave requests found.</p>
          </div>
        ) : (
          <>
            <div className="ap-leave-summary ap-leave-summary-tight">
              <div style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
                <span>Total</span>
                <strong style={{ color: "#2563eb" }}>{leaveTotal}</strong>
              </div>
              <div style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                <span>Pending</span>
                <strong style={{ color: "#d97706" }}>{leavePending}</strong>
              </div>
              <div style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                <span>Admin Action</span>
                <strong style={{ color: "#dc2626" }}>
                  {leavePendingForAdmin}
                </strong>
              </div>
              <div style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                <span>Approved</span>
                <strong style={{ color: "#16a34a" }}>{leaveApproved}</strong>
              </div>
              <div style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                <span>Rejected</span>
                <strong style={{ color: "#dc2626" }}>{leaveRejected}</strong>
              </div>
            </div>
            {filteredLeaves.length === 0 ? (
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
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="op-empty-text">
                  No leave requests match the current filters.
                </p>
                <button
                  className="tf-clear"
                  style={{ marginTop: 4 }}
                  onClick={() =>
                    setLeaveFilters({ name: "", dateFrom: "", dateTo: "" })
                  }
                >
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
              </div>
            ) : (
              <>
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        {[
                          "Employee",
                          "Site",
                          "Type",
                          "Dates",
                          "Reason",
                          "Approval",
                          "Status",
                          "Action",
                        ].map((h) => (
                          <th key={h} className="ap-th">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaves.map((leave) => (
                        <LeaveRow
                          key={leave.id}
                          leave={leave}
                          onAction={handleLeaveAction}
                          updating={updatingLeaveId}
                          roleByName={roleByName}
                          userMap={userMap}
                          onRowClick={setLeaveDetailModal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="ap-task-mobile-grid">
                  {filteredLeaves.map((leave) => (
                    <LeaveRequestCard
                      key={leave.id}
                      leave={leave}
                      onAction={handleLeaveAction}
                      updating={updatingLeaveId}
                      roleByName={roleByName}
                      userMap={userMap}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        );
      case "add-employee":
        return (
          <div className="ap-form-grid">
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">
                  Full Name <span className="ap-req">*</span>
                </label>
                <input
                  className="ap-input"
                  name="name"
                  value={empForm.name}
                  onChange={handleEmpFormChange}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="ap-field">
                <label className="ap-label">
                  Username <span className="ap-req">*</span>
                </label>
                <input
                  className="ap-input"
                  name="username"
                  autoComplete="off"
                  value={empForm.username}
                  onChange={handleEmpFormChange}
                  placeholder="e.g. john.doe"
                  disabled={!!editingEmployee}
                />
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">
                  Password <span className="ap-req">*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="ap-input"
                    type={showEmpPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    value={empForm.password}
                    onChange={handleEmpFormChange}
                    placeholder="••••••••"
                    style={{ paddingRight: 38, width: "100%" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmpPassword((v) => !v)}
                    tabIndex={-1}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                    }}
                    title={showEmpPassword ? "Hide password" : "Show password"}
                    aria-label={
                      showEmpPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showEmpPassword ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="ap-field">
                <label className="ap-label">
                  Role <span className="ap-req">*</span>
                </label>
                <input
                  className="ap-input"
                  name="role"
                  value={empForm.role}
                  onChange={handleEmpFormChange}
                  placeholder="e.g. Site Engineer"
                />
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">
                  Department <span className="ap-req">*</span>
                </label>
                <select
                  className="ap-input ap-select"
                  name="department"
                  value={empForm.department}
                  onChange={handleEmpFormChange}
                >
                  <option value="">Select department…</option>
                  <option value="admin">Admin</option>
                  <option value="site engineer">Site Engineer</option>
                  <option value="project head">Project Head</option>
                  <option value="engineer office">Engineer Office</option>
                  <option value="mdo office">MDO Office</option>
                  <option value="hr">HR</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div className="ap-field">
                <label className="ap-label">Site(s) Assigned</label>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    minHeight: 42,
                  }}
                >
                  {empForm.site_names.length === 0 && (
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "#94a3b8",
                        padding: "3px 2px",
                      }}
                    >
                      No sites assigned yet
                    </span>
                  )}
                  {empForm.site_names.map((s) => (
                    <span
                      key={s}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: "#eff6ff",
                        color: "#2563eb",
                        border: "1px solid #bfdbfe",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        padding: "2px 8px",
                      }}
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() =>
                          setEmpForm((p) => ({
                            ...p,
                            site_names: p.site_names.filter((x) => x !== s),
                          }))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#2563eb",
                          padding: 0,
                          lineHeight: 1,
                          fontSize: 13,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <select
                  className="ap-input ap-select"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;

                    if (val === "__ALL__") {
                      const allSiteNames = [
                        ...new Set(
                          sites
                            .filter((s) => (s.status || "Active") === "Active")
                            .map((s) => s.site_name)
                            .filter(Boolean),
                        ),
                      ];
                      setEmpForm((p) => ({
                        ...p,
                        site_names: [...new Set([...p.site_names, ...allSiteNames])],
                      }));
                      return;
                    }

                    if (!empForm.site_names.includes(val)) {
                      setEmpForm((p) => ({
                        ...p,
                        site_names: [...p.site_names, val],
                      }));
                    }
                  }}
                >
                  <option value="">+ Add a site…</option>
                  <option value="__ALL__">—— Assign All Sites ——</option>
                  {sites
                    .filter(
                      (s) =>
                        (s.status || "Active") === "Active" &&
                        !empForm.site_names.includes(s.site_name),
                    )
                    .sort((a, b) => a.site_name.localeCompare(b.site_name))
                    .map((s) => (
                      <option key={s.id} value={s.site_name}>
                        {s.site_name}
                      </option>
                    ))}
                </select>

                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Select a site to add it. Click the × on a chip to remove.
                </span>
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">Status</label>
                <select
                  className="ap-input ap-select"
                  name="status"
                  value={empForm.status}
                  onChange={handleEmpFormChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="ap-form-row ap-col-1 ap-form-actions">
              {editingEmployee ? (
                <button
                  className="ap-btn-secondary"
                  onClick={() => {
                    setEmpForm({
                      name: "",
                      username: "",
                      password: "",
                      role: "",
                      department: "",
                      site_name: "",
                      site_names: [],
                      status: "active",
                    });
                    setEditingEmployee(null);
                    setActiveTab("manage-employees");
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  className="ap-btn-secondary"
                  onClick={() => {
                    setEmpForm({
                      name: "",
                      username: "",
                      password: "",
                      role: "",
                      department: "",
                      site_name: "",
                      site_names: [],
                      status: "active",
                    });
                  }}
                >
                  Reset
                </button>
              )}
              <button
                className="ap-btn-primary"
                onClick={handleEmpSubmit}
                disabled={empSubmitting}
              >
                {empSubmitting ? (
                  <>
                    <span className="ap-mini-spinner" /> Saving…
                  </>
                ) : editingEmployee ? (
                  "Update Employee"
                ) : (
                  "Add Employee"
                )}
              </button>
            </div>
          </div>
        );

      case "manage-employees":
        return loadingEmployees ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading employees…</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
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
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <p className="op-empty-text">No employees found.</p>
            <button
              className="ap-btn-primary"
              style={{ marginTop: 4 }}
              onClick={() => setActiveTab("add-employee")}
            >
              Add Employee
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    {[
                      "#",
                      "Name",
                      "Username",
                      "Role",
                      "Department",
                      "Site",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="ap-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, idx) => (
                    <tr key={emp.id} className="ap-tr">
                      <td
                        className="ap-td"
                        style={{ color: "#94a3b8", fontSize: 12 }}
                      >
                        {idx + 1}
                      </td>
                      <td className="ap-td ap-td-title">{emp.name || "—"}</td>
                      <td
                        className="ap-td"
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 12.5,
                        }}
                      >
                        {emp.username || "—"}
                      </td>
                      <td className="ap-td">
                        {emp.role ? (
                          <span className="ap-pill-blue">
                            {(emp.role || "").toUpperCase()}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td className="ap-td">{emp.department || "—"}</td>
                      <td className="ap-td">
                        <SiteBadgeList
                          sites={
                            emp.site_names?.length > 0
                              ? emp.site_names
                              : emp.site_name
                                ? [emp.site_name]
                                : []
                          }
                        />
                      </td>
                      <td className="ap-td">
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background:
                              emp.status === "Active" ? "#f0fdf4" : "#fef2f2",
                            color:
                              emp.status === "Active" ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {emp.status || "—"}
                        </span>
                      </td>
                      <td className="ap-td">
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="ap-edit-btn"
                            onClick={() => handleEmpEdit(emp)}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            className="ap-del-btn"
                            onClick={() => handleEmpDelete(emp.id)}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="ap-task-mobile-grid">
              {filteredEmployees.map((emp) => (
                <div key={emp.id} className="ap-task-card-mobile">
                  <div className="ap-task-card-head">
                    <div>
                      <div className="ap-task-card-title">{emp.name}</div>
                      <div
                        className="ap-task-card-sub"
                        style={{ fontFamily: "'DM Mono',monospace" }}
                      >
                        {emp.user_name}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="ap-edit-btn"
                        onClick={() => handleEmpEdit(emp)}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="ap-del-btn"
                        onClick={() => handleEmpDelete(emp.id)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="ap-task-card-meta">
                    <div>
                      <span>Department</span>
                      <strong>{emp.department || "—"}</strong>
                    </div>
                    <div>
                      <span>Designation</span>
                      <strong>{emp.designation || "—"}</strong>
                    </div>
                    <div>
                      <span>Sites</span>
                      <SiteBadgeList
                        sites={
                          emp.site_names?.length > 0
                            ? emp.site_names
                            : emp.site_name
                              ? [emp.site_name]
                              : []
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case "org-hierarchy":
        return (
          <OrgHierarchy employees={employees} sites={sites} />
        );

      case "add-site":
        return (
          <div className="ap-form-grid">
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">
                  Site Name <span className="ap-req">*</span>
                </label>
                <input
                  className="ap-input"
                  name="site_name"
                  value={siteForm.site_name}
                  onChange={handleSiteFormChange}
                  placeholder="e.g. Bhagyashree Warehouse"
                />
              </div>
              <div className="ap-field">
                <label className="ap-label">Assigned User</label>
                <select
                  className="ap-input ap-select"
                  name="user_name"
                  value={siteForm.user_name}
                  onChange={handleSiteFormChange}
                >
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.username} value={e.username}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">Role</label>
                <select
                  className="ap-input ap-select"
                  name="role"
                  value={siteForm.role}
                  onChange={handleSiteFormChange}
                >
                  <option value="">Select role…</option>
                  <option value="admin">Admin</option>
                  <option value="site engineer">Site Engineer</option>
                  <option value="project head">Project Head</option>
                  <option value="engineer office">Engineer Office</option>
                  <option value="mdo office">MDO Office</option>
                  <option value="hr">HR</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div className="ap-field">
                <label className="ap-label">
                  Job No.
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
                    auto-generated
                  </span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="ap-input"
                    name="job_no"
                    value={siteForm.job_no}
                    onChange={handleSiteFormChange}
                    placeholder="e.g. DIP-001|2026|SiteName"
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 12.5,
                    }}
                  />
                  <button
                    type="button"
                    className="ap-btn-secondary"
                    style={{ flexShrink: 0, padding: "0 14px" }}
                    onClick={regenerateJobNo}
                    disabled={!siteForm.site_name.trim()}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">Started Date</label>
                <input
                  className="ap-input"
                  type="date"
                  name="started_date"
                  value={siteForm.started_date}
                  onChange={handleSiteFormChange}
                />
              </div>
              <div className="ap-field">
                <label className="ap-label">Client Name</label>
                <input
                  className="ap-input"
                  name="client_name"
                  value={siteForm.client_name}
                  onChange={handleSiteFormChange}
                  placeholder="e.g. Acme Corp"
                />
              </div>  
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">Head Name</label>
                <select
                  className="ap-input ap-select"
                  name="head_name"
                  value={siteForm.head_name}
                  onChange={handleSiteFormChange}
                >
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.username} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ap-field">
                <label className="ap-label">Head Contact No.</label>
                <input
                  className="ap-input"
                  name="head_contact_no"
                  value={siteForm.head_contact_no}
                  onChange={handleSiteFormChange}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">Co-ordinator Name</label>
                <select
                  className="ap-input ap-select"
                  name="coordinator_name"
                  value={siteForm.coordinator_name}
                  onChange={handleSiteFormChange}
                >
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.username} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ap-field">
                <label className="ap-label">Co-ordinator Contact No.</label>
                <input
                  className="ap-input"
                  name="coordinator_contact_no"
                  value={siteForm.coordinator_contact_no}
                  onChange={handleSiteFormChange}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">PC Name</label>
                <select
                  className="ap-input ap-select"
                  name="pc_name"
                  value={siteForm.pc_name}
                  onChange={handleSiteFormChange}
                >
                  <option value="">Select…</option>
                  {pcEmployees.map((e) => (
                    <option key={e.username} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ap-field">
                <label className="ap-label">PC Contact No.</label>
                <input
                  className="ap-input"
                  name="pc_contact_no"
                  value={siteForm.pc_contact_no}
                  onChange={handleSiteFormChange}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
            <div className="ap-form-row ap-col-2">
              <div className="ap-field">
                <label className="ap-label">
                  Site Image
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
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: "#475569",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      cursor: "pointer",
                    }}
                    onChange={(e) =>
                      setSiteForm((p) => ({
                        ...p,
                        _imageFile: e.target.files[0] || null,
                      }))
                    }
                  />
                </div>
                {siteForm._imageFile && (
                  <span style={{ fontSize: 11.5, color: "#16a34a" }}>
                    ✓ {siteForm._imageFile.name}
                  </span>
                )}
                {!siteForm._imageFile && siteForm.site_image_url && (
                  <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                    Current: {siteForm.site_image_url}
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Uploads to a bucket named after the site, inside SiteImg/.
                </span>
              </div>
              <div className="ap-field">
                <label className="ap-label">Status</label>
                <select
                  className="ap-input ap-select"
                  name="status"
                  value={siteForm.status}
                  onChange={handleSiteFormChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="ap-form-row ap-col-1 ap-form-actions">
              {editingSite ? (
                <button
                  className="ap-btn-secondary"
                  onClick={() => {
                    setSiteForm({ ...EMPTY_SITE_FORM });
                    setEditingSite(null);
                    setActiveTab("manage-sites");
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  className="ap-btn-secondary"
                  onClick={() => setSiteForm({ ...EMPTY_SITE_FORM })}
                >
                  Reset
                </button>
              )}
              <button
                className="ap-btn-primary"
                onClick={handleSiteSubmit}
                disabled={siteSubmitting}
              >
                {siteSubmitting ? (
                  <>
                    <span className="ap-mini-spinner" />{" "}
                    {uploadingSiteImage ? "Uploading image…" : "Saving…"}
                  </>
                ) : editingSite ? (
                  "Update Site"
                ) : (
                  "Add Site"
                )}
              </button>
            </div>
          </div>
        );

      case "manage-sites":
        return loadingSites ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading sites…</p>
          </div>
        ) : filteredSites.length === 0 ? (
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <p className="op-empty-text">No sites found.</p>
            <button
              className="ap-btn-primary"
              style={{ marginTop: 4 }}
              onClick={() => setActiveTab("add-site")}
            >
              Add Site
            </button>
          </div>
        ) : (
          <>
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    {[
                      "#",
                      "Site Name",
                      "Assigned User",
                      "Role",
                      "Job No.",
                      "Started",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="ap-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.map((site, idx) => (
                    <tr key={site.id} className="ap-tr">
                      <td
                        className="ap-td"
                        style={{ color: "#94a3b8", fontSize: 12 }}
                      >
                        {idx + 1}
                      </td>
                      <td className="ap-td ap-td-title">
                        {site.site_name || "—"}
                      </td>
                      <td className="ap-td">
                        {nameFor(userMap, site.user_name)}
                      </td>
                      <td className="ap-td">
                        {site.role ? (
                          <span className="ap-pill-blue">{site.role}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td
                        className="ap-td"
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 12,
                        }}
                      >
                        {site.job_no || "—"}
                      </td>
                      <td className="ap-td">
                        {site.started_date
                          ? new Date(
                              site.started_date + "T00:00:00",
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="ap-td">
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background:
                              site.status === "Active" ? "#f0fdf4" : "#fef2f2",
                            color:
                              site.status === "Active" ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {site.status || "—"}
                        </span>
                      </td>
                      <td className="ap-td">
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="ap-edit-btn"
                            onClick={() => handleSiteEdit(site)}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            className="ap-del-btn"
                            onClick={() => handleSiteDelete(site.id)}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ap-task-mobile-grid">
              {filteredSites.map((site) => (
                <div key={site.id} className="ap-task-card-mobile">
                  <div className="ap-task-card-head">
                    <div>
                      <div className="ap-task-card-title">{site.site_name}</div>
                      <div className="ap-task-card-sub">
                        {nameFor(userMap, site.user_name)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="ap-edit-btn"
                        onClick={() => handleSiteEdit(site)}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="ap-del-btn"
                        onClick={() => handleSiteDelete(site.id)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="ap-task-card-meta">
                    <div>
                      <span>Role</span>
                      <strong>{site.role || "—"}</strong>
                    </div>
                    <div>
                      <span>Job No.</span>
                      <strong>{site.job_no || "—"}</strong>
                    </div>
                    <div>
                      <span>Client</span>
                      <strong>{site.client_name || "—"}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{site.status || "—"}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case "reschedule-requests":
        return loadingReschedules ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading reschedule requests…</p>
          </div>
        ) : allReschedules.length === 0 ? (
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
            <p className="op-empty-text">No reschedule requests found.</p>
          </div>
        ) : (
          <>
            <div className="ap-leave-summary ap-leave-summary-tight">
              <div style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
                <span>Total</span>
                <strong style={{ color: "#2563eb" }}>
                  {allReschedules.length}
                </strong>
              </div>
              <div style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                <span>Pending</span>
                <strong style={{ color: "#d97706" }}>{reschedPending}</strong>
              </div>
              <div style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                <span>Approved</span>
                <strong style={{ color: "#16a34a" }}>
                  {allReschedules.filter((r) => r.status === "approved").length}
                </strong>
              </div>
              <div style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                <span>Rejected</span>
                <strong style={{ color: "#dc2626" }}>
                  {allReschedules.filter((r) => r.status === "rejected").length}
                </strong>
              </div>
            </div>
            {/* Desktop table */}
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    {[
                      "Requested By",
                      "Task",
                      "Current Due",
                      "Requested Date",
                      "Reason",
                      "Status",
                      "",
                    ].map((h) => (
                      <th key={h} className="ap-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                {/* Desktop table */}
                <tbody>
                  {filteredReschedules.map((req) => (
                    <RescheduleRow
                      key={req.id}
                      req={req}
                      onAction={handleRescheduleAction}
                      updating={updatingRescheduleId}
                      userMap={userMap}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="ap-task-mobile-grid">
              {filteredReschedules.map((req) => (
                <RescheduleRequestCard
                  key={req.id}
                  req={req}
                  onAction={handleRescheduleAction}
                  updating={updatingRescheduleId}
                  roleByName={roleByName}
                  userMap={userMap}
                />
              ))}
            </div>
          </>
        );
      case "site-report":
        return <SiteReport user={user} />;

      case "daily-report": {
  const dr = dailyReportRows;
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Daily Report</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
          Task status snapshot for a single day or a custom date range, ready to review or export.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", margin: "18px 0" }}>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
            Range Type
          </label>
          <div className="ap-recurrence-pills" style={{ margin: 0 }}>
            <button
              type="button"
              className={`ap-rpill${dailyReportMode === "single" ? " Active" : ""}`}
              onClick={() => setDailyReportMode("single")}
            >
              Single Day
            </button>
            <button
              type="button"
              className={`ap-rpill${dailyReportMode === "range" ? " Active" : ""}`}
              onClick={() => setDailyReportMode("range")}
            >
              Date Range
            </button>
          </div>
        </div>

        {dailyReportMode === "single" ? (
          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
              Date
            </label>
            <input
              className="ap-input"
              type="date"
              value={dailyReportDate}
              onChange={(e) => setDailyReportDate(e.target.value)}
              style={{ minWidth: 160 }}
            />
          </div>
        ) : (
          <>
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
                From
              </label>
              <input className="ap-input" type="date" value={dailyReportFrom} onChange={(e) => setDailyReportFrom(e.target.value)} style={{ minWidth: 150 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
                To
              </label>
              <input className="ap-input" type="date" min={dailyReportFrom} value={dailyReportTo} onChange={(e) => setDailyReportTo(e.target.value)} style={{ minWidth: 150 }} />
            </div>
          </>
        )}

        <button className="ap-btn-primary" onClick={handleGenerateDailyReport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
          Generate
        </button>
        {dr && (
          <button className="ap-btn-secondary" onClick={handleDailyReportPdf}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </button>
        )}
      </div>

      {!dr ? (
        <div className="op-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="op-empty-text">Choose a date {dailyReportMode === "range" ? "range" : ""} and click Generate to build the report.</p>
        </div>
      ) : dr.length === 0 ? (
        <div className="op-empty-state">
          <p className="op-empty-text">No tasks are due in this period.</p>
        </div>
      ) : (
        <>
          <div className="ap-leave-summary ap-leave-summary-tight">
            <div style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
              <span>Total Tasks</span>
              <strong style={{ color: "#2563eb" }}>{dr.length}</strong>
            </div>
            <div style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
              <span>Overdue</span>
              <strong style={{ color: "#dc2626" }}>{dr.filter((r) => r.delayLabel.includes("overdue")).length}</strong>
            </div>
            <div style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
              <span>Due Today</span>
              <strong style={{ color: "#d97706" }}>{dr.filter((r) => r.delayLabel === "Today").length}</strong>
            </div>
            <div style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <span>Completed</span>
              <strong style={{ color: "#16a34a" }}>{dr.filter((r) => r.delayLabel === "Completed").length}</strong>
            </div>
          </div>

          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  {["SR", "Prev. Date", "Target Date", "Task", "Site", "Assignee", "Status", "Remarks"].map((h) => (
                    <th key={h} className="ap-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dr.map((r) => (
                  <tr key={r.id} className="ap-tr">
                    <td className="ap-td" style={{ color: "#94a3b8" }}>{r.sr}</td>
                    <td className="ap-td">{formatSubmissionDate(r.prevDate)}</td>
                    <td className="ap-td">{formatSubmissionDate(r.targetDate)}</td>
                    <td className="ap-td ap-td-title">
                      {r.title}
                      {r.description && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{r.description}</div>}
                    </td>
                    <td className="ap-td">{r.siteName || "—"}</td>
                    <td className="ap-td">{r.assignee}</td>
                    <td className="ap-td">
                      <span className="ap-badge" style={{ background: r.delayStyle.bg, color: r.delayStyle.color, fontWeight: 700 }}>
                        {r.delayLabel}
                      </span>
                    </td>
                    <td className="ap-td" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="ap-input"
                        placeholder="Add remark…"
                        style={{ fontSize: 12, padding: "5px 8px" }}
                        value={dailyReportRemarks[r.id] || ""}
                        onChange={(e) => setDailyReportRemarks((p) => ({ ...p, [r.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
      case "work-verification":
      case "fms-tracker":
        return (
          <div className="op-empty-state">
            <p className="op-empty-text">
              {activeItem?.label} isn't built yet — this section is a placeholder.
            </p>
          </div>
        );

      case "permissions":
        return (
          <PermissionsPanel
            employees={employees}
            loading={loadingEmployees}
            showToast={showToast}
            onChanged={(id, flag, next) => {
              setEmployees((prev) =>
                prev.map((e) => (e.id === id ? { ...e, [flag]: next } : e)),
              );
            }}
          />
        );

      case "delay-report": {
      const s = delayReportMeta;
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Task Delay Report</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
          Employee-wise assigned → accept → deadline → submit. Deadline uses office hours (9:30–6:30, lunch 1–2, Mon–Sat).
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", margin: "18px 0" }}>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Range</label>
          <select className="ap-input ap-select" value={delayRange} onChange={(e) => setDelayRange(e.target.value)} style={{ minWidth: 150 }}>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_30">Last 30 days</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Employee</label>
          <select className="ap-input ap-select" value={delayEmployee} onChange={(e) => setDelayEmployee(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.username} value={e.username}>{e.name}</option>
            ))}
          </select>
        </div>
        <button className="ap-btn-primary" onClick={handleGenerateDelayReport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
          Generate
        </button>
        {delayReportRows && (
          <>
            <button className="ap-btn-secondary" onClick={handleDelayReportPdf}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PDF
            </button>
          <button className="ap-btn-secondary" onClick={handleSendDelayWA}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.53 0 .2 5.33.2 11.88c0 2.09.55 4.13 1.59 5.93L.1 24l6.34-1.66a11.9 11.9 0 0 0 5.64 1.43h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.18-1.24-6.16-3.45-8.41ZM12.09 21.8h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.76.98 1-3.66-.23-.38a9.88 9.88 0 1 1 8.41 4.65Zm5.42-7.4c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
            </svg>
            Send on WhatsApp
          </button>
          </>
        )}
      </div>

      {!delayReportRows ? (
        <div className="op-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          <p className="op-empty-text">Choose a range and click Generate to build the report.</p>
        </div>
      ) : delayReportRows.length === 0 ? (
        <div className="op-empty-state">
          <p className="op-empty-text">No tasks were assigned in this period.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          <div style={{ padding: "18px 22px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Task Delay Report</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {toDateStr(s.from)} → {toDateStr(s.to)} · {s.total} task{s.total !== 1 ? "s" : ""} ·{" "}
              <span style={{ color: "#dc2626", fontWeight: 700 }}>{s.delayed} delayed</span> ·{" "}
              <span style={{ color: "#16a34a", fontWeight: 700 }}>{s.onTime} on time</span> ·{" "}
              {s.na} N/A
            </div>
          </div>

          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr style={{ background: "#1e293b" }}>
                  {["SR", "Employee", "Project", "Timestamp (Assigned)", "Emp Acceptance Time", "Hrs to Complete", "Hold / Resume", "Total Hold", "Due", "Submitted", "Status", "Delay"].map((h) => (
                    <th key={h} className="ap-th" style={{ color: "#fff", background: "#1e293b" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delayReportRows.map((r) => (
                  <tr key={r.id} className="ap-tr">
                    <td className="ap-td" style={{ color: "#2563eb", fontWeight: 700 }}>{r.sr}</td>
                    <td className="ap-td ap-td-title">{r.employee}</td>
                    <td className="ap-td">{r.project}</td>
                    <td className="ap-td">{fmtDT(r.assignedAt)}</td>
                    <td className="ap-td">{fmtDT(r.acceptedAt)}</td>
                    <td className="ap-td">{r.hoursToComplete ? `+${r.hoursToComplete}h` : "—"}</td>
                    <td className="ap-td">{r.holdResume}</td>
                    <td className="ap-td">{r.totalHold}</td>
                    <td className="ap-td">{fmtDT(r.dueDateTime)}</td>
                    <td className="ap-td">
                      {r.submittedAt ? fmtDT(r.submittedAt) : <span style={{ color: "#2563eb" }}>Not submitted (Pending)</span>}
                    </td>
                    <td className="ap-td">
                      <span className="ap-badge" style={{
                        background: r.statusLabel === "Delayed" ? "#fef2f2" : r.statusLabel === "On Time" ? "#f0fdf4" : "#f1f5f9",
                        color: r.statusLabel === "Delayed" ? "#dc2626" : r.statusLabel === "On Time" ? "#16a34a" : "#64748b",
                        fontWeight: 700,
                      }}>
                        {r.statusLabel}
                      </span>
                    </td>
                    <td className="ap-td" style={{ fontWeight: 600 }}>{r.delayLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
case "mis-report":
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>MIS Report</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
          Week-wise performance. Filter by Delegated or Recurring tasks. Week 1 can include previous-month days.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", margin: "18px 0" }}>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Month</label>
          <input
            type="month"
            className="ap-input"
            value={misMonth}
            onChange={(e) => setMisMonth(e.target.value)}
            style={{ minWidth: 160 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Week</label>
          <select className="ap-input ap-select" value={misWeekPill} onChange={(e) => setMisWeekPill(e.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All weeks</option>
            {misWeeksAll.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}{w.includesPrevMonth ? " +prev" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Department</label>
          <select className="ap-input ap-select" value={misDepartment} onChange={(e) => setMisDepartment(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">All departments</option>
            {misDepartmentOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Task Type</label>
          <select className="ap-input ap-select" value={misTaskType} onChange={(e) => setMisTaskType(e.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All tasks</option>
            <option value="delegated">Delegated</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Sort</label>
          <select className="ap-input ap-select" value={misSort} onChange={(e) => setMisSort(e.target.value)} style={{ minWidth: 140 }}>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="open_desc">Open % (High→Low)</option>
            <option value="total_desc">Total (High→Low)</option>
          </select>
        </div>
        <button className="ap-btn-primary" onClick={handleGenerateMisReport} disabled={misGenerating}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
          {misGenerating ? "Generating…" : "Generate"}
        </button>
        {misReportMonth && (
          <button className="ap-btn-secondary" onClick={handleExportMisCsv}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
        )}
      </div>

      {!misReportMonth ? (
        <div className="op-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" />
          </svg>
          <p className="op-empty-text">Choose a month and click Generate to build the report.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11.5, fontWeight: 600, color: "#64748b", background: "#f1f5f9",
                border: "1px solid #e2e8f0", borderRadius: 20, padding: "4px 12px",
              }}
            >
              Showing: <strong style={{ color: "#1e293b" }}>
                {misTaskType === "all" ? "All tasks" : misTaskType === "delegated" ? "Delegated tasks" : "Recurring tasks"}
              </strong>
            </span>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => setMisWeekPill("all")}
                className={misWeekPill === "all" ? "ap-rpill Active" : "ap-rpill"}
                style={{ borderRadius: 20 }}
              >
                All weeks
              </button>
              {misWeeksAll.map((w) => (
                <button
                  key={w.key}
                  onClick={() => setMisWeekPill(w.key)}
                  className={misWeekPill === w.key ? "ap-rpill Active" : "ap-rpill"}
                  style={{ borderRadius: 20 }}
                >
                  {w.label.replace("Week ", "W")}{w.includesPrevMonth ? " +prev" : ""}
                </button>
              ))}
            </div>
          </div>

          {misVisibleWeeks.map((wd) => (
            <MisWeekCard key={wd.week.key} weekData={wd} taskType={misTaskType} />
          ))}
        </>
      )}
    </div>
  );
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
                      href={getViewUrl(r.pdf_url)}
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
                        `${r.site_name || "site"}-SVR-${r.visit_date || r.id}.pdf`,
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
                        textDecoration: "none",
                      }}
                    >
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
      case "report-submissions": {
        if (user?.role?.toLowerCase().trim() !== "admin") return null;
        const filteredSubmissions = applySubmissionFilters(
          allSubmissions,
          submissionFilters,
        );
        const hasSubFilters = Object.values(submissionFilters).some(
          (v) => v !== "",
        );

        return loadingSubmissions ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading report submissions…</p>
          </div>
        ) : (
          <>
            {hasSubFilters && (
              <p className="tf-count">
                Showing {filteredSubmissions.length} of {allSubmissions.length}{" "}
                report
                {allSubmissions.length !== 1 ? "s" : ""}
              </p>
            )}

            {filteredSubmissions.length === 0 ? (
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
                <p className="op-empty-text">No report submissions found.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        {[
                          "Site Name",
                          "Engineer Name",
                          "Submission Date",
                          "Report Type",
                          "Action",
                        ].map((h) => (
                          <th key={h} className="ap-th">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((r) => (
                        <tr key={r.id} className="ap-tr">
                          <td className="ap-td ap-td-title">{r.site || "—"}</td>
                          <td className="ap-td">{r.engineer || "—"}</td>
                          <td className="ap-td">
                            {formatSubmissionDate(r.date)}
                          </td>
                          <td className="ap-td">
                            <span className="ap-pill-blue">
                              {r.report_type}
                            </span>
                          </td>
                          <td className="ap-td">
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
                                  href={buildDownloadUrl(
                                    r.pdf_url,
                                    `${r.site || "site"}-${r.report_type}-${r.date || r.id}.${getFileExt(r.pdf_url)}`,
                                  )}
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="ap-task-mobile-grid">
                  {filteredSubmissions.map((r) => (
                    <div key={r.id} className="ap-task-card-mobile">
                      <div className="ap-task-card-head">
                        <div>
                          <div className="ap-task-card-title">
                            {r.site || "—"}
                          </div>
                          <div className="ap-task-card-sub">
                            {r.engineer || "—"}
                          </div>
                        </div>
                        <span className="ap-pill-blue">{r.report_type}</span>
                      </div>
                      <div className="ap-task-card-meta">
                        <div>
                          <span>Submission Date</span>
                          <strong>{formatSubmissionDate(r.date)}</strong>
                        </div>
                        <div>
                          <span>File</span>
                          <strong>
                            {r.pdf_url
                              ? getFileExt(r.pdf_url).toUpperCase()
                              : "None"}
                          </strong>
                        </div>
                      </div>
                      {r.pdf_url ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <a
                            href={getViewUrl(r.pdf_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              flex: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "#475569",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 7,
                              padding: "8px 12px",
                              textDecoration: "none",
                            }}
                          >
                            View
                          </a>

                          <a
                            href={buildDownloadUrl(
                              r.pdf_url,
                              `${r.site || "site"}-${r.report_type}-${r.date || r.id}.${getFileExt(r.pdf_url)}`,
                            )}
                            download
                            style={{
                              flex: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "#2563eb",
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              borderRadius: 7,
                              padding: "8px 12px",
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
                          No file attached
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      }
      case "new-tickets": {
        const openTickets = allTickets.filter((t) => t.status === "open");
        return loadingTickets ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading tickets…</p>
          </div>
        ) : openTickets.length === 0 ? (
          <div className="op-empty-state">
            <p className="op-empty-text">No open tickets.</p>
          </div>
        ) : (
          <AdminTicketsTable
            tickets={openTickets}
            updatingId={updatingTicketId}
            onSolve={(t) =>
              setTicketSolveModal({ ticket: t, note: "", file: null })
            }
          />
        );
      }

      case "solved-ticket": {
        const solvedTickets = allTickets.filter((t) => t.status === "solved");
        return loadingTickets ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading tickets…</p>
          </div>
        ) : solvedTickets.length === 0 ? (
          <div className="op-empty-state">
            <p className="op-empty-text">No solved tickets yet.</p>
          </div>
        ) : (
          <AdminTicketsTable tickets={solvedTickets} showAction={false} />
        );
      }

      case "pending-verification":
        return loadingVerifications ? (
          <div className="op-empty-state">
            <div className="op-spinner" />
            <p className="op-empty-text">Loading verification requests…</p>
          </div>
        ) : verificationsPending.length === 0 ? (
          <div className="op-empty-state">
            <p className="op-empty-text">No tasks pending verification.</p>
          </div>
        ) : (
          <>
            <VerificationTable
              verifications={verificationsPending.slice(0, visiblePendingVerificationCount)}
              allTasks={allTasks}
              userMap={userMap}
              onComplete={handleMarkVerificationCompleted}
              onCorrect={openCorrectionModal}
              updatingId={updatingVerificationId}
              onRowClick={(v, task) => setVerificationDetail({ v, task })} 
              currentUser={user.user_name}
            />
            {visiblePendingVerificationCount < verificationsPending.length && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                <button
                  className="ap-btn-secondary"
                  onClick={() =>
                    setVisiblePendingVerificationCount((c) => c + 10)
                  }
                >
                  Load 10 more (
                  {verificationsPending.length -
                    visiblePendingVerificationCount}{" "}
                  remaining)
                </button>
              </div>
            )}
          </>
        );

        case "rejected-tasks":
  return rejectedTasks.length === 0 ? (
    <div className="op-empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <p className="op-empty-text">No tasks have been rejected by employees.</p>
    </div>
  ) : (
    <>
      <p className="tf-count">
        {rejectedTasks.length} task{rejectedTasks.length !== 1 ? "s" : ""} rejected by employees
      </p>
      <div className="ap-table-wrap">
        <table className="ap-table">
          <thead>
            <tr>
              {["Title", "Rejected By", "Site", "Reason", "Rejected On", "Action"].map((h) => (
                <th key={h} className="ap-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rejectedTasks.map((t) => (
              <tr key={t.id} className="ap-tr" onClick={() => setDetailTask(t)} style={{ cursor: "pointer" }}>
                <td className="ap-td ap-td-title">{t.title}</td>
                <td className="ap-td">{nameFor(userMap, t.rejected_by || t.assigned_to)}</td>
                <td className="ap-td">{t.site_name || "—"}</td>
                <td className="ap-td" style={{ maxWidth: 240 }}>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>{t.employee_rejection_reason || "—"}</span>
                </td>
                <td className="ap-td">
                  {t.rejected_at
                    ? new Date(t.rejected_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </td>
                <td className="ap-td" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="ap-btn-approve"
                      style={{ padding: "5px 10px", fontSize: 11.5 }}
                      onClick={() => openReassignModal(t)}
                    >
                      Reassign
                    </button>
                    <button
                      className="ap-btn-secondary"
                      style={{ padding: "5px 10px", fontSize: 11.5 }}
                      onClick={() => handleClearRejection(t)}
                    >
                      Reopen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ap-task-mobile-grid">
        {rejectedTasks.map((t) => (
          <div key={t.id} className="ap-task-card-mobile" onClick={() => setDetailTask(t)} style={{ cursor: "pointer" }}>
            <div className="ap-task-card-head">
              <div>
                <div className="ap-task-card-title">{t.title}</div>
                <div className="ap-task-card-sub">{nameFor(userMap, t.rejected_by || t.assigned_to)} · {t.site_name || "No site"}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fef2f2", color: "#dc2626" }}>
                Rejected
              </span>
            </div>
            {t.employee_rejection_reason && (
              <div style={{ fontSize: 12.5, color: "#64748b", background: "#f8fafc", borderRadius: 6, padding: "8px 10px", borderLeft: "3px solid #fecaca" }}>
                {t.employee_rejection_reason}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ap-btn-approve" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); openReassignModal(t); }}>
                Reassign
              </button>
              <button className="ap-btn-secondary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); handleClearRejection(t); }}>
                Reopen
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
      case "overdue-tasks":
        return overdueTasks.length === 0 ? (
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
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <p className="op-empty-text">
              No overdue tasks. Everything is on schedule.
            </p>
          </div>
        ) : (
          <>
            <p className="tf-count">
              {overdueTasks.length} task{overdueTasks.length !== 1 ? "s" : ""}{" "}
              past due and not yet completed
            </p>

            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    {[
                      "Title",
                      "Assigned To",
                      "Site",
                      "Given By",
                      "Priority",
                      "Status",
                      "Due Date",
                      "Overdue By",
                      "Files",
                      "Action",
                    ].map((h) => (
                      <th key={h} className="ap-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overdueTasks.slice(0, visibleOverdueCount).map((t) => {
                    const p =
                      PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium;
                    const s = STATUS_STYLES[displayStatus(t.status)];
                    const daysOverdue = Math.floor(
                      (new Date(todayStr) - new Date(t.due_date)) / 86400000,
                    );
                    return (
                      <tr  key={t.id}  className="ap-tr"  onClick={() => setDetailTask(t)}  style={{ cursor: "pointer" }}>
                        <td className="ap-td ap-td-title">
                          {t.title}
                          {t.description && (
                            <div
                              style={{
                                fontSize: 11.5,
                                color: "#94a3b8",
                                marginTop: 2,
                              }}
                            >
                              {t.description}
                            </div>
                          )}
                        </td>
                        <td className="ap-td">
                          {nameFor(userMap, t.assigned_to)}
                        </td>
                        <td className="ap-td">{t.site_name || "—"}</td>
                        <td className="ap-td">
                          {nameFor(userMap, t.assigned_by)}
                        </td>
                        <td className="ap-td">
                          <span
                            className="ap-badge"
                            style={{ background: p.bg, color: p.color }}
                          >
                            <span
                              className="ap-badge-dot"
                              style={{ background: p.dot }}
                            />
                            {t.priority}
                          </span>
                        </td>
                        <td className="ap-td">
                          <span
                            className="ap-badge"
                            style={{ background: s.bg, color: s.color }}
                          >
                            {displayStatus(t.status)}
                          </span>
                        </td>
                        <td
                          className="ap-td"
                          style={{ color: "#dc2626", fontWeight: 600 }}
                        >
                          {new Date(t.due_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="ap-td">
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 20,
                              background: "#fef2f2",
                              color: "#dc2626",
                            }}
                          >
                            {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="ap-td">
                          <div style={{ display: "flex", gap: 8 }}>
                            {t.audio_url && (
                              <a
                                href={t.audio_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Audio instruction"
                                style={{ color: "#7c3aed" }}
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
                                >
                                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                </svg>
                              </a>
                            )}
                            {t.document_url && (
                              <a
                                href={t.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Document"
                                style={{ color: "#2563eb" }}
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
                                >
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                              </a>
                            )}
                            {!t.audio_url && !t.document_url && (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </div>
                        </td>
                        <td className="ap-td" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="ap-btn-approve"
                            style={{ padding: "5px 10px", fontSize: 11.5 }}
                            onClick={() =>
                              setOverdueRescheduleModal({
                                task: t,
                                newDate: t.due_date,
                              })
                            }
                          >
                            Reschedule
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="ap-task-mobile-grid">
              {overdueTasks.slice(0, visibleOverdueCount).map((t) => {
                const daysOverdue = Math.floor(
                  (new Date(todayStr) - new Date(t.due_date)) / 86400000,
                );
                return (
                  <div key={t.id} className="ap-task-card-mobile" onClick={() => setDetailTask(t)} style={{ cursor: "pointer" }}>
                    <div className="ap-task-card-head">
                      <div>
                        <div className="ap-task-card-title">{t.title}</div>
                        <div className="ap-task-card-sub">
                          {nameFor(userMap, t.assigned_to)} ·{" "}
                          {t.site_name || "No site"}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "#fef2f2",
                          color: "#dc2626",
                          flexShrink: 0,
                        }}
                      >
                        {daysOverdue}d overdue
                      </span>
                    </div>
                    <div className="ap-task-card-meta">
                      <div>
                        <span>Priority</span>
                        <strong>{t.priority}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>{displayStatus(t.status)}</strong>
                      </div>
                      <div>
                        <span>Due Date</span>
                        <strong style={{ color: "#dc2626" }}>
                          {new Date(t.due_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </strong>
                      </div>
                      <div>
                        <span>Given By</span>
                        <strong>{nameFor(userMap, t.assigned_by)}</strong>
                      </div>
                    </div>
                    <button
                      className="ap-btn-approve"
                      style={{ width: "100%" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOverdueRescheduleModal({
                          task: t,
                          newDate: t.due_date,
                        });
                      }}
                    >
                      Reschedule Due Date
                    </button>
                  </div>
                );
              })}
            </div>

            {visibleOverdueCount < overdueTasks.length && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                <button
                  className="ap-btn-secondary"
                  onClick={() => setVisibleOverdueCount((c) => c + 10)}
                >
                  Load 10 more ({overdueTasks.length - visibleOverdueCount}{" "}
                  remaining)
                </button>
              </div>
            )}
          </>
        );

        case "add-drawings":
  return (
    <div className="ap-form-grid">
      <div className="ap-form-row ap-col-2">
        <div className="ap-field">
          <label className="ap-label">
            Site Name <span className="ap-req">*</span>
          </label>
          <select
            className="ap-input ap-select"
            value={drawingForm.site_name}
            onChange={(e) =>
              setDrawingForm((p) => ({ ...p, site_name: e.target.value }))
            }
          >
            <option value="">Select site…</option>
            {sites
              .filter((s) => (s.status || "Active") === "Active")
              .slice()
              .sort((a, b) => (a.site_name || "").localeCompare(b.site_name || ""))
              .map((s) => (
                <option key={s.id} value={s.site_name}>
                  {s.site_name}
                </option>
              ))}
          </select>
        </div>
        <div className="ap-field">
          <label className="ap-label">
            Date
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
              defaults to today
            </span>
          </label>
          <input
            className="ap-input"
            type="date"
            value={drawingForm.date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) =>
              setDrawingForm((p) => ({ ...p, date: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="ap-form-row ap-col-1">
        <div className="ap-field">
          <label className="ap-label">
            Drawing Attachments <span className="ap-req">*</span>
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
      </div>

      <div className="ap-form-row ap-col-1 ap-form-actions">
        <button
          className="ap-btn-secondary"
          onClick={() => setDrawingForm({ site_name: "", date: "", files: [] })}
        >
          Reset
        </button>
        <button
          className="ap-btn-primary"
          onClick={handleDrawingSubmit}
          disabled={drawingSubmitting}
        >
          {drawingSubmitting ? (
            <>
              <span className="ap-mini-spinner" /> Uploading…
            </>
          ) : (
            "Upload Drawings"
          )}
        </button>
      </div>
    </div>
  );

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
        className="ap-btn-primary"
        style={{ marginTop: 4 }}
        onClick={() => setActiveTab("add-drawings")}
      >
        Add Drawings
      </button>
    </div>
  ) : (
    <div className="cp-media-grid">
      {allDrawings.flatMap((d) =>
        (d.file_urls || []).map((f, i) => (
          <div key={`${d.id}-${i}`} className="cp-media-card type-graphical">
            <div
              className="cp-media-photo"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6d4aa8",
                background: "#f1ecf9",
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="12" height="14" rx="1" />
                <path d="M6 9h6M6 12h6M6 15h4" />
                <path d="M16 16l5-5 2 2-5 5-3 1z" />
              </svg>
            </div>
            <div className="cp-media-body">
              <span className="cp-media-badge graphical">Drawing</span>
              <div className="cp-media-title">{f.name}</div>
              <div className="cp-media-meta">
                {d.site_name} · {formatSubmissionDate(d.date)}
              </div>
              <div className="cp-media-actions">
                
                <a  className="cp-media-link"
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View
                </a>
                <a className="cp-media-link dl" href={f.url} download>
                  Download
                </a>
              </div>
            </div>
          </div>
        )),
      )}
    </div>
  );
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
          <div className={`ap-toast ap-toast-${toast.type}`}>
            {toast.type === "success" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
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
                strokeLinejoin="round"
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
                canSwitchToOffice && {
                  key: "office",
                  label: "Office",
                  href: "/office",
                  title: "Open Office portal",
                },
              ].filter(Boolean)}
            />
            <nav className="op-nav">
            {filterNav(NAV_ITEMS.slice(0, 6), user, "admin").map((item) => {
              const isActive = activeTab === item.key;
              const isHovered = hoveredNavKey === item.key;
              const highlighted = isActive || isHovered;
              return (
                <button
                  key={item.key}
                  className={`op-nav-item${isActive ? " Active" : ""}`}
                  onClick={() => handleNavClick(item.key)}
                  onMouseEnter={() => setHoveredNavKey(item.key)}
                  onMouseLeave={() => setHoveredNavKey(null)}
                  style={{
                    background: highlighted ? `${item.color}18` : undefined,
                    color: highlighted ? item.color : undefined,
                    transition: "background .12s, color .12s",
                  }}
                >
                  <span className="op-nav-icon">{item.icon}</span>
                  {item.label}
                  {item.key === "leave-requests" && leavePendingForAdmin > 0 && (
                    <span className="op-nav-badge">{leavePendingForAdmin}</span>
                  )}
                  {item.key === "reschedule-requests" && reschedPending > 0 && (
                    <span className="op-nav-badge">{reschedPending}</span>
                  )}
                </button>
              );
            })}
              {filterNav(VERIFICATION_NAV, user, "admin").length > 0 && (
                <>
              <span className="op-nav-section">Task Verification</span>
              {filterNav(VERIFICATION_NAV, user, "admin").map((item) => {
                const isActive = activeTab === item.key;
                const isHovered = hoveredNavKey === item.key;
                const highlighted = isActive || isHovered;
                return (
                  <button
                    key={item.key}
                    className={`op-nav-item${isActive ? " Active" : ""}`}
                    onClick={() => handleNavClick(item.key)}
                    onMouseEnter={() => setHoveredNavKey(item.key)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span className="op-nav-icon">{item.icon}</span>
                    {item.label}
                    {item.key === "pending-verification" && verificationsPending.length > 0 && (
                      <span className="op-nav-badge">{verificationsPending.length}</span>
                    )}
                    {item.key === "rejected-tasks" && rejectedTasks.length > 0 && (
                      <span className="op-nav-badge">{rejectedTasks.length}</span>
                    )}
                    {item.key === "overdue-tasks" && unseenOverdueCount > 0 && (
                      <span className="op-nav-badge">{unseenOverdueCount}</span>
                    )}
                  </button>
                );
              })}
                </>
              )}
              {filterNav(TICKETS_NAV, user, "admin").length > 0 && (
                <>
              <span className="op-nav-section">Ticket Raised</span>
              {filterNav(TICKETS_NAV, user, "admin").map((item) => {
                const isActive = activeTab === item.key;
                const isHovered = hoveredNavKey === item.key;
                const highlighted = isActive || isHovered;
                return (
                  <button
                    key={item.key}
                    className={`op-nav-item${isActive ? " Active" : ""}`}
                    onClick={() => handleNavClick(item.key)}
                    onMouseEnter={() => setHoveredNavKey(item.key)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span className="op-nav-icon">{item.icon}</span>
                    {item.label}
                    {item.key === "new-tickets" &&
                      allTickets.filter((t) => t.status === "open").length > 0 && (
                        <span className="op-nav-badge">
                          {allTickets.filter((t) => t.status === "open").length}
                        </span>
                      )}
                  </button>
                );
              })}
                </>
              )}
              {filterNav(NAV_ITEMS.slice(6, 9), user, "admin").length > 0 && (
                <>
              <span className="op-nav-section">Employee Management</span>
              {filterNav(NAV_ITEMS.slice(6, 9), user, "admin").map((item) => {
                const isActive = activeTab === item.key;
                const isHovered = hoveredNavKey === item.key;
                const highlighted = isActive || isHovered;
                return (
                  <button
                    key={item.key}
                    className={`op-nav-item${isActive ? " Active" : ""}`}
                    onClick={() => handleNavClick(item.key)}
                    onMouseEnter={() => setHoveredNavKey(item.key)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span className="op-nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
                </>
              )}
              {filterNav(NAV_ITEMS.slice(9), user, "admin").length > 0 && (
                <>
              <span className="op-nav-section">Site Management</span>
              {filterNav(NAV_ITEMS.slice(9), user, "admin").map((item) => {
                const isActive = activeTab === item.key;
                const isHovered = hoveredNavKey === item.key;
                const highlighted = isActive || isHovered;
                return (
                  <button
                    key={item.key}
                    className={`op-nav-item${isActive ? " Active" : ""}`}
                    onClick={() => handleNavClick(item.key)}
                    onMouseEnter={() => setHoveredNavKey(item.key)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span className="op-nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
                </>
              )}
              {filterNav(REPORTS_NAV, user, "admin").length > 0 && (
                <>
              <span className="op-nav-section">Drawings & Reports</span>
              {filterNav(REPORTS_NAV, user, "admin").map((item) => {
                const isActive = activeTab === item.key;
                const isHovered = hoveredNavKey === item.key;
                const highlighted = isActive || isHovered;
                return (
                  <button
                    key={item.key}
                    className={`op-nav-item${isActive ? " Active" : ""}`}
                    onClick={() => handleNavClick(item.key)}
                    onMouseEnter={() => setHoveredNavKey(item.key)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span className="op-nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
                </>
              )}

              {filterNav(INSIGHTS_NAV, user, "admin").length > 0 && (
                <>
              <span className="op-nav-section">Insights & Compliance</span>
              {filterNav(INSIGHTS_NAV, user, "admin").map((item) => {
                const isActive = activeTab === item.key;
                const isHovered = hoveredNavKey === item.key;
                const highlighted = isActive || isHovered;
                return (
                  <button
                    key={item.key}
                    className={`op-nav-item${isActive ? " Active" : ""}`}
                    onClick={() => handleNavClick(item.key)}
                    onMouseEnter={() => setHoveredNavKey(item.key)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                      transition: "background .12s, color .12s",
                    }}
                  >
                    <span className="op-nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
                </>
              )}
            </nav>
          </aside>

          <main className="op-main" ref={mainRef}>
            <div className="op-content-card">
              <div className="op-content-header">
                <div className="op-header-left">
                  <div className="op-content-icon">{activeItem?.icon}</div>
                  <span className="op-content-title">{activeItem?.label}</span>
                </div>
                {activeTab === "all-tasks" && (
                  <>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: showRecurringInAllTasks ? "#2563eb" : "#64748b",
                        background: showRecurringInAllTasks
                          ? "#eff6ff"
                          : "#f8fafc",

                        borderRadius: 8,
                        padding: "7px 12px",
                        transition: "all .15s",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 18,
                          borderRadius: 99,
                          background: showRecurringInAllTasks
                            ? "#2563eb"
                            : "#c9d0d4d0",
                          position: "relative",
                          transition: "background .2s",
                          flexShrink: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={showRecurringInAllTasks}
                          onChange={(e) =>
                            setShowRecurringInAllTasks(e.target.checked)
                          }
                          style={{ display: "none" }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: showRecurringInAllTasks ? 16 : 2,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#fff",
                            boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                            transition: "left .2s",
                          }}
                        />
                      </span>
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
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Include recurring
                    </label>

                    <TaskFilterBar
                      filters={taskFilters}
                      onChange={(key, val) => {
                        setTaskFilters((prev) => {
                          const next = { ...prev, [key]: val };
                          const base = applyTaskFilters(baseAllTasks, {
                            ...next,
                          });
                          if (
                            next.site &&
                            !base.some((t) => t.site_name === next.site)
                          )
                            next.site = "";
                          if (
                            next.priority &&
                            !base.some((t) => t.priority === next.priority)
                          )
                            next.priority = "";
                          if (
                            next.status &&
                            !base.some((t) => t.status === next.status)
                          )
                            next.status = "";
                          if (
                            next.assignedTo &&
                            !base.some((t) => t.assigned_to === next.assignedTo)
                          )
                            next.assignedTo = "";
                          return next;
                        });
                      }}
                      onClear={() => setTaskFilters({ ...EMPTY_TASK_FILTERS })}
                      sites={tfSites}
                      priorities={tfPriorities}
                      statuses={tfStatuses}
                      assignees={tfAssignees}
                      userMap={userMap} 
                      inline={true}
                      mobileOpen={mobileFilterOpen}
                      onMobileToggle={() => setMobileFilterOpen((p) => !p)}
                    />
                  </>
                )}
                {activeTab === "report-submissions" && (
                  <SubmissionFilterBar
                    filters={submissionFilters}
                    onChange={(key, val) =>
                      setSubmissionFilters((prev) => ({ ...prev, [key]: val }))
                    }
                    onClear={() =>
                      setSubmissionFilters({
                        site: "",
                        engineer: "",
                        reportType: "",
                        dateFrom: "",
                        dateTo: "",
                      })
                    }
                    rows={allSubmissions}
                    inline={true}
                    mobileOpen={submissionMobileFilterOpen}
                    onMobileToggle={() =>
                      setSubmissionMobileFilterOpen((p) => !p)
                    }
                  />
                )}
                {activeTab === "reschedule-requests" && (
                  <RescheduleFilterBar
                    filters={rescheduleFilters}
                    onChange={(key, val) =>
                      setRescheduleFilters((prev) => ({ ...prev, [key]: val }))
                    }
                    onClear={() =>
                      setRescheduleFilters({ name: "", status: "" })
                    }
                    reschedules={allReschedules}
                    userMap={userMap}
                    inline={true}
                    mobileOpen={rescheduleMobileFilterOpen}
                    onMobileToggle={() =>
                      setRescheduleMobileFilterOpen((p) => !p)
                    }
                  />
                )}
                {activeTab === "leave-requests" && (
                  <LeaveFilterBar
                    filters={leaveFilters}
                    onChange={(key, val) =>
                      setLeaveFilters((prev) => ({ ...prev, [key]: val }))
                    }
                    onClear={() =>
                      setLeaveFilters({ name: "", dateFrom: "", dateTo: "" })
                    }
                    leaves={allLeaves}
                    inline={true}
                    mobileOpen={leaveMobileFilterOpen}
                    onMobileToggle={() => setLeaveMobileFilterOpen((p) => !p)}
                  />
                )}
                {activeTab === "manage-employees" && (
                  <EmployeeFilterBar
                    filters={employeeFilters}
                    onChange={(key, val) =>
                      setEmployeeFilters((prev) => ({ ...prev, [key]: val }))
                    }
                    onClear={() => setEmployeeFilters({ name: "", site: "" })}
                    employees={employees}
                    sites={sites}
                    inline={true}
                    mobileOpen={employeeMobileFilterOpen}
                    onMobileToggle={() =>
                      setEmployeeMobileFilterOpen((p) => !p)
                    }
                  />
                )}
                {activeTab === "manage-sites" && (
                  <SiteFilterBar
                    filters={siteFiltersState}
                    onChange={(key, val) =>
                      setSiteFiltersState((prev) => ({ ...prev, [key]: val }))
                    }
                    onClear={() =>
                      setSiteFiltersState({ site: "", assignedUser: "" })
                    }
                    employees={employees}
                    sites={sites}
                    inline={true}
                    mobileOpen={siteMobileFilterOpen}
                    onMobileToggle={() => setSiteMobileFilterOpen((p) => !p)}
                  />
                )}
              </div>
              {renderContent()}
            </div>
          </main>
        </div>
        {/* FAB — dashboard and all-tasks tabs */}
        <PortalFloaters showBot />
        {(activeTab === "dashboard" || activeTab === "all-tasks") && (
          <button
            className="ap-fab"
            onClick={() => setShowTaskModal(true)}
            title="Assign new task"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}

        {/* Assign Task Modal */}
        {showTaskModal && (
          <div
            className="ap-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTaskModal(false);
            }}
          >
            <div className="ap-modal">
              <div className="ap-modal-header">
                <div className="ap-modal-title">
                  <div className="ap-modal-title-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  {editingTaskId ? "Edit Task" : "Assign New Task"}
                </div>
                <button
                  className="ap-modal-close"
                  onClick={() => {
                    setShowTaskModal(false);
                    setEditingTaskId(null);
                    setForm({ ...EMPTY_FORM });
                  }}
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
              <div className="ap-modal-body">
                <TaskFormWithCheckpoints
                  form={form}
                  handleFormChange={handleFormChange}
                  setForm={setForm}
                  handleSubmit={handleSubmit}
                  submitting={submitting}
                  onSuccess={() => setShowTaskModal(false)}
                  employees={assignableEmployees}
                  sites={sites}
                />
              </div>
            </div>
          </div>
        )}
      </div>
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

            <div
              style={{
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
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
                  const s = STATUS_STYLES[displayStatus(detailTask.status)];
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
                      {displayStatus(detailTask.status)
                        .charAt(0)
                        .toUpperCase() +
                        displayStatus(detailTask.status).slice(1)}
                    </span>
                  );
                })()}
                {(() => {
                  const a = getTaskActivity(detailTask);
                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: a.bg,
                        color: a.color,
                      }}
                    >
                      {a.label}
                    </span>
                  );
                })()}
                {detailTask.is_recurring && (
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
                    {anchorDescription(
                      detailTask.recurrence,
                      detailTask.recurrence_anchor,
                    ) || detailTask.recurrence}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  {
                    label: "Assigned To",
                    value: nameFor(userMap, detailTask.assigned_to),
                  },
                  {
                    label: "Given By",
                    value: nameFor(userMap, detailTask.assigned_by),
                  },
                  { label: "Site", value: detailTask.site_name || "—" },
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
                  {
                    label: "Accepted At",
                    value: detailTask.accepted_at
                      ? new Date(detailTask.accepted_at).toLocaleString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "Not accepted yet",
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
                    }}
                  >
                    Audio Instruction
                  </div>
                  <audio
                    controls
                    src={detailTask.audio_url}
                    style={{ width: "100%", borderRadius: 8, outline: "none" }}
                  />
                </div>
              )}

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
                    }}
                  >
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
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "9px 16px",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    Open / Download Document
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {verificationDetail && (
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
            if (e.target === e.currentTarget) setVerificationDetail(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            }}
          >
            {(() => {
              const { v, task } = verificationDetail;
              const statusStyle = {
                pending: { bg: "#fffbeb", color: "#d97706", label: "Pending" },
                completed: {
                  bg: "#f0fdf4",
                  color: "#16a34a",
                  label: "Completed",
                },
                correction_sent: {
                  bg: "#fef2f2",
                  color: "#dc2626",
                  label: "Correction Sent",
                },
              };
              const sc = statusStyle[v.status] || statusStyle.pending;
              return (
                <>
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
                        }}
                      >
                        {task?.title || v.task_title}
                      </div>
                      {(task?.site_name || v.site_name) && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 3,
                          }}
                        >
                          {task?.site_name || v.site_name}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setVerificationDetail(null)}
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

                  <div
                    style={{
                      padding: "20px 22px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: sc.bg,
                        color: sc.color,
                        width: "fit-content",
                      }}
                    >
                      {sc.label}
                    </span>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          label: "Sent By",
                          value: v.sent_by_name || v.sent_by,
                        },
                        {
                          label: "Assigned To",
                          value: task
                            ? nameFor(userMap, task.assigned_to)
                            : "—",
                        },
                        { label: "Priority", value: task?.priority || "—" },
                        {
                          label: "Sent On",
                          value: v.created_at
                            ? new Date(v.created_at).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
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

                    {task?.description && (
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
                          Task Description
                        </div>
                        <p
                          style={{
                            fontSize: 13.5,
                            color: "#475569",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {task.description}
                        </p>
                      </div>
                    )}

                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e8edf3",
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
                        Files Submitted for Verification
                      </div>
                      {v.document_urls?.length > 0 ? (
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          {v.document_urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
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
                              📎 File {i + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "#94a3b8",
                            fontStyle: "italic",
                          }}
                        >
                          No files attached
                        </span>
                      )}
                    </div>

                    {(task?.audio_url || task?.document_url) && (
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
                          }}
                        >
                          Original Task Attachments
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {task.audio_url && (
                            <audio
                              controls
                              src={task.audio_url}
                              style={{ width: "100%", borderRadius: 8, outline: "none" }}
                            />
                          )}
                          {task.document_url && (
                            
                            <a  href={task.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "#0369a1",
                              }}
                            >
                              <svg
  width="13"
  height="13"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2.2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <polyline points="14 2 14 8 20 8" />
</svg> Document
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {v.status === "correction_sent" && (
                    <div
                      style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
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
                          color: "#dc2626",
                          marginBottom: 8,
                        }}
                      >
                        Correction Sent
                      </div>
                      {v.correction_note && (
                        <p
                          style={{
                            fontSize: 13.5,
                            color: "#475569",
                            lineHeight: 1.6,
                            margin: "0 0 10px",
                          }}
                        >
                          {v.correction_note}
                        </p>
                      )}
                      {v.correction_audio_url && (
                        <audio
                          controls
                          src={v.correction_audio_url}
                          style={{ width: "100%", borderRadius: 8, outline: "none", marginBottom: 8 }}
                        />
                      )}
                      {v.correction_document_urls?.length > 0 && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {v.correction_document_urls.map((url, i) => (
                            
                            <a  key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "#0369a1",
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>&nbsp;&nbsp;Doc {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                      {v.resolved_by && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            marginTop: 8,
                          }}
                        >
                          by {nameFor(userMap, v.resolved_by)}
                        </div>
                      )}
                    </div>
                  )}

                    {v.status === "completed" && v.resolved_by && (
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "#16a34a",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Verified by {nameFor(userMap, v.resolved_by)}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {rejectModal && (
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
            if (e.target === e.currentTarget) setRejectModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 24px 64px rgba(0,0,0,.22)",
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
                gap: 12,
                padding: "18px 22px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}
                >
                  Reject Reschedule Request
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {rejectModal.req.tasks?.title ||
                    `Task #${rejectModal.req.task_id}`}
                  {" · "}Requested by{" "}
                  <strong style={{ color: "#64748b" }}>
                    {rejectModal.req.requested_by}
                  </strong>
                </div>
              </div>
              <button
                onClick={() => setRejectModal(null)}
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
                  color: "#94a3b8",
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

            {/* Request summary */}
            <div style={{ padding: "16px 22px 0" }}>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e8edf3",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    fontSize: 12.5,
                    color: "#dc2626",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 4,
                  }}
                >
                  Rejecting this request keeps the task's due date unchanged —
                  the employee must complete it by the original date of{" "}
                  <strong>
                    {rejectModal.req.current_due
                      ? new Date(
                          rejectModal.req.current_due + "T00:00:00",
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </strong>
                  .
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Current due:
                  <strong style={{ color: "#1e293b", marginLeft: 5 }}>
                    {rejectModal.req.current_due
                      ? new Date(
                          rejectModal.req.current_due + "T00:00:00",
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </strong>
                </div>
                <div style={{ fontSize: 12, color: "#7c3aed" }}>
                  Requested:
                  <strong style={{ marginLeft: 5 }}>
                    {new Date(
                      rejectModal.req.requested_date + "T00:00:00",
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </div>
                {rejectModal.req.reason && (
                  <div
                    style={{
                      width: "100%",
                      fontSize: 12,
                      color: "#64748b",
                      fontStyle: "italic",
                    }}
                  >
                    "{rejectModal.req.reason}"
                  </div>
                )}
              </div>
            </div>

            {/* Reason textarea */}
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
                placeholder="Explain why this reschedule request is being rejected…"
                autoFocus
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
                  transition: "border .15s",
                }}
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal((p) => ({ ...p, reason: e.target.value }))
                }
                onFocus={(e) => {
                  e.target.style.borderColor = "#dc2626";
                  e.target.style.boxShadow = "0 0 0 3px rgba(220,38,38,.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                }}
              />
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                This message will be shown to the employee.
              </span>
            </div>

            {/* Footer buttons */}
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
                onClick={() => setRejectModal(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
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
                onClick={handleRejectConfirm}
                disabled={!rejectModal.reason.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: rejectModal.reason.trim() ? "#dc2626" : "#f1f5f9",
                  color: rejectModal.reason.trim() ? "#fff" : "#94a3b8",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: rejectModal.reason.trim() ? "pointer" : "not-allowed",
                  transition: "background .15s, color .15s",
                }}
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reject — Keep Original Due Date
              </button>
            </div>
          </div>
        </div>
      )}
      {leaveDetailModal && (
  <div
    style={{
      position: "fixed", inset: 0, zIndex: 10040,
      background: "rgba(15,23,42,.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) setLeaveDetailModal(null); }}
  >
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
      {(() => {
        const leave = leaveDetailModal;
        const status = computeLeaveStatus(leave);
        const style = LEAVE_STATUS_STYLES[status];
        const days = getLeaveDays(leave);
        const managedByHead = isSiteEngineerLeave(leave);

        return (
          <>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  {leave.name || leave.user_name || "Employee"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {leave.leave_type} · {leave.site_name || "No site"}
                </div>
              </div>
              <button
                onClick={() => setLeaveDetailModal(null)}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="op-meta-pill">
                  {formatLeaveDate(leave.from_date)} → {formatLeaveDate(leave.to_date)}
                  {days && ` · ${days} day${days > 1 ? "s" : ""}`}
                </span>
                <span
                  className="ap-leave-status"
                  style={{ background: style.bg, color: style.color, borderColor: style.border }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>

              {leave.reason && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
                    Employee's Reason
                  </div>
                  <p className="ap-leave-reason" style={{ margin: 0 }}>
                    {formatAuditEntries(leave.reason, roleByName, userMap)}
                  </p>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {managedByHead ? (
                  <span className={`ap-approval-pill ${getHeadApprovalClass(leave)}`}>
                    {getHeadApprovalText(leave)}
                  </span>
                ) : (
                  <>
                    {leave.admin_approved === true && <span className="ap-approval-pill ok">Admin: Approved</span>}
                    {leave.admin_approved === false && <span className="ap-approval-pill no">Admin: Rejected</span>}
                    {(leave.admin_approved === null || leave.admin_approved === undefined) && (
                      <span className="ap-approval-pill">Admin: Pending</span>
                    )}
                    {leave.proxy_user_name && (
                      <span className={`ap-approval-pill ${leave.proxy_approved === true ? "ok" : leave.proxy_approved === false ? "no" : ""}`}>
                        Proxy ({userMap[leave.proxy_user_name] || leave.proxy_user_name}):{" "}
                        {leave.proxy_approved === true ? "Accepted" : leave.proxy_approved === false ? "Declined" : "Pending"}
                      </span>
                    )}
                  </>
                )}
              </div>

              {leave.rejection_reason && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
                    Rejection Reason(s)
                  </div>
                  <div className="lv-rejection">
                    {formatAuditEntries(leave.rejection_reason, roleByName, userMap)}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                Submitted {formatLeaveDate(leave.created_at?.slice(0, 10)) || "—"}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 22px 18px", borderTop: "1px solid #f1f5f9" }}>
              <button
                onClick={() => setLeaveDetailModal(null)}
                style={{ background: "#f1f5f9", color: "#475569", fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </>
        );
      })()}
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
              <label
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#475569",
                  marginTop: 8,
                }}
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
      {correctionModal && (
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
            if (e.target === e.currentTarget) setCorrectionModal(null);
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
                Send Correction
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                To{" "}
                {correctionModal.verification.sent_by_name ||
                  correctionModal.verification.sent_by}
                {" · "}
                {correctionModal.verification.task_title}
              </div>
            </div>

            <div
              style={{
                padding: "16px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Correction Note <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  rows={4}
                  autoFocus
                  placeholder="Explain what needs to be corrected…"
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
                  value={correctionModal.note}
                  onChange={(e) =>
                    setCorrectionModal((p) => ({ ...p, note: e.target.value }))
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
                  Audio Note
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
                <AudioRecorder
                  onRecorded={(file) =>
                    setCorrectionModal((p) => ({ ...p, audioFile: file }))
                  }
                />
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Record a voice note explaining the correction.
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
                >
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
                    setCorrectionModal((p) => ({
                      ...p,
                      docFiles: [...p.docFiles, ...newFiles],
                    }));
                    e.target.value = "";
                  }}
                  style={{ fontSize: 12.5 }}
                />
                {correctionModal.docFiles.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      marginTop: 4,
                    }}
                  >
                    {correctionModal.docFiles.map((f, i) => (
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
                            setCorrectionModal((p) => ({
                              ...p,
                              docFiles: p.docFiles.filter(
                                (_, idx) => idx !== i,
                              ),
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
                onClick={() => setCorrectionModal(null)}
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
                onClick={handleCorrectionSubmit}
                disabled={correctionModal.submitting}
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
                  opacity: correctionModal.submitting ? 0.6 : 1,
                }}
              >
                {correctionModal.submitting ? "Sending…" : "Send Correction"}
              </button>
            </div>
          </div>
        </div>
      )}
      {overdueRescheduleModal && (
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
            if (e.target === e.currentTarget) setOverdueRescheduleModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 420,
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
                Reschedule Overdue Task
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {overdueRescheduleModal.task.title}
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
                New Due Date <span style={{ color: "#dc2626" }}>*</span>
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
                value={overdueRescheduleModal.newDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) =>
                  setOverdueRescheduleModal((p) => ({
                    ...p,
                    newDate: e.target.value,
                  }))
                }
              />
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                Current due date:{" "}
                {new Date(
                  overdueRescheduleModal.task.due_date,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
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
                onClick={() => setOverdueRescheduleModal(null)}
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
                onClick={handleOverdueRescheduleSubmit}
                disabled={updatingOverdueId === overdueRescheduleModal.task.id}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  opacity:
                    updatingOverdueId === overdueRescheduleModal.task.id
                      ? 0.6
                      : 1,
                }}
              >
                {updatingOverdueId === overdueRescheduleModal.task.id
                  ? "Saving…"
                  : "Update Due Date"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignModal && (
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
            if (e.target === e.currentTarget) setReassignModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 420,
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
                Reassign Task
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {reassignModal.task.title}
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
                New Assignee <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="ap-input ap-select"
                value={reassignModal.newAssignee}
                onChange={(e) =>
                  setReassignModal((p) => ({
                    ...p,
                    newAssignee: e.target.value,
                  }))
                }
              >
                <option value="">Select employee…</option>
                {employees
                  .filter((e) => e.status !== "Inactive")
                  .map((e) => (
                    <option key={e.username} value={e.username}>
                      {e.name}
                    </option>
                  ))}
              </select>
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                Currently assigned to{" "}
                {nameFor(userMap, reassignModal.task.assigned_to)}.
              </span>
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
                onClick={() => setReassignModal(null)}
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
                onClick={handleReassignSubmit}
                disabled={updatingReassignId === reassignModal.task.id}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  opacity:
                    updatingReassignId === reassignModal.task.id ? 0.6 : 1,
                }}
              >
                {updatingReassignId === reassignModal.task.id
                  ? "Saving…"
                  : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleTaskModal && (
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
            if (e.target === e.currentTarget) setRescheduleTaskModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 420,
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
                Reschedule Task
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {rescheduleTaskModal.task.title}
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
                New Due Date <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="date"
                className="ap-input"
                value={rescheduleTaskModal.newDate}
                onChange={(e) =>
                  setRescheduleTaskModal((p) => ({
                    ...p,
                    newDate: e.target.value,
                  }))
                }
              />
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                Current due date:{" "}
                {rescheduleTaskModal.task.due_date
                  ? new Date(
                      rescheduleTaskModal.task.due_date,
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not set"}
              </span>
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
                onClick={() => setRescheduleTaskModal(null)}
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
                onClick={handleRescheduleTaskSubmit}
                disabled={
                  updatingRescheduleTaskId === rescheduleTaskModal.task.id
                }
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  opacity:
                    updatingRescheduleTaskId === rescheduleTaskModal.task.id
                      ? 0.6
                      : 1,
                }}
              >
                {updatingRescheduleTaskId === rescheduleTaskModal.task.id
                  ? "Saving…"
                  : "Update Due Date"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
