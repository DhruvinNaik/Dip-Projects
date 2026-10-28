import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { isAdminUser, isOwnerUser } from "../access.js";
import { PERIOD_OPTIONS, computeOwnerMetrics, monthLabel } from "../lib/ownerMetrics";
import { loadOwnerSnapshot, exportOwnerWorkbook } from "../lib/ownerData";
import { BarChart, LineChart, DonutChart, HBarList, KpiTile, SERIES_COLORS, STATUS_COLORS } from "../components/owner/OwnerCharts";
import "./OwnerPortal.css";
import { applyPlugin } from "jspdf-autotable";

const TABS = [
  { key: "overview", label: "Overview", title: "Company overview", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { key: "employees", label: "Employees", title: "Employees", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "tasks", label: "Tasks", title: "Tasks", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { key: "projects", label: "Projects & Sites", title: "Projects & sites", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1M10 21v-4h4v4" },
  { key: "finance", label: "Finance", title: "Finance", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { key: "operations", label: "Operations", title: "Operations", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { key: "planning", label: "Planning", title: "Planning", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
];

function NavIcon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const SEVERITY = {
  high: { label: "High", color: STATUS_COLORS.critical, icon: "●" },
  medium: { label: "Medium", color: STATUS_COLORS.warning, icon: "▲" },
  info: { label: "Info", color: SERIES_COLORS[0], icon: "ℹ" },
};

const inr = (v) => (Number.isFinite(v) ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—");
const count = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString("en-IN") : "—");
const pct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
const titleCase = (s) => String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Section({ title, subtitle, children, action }) {
  return (
    <section className="ow-section">
      <header className="ow-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="ow-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Card({ title, subtitle, children, wide }) {
  return (
    <div className={`ow-card ${wide ? "ow-card-wide" : ""}`}>
      <div className="ow-card-head">
        <h3>{title}</h3>
        {subtitle && <span className="ow-muted">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function InsightList({ insights, onOpen }) {
  if (!insights.length) return <div className="ow-empty">No issues detected for this period.</div>;
  return (
    <ul className="ow-insights">
      {insights.map((i) => {
        const sev = SEVERITY[i.level] || SEVERITY.info;
        return (
          <li key={i.title} className="ow-insight" style={{ borderLeftColor: sev.color }}>
            <div className="ow-insight-main">
              <span className="ow-sev" style={{ color: sev.color }}>{sev.icon} {sev.label}</span>
              <strong>{i.title}</strong>
              <span className="ow-muted">{i.detail}</span>
            </div>
            {onOpen && (
              <button type="button" className="ow-link" onClick={() => onOpen(i.tab)}>View →</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function OverviewTab({ m, onOpen }) {
  const attendanceSeries = m.attendance.trend.map((t) => ({ label: t.label, value: t.rate }));
  const statusItems = m.tasks.byStatus.slice(0, 6).map(([k, v], i) => ({
    label: titleCase(k),
    value: v,
    color: SERIES_COLORS[i],
  }));
  const topSites = m.projects.rows.filter((r) => r.isActive).slice(0, 8).map((r) => ({
    label: r.name,
    value: r.openTasks,
    sub: `${r.overdueTasks} overdue · ${r.completedTasks} completed`,
  }));
  return (
    <>
      <div className="ow-kpis">
        <KpiTile label="Active employees" value={count(m.employees.active)} hint={`${m.employees.inactive} inactive`} />
        <KpiTile label="Attendance rate" value={pct(m.attendance.rate)} hint={`${m.attendance.lateDays} late check-ins`} tone={m.attendance.rate !== null && m.attendance.rate < 0.85 ? "warn" : null} />
        <KpiTile label="Open tasks" value={count(m.tasks.open)} hint={`${count(m.tasks.overdue)} overdue`} tone={m.tasks.overdue > 0 ? "warn" : null} />
        <KpiTile label="On-time completion" value={pct(m.tasks.onTimeRate)} hint={`${count(m.tasks.completedInPeriod)} completed in period`} />
        <KpiTile label="Active sites" value={count(m.projects.active)} hint={`${count(m.projects.total)} total · ${m.projects.idle.length} idle`} />
        <KpiTile label="Expenses (period)" value={inr(m.finance.expenseTotalInPeriod)} hint={`${m.finance.expenseCountPending} awaiting approval`} />
        <KpiTile label="Monthly spend run-rate" value={inr(m.finance.monthlyRunRate)} hint="avg of last 3 full months" />
        <KpiTile label="Open tickets" value={count(m.operations.ticketsOpen)} hint={`${count(m.operations.leavesPending)} leave requests pending`} />
      </div>

      <Section title="What needs attention" subtitle="Generated from the live data. Each item links to the tab with the detail." >
        <InsightList insights={m.insights.slice(0, 6)} onOpen={onOpen} />
      </Section>

      <Section title="Trends">
        <div className="ow-grid-2">
          <Card title="Attendance rate" subtitle="share of expected working days present">
            <LineChart data={attendanceSeries} percent color={SERIES_COLORS[0]} />
          </Card>
          <Card title="Task status" subtitle="all tasks, current">
            <DonutChart items={statusItems} centerLabel="tasks" />
          </Card>
          <Card title="Most open work by site" subtitle="active sites" wide>
            <HBarList items={topSites} emptyText="No active sites yet." />
          </Card>
        </div>
      </Section>
    </>
  );
}


function EmployeesTab({ m }) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const departments = [...new Set(m.employees.rows.map((e) => e.department).filter(Boolean))].sort();
  const rows = m.employees.rows.filter((e) => {
    const q = query.trim().toLowerCase();
    if (dept && e.department !== dept) return false;
    if (!q) return true;
    return [e.name, e.username, e.role, e.site, e.designation].some((v) => String(v).toLowerCase().includes(q));
  });
  return (
    <>
      <div className="ow-kpis">
        <KpiTile label="Active" value={count(m.employees.active)} />
        <KpiTile label="Inactive" value={count(m.employees.inactive)} />
        <KpiTile label="Attendance rate" value={pct(m.attendance.rate)} />
        <KpiTile label="Below 60% attendance" value={count(m.employees.lowAttendance.length)} tone={m.employees.lowAttendance.length ? "warn" : null} />
      </div>
      <div className="ow-grid-2">
        <Card title="Headcount by department" subtitle="active employees">
          <HBarList items={m.employees.byDepartment.map(([k, v]) => ({ label: titleCase(k), value: v }))} format={count} />
        </Card>
        <Card title="Who needs attention" subtitle="below 60% attendance, most overdue first">
          <ul className="ow-simple-list">
            {m.employees.lowAttendance.length === 0 && <li className="ow-muted">Everyone is above 60% attendance.</li>}
            {m.employees.lowAttendance.slice(0, 8).map((e) => (
              <li key={e.username}><strong>{e.name}</strong> <span className="ow-muted">{pct(e.attendanceRate)} attendance · {e.overdueTasks} overdue</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <Section title="Employee directory" subtitle={`${rows.length} shown`}>
        <div className="ow-toolbar">
          <input className="ow-input" placeholder="Search name, username, role, site…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="ow-input" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{titleCase(d)}</option>)}
          </select>
        </div>
        <div className="ow-table-wrap">
          <table className="ow-table">
            <thead>
              <tr>
                <th>Name</th><th>Department</th><th>Role</th><th>Site</th>
                <th className="num">Present / expected</th><th className="num">Attendance</th><th className="num">Late</th>
                <th className="num">Leave days</th><th className="num">Open</th><th className="num">Overdue</th><th className="num">Completed</th><th className="num">On time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.username} className={e.attendanceRate !== null && e.attendanceRate < 0.6 ? "ow-row-flag" : ""}>
                  <td><strong>{e.name}</strong><div className="ow-muted">{e.username}</div></td>
                  <td>{titleCase(e.department)}</td>
                  <td>{e.role || "—"}</td>
                  <td>{e.site || "—"}</td>
                  <td className="num">{e.presentDays} / {e.expectedDays}</td>
                  <td className="num">{pct(e.attendanceRate)}</td>
                  <td className="num">{e.lateDays}</td>
                  <td className="num">{e.approvedLeaveDays}</td>
                  <td className="num">{e.openTasks}</td>
                  <td className="num">{e.overdueTasks}</td>
                  <td className="num">{e.completedTasks}</td>
                  <td className="num">{pct(e.onTimeRate)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={12} className="ow-empty">No employees match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function TasksTab({ m }) {
  const statusItems = m.tasks.byStatus.slice(0, 6).map(([k, v], i) => ({ label: titleCase(k), value: v, color: SERIES_COLORS[i] }));
  const monthly = m.tasks.monthly.map((t) => ({ label: t.label, values: { created: t.created, completed: t.completed } }));
  return (
    <>
      <div className="ow-kpis">
        <KpiTile label="Total tasks" value={count(m.tasks.total)} />
        <KpiTile label="Open" value={count(m.tasks.open)} />
        <KpiTile label="Overdue" value={count(m.tasks.overdue)} tone={m.tasks.overdue ? "warn" : null} />
        <KpiTile label="Created in period" value={count(m.tasks.createdInPeriod)} />
        <KpiTile label="Completed in period" value={count(m.tasks.completedInPeriod)} />
        <KpiTile label="On-time completion" value={pct(m.tasks.onTimeRate)} />
        <KpiTile label="Completion rate" value={pct(m.tasks.completionRate)} hint="of tasks created in period" />
        <KpiTile label="Backlog" value={m.capacity.backlogMonths === null ? "—" : `${m.capacity.backlogMonths.toFixed(1)} mo`} hint="open ÷ monthly throughput" />
      </div>
      <div className="ow-grid-2">
        <Card title="Created vs completed" subtitle="per month" wide>
          <BarChart
            data={monthly}
            series={[{ key: "created", label: "Created", color: SERIES_COLORS[0] }, { key: "completed", label: "Completed", color: SERIES_COLORS[2] }]}
            format={count}
          />
        </Card>
        <Card title="Status mix" subtitle="all tasks">
          <DonutChart items={statusItems} centerLabel="tasks" />
        </Card>
        <Card title="Open work per person" subtitle="top 10 by overdue, then open">
          <HBarList
            items={m.tasks.byAssignee.filter((a) => a.open > 0).slice(0, 10).map((a) => ({ label: a.name, value: a.open, sub: `${a.overdue} overdue · ${a.completed} completed in period` }))}
            format={count}
            emptyText="No open tasks."
          />
        </Card>
      </div>
      <Section title="Overdue tasks" subtitle={`${m.tasks.overdueList.length} open tasks past their due date, most overdue first`}>
        <div className="ow-table-wrap">
          <table className="ow-table">
            <thead><tr><th>Task</th><th>Assigned to</th><th>Site</th><th>Due</th><th className="num">Days overdue</th><th>Priority</th></tr></thead>
            <tbody>
              {m.tasks.overdueList.slice(0, 100).map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td><td>{t.assigneeName}</td><td>{t.site || "—"}</td><td>{t.dueDate}</td>
                  <td className="num">{t.daysOverdue}</td><td>{titleCase(t.priority) || "—"}</td>
                </tr>
              ))}
              {!m.tasks.overdueList.length && <tr><td colSpan={6} className="ow-empty">Nothing overdue.</td></tr>}
            </tbody>
          </table>
        </div>
        {m.tasks.overdueList.length > 100 && <p className="ow-muted">Showing the first 100. Export to Excel for the full list.</p>}
      </Section>
    </>
  );
}

function ProjectsTab({ m }) {
  return (
    <>
      <div className="ow-kpis">
        <KpiTile label="Sites" value={count(m.projects.total)} />
        <KpiTile label="Active" value={count(m.projects.active)} />
        <KpiTile label="Idle over 30 days" value={count(m.projects.idle.length)} tone={m.projects.idle.length ? "warn" : null} />
        <KpiTile label="DPR + site + WPR reports" value={count(m.operations.reportsInPeriod)} hint="in period" />
      </div>
      <Card title="Open tasks by site" subtitle="active sites" wide>
        <HBarList
          items={m.projects.rows.filter((r) => r.openTasks > 0).slice(0, 12).map((r) => ({ label: r.name, value: r.openTasks, sub: `${r.overdueTasks} overdue` }))}
          format={count}
          emptyText="No open tasks on any site."
        />
      </Card>
      <Section title="All sites" subtitle="Reports and material counts are for the selected period. Task counts are current.">
        <div className="ow-table-wrap">
          <table className="ow-table">
            <thead>
              <tr>
                <th>Site</th><th>Client</th><th>Status</th><th className="num">Open</th><th className="num">Overdue</th>
                <th className="num">Completed</th><th className="num">DPR</th><th className="num">Site rpt</th><th className="num">WPR</th>
                <th className="num">Material qty</th><th className="num">Open tickets</th><th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {m.projects.rows.map((r) => (
                <tr key={r.name} className={r.isActive && r.idleDays !== null && r.idleDays > 30 ? "ow-row-flag" : ""}>
                  <td><strong>{r.name}</strong>{r.jobNo && <div className="ow-muted">Job {r.jobNo}</div>}</td>
                  <td>{r.client || "—"}</td>
                  <td>{r.status || "—"}</td>
                  <td className="num">{r.openTasks}</td>
                  <td className="num">{r.overdueTasks}</td>
                  <td className="num">{r.completedTasks}</td>
                  <td className="num">{r.dprReports}</td>
                  <td className="num">{r.siteReports}</td>
                  <td className="num">{r.wprReports}</td>
                  <td className="num">{count(r.materialQuantity)}</td>
                  <td className="num">{r.openTickets}</td>
                  <td>{r.lastActivity ? `${r.lastActivity} (${r.idleDays}d ago)` : "No activity"}</td>
                </tr>
              ))}
              {!m.projects.rows.length && <tr><td colSpan={12} className="ow-empty">No sites found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function FinanceTab({ m }) {
  const f = m.finance;
  const monthly = f.monthlyExpenses.map((x) => ({
    label: x.label,
    values: { approved: x.approved, reimbursed: x.reimbursed, pending: x.pending, rejected: x.rejected },
  }));
  const expenseSeries = [
    { key: "approved", label: "Approved", color: SERIES_COLORS[0] },
    { key: "reimbursed", label: "Reimbursed", color: SERIES_COLORS[2] },
    { key: "pending", label: "Pending", color: SERIES_COLORS[3] },
    { key: "rejected", label: "Rejected", color: SERIES_COLORS[4] },
  ];
  return (
    <>
      <div className="ow-kpis">
        <KpiTile label="Expense claims (period)" value={inr(f.expenseTotalInPeriod)} />
        <KpiTile label="Awaiting approval" value={count(f.expenseCountPending)} hint={inr(f.expenseByStatus.Pending || 0)} tone={f.expenseCountPending ? "warn" : null} />
        <KpiTile label="Reimbursed (period)" value={inr(f.expenseByStatus.Reimbursed || 0)} />
        <KpiTile label="Monthly run-rate" value={inr(f.monthlyRunRate)} hint="avg of last 3 full months, excl. rejected" />
        <KpiTile label="12-month projection" value={inr(f.projectedNext12Months)} hint="run-rate × 12, not a forecast" />
        <KpiTile label="Insurance premiums" value={inr(f.insurance.totalPremium)} hint={`${f.insurance.policies} policies`} />
        <KpiTile label="Asset value" value={inr(f.assets.totalValue)} hint={`${f.assets.count} assets`} />
        <KpiTile label="Unassigned assets" value={count(f.assets.unassigned)} />
      </div>
      <div className="ow-grid-2">
        <Card title="Expense claims by month" subtitle="stacked by status" wide>
          <BarChart data={monthly} series={expenseSeries} stacked format={inr} showValues={false} />
        </Card>
        <Card title="Spend by category" subtitle="period">
          <HBarList items={f.expenseByCategory.map(([k, v]) => ({ label: k, value: v }))} format={inr} emptyText="No expense claims in this period." />
        </Card>
        <Card title="Assets by status" subtitle="all assets">
          <HBarList items={f.assets.byStatus.map(([k, v]) => ({ label: titleCase(k), value: v }))} format={count} emptyText="No assets recorded." />
        </Card>
      </div>
      <Section title="Insurance renewals" subtitle="policies renewing in the next 60 days">
        <div className="ow-table-wrap">
          <table className="ow-table">
            <thead><tr><th>Employee</th><th>Type</th><th>Provider</th><th>Renewal</th><th className="num">Days left</th><th className="num">Premium</th></tr></thead>
            <tbody>
              {f.insurance.upcomingRenewals.map((r) => (
                <tr key={r.id} className={r.daysLeft <= 15 ? "ow-row-flag" : ""}>
                  <td>{r.employee}</td><td>{r.type || "—"}</td><td>{r.provider || "—"}</td><td>{r.renewalDate}</td>
                  <td className="num">{r.daysLeft}</td><td className="num">{inr(r.premium)}</td>
                </tr>
              ))}
              {!f.insurance.upcomingRenewals.length && <tr><td colSpan={6} className="ow-empty">No renewals due in the next 60 days.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
      <p className="ow-note">
        Not in this view because the database does not record them: site-level costs, material prices, invoices and budgets.
        Material arrivals are tracked by quantity only, so project cost cannot be computed yet.
      </p>
    </>
  );
}

function OperationsTab({ m }) {
  const o = m.operations;
  const leaveSeries = [
    { key: "approved", label: "Approved", color: SERIES_COLORS[2] },
    { key: "pending", label: "Pending", color: SERIES_COLORS[3] },
    { key: "rejected", label: "Rejected", color: SERIES_COLORS[7] },
  ];
  const leaveData = o.leavesMonthly.map((x) => ({ label: x.label, values: { approved: x.approved, pending: x.pending, rejected: x.rejected } }));
  const reportSeries = [
    { key: "dpr", label: "DPR", color: SERIES_COLORS[0] },
    { key: "siteReport", label: "Site report", color: SERIES_COLORS[1] },
    { key: "wpr", label: "WPR", color: SERIES_COLORS[2] },
  ];
  const reportData = o.reportsMonthly.map((x) => ({ label: x.label, values: { dpr: x.dpr, siteReport: x.siteReport, wpr: x.wpr } }));
  return (
    <>
      <div className="ow-kpis">
        <KpiTile label="Leave requests (period)" value={count(o.leavesInPeriod)} />
        <KpiTile label="Leave pending" value={count(o.leavesPending)} tone={o.leavesPending ? "warn" : null} />
        <KpiTile label="Tickets raised (period)" value={count(o.ticketsRaised)} />
        <KpiTile label="Tickets open" value={count(o.ticketsOpen)} tone={o.ticketsOpen ? "warn" : null} />
        <KpiTile label="Reschedule requests pending" value={count(o.reschedulesPending)} />
        <KpiTile label="Reports (period)" value={count(o.reportsInPeriod)} />
      </div>
      <div className="ow-grid-2">
        <Card title="Leave requests by month" subtitle="by decision" wide>
          <BarChart data={leaveData} series={leaveSeries} stacked format={count} />
        </Card>
        <Card title="Report submissions by month" subtitle="DPR, site report and WPR" wide>
          <BarChart data={reportData} series={reportSeries} format={count} />
        </Card>
        <Card title="Tickets by status" subtitle="raised in period">
          <HBarList items={o.ticketsByStatus.map(([k, v]) => ({ label: titleCase(k), value: v }))} format={count} emptyText="No tickets in this period." />
        </Card>
        <Card title="Reschedule requests by status" subtitle="raised in period">
          <HBarList items={o.reschedulesByStatus.map(([k, v]) => ({ label: titleCase(k), value: v }))} format={count} emptyText="No reschedule requests in this period." />
        </Card>
      </div>
    </>
  );
}

function PlanningTab({ m, onOpen }) {
  const c = m.capacity;
  return (
    <>
      <Section title="Signals" subtitle="Ranked by severity. Each is computed from the same numbers as the other tabs.">
        <InsightList insights={m.insights} onOpen={onOpen} />
      </Section>
      <Section title="Capacity" subtitle="Use these to decide where to add people or cut scope.">
        <div className="ow-kpis">
          <KpiTile label="Open tasks per employee" value={c.openTasksPerEmployee === null ? "—" : c.openTasksPerEmployee.toFixed(1)} />
          <KpiTile label="Active sites per employee" value={c.activeSitesPerEmployee === null ? "—" : c.activeSitesPerEmployee.toFixed(2)} />
          <KpiTile label="Tasks completed per month" value={c.throughputPerMonth === null ? "—" : c.throughputPerMonth.toFixed(1)} hint="period average" />
          <KpiTile label="Backlog" value={c.backlogMonths === null ? "—" : `${c.backlogMonths.toFixed(1)} months`} hint="time to clear open tasks at current pace" />
        </div>
      </Section>
      <Section title="Spend outlook" subtitle="Run-rate based. Replace with a budget once one is recorded.">
        <div className="ow-kpis">
          <KpiTile label="Monthly run-rate" value={inr(m.finance.monthlyRunRate)} />
          <KpiTile label="Next 12 months at current rate" value={inr(m.finance.projectedNext12Months)} />
          <KpiTile label="Insurance renewals (60 days)" value={count(m.finance.insurance.upcomingRenewals.length)} />
        </div>
      </Section>
      <Section title="Monthly trend" subtitle="Last months in the selected period">
        <div className="ow-table-wrap">
          <table className="ow-table">
            <thead><tr><th>Month</th><th className="num">Attendance</th><th className="num">Tasks created</th><th className="num">Tasks completed</th><th className="num">Leaves approved</th><th className="num">Expenses</th></tr></thead>
            <tbody>
              {m.attendance.trend.map((t, i) => (
                <tr key={t.month}>
                  <td>{monthLabel(t.month)}</td>
                  <td className="num">{pct(t.rate)}</td>
                  <td className="num">{m.tasks.monthly[i].created}</td>
                  <td className="num">{m.tasks.monthly[i].completed}</td>
                  <td className="num">{m.operations.leavesMonthly[i].approved}</td>
                  <td className="num">{inr(m.finance.monthlyExpenses[i].total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/** Full-page stop shown when the database cannot be read, so figures are never shown half-loaded. */
function ServiceUnavailable({ errors, failed, loading, onRetry, onLogout }) {
  const failedSources = errors.map((e) => e.source);
  return (
    <div className="ow-root">
      <div className="ow-outage" role="alert">
        <div className="ow-outage-card">
          <div className="ow-outage-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>
          <h1>Owner portal is unavailable</h1>
          <p className="ow-muted">
            The database could not be read, so this site cannot be used right now. The portal is disabled
            until the connection is restored. Please try again shortly.
          </p>

          {failedSources.length > 0 && (
            <div className="ow-outage-detail">
              <strong>Failed to load</strong>
              <ul>
                {failedSources.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
          {failed && <div className="ow-outage-detail"><strong>Error</strong><p className="ow-muted">{failed}</p></div>}

          <div className="ow-outage-actions">
            <button type="button" className="ow-btn ow-btn-primary" onClick={onRetry} disabled={loading}>
              {loading ? "Retrying…" : "Try again"}
            </button>
            <button type="button" className="ow-btn" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerPortal() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const allowed = !!user && (isOwnerUser(user) || isAdminUser(user));

  const [tab, setTab] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [months, setMonths] = useState(3);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState({ loading: true, snapshot: null, errors: [], loadedAt: null, failed: null });

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    if (!allowed) navigate("/");
  }, [user, allowed, navigate]);

  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    setData((prev) => ({ ...prev, loading: true }));
    loadOwnerSnapshot()
      .then(({ snapshot, errors, loadedAt }) => {
        if (alive) setData({ loading: false, snapshot, errors, loadedAt, failed: null });
      })
      .catch((err) => {
        if (alive) setData({ loading: false, snapshot: null, errors: [], loadedAt: null, failed: err.message });
      });
    return () => {
      alive = false;
    };
  }, [allowed, reloadToken]);

  const metrics = useMemo(
    () => (data.snapshot ? computeOwnerMetrics(data.snapshot, { months }) : null),
    [data.snapshot, months],
  );

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("portalName");
    navigate("/");
  };

  if (!allowed) return null;

  if (data.failed || data.errors.length > 0) {
    return (
      <ServiceUnavailable
        errors={data.errors}
        failed={data.failed}
        loading={data.loading}
        onRetry={() => setReloadToken((t) => t + 1)}
        onLogout={logout}
      />
    );
  }

  const current = TABS.find((t) => t.key === tab) || TABS[0];
  const initials = String(user?.name || user?.user_name || "O")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const updatedAt = data.loadedAt
    ? data.loadedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  const pick = (key) => {
    setTab(key);
    setNavOpen(false);
  };

  return (
    <div className="ow-root">
      <div className={`ow-shell ${navOpen ? "ow-nav-open" : ""}`}>
        <aside className="ow-sidebar" aria-label="Owner navigation">
          <div className="ow-brand">
            <img src={logo} alt="" className="ow-brand-logo" />
            <div>
              <div className="ow-brand-name">DIP Projects</div>
              <div className="ow-brand-sub">Owner console</div>
            </div>
          </div>

          <div className="ow-nav-label">Reports</div>
          <nav className="ow-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`ow-nav-item ${tab === t.key ? "active" : ""}`}
                onClick={() => pick(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
              >
                <NavIcon d={t.icon} />
                <span className="ow-nav-text">{t.label}</span>
                {t.key === "planning" && metrics?.insights.length > 0 && (
                  <span className="ow-nav-badge">{metrics.insights.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="ow-sidebar-foot">
            <div className="ow-user">
              <div className="ow-avatar">{initials}</div>
              <div className="ow-user-text">
                <strong>{user?.name || user?.user_name}</strong>
                <span>{isOwnerUser(user) ? "Owner" : "Administrator"}</span>
              </div>
            </div>
            <button type="button" className="ow-logout" onClick={logout}>Log out</button>
          </div>
        </aside>

        {navOpen && <div className="ow-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

        <main className="ow-main">
          <header className="ow-topbar">
            <button type="button" className="ow-menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="ow-topbar-title">
              <h1>{current.title}</h1>
              <p className="ow-muted">
                {metrics
                  ? `${metrics.meta.periodStart} to ${metrics.meta.asOfKey}`
                  : "Loading company data"}
                {updatedAt && ` · Updated ${updatedAt}`}
              </p>
            </div>
            <div className="ow-topbar-actions">
              <select className="ow-select" value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period">
                {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button type="button" className="ow-btn" onClick={() => setReloadToken((t) => t + 1)} disabled={data.loading}>
                {data.loading ? "Loading…" : "Refresh"}
              </button>
              <button type="button" className="ow-btn ow-btn-primary" disabled={!metrics} onClick={() => metrics && exportOwnerWorkbook(metrics, "owner-report")}>
                Export Excel
              </button>
            </div>
          </header>

          <div className="ow-content">
            {data.loading && !metrics && <div className="ow-empty ow-loading">Loading company data…</div>}

            {metrics && (
              <>
                {tab === "overview" && <OverviewTab m={metrics} onOpen={setTab} />}
                {tab === "employees" && <EmployeesTab m={metrics} />}
                {tab === "tasks" && <TasksTab m={metrics} />}
                {tab === "projects" && <ProjectsTab m={metrics} />}
                {tab === "finance" && <FinanceTab m={metrics} />}
                {tab === "operations" && <OperationsTab m={metrics} />}
                {tab === "planning" && <PlanningTab m={metrics} onOpen={setTab} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
