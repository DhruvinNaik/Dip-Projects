import { computeOwnerMetrics, workingDaysBetween, periodStartKey, monthKeysEndingAt } from "./ownerMetrics";

// Fixed "today": Friday 16 Oct 2026, local time.
const ASOF = new Date(2026, 9, 16, 12, 0, 0);

const users = [
  { username: "a", name: "Asha", department: "site engineer", status: "Active", site_name: "Site A" },
  { username: "b", name: "Bilal", department: "engineer office", status: "Active", site_name: "Site B" },
  { username: "c", name: "Chitra", department: "hr", status: "Inactive" },
];

describe("date helpers", () => {
  test("working days skip Sundays", () => {
    // 12 Oct 2026 is a Monday, 18 Oct is a Sunday: Mon..Sat = 6 days, plus Sun excluded.
    expect(workingDaysBetween("2026-10-12", "2026-10-18")).toBe(6);
  });

  test("period start steps back whole months", () => {
    expect(periodStartKey("2026-10-16", 3)).toBe("2026-07-16");
  });

  test("month keys end with the as-of month", () => {
    expect(monthKeysEndingAt("2026-10-16", 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });
});

describe("computeOwnerMetrics", () => {
  test("headcount counts inactive users separately", () => {
    const m = computeOwnerMetrics({ users }, { months: 3, asOf: ASOF });
    expect(m.employees.total).toBe(3);
    expect(m.employees.active).toBe(2);
    expect(m.employees.inactive).toBe(1);
  });

  test("overdue counts only open tasks past their due date", () => {
    const tasks = [
      { id: 1, status: "pending", due_date: "2026-10-10", assigned_to: "a" }, // overdue
      { id: 2, status: "in_progress", due_date: "2026-10-20", assigned_to: "a" }, // open, not due
      { id: 3, status: "completed", due_date: "2026-10-01", completed_at: "2026-10-01T10:00:00", assigned_to: "a" }, // done
      { id: 4, status: "rejected", due_date: "2026-10-01", assigned_to: "b" }, // closed, not overdue
    ];
    const m = computeOwnerMetrics({ users, tasks }, { months: 3, asOf: ASOF });
    expect(m.tasks.open).toBe(2);
    expect(m.tasks.overdue).toBe(1);
    expect(m.tasks.overdueList[0].daysOverdue).toBe(6);
  });

  test("on-time rate compares completion day with due date", () => {
    const tasks = [
      { id: 1, status: "completed", due_date: "2026-10-05", completed_at: "2026-10-05T17:00:00", assigned_to: "a" }, // on time
      { id: 2, status: "completed", due_date: "2026-10-05", completed_at: "2026-10-07T09:00:00", assigned_to: "a" }, // late
    ];
    const m = computeOwnerMetrics({ users, tasks }, { months: 3, asOf: ASOF });
    expect(m.tasks.completedInPeriod).toBe(2);
    expect(m.tasks.onTimeRate).toBe(0.5);
  });

  test("attendance rate uses present days over expected working days", () => {
    // Period 16 Jul to 16 Oct; expected days is the working-day count in that window.
    const expected = workingDaysBetween("2026-07-16", "2026-10-16");
    const attendance = [];
    for (let i = 0; i < 10; i += 1) attendance.push({ user_name: "a", date: `2026-10-${String(i + 1).padStart(2, "0")}`, status: "present" });
    const m = computeOwnerMetrics({ users, attendance }, { months: 3, asOf: ASOF });
    const row = m.employees.rows.find((r) => r.username === "a");
    expect(row.presentDays).toBe(10);
    expect(row.expectedDays).toBe(expected);
    expect(row.attendanceRate).toBeCloseTo(10 / expected, 5);
  });

  test("expenses are filtered to the period and grouped by status", () => {
    const expenses = [
      { id: 1, amount: 1000, status: "Approved", expense_date: "2026-10-02", category: "Travel" },
      { id: 2, amount: 500, status: "Pending", expense_date: "2026-09-02", category: "Food" },
      { id: 3, amount: 9999, status: "Approved", expense_date: "2025-01-02", category: "Travel" }, // outside period
    ];
    const m = computeOwnerMetrics({ users, expenses }, { months: 3, asOf: ASOF });
    expect(m.finance.expenseTotalInPeriod).toBe(1500);
    expect(m.finance.expenseByStatus.Approved).toBe(1000);
    expect(m.finance.expenseCountPending).toBe(1);
  });

  test("insurance renewals inside 60 days are listed, sorted soonest first", () => {
    const insurance = [
      { id: 1, employee_name: "Late", renewal_date: "2026-12-01", premium: 100 }, // 46 days
      { id: 2, employee_name: "Soon", renewal_date: "2026-10-25", premium: 200 }, // 9 days
      { id: 3, employee_name: "Far", renewal_date: "2027-06-01", premium: 300 }, // outside window
    ];
    const m = computeOwnerMetrics({ users, insurance }, { months: 3, asOf: ASOF });
    expect(m.finance.insurance.upcomingRenewals.map((r) => r.employee)).toEqual(["Soon", "Late"]);
    expect(m.finance.insurance.upcomingRenewals[0].daysLeft).toBe(9);
  });

  test("idle active sites are flagged, completed sites are not", () => {
    const sites = [
      { site_name: "Quiet", status: "Active" },
      { site_name: "Done", status: "Completed" },
    ];
    const m = computeOwnerMetrics({ users, sites }, { months: 3, asOf: ASOF });
    expect(m.projects.active).toBe(1);
    expect(m.projects.idle.map((p) => p.name)).toEqual(["Quiet"]);
  });

  test("empty snapshot produces zeros and no insights", () => {
    const m = computeOwnerMetrics({}, { months: 3, asOf: ASOF });
    expect(m.employees.active).toBe(0);
    expect(m.tasks.open).toBe(0);
    expect(m.attendance.rate).toBeNull();
    expect(m.insights).toEqual([]);
  });
});
