// Pure calculations for the Owner portal. No React, no Supabase calls.
// Every number on the Owner screens comes from here so it can be unit-tested.

const CLOSED_TASK_STATUSES = ["completed", "rejected", "not_applicable"];
const IDLE_SITE_DAYS = 30; // an active site with no activity for this long is flagged

export const PERIOD_OPTIONS = [
  { value: 1, label: "Last 1 month" },
  { value: 3, label: "Last 3 months" },
  { value: 6, label: "Last 6 months" },
  { value: 12, label: "Last 12 months" },
];

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. Accepts Date, ISO timestamps or YYYY-MM-DD strings. */
export function dateKey(input) {
  if (!input) return null;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** The same day `months` earlier, as YYYY-MM-DD. */
export function periodStartKey(asOfKey, months) {
  const d = keyToDate(asOfKey);
  d.setMonth(d.getMonth() - months);
  return dateKey(d);
}

/** Last day of the calendar month `monthKey` (YYYY-MM), as YYYY-MM-DD. */
function monthEndKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return dateKey(new Date(y, m, 0));
}

/** Working days (Monday to Saturday; Sundays are off) between two keys, inclusive. */
export function workingDaysBetween(startKey, endKey) {
  if (!startKey || !endKey || startKey > endKey) return 0;
  let count = 0;
  let cursor = startKey;
  while (cursor <= endKey) {
    if (keyToDate(cursor).getDay() !== 0) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** The last n calendar months ending with the month of asOfKey, e.g. ["2026-05", ..., "2026-10"]. */
export function monthKeysEndingAt(asOfKey, n) {
  const d = keyToDate(asOfKey);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${pad(m.getMonth() + 1)}`);
  }
  return out;
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

const norm = (v) => String(v || "").trim().toLowerCase();
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const dayPart = (v) => (v ? String(v).slice(0, 10) : null);

/** Days from aKey to bKey (b - a). */
function daysBetween(aKey, bKey) {
  return Math.round((keyToDate(bKey) - keyToDate(aKey)) / 86400000);
}

export const isActiveUser = (u) => norm(u.status) !== "inactive";
export const taskIsCompleted = (t) => norm(t.status) === "completed";
export const taskIsOpen = (t) => !CLOSED_TASK_STATUSES.includes(norm(t.status));
export const taskIsOverdue = (t, asOfKey) =>
  taskIsOpen(t) && !!dayPart(t.due_date) && dayPart(t.due_date) < asOfKey;

/** Completion date of a task (local date), or null when it has not been completed. */
const completionKey = (t) => dateKey(t.completed_at || t.completion_date);
const finishedOnTime = (t) => completionKey(t) <= (dayPart(t.due_date) || "9999-12-31");

function countBy(rows, keyFn) {
  const out = {};
  rows.forEach((r) => {
    const k = keyFn(r) || "Unknown";
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

function sumBy(rows, keyFn, valueFn) {
  const out = {};
  rows.forEach((r) => {
    const k = keyFn(r) || "Unknown";
    out[k] = (out[k] || 0) + valueFn(r);
  });
  return out;
}

const sortedEntries = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

/**
 * Build every Owner-portal metric.
 * snapshot: { users, profiles, sites, tasks, attendance, leaves, tickets, reschedules,
 *             expenses, insurance, assets, dprs, siteReports, wprs, materialArrivals }
 * Missing lists are treated as empty.
 * Event data (attendance, leaves, expenses, tickets, reports, completions) is filtered to the
 * selected period. Backlog figures (open and overdue tasks, idle sites) are always as of today.
 */
export function computeOwnerMetrics(snapshot = {}, { months = 3, asOf = new Date() } = {}) {
  const s = {
    users: [], profiles: [], sites: [], tasks: [], attendance: [], leaves: [],
    tickets: [], reschedules: [], expenses: [], insurance: [], assets: [],
    dprs: [], siteReports: [], wprs: [], materialArrivals: [],
    ...snapshot,
  };
  const asOfKey = dateKey(asOf);
  const start = periodStartKey(asOfKey, months);
  const inPeriod = (key) => !!key && key >= start && key <= asOfKey;
  const trendMonths = monthKeysEndingAt(asOfKey, months);

  // ---- Employees and attendance ------------------------------------------
  const activeUsers = s.users.filter(isActiveUser);
  const profileByUser = Object.fromEntries(s.profiles.map((p) => [p.user_name, p]));
  const usersByName = Object.fromEntries(s.users.map((u) => [u.username, u]));

  const isPresentRecord = (a) => norm(a.status) === "present" || !!a.clock_in;
  const attendanceInPeriod = s.attendance.filter((a) => inPeriod(dayPart(a.date)));
  const presentDatesByUser = {};
  attendanceInPeriod.forEach((a) => {
    if (!isPresentRecord(a)) return;
    (presentDatesByUser[a.user_name] ||= new Set()).add(dayPart(a.date));
  });
  const lateByUser = countBy(
    attendanceInPeriod.filter((a) => norm(a.clock_in_status) === "late"),
    (a) => a.user_name,
  );

  const approvedLeaveDays = {};
  s.leaves
    .filter((l) => norm(l.status) === "approved" && inPeriod(dayPart(l.from_date || l.created_at)))
    .forEach((l) => {
      const from = dayPart(l.from_date);
      const to = dayPart(l.to_date) || from;
      const days = Math.max(1, daysBetween(from, to) + 1);
      approvedLeaveDays[l.user_name] = (approvedLeaveDays[l.user_name] || 0) + days;
    });

  const taskSummaryByUser = {};
  s.tasks.forEach((t) => {
    if (!t.assigned_to) return;
    const row = (taskSummaryByUser[t.assigned_to] ||= { open: 0, overdue: 0, completed: 0, onTime: 0 });
    if (taskIsOpen(t)) {
      row.open += 1;
      if (taskIsOverdue(t, asOfKey)) row.overdue += 1;
    }
    if (taskIsCompleted(t) && inPeriod(completionKey(t))) {
      row.completed += 1;
      if (finishedOnTime(t)) row.onTime += 1;
    }
  });

  const employeeRows = activeUsers.map((u) => {
    const profile = profileByUser[u.username] || {};
    const joined = dayPart(profile.joining_date);
    // Someone who joined mid-period is only expected to attend from their joining date.
    const windowStart = joined && joined > start ? joined : start;
    const expected = workingDaysBetween(windowStart, asOfKey);
    const present = presentDatesByUser[u.username]?.size || 0;
    const task = taskSummaryByUser[u.username] || { open: 0, overdue: 0, completed: 0, onTime: 0 };
    return {
      username: u.username,
      name: u.name || u.username,
      department: u.department || "",
      role: u.role || "",
      site: u.site_name || (Array.isArray(u.site_names) ? u.site_names.join(", ") : ""),
      designation: profile.designation || "",
      joiningDate: joined,
      presentDays: present,
      expectedDays: expected,
      attendanceRate: expected > 0 ? Math.min(1, present / expected) : null,
      lateDays: lateByUser[u.username] || 0,
      approvedLeaveDays: approvedLeaveDays[u.username] || 0,
      openTasks: task.open,
      overdueTasks: task.overdue,
      completedTasks: task.completed,
      onTimeRate: task.completed ? task.onTime / task.completed : null,
    };
  });

  const employees = {
    total: s.users.length,
    active: activeUsers.length,
    inactive: s.users.length - activeUsers.length,
    byDepartment: sortedEntries(countBy(activeUsers, (u) => u.department || "Unassigned")),
    rows: employeeRows.sort((a, b) => a.name.localeCompare(b.name)),
    lowAttendance: employeeRows.filter((e) => e.attendanceRate !== null && e.attendanceRate < 0.6),
  };

  const totalExpectedDays = employeeRows.reduce((sum, e) => sum + e.expectedDays, 0);
  const totalPresentDays = employeeRows.reduce((sum, e) => sum + e.presentDays, 0);
  const attendanceTrend = trendMonths.map((mk) => {
    const monthStart = `${mk}-01`;
    const monthEnd = monthEndKey(mk) > asOfKey ? asOfKey : monthEndKey(mk);
    const expected = activeUsers.length * workingDaysBetween(monthStart, monthEnd);
    const present = s.attendance.filter((a) => dayPart(a.date)?.startsWith(mk) && isPresentRecord(a)).length;
    return {
      month: mk,
      label: monthLabel(mk),
      rate: expected > 0 ? Math.min(1, present / expected) : null,
    };
  });
  const attendance = {
    rate: totalExpectedDays > 0 ? Math.min(1, totalPresentDays / totalExpectedDays) : null,
    presentDays: totalPresentDays,
    expectedDays: totalExpectedDays,
    lateDays: Object.values(lateByUser).reduce((a, b) => a + b, 0),
    trend: attendanceTrend,
  };

  // ---- Tasks ----------------------------------------------------------------
  const openTasks = s.tasks.filter(taskIsOpen);
  const overdueTasks = openTasks.filter((t) => taskIsOverdue(t, asOfKey));
  const completedInPeriod = s.tasks.filter((t) => taskIsCompleted(t) && inPeriod(completionKey(t)));
  const onTimeCount = completedInPeriod.filter(finishedOnTime).length;
  const createdInPeriod = s.tasks.filter((t) => inPeriod(dateKey(t.created_at)));

  const tasks = {
    total: s.tasks.length,
    open: openTasks.length,
    overdue: overdueTasks.length,
    completedInPeriod: completedInPeriod.length,
    createdInPeriod: createdInPeriod.length,
    onTimeRate: completedInPeriod.length ? onTimeCount / completedInPeriod.length : null,
    completionRate: createdInPeriod.length
      ? createdInPeriod.filter(taskIsCompleted).length / createdInPeriod.length
      : null,
    byStatus: sortedEntries(countBy(s.tasks, (t) => norm(t.status) || "unknown")),
    overdueList: overdueTasks
      .map((t) => ({
        id: t.id,
        title: t.title || "Untitled",
        assignee: t.assigned_to,
        assigneeName: usersByName[t.assigned_to]?.name || t.assigned_to || "",
        site: t.site_name || "",
        dueDate: dayPart(t.due_date),
        daysOverdue: daysBetween(dayPart(t.due_date), asOfKey),
        priority: t.priority || "",
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue),
    monthly: trendMonths.map((mk) => ({
      month: mk,
      label: monthLabel(mk),
      created: s.tasks.filter((t) => dateKey(t.created_at)?.startsWith(mk)).length,
      completed: s.tasks.filter((t) => taskIsCompleted(t) && completionKey(t)?.startsWith(mk)).length,
    })),
    byAssignee: Object.entries(taskSummaryByUser)
      .map(([who, v]) => ({ username: who, name: usersByName[who]?.name || who, ...v }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open),
  };

  // ---- Sites / projects -----------------------------------------------------
  const reportsInPeriodBySite = (rows, siteField) =>
    countBy(
      rows.filter((r) => inPeriod(dateKey(r.created_at))),
      (r) => r[siteField],
    );
  const dprBySite = reportsInPeriodBySite(s.dprs, "site");
  const svrBySite = reportsInPeriodBySite(s.siteReports, "site_name");
  const wprBySite = reportsInPeriodBySite(s.wprs, "site_name");
  const materialBySite = sumBy(
    s.materialArrivals.filter((m) => inPeriod(dateKey(m.created_at))),
    (m) => m.site_name,
    (m) => num(m.quantity),
  );
  const openTicketsBySite = countBy(
    s.tickets.filter((t) => norm(t.status) !== "solved"),
    (t) => t.site_name,
  );

  const lastActivityBySite = {};
  const touch = (site, key) => {
    if (!site || !key) return;
    if (!lastActivityBySite[site] || key > lastActivityBySite[site]) lastActivityBySite[site] = key;
  };
  s.tasks.forEach((t) => touch(t.site_name, dateKey(t.completed_at || t.created_at)));
  [...s.dprs, ...s.siteReports, ...s.wprs].forEach((r) => touch(r.site || r.site_name, dateKey(r.created_at)));
  s.materialArrivals.forEach((m) => touch(m.site_name, dateKey(m.created_at)));

  const siteRows = s.sites.map((site) => {
    const name = site.site_name;
    const siteTasks = s.tasks.filter((t) => t.site_name === name);
    const open = siteTasks.filter(taskIsOpen);
    const last = lastActivityBySite[name] || null;
    const status = norm(site.status);
    return {
      name,
      client: site.client_name || "",
      jobNo: site.job_no || "",
      status: site.status || "",
      headName: site.head_name || "",
      startedDate: dayPart(site.started_date),
      openTasks: open.length,
      overdueTasks: open.filter((t) => taskIsOverdue(t, asOfKey)).length,
      completedTasks: siteTasks.filter(taskIsCompleted).length,
      dprReports: dprBySite[name] || 0,
      siteReports: svrBySite[name] || 0,
      wprReports: wprBySite[name] || 0,
      materialQuantity: materialBySite[name] || 0,
      openTickets: openTicketsBySite[name] || 0,
      lastActivity: last,
      idleDays: last ? daysBetween(last, asOfKey) : null,
      isActive: !["completed", "closed", "inactive"].includes(status),
    };
  });

  const projects = {
    total: s.sites.length,
    active: siteRows.filter((r) => r.isActive).length,
    rows: siteRows.sort((a, b) => b.openTasks - a.openTasks || a.name.localeCompare(b.name)),
    idle: siteRows.filter((r) => r.isActive && (r.idleDays === null || r.idleDays > IDLE_SITE_DAYS)),
  };

  // ---- Finance ----------------------------------------------------------------
  const expenseDay = (e) => dayPart(e.expense_date || e.created_at);
  const expensesInPeriod = s.expenses.filter((e) => inPeriod(expenseDay(e)));
  const statusOf = (e) => e.status || "Pending";

  const monthlyExpenses = trendMonths.map((mk) => {
    const rows = s.expenses.filter((e) => expenseDay(e)?.startsWith(mk));
    const sum = (pred) => rows.filter(pred).reduce((total, e) => total + num(e.amount), 0);
    return {
      month: mk,
      label: monthLabel(mk),
      total: sum(() => true),
      approved: sum((e) => statusOf(e) === "Approved"),
      reimbursed: sum((e) => statusOf(e) === "Reimbursed"),
      pending: sum((e) => statusOf(e) === "Pending"),
      rejected: sum((e) => statusOf(e) === "Rejected"),
    };
  });
  // Run-rate: average monthly claims (excluding rejected) over the last three complete months.
  const completedMonths = monthlyExpenses.slice(-4, -1);
  const monthlyRunRate = completedMonths.length
    ? completedMonths.reduce((total, m) => total + (m.total - m.rejected), 0) / completedMonths.length
    : null;

  const renewalWindowEnd = addDays(asOfKey, 60);
  const upcomingRenewals = s.insurance
    .filter((p) => dayPart(p.renewal_date) >= asOfKey && dayPart(p.renewal_date) <= renewalWindowEnd)
    .map((p) => ({
      id: p.id,
      employee: p.employee_name || p.user_name || "",
      type: p.insurance_type || "",
      provider: p.provider || "",
      renewalDate: dayPart(p.renewal_date),
      daysLeft: daysBetween(asOfKey, dayPart(p.renewal_date)),
      premium: num(p.premium),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const finance = {
    expenseTotalInPeriod: expensesInPeriod.reduce((total, e) => total + num(e.amount), 0),
    expenseByStatus: sumBy(expensesInPeriod, statusOf, (e) => num(e.amount)),
    expenseCountPending: expensesInPeriod.filter((e) => statusOf(e) === "Pending").length,
    expenseByCategory: sortedEntries(sumBy(expensesInPeriod, (e) => e.category, (e) => num(e.amount))),
    monthlyExpenses,
    monthlyRunRate,
    projectedNext12Months: monthlyRunRate !== null ? monthlyRunRate * 12 : null,
    insurance: {
      policies: s.insurance.length,
      totalPremium: s.insurance.reduce((total, p) => total + num(p.premium), 0),
      totalSumInsured: s.insurance.reduce((total, p) => total + num(p.sum_insured), 0),
      upcomingRenewals,
    },
    assets: {
      count: s.assets.length,
      totalValue: s.assets.reduce((total, a) => total + num(a.purchase_value), 0),
      byStatus: sortedEntries(countBy(s.assets, (a) => a.status || "Unknown")),
      unassigned: s.assets.filter((a) => !a.user_name && norm(a.status) !== "retired").length,
    },
  };

  // ---- Operations -------------------------------------------------------------
  const leavesMonthly = trendMonths.map((mk) => {
    const rows = s.leaves.filter((l) => dayPart(l.from_date || l.created_at)?.startsWith(mk));
    return {
      month: mk,
      label: monthLabel(mk),
      approved: rows.filter((l) => norm(l.status) === "approved").length,
      pending: rows.filter((l) => norm(l.status) === "pending").length,
      rejected: rows.filter((l) => norm(l.status) === "rejected").length,
    };
  });

  const reportsMonthly = trendMonths.map((mk) => {
    const inMonth = (rows) => rows.filter((r) => dateKey(r.created_at)?.startsWith(mk)).length;
    return {
      month: mk,
      label: monthLabel(mk),
      dpr: inMonth(s.dprs),
      siteReport: inMonth(s.siteReports),
      wpr: inMonth(s.wprs),
    };
  });

  const ticketsInPeriod = s.tickets.filter((t) => inPeriod(dateKey(t.created_at)));
  const reschedulesInPeriod = s.reschedules.filter((r) => inPeriod(dateKey(r.created_at)));
  const operations = {
    leavesInPeriod: leavesMonthly.reduce((total, m) => total + m.approved + m.pending + m.rejected, 0),
    leavesPending: s.leaves.filter((l) => norm(l.status) === "pending").length,
    leavesByStatus: sortedEntries(countBy(s.leaves.filter((l) => inPeriod(dayPart(l.from_date || l.created_at))), (l) => norm(l.status) || "unknown")),
    leavesMonthly,
    ticketsRaised: ticketsInPeriod.length,
    ticketsOpen: s.tickets.filter((t) => norm(t.status) !== "solved").length,
    ticketsByStatus: sortedEntries(countBy(ticketsInPeriod, (t) => norm(t.status) || "unknown")),
    reschedulesPending: s.reschedules.filter((r) => norm(r.status) === "pending").length,
    reschedulesByStatus: sortedEntries(countBy(reschedulesInPeriod, (r) => norm(r.status) || "unknown")),
    reportsMonthly,
    reportsInPeriod: [...s.dprs, ...s.siteReports, ...s.wprs].filter((r) => inPeriod(dateKey(r.created_at))).length,
  };

  // ---- Planning: rule-based signals -------------------------------------------
  const insights = [];
  if (tasks.overdue > 0) {
    const worst = tasks.byAssignee.find((a) => a.overdue > 0);
    insights.push({
      level: tasks.overdue >= 10 ? "high" : "medium",
      tab: "tasks",
      title: `${tasks.overdue} overdue task${tasks.overdue === 1 ? "" : "s"}`,
      detail: `${tasks.open} tasks are open in total.${worst ? ` Most overdue: ${worst.name} (${worst.overdue}).` : ""}`,
    });
  }
  if (tasks.onTimeRate !== null && tasks.onTimeRate < 0.7) {
    insights.push({
      level: "high",
      tab: "tasks",
      title: `On-time completion is ${Math.round(tasks.onTimeRate * 100)}%`,
      detail: `${onTimeCount} of ${completedInPeriod.length} tasks completed in the period were finished by their due date.`,
    });
  }
  if (attendance.rate !== null && attendance.rate < 0.85) {
    insights.push({
      level: attendance.rate < 0.75 ? "high" : "medium",
      tab: "employees",
      title: `Attendance is ${Math.round(attendance.rate * 100)}% in the period`,
      detail: `${employees.lowAttendance.length} active employee${employees.lowAttendance.length === 1 ? "" : "s"} below 60% attendance.`,
    });
  }
  if (projects.idle.length) {
    insights.push({
      level: "medium",
      tab: "projects",
      title: `${projects.idle.length} active site${projects.idle.length === 1 ? "" : "s"} with no recent activity`,
      detail: `No tasks or reports for more than ${IDLE_SITE_DAYS} days: ${projects.idle.slice(0, 4).map((p) => p.name).join(", ")}${projects.idle.length > 4 ? "…" : ""}.`,
    });
  }
  if (finance.expenseCountPending > 0) {
    insights.push({
      level: finance.expenseCountPending >= 5 ? "medium" : "info",
      tab: "finance",
      title: `${finance.expenseCountPending} expense claim${finance.expenseCountPending === 1 ? "" : "s"} awaiting approval`,
      detail: `Pending amount in the period: ₹${Math.round(finance.expenseByStatus.Pending || 0).toLocaleString("en-IN")}.`,
    });
  }
  if (upcomingRenewals.length) {
    const next = upcomingRenewals[0];
    insights.push({
      level: upcomingRenewals.some((r) => r.daysLeft <= 15) ? "high" : "medium",
      tab: "finance",
      title: `${upcomingRenewals.length} insurance renewal${upcomingRenewals.length === 1 ? "" : "s"} within 60 days`,
      detail: `Next: ${next.employee} (${next.type || "policy"}) on ${next.renewalDate}.`,
    });
  }
  if (operations.leavesPending > 0) {
    insights.push({
      level: "info",
      tab: "operations",
      title: `${operations.leavesPending} leave request${operations.leavesPending === 1 ? "" : "s"} pending`,
      detail: "Leave requests waiting for a decision across the company.",
    });
  }
  if (finance.assets.unassigned > 0) {
    insights.push({
      level: "info",
      tab: "finance",
      title: `${finance.assets.unassigned} company asset${finance.assets.unassigned === 1 ? "" : "s"} not assigned`,
      detail: `Assets with no holder and not retired. Recorded asset value: ₹${Math.round(finance.assets.totalValue).toLocaleString("en-IN")}.`,
    });
  }
  const levelRank = { high: 0, medium: 1, info: 2 };
  insights.sort((a, b) => levelRank[a.level] - levelRank[b.level]);

  // ---- Capacity (for planning hiring and project load) ---------------------------
  const throughputPerMonth = months ? completedInPeriod.length / months : null;
  const capacity = {
    openTasksPerEmployee: employees.active ? tasks.open / employees.active : null,
    activeSitesPerEmployee: employees.active ? projects.active / employees.active : null,
    throughputPerMonth,
    backlogMonths: throughputPerMonth ? tasks.open / throughputPerMonth : null,
  };

  return {
    meta: { asOfKey, periodStart: start, months, generatedAt: new Date().toISOString() },
    employees,
    attendance,
    tasks,
    projects,
    finance,
    operations,
    capacity,
    insights,
  };
}
