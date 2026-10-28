// PDF / Excel export for the Work & Verification dashboard.
// Mirrors the six sections rendered in AdminPortal.jsx (same filters, same
// colours, same text formats) so the downloaded files match what is on screen.
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { officeHoursBetween, fmtOfficeHrs, formatDurationShort } from "./officeHours";

const RANGE_LABELS = {
  this_month: "This Month",
  last_month: "Last Month",
  this_week: "This Week",
  last_week: "Last Week",
  today: "Today",
  all_time: "All Time",
};

// Dashboard palette
const SLATE_800 = "1E293B";
const SLATE_200 = "E2E8F0";
const SLATE_300 = "CBD5E1";
const SLATE_500 = "64748B";
const ROW_ALT = "FCFCFD";
const FOOT_BG = "F8FAFC";
const TEAL = "0F766E";
const GREEN_BG = "DCFCE7";
const GREEN_TXT = "15803D";
const GREEN_STRONG = "16A34A";
const AMBER = "CA8A04";
const RED = "DC2626";
const BLUE = "2563EB";
const BLUE_DARK = "0369A1";
const ORANGE_DARK = "9A3412";
const VIOLET = "7C3AED";

const SECTION_COLORS = {
  1: TEAL,
  2: "0284C7",
  3: VIOLET,
  4: RED,
  5: "EA580C",
  6: BLUE_DARK,
};

const fmtDT = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const siteOf = (name) => (name || "General / Head Office").trim();

// jsPDF's built-in fonts only cover Latin-1 (+ a few punctuation marks); anything
// else (emoji in task text, arrows) renders as garbage, so swap it for a space.
const pdfText = (v) =>
  String(v ?? "")
    .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Same date windows as the dashboard's date filter (weeks start Monday).
export function getWvDateRange(range, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const distToMon = (now.getDay() + 6) % 7;
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMon, 0, 0, 0);
  const endOfThisWeek = new Date(startOfThisWeek.getTime() + 7 * 86400000 - 1);
  const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86400000);
  const endOfLastWeek = new Date(startOfThisWeek.getTime() - 1);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const map = {
    today: [startOfToday, endOfToday],
    this_week: [startOfThisWeek, endOfThisWeek],
    last_week: [startOfLastWeek, endOfLastWeek],
    this_month: [startOfThisMonth, endOfThisMonth],
    last_month: [startOfLastMonth, endOfLastMonth],
  };
  const [dateFrom, dateTo] = map[range] || [null, null];
  return { dateFrom, dateTo };
}

