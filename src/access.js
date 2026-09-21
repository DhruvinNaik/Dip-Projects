
const ADMIN_ALL_KEYS = [
  "dashboard", "assign-task", "all-tasks", "recurring-tasks",
  "leave-requests", "reschedule-requests",
  "pending-verification",  "resolved-verification", "overdue-tasks", "rejected-tasks", 
  "new-tickets", "solved-ticket",
  "add-employee", "manage-employees", "org-hierarchy", "add-site", "manage-sites",
  "add-drawings", "all-drawings", "site-report", "my-reports", "report-submissions", "delay-report","mis-report",
   "work-verification", "fms-tracker", "permissions","daily-report",
];

// Nav keys as used in OfficePortal.jsx's TASK_NAV / LEAVE_NAV / REPORTS_NAV / TICKETS_NAV
const OFFICE_ALL_KEYS = [
  "my-tasks", "recurring-tasks", "all-tasks", "my-reschedules",
  "verify-requests", "new-tickets", "raised-tickets", "solved-tickets",
  "apply-leave", "my-leaves", "proxy-request",  
  "site-report", "my-reports", "checklists", "report-submissions",
   "add-drawings", "all-drawings", 
];

const ROLE_ACCESS = {
  admin: { admin: "*", office: "*" },

  "project head": {
  admin: [],
  office: [
    "my-tasks", "recurring-tasks", "my-reschedules",
    "raised-tickets", "solved-tickets",
    "apply-leave", "my-leaves", "proxy-request",
    "site-report", "my-reports", "checklists", "report-submissions",
    "new-tickets",
  ],
},
  "mis head": {
    admin: [],
    office: OFFICE_ALL_KEYS,
  },
  "mis executive": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "verify-requests", "new-tickets", "raised-tickets", "solved-tickets",
      "apply-leave", "my-leaves",
      "site-report", "my-reports",
    ],
  },
  "engineer office": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "verify-requests", "new-tickets", "raised-tickets", "solved-tickets",
      "apply-leave", "my-leaves",
      "site-report", "my-reports", "checklists",
    ],
  },
  "site engineer": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "raised-tickets", "solved-tickets",
      "apply-leave", "my-leaves",
      "site-report", "my-reports", "checklists",
    ],
  },
  "site incharge": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "raised-tickets", "solved-tickets",
      "apply-leave", "my-leaves", "proxy-request",
      "site-report", "my-reports", "checklists",
    ],
  },
  "site coordinator": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "raised-tickets", "solved-tickets",
      "apply-leave", "my-leaves",
      "site-report", "my-reports", "checklists",
    ],
  },
  "junior estimator": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "raised-tickets", "solved-tickets",
      "apply-leave", "my-leaves",
      "site-report", "my-reports", "checklists",
    ],
  },
  "process controller": {
    admin: [],
    office: [
      "my-tasks", "recurring-tasks", "my-reschedules",
      "raised-tickets",
      "apply-leave", "my-leaves",
      "site-report", "my-reports",
    ],
  },
  client: {
    admin: [],
    office: ["site-report", "my-reports"],
  },
};

const DEFAULT_ACCESS = { admin: [], office: OFFICE_ALL_KEYS };

export function getAllowedKeys(user, portal) {
  
  const department = String(user?.department || "").trim().toLowerCase();
  if (department === "admin") {
    return portal === "admin" ? ADMIN_ALL_KEYS : OFFICE_ALL_KEYS;
  }

  const role = String(user?.role || "").trim().toLowerCase();
  const entry = ROLE_ACCESS[role] || DEFAULT_ACCESS;
  const keys = entry[portal];
  if (keys === "*") return portal === "admin" ? ADMIN_ALL_KEYS : OFFICE_ALL_KEYS;
  const allowedKeys = keys || [];
  if (portal === "office" && allowedKeys.includes("my-tasks") && !allowedKeys.includes("all-tasks")) {
    return [...allowedKeys, "all-tasks"];
  }
  return allowedKeys;
}

export function canAccessPortal(user, portal) {
  return getAllowedKeys(user, portal).length > 0;
}

export function filterNav(navArray, user, portal) {
  const allowed = getAllowedKeys(user, portal);
  return navArray.filter((item) => allowed.includes(item.key));
}
