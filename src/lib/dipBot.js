import { supabase } from "../supabase";

const CACHE_TTL_MS = 25000;
let cache = { at: 0, data: null };

export const DIP_CHIPS = [
  "Who is on leave today?",
  "Pending tasks",
  "All delegated tasks",
  "Overdue tasks",
  "Open tickets",
  "Dashboard summary",
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
    return (
      (name.length > 2 && q.includes(name)) ||
      (uname.length > 2 && q.includes(uname)) ||
      name.split(/\s+/).some((part) => part.length > 3 && q.includes(part))
    );
  });
  hits.sort(
    (a, b) =>
      String(b.name || "").length - String(a.name || "").length,
  );
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

export async function answerDipQuery(rawText, user) {
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

  if (/\b(employee|staff|people|directory|who works)\b/.test(q) && !/\bleave\b/.test(q) && !/\btask/.test(q)) {
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
    let text = tbl.rows
      ? `${list.length} ${label}.`
      : tbl.text;
    if (/\btoday\b/.test(q) && pendingToday.length && !/\bpending\b/.test(q)) {
      text += ` ${pendingToday.length} more request${pendingToday.length === 1 ? " is" : "s are"} pending for today.`;
    }
    return { text, ...tbl, chips: ["Pending leave requests", "Who is on leave this week?"] };
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