// Builds every table shown on the dashboard. Cells are plain values or
// { v, fill?, color?, bold?, center? } objects for coloured pills / emphasis.
export function buildWorkVerificationExport({ range, department = "", employees, allTasks, pendingVerifications, now = new Date() }) {
  const { dateFrom, dateTo } = getWvDateRange(range, now);
  const inRange = (d) => !dateFrom || (!!d && new Date(d) >= dateFrom && new Date(d) <= dateTo);

  // Department filter ("" = all). Tasks and verifications follow the assignee's department.
  const emps = employees || [];
  const deptByUser = new Map(emps.map((e) => [e.username, (e.department || "").toLowerCase().trim()]));
  const inDept = (username) => !department || deptByUser.get(username) === department;
  const taskById = new Map((allTasks || []).map((t) => [t.id, t]));
  const tasks = (allTasks || []).filter((t) => inDept(t.assigned_to));
  const verifs = (pendingVerifications || []).filter((v) => inDept(taskById.get(v.task_id)?.assigned_to || v.assigned_to));
  const empByUser = new Map(emps.map((e) => [e.username, e]));

  // ── Office employees & filtered tasks (dashboard section 1 base) ──
  const officeEmployees = emps.filter((e) => {
    const dept = (e.department || "").toLowerCase().trim();
    const role = (e.role || "").toLowerCase().trim();
    if (dept === "site engineer" || role === "site engineer" || role === "site incharge" || role === "site coordinator" || role === "client") {
      return false;
    }
    return true;
  }).filter((e) => inDept(e.username));
  const officeUsernames = new Set(officeEmployees.map((e) => e.username).filter(Boolean));

  // Latest verification per task (all time) — used for "Verified" / "Under verification" counts
  const vMap = {};
  verifs.forEach((v) => {
    if (!v.task_id) return;
    const prev = vMap[v.task_id];
    if (!prev || new Date(v.created_at) > new Date(prev.created_at)) vMap[v.task_id] = v;
  });

  const filteredTasks = tasks.filter((t) => {
    if (!t.assigned_to || !officeUsernames.has(t.assigned_to)) return false;
    if (dateFrom && dateTo) return inRange(t.created_at);
    return true;
  });

  const taskHoursOf = (t) => {
    if (!t.created_at) return 0;
    if (t.status === "completed") {
      const end = t.completed_at || t.completion_date || t.updated_at;
      return end ? officeHoursBetween(t.created_at, end) : 0;
    }
    return officeHoursBetween(t.created_at, new Date());
  };

  // Latest verification per task inside the period
  const latestVerifInRange = {};
  verifs.forEach((v) => {
    if (!v.task_id || !v.created_at) return;
    if (dateFrom && dateTo && !inRange(v.created_at)) return;
    const prev = latestVerifInRange[v.task_id];
    if (!prev || new Date(v.created_at) > new Date(prev.created_at)) latestVerifInRange[v.task_id] = v;
  });

  const verifierUsernames = new Set(verifs.map((v) => v.verifier).filter(Boolean));
  const verifiedByUser = {};
  Object.values(latestVerifInRange).forEach((v) => {
    if (v.status !== "completed" || !v.resolved_at || !v.verifier) return;
    const task = taskById.get(v.task_id);
    const started = task?.verification_started_at || v.created_at;
    const submitter = empByUser.get(task?.assigned_to)?.name || task?.assigned_to || "—";
    if (!verifiedByUser[v.verifier]) verifiedByUser[v.verifier] = [];
    verifiedByUser[v.verifier].push({
      title: task?.title || v.task_title || "Task",
      site: siteOf(v.site_name || task?.site_name),
      sub: `Submitted by ${submitter}`,
      hours: officeHoursBetween(started, v.resolved_at),
    });
  });

  // ── KPI totals (dashboard top cards) ──
  let grandTotal = 0;
  let grandCompleted = 0;
  let grandPending = 0;
  let grandVerified = 0;
  filteredTasks.forEach((t) => {
    grandTotal += 1;
    if (t.status === "completed") grandCompleted += 1;
    else grandPending += 1;
    if (vMap[t.id]?.status === "completed") grandVerified += 1;
  });

  // ── Section 1: employee cards, one row per site ──
  const cardRows = [];
  officeEmployees.forEach((emp) => {
    const empTasks = filteredTasks.filter((t) => t.assigned_to === emp.username);
    const completedCount = empTasks.filter((t) => t.status === "completed").length;
    const verified = verifiedByUser[emp.username] || [];
    if (completedCount === 0 && verified.length === 0) return;

    const isVerifier = verifierUsernames.has(emp.username);
    const siteRowMap = {};
    const getRow = (name) => {
      if (!siteRowMap[name]) siteRowMap[name] = { name, personalCount: 0, personalHours: 0, verifiedCount: 0, verifiedHours: 0 };
      return siteRowMap[name];
    };
    empTasks.forEach((t) => {
      if (isVerifier && t.status !== "completed") return;
      const row = getRow(siteOf(t.site_name));
      row.personalCount += 1;
      row.personalHours += taskHoursOf(t);
    });
    verified.forEach((item) => {
      const row = getRow(item.site);
      row.verifiedCount += 1;
      row.verifiedHours += item.hours;
    });

    Object.values(siteRowMap)
      .sort((a, b) => b.personalCount + b.verifiedCount - (a.personalCount + a.verifiedCount) || a.name.localeCompare(b.name))
      .forEach((row) => {
        cardRows.push([
          cardRows.length + 1,
          emp.name || emp.username,
          emp.role || emp.department || "Office",
          row.name,
          row.personalCount,
          formatDurationShort(row.personalHours * 60),
          row.verifiedCount,
          formatDurationShort(row.verifiedHours * 60),
          row.personalCount + row.verifiedCount,
        ]);
      });
  });

  // ── Section 2: project × employee matrix (heads, admin, office engineers) ──
  const matrixTargetEmps = officeEmployees.filter((e) => {
    const role = (e.role || "").toLowerCase().trim();
    const dept = (e.department || "").toLowerCase().trim();
    const isHead = role.includes("head");
    const isAdminRole = role.includes("admin") || dept === "admin";
    const isOfficeEng = dept === "engineer office" || role.includes("estimator") || role.includes("tender");
    return isHead || isAdminRole || isOfficeEng;
  });
  const matrixUsernames = new Set(matrixTargetEmps.map((e) => e.username).filter(Boolean));
  const matrixTasks = filteredTasks.filter((t) => matrixUsernames.has(t.assigned_to));
  const matrixProjects = Array.from(new Set(matrixTasks.map((t) => siteOf(t.site_name)))).sort((a, b) => a.localeCompare(b));
  const pCounts = {};
  const empDone = {};
  const empTotal = {};
  let pGrandDone = 0;
  matrixProjects.forEach((p) => {
    pCounts[p] = {};
  });
  matrixTasks.forEach((t) => {
    const p = siteOf(t.site_name);
    const cell = pCounts[p][t.assigned_to] || (pCounts[p][t.assigned_to] = { completed: 0, total: 0 });
    cell.total += 1;
    empTotal[t.assigned_to] = (empTotal[t.assigned_to] || 0) + 1;
    if (t.status === "completed") {
      cell.completed += 1;
      empDone[t.assigned_to] = (empDone[t.assigned_to] || 0) + 1;
      pGrandDone += 1;
    }
  });
  const matrixEmps = matrixTargetEmps.filter((e) => empTotal[e.username] > 0);
  const matrixRows = matrixProjects.map((p) => {
    let done = 0;
    let total = 0;
    const cells = matrixEmps.map((e) => {
      const c = pCounts[p]?.[e.username] || { completed: 0, total: 0 };
      done += c.completed;
      total += c.total;
      if (c.total === 0) return { v: "—", color: "CBD5E1", center: true };
      return {
        v: c.total > c.completed ? `${c.completed} done (of ${c.total} total)` : `${c.completed} done`,
        fill: c.completed > 0 ? GREEN_BG : "F1F5F9",
        color: c.completed > 0 ? GREEN_TXT : SLATE_500,
        bold: true,
        center: true,
      };
    });
    const totalCell = {
      v: total > done ? `${done} (${total} assigned)` : `${done}`,
      fill: "F0FDFA",
      color: TEAL,
      bold: true,
      center: true,
    };
    return [p, ...cells, totalCell];
  });
  const matrixFoot = [
    "Total Completed",
    ...matrixEmps.map((e) => {
      const done = empDone[e.username] || 0;
      const tot = empTotal[e.username] || 0;
      return { v: tot > done ? `${done} (${tot} total)` : `${done}`, color: done > 0 ? GREEN_STRONG : SLATE_500, bold: true, center: true };
    }),
    { v: `${pGrandDone}`, fill: "CCFBF1", color: TEAL, bold: true, center: true },
  ];

  // ── Section 3: project × verifier matrix + verifier summary ──
  const latestInRange = {};
  verifs.forEach((v) => {
    if (!v.task_id || !inRange(v.created_at)) return;
    const prev = latestInRange[v.task_id];
    if (!prev || new Date(v.created_at) > new Date(prev.created_at)) latestInRange[v.task_id] = v;
  });
  const verifRows = Object.values(latestInRange);
  const keyOf = (v) => v.verifier || v.verifier_name || "unknown";
  const siteOfVerif = (v) => siteOf(v.site_name || taskById.get(v.task_id)?.site_name);
  const verifierNames = {};
  const verifierStats = {};
  const vCounts = {};
  const verifiedPerVerifier = {};
  verifRows.forEach((v) => {
    const key = keyOf(v);
    verifierNames[key] = verifierNames[key] || v.verifier_name || v.verifier || "Unknown";
    if (!verifierStats[key]) verifierStats[key] = { total: 0, verified: 0, pending: 0, correction: 0 };
    const s = verifierStats[key];
    s.total += 1;
    if (v.status === "completed") {
      s.verified += 1;
      verifiedPerVerifier[key] = (verifiedPerVerifier[key] || 0) + 1;
      const site = siteOfVerif(v);
      vCounts[site] = vCounts[site] || {};
      vCounts[site][key] = (vCounts[site][key] || 0) + 1;
    } else if (v.status === "pending") {
      s.pending += 1;
    } else if (v.status === "correction_sent") {
      s.correction += 1;
    }
  });
  const matrixVerifiers = Object.keys(verifierStats)
    .filter((k) => verifiedPerVerifier[k] > 0)
    .sort((a, b) => verifierNames[a].localeCompare(verifierNames[b]));
  const matrixSites = Object.keys(vCounts).sort((a, b) => a.localeCompare(b));
  const verifierRows = matrixSites.map((site) => {
    let siteTotal = 0;
    const cells = matrixVerifiers.map((k) => {
      const n = vCounts[site]?.[k] || 0;
      siteTotal += n;
      if (n === 0) return { v: "—", color: "CBD5E1", center: true };
      return { v: `${n} verified`, fill: GREEN_BG, color: GREEN_TXT, bold: true, center: true };
    });
    return [site, ...cells, { v: `${siteTotal}`, fill: "F5F3FF", color: VIOLET, bold: true, center: true }];
  });
  const verifierFoot = [
    "Total Verified",
    ...matrixVerifiers.map((k) => ({
      v: `${matrixSites.reduce((sum, site) => sum + (vCounts[site]?.[k] || 0), 0)}`,
      color: GREEN_STRONG,
      bold: true,
      center: true,
    })),
    { v: `${grandVerifiedInVerifierMatrix(matrixSites, vCounts, matrixVerifiers)}`, fill: "EDE9FE", color: VIOLET, bold: true, center: true },
  ];
  const verifierSummaryRows = Object.keys(verifierStats)
    .sort((a, b) => verifierNames[a].localeCompare(verifierNames[b]))
    .map((k) => {
      const s = verifierStats[k];
      return [
        verifierNames[k],
        s.total,
        { v: `${s.verified}`, color: GREEN_STRONG, bold: true, center: true },
        { v: `${s.pending}`, color: AMBER, bold: true, center: true },
        { v: `${s.correction}`, color: RED, bold: true, center: true },
      ];
    });

  // ── Section 4: correction log ──
  const corrections = verifs
    .filter((v) => v.status === "correction_sent" && inRange(v.resolved_at || v.created_at))
    .map((v) => {
      const task = taskById.get(v.task_id);
      const empUser = task?.assigned_to || v.assigned_to || "";
      return {
        empUser,
        empName: empByUser.get(empUser)?.name || empUser || "Unknown",
        verifierName: v.verifier_name || v.verifier || "Unknown",
      };
    });
  const byEmp = {};
  corrections.forEach((c) => {
    if (!byEmp[c.empUser]) byEmp[c.empUser] = { name: c.empName, total: 0, byVerifier: {} };
    const g = byEmp[c.empUser];
    g.total += 1;
    g.byVerifier[c.verifierName] = (g.byVerifier[c.verifierName] || 0) + 1;
  });
  const correctionRows = Object.values(byEmp)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((g) => [
      g.name,
      Object.entries(g.byVerifier).map(([n, c]) => `${n}: ${c}`).join(" · "),
      { v: `${g.total}`, fill: "FEF2F2", color: RED, bold: true, center: true },
    ]);

  // ── Section 5: assigned → sent for verification ──
  const firstSentByTask = {};
  verifs.forEach((v) => {
    if (!v.task_id || !v.created_at) return;
    const prev = firstSentByTask[v.task_id];
    if (!prev || new Date(v.created_at) < new Date(prev)) firstSentByTask[v.task_id] = v.created_at;
  });
  const timeRows = filteredTasks
    .filter((t) => firstSentByTask[t.id] && t.created_at)
    .map((t) => {
      const submittedAt = firstSentByTask[t.id];
      return {
        empUser: t.assigned_to,
        empName: empByUser.get(t.assigned_to)?.name || t.assigned_to || "Unknown",
        project: siteOf(t.site_name),
        description: t.description || "",
        taskType: t.title || "—",
        assignedAt: t.created_at,
        acceptedAt: t.accepted_at || null,
        submittedAt,
        hours: officeHoursBetween(t.created_at, submittedAt),
      };
    })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const timeAvgByEmp = {};
  timeRows.forEach((r) => {
    if (!timeAvgByEmp[r.empUser]) timeAvgByEmp[r.empUser] = { name: r.empName, sum: 0, n: 0 };
    timeAvgByEmp[r.empUser].sum += r.hours;
    timeAvgByEmp[r.empUser].n += 1;
  });
  const timeAvgRows = Object.values(timeAvgByEmp)
    .map((g) => ({ name: g.name, n: g.n, avg: g.sum / g.n }))
    .sort((a, b) => b.avg - a.avg)
    .map((e) => [e.name, e.n, fmtOfficeHrs(e.avg)]);
  const timeAvg = timeRows.length ? timeRows.reduce((s, r) => s + r.hours, 0) / timeRows.length : null;
  const timeFastest = timeRows.length ? Math.min(...timeRows.map((r) => r.hours)) : null;
  const timeSlowest = timeRows.length ? Math.max(...timeRows.map((r) => r.hours)) : null;
  const timeDetailRows = timeRows.map((r, i) => [
    i + 1,
    r.empName,
    r.project,
    r.description || "—",
    r.taskType,
    fmtDT(r.assignedAt),
    fmtDT(r.acceptedAt),
    fmtDT(r.submittedAt),
    { v: fmtOfficeHrs(r.hours), color: ORANGE_DARK, bold: true },
  ]);

  // ── Section 6: start verification → verified ──
  const latestByTask = {};
  verifs.forEach((v) => {
    if (!v.task_id || !inRange(v.created_at)) return;
    const prev = latestByTask[v.task_id];
    if (!prev || new Date(v.created_at) > new Date(prev.created_at)) latestByTask[v.task_id] = v;
  });
  const turnRows = Object.values(latestByTask)
    .filter((v) => v.status === "completed" && v.resolved_at)
    .map((v) => {
      const task = taskById.get(v.task_id);
      const started = task?.verification_started_at || v.created_at;
      return {
        submittedBy: empByUser.get(task?.assigned_to)?.name || task?.assigned_to || "—",
        verifierKey: v.verifier || v.verifier_name || "unknown",
        verifierName: v.verifier_name || v.verifier || "Unknown",
        project: siteOf(v.site_name || task?.site_name),
        description: task?.description || v.task_description || "",
        started,
        verified: v.resolved_at,
        hours: officeHoursBetween(started, v.resolved_at),
        sameDay: new Date(started).toDateString() === new Date(v.resolved_at).toDateString(),
      };
    })
    .sort((a, b) => new Date(b.verified) - new Date(a.verified));
  const turnByVer = {};
  turnRows.forEach((r) => {
    if (!turnByVer[r.verifierKey]) turnByVer[r.verifierKey] = { name: r.verifierName, total: 0, same: 0, sum: 0, slowest: 0 };
    const g = turnByVer[r.verifierKey];
    g.total += 1;
    if (r.sameDay) g.same += 1;
    g.sum += r.hours;
    g.slowest = Math.max(g.slowest, r.hours);
  });
  const turnVerRows = Object.values(turnByVer)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((g) => [
      g.name,
      g.total,
      `${g.same}/${g.total}`,
      { v: fmtOfficeHrs(g.total ? g.sum / g.total : 0), color: BLUE, bold: true },
      { v: fmtOfficeHrs(g.slowest), color: RED, bold: true },
    ]);
  const turnSameDay = turnRows.filter((r) => r.sameDay).length;
  const turnAvg = turnRows.length ? turnRows.reduce((s, r) => s + r.hours, 0) / turnRows.length : null;
  const turnSlowest = turnRows.length ? Math.max(...turnRows.map((r) => r.hours)) : null;
  const turnDetailRows = turnRows.map((r, i) => [
    i + 1,
    r.submittedBy,
    r.verifierName,
    r.project,
    r.description || "—",
    fmtDT(r.started),
    fmtDT(r.verified),
    { v: fmtOfficeHrs(r.hours), color: BLUE_DARK, bold: true },
  ]);

  const deptName = department ? department.replace(/\b\w/g, (c) => c.toUpperCase()) : "All departments";
  const rangeLabel = `${RANGE_LABELS[range] || range} · ${deptName}`;
  const generatedAt = now.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return {
    rangeLabel,
    generatedAt,
    summary: [
      { label: "Total Tasks", value: grandTotal, color: "0F172A" },
      { label: "Completed", value: grandCompleted, color: GREEN_STRONG },
      { label: "Verified", value: grandVerified, color: TEAL },
      { label: "Pending Tasks", value: grandPending, color: AMBER },
    ],
    sections: [
      {
        no: 1,
        title: "Office Employees Task & Verification Cards",
        description: "Per-site task count and time taken. Verifiers also see tasks they verified.",
        tables: [
          {
            headers: ["SR", "Employee", "Role", "Project / Site", "Personal Tasks", "Personal Time", "Verified Tasks", "Verified Time", "Total Tasks"],
            rows: cardRows,
            center: true,
          },
        ],
      },
      {
        no: 2,
        title: "Project × Employee Matrix",
        description: "Completed tasks per project/site for Project Heads, Admins and Office Engineers.",
        tables: [
          {
            headers: ["Project / Site Name", ...matrixEmps.map((e) => `${e.name} (${e.role || e.department || "Office"})`), "Project Total"],
            rows: matrixRows,
            foot: [matrixFoot],
            center: true,
          },
        ],
      },
      {
        no: 3,
        title: "Project × Verifier Matrix",
        description: "Number of tasks each verifier has verified, per project/site.",
        tables: [
          {
            caption: "Project × Verifier",
            headers: ["Project / Site Name", ...matrixVerifiers.map((k) => `${verifierNames[k]} (Verifier)`), "Site Total"],
            rows: verifierRows,
            foot: [verifierFoot],
            center: true,
          },
          {
            caption: "Verifier Summary",
            headers: ["Verifier", "Total", "Verified", "Pending", "Correction Sent"],
            rows: verifierSummaryRows,
            center: true,
          },
        ],
      },
      {
        no: 4,
        title: "Correction Log",
        description: "Corrections sent back to each employee, by verifier.",
        stats: [{ label: "Total Corrections Sent", value: corrections.length, color: RED }],
        tables: [
          {
            headers: ["Employee", "Corrections Sent by Verifier", "Total"],
            rows: correctionRows,
            center: true,
          },
        ],
      },
      {
        no: 5,
        title: "Time Analysis",
        description: "Task completion time: assigned time stamp to sent for verification. Office hours (9:30–18:30, lunch 1–2, Sunday off).",
        stats: [
          { label: "Tasks matched", value: timeRows.length, color: RED },
          { label: "Average (office hrs)", value: fmtOfficeHrs(timeAvg), color: BLUE },
          { label: "Fastest", value: fmtOfficeHrs(timeFastest), color: GREEN_TXT },
          { label: "Slowest", value: fmtOfficeHrs(timeSlowest), color: RED },
        ],
        tables: [
          {
            caption: "Average by Employee",
            headers: ["Employee", "Tasks (n)", "Average (Office Hrs)"],
            rows: timeAvgRows,
            center: true,
          },
          {
            caption: "Task Detail",
            headers: ["SR", "Employee", "Project", "Task Description", "Task Type", "Assigned (Time Stamp)", "Accepted Time", "Submitted for Verification", "Time Taken (Office Hrs)"],
            rows: timeDetailRows,
          },
        ],
      },
      {
        no: 6,
        title: "Verification Turnaround Time",
        description: "How this is measured: Start Verification to marked Verified. Office hours (9:30–18:30, lunch 1–2, Sunday off).",
        stats: [
          { label: "Total tasks", value: turnRows.length, color: RED },
          { label: "Verified same day", value: `${turnSameDay}/${turnRows.length}`, color: GREEN_TXT },
          { label: "Average turnaround", value: fmtOfficeHrs(turnAvg), color: BLUE },
          { label: "Slowest", value: fmtOfficeHrs(turnSlowest), color: RED },
        ],
        tables: [
          {
            caption: "Per Verifier",
            headers: ["Verifier", "Total Tasks", "Verified Same Day", "Average Turnaround", "Slowest"],
            rows: turnVerRows,
            center: true,
          },
          {
            caption: "Task Detail",
            headers: ["SR", "Submitted By", "Verifier", "Project", "Task Description", "Start Verification", "Verified", "Time Taken (Office Hrs)"],
            rows: turnDetailRows,
          },
        ],
      },
    ],
  };
}

