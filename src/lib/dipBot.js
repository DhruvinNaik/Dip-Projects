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
  const key = mine.map(norm).sort().join("|");
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
      .select("id, site, engineer, report_type, date, created_at")
      .order("created_at", { ascending: false })
      .limit(600),
    supabase
      .from("wpr_reports")
      .select("id, site_name, engineer_name, report_date, report_number, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("site_reports")
      .select("id, site_name, reporter_name, visit_date, created_at")
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

  if (
    /^(hi|hello|hey|yo)\b/.test(q) ||
    /\b(help|what can you|capabilities)\b/.test(q)
  ) {
    return siteHelpText(user?.name, ctx.mine);
  }

  if (/\b(thank|thanks|thx)\b/.test(q)) {
    return { text: "Anytime. Ask about reports, material, tasks, or leave on your sites.", chips: DIP_SITE_CHIPS };
  }

  if (/\b(my sites|which sites|assigned sites)\b/.test(q)) {
    return {
      text: `Your sites: ${ctx.mine.join(", ")}.`,
      chips: DIP_SITE_CHIPS,
    };
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

  if (/\b(material|arrived|receipt|cement|sand|steel|tiles|ply)\b/.test(q)) {
    let list = ctx.materials.filter((row) => inFocus(row.site_name));
    const words = q.split(/\s+/).filter((word) => word.length > 2 && !["material", "arrived", "receipt", "show", "latest", "site"].includes(word));
    if (words.length) {
      const narrowed = list.filter((row) => {
        const blob = norm([row.category_name, row.subcategory_name, row.type_name, row.unit].join(" "));
        return words.some((word) => blob.includes(word));
      });
      if (narrowed.length) list = narrowed;
    }
    list = list.slice(0, 25);
    const rows = list.map((row) => ({
      Date: prettyDateTime(row.created_at),
      Site: row.site_name || "—",
      Material: [row.subcategory_name, row.type_name].filter(Boolean).join(" · ") || row.category_name || "—",
      Qty: `${row.quantity ?? ""} ${row.unit || ""}`.trim(),
      By: row.recorded_by || "—",
    }));
    const tbl = table(["Date", "Site", "Material", "Qty", "By"], rows, "No arrived material matched that.");
    return {
      text: tbl.rows ? `${list.length} material receipt${list.length === 1 ? "" : "s"}${focus ? ` at ${focus}` : ""}.` : tbl.text,
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

  if (/\b(task|tasks|overdue|pending|in progress)\b/.test(q)) {
    let list = ctx.tasks.filter((task) => inFocus(task.site_name));
    let heading = "tasks";
    if (/\boverdue|delayed\b/.test(q)) {
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

const GROQ_MODEL = "llama-3.3-70b-versatile";

function chipsFor(scope) {
  if (scope === "hr") return DIP_HR_CHIPS;
  if (scope === "site") return DIP_SITE_CHIPS;
  if (scope === "office") return DIP_OFFICE_CHIPS;
  return DIP_CHIPS;
}

function take(list, count) {
  return (list || []).slice(0, count);
}

function taskBrief(tasks, users) {
  const sorted = [...(tasks || [])].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return take(sorted, 80).map((task) => ({
    title: task.title || "Untitled",
    assignedTo: displayName({ users }, task.assigned_to),
    due: task.due_date || "",
    status: task.status || "",
    site: task.site_name || "",
    type: task.kind || "",
    createdAt: task.created_at || "",
  }));
}

function leaveBrief(leaves) {
  return take(leaves, 60).map((leave) => ({
    name: leave.name || leave.user_name || "",
    type: leave.leave_type || "",
    from: leave.from_date || "",
    to: leave.to_date || "",
    status: computeLeaveStatus(leave),
    site: leave.site_name || "",
  }));
}

async function briefFor(scope, user) {
  const today = ymd();
  if (scope === "hr") {
    const ctx = await loadHrContext();
    const todayRows = ctx.attendance.filter((row) => String(row.date || "").slice(0, 10) === today);
    return {
      today,
      employees: take(ctx.users, 250).map((person) => ({
        name: person.name,
        username: person.username,
        role: person.role,
        department: person.department,
        site: person.site_name,
        status: person.status,
      })),
      attendanceToday: take(todayRows, 200).map((row) => ({
        name: row.name || row.user_name,
        status: attendanceStatus(row),
        in: fmtClock(row.clock_in),
        out: fmtClock(row.clock_out),
      })),
      recentAttendance: take(ctx.attendance, 120).map((row) => ({
        name: row.name || row.user_name,
        date: row.date,
        status: attendanceStatus(row),
        in: fmtClock(row.clock_in),
        out: fmtClock(row.clock_out),
      })),
      leaves: leaveBrief(ctx.leaves),
      expenses: take(ctx.expenses, 40).map((row) => ({
        employee: row.employee_name || row.user_name || row.name,
        category: row.category,
        amount: row.amount,
        status: row.status,
        date: row.expense_date || row.date || row.created_at,
      })),
    };
  }
  if (scope === "site") {
    const ctx = await loadSiteContext(user);
    if (ctx.empty) return { today, sites: [], note: "No site is assigned to this user." };
    const weekFrom = startOfWeek(today);
    const weekTo = addDays(weekFrom, 6);
    const dailyThisWeek = ctx.dprs.filter((row) => {
      const date = String(row.date || "").slice(0, 10);
      return date >= weekFrom && date <= weekTo;
    });
    const balance = await ownLeaveBalanceAnswer(user, []);
    return {
      today,
      weekFrom,
      weekTo,
      sites: ctx.mine,
      note: "athvadia or athvadiana means this week. A question about baki, rahieli, left, or remaining leave is the viewer's own balance in myLeaveBalance, not the people-on-leave list. dailyReportsThisWeek is the count for that question.",
      myLeaveBalance: balance.text,
      dailyReportsThisWeek: dailyThisWeek.length,
      team: take(ctx.users, 80).map((person) => ({
        name: person.name,
        role: person.role,
        department: person.department,
        site: person.site_name,
      })),
      tasks: taskBrief(ctx.tasks, ctx.users),
      leaves: leaveBrief(ctx.leaves),
      tickets: take(ctx.tickets, 40).map((ticket) => ({
        title: ticket.task_title,
        raisedBy: ticket.raised_by_name || ticket.raised_by,
        assignedTo: ticket.assigned_to_name || ticket.assigned_to,
        site: ticket.site_name,
        status: ticket.status,
      })),
      dailyReports: take(ctx.dprs, 40).map((row) => ({
        date: row.date,
        site: row.site,
        type: row.report_type,
        engineer: row.engineer,
      })),
      weeklyReports: take(ctx.wprs, 30).map((row) => ({
        date: row.report_date,
        site: row.site_name,
        number: row.report_number,
        engineer: row.engineer_name,
      })),
      siteVisits: take(ctx.visits, 30).map((row) => ({
        date: row.visit_date,
        site: row.site_name,
        by: row.reporter_name,
      })),
      arrivedMaterial: take(ctx.materials, 60).map((row) => ({
        date: row.created_at,
        site: row.site_name,
        category: row.category_name,
        subcategory: row.subcategory_name,
        type: row.type_name,
        quantity: row.quantity,
        unit: row.unit,
        by: row.recorded_by,
      })),
    };
  }
  if (scope === "office") {
    const ctx = await loadContext();
    const username = user?.user_name || user?.username || "";
    const { data } = await supabase
      .from("attendance")
      .select("user_name, name, date, clock_in, clock_out, clock_in_status")
      .eq("user_name", username)
      .gte("date", addDays(today, -30))
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(31);
    const me = ctx.users.find((person) => matchesMe(person.username, user) || matchesMe(person.name, user)) || user || {};
    const mine = ctx.allTasks.filter((task) => matchesMe(task.assigned_to, user));
    return {
      today,
      note: "pendingTasks and inProgressTasks are newest first. If the user asks for the last N, return only those N rows.",
      profile: {
        name: me.name,
        username: me.username || me.user_name,
        role: me.role,
        department: me.department,
        sites: userSiteNames(me).length ? userSiteNames(me) : userSiteNames(user),
      },
      pendingTasks: taskBrief(mine.filter((task) => norm(task.status) === "pending"), ctx.users),
      inProgressTasks: taskBrief(mine.filter((task) => norm(task.status) === "in_progress"), ctx.users),
      leaves: leaveBrief(ctx.leaves.filter((leave) => matchesMe(leave.user_name, user) || matchesMe(leave.name, user))),
      tickets: take(ctx.tickets.filter((ticket) =>
        matchesMe(ticket.raised_by, user) ||
        matchesMe(ticket.raised_by_name, user) ||
        matchesMe(ticket.assigned_to, user) ||
        matchesMe(ticket.assigned_to_name, user),
      ), 30).map((ticket) => ({
        title: ticket.task_title,
        status: ticket.status,
        site: ticket.site_name,
        when: ticket.created_at,
      })),
      attendance: take(data, 20).map((row) => ({
        date: row.date,
        status: attendanceStatus(row),
        in: fmtClock(row.clock_in),
        out: fmtClock(row.clock_out),
      })),
      myLeaveBalance: (await ownLeaveBalanceAnswer(user, [])).text,
    };
  }
  const ctx = await loadContext();
  const openTasks = ctx.allTasks.filter((task) => ["pending", "in_progress"].includes(norm(task.status)));
  const overdue = filterTasks(ctx.allTasks, { overdueToday: true });
  return {
    today,
    employees: take(ctx.users, 200).map((person) => ({
      name: person.name,
      username: person.username,
      role: person.role,
      department: person.department,
      site: person.site_name,
      status: person.status,
    })),
    sites: take(ctx.sites, 80).map((site) => ({
      name: site.site_name,
      head: site.user_name,
      client: site.client_name,
      status: site.status,
    })),
    openTasks: taskBrief(openTasks, ctx.users),
    overdueTasks: taskBrief(overdue, ctx.users),
    leaves: leaveBrief(ctx.leaves),
    openTickets: take(ctx.tickets.filter((ticket) => norm(ticket.status) === "open"), 40).map((ticket) => ({
      title: ticket.task_title,
      raisedBy: ticket.raised_by_name || ticket.raised_by,
      assignedTo: ticket.assigned_to_name || ticket.assigned_to,
      site: ticket.site_name,
      status: ticket.status,
    })),
  };
}

function readGroqAnswer(raw, scope) {
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
  return {
    text: text || "Here is what the records show.",
    columns: rows?.length ? columns : null,
    rows: rows?.length ? rows : null,
    chips: chipsFor(scope),
  };
}

async function answerWithGroq(question, user, scope) {
  const data = await briefFor(scope, user);
  const response = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are DIP Bot for a construction company portal. The user may write in English, Hindi, or Gujarati, including Roman script. Examples: 'mara last 3 pending tasks kaya che' means 'what are my last 3 pending tasks'; 'athvadiana' means this week; 'baki rahieli leave' or 'leaves left' means the viewer's own remaining balance in myLeaveBalance, not who is on leave. Reply in the same language, in simple words. Use ONLY the JSON records. Do not invent people, dates, counts, or sites. If they ask how many, answer with that count from the records. If they ask for a number of items, such as last 3, return only that many rows. Lists named pendingTasks are already newest first, so the last 3 pending tasks are the first 3 in that list. Do not return the full list when a smaller number was asked. Reply as JSON with keys text (string), columns (array of strings or null), and rows (array of objects using those column names, or null). Keep text to one or two sentences. For a leave balance question, put the balance in text and set columns and rows to null.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            scope,
            viewer: user?.name || user?.user_name || user?.username || "",
            records: data,
          }),
        },
      ],
    }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return readGroqAnswer(body?.choices?.[0]?.message?.content, scope);
}

export async function answerDipQuery(rawText, user, options = {}) {
  const scope = norm(options.scope) || "admin";
  const text = String(rawText || "").trim();
  const q = norm(text);
  if (q && asksOwnLeaveBalance(q) && (scope === "site" || scope === "office")) {
    return ownLeaveBalanceAnswer(user, chipsFor(scope));
  }
  if (
    q &&
    scope === "site" &&
    /\b(dpr|daily report|daily reports)\b/.test(q) &&
    (asksThisWeek(q) || asksToday(q))
  ) {
    return answerSiteDipQuery(rawText, user);
  }
  if (text) {
    try {
      const groqAnswer = await answerWithGroq(text, user, scope);
      if (groqAnswer?.text) return groqAnswer;
    } catch {
      /* fall back to the keyword answers */
    }
  }
  if (scope === "hr") {
    return answerHrDipQuery(rawText, user);
  }
  if (norm(options.scope) === "site") {
    return answerSiteDipQuery(rawText, user);
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
