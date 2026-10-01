import { supabase } from "../supabase";
import { computeMonthlyLeaveBalance, isMonthlyLeaveRole } from "../pages/leaveUtils";

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

export const DIP_SITE_CHIPS = [
  "Site dashboard",
  "Latest daily reports",
  "Latest weekly reports",
  "Site visit reports",
  "Arrived material",
  "Tasks on my sites",
];

export const DIP_OFFICE_CHIPS = [
  "My profile",
  "My pending tasks",
  "My overdue tasks",
  "My leave",
  "My attendance",
  "My tickets",
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

const SITE_INTENTS = [
  "SITE_LIST",
  "SITE_COUNT",
  "SITE_STATUS",
  "PENDING_WORK",
  "TODAY_PENDING_WORK",
  "WEEKLY_REPORTS",
  "WEEKLY_REPORT_COUNT",
  "LATEST_REPORT",
  "REPORT_HISTORY",
  "TODAY_MANPOWER",
  "SITE_PROGRESS",
  "COMPLETED_WORK",
  "DELAYED_ACTIVITIES",
  "TASK_COUNT",
  "PENDING_TASK_COUNT",
  "MATERIALS",
  "ARRIVED_MATERIAL",
  "EQUIPMENT",
  "VISITORS",
  "CUBE_TESTS",
  "LEAVE",
  "TICKETS",
  "SITE_DASHBOARD",
];

function normalizeSiteQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[?!.]+/g, " ")
    .replace(/\s+/g, " ");
}

function hasTerm(q, term) {
  if (term.includes(" ")) return q.includes(term);
  return q.split(" ").some((token) => token === term || (term.length >= 3 && token.startsWith(term)));
}

function hasAnyTerm(q, terms) {
  return terms.some((term) => hasTerm(q, term));
}

function wantsCount(q) {
  return hasAnyTerm(q, ["how many", "how much", "ketla", "ketli", "ketlu", "number of", "count"]);
}

function wantsList(q) {
  return hasAnyTerm(q, ["show", "list", "batavo", "bataavo", "give me", "tell me"]);
}

function mentionsToday(q) {
  return hasAnyTerm(q, ["today", "aaje", "aje", "aaj"]);
}

function mentionsYesterday(q) {
  return hasAnyTerm(q, ["yesterday", "gai kale", "kale", "kal"]);
}

function mentionsThisWeek(q) {
  return q.includes("this week") || q.includes("athvad");
}

function extractDateRange(text) {
  const q = normalizeSiteQuestion(text);
  const today = ymd();
  if (q.includes("last 7") || q.includes("7 divas") || q.includes("past 7")) {
    return { from: addDays(today, -6), to: today, label: "the last 7 days" };
  }
  if (q.includes("this month") || q.includes("aa month")) {
    return { from: `${today.slice(0, 7)}-01`, to: today, label: "this month" };
  }
  if (q.includes("last week")) {
    const thisFrom = startOfWeek(today);
    const from = addDays(thisFrom, -7);
    return { from, to: addDays(from, 6), label: "last week" };
  }
  if (mentionsThisWeek(q)) {
    const from = startOfWeek(today);
    return { from, to: addDays(from, 6), label: "this week" };
  }
  if (mentionsYesterday(q) && !mentionsToday(q)) {
    const day = addDays(today, -1);
    return { from: day, to: day, label: "yesterday" };
  }
  if (mentionsToday(q)) {
    return { from: today, to: today, label: "today" };
  }
  return null;
}

function extractRequestedOutput(text) {
  const q = normalizeSiteQuestion(text);
  if (hasAnyTerm(q, ["latest", "newest"])) return "latest";
  if (wantsCount(q)) return "count";
  if (hasTerm(q, "status")) return "status";
  if (wantsList(q)) return "list";
  return "detail";
}

function classifySiteIntent(text) {
  const q = normalizeSiteQuestion(text);
  if (!q) return null;
  const count = wantsCount(q);
  const list = wantsList(q);
  const today = mentionsToday(q);
  const aboutReports = hasAnyTerm(q, ["report", "dpr", "wpr"]);
  const aboutDaily = hasAnyTerm(q, ["dpr", "daily"]);
  const aboutWeeklyDoc = (hasTerm(q, "wpr") || q.includes("weekly report")) && !aboutDaily;
  const history = q.includes("last 7") || q.includes("7 divas") || q.includes("this month") || q.includes("aa month") || q.includes("old report");
  const aboutSites = hasAnyTerm(q, ["site", "project"]);
  const pending = hasTerm(q, "pending");

  if (hasAnyTerm(q, ["worker", "manpower", "labour", "labor", "majur", "majuri", "kamdar", "female", "male"])) return "TODAY_MANPOWER";
  if (hasAnyTerm(q, ["equipment", "machine", "machinery"])) return "EQUIPMENT";
  if (hasTerm(q, "cube")) return "CUBE_TESTS";
  if (hasTerm(q, "visitor")) return "VISITORS";
  if (hasAnyTerm(q, ["dashboard", "snapshot", "overview"])) return "SITE_DASHBOARD";
  if (hasTerm(q, "ticket")) return "TICKETS";
  if (hasTerm(q, "leave")) return "LEAVE";
  if (hasAnyTerm(q, ["delay", "delayed", "overdue"])) return "DELAYED_ACTIVITIES";
  if (hasAnyTerm(q, ["complete", "completed", "thayu"]) && hasAnyTerm(q, ["work", "task", "activity", "yesterday", "kale", "kal"])) return "COMPLETED_WORK";
  if (hasTerm(q, "progress")) return "SITE_PROGRESS";
  if (aboutReports && history) return "REPORT_HISTORY";
  if (aboutReports && hasAnyTerm(q, ["latest", "newest"])) return "LATEST_REPORT";
  if (aboutReports && (mentionsThisWeek(q) || aboutWeeklyDoc) && count) return "WEEKLY_REPORT_COUNT";
  if (aboutReports && (mentionsThisWeek(q) || aboutWeeklyDoc || aboutDaily)) return "WEEKLY_REPORTS";
  if ((hasAnyTerm(q, ["arrived", "arrival"]) || (hasAnyTerm(q, ["cement", "sand", "steel", "material"]) && hasAnyTerm(q, ["arrived", "avi", "aavi"]))) && !hasAnyTerm(q, ["use", "used", "upyog"])) return "ARRIVED_MATERIAL";
  if (hasAnyTerm(q, ["material", "cement", "sand", "steel", "tiles", "ply"])) return "MATERIALS";
  if (pending && today) return "TODAY_PENDING_WORK";
  if (pending && count && hasTerm(q, "task")) return "PENDING_TASK_COUNT";
  if (pending) return "PENDING_WORK";
  if (hasTerm(q, "task") && count) return "TASK_COUNT";
  if (hasTerm(q, "status")) return "SITE_STATUS";
  if (aboutSites && (count || hasTerm(q, "active"))) return "SITE_COUNT";
  if (aboutSites && (list || hasAnyTerm(q, ["which", "assigned", "kai", "my", "mara", "mari", "mare"]))) return "SITE_LIST";
  return null;
}

export { classifySiteIntent, extractDateRange, extractRequestedOutput, normalizeSiteQuestion };

function asksThisWeek(q) {
  return /\b(this week|week)\b/.test(q) || /athvad|athvaad/.test(q);
}

function asksToday(q) {
  return /\b(today|aaje|aaj)\b/.test(q);
}

function asksOwnLeaveBalance(q) {
  if (!/\b(leave|leaves)\b/.test(q)) return false;
  const aboutBalance = /\b(left|remaining|balance|available|baki|baaki)\b/.test(q) || /rahi/.test(q);
  const aboutMe = /\b(my|mine|i|me|mari|mara|mane)\b/.test(q);
  return aboutBalance && aboutMe;
}

function asPayload(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function manpowerCount(payload) {
  const rows = asPayload(payload).manpower;
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
}

function genderTotal(rows, gender) {
  return (rows || []).reduce((sum, row) => {
    if (norm(row.gender) !== gender) return sum;
    return sum + (Number(row.count) || 0);
  }, 0);
}

function daySnapshot(row) {
  const payload = asPayload(row.payload);
  const manpower = Array.isArray(payload.manpower) ? payload.manpower : [];
  return {
    date: String(row.date || "").slice(0, 10),
    site: row.site,
    reportType: row.report_type,
    progress: clipText(payload.summary, 500),
    workers: manpowerCount(payload),
    femaleWorkers: genderTotal(manpower, "female"),
    maleWorkers: genderTotal(manpower, "male"),
    manpower: manpower.slice(0, 30).map((item) => ({
      labour: item.labour,
      gender: item.gender || "",
      skill: item.skill || "",
      category: item.category || "",
      count: Number(item.count) || 0,
    })),
    equipmentUsed: (payload.equipment || []).slice(0, 25).map((item) => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      source: item.source,
    })),
    cement: {
      available: payload.cementAvailable ?? "",
      received: payload.cementReceived ?? "",
      used: payload.cementUsed ?? "",
      balance: payload.cementBalance ?? "",
      usedFor: clipText(payload.cementUsedDesc, 180),
    },
    materialOnDailyReport: (payload.material || []).slice(0, 20).map((item) => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
    })),
    materialRequired: (payload.materialRequirement || []).slice(0, 15).map((item) => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
    })),
    concrete: {
      theoretical: payload.concreteTheoretical ?? "",
      onsite: payload.concreteOnsite ?? "",
      description: clipText(payload.concreteDescription, 180),
    },
    planning: clipText(payload.planning, 400),
    visitors: (Array.isArray(payload.visitors) ? payload.visitors : []).slice(0, 10).map((item) => ({
      name: item.name,
      instruction: clipText(item.instruction, 200),
    })),
    cubeTests: clipText(payload.cube, 200),
    extraNotes: (payload.customFields || []).slice(0, 8).map((item) => ({
      title: item.title,
      value: clipText(item.value, 160),
    })),
  };
}