// Sum of all verified cells in the project × verifier matrix (footer grand total).
function grandVerifiedInVerifierMatrix(sites, counts, verifiers) {
  return sites.reduce((sum, site) => sum + verifiers.reduce((s, k) => s + (counts[site]?.[k] || 0), 0), 0);
}

const cellValue = (c) => (c !== null && typeof c === "object" ? c.v : c);
const fileStamp = () => new Date().toISOString().slice(0, 10);
const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ── PDF ─────────────────────────────────────────────────────────────
export function downloadWorkVerificationPdf(data, range) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const drawHeader = () => {
    doc.setFillColor(...hexToRgb(SLATE_800));
    doc.rect(0, 0, pageWidth, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Work & Verification Dashboard", margin, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...hexToRgb(SLATE_300));
    doc.text(pdfText(data.rangeLabel), margin, 48);
    doc.setFontSize(8.5);
    doc.text(`Generated ${pdfText(data.generatedAt)}`, pageWidth - margin, 48, { align: "right" });
  };

  // Stat chips: same look as the Task Delay Report PDF
  const drawChips = (chips, y) => {
    let x = margin;
    chips.forEach((c) => {
      const w = Math.max(130, doc.getTextWidth(String(c.value)) + 28);
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, w, 34, 4, 4, "FD");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...hexToRgb(SLATE_500));
      doc.text(c.label.toUpperCase(), x + 10, y + 13);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...hexToRgb(c.color));
      doc.text(String(c.value), x + 10, y + 27);
      x += w + 12;
    });
    return y + 34;
  };

  const ensureSpace = (y, needed) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      drawHeader();
      return 84;
    }
    return y;
  };

  // Table cells: plain text, or styled pills/emphasis from the builder
  const toCell = (c) => {
    if (c === null || typeof c !== "object") return pdfText(c);
    const styles = {};
    if (c.fill) styles.fillColor = hexToRgb(c.fill);
    if (c.color) styles.textColor = hexToRgb(c.color);
    if (c.bold) styles.fontStyle = "bold";
    return { content: pdfText(c.v), styles };
  };

  drawHeader();
  let y = drawChips(data.summary.map((s) => ({ label: s.label, value: s.value, color: s.color })), 78) + 22;

  data.sections.forEach((section) => {
    const color = hexToRgb(SECTION_COLORS[section.no]);
    y = ensureSpace(y, 90);

    // Section heading: coloured number badge + title, as on screen
    doc.setFillColor(...color);
    doc.roundedRect(margin, y - 13, 20, 20, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(String(section.no), margin + 10, y + 1, { align: "center" });
    doc.setTextColor(...hexToRgb(SLATE_800));
    doc.setFontSize(13);
    doc.text(pdfText(section.title), margin + 28, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(SLATE_500));
    doc.text(pdfText(section.description), margin + 28, y + 15);
    y += 28;

    if (section.stats?.length) {
      y = drawChips(section.stats.map((s) => ({ label: s.label, value: s.value, color: s.color })), y) + 4;
    }

    section.tables.forEach((table) => {
      y += 10;
      if (table.caption) {
        y = ensureSpace(y, 40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...hexToRgb(TEAL));
        doc.text(pdfText(table.caption), margin, y);
        y += 6;
      }
      const columnStyles = {};
      if (table.center) {
        table.headers.forEach((_, i) => {
          if (i >= 1) columnStyles[i] = { halign: "center" };
        });
      }
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: 84, bottom: 40 },
        didDrawPage: () => drawHeader(),
        head: [table.headers.map(pdfText)],
        body: table.rows.map((r) => r.map(toCell)),
        foot: table.foot ? table.foot.map((r) => r.map(toCell)) : undefined,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [51, 65, 85], overflow: "linebreak" },
        headStyles: { fillColor: hexToRgb(SLATE_800), textColor: hexToRgb(SLATE_200), fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: hexToRgb(ROW_ALT) },
        footStyles: { fillColor: hexToRgb(FOOT_BG), textColor: hexToRgb(SLATE_800), fontStyle: "bold", fontSize: 8.5 },
        columnStyles,
      });
      y = doc.lastAutoTable.finalY;
    });
    y += 24;
  });

  doc.save(`work-verification-${range}-${fileStamp()}.pdf`);
}

