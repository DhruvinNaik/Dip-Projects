// Loads every table the Owner portal reads, and exports the computed metrics to Excel.
import * as XLSX from "xlsx";
import { supabase } from "../supabase";
import { dateKey, periodStartKey } from "./ownerMetrics";

const PAGE_SIZE = 1000;
// A paused or unreachable project can leave requests hanging; after this long a table counts as failed.
const REQUEST_TIMEOUT_MS = 15000;
// Event tables are limited to the last 13 months so the page stays fast.
const HISTORY_MONTHS = 13;

/** Reads every row of a query, one page at a time (Supabase returns at most 1000 rows per call). */
async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Database did not respond in time")), REQUEST_TIMEOUT_MS);
    let result;
    try {
      result = await buildQuery().range(from, from + PAGE_SIZE - 1).abortSignal(controller.signal);
    } finally {
      clearTimeout(timer);
    }
    const { data, error } = result;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Fetch the snapshot used by ownerMetrics. Each table loads independently: a failed table
 * becomes an entry in `errors` and an empty list, so the rest of the portal still works.
 * Columns are chosen explicitly so that secrets (passwords, bank details) are never fetched.
 */
export async function loadOwnerSnapshot() {
  const todayKey = dateKey(new Date());
  const since = periodStartKey(todayKey, HISTORY_MONTHS);

  const sources = {
    users: () => supabase.from("user_details").select("id, username, name, department, role, status, site_name, site_names").order("id"),
    profiles: () => supabase.from("hr_employee_profiles").select("user_name, emp_id, designation, joining_date, emp_type, company").order("id"),
    sites: () => supabase.from("site_details").select("*").order("id"),
    tasks: () => supabase.from("tasks").select("*").order("id"),
    taskInstances: () => supabase.from("recurring_task_instances").select("*").order("id"),
    attendance: () => supabase.from("attendance").select("id, user_name, date, status, clock_in, clock_out, clock_in_status").gte("date", since).order("id"),
    leaves: () => supabase.from("leaves").select("id, user_name, name, leave_type, from_date, to_date, status, created_at").order("id"),
    tickets: () => supabase.from("tickets").select("id, site_name, raised_by, status, created_at").order("id"),
    reschedules: () => supabase.from("reschedule_requests").select("id, status, created_at").order("id"),
    expenses: () => supabase.from("hr_expenses").select("id, user_name, employee_name, expense_date, category, amount, status, created_at").order("id"),
    insurance: () => supabase.from("hr_insurance").select("id, user_name, employee_name, insurance_type, provider, premium, sum_insured, renewal_date").order("id"),
    assets: () => supabase.from("hr_assets").select("id, asset_name, asset_type, user_name, employee_name, status, purchase_value").order("id"),
    dprs: () => supabase.from("dpr_reports").select("id, site, report_type, created_at").order("id"),
    siteReports: () => supabase.from("site_reports").select("id, site_name, created_at").order("id"),
    wprs: () => supabase.from("wpr_reports").select("id, site_name, created_at").order("id"),
    materialArrivals: () => supabase.from("site_material_arrivals").select("id, site_name, quantity, created_at").gte("created_at", `${since}T00:00:00`).order("id"),
  };

  const names = Object.keys(sources);
  const results = await Promise.allSettled(names.map((name) => fetchAll(sources[name])));

  const snapshot = {};
  const errors = [];
  results.forEach((result, i) => {
    const name = names[i];
    if (result.status === "fulfilled") {
      snapshot[name] = result.value;
    } else {
      snapshot[name] = [];
      errors.push({ source: name, message: result.reason?.message || String(result.reason) });
    }
  });

  // Recurring instances are tracked separately in the database but behave like tasks.
  snapshot.tasks = [...snapshot.tasks, ...snapshot.taskInstances];
  delete snapshot.taskInstances;

  return { snapshot, errors, loadedAt: new Date() };
}

