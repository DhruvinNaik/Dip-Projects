export const MONTHLY_LEAVE_QUOTA = 4;
const MONTHLY_LEAVE_ROLES = ["site engineer", "site incharge", "site coordinator"]; // Site Engineering department roles

export function isMonthlyLeaveRole(user) {
  const role = (typeof user === "string" ? user : user?.role || "").trim().toLowerCase();
  return MONTHLY_LEAVE_ROLES.includes(role);
}   
function isLeaveApproved(l) {
  if (l.level_approved === false || l.head_approved === false) return false;
  // The proxy must also have approved (older leaves without a proxy are unaffected).
  if (l.proxy_user_name && l.proxy_approved !== true) return false;
  return l.level_approved === true && l.head_approved === true;
}

// Splits a leave's [from_date, to_date] range into per-month day counts,
// e.g. 2026-01-30 → 2026-02-02 gives { "2026-01": 2, "2026-02": 2 }
function splitLeaveDaysByMonth(fromDate, toDate) {
  const result = {};
  let cursor = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    result[key] = (result[key] || 0) + 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/**
 * Running monthly leave balance for a user, up to and including
 * `targetMonth` ("YYYY-MM"). Unused days from earlier months carry
 * forward: 2 used of 4 this month → next month starts with 4 + 2 = 6.
 */
export async function computeMonthlyLeaveBalance(supabase, user, targetMonth) {
  const { data: userRow } = await supabase
    .from("user_details")
    .select("created_at")
    .eq("username", user.user_name)
    .maybeSingle();

  const [ty, tm] = targetMonth.split("-").map(Number);
  const targetDate = new Date(ty, tm - 1, 1);

  let startDate = userRow?.created_at
    ? new Date(new Date(userRow.created_at).getFullYear(), new Date(userRow.created_at).getMonth(), 1)
    : new Date(targetDate);

  const capDate = new Date(targetDate);
  capDate.setMonth(capDate.getMonth() - 36);
  if (startDate < capDate) startDate = capDate;
  if (startDate > targetDate) startDate = new Date(targetDate);

  const fromStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: leaves } = await supabase
    .from("leaves")
    .select("from_date, to_date, level_approved, head_approved, proxy_user_name, proxy_approved, is_half_day")
    .eq("user_name", user.user_name)
    .gte("to_date", fromStr);

  const usedByMonth = {};
  (leaves || []).filter(isLeaveApproved).forEach((l) => {
    if (!l.from_date || !l.to_date) return;
    const perMonth = l.is_half_day
      ? { [l.from_date.slice(0, 7)]: 0.5 }
      : splitLeaveDaysByMonth(l.from_date, l.to_date);
    Object.entries(perMonth).forEach(([mo, days]) => {
      usedByMonth[mo] = (usedByMonth[mo] || 0) + days;
    });
  });

  let balance = 0;
  let broughtForward = 0; // ← balance carried in from before the target month
  let cursor = new Date(startDate);
  while (cursor <= targetDate) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const isTargetMonth = key === targetMonth;
    if (isTargetMonth) broughtForward = balance; // snapshot before this month's quota/usage applied

    balance += MONTHLY_LEAVE_QUOTA;
    balance -= usedByMonth[key] || 0;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    remaining: Math.max(0, balance),
    broughtForward: Math.max(0, broughtForward),
    thisMonthUsed: usedByMonth[targetMonth] || 0,
    quotaPerMonth: MONTHLY_LEAVE_QUOTA,
  };
}
// Half-day leaves: the day is split at 2 PM. "first" = morning until 2 PM, "second" = from 2 PM.
export const HALF_DAY_CUTOFF_HOUR = 14;
export const HALF_DAY_LABELS = {
  first: "First half (until 2:00 PM)",
  second: "Second half (from 2:00 PM)",
};

// Days a leave counts for: 0.5 for a half day, otherwise inclusive calendar days.
export function leaveDayCount(leave) {
  if (leave?.is_half_day) return 0.5;
  if (!leave?.from_date || !leave?.to_date) return 0;
  const ms = new Date(leave.to_date + "T00:00:00") - new Date(leave.from_date + "T00:00:00");
  return Math.round(ms / 86400000) + 1;
}

export const LEAVE_TASK_ACTIONS = {
  proxy: "Send to my proxy",
  reschedule: "Reschedule to after my leave",
  hold: "Hold (pause timers)",
};

function nextDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Open tasks of the applicant that fall inside the leave window.
export async function fetchLeaveWindowTasks(supabase, userName, fromDate, toDate) {
  if (!userName || !fromDate || !toDate) return [];
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_date, accepted_at, is_held, resumed_at, accumulated_seconds, status")
    .eq("assigned_to", userName)
    .neq("status", "completed")
    .neq("status", "not_applicable")
    .gte("due_date", fromDate)
    .lte("due_date", toDate);
  return data || [];
}

/**
 * Runs once a leave is fully approved (proxy + admin/approvers): applies the
 * task_action the employee chose when applying (default: send to proxy).
 * Returns a short message describing what happened, or "" if nothing to do.
 */
export async function applyLeaveTaskAction(supabase, leave) {
  const action = leave.task_action || "proxy";
  const tasks = await fetchLeaveWindowTasks(supabase, leave.user_name, leave.from_date, leave.to_date);
  if (!tasks.length) return "";
  const ids = tasks.map((t) => t.id);
  const plural = `${tasks.length} task${tasks.length > 1 ? "s" : ""}`;

  if (action === "reschedule") {
    await supabase.from("tasks").update({ due_date: nextDay(leave.to_date) }).in("id", ids);
    return `${plural} rescheduled to ${nextDay(leave.to_date)}.`;
  }

  if (action === "hold") {
    const nowIso = new Date().toISOString();
    const running = tasks.filter((t) => t.accepted_at && !t.is_held);
    await Promise.all(
      running.map((t) => {
        const lastStart = t.resumed_at || t.accepted_at;
        const elapsed = Math.max(Math.floor((Date.now() - new Date(lastStart).getTime()) / 1000), 0);
        return supabase
          .from("tasks")
          .update({ is_held: true, hold_started_at: nowIso, accumulated_seconds: (t.accumulated_seconds || 0) + elapsed })
          .eq("id", t.id);
      }),
    );
    return `${running.length} running task${running.length === 1 ? "" : "s"} put on hold for the leave.`;
  }

  if (!leave.proxy_user_name) return "";
  await supabase.from("tasks").update({ assigned_to: leave.proxy_user_name }).in("id", ids);
  return `${plural} transferred to ${leave.proxy_name || leave.proxy_user_name} for the leave period.`;
}