// ── Excel ───────────────────────────────────────────────────────────
const solid = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } });
const thin = { style: "thin", color: { argb: `FF${SLATE_200}` } };
const borderAll = { top: thin, bottom: thin, left: thin, right: thin };

export async function downloadWorkVerificationExcel(data, range) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const sheetFor = (name, sectionColor, columnCount) => {
    const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 6;
    return { ws, columnCount, sectionColor };
  };

  const writeTitle = (ctx, title, subtitle) => {
    const { ws, columnCount } = ctx;
    const last = Math.max(columnCount, 4);
    ws.mergeCells(1, 1, 1, last);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    t.fill = solid(SLATE_800);
    t.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 34;
    for (let c = 1; c <= last; c++) ws.getCell(1, c).fill = solid(SLATE_800);

    ws.mergeCells(2, 1, 2, last);
    const s = ws.getCell(2, 1);
    s.value = subtitle;
    s.font = { size: 10, color: { argb: `FF${SLATE_300}` } };
    s.fill = solid(SLATE_800);
    s.alignment = { vertical: "middle", indent: 1 };
    for (let c = 1; c <= last; c++) ws.getCell(2, c).fill = solid(SLATE_800);
    ws.getRow(2).height = 22;
    return 4;
  };

  const writeStats = (ctx, stats, row) => {
    const { ws } = ctx;
    stats.forEach((st, i) => {
      const labelCell = ws.getCell(row, 2 + i * 2);
      const valueCell = ws.getCell(row + 1, 2 + i * 2);
      labelCell.value = st.label.toUpperCase();
      labelCell.font = { bold: true, size: 9, color: { argb: `FF${SLATE_500}` } };
      valueCell.value = st.value;
      valueCell.font = { bold: true, size: 16, color: { argb: `FF${st.color}` } };
    });
    ws.getRow(row + 1).height = 26;
    return row + 3;
  };

  const writeSectionHead = (ctx, section, row) => {
    const { ws, sectionColor } = ctx;
    const badge = ws.getCell(row, 1);
    badge.value = section.no;
    badge.fill = solid(sectionColor);
    badge.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    badge.alignment = { horizontal: "center", vertical: "middle" };
    const title = ws.getCell(row, 2);
    title.value = section.title;
    title.font = { bold: true, size: 13, color: { argb: `FF${SLATE_800}` } };
    title.alignment = { vertical: "middle" };
    ws.getRow(row).height = 24;
    const desc = ws.getCell(row + 1, 2);
    desc.value = section.description;
    desc.font = { italic: true, size: 9, color: { argb: `FF${SLATE_500}` } };
    return row + 3;
  };

  const writeTable = (ctx, table, row) => {
    const { ws } = ctx;
    if (table.caption) {
      const cap = ws.getCell(row, 2);
      cap.value = table.caption;
      cap.font = { bold: true, size: 11, color: { argb: `FF${TEAL}` } };
      row += 1;
    }
    const headerRow = ws.getRow(row);
    table.headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 2);
      cell.value = h;
      cell.fill = solid(SLATE_800);
      cell.font = { bold: true, size: 10, color: { argb: `FF${SLATE_200}` } };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = borderAll;
    });
    headerRow.height = 30;
    row += 1;

    table.rows.forEach((r, idx) => {
      const xr = ws.getRow(row);
      r.forEach((c, i) => {
        const cell = xr.getCell(i + 2);
        const isObj = c !== null && typeof c === "object";
        cell.value = isObj ? c.v : c;
        cell.font = { size: 10, bold: !!(isObj && c.bold), color: { argb: `FF${isObj && c.color ? c.color : "334155"}` } };
        cell.fill = solid(isObj && c.fill ? c.fill : idx % 2 === 0 ? "FFFFFF" : ROW_ALT);
        cell.alignment = { vertical: "middle", wrapText: true, horizontal: table.center && i > 0 ? "center" : "left" };
        cell.border = borderAll;
      });
      row += 1;
    });

    (table.foot || []).forEach((r) => {
      const xr = ws.getRow(row);
      r.forEach((c, i) => {
        const cell = xr.getCell(i + 2);
        const isObj = c !== null && typeof c === "object";
        cell.value = isObj ? c.v : c;
        cell.font = { bold: true, size: 10, color: { argb: `FF${isObj && c.color ? c.color : SLATE_800}` } };
        cell.fill = solid(isObj && c.fill ? c.fill : FOOT_BG);
        cell.alignment = { vertical: "middle", wrapText: true, horizontal: table.center && i > 0 ? "center" : "left" };
        cell.border = { ...borderAll, top: { style: "medium", color: { argb: `FF${SLATE_200}` } } };
      });
      row += 1;
    });
    return row + 1;
  };

  // Size each sheet's columns to its widest value (bounded so long text wraps)
  const fitColumns = (ws, tables) => {
    const widths = {};
    tables.forEach((t) => {
      [t.headers, ...t.rows, ...(t.foot || [])].forEach((r) =>
        r.forEach((c, i) => {
          const len = String(cellValue(c) ?? "").length;
          widths[i + 2] = Math.max(widths[i + 2] || 0, len);
        }),
      );
    });
    Object.entries(widths).forEach(([col, len]) => {
      ws.getColumn(Number(col)).width = Math.min(Math.max(len + 4, 14), 48);
    });
  };

  const subtitle = `${data.rangeLabel} · Generated ${data.generatedAt}`;

  // Overview sheet — the same four headline cards
  {
    const ctx = sheetFor("Overview", TEAL, 5);
    let row = writeTitle(ctx, "Work & Verification Dashboard", subtitle);
    writeStats(ctx, data.summary, row + 1);
    ctx.ws.getColumn(2).width = 22;
    ctx.ws.getColumn(3).width = 22;
    ctx.ws.getColumn(4).width = 22;
    ctx.ws.getColumn(5).width = 22;
  }

  data.sections.forEach((section) => {
    const ctx = sheetFor(`${section.no}. ${section.title}`.slice(0, 31), SECTION_COLORS[section.no], 9);
    const maxCols = Math.max(...section.tables.map((t) => t.headers.length));
    ctx.columnCount = maxCols + 1;
    let row = writeTitle(ctx, `${section.no}. ${section.title}`, subtitle);
    row = writeSectionHead(ctx, section, row);
    if (section.stats?.length) row = writeStats(ctx, section.stats, row);
    section.tables.forEach((table) => {
      row = writeTable(ctx, table, row);
    });
    fitColumns(ctx.ws, section.tables);
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `work-verification-${range}-${fileStamp()}.xlsx`,
  );
}