/** Download the metrics as an Excel workbook, one sheet per section. */
export function exportOwnerWorkbook(metrics, fileLabel = "owner-report") {
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "No data" }]);
    XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
  };

  add("Summary", [
    { metric: "Active employees", value: metrics.employees.active },
    { metric: "Attendance rate", value: metrics.attendance.rate === null ? "" : Math.round(metrics.attendance.rate * 100) + "%" },
    { metric: "Open tasks", value: metrics.tasks.open },
    { metric: "Overdue tasks", value: metrics.tasks.overdue },
    { metric: "On-time completion", value: metrics.tasks.onTimeRate === null ? "" : Math.round(metrics.tasks.onTimeRate * 100) + "%" },
    { metric: "Active sites", value: metrics.projects.active },
    { metric: "Expenses in period", value: Math.round(metrics.finance.expenseTotalInPeriod) },
    { metric: "Monthly expense run-rate", value: metrics.finance.monthlyRunRate === null ? "" : Math.round(metrics.finance.monthlyRunRate) },
    { metric: "Open tickets", value: metrics.operations.ticketsOpen },
    { metric: "Period (months)", value: metrics.meta.months },
    { metric: "As of", value: metrics.meta.asOfKey },
  ]);
  add("Insights", metrics.insights.map((i) => ({ level: i.level, title: i.title, detail: i.detail })));
  add("Employees", metrics.employees.rows.map((e) => ({
    name: e.name,
    username: e.username,
    department: e.department,
    role: e.role,
    site: e.site,
    presentDays: e.presentDays,
    expectedDays: e.expectedDays,
    attendancePct: e.attendanceRate === null ? "" : Math.round(e.attendanceRate * 100),
    lateDays: e.lateDays,
    approvedLeaveDays: e.approvedLeaveDays,
    openTasks: e.openTasks,
    overdueTasks: e.overdueTasks,
    completedTasks: e.completedTasks,
  })));
  add("Projects", metrics.projects.rows.map((p) => ({
    site: p.name,
    client: p.client,
    jobNo: p.jobNo,
    status: p.status,
    openTasks: p.openTasks,
    overdueTasks: p.overdueTasks,
    completedTasks: p.completedTasks,
    dprReports: p.dprReports,
    siteReports: p.siteReports,
    wprReports: p.wprReports,
    materialQuantity: p.materialQuantity,
    openTickets: p.openTickets,
    lastActivity: p.lastActivity || "",
  })));
  add("Overdue tasks", metrics.tasks.overdueList.map((t) => ({
    title: t.title,
    assignee: t.assigneeName,
    site: t.site,
    dueDate: t.dueDate,
    daysOverdue: t.daysOverdue,
    priority: t.priority,
  })));
  add("Expenses by month", metrics.finance.monthlyExpenses.map((m) => ({
    month: m.label,
    total: Math.round(m.total),
    approved: Math.round(m.approved),
    reimbursed: Math.round(m.reimbursed),
    pending: Math.round(m.pending),
    rejected: Math.round(m.rejected),
  })));
  add("Insurance renewals", metrics.finance.insurance.upcomingRenewals.map((r) => ({
    employee: r.employee,
    type: r.type,
    provider: r.provider,
    renewalDate: r.renewalDate,
    daysLeft: r.daysLeft,
    premium: r.premium,
  })));
  add("Monthly trend", metrics.attendance.trend.map((a, i) => ({
    month: a.label,
    attendancePct: a.rate === null ? "" : Math.round(a.rate * 100),
    tasksCreated: metrics.tasks.monthly[i]?.created ?? "",
    tasksCompleted: metrics.tasks.monthly[i]?.completed ?? "",
    leavesApproved: metrics.operations.leavesMonthly[i]?.approved ?? "",
    leavesPending: metrics.operations.leavesMonthly[i]?.pending ?? "",
  })));

  const stamp = dateKey(new Date());
  XLSX.writeFile(wb, `${fileLabel}-${stamp}.xlsx`);
}
