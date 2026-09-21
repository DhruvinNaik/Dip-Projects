import { supabase } from "../supabase";

const CACHE_TTL_MS = 25000;
let cache = { at: 0, data: null };
let hrCache = { at: 0, data: null };

export const DIP_CHIPS = [
  "Who is on leave today?",
  "Pending tasks",
  "All delegated tasks",
  "Overdue tasks",
  "Open tickets",
  "Dashboard summary",
];

export const DIP_HR_CHIPS = [
  "Who is on leave today?",
  "Pending leave requests",
  "Present today",
  "Late today",
  "Employee directory",
  "HR dashboard summary",
];

function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function startOfWeek(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return ymd(d);
}

function prettyDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function prettyDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function norm(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function titleCase(v) {
  const s = String(v || "").replace(/_/g, " ").trim();
  if (!s) return "—";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeLeaveStatus(leave) {
  const hasChain = !!(
    leave.level_approver_user_name || leave.head_approver_user_name
  );
  const storedStatus = norm(leave.status);
  if (
    leave.admin_approved === false ||
    leave.proxy_approved === false ||
    storedStatus === "rejected"
  ) {
    return "rejected";
  }
  if (hasChain) {
    const proxyDone = !leave.proxy_user_name || leave.proxy_approved === true;
    if (
      (leave.admin_approved === true || storedStatus === "approved") &&
      proxyDone
    ) {
      return "approved";
    }
    return "pending";
  }
  if (leave.admin_approved === true || storedStatus === "approved") {
    return "approved";
  }
  return "pending";
}

function coversDate(leave, iso) {
  if (!leave.from_date || !leave.to_date) return false;
  return leave.from_date <= iso && leave.to_date >= iso;
}

function overlapsRange(leave, from, to) {
  if (!leave.from_date || !leave.to_date) return false;
  return leave.from_date <= to && leave.to_date >= from;
}

async function loadContext() {
  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const [
    tasksRes,
    instancesRes,
    leavesRes,
    ticketsRes,
    usersRes,
    sitesRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, assigned_to, assigned_by, status, due_date, site_name, priority, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase
      .from("recurring_task_instances")
      .select(
        "id, title, assigned_to, assigned_by, status, due_date, site_name, priority, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase.from("leaves").select("*").order("created_at", { ascending: false }).limit(800),
    supabase
      .from("tickets")
      .select(
        "id, task_title, raised_by, raised_by_name, assigned_to, assigned_to_name, site_name, query, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("user_details")
      .select("id, name, username, role, department, site_name, status")
      .order("name", { ascending: true }),
    supabase.from("site_details").select("id, site_name, user_name, role, status, client_name"),
  ]);

  const tasks = (tasksRes.data || []).map((t) => ({
    ...t,
    kind: "delegated",
  }));
  const instances = (instancesRes.data || []).map((t) => ({
    ...t,
    kind: "recurring",
  }));

  cache = {
    at: Date.now(),
    data: {
      tasks,
      instances,
      allTasks: [...tasks, ...instances],
      leaves: leavesRes.data || [],
      tickets: ticketsRes.data || [],
      users: usersRes.data || [],
      sites: sitesRes.data || [],
      errors: [
        tasksRes.error,
        instancesRes.error,
        leavesRes.error,
        ticketsRes.error,
        usersRes.error,
        sitesRes.error,
      ]
        .filter(Boolean)
        .map((e) => e.message),
    },
  };
  return cache.data;
}

function displayName(ctx, username) {
  if (!username) return "Unassigned";
  const u = ctx.users.find((e) => norm(e.username) === norm(username));
  return u?.name || username;
}

function findPeople(query, users) {
  const q = norm(query);
  const hits = users.filter((u) => {
    const name = norm(u.name);
    const uname = norm(u.username);
    if (!name && !uname) return false;
    if (name.length > 2 && q.includes(name)) return true;
    if (uname.length > 2 && q.includes(uname)) return true;
    const parts = name.split(/\s+/).filter((part) => part.length >= 3);
    if (parts.length && parts.every((part) => q.includes(part))) return true;
    return parts.some((part) => part.length >= 4 && q.includes(part));
  });
  hits.sort((a, b) => {
    const aFull = norm(a.name).length > 2 && q.includes(norm(a.name)) ? 1 : 0;
    const bFull = norm(b.name).length > 2 && q.includes(norm(b.name)) ? 1 : 0;
    if (bFull !== aFull) return bFull - aFull;
    return String(b.name || "").length - String(a.name || "").length;
  });
  return hits;
}

function findSites(query, sites) {
  const q = norm(query);
  return sites.filter((s) => {
    const name = norm(s.site_name);
    return name.length > 2 && q.includes(name);
  });
}

function table(columns, rows, emptyText) {
  if (!rows.length) {
    return { text: emptyText, columns: null, rows: null };
  }
  return { columns, rows };
}

function taskRows(ctx, list) {
  return list.map((t) => ({
    Title: t.title || "Untitled",
    Assigned: displayName(ctx, t.assigned_to),
    Due: prettyDate(t.due_date),
    Status: titleCase(t.status),
    Site: t.site_name || "—",
    Type: t.kind === "recurring" ? "Recurring" : "Delegated",
  }));
}

function leaveRows(list) {
  return list.map((l) => ({
    Name: l.name || l.user_name || "—",
    Type: l.leave_type || "Leave",
    From: prettyDate(l.from_date),
    To: prettyDate(l.to_date),
    Status: titleCase(computeLeaveStatus(l)),
    Site: l.site_name || "—",
  }));
}

function ticketRows(list) {
  return list.map((t) => ({
    Task: t.task_title || "—",
    Raised: t.raised_by_name || t.raised_by || "—",
    To: t.assigned_to_name || t.assigned_to || "—",
    Site: t.site_name || "—",
    Status: titleCase(t.status),
    When: prettyDateTime(t.created_at),
  }));
}

function filterTasks(list, { person, site, me, mineOnly, assignedByMe, status, kind, overdueToday }) {
  const today = ymd();
  return list.filter((t) => {
    if (kind && t.kind !== kind) return false;
    if (status) {
      const st = norm(t.status);
      if (Array.isArray(status)) {
        if (!status.includes(st)) return false;
      } else if (st !== status) return false;
    }
    if (overdueToday) {
      if (!t.due_date || t.due_date >= today) return false;
      if (norm(t.status) === "completed" || norm(t.status) === "not_applicable") {
        return false;
      }
    }
    if (person) {
      const names = [person.username, person.name].map(norm);
      if (!names.includes(norm(t.assigned_to)) && !names.includes(norm(t.assigned_by))) {
        return false;
      }
    }
    if (mineOnly && me) {
      if (norm(t.assigned_to) !== norm(me.user_name) && norm(t.assigned_to) !== norm(me.username)) {
        return false;
      }
    }
    if (assignedByMe && me) {
      const meNames = [me.user_name, me.username, me.name].map(norm);
      if (!meNames.includes(norm(t.assigned_by))) return false;
    }
    if (site && norm(t.site_name) !== norm(site.site_name)) return false;
    return true;
  });
}

function helpText(name) {
  return {
    text: `Hi${name ? ` ${name}` : ""}, I’m DIP Bot. Ask in plain English and I’ll pull live data from this portal.\n\nI can show:\n• Who is on leave today / this week\n• Pending, in-progress, completed or overdue tasks\n• All delegated tasks, or tasks assigned to a person\n• Open / solved tickets\n• Employees and sites\n• A dashboard summary`,
    chips: DIP_CHIPS,
  };
}

function hrHelpText(name) {
  return {
    text: `Hi${name ? ` ${name}` : ""}, I’m DIP Bot for HR. I only answer people-ops questions from this portal.\n\nI can show:\n• Employees / directory\n• Attendance (present, late, absent, clock-in)\n• Leave today / this week / pending\n• Expenses & documents (when those tables are connected)\n• An HR dashboard summary\n\nI can’t help with tasks, tickets, or site operations.`,
    chips: DIP_HR_CHIPS,
  };
}

function fmtClock(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

async function loadHrContext() {
  if (hrCache.data && Date.now() - hrCache.at < CACHE_TTL_MS) return hrCache.data;

  const today = ymd();
  const from = addDays(today, -45);

  const [usersRes, leavesRes, attendanceRes, expensesRes, documentsRes] =
    await Promise.all([
      supabase
        .from("user_details")
        .select("*")
        .order("name", { ascending: true }),
      supabase
        .from("leaves")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(800),
      supabase
        .from("attendance")
        .select("user_name, name, date, clock_in, clock_out, clock_in_status")
        .gte("date", from)
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(5000),
      supabase.from("expenses").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(300),
    ]);

  hrCache = {
    at: Date.now(),
    data: {
      users: usersRes.data || [],
      leaves: leavesRes.data || [],
      attendance: attendanceRes.data || [],
      expenses: expensesRes.error ? [] : expensesRes.data || [],
      documents: documentsRes.error ? [] : documentsRes.data || [],
      expensesAvailable: !expensesRes.error,
      documentsAvailable: !documentsRes.error,
      errors: [usersRes.error, leavesRes.error, attendanceRes.error]
        .filter(Boolean)
        .map((e) => e.message),
    },
  };
  return hrCache.data;
}

function attendanceStatus(row) {
  if (!row?.clock_in) return "Absent";
  if (norm(row.clock_in_status) === "late") return "Late";
  return "Present";
}

function attendanceRows(list) {
  return list.map((r) => ({
    Name: r.name || r.user_name || "—",
    Date: prettyDate(r.date),
    Status: attendanceStatus(r),
    In: fmtClock(r.clock_in),
    Out: fmtClock(r.clock_out),
  }));
}

async function answerHrDipQuery(rawText, user) {
  const text = String(rawText || "").trim();
  const q = norm(text);
  if (!q) return hrHelpText(user?.name);

  const ctx = await loadHrContext();
  if (ctx.errors.length && !ctx.users.length && !ctx.leaves.length && !ctx.attendance.length) {
    return { text: `I couldn’t load HR data right now.\n${ctx.errors[0]}` };
  }

  const people = findPeople(q, ctx.users);
  const person = people[0] || null;
  const today = ymd();
  const tomorrow = addDays(today, 1);
  const weekFrom = startOfWeek(today);
  const weekTo = addDays(weekFrom, 6);

  if (
    /^(hi|hello|hey|yo|hola)\b/.test(q) ||
    /\b(help|what can you|how do i|capabilities)\b/.test(q)
  ) {
    return hrHelpText(user?.name);
  }

  if (/\b(thank|thanks|thx)\b/.test(q)) {
    return { text: "Anytime. Ask whenever you need attendance, leave, or employee info." };
  }

  if (
    /\b(task|tasks|ticket|tickets|delegat|overdue task|site report|checklist)\b/.test(q)
  ) {
    return {
      text: "In HR portal I only cover employees, attendance, leaves, expenses, and documents — not tasks or tickets. Try Admin portal for those.",
      chips: DIP_HR_CHIPS,
    };
  }

  if (/\b(dashboard|summary|overview|snapshot)\b/.test(q)) {
    const onLeave = ctx.leaves.filter(
      (l) => computeLeaveStatus(l) === "approved" && coversDate(l, today),
    );
    const pendingLeave = ctx.leaves.filter((l) => computeLeaveStatus(l) === "pending");
    const todayAtt = ctx.attendance.filter((r) => r.date === today);
    const present = todayAtt.filter((r) => r.clock_in && norm(r.clock_in_status) !== "late");
    const late = todayAtt.filter((r) => r.clock_in && norm(r.clock_in_status) === "late");
    const clocked = new Set(todayAtt.filter((r) => r.clock_in).map((r) => norm(r.user_name)));
    const absent = ctx.users.filter((u) => {
      const key = norm(u.username);
      if (!key) return false;
      const onLeaveToday = onLeave.some(
        (l) => norm(l.user_name) === key || norm(l.name) === norm(u.name),
      );
      return !clocked.has(key) && !onLeaveToday;
    });
    return {
      text: `HR snapshot for ${prettyDate(today)}`,
      columns: ["Metric", "Count"],
      rows: [
        { Metric: "Employees", Count: String(ctx.users.length) },
        { Metric: "Present today", Count: String(present.length) },
        { Metric: "Late today", Count: String(late.length) },
        { Metric: "Absent today (no clock-in)", Count: String(absent.length) },
        { Metric: "On leave today", Count: String(onLeave.length) },
        { Metric: "Pending leave requests", Count: String(pendingLeave.length) },
        {
          Metric: "Expense records",
          Count: ctx.expensesAvailable ? String(ctx.expenses.length) : "Not connected",
        },
        {
          Metric: "Document records",
          Count: ctx.documentsAvailable ? String(ctx.documents.length) : "Not connected",
        },
      ],
      chips: ["Who is on leave today?", "Present today", "Pending leave requests"],
    };
  }

  if (/\b(expense|expenses|reimburs|company expense)\b/.test(q)) {
    if (!ctx.expensesAvailable) {
      return {
        text: "Expenses data isn’t connected to DIP Bot yet. Once an expenses table is available in HR, I can list and summarize it here.",
        chips: DIP_HR_CHIPS,
      };
    }
    const rows = ctx.expenses.slice(0, 80).map((e) => ({
      Title: e.title || e.description || e.category || "Expense",
      Amount: e.amount != null ? String(e.amount) : "—",
      By: e.name || e.user_name || e.created_by || "—",
      Status: titleCase(e.status),
      Date: prettyDate(e.date || e.created_at),
    }));
    const tbl = table(
      ["Title", "Amount", "By", "Status", "Date"],
      rows,
      "No expense records found.",
    );
    return {
      text: tbl.rows ? `${ctx.expenses.length} expense record${ctx.expenses.length === 1 ? "" : "s"}.` : tbl.text,
      ...tbl,
    };
  }

  if (/\b(document|documents|files|papers)\b/.test(q)) {
    if (!ctx.documentsAvailable) {
      return {
        text: "Documents data isn’t connected to DIP Bot yet. Once HR documents are stored in the database, I can search them here.",
        chips: DIP_HR_CHIPS,
      };
    }
    const rows = ctx.documents.slice(0, 80).map((d) => ({
      Name: d.name || d.title || d.file_name || "Document",
      Type: d.type || d.category || d.doc_type || "—",
      Employee: d.employee_name || d.name || d.user_name || "—",
      Date: prettyDate(d.created_at || d.date),
    }));
    const tbl = table(
      ["Name", "Type", "Employee", "Date"],
      rows,
      "No documents found.",
    );
    return {
      text: tbl.rows ? `${ctx.documents.length} document${ctx.documents.length === 1 ? "" : "s"}.` : tbl.text,
      ...tbl,
    };
  }

  if (
    /\b(employees?|staff|people|directory|workforce|team members?)\b/.test(q) ||
    /\b(list|show|give|get)\b.+\b(all|every|entire)\b/.test(q) ||
    /\bwho works\b/.test(q)
  ) {
    if (!/\bleave\b/.test(q) && !/\b(attend|clock|present|absent|late)\b/.test(q)) {
      let list = ctx.users;
      if (person && !/\b(all|every|entire|directory|list)\b/.test(q)) {
        list = list.filter(
          (u) =>
            norm(u.username) === norm(person.username) ||
            norm(u.name) === norm(person.name),
        );
      }
      const rows = list.map((u) => ({
        Name: u.name || u.username,
        Role: u.role || u.designation || "—",
        Department: u.department || "—",
        Site: u.site_name || "—",
        Status: u.status || "—",
      }));
      const tbl = table(
        ["Name", "Role", "Department", "Site", "Status"],
        rows,
        "No employees matched that.",
      );
      return {
        text: tbl.rows
          ? `${list.length} employee${list.length === 1 ? "" : "s"}.`
          : tbl.text,
        ...tbl,
        chips: DIP_HR_CHIPS,
      };
    }
  }

  if (/\b(leave|leaves|off today|on leave)\b/.test(q)) {
    let list = ctx.leaves;
    let label = "leave requests";
    if (/\breject/.test(q)) {
      list = list.filter((l) => computeLeaveStatus(l) === "rejected");
      label = "rejected leave requests";
    } else if (/\bpending|approval|to approve|awaiting\b/.test(q)) {
      list = list.filter((l) => computeLeaveStatus(l) === "pending");
      label = "pending leave requests";
    } else if (/\btomorrow\b/.test(q)) {
      list = list.filter(
        (l) => computeLeaveStatus(l) === "approved" && coversDate(l, tomorrow),
      );
      label = "people on leave tomorrow";
    } else if (/\b(this week|week)\b/.test(q)) {
      list = list.filter(
        (l) =>
          computeLeaveStatus(l) === "approved" &&
          overlapsRange(l, weekFrom, weekTo),
      );
      label = `people on leave this week (${prettyDate(weekFrom)} – ${prettyDate(weekTo)})`;
    } else if (/\btoday\b/.test(q) || /\bon leave\b/.test(q) || /\bwho'?s\b/.test(q)) {
      list = list.filter(
        (l) => computeLeaveStatus(l) === "approved" && coversDate(l, today),
      );
      label = "people on leave today";
    } else if (/\bapproved\b/.test(q)) {
      list = list.filter((l) => computeLeaveStatus(l) === "approved");
      label = "approved leave requests";
    }
    if (person) {
      const keys = [person.username, person.name].map(norm);
      list = list.filter(
        (l) => keys.includes(norm(l.user_name)) || keys.includes(norm(l.name)),
      );
      label += ` for ${person.name || person.username}`;
    }
    const tbl = table(
      ["Name", "Type", "From", "To", "Status", "Site"],
      leaveRows(list),
      `No ${label}.`,
    );
    return {
      text: tbl.rows ? `${list.length} ${label}.` : tbl.text,
      ...tbl,
      chips: ["Pending leave requests", "Who is on leave this week?", "Present today"],
    };
  }

  const wantsAttendance =
    /\b(attend|attendance|present|absent|late|clock|clocked|punch|check[- ]?in|check[- ]?out)\b/.test(
      q,
    ) ||
    (person &&
      /\b(when|last|today|yesterday|in time|out time)\b/.test(q));

  if (wantsAttendance) {
    let list = ctx.attendance.filter((r) => r.date === today);
    let label = "attendance today";
    let highlight = "";

    if (/\byesterday\b/.test(q)) {
      const y = addDays(today, -1);
      list = ctx.attendance.filter((r) => r.date === y);
      label = `attendance on ${prettyDate(y)}`;
    } else if (/\b(this week|week)\b/.test(q) && !person) {
      list = ctx.attendance.filter((r) => r.date >= weekFrom && r.date <= weekTo);
      label = "attendance this week";
    }

    if (/\blate\b/.test(q) && !person) {
      list = list.filter((r) => r.clock_in && norm(r.clock_in_status) === "late");
      label = label.replace(/^attendance/, "late attendance");
    } else if (/\bpresent\b/.test(q) && !person) {
      list = list.filter((r) => r.clock_in && norm(r.clock_in_status) !== "late");
      label = label.replace(/^attendance/, "present");
    } else if (/\babsent\b/.test(q) && !person) {
      const onLeave = new Set(
        ctx.leaves
          .filter((l) => computeLeaveStatus(l) === "approved" && coversDate(l, today))
          .map((l) => norm(l.user_name)),
      );
      const clocked = new Set(
        ctx.attendance
          .filter((r) => r.date === today && r.clock_in)
          .map((r) => norm(r.user_name)),
      );
      const absentPeople = ctx.users.filter((u) => {
        const key = norm(u.username);
        return key && !clocked.has(key) && !onLeave.has(key);
      });
      const rows = absentPeople.map((u) => ({
        Name: u.name || u.username,
        Role: u.role || u.designation || "—",
        Department: u.department || "—",
        Status: "Absent",
      }));
      const tbl = table(
        ["Name", "Role", "Department", "Status"],
        rows,
        "Nobody is marked absent today (or everyone clocked in / is on leave).",
      );
      return {
        text: tbl.rows
          ? `${absentPeople.length} absent today (no clock-in, not on leave).`
          : tbl.text,
        ...tbl,
        chips: ["Present today", "Late today", "Who is on leave today?"],
      };
    }

    if (person) {
      const keys = [person.username, person.name].map(norm);
      let fromDate = addDays(today, -60);
      let toDate = today;
      if (/\btoday\b/.test(q)) fromDate = today;
      if (/\byesterday\b/.test(q)) {
        fromDate = addDays(today, -1);
        toDate = fromDate;
      }
      if (/\bweek\b/.test(q)) {
        fromDate = weekFrom;
        toDate = weekTo;
      }
      list = ctx.attendance
        .filter(
          (r) =>
            (keys.includes(norm(r.user_name)) || keys.includes(norm(r.name))) &&
            r.date >= fromDate &&
            r.date <= toDate &&
            r.clock_in,
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

      if (/\b(last|when|latest|recent)\b/.test(q) || /\bclock/.test(q)) {
        const last = list[0];
        if (last) {
          highlight = `${person.name || person.username} last clocked in on ${prettyDate(last.date)} at ${fmtClock(last.clock_in)}${last.clock_out ? ` (out ${fmtClock(last.clock_out)})` : ""}.`;
          list = list.slice(0, 10);
        } else {
          return {
            text: `No clock-in records found for ${person.name || person.username} in the selected period.`,
            chips: ["Present today", "Employee directory", "Who is on leave today?"],
          };
        }
      } else {
        list = list.slice(0, 15);
      }
      label = `attendance for ${person.name || person.username}`;
    }

    const tbl = table(
      ["Name", "Date", "Status", "In", "Out"],
      attendanceRows(list),
      `No ${label}.`,
    );
    return {
      text: highlight || (tbl.rows ? `${list.length} record${list.length === 1 ? "" : "s"} · ${label}.` : tbl.text),
      ...tbl,
      chips: ["Present today", "Late today", "Who is on leave today?"],
    };
  }

  if (person) {
    const keys = [person.username, person.name].map(norm);
    const leave = ctx.leaves.filter(
      (l) => keys.includes(norm(l.user_name)) || keys.includes(norm(l.name)),
    );
    const onLeave = leave.some(
      (l) => computeLeaveStatus(l) === "approved" && coversDate(l, today),
    );
    const todayRec = ctx.attendance.find(
      (r) => r.date === today && (keys.includes(norm(r.user_name)) || keys.includes(norm(r.name))),
    );
    const recent = ctx.attendance
      .filter(
        (r) =>
          (keys.includes(norm(r.user_name)) || keys.includes(norm(r.name))) &&
          r.clock_in,
      )
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 10);
    const last = recent[0];
    const tbl = table(
      ["Name", "Date", "Status", "In", "Out"],
      attendanceRows(recent),
      `${person.name || person.username} has no recent attendance rows.`,
    );
    return {
      text: `${person.name || person.username} · ${person.role || person.designation || "employee"}${person.department ? ` · ${person.department}` : ""}. ${onLeave ? "On leave today. " : todayRec?.clock_in ? `Clocked in today (${attendanceStatus(todayRec)}) at ${fmtClock(todayRec.clock_in)}. ` : "No clock-in today. "}${last ? `Last clock-in: ${prettyDate(last.date)} at ${fmtClock(last.clock_in)}. ` : ""}${leave.filter((l) => computeLeaveStatus(l) === "pending").length} pending leave request(s).`,
      ...tbl,
      chips: DIP_HR_CHIPS,
    };
  }

  return {
    text: "I didn’t catch a specific HR report in that. Try employees, attendance, leave, expenses, or documents.",
    chips: DIP_HR_CHIPS,
  };
}

export async function answerDipQuery(rawText, user, options = {}) {
  if (norm(options.scope) === "hr") {
    return answerHrDipQuery(rawText, user);
  }

  const text = String(rawText || "").trim();
  const q = norm(text);
  if (!q) return helpText(user?.name);

  const ctx = await loadContext();
  if (ctx.errors.length && !ctx.users.length && !ctx.allTasks.length) {
    return {
      text: `I couldn’t load portal data right now.\n${ctx.errors[0]}`,
    };
  }

  const people = findPeople(q, ctx.users);
  const person = people[0] || null;
  const sites = findSites(q, ctx.sites);
  const site = sites[0] || null;
  const today = ymd();
  const tomorrow = addDays(today, 1);
  const weekFrom = startOfWeek(today);
  const weekTo = addDays(weekFrom, 6);

  const wantsMine =
    /\b(my|mine)\b/.test(q) &&
    !person &&
    !/\b(all|everyone|team|org|company)\b/.test(q);
  const assignedByMe = /\b(i delegated|assigned by me|i assigned|delegated by me)\b/.test(q);

  if (
    /^(hi|hello|hey|yo|hola)\b/.test(q) ||
    /\b(help|what can you|how do i|capabilities)\b/.test(q)
  ) {
    return helpText(user?.name);
  }

  if (/\b(thank|thanks|thx)\b/.test(q)) {
    return { text: "Anytime. Ask whenever you need a leave, task, or ticket snapshot." };
  }

  if (/\b(dashboard|summary|overview|snapshot)\b/.test(q)) {
    const onLeave = ctx.leaves.filter(
      (l) => computeLeaveStatus(l) === "approved" && coversDate(l, today),
    );
    const pendingLeave = ctx.leaves.filter((l) => computeLeaveStatus(l) === "pending");
    const openTasks = ctx.allTasks.filter((t) =>
      ["pending", "in_progress"].includes(norm(t.status)),
    );
    const overdue = filterTasks(ctx.allTasks, { overdueToday: true });
    const openTickets = ctx.tickets.filter((t) => norm(t.status) === "open");
    return {
      text: `Portal snapshot for ${prettyDate(today)}`,
      columns: ["Metric", "Count"],
      rows: [
        { Metric: "On leave today", Count: String(onLeave.length) },
        { Metric: "Pending leave requests", Count: String(pendingLeave.length) },
        { Metric: "Open tasks (pending + in progress)", Count: String(openTasks.length) },
        { Metric: "Overdue tasks", Count: String(overdue.length) },
        { Metric: "Open tickets", Count: String(openTickets.length) },
        { Metric: "Employees", Count: String(ctx.users.length) },
        { Metric: "Sites", Count: String(ctx.sites.length) },
      ],
      chips: ["Who is on leave today?", "Overdue tasks", "Open tickets"],
    };
  }

  if (/\b(employees?|staff|people|directory|who works)\b/.test(q) && !/\bleave\b/.test(q) && !/\btask/.test(q)) {
    let list = ctx.users;
    if (site) list = list.filter((u) => norm(u.site_name) === norm(site.site_name));
    const rows = list.map((u) => ({
      Name: u.name || u.username,
      Role: u.role || "—",
      Department: u.department || "—",
      Site: u.site_name || "—",
      Status: u.status || "—",
    }));
    const tbl = table(
      ["Name", "Role", "Department", "Site", "Status"],
      rows,
      "No employees matched that.",
    );
    return {
      text: tbl.rows
        ? `${list.length} employee${list.length === 1 ? "" : "s"}${site ? ` at ${site.site_name}` : ""}.`
        : tbl.text,
      ...tbl,
    };
  }

  if (/\b(sites?|project list)\b/.test(q) && !/\btask/.test(q) && !/\bleave\b/.test(q)) {
    const rows = ctx.sites.map((s) => ({
      Site: s.site_name || "—",
      Head: s.user_name || "—",
      Role: s.role || "—",
      Client: s.client_name || "—",
      Status: s.status || "—",
    }));
    const tbl = table(["Site", "Head", "Role", "Client", "Status"], rows, "No sites found.");
    return {
      text: tbl.rows ? `${ctx.sites.length} sites.` : tbl.text,
      ...tbl,
    };
  }

  if (/\b(ticket|tickets|query raised)\b/.test(q)) {
    let list = ctx.tickets;
    if (/\b(open|new|unsolved|pending ticket)\b/.test(q) || (!/\bsolved\b/.test(q) && /\bopen\b/.test(q))) {
      list = list.filter((t) => norm(t.status) === "open");
    } else if (/\b(solved|closed|resolved)\b/.test(q)) {
      list = list.filter((t) => ["solved", "closed"].includes(norm(t.status)));
    }
    if (person) {
      const keys = [person.username, person.name].map(norm);
      list = list.filter(
        (t) =>
          keys.includes(norm(t.raised_by)) ||
          keys.includes(norm(t.raised_by_name)) ||
          keys.includes(norm(t.assigned_to)) ||
          keys.includes(norm(t.assigned_to_name)),
      );
    }
    const tbl = table(
      ["Task", "Raised", "To", "Site", "Status", "When"],
      ticketRows(list),
      "No tickets matched that.",
    );
    return {
      text: tbl.rows
        ? `${list.length} ticket${list.length === 1 ? "" : "s"}.`
        : tbl.text,
      ...tbl,
    };
  }

  if (/\b(leave|leaves|off today|on leave|absent)\b/.test(q)) {
    let list = ctx.leaves;
    let label = "leave requests";
    if (/\breject/.test(q)) {
      list = list.filter((l) => computeLeaveStatus(l) === "rejected");
      label = "rejected leave requests";
    } else if (/\bpending|approval|to approve|awaiting\b/.test(q)) {
      list = list.filter((l) => computeLeaveStatus(l) === "pending");
      label = "pending leave requests";
    } else if (/\btomorrow\b/.test(q)) {
      list = list.filter(
        (l) => computeLeaveStatus(l) === "approved" && coversDate(l, tomorrow),
      );
      label = "people on leave tomorrow";
    } else if (/\b(this week|week)\b/.test(q)) {
      list = list.filter(
        (l) =>
          computeLeaveStatus(l) === "approved" &&
          overlapsRange(l, weekFrom, weekTo),
      );
      label = `people on leave this week (${prettyDate(weekFrom)} – ${prettyDate(weekTo)})`;
    } else if (/\btoday\b/.test(q) || /\bon leave\b/.test(q) || /\bwho'?s\b/.test(q)) {
      list = list.filter(
        (l) => computeLeaveStatus(l) === "approved" && coversDate(l, today),
      );
      label = "people on leave today";
    } else if (/\bapproved\b/.test(q)) {
      list = list.filter((l) => computeLeaveStatus(l) === "approved");
      label = "approved leave requests";
    }
    if (person) {
      const keys = [person.username, person.name].map(norm);
      list = list.filter(
        (l) => keys.includes(norm(l.user_name)) || keys.includes(norm(l.name)),
      );
      label += ` for ${person.name || person.username}`;
    }
    const pendingToday = ctx.leaves.filter(
      (l) => computeLeaveStatus(l) === "pending" && coversDate(l, today),
    );
    const tbl = table(
      ["Name", "Type", "From", "To", "Status", "Site"],
      leaveRows(list),
      `No ${label}.`,
    );
    let outText = tbl.rows
      ? `${list.length} ${label}.`
      : tbl.text;
    if (/\btoday\b/.test(q) && pendingToday.length && !/\bpending\b/.test(q)) {
      outText += ` ${pendingToday.length} more request${pendingToday.length === 1 ? " is" : "s are"} pending for today.`;
    }
    return { text: outText, ...tbl, chips: ["Pending leave requests", "Who is on leave this week?"] };
  }

  if (
    /\b(task|tasks|todo|to-do|work item|delegat|overdue|in progress|recurring)\b/.test(q)
  ) {
    let kind = null;
    if (/\bdelegat/.test(q) || /\bone[ -]?time\b/.test(q) || /\bassigned tasks?\b/.test(q)) {
      kind = "delegated";
    } else if (/\brecurring\b/.test(q)) {
      kind = "recurring";
    }

    let status = null;
    let overdueToday = false;
    let heading = "tasks";
    if (/\boverdue|delayed|past due\b/.test(q)) {
      overdueToday = true;
      heading = "overdue tasks";
    } else if (/\bin progress|ongoing|started\b/.test(q)) {
      status = "in_progress";
      heading = "in-progress tasks";
    } else if (/\bcomplete|completed|done|finished\b/.test(q)) {
      status = "completed";
      heading = "completed tasks";
    } else if (/\bpending|open tasks|not started\b/.test(q)) {
      status = ["pending"];
      heading = "pending tasks";
    } else if (/\bopen\b/.test(q) && !/\bticket/.test(q)) {
      status = ["pending", "in_progress"];
      heading = "open tasks";
    }

    if (kind === "delegated") heading = `delegated ${heading}`.replace("delegated tasks", "delegated tasks");
    if (kind === "recurring") heading = `recurring ${heading}`;

    const list = filterTasks(ctx.allTasks, {
      person: wantsMine ? null : person,
      site,
      me: user,
      mineOnly: wantsMine,
      assignedByMe,
      status,
      kind,
      overdueToday,
    });

    if (person && !wantsMine) heading += ` for ${person.name || person.username}`;
    if (wantsMine) heading = `your ${heading}`;
    if (assignedByMe) heading += " you assigned";
    if (site) heading += ` at ${site.site_name}`;

    const tbl = table(
      ["Title", "Assigned", "Due", "Status", "Site", "Type"],
      taskRows(ctx, list),
      `No ${heading}.`,
    );
    return {
      text: tbl.rows ? `${list.length} ${heading}.` : tbl.text,
      ...tbl,
      chips: ["Pending tasks", "All delegated tasks", "Overdue tasks"],
    };
  }

  if (person) {
    const theirs = filterTasks(ctx.allTasks, { person, status: ["pending", "in_progress"] });
    const leave = ctx.leaves.filter((l) => {
      const keys = [person.username, person.name].map(norm);
      return keys.includes(norm(l.user_name)) || keys.includes(norm(l.name));
    });
    const onLeave = leave.some(
      (l) => computeLeaveStatus(l) === "approved" && coversDate(l, today),
    );
    const tbl = table(
      ["Title", "Assigned", "Due", "Status", "Site", "Type"],
      taskRows(ctx, theirs),
      `${person.name || person.username} has no open tasks.`,
    );
    return {
      text: `${person.name || person.username} · ${person.role || "employee"}${person.site_name ? ` · ${person.site_name}` : ""}. ${onLeave ? "On leave today. " : ""}${theirs.length} open task${theirs.length === 1 ? "" : "s"}.`,
      ...tbl,
    };
  }

  return {
    text: "I didn’t catch a specific report in that. Try asking about leave, tasks, delegated work, tickets, employees, or sites.",
    chips: DIP_CHIPS,
  };
}