function compactDay(row) {
  const day = daySnapshot(row);
  return {
    date: day.date,
    site: day.site,
    reportType: day.reportType,
    progress: clipText(day.progress, 180),
    planning: clipText(day.planning, 120),
    workers: day.workers,
    femaleWorkers: day.femaleWorkers,
    maleWorkers: day.maleWorkers,
    equipment: day.equipmentUsed.map((item) => `${item.name} ${item.qty || ""} ${item.unit || ""}`.trim()).join(", "),
    cementUsed: day.cement.used,
    cementReceived: day.cement.received,
    materials: day.materialOnDailyReport.map((item) => `${item.name} ${item.qty || ""} ${item.unit || ""}`.trim()).join(", "),
  };
}

function arrivedTotals(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = [row.site_name, row.category_name, row.subcategory_name, row.type_name, row.unit].map((value) => norm(value)).join("|");
    const current = map.get(key) || {
      site: row.site_name,
      category: row.category_name,
      subcategory: row.subcategory_name,
      type: row.type_name,
      unit: row.unit,
      quantity: 0,
      receipts: 0,
      lastDate: "",
    };
    current.quantity += Number(row.quantity) || 0;
    current.receipts += 1;
    const date = String(row.created_at || "").slice(0, 10);
    if (date > current.lastDate) current.lastDate = date;
    map.set(key, current);
  });
  return [...map.values()];
}

function oneReportPerSiteDay(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = `${norm(row.site)}|${String(row.date || "").slice(0, 10)}`;
    const current = map.get(key);
    if (!current || (current.report_type === "morning" && row.report_type !== "morning")) {
      map.set(key, row);
    }
  });
  return [...map.values()];
}

function asksForSummary(q) {
  return /\b(count|counts|total|how many|how much|ketla|ketli|ketlu|number of)\b/.test(q);
}

function replyText(answer) {
  if (!answer) return answer;
  return { text: answer.text, chips: answer.chips };
}

function countLeaveDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const from = new Date(`${String(fromDate).slice(0, 10)}T00:00:00`);
  const to = new Date(`${String(toDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 0;
  return Math.floor((to - from) / 86400000) + 1;
}

async function ownLeaveBalanceAnswer(user, chips) {
  const username = user?.user_name || user?.username || "";
  const month = ymd().slice(0, 7);
  if (isMonthlyLeaveRole(user)) {
    const balance = await computeMonthlyLeaveBalance(supabase, { user_name: username }, month);
    return {
      text: `You have ${balance.remaining} leave day${balance.remaining === 1 ? "" : "s"} left this month. ${balance.broughtForward} carried over, plus ${balance.quotaPerMonth} for this month, minus ${balance.thisMonthUsed} already used.`,
      chips,
    };
  }
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const from = `${fyStart}-04-01`;
  const to = `${fyStart + 1}-03-31`;
  const { data, error } = await supabase
    .from("leaves")
    .select("from_date, to_date, status")
    .eq("user_name", username)
    .gte("to_date", from)
    .lte("from_date", to);
  if (error) return { text: error.message || "Could not load your leave balance.", chips };
  const used = (data || [])
    .filter((row) => norm(row.status) === "approved")
    .reduce((sum, row) => {
      const start = row.from_date < from ? from : row.from_date;
      const end = row.to_date > to ? to : row.to_date;
      return sum + countLeaveDays(start, end);
    }, 0);
  const remaining = Math.max(0, 60 - used);
  return {
    text: `You have ${remaining} leave day${remaining === 1 ? "" : "s"} left in this Apr–Mar cycle. ${used} of 60 days are already used.`,
    chips,
  };
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

function userSiteNames(user) {
  const out = [];
  const push = (value) => {
    const name = String(value || "").trim();
    if (!name || out.some((item) => norm(item) === norm(name))) return;
    out.push(name);
  };
  const raw = user?.site_names;
  if (Array.isArray(raw)) raw.forEach(push);
  else if (typeof raw === "string" && raw.trim()) raw.split(",").forEach(push);
  push(user?.site_name);
  return out;
}

function onUserSites(name, sites) {
  const value = norm(name);
  if (!value) return false;
  return sites.some((site) => norm(site) === value);
}

function personOnSites(person, sites) {
  if (onUserSites(person?.site_name, sites)) return true;
  const raw = person?.site_names;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  return list.some((site) => onUserSites(site, sites));
}

let siteCache = { key: "", at: 0, data: null };

async function loadSiteContext(user) {
  const mine = userSiteNames(user);
  const key = `v4|${mine.map(norm).sort().join("|")}`;
  if (siteCache.data && siteCache.key === key && Date.now() - siteCache.at < CACHE_TTL_MS) {
    return siteCache.data;
  }
  if (!mine.length) {
    return { mine, empty: true, errors: [] };
  }

  const base = await loadContext();
  const [usersRes, dprRes, wprRes, svrRes, materialRes] = await Promise.all([
    supabase
      .from("user_details")
      .select("id, name, username, role, department, site_name, site_names, status")
      .order("name", { ascending: true }),
    supabase
      .from("dpr_reports")
      .select("id, site, engineer, report_type, date, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(600),
    supabase
      .from("wpr_reports")
      .select("id, site_name, engineer_name, report_date, report_number, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("site_reports")
      .select("id, site_name, reporter_name, designation, visit_date, progress_of_work, quality_observations, safety_concerns, issues_concerns, site_visit_instructions, key_instructions, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("site_material_arrivals")
      .select("id, site_name, category_name, subcategory_name, type_name, quantity, unit, recorded_by, created_at")
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const users = (usersRes.data || []).filter((person) => personOnSites(person, mine));
  const userKeys = new Set(
    users.flatMap((person) => [norm(person.username), norm(person.name)]).filter(Boolean),
  );
  const data = {
    mine,
    empty: false,
    users,
    tasks: base.allTasks.filter((task) => onUserSites(task.site_name, mine)),
    leaves: base.leaves.filter(
      (leave) =>
        onUserSites(leave.site_name, mine) ||
        userKeys.has(norm(leave.user_name)) ||
        userKeys.has(norm(leave.name)),
    ),
    tickets: base.tickets.filter((ticket) => onUserSites(ticket.site_name, mine)),
    dprs: (dprRes.data || []).filter((row) => onUserSites(row.site, mine)),
    wprs: (wprRes.data || []).filter((row) => onUserSites(row.site_name, mine)),
    visits: (svrRes.data || []).filter((row) => onUserSites(row.site_name, mine)),
    materials: (materialRes.data || []).filter((row) => onUserSites(row.site_name, mine)),
    sites: (base.sites || []).filter((site) => onUserSites(site.site_name, mine)),
    allSiteNames: (base.sites || []).map((site) => site.site_name).filter(Boolean),
    errors: [usersRes.error, dprRes.error, wprRes.error, svrRes.error, materialRes.error]
      .filter(Boolean)
      .map((error) => error.message),
  };
  siteCache = { key, at: Date.now(), data };
  return data;
}

function siteHelpText(name, sites) {
  const list = sites.length ? sites.join(", ") : "none assigned";
  return {
    text: `Hi${name ? ` ${name}` : ""}, I’m DIP Bot for your sites (${list}).\n\nI can show:\n• Daily, weekly and site visit reports\n• Arrived material\n• Tasks and tickets on your sites\n• Who from the site team is on leave\n• A site dashboard`,
    chips: DIP_SITE_CHIPS,
  };
}

function mentionedOwnSite(query, sites) {
  return sites.find((site) => {
    const name = norm(site);
    return name.length > 2 && query.includes(name);
  }) || "";
}

function siteAnswer(text) {
  return { text, chips: DIP_SITE_CHIPS };
}

function reportSubject(text) {
  const q = normalizeSiteQuestion(text);
  if ((hasTerm(q, "wpr") || q.includes("weekly report")) && !hasAnyTerm(q, ["dpr", "daily"])) return "weekly";
  return "daily";
}

function preferredReport(rows) {
  return (rows || []).find((row) => row.report_type !== "morning" && manpowerCount(row.payload) != null)
    || (rows || []).find((row) => row.report_type !== "morning")
    || (rows || [])[0]
    || null;
}

async function classifySiteIntentWithGroq(question) {
  const message = await groqChat([
    {
      role: "system",
      content: `Classify this site-portal question. Reply with one label only: ${SITE_INTENTS.join(", ")}, or NONE. Do not answer the question and do not invent numbers.`,
    },
    { role: "user", content: question },
  ]);
  const label = String(message?.content || "").toUpperCase().replace(/[^A-Z_]/g, "");
  return SITE_INTENTS.includes(label) ? label : null;
}

function answerFromSiteIntent(intent, text, ctx, focus, inFocus) {
  const q = normalizeSiteQuestion(text);
  const range = extractDateRange(text);
  const output = extractRequestedOutput(text);
  const today = ymd();
  const where = focus ? ` at ${focus}` : "";
  const names = focus ? [focus] : ctx.mine;
  const tasks = (ctx.tasks || []).filter((task) => inFocus(task.site_name));
  const dprs = (ctx.dprs || []).filter((row) => inFocus(row.site));

  if (intent === "SITE_LIST") {
    return siteAnswer(`Your sites: ${ctx.mine.join(", ")}.`);
  }

  if (intent === "SITE_COUNT") {
    if (hasTerm(q, "active")) {
      const records = (ctx.sites || []).filter((site) => onUserSites(site.site_name, names));
      const known = records.filter((site) => norm(site.status));
      if (!known.length) {
        return siteAnswer("No status is saved on your site records, so active projects cannot be counted from assigned sites alone.");
      }
      const active = known.filter((site) => norm(site.status) === "active");
      return siteAnswer(active.length
        ? `${active.length} active project${active.length === 1 ? "" : "s"}: ${active.map((site) => site.site_name).join(", ")}.`
        : "0 active projects. None of your assigned sites have status Active.");
    }
    return siteAnswer(`You have ${names.length} assigned site${names.length === 1 ? "" : "s"}: ${names.join(", ")}.`);
  }

  if (intent === "SITE_STATUS") {
    const records = (ctx.sites || []).filter((site) => onUserSites(site.site_name, names));
    if (!records.length) return siteAnswer(`No site record with a status was found${where || " for your sites"}.`);
    return siteAnswer(`${records.map((site) => `${site.site_name}: ${site.status || "no status saved"}`).join(". ")}.`);
  }

  if (intent === "PENDING_WORK" || intent === "TODAY_PENDING_WORK" || intent === "PENDING_TASK_COUNT" || intent === "TASK_COUNT" || intent === "DELAYED_ACTIVITIES" || intent === "COMPLETED_WORK") {
    let list = tasks;
    let heading = "tasks";
    if (intent === "TODAY_PENDING_WORK") {
      const day = range?.from || today;
      list = list.filter((task) => ["pending", "in_progress"].includes(norm(task.status)) && String(task.due_date || "").slice(0, 10) === day);
      heading = `tasks due ${prettyDate(day)}`;
    } else if (intent === "DELAYED_ACTIVITIES") {
      list = list.filter((task) => {
        const due = String(task.due_date || "").slice(0, 10);
        return due && due < today && !["completed", "not_applicable"].includes(norm(task.status));
      });
      heading = "delayed tasks";
    } else if (intent === "COMPLETED_WORK") {
      const day = range?.from || "";
      list = list.filter((task) => norm(task.status) === "completed" && (!day || String(task.due_date || "").slice(0, 10) === day));
      heading = day ? `completed tasks due ${prettyDate(day)}` : "completed tasks";
    } else if (intent === "TASK_COUNT") {
      heading = "tasks";
    } else {
      list = list.filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
      heading = "pending tasks";
    }
    if (output === "count" || intent === "TASK_COUNT" || intent === "PENDING_TASK_COUNT") {
      return siteAnswer(`${list.length} ${heading}${where}.`);
    }
    if (intent === "PENDING_WORK" && (q.includes("which site") || q.includes("kai site"))) {
      const bySite = tally(list, (task) => task.site_name || "Unknown");
      if (!bySite.length) return siteAnswer(`No pending work${where}.`);
      return siteAnswer(`${bySite.map((item) => `${item.name}: ${item.count} pending`).join(". ")}.`);
    }
    if (!list.length) return siteAnswer(`No ${heading}${where}.`);
    const shown = list.slice(0, 12);
    const lines = shown.map((task) => `${task.title || "Untitled"} (${task.site_name || "—"}, due ${prettyDate(task.due_date)})`);
    const more = list.length > shown.length ? ` Showing ${shown.length} of ${list.length}.` : "";
    return siteAnswer(`${list.length} ${heading}${where}. ${lines.join("; ")}.${more}`);
  }

  if (intent === "WEEKLY_REPORTS" || intent === "WEEKLY_REPORT_COUNT" || intent === "LATEST_REPORT" || intent === "REPORT_HISTORY") {
    if (reportSubject(text) === "weekly" && intent !== "REPORT_HISTORY") {
      const list = (ctx.wprs || []).filter((row) => inFocus(row.site_name));
      if (intent === "WEEKLY_REPORT_COUNT" || output === "count") {
        return siteAnswer(`${list.length} weekly report${list.length === 1 ? "" : "s"}${where}.`);
      }
      const row = list[0];
      if (intent === "LATEST_REPORT") {
        return siteAnswer(row
          ? `Latest weekly report: ${row.site_name}, ${row.report_date || prettyDate(row.created_at)}, no. ${row.report_number ?? "—"}, ${row.engineer_name || "—"}.`
          : `No weekly report is saved${where}.`);
      }
      if (!list.length) return siteAnswer(`No weekly reports${where}.`);
      const lines = list.slice(0, 12).map((item) => `${item.report_date || prettyDate(item.created_at)} · ${item.site_name} · no. ${item.report_number ?? "—"}`);
      return siteAnswer(`${list.length} weekly report${list.length === 1 ? "" : "s"}${where}. ${lines.join("; ")}.`);
    }
    const window = intent === "LATEST_REPORT"
      ? null
      : (range || (intent === "REPORT_HISTORY"
        ? { from: addDays(today, -29), to: today, label: "the last 30 days" }
        : { from: startOfWeek(today), to: addDays(startOfWeek(today), 6), label: "this week" }));
    let list = window ? dprs.filter((row) => {
      const day = String(row.date || "").slice(0, 10);
      return day >= window.from && day <= window.to;
    }) : dprs;
    const label = window?.label || "on record";
    if (intent === "WEEKLY_REPORT_COUNT" || output === "count") {
      return siteAnswer(`${list.length} daily report${list.length === 1 ? "" : "s"} ${label}${where}.`);
    }
    if (intent === "LATEST_REPORT") {
      const row = [...list].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
      if (!row) return siteAnswer(`No daily report is saved${where}.`);
      const progress = clipText(asPayload(row.payload).summary, 180);
      return siteAnswer(`Latest daily report: ${row.site}, ${prettyDate(row.date)}, ${row.report_type || "report"}, ${row.engineer || "—"}.${progress ? ` ${progress}` : ""}`);
    }
    if (!list.length) return siteAnswer(`No daily reports ${label}${where}.`);
    const shown = list.slice(0, 12);
    const lines = shown.map((row) => `${prettyDate(row.date)} · ${row.site} · ${row.report_type || "report"}`);
    const more = list.length > shown.length ? ` Showing ${shown.length} of ${list.length}.` : "";
    return siteAnswer(`${list.length} daily report${list.length === 1 ? "" : "s"} ${label}${where}. ${lines.join("; ")}.${more}`);
  }

  if (intent === "TODAY_MANPOWER") {
    const day = range?.from || today;
    const rows = dprs.filter((row) => String(row.date || "").slice(0, 10) === day);
    const female = hasTerm(q, "female");
    const male = hasTerm(q, "male") && !female;
    if (!rows.some((row) => manpowerCount(row.payload) != null)) {
      return siteAnswer(`No worker count is recorded in the DPR for ${prettyDate(day)}${where || ` (${names.join(", ")})`}.`);
    }
    const parts = names.map((site) => {
      const picked = preferredReport(rows.filter((row) => norm(row.site) === norm(site) && manpowerCount(row.payload) != null));
      if (!picked) return `${site}: no worker count in the DPR`;
      const people = asPayload(picked.payload).manpower || [];
      if (female) return `${site}: ${genderTotal(people, "female")} female workers`;
      if (male) return `${site}: ${genderTotal(people, "male")} male workers`;
      return `${site}: ${manpowerCount(picked.payload)} workers`;
    });
    return siteAnswer(`${prettyDate(day)} — ${parts.join(". ")}.`);
  }

  if (intent === "SITE_PROGRESS") {
    const day = range?.from || today;
    const rows = dprs
      .filter((row) => String(row.date || "").slice(0, 10) === day && asPayload(row.payload).summary)
      .sort((a, b) => (a.report_type === "morning" ? 1 : 0) - (b.report_type === "morning" ? 1 : 0));
    if (!rows.length) return siteAnswer(`No progress note is saved in the DPR for ${prettyDate(day)}${where}.`);
    return siteAnswer(rows.slice(0, 3).map((row) => `${row.site}: ${String(asPayload(row.payload).summary).trim()}`).join("\n\n"));
  }

  if (intent === "EQUIPMENT") {
    const day = range?.from || today;
    const rows = dprs.filter((row) => String(row.date || "").slice(0, 10) === day);
    const lines = names.map((site) => {
      const picked = preferredReport(rows.filter((row) => norm(row.site) === norm(site)));
      const items = picked ? asPayload(picked.payload).equipment || [] : [];
      return items.length
        ? `${site}: ${items.map((item) => `${item.name} ${item.qty || ""} ${item.unit || ""}`.trim()).join(", ")}`
        : `${site}: no equipment recorded`;
    });
    return siteAnswer(`Equipment on ${prettyDate(day)} — ${lines.join(". ")}.`);
  }

  if (intent === "MATERIALS" || intent === "ARRIVED_MATERIAL") {
    const needle = ["cement", "sand", "steel", "tiles", "ply", "civil", "electric", "plumbing", "flooring", "furniture"].find((word) => hasTerm(q, word));
    let arrived = (ctx.materials || []).filter((row) => inFocus(row.site_name));
    if (needle) {
      arrived = arrived.filter((row) => norm([row.category_name, row.subcategory_name, row.type_name].join(" ")).includes(needle));
    }
    const sums = new Map();
    arrived.forEach((row) => {
      const unit = row.unit || "units";
      sums.set(unit, (sums.get(unit) || 0) + (Number(row.quantity) || 0));
    });
    const qty = [...sums.entries()].filter(([, amount]) => amount).map(([unit, amount]) => `${amount} ${unit}`).join(", ");
    const arrivedLine = arrived.length
      ? `${needle ? needle : "Material"} arrived${where}: ${qty || `${arrived.length} receipts`}.`
      : `No ${needle || "matching"} material has arrived${where}.`;
    const asksUse = hasAnyTerm(q, ["use", "used", "upyog"]);
    if (intent === "ARRIVED_MATERIAL" || !asksUse) {
      if (output === "count") return siteAnswer(arrivedLine);
      const shown = arrived.slice(0, 12).map((row) => `${String(row.created_at || "").slice(0, 10)} ${row.type_name || row.subcategory_name || row.category_name || ""} ${row.quantity ?? ""} ${row.unit || ""}`.trim());
      return siteAnswer(shown.length ? `${arrivedLine} ${shown.join("; ")}.` : arrivedLine);
    }
    const day = range?.from || today;
    const rows = dprs.filter((row) => String(row.date || "").slice(0, 10) === day);
    const used = names.map((site) => {
      const picked = preferredReport(rows.filter((row) => norm(row.site) === norm(site)));
      const payload = picked ? asPayload(picked.payload) : {};
      if (!needle || needle === "cement") {
        const usedQty = payload.cementUsed;
        return `${site}: cement used ${usedQty === undefined || usedQty === "" ? "not filled in the DPR" : usedQty}`;
      }
      const items = payload.material || [];
      return items.length
        ? `${site}: ${items.map((item) => `${item.name} ${item.qty} ${item.unit}`).join(", ")}`
        : `${site}: material use not filled in the DPR`;
    });
    return siteAnswer(`${arrivedLine} ${prettyDate(day)} — ${used.join(". ")}.`);
  }

  if (intent === "VISITORS") {
    const day = range?.from || today;
    const rows = dprs.filter((row) => String(row.date || "").slice(0, 10) === day);
    const lines = [];
    names.forEach((site) => {
      const picked = preferredReport(rows.filter((row) => norm(row.site) === norm(site)));
      const visitors = picked ? asPayload(picked.payload).visitors || [] : [];
      if (visitors.length) {
        lines.push(`${site}: ${visitors.map((item) => `${item.name || "Visitor"}${item.instruction ? ` — ${item.instruction}` : ""}`).join("; ")}`);
      }
    });
    if (!lines.length) return siteAnswer(`No visitors are recorded in the DPR for ${prettyDate(day)}${where}.`);
    return siteAnswer(`${lines.join(". ")}.`);
  }

  if (intent === "CUBE_TESTS") {
    const day = range?.from || today;
    const rows = dprs.filter((row) => String(row.date || "").slice(0, 10) === day);
    const lines = names.map((site) => {
      const picked = preferredReport(rows.filter((row) => norm(row.site) === norm(site)));
      const cube = picked ? String(asPayload(picked.payload).cube || "").trim() : "";
      return `${site}: ${cube || "no cube test recorded"}`;
    });
    return siteAnswer(`Cube tests for ${prettyDate(day)} — ${lines.join(". ")}.`);
  }

  if (intent === "LEAVE") {
    let list = (ctx.leaves || []).filter((leave) => !focus || inFocus(leave.site_name));
    if (mentionsToday(q)) list = list.filter((leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today));
    if (output === "count") return siteAnswer(`${list.length} leave record${list.length === 1 ? "" : "s"}${where}.`);
    if (!list.length) return siteAnswer(`No leave records matched${where}.`);
    const lines = list.slice(0, 12).map((leave) => `${leave.name || leave.user_name} ${leave.from_date} to ${leave.to_date} (${computeLeaveStatus(leave)})`);
    return siteAnswer(`${list.length} leave record${list.length === 1 ? "" : "s"}${where}. ${lines.join("; ")}.`);
  }

  if (intent === "TICKETS") {
    let list = (ctx.tickets || []).filter((ticket) => inFocus(ticket.site_name));
    if (!hasAnyTerm(q, ["solved", "closed", "resolved"])) list = list.filter((ticket) => norm(ticket.status) === "open");
    if (output === "count") return siteAnswer(`${list.length} ticket${list.length === 1 ? "" : "s"}${where}.`);
    if (!list.length) return siteAnswer(`No tickets matched${where}.`);
    const lines = list.slice(0, 12).map((ticket) => `${ticket.task_title || "Ticket"} · ${ticket.site_name || "—"} · ${ticket.status}`);
    return siteAnswer(`${list.length} ticket${list.length === 1 ? "" : "s"}${where}. ${lines.join("; ")}.`);
  }

  if (intent === "SITE_DASHBOARD") {
    const onLeave = (ctx.leaves || []).filter((leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today) && inFocus(leave.site_name));
    const open = tasks.filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
    const delayed = tasks.filter((task) => {
      const due = String(task.due_date || "").slice(0, 10);
      return due && due < today && !["completed", "not_applicable"].includes(norm(task.status));
    });
    const from = startOfWeek(today);
    const to = addDays(from, 6);
    const reports = dprs.filter((row) => {
      const day = String(row.date || "").slice(0, 10);
      return day >= from && day <= to;
    });
    return siteAnswer(`${focus || ctx.mine.join(", ")} on ${prettyDate(today)}: ${open.length} pending tasks, ${delayed.length} delayed, ${onLeave.length} on leave, ${reports.length} daily reports this week.`);
  }

  return null;
}

async function answerSiteDipQuery(rawText, user) {
  const text = String(rawText || "").trim();
  const q = norm(text);
  const ctx = await loadSiteContext(user);
  if (ctx.empty) {
    return {
      text: "No site is assigned on your login, so I can’t open site data.",
      chips: DIP_SITE_CHIPS,
    };
  }
  if (!q) return siteHelpText(user?.name, ctx.mine);

  const foreign = ctx.allSiteNames.find((site) => {
    const name = norm(site);
    return name.length > 2 && q.includes(name) && !onUserSites(site, ctx.mine);
  });
  const focus = mentionedOwnSite(q, ctx.mine);
  const inFocus = (name) => !focus || norm(name) === norm(focus);
  const today = ymd();
  const weekFrom = startOfWeek(today);
  const weekTo = addDays(weekFrom, 6);

  if (foreign && !focus) {
    return {
      text: `I can only open data for your sites: ${ctx.mine.join(", ")}.`,
      chips: DIP_SITE_CHIPS,
    };
  }

  const greeting = /^(hi|hello|hey|yo)\b/.test(q) || /\b(thank|thanks|thx)\b/.test(q);
  const intent = classifySiteIntent(text) || (greeting ? null : await classifySiteIntentWithGroq(text));
  if (intent) {
    const fromIntent = answerFromSiteIntent(intent, text, ctx, focus, inFocus);
    if (fromIntent) return fromIntent;
  }

  if (
    /^(hi|hello|hey|yo)\b/.test(q) ||
    /\b(help|what can you|capabilities)\b/.test(q)
  ) {
    return siteHelpText(user?.name, ctx.mine);
  }

  if (/\b(thank|thanks|thx)\b/.test(q)) {
    return { text: "Anytime. Ask about reports, material, tasks, or leave on your sites.", chips: DIP_SITE_CHIPS };
  }

  if (/\b(my sites|which sites|assigned sites|badha site|badha sites)\b/.test(q)) {
    return {
      text: `Your sites: ${ctx.mine.join(", ")}.`,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(active projects|how many projects|ketli sites|ketla site)\b/.test(q)) {
    return {
      text: `You have ${ctx.mine.length} assigned site${ctx.mine.length === 1 ? "" : "s"}: ${ctx.mine.join(", ")}.`,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(worker|workers|labour|labor|majur|majuri|kamdar)\b/.test(q)) {
    let day = today;
    if (/\b(yesterday|kal|kale)\b/.test(q) && !/\baaje\b/.test(q)) day = addDays(today, -1);
    const rows = ctx.dprs.filter((row) => String(row.date || "").slice(0, 10) === day && inFocus(row.site));
    const bySite = new Map();
    rows.forEach((row) => {
      const count = manpowerCount(row.payload);
      if (count == null) return;
      const evening = row.report_type !== "morning";
      const prev = bySite.get(row.site);
      if (!prev || (evening && !prev.evening)) bySite.set(row.site, { count, evening });
    });
    const names = focus ? [focus] : ctx.mine;
    if (!bySite.size) {
      return {
        text: `No worker count is recorded in the ${day === today ? "today's" : prettyDate(day)} DPR for ${names.join(", ")}.`,
        chips: DIP_SITE_CHIPS,
      };
    }
    const parts = names.map((site) => {
      const found = [...bySite.entries()].find(([name]) => norm(name) === norm(site));
      return found ? `${found[0]}: ${found[1].count} workers` : `${site}: no count in the DPR`;
    });
    return {
      text: `${day === today ? "Today" : prettyDate(day)} — ${parts.join(". ")}.`,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(progress|summary of work|work summary)\b/.test(q) || /progress thayu/.test(q)) {
    let day = today;
    if (/\b(yesterday|kal|kale)\b/.test(q) && !/\baaje\b/.test(q)) day = addDays(today, -1);
    const rows = ctx.dprs
      .filter((row) => String(row.date || "").slice(0, 10) === day && inFocus(row.site) && row.payload?.summary)
      .sort((a, b) => (a.report_type === "morning" ? 1 : 0) - (b.report_type === "morning" ? 1 : 0));
    if (!rows.length) {
      return { text: `No progress note is saved in the DPR for ${prettyDate(day)}.`, chips: DIP_SITE_CHIPS };
    }
    const text = rows.slice(0, 3).map((row) => `${row.site}: ${String(row.payload.summary).trim()}`).join("\n\n");
    return { text, chips: DIP_SITE_CHIPS };
  }

  if (/\b(dashboard|summary|overview|snapshot)\b/.test(q)) {
    const onLeave = ctx.leaves.filter(
      (leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today) && inFocus(leave.site_name),
    );
    const openTasks = ctx.tasks.filter(
      (task) => ["pending", "in_progress"].includes(norm(task.status)) && inFocus(task.site_name),
    );
    const openTickets = ctx.tickets.filter(
      (ticket) => norm(ticket.status) === "open" && inFocus(ticket.site_name),
    );
    const recentDpr = ctx.dprs.filter((row) => {
      const date = String(row.date || "").slice(0, 10);
      return date >= weekFrom && date <= weekTo && inFocus(row.site);
    });
    const monthAgo = addDays(today, -30);
    const recentMaterial = ctx.materials.filter(
      (row) => String(row.created_at || "").slice(0, 10) >= monthAgo && inFocus(row.site_name),
    );
    return {
      text: `Site snapshot for ${focus || ctx.mine.join(", ")} · ${prettyDate(today)}`,
      columns: ["Metric", "Count"],
      rows: [
        { Metric: "Team on site", Count: String(ctx.users.filter((person) => !focus || personOnSites(person, [focus])).length) },
        { Metric: "On leave today", Count: String(onLeave.length) },
        { Metric: "Open tasks", Count: String(openTasks.length) },
        { Metric: "Open tickets", Count: String(openTickets.length) },
        { Metric: "Daily reports this week", Count: String(recentDpr.length) },
        { Metric: "Material receipts (30 days)", Count: String(recentMaterial.length) },
      ],
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(material|arrived|receipt|cement|sand|steel|tiles|ply|civil|electric|plumbing|flooring|furniture)\b/.test(q)) {
    let list = ctx.materials.filter((row) => inFocus(row.site_name));
    const categoryWord = ["civil", "electric", "plumbing", "flooring", "furniture"].find((word) => q.includes(word));
    if (categoryWord) list = list.filter((row) => norm(row.category_name).includes(categoryWord));
    const skip = new Set(["material", "arrived", "receipt", "receipts", "show", "latest", "site", "sites", "what", "the", "total", "count", "counts", "how", "many", "much", "number", "ketla", "ketli", "ketlu", "for", "from", "this", "that", "with", "and", "all"]);
    const words = q.split(/\s+/).filter((word) => word.length > 2 && !skip.has(word) && word !== categoryWord);
    if (words.length) {
      const narrowed = list.filter((row) => {
        const blob = norm([row.category_name, row.subcategory_name, row.type_name, row.unit].join(" "));
        return words.every((word) => blob.includes(word));
      });
      if (narrowed.length || words.length === 1) list = narrowed;
    }
    const total = list.length;
    const label = categoryWord ? `${titleCase(categoryWord)} ` : "";
    const where = focus ? ` at ${focus}` : "";
    if (asksForSummary(q)) {
      const sums = new Map();
      list.forEach((row) => {
        const key = `${row.unit || "units"}`;
        sums.set(key, (sums.get(key) || 0) + (Number(row.quantity) || 0));
      });
      const qty = [...sums.entries()]
        .filter(([, amount]) => amount)
        .map(([unit, amount]) => `${amount} ${unit}`)
        .join(", ");
      const countLine = total
        ? `${label}arrived material count is ${total}${where}.`
        : `No ${label}arrived material matched that${where}.`;
      const wantsQuantity = /\b(total|how much)\b/.test(q) && !/\b(count|counts|how many|ketla|ketli|ketlu|number of)\b/.test(q);
      const text = qty && wantsQuantity ? `${countLine} Quantity: ${qty}.` : countLine;
      return { text, chips: DIP_SITE_CHIPS };
    }
    const shown = list.slice(0, 25);
    const rows = shown.map((row) => ({
      Date: prettyDateTime(row.created_at),
      Site: row.site_name || "—",
      Material: [row.subcategory_name, row.type_name].filter(Boolean).join(" · ") || row.category_name || "—",
      Qty: `${row.quantity ?? ""} ${row.unit || ""}`.trim(),
      By: row.recorded_by || "—",
    }));
    const tbl = table(["Date", "Site", "Material", "Qty", "By"], rows, `No ${label}arrived material matched that.`);
    return {
      text: tbl.rows ? `${total} ${label}material receipt${total === 1 ? "" : "s"}${where}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(dpr|daily report|daily reports)\b/.test(q)) {
    let list = ctx.dprs.filter((row) => inFocus(row.site));
    let when = "";
    if (/\bmorning\b/.test(q)) list = list.filter((row) => row.report_type === "morning");
    else if (/\bevening\b/.test(q)) list = list.filter((row) => row.report_type === "evening");
    if (asksToday(q)) {
      list = list.filter((row) => String(row.date || "").slice(0, 10) === today);
      when = " today";
    } else if (asksThisWeek(q)) {
      list = list.filter((row) => {
        const date = String(row.date || "").slice(0, 10);
        return date >= weekFrom && date <= weekTo;
      });
      when = " this week";
    }
    const total = list.length;
    list = list.slice(0, 25);
    const rows = list.map((row) => ({
      Date: prettyDate(row.date),
      Site: row.site || "—",
      Type: titleCase(row.report_type),
      Engineer: row.engineer || "—",
    }));
    const where = focus ? ` at ${focus}` : " on your sites";
    const tbl = table(["Date", "Site", "Type", "Engineer"], rows, `No daily reports${when}${where}.`);
    return {
      text: tbl.rows ? `${total} daily report${total === 1 ? "" : "s"}${when}${where}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(wpr|weekly report|weekly reports)\b/.test(q)) {
    const list = ctx.wprs.filter((row) => inFocus(row.site_name)).slice(0, 25);
    const rows = list.map((row) => ({
      Date: row.report_date || prettyDate(row.created_at),
      Site: row.site_name || "—",
      No: row.report_number ?? "—",
      Engineer: row.engineer_name || "—",
    }));
    const tbl = table(["Date", "Site", "No", "Engineer"], rows, "No weekly reports matched that.");
    return {
      text: tbl.rows ? `${list.length} weekly report${list.length === 1 ? "" : "s"}${focus ? ` at ${focus}` : ""}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(site visit|svr|visit report)\b/.test(q)) {
    const list = ctx.visits.filter((row) => inFocus(row.site_name)).slice(0, 25);
    const rows = list.map((row) => ({
      Date: prettyDate(row.visit_date),
      Site: row.site_name || "—",
      By: row.reporter_name || "—",
    }));
    const tbl = table(["Date", "Site", "By"], rows, "No site visit reports matched that.");
    return {
      text: tbl.rows ? `${list.length} site visit report${list.length === 1 ? "" : "s"}${focus ? ` at ${focus}` : ""}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(ticket|tickets)\b/.test(q)) {
    let list = ctx.tickets.filter((ticket) => inFocus(ticket.site_name));
    if (!/\b(solved|closed|resolved)\b/.test(q)) {
      list = list.filter((ticket) => norm(ticket.status) === "open");
    }
    const tbl = table(
      ["Task", "Raised", "To", "Site", "Status", "When"],
      ticketRows(list.slice(0, 25)),
      "No tickets matched that on your sites.",
    );
    return {
      text: tbl.rows ? `${list.length} ticket${list.length === 1 ? "" : "s"}${focus ? ` at ${focus}` : ""}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(leave|leaves|on leave|absent)\b/.test(q)) {
    if (asksOwnLeaveBalance(q)) return ownLeaveBalanceAnswer(user, DIP_SITE_CHIPS);
    let list = ctx.leaves.filter((leave) => !focus || inFocus(leave.site_name) || personOnSites({ site_name: leave.site_name, name: leave.name }, focus ? [focus] : ctx.mine));
    let label = "leave requests";
    if (/\bpending\b/.test(q)) {
      list = list.filter((leave) => computeLeaveStatus(leave) === "pending");
      label = "pending leave requests";
    } else if (asksThisWeek(q)) {
      list = list.filter((leave) => computeLeaveStatus(leave) === "approved" && overlapsRange(leave, weekFrom, weekTo));
      label = "people on leave this week";
    } else if (asksToday(q) || /\b(who|kon|whose)\b/.test(q) || /\bon leave\b/.test(q)) {
      list = list.filter((leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today));
      label = "people on leave today";
    } else {
      label = "leave requests on your sites";
    }
    const emptyLabel = label.includes("your sites") ? label : `${label} on your sites`;
    const tbl = table(["Name", "Type", "From", "To", "Status", "Site"], leaveRows(list), `No ${emptyLabel}.`);
    return {
      text: tbl.rows ? `${list.length} ${label}${focus ? ` at ${focus}` : ""}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(task|tasks|overdue|pending|in progress|activity|activities|delay|delayed)\b/.test(q) || /\bwork\b/.test(q)) {
    let list = ctx.tasks.filter((task) => inFocus(task.site_name));
    let heading = "tasks";
    if (/\b(overdue|delayed|delay)\b/.test(q)) {
      list = list.filter((task) => {
        const due = String(task.due_date || "").slice(0, 10);
        return due && due < today && !["completed", "not_applicable"].includes(norm(task.status));
      });
      heading = "overdue tasks";
    } else if (/\bin progress\b/.test(q)) {
      list = list.filter((task) => norm(task.status) === "in_progress");
      heading = "in-progress tasks";
    } else if (/\b(my|mine)\b/.test(q)) {
      const me = norm(user?.user_name || user?.username);
      list = list.filter((task) => norm(task.assigned_to) === me && ["pending", "in_progress"].includes(norm(task.status)));
      heading = "your open tasks";
    } else {
      list = list.filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
      heading = "open tasks";
    }
    const tbl = table(
      ["Title", "Assigned", "Due", "Status", "Site", "Type"],
      taskRows({ users: ctx.users }, list.slice(0, 25)),
      `No ${heading} on your sites.`,
    );
    return {
      text: tbl.rows ? `${list.length} ${heading}${focus ? ` at ${focus}` : ""}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  if (/\b(team|employee|employees|staff|who works|people)\b/.test(q)) {
    const list = ctx.users.filter((person) => !focus || personOnSites(person, [focus]));
    const rows = list.map((person) => ({
      Name: person.name || person.username,
      Role: person.role || "—",
      Department: person.department || "—",
      Site: person.site_name || (Array.isArray(person.site_names) ? person.site_names.join(", ") : "—"),
    }));
    const tbl = table(["Name", "Role", "Department", "Site"], rows, "No team members matched that.");
    return {
      text: tbl.rows ? `${list.length} people${focus ? ` at ${focus}` : " on your sites"}.` : tbl.text,
      ...tbl,
      chips: DIP_SITE_CHIPS,
    };
  }

  return {
    text: `I can answer about your sites (${ctx.mine.join(", ")}): daily and weekly reports, site visits, arrived material, tasks, tickets, and leave.`,
    chips: DIP_SITE_CHIPS,
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
      supabase.from("hr_documents").select("*").order("created_at", { ascending: false }).limit(300),
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

function identityKeys(user) {
  return [user?.user_name, user?.username, user?.name].map(norm).filter(Boolean);
}

function matchesMe(value, user) {
  const key = norm(value);
  return !!key && identityKeys(user).includes(key);
}

async function answerOfficeDipQuery(rawText, user) {
  const text = String(rawText || "").trim();
  const q = norm(text);
  const ctx = await loadContext();
  const today = ymd();
  const me = ctx.users.find((person) => matchesMe(person.username, user) || matchesMe(person.name, user));
  const profile = me || user || {};
  const sites = Array.isArray(profile.site_names) && profile.site_names.length
    ? profile.site_names
    : profile.site_name
      ? [profile.site_name]
      : userSiteNames(user);
  const myTasks = ctx.allTasks.filter((task) => matchesMe(task.assigned_to, user));
  const myLeaves = ctx.leaves.filter((leave) => matchesMe(leave.user_name, user) || matchesMe(leave.name, user));
  const myTickets = ctx.tickets.filter(
    (ticket) =>
      matchesMe(ticket.raised_by, user) ||
      matchesMe(ticket.raised_by_name, user) ||
      matchesMe(ticket.assigned_to, user) ||
      matchesMe(ticket.assigned_to_name, user),
  );

  if (!q || /^(hi|hello|hey)\b/.test(q) || /\b(help|what can you)\b/.test(q)) {
    return {
      text: `Hi${profile.name ? ` ${profile.name}` : ""}, I can show your profile, tasks, leave, attendance, and tickets.`,
      chips: DIP_OFFICE_CHIPS,
    };
  }
  if (/\b(thank|thanks)\b/.test(q)) {
    return { text: "Anytime. Ask about your tasks, leave, attendance, or tickets.", chips: DIP_OFFICE_CHIPS };
  }

  if (/\b(profile|who am i|my details|about me|dashboard|summary)\b/.test(q)) {
    const openTasks = myTasks.filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
    const pendingLeave = myLeaves.filter((leave) => computeLeaveStatus(leave) === "pending");
    const onLeave = myLeaves.some((leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today));
    return {
      text: `${profile.name || profile.username || "Your profile"}${profile.role ? ` · ${profile.role}` : ""}${profile.department ? ` · ${profile.department}` : ""}. ${onLeave ? "You are on leave today." : "You are not on approved leave today."}`,
      columns: ["Detail", "Value"],
      rows: [
        { Detail: "Username", Value: profile.username || profile.user_name || "—" },
        { Detail: "Department", Value: profile.department || "—" },
        { Detail: "Role", Value: profile.role || "—" },
        { Detail: "Sites", Value: sites.length ? sites.join(", ") : "—" },
        { Detail: "Open tasks", Value: String(openTasks.length) },
        { Detail: "Pending leave", Value: String(pendingLeave.length) },
        { Detail: "My tickets", Value: String(myTickets.length) },
      ],
      chips: DIP_OFFICE_CHIPS,
    };
  }

  if (/\b(attendance|clock|present|late)\b/.test(q)) {
    const username = profile.username || profile.user_name || user?.user_name || user?.username;
    const from = addDays(today, -30);
    const { data, error } = await supabase
      .from("attendance")
      .select("user_name, name, date, clock_in, clock_out, clock_in_status")
      .eq("user_name", username || "")
      .gte("date", from)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(31);
    if (error) return { text: error.message || "Could not load your attendance.", chips: DIP_OFFICE_CHIPS };
    const rows = data || [];
    const todayRow = rows.find((row) => String(row.date || "").slice(0, 10) === today);
    const tbl = table(
      ["Name", "Date", "Status", "In", "Out"],
      attendanceRows(rows.slice(0, 15)),
      "No attendance rows in the last 30 days.",
    );
    return {
      text: todayRow?.clock_in
        ? `Today you are ${attendanceStatus(todayRow).toLowerCase()}, clocked in at ${fmtClock(todayRow.clock_in)}.`
        : "No clock-in recorded for you today.",
      ...tbl,
      chips: DIP_OFFICE_CHIPS,
    };
  }

  if (/\b(leave|leaves)\b/.test(q)) {
    if (asksOwnLeaveBalance(q)) return ownLeaveBalanceAnswer(user, DIP_OFFICE_CHIPS);
    let list = myLeaves;
    let label = "your leave requests";
    if (/\bpending\b/.test(q)) {
      list = list.filter((leave) => computeLeaveStatus(leave) === "pending");
      label = "your pending leave requests";
    } else if (/\btoday\b/.test(q)) {
      list = list.filter((leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today));
      label = "your leave covering today";
    }
    const tbl = table(["Name", "Type", "From", "To", "Status", "Site"], leaveRows(list.slice(0, 20)), `No ${label}.`);
    return {
      text: tbl.rows ? `${list.length} ${label}.` : tbl.text,
      ...tbl,
      chips: DIP_OFFICE_CHIPS,
    };
  }

  if (/\b(ticket|tickets)\b/.test(q)) {
    const tbl = table(
      ["Task", "Raised", "To", "Site", "Status", "When"],
      ticketRows(myTickets.slice(0, 20)),
      "No tickets on your profile.",
    );
    return {
      text: tbl.rows ? `${myTickets.length} ticket${myTickets.length === 1 ? "" : "s"} linked to you.` : tbl.text,
      ...tbl,
      chips: DIP_OFFICE_CHIPS,
    };
  }

  let list = myTasks;
  let heading = "your tasks";
  if (/\b(i delegated|assigned by me|i assigned)\b/.test(q)) {
    list = ctx.allTasks.filter((task) => matchesMe(task.assigned_by, user));
    heading = "tasks you assigned";
  } else if (/\boverdue|delayed\b/.test(q)) {
    list = list.filter((task) => {
      const due = String(task.due_date || "").slice(0, 10);
      return due && due < today && !["completed", "not_applicable"].includes(norm(task.status));
    });
    heading = "your overdue tasks";
  } else if (/\bcomplete|completed|done\b/.test(q)) {
    list = list.filter((task) => norm(task.status) === "completed");
    heading = "your completed tasks";
  } else if (/\bin progress\b/.test(q)) {
    list = list.filter((task) => norm(task.status) === "in_progress");
    heading = "your in-progress tasks";
  } else if (/\bpending\b/.test(q)) {
    list = list.filter((task) => norm(task.status) === "pending");
    heading = "your pending tasks";
  } else {
    list = list.filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
    heading = "your open tasks";
  }
  const askedCount = q.match(/\b(\d{1,2})\b/);
  if (askedCount && /\blast|latest|recent\b/.test(q)) {
    const count = Math.min(20, Number(askedCount[1]) || 0);
    if (count) {
      list = [...list].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, count);
      heading = `last ${count} ${heading.replace(/^your /, "")}`;
    }
  }
  const tbl = table(
    ["Title", "Assigned", "Due", "Status", "Site", "Type"],
    taskRows(ctx, list.slice(0, 25)),
    `No ${heading}.`,
  );
  return {
    text: tbl.rows ? `${list.length} ${heading}.` : tbl.text,
    ...tbl,
    chips: DIP_OFFICE_CHIPS,
  };
}

const GROQ_MODEL = "openai/gpt-oss-120b";

function chipsFor(scope) {
  if (scope === "hr") return DIP_HR_CHIPS;
  if (scope === "site") return DIP_SITE_CHIPS;
  if (scope === "office") return DIP_OFFICE_CHIPS;
  return DIP_CHIPS;
}

function take(list, count) {
  return (list || []).slice(0, count);
}


const LOOKUP_DATASETS = {
  site: ["material", "daily_reports", "weekly_reports", "site_visits", "tasks", "leaves", "tickets", "team", "profile"],
  office: ["tasks", "leaves", "tickets", "attendance", "profile"],
  hr: ["employees", "attendance", "leaves", "expenses", "documents"],
  admin: ["employees", "sites", "tasks", "leaves", "tickets", "attendance", "expenses"],
};

function lookupArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function hasText(value, needle) {
  const wanted = norm(needle);
  if (!wanted) return true;
  return norm(value).includes(wanted);
}

function withinDates(value, from, to) {
  if (!from && !to) return true;
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (from && date < String(from).slice(0, 10)) return false;
  if (to && date > String(to).slice(0, 10)) return false;
  return true;
}

function personOk(fields, person) {
  if (!person) return true;
  return fields.some((field) => hasText(field, person));
}

function taskStatusOk(task, status) {
  const wanted = norm(status);
  if (!wanted) return true;
  const current = norm(task.status);
  if (wanted === "open") return current === "pending" || current === "in_progress";
  if (wanted === "overdue" || wanted === "delayed") {
    const due = String(task.due_date || "").slice(0, 10);
    return !!due && due < ymd() && !["completed", "not_applicable"].includes(current);
  }
  return current.includes(wanted.replace(/\s+/g, "_"));
}

function materialTotals(list) {
  const groups = new Map();
  list.forEach((row) => {
    const label = [row.category_name, row.subcategory_name, row.type_name].filter(Boolean).join(" · ") || "Material";
    const unit = row.unit || "units";
    const key = `${label}|${unit}`;
    groups.set(key, (groups.get(key) || 0) + (Number(row.quantity) || 0));
  });
  return [...groups.entries()].map(([key, quantity]) => {
    const splitAt = key.lastIndexOf("|");
    return { label: key.slice(0, splitAt), unit: key.slice(splitAt + 1), quantity };
  });
}

function finishLookup(mode, list, display) {
  const shown = display.slice(0, 20);
  const forModel = { count: list.length };
  if (mode === "sum") {
    const totals = materialTotals(list).filter((item) => item.quantity);
    if (totals.length) forModel.totals = totals;
  }
  if (mode === "list") {
    forModel.showing = shown.length;
    forModel.rows = shown;
  } else {
    forModel.note = "Use this count or these totals. Do not invent extra rows.";
  }
  return {
    mode,
    forModel,
    columns: shown[0] ? Object.keys(shown[0]) : [],
    rows: mode === "list" ? shown : null,
  };
}

async function runLookup(scope, user, rawArgs) {
  const args = lookupArgs(rawArgs);
  const dataset = norm(args.dataset).replace(/\s+/g, "_");
  const mode = ["count", "sum", "list", "balance"].includes(norm(args.mode)) ? norm(args.mode) : "count";
  const allowed = LOOKUP_DATASETS[scope] || LOOKUP_DATASETS.admin;
  if (!allowed.includes(dataset)) {
    return { mode, forModel: { error: `Not available here. Use one of: ${allowed.join(", ")}.` } };
  }
  if (dataset === "profile" || mode === "balance") {
    const balance = await ownLeaveBalanceAnswer(user, []);
    return {
      mode: "balance",
      forModel: {
        name: user?.name || user?.user_name || "",
        role: user?.role || "",
        department: user?.department || "",
        sites: userSiteNames(user),
        leaveBalance: balance.text,
      },
    };
  }

  const siteScope = scope === "site" ? await loadSiteContext(user) : null;
  if (siteScope?.empty) return { mode, forModel: { error: "No site is assigned to this user." } };
  if (siteScope && args.site && !siteScope.mine.some((site) => hasText(site, args.site))) {
    return { mode, forModel: { error: `Only these sites are visible: ${siteScope.mine.join(", ")}.` } };
  }

  let list = [];
  let display = [];

  if (dataset === "material" && siteScope) {
    list = siteScope.materials.filter((row) =>
      hasText(row.site_name, args.site) &&
      hasText(row.category_name, args.category) &&
      hasText(row.subcategory_name, args.subcategory) &&
      hasText(row.type_name, args.type) &&
      personOk([row.recorded_by], args.person) &&
      withinDates(row.created_at, args.from, args.to));
    display = list.map((row) => ({
      Date: prettyDateTime(row.created_at),
      Site: row.site_name || "—",
      Material: [row.subcategory_name, row.type_name].filter(Boolean).join(" · ") || row.category_name || "—",
      Qty: `${row.quantity ?? ""} ${row.unit || ""}`.trim(),
      By: row.recorded_by || "—",
    }));
  } else if (dataset === "daily_reports" && siteScope) {
    list = siteScope.dprs.filter((row) =>
      hasText(row.site, args.site) &&
      hasText(row.report_type, args.type) &&
      personOk([row.engineer], args.person) &&
      withinDates(row.date, args.from, args.to));
    display = list.map((row) => ({
      Date: prettyDate(row.date),
      Site: row.site || "—",
      Type: titleCase(row.report_type),
      Engineer: row.engineer || "—",
    }));
  } else if (dataset === "weekly_reports" && siteScope) {
    list = siteScope.wprs.filter((row) =>
      hasText(row.site_name, args.site) &&
      personOk([row.engineer_name], args.person) &&
      withinDates(row.report_date || row.created_at, args.from, args.to));
    display = list.map((row) => ({
      Date: row.report_date || prettyDate(row.created_at),
      Site: row.site_name || "—",
      No: row.report_number ?? "—",
      Engineer: row.engineer_name || "—",
    }));
  } else if (dataset === "site_visits" && siteScope) {
    list = siteScope.visits.filter((row) =>
      hasText(row.site_name, args.site) &&
      personOk([row.reporter_name], args.person) &&
      withinDates(row.visit_date, args.from, args.to));
    display = list.map((row) => ({
      Date: prettyDate(row.visit_date),
      Site: row.site_name || "—",
      By: row.reporter_name || "—",
    }));
  } else if (dataset === "team" && siteScope) {
    list = siteScope.users.filter((person) =>
      (!args.site || personOnSites(person, [args.site])) &&
      personOk([person.name, person.username, person.role], args.person));
    display = list.map((person) => ({
      Name: person.name || person.username,
      Role: person.role || "—",
      Department: person.department || "—",
      Site: person.site_name || "—",
    }));
  } else if (dataset === "tasks") {
    const ctx = siteScope || await loadContext();
    const source = siteScope ? ctx.tasks : ctx.allTasks;
    list = source.filter((task) => {
      if (scope === "office" && !matchesMe(task.assigned_to, user)) return false;
      return hasText(task.site_name, args.site) &&
        taskStatusOk(task, args.status) &&
        personOk([task.assigned_to, displayName(ctx.users ? ctx : { users: ctx.users || [] }, task.assigned_to)], args.person) &&
        withinDates(task.created_at, args.from, args.to);
    });
    const users = ctx.users || [];
    display = list.map((task) => ({
      Title: task.title || "Untitled",
      Assigned: displayName({ users }, task.assigned_to),
      Due: prettyDate(task.due_date),
      Status: titleCase(task.status),
      Site: task.site_name || "—",
    }));
  } else if (dataset === "leaves") {
    const ctx = siteScope || (scope === "hr" ? await loadHrContext() : await loadContext());
    list = (ctx.leaves || []).filter((leave) => {
      if (scope === "office" && !(matchesMe(leave.user_name, user) || matchesMe(leave.name, user))) return false;
      const status = computeLeaveStatus(leave);
      const wanted = norm(args.status);
      const statusOk = !wanted || status.includes(wanted) || (wanted === "today" && status === "approved" && coversDate(leave, ymd()));
      return statusOk &&
        hasText(leave.site_name, args.site) &&
        hasText(leave.leave_type, args.type) &&
        personOk([leave.name, leave.user_name], args.person) &&
        (!args.from && !args.to || overlapsRange(leave, args.from || "0000-01-01", args.to || "9999-12-31"));
    });
    display = list.map((leave) => ({
      Name: leave.name || leave.user_name || "—",
      Type: leave.leave_type || "Leave",
      From: prettyDate(leave.from_date),
      To: prettyDate(leave.to_date),
      Status: titleCase(computeLeaveStatus(leave)),
      Site: leave.site_name || "—",
    }));
  } else if (dataset === "tickets") {
    const ctx = siteScope || await loadContext();
    list = (ctx.tickets || []).filter((ticket) => {
      if (scope === "office" && !(
        matchesMe(ticket.raised_by, user) ||
        matchesMe(ticket.raised_by_name, user) ||
        matchesMe(ticket.assigned_to, user) ||
        matchesMe(ticket.assigned_to_name, user)
      )) return false;
      return hasText(ticket.site_name, args.site) &&
        hasText(ticket.status, args.status) &&
        personOk([ticket.raised_by, ticket.raised_by_name, ticket.assigned_to, ticket.assigned_to_name], args.person);
    });
    display = list.map((ticket) => ({
      Task: ticket.task_title || "—",
      Status: titleCase(ticket.status),
      Site: ticket.site_name || "—",
      By: ticket.raised_by_name || ticket.raised_by || "—",
    }));
  } else if (dataset === "employees" || dataset === "sites") {
    const ctx = scope === "hr" ? await loadHrContext() : await loadContext();
    if (dataset === "sites") {
      list = (ctx.sites || []).filter((site) =>
        hasText(site.site_name, args.site) &&
        hasText(site.status, args.status) &&
        personOk([site.user_name, site.client_name], args.person));
      display = list.map((site) => ({
        Site: site.site_name || "—",
        Head: site.user_name || "—",
        Client: site.client_name || "—",
        Status: site.status || "—",
      }));
    } else {
      list = (ctx.users || []).filter((person) =>
        hasText(person.department, args.category) &&
        hasText(person.role, args.type) &&
        hasText(person.site_name, args.site) &&
        hasText(person.status, args.status) &&
        personOk([person.name, person.username], args.person));
      display = list.map((person) => ({
        Name: person.name || person.username,
        Role: person.role || "—",
        Department: person.department || "—",
        Site: person.site_name || "—",
      }));
    }
  } else if (dataset === "attendance") {
    const hr = scope === "office" ? null : await loadHrContext();
    let source = hr?.attendance || [];
    if (scope === "office") {
      const username = user?.user_name || user?.username || "";
      const { data } = await supabase
        .from("attendance")
        .select("user_name, name, date, clock_in, clock_out, clock_in_status")
        .eq("user_name", username)
        .gte("date", args.from || addDays(ymd(), -30))
        .lte("date", args.to || ymd())
        .order("date", { ascending: false })
        .limit(40);
      source = data || [];
    }
    list = source.filter((row) =>
      personOk([row.name, row.user_name], args.person) &&
      withinDates(row.date, args.from, args.to) &&
      (!args.status || norm(attendanceStatus(row)).includes(norm(args.status))));
    display = list.slice(0, 40).map((row) => ({
      Name: row.name || row.user_name || "—",
      Date: prettyDate(row.date),
      Status: attendanceStatus(row),
      In: fmtClock(row.clock_in),
      Out: fmtClock(row.clock_out),
    }));
    list = display.length && source.length ? list : list;
  } else if (dataset === "expenses" || dataset === "documents") {
    const hr = await loadHrContext();
    const source = dataset === "expenses" ? hr.expenses : hr.documents;
    list = (source || []).filter((row) =>
      hasText(row.category || row.doc_type || row.document_type, args.category) &&
      hasText(row.status, args.status) &&
      personOk([row.employee_name, row.user_name, row.name], args.person));
    display = list.map((row) => ({
      Employee: row.employee_name || row.user_name || row.name || "—",
      Type: row.category || row.doc_type || row.document_type || "—",
      Amount: row.amount != null ? String(row.amount) : "—",
      Status: row.status || "—",
    }));
  }

  return finishLookup(mode, list, display);
}

function readGroqAnswer(raw, scope, question) {
  const cleaned = String(raw || "").replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return cleaned ? { text: cleaned, chips: chipsFor(scope) } : null;
  }
  const columns = Array.isArray(parsed.columns) ? parsed.columns.map(String).filter(Boolean).slice(0, 8) : null;
  const sourceRows = Array.isArray(parsed.rows) ? parsed.rows.filter((row) => row && typeof row === "object") : [];
  const rows = columns?.length
    ? take(sourceRows, 30).map((row) => {
      const next = {};
      columns.forEach((column) => {
        next[column] = row[column] == null ? "" : String(row[column]);
      });
      return next;
    })
    : null;
  const text = String(parsed.text || parsed.answer || "").trim();
  if (!text && !rows?.length) return null;
  const summary = asksForSummary(norm(question));
  return {
    text: text || "Here is what the records show.",
    columns: summary || !rows?.length ? null : columns,
    rows: summary || !rows?.length ? null : rows,
    chips: chipsFor(scope),
  };
}

function clipText(value, max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function tally(list, keyFn) {
  const map = new Map();
  (list || []).forEach((item) => {
    const key = keyFn(item) || "Unknown";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

async function recordsForPrompt(scope, user) {
  const today = ymd();
  const weekFrom = startOfWeek(today);
  const weekTo = addDays(weekFrom, 6);
  const monthFrom = `${today.slice(0, 7)}-01`;
  const yesterday = addDays(today, -1);
  if (scope === "site") {
    const ctx = await loadSiteContext(user);
    if (ctx.empty) return { today, sites: [], note: "No site is assigned to this user." };
    const onDate = (value, day) => String(value || "").slice(0, 10) === day;
    const inWeek = (value) => {
      const day = String(value || "").slice(0, 10);
      return day >= weekFrom && day <= weekTo;
    };
    const inMonth = (value) => String(value || "").slice(0, 10) >= monthFrom && String(value || "").slice(0, 10) <= today;
    const open = (ctx.tasks || []).filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
    const overdue = (ctx.tasks || []).filter((task) => {
      const due = String(task.due_date || "").slice(0, 10);
      return due && due < today && !["completed", "not_applicable"].includes(norm(task.status));
    });
    const days = oneReportPerSiteDay(ctx.dprs);
    const siteDays = days.slice(0, 8).map(daySnapshot);
    const earlierDays = days.slice(8, 28).map(compactDay);
    const onLeaveToday = (ctx.leaves || []).filter(
      (leave) => computeLeaveStatus(leave) === "approved" && coversDate(leave, today),
    );
    return {
      today,
      yesterday,
      weekFrom,
      weekTo,
      monthFrom,
      assignedSites: ctx.mine,
      notes: [
        "Answer from every section, not only siteDays. siteDays is the latest daily reports in full. earlierDays is older daily reports in short form. Use the row whose date matches the question.",
        "equipmentUsed and earlierDays.equipment are equipment on site. cement.used is cement consumed. arrivedMaterialTotals is everything that arrived, summed by type. materialOnDailyReport is material written on the daily report.",
        "femaleWorkers, maleWorkers, and manpower.gender are worker counts. progress and planning are the work notes. visitors are site-visit instructions written on the daily report. tasks, tickets, leaves, team, weeklyReports, and siteVisits are separate sections.",
      ],
      siteDays,
      earlierDays,
      dailyReportCount: {
        today: (ctx.dprs || []).filter((row) => onDate(row.date, today)).length,
        thisWeek: (ctx.dprs || []).filter((row) => inWeek(row.date)).length,
        thisMonth: (ctx.dprs || []).filter((row) => inMonth(row.date)).length,
      },
      weeklyReports: (ctx.wprs || []).slice(0, 15).map((row) => ({
        date: row.report_date,
        site: row.site_name,
        number: row.report_number,
        engineer: row.engineer_name,
      })),
      siteVisits: (ctx.visits || []).slice(0, 12).map((row) => ({
        date: row.visit_date,
        site: row.site_name,
        by: row.reporter_name,
        designation: row.designation,
        progress: clipText(row.progress_of_work, 300),
        quality: clipText(row.quality_observations, 200),
        safety: clipText(row.safety_concerns, 200),
        issues: clipText(row.issues_concerns, 200),
        instructions: clipText(row.site_visit_instructions || row.key_instructions, 300),
      })),
      team: (ctx.users || []).slice(0, 40).map((person) => ({
        name: person.name || person.username,
        role: person.role,
        department: person.department,
        site: person.site_name,
      })),
      leaves: {
        onLeaveToday: onLeaveToday.slice(0, 20).map((leave) => ({
          name: leave.name || leave.user_name,
          type: leave.leave_type,
          from: leave.from_date,
          to: leave.to_date,
          site: leave.site_name,
        })),
        recent: (ctx.leaves || []).slice(0, 25).map((leave) => ({
          name: leave.name || leave.user_name,
          type: leave.leave_type,
          from: leave.from_date,
          to: leave.to_date,
          status: computeLeaveStatus(leave),
          site: leave.site_name,
        })),
      },
      tasks: {
        pending: (ctx.tasks || []).filter((task) => norm(task.status) === "pending").length,
        inProgress: (ctx.tasks || []).filter((task) => norm(task.status) === "in_progress").length,
        completed: (ctx.tasks || []).filter((task) => norm(task.status) === "completed").length,
        overdue: overdue.length,
        pendingBySite: tally((ctx.tasks || []).filter((task) => norm(task.status) === "pending"), (task) => task.site_name),
        overdueBySite: tally(overdue, (task) => task.site_name),
        openItems: open.slice(0, 40).map((task) => ({
          title: task.title,
          site: task.site_name,
          status: task.status,
          due: task.due_date,
          assignedTo: task.assigned_to,
          priority: task.priority,
        })),
        recentlyCompleted: (ctx.tasks || []).filter((task) => norm(task.status) === "completed").slice(0, 15).map((task) => ({
          title: task.title,
          site: task.site_name,
          due: task.due_date,
        })),
      },
      openTickets: (ctx.tickets || []).filter((ticket) => norm(ticket.status) === "open").slice(0, 20).map((ticket) => ({
        title: ticket.task_title,
        site: ticket.site_name,
        status: ticket.status,
        query: clipText(ticket.query, 180),
        raisedBy: ticket.raised_by_name || ticket.raised_by,
      })),
      arrivedMaterialTotals: arrivedTotals(ctx.materials),
      arrivedMaterialRecent: (ctx.materials || []).slice(0, 20).map((row) => ({
        date: String(row.created_at || "").slice(0, 10),
        site: row.site_name,
        category: row.category_name,
        subcategory: row.subcategory_name,
        type: row.type_name,
        quantity: row.quantity,
        unit: row.unit,
      })),
    };
  }
  return { today, weekFrom, weekTo, scope, note: "Answer from portal records for this login only." };
}

async function groqChat(messages, tools) {
  const response = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.choices?.[0]?.message || null;
}

async function answerWithGroq(question, user, scope, history) {
  const records = await recordsForPrompt(scope, user);
  const prior = (history || [])
    .slice(-6)
    .filter((turn) => turn?.content)
    .map((turn) => ({ role: turn.role === "assistant" ? "assistant" : "user", content: String(turn.content) }));
  const message = await groqChat([
    {
      role: "system",
      content: "You are DIP Bot for a construction site portal. The user writes English, Hindi, or Gujarati in Roman script. aaje/aje means today, gai kale or kal means yesterday, athvadia means this week, ketla/ketli means how many. Answer any question about this user's sites from the JSON: daily report progress, planning, workers by gender, equipment, cement used or received, materials on the report, materials that arrived (arrivedMaterialTotals), concrete, visitors, cube tests, tasks, tickets, leave, team, weekly reports, and site visits. Match the date in siteDays or earlierDays. Quote the numbers that are present. If only one part is blank, still answer the rest. Do not invent numbers. Do not reply with a menu of topics. One or two sentences, or a short list if they ask to show records. Plain text in the user's language.",
    },
    ...prior,
    {
      role: "user",
      content: JSON.stringify({ question, records }),
    },
  ]);
  const text = String(message?.content || "").trim();
  if (!text) return null;
  const parsed = text.startsWith("{") ? readGroqAnswer(text, scope, question) : null;
  return {
    text: parsed?.text || text,
  };
}

async function resolveDipQuery(rawText, user, options = {}) {
  const scope = norm(options.scope) || "admin";
  const text = String(rawText || "").trim();
  const q = norm(text);
  if (q && asksOwnLeaveBalance(q) && (scope === "site" || scope === "office")) {
    return ownLeaveBalanceAnswer(user, chipsFor(scope));
  }
  if (scope === "site") {
    return answerSiteDipQuery(rawText, user);
  }
  if (text) {
    try {
      const groqAnswer = await answerWithGroq(text, user, scope, options.history);
      if (groqAnswer?.text) return groqAnswer;
    } catch {
      /* fall back to the keyword answers */
    }
  }
  if (scope === "hr") {
    return answerHrDipQuery(rawText, user);
  }
  if (scope === "office") {
    return answerOfficeDipQuery(rawText, user);
  }

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

export async function answerDipQuery(rawText, user, options = {}) {
  const answer = await resolveDipQuery(rawText, user, options);
  if (!answer || !asksForSummary(norm(rawText))) return answer;
  return replyText(answer);
}
