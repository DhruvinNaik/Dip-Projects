/** Admin-granted permission flags stored on user_details. These override role/department. */

export const PERM_FLAGS = [
  { key: "can_add_task", label: "Add task" },
  { key: "can_add_site", label: "Add site" },
  { key: "can_add_employee", label: "Add employee" },
  { key: "can_resolve_tickets", label: "Resolve tickets" },
  { key: "can_verify", label: "Verify tasks" },
  { key: "is_mis_executive", label: "MIS Executive" },
  { key: "can_switch_office_site", label: "Office ↔ Site" },
  { key: "can_switch_office_mdo", label: "Office ↔ MDO" },
];

export const PERM_KEYS = PERM_FLAGS.map((f) => f.key);

/** Nav keys unlocked in Admin portal when a permission flag is Yes. */
export const PERM_TO_ADMIN_KEYS = {
  can_add_task: ["assign-task", "recurring-tasks"],
  can_add_site: ["add-site", "manage-sites"],
  can_add_employee: ["add-employee", "manage-employees"],
  can_resolve_tickets: ["new-tickets", "solved-ticket"],
  can_verify: ["pending-verification", "resolved-verification"],
  is_mis_executive: [
    "mis-report",
    "daily-report",
    "work-verification",
    "fms-tracker",
    "delay-report",
    "new-tickets",
    "solved-ticket",
  ],
};

/** Extra Office portal nav keys unlocked by permission flags. */
export const PERM_TO_OFFICE_KEYS = {
  can_verify: ["verify-requests"],
  can_resolve_tickets: ["new-tickets", "solved-tickets"],
  is_mis_executive: ["new-tickets", "solved-tickets", "verify-requests"],
};

export function isAdminUser(user) {
  const dept = String(user?.department || "").trim().toLowerCase();
  const role = String(user?.role || "").trim().toLowerCase();
  return dept === "admin" || role === "admin";
}

/** Final authority: admins always true; everyone else uses the stored flag only. */
export function hasPermission(user, flag) {
  if (!user || !flag) return false;
  if (isAdminUser(user)) return true;
  return !!user[flag];
}

/** True when user has any capability that belongs on the Admin portal. */
export function hasAdminCapability(user) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return Object.keys(PERM_TO_ADMIN_KEYS).some((flag) => !!user[flag]);
}

export function keysFromPermissionFlags(user, portal) {
  if (!user) return [];
  const map = portal === "admin" ? PERM_TO_ADMIN_KEYS : PERM_TO_OFFICE_KEYS;
  const out = new Set();
  Object.entries(map).forEach(([flag, keys]) => {
    if (hasPermission(user, flag)) {
      keys.forEach((k) => out.add(k));
    }
  });
  return [...out];
}

/** Pick permission fields from a DB/user row for localStorage session. */
export function pickPermissionFields(row = {}) {
  const out = {};
  PERM_KEYS.forEach((key) => {
    out[key] = !!row[key];
  });
  return out;
}
