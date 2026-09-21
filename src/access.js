
import {
  hasPermission,
  isAdminUser,
  pickPermissionFields,
  PERM_FLAGS,
  PERM_KEYS,
  hasAdminCapability,
  keysFromPermissionFlags,
} from "./lib/permissions";

export {
  hasPermission,
  isAdminUser,
  pickPermissionFields,
  PERM_FLAGS,
  PERM_KEYS,
  hasAdminCapability,
  keysFromPermissionFlags,
};

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

/** Office-employee rights (not admin) — used for engineer office + MDO / switch users in /office. */
const OFFICE_EMPLOYEE_KEYS = [
  "my-tasks", "recurring-tasks", "my-reschedules",
  "verify-requests", "new-tickets", "raised-tickets", "solved-tickets",
  "apply-leave", "my-leaves",
  "site-report", "my-reports", "checklists",
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
    office: OFFICE_EMPLOYEE_KEYS,
  },
  "mdo office": {
    admin: [],
    office: OFFICE_EMPLOYEE_KEYS,
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

/** True when the logged-in user belongs to the MDO portal. */
export function isMdoUser(user) {
  const dept = String(user?.department || "").trim().toLowerCase();
  const role = String(user?.role || "").trim().toLowerCase();
  return dept === "mdo office" || role === "mdo office" || /mdo\s*office/.test(`${dept} ${role}`);
}

/** True when the logged-in user's home portal is Site. */
export function isSiteUser(user) {
  const dept = String(user?.department || "").trim().toLowerCase();
  const role = String(user?.role || "").trim().toLowerCase();
  return (
    dept === "site engineer" ||
    role === "site engineer" ||
    role === "site incharge" ||
    role === "site coordinator" ||
    /site\s*(engineer|incharge|coordinator)/.test(`${dept} ${role}`)
  );
}

function withAllTasks(keys) {
  if (keys.includes("my-tasks") && !keys.includes("all-tasks")) {
    return [...keys, "all-tasks"];
  }
  return keys;
}

export function getAllowedKeys(user, portal) {
  if (!user) return [];
  const department = String(user?.department || "").trim().toLowerCase();
  if (department === "admin" || isAdminUser(user)) {
    return portal === "admin" ? ADMIN_ALL_KEYS : OFFICE_ALL_KEYS;
  }

  let base = [];

  // Admin-granted portal switches: office-employee rights in /office.
  if (
    portal === "office" &&
    (hasPermission(user, "can_switch_office_site") ||
      hasPermission(user, "can_switch_office_mdo"))
  ) {
    base = withAllTasks([...OFFICE_EMPLOYEE_KEYS]);
  } else if (isMdoUser(user)) {
    // MDO portal users in Office get office-employee rights (never admin).
    if (portal === "office") base = withAllTasks([...OFFICE_EMPLOYEE_KEYS]);
    else base = [];
  } else {
    const role = String(user?.role || "").trim().toLowerCase();
    const entry = ROLE_ACCESS[role] || DEFAULT_ACCESS;
    const keys = entry[portal];
    if (keys === "*") {
      base = portal === "admin" ? ADMIN_ALL_KEYS : OFFICE_ALL_KEYS;
    } else {
      base = withAllTasks(keys || []);
    }
  }

  // Permission flags are final grants — merge onto whatever role/department allows.
  const fromPerms = keysFromPermissionFlags(user, portal);
  if (!fromPerms.length) return base;
  return [...new Set([...base, ...fromPerms])];
}

export function canAccessPortal(user, portal) {
  return getAllowedKeys(user, portal).length > 0;
}

export function filterNav(navArray, user, portal) {
  const allowed = getAllowedKeys(user, portal);
  return navArray.filter((item) => allowed.includes(item.key));
}

/** Default portal path after login, based on department. */
export function defaultPortalFor(userOrDepartment) {
  const department =
    typeof userOrDepartment === "string"
      ? userOrDepartment
      : userOrDepartment?.department;
  const normalized = String(department || "").trim().toLowerCase();
  switch (normalized) {
    case "hr":
      return "/hr";
    case "client":
      return "/client";
    case "admin":
      return "/admin";
    case "project head":
      return "/head";
    case "engineer office":
      return "/office";
    case "site engineer":
      return "/site";
    case "mdo office":
      return "/mdo";
    default:
      return "/";
  }
}
