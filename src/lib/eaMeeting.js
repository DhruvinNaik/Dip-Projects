import { supabase } from "../supabase";

export const EA_TABLE = "ea_meeting_attendance";

function isMissingRelation(err) {
  return /does not exist|schema cache|PGRST205|42P01/i.test(String(err?.message || err || ""));
}

export function currentPortalUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function usernamesFor(user) {
  return [...new Set(
    [user?.user_name, user?.username, user?.employee_username]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
  )];
}

function usernameSetLower(user) {
  return new Set(usernamesFor(user).map((n) => n.toLowerCase()));
}

function normSite(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sitesForUser(user) {
  const out = [];
  if (user?.site_name) out.push(user.site_name);
  if (Array.isArray(user?.site_names)) out.push(...user.site_names);
  return [...new Set(out.map(normSite).filter(Boolean))];
}

export function canViewTeamWeeklyPlans(user) {
  const r = String(user?.role || "")
    .toLowerCase()
    .replace(/-/g, " ");
  return /head|incharge|coordinator|co ordinator|process controller|\bpc\b|admin|mdo/.test(r);
}

function normalizeSourceFile(raw) {
  const s = String(raw || "").trim();
  if (s === "attachment_1" || s === "attachment_2") return s;
  if (/_2(\.|$)/i.test(s) || /attachment[\s_-]*2/i.test(s)) return "attachment_2";
  return "attachment_1";
}

function mapIngestTask(t, ea, sourceFile) {
  const taskDate = String(t?.task_date || "").slice(0, 10);
  const taskName = String(t?.task_name || "").trim();
  if (!taskDate || !taskName) return null;
  const half = Number(t?.half);
  return {
    ea_attendance_id: ea.id,
    employee_id: ea.employee_id != null ? String(ea.employee_id) : null,
    employee_username: String(ea.employee_username || "").trim() || "unknown",
    employee_name: ea.employee_name || null,
    site_name: ea.employee_site_name || null,
    week_start: ea.meeting_week_start,
    week_end: ea.meeting_week_end || null,
    task_date: taskDate,
    task_name: taskName,
    time_slot: t?.time_slot != null ? String(t.time_slot) : null,
    sr_no: Number.isFinite(Number(t?.sr_no)) ? Number(t.sr_no) : null,
    half: Number.isFinite(half) ? half : 0,
    source_file: sourceFile,
    status: String(t?.status || "Pending").trim() || "Pending",
    updated_at: new Date().toISOString(),
  };
}

function mapTaskRow(row) {
  if (!row?.id) return null;
  return {
    ...row,
    table: "weekly_plan_tasks",
    status: String(row.status || "Pending").trim() || "Pending",
  };
}

function mapSheetRowToTask(row) {
  if (!row?.id) return null;
  const taskName = String(row.task || "").trim();
  if (!taskName) return null;
  return {
    id: row.id,
    table: "weekly_plan_sheet",
    ea_attendance_id: row.ea_attendance_id || null,
    employee_id: row.employee_id != null ? String(row.employee_id) : null,
    employee_username: row.employee_username || null,
    employee_name: row.employee_name || null,
    site_name: row.site_name || null,
    week_start: row.week_from || null,
    week_end: row.week_to || null,
    task_date: row.task_date || row.week_from || null,
    task_name: taskName,
    time_slot: null,
    sr_no: null,
    half: 0,
    source_file: row.source_file || null,
    status: String(row.status || "Pending").trim() || "Pending",
    completed_at: row.completed_at || null,
    completed_via: null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function loadEaAttendanceById(id) {
  const { data, error } = await supabase
    .from(EA_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data || null;
}

export async function loadOwnEaRows(user) {
  const names = usernamesFor(user);
  const namesLower = usernameSetLower(user);
  const uid = user?.id != null ? String(user.id) : null;
  const byId = new Map();
  const merge = (rows) => {
    for (const row of rows || []) {
      if (row?.id) byId.set(String(row.id), row);
    }
  };

  if (uid) {
    const { data, error } = await supabase
      .from(EA_TABLE)
      .select("*")
      .eq("employee_id", uid)
      .order("meeting_week_start", { ascending: false })
      .limit(80);
    if (error) {
      if (isMissingRelation(error)) return [];
      throw error;
    }
    merge(data);
  }

  if (names.length) {
    const { data, error } = await supabase
      .from(EA_TABLE)
      .select("*")
      .in("employee_username", names)
      .order("meeting_week_start", { ascending: false })
      .limit(80);
    if (error) {
      if (isMissingRelation(error)) return [...byId.values()];
      throw error;
    }
    merge(data);
  }

  if (!byId.size && namesLower.size) {
    const { data, error } = await supabase
      .from(EA_TABLE)
      .select("*")
      .order("meeting_week_start", { ascending: false })
      .limit(400);
    if (error) {
      if (isMissingRelation(error)) return [...byId.values()];
      throw error;
    }
    merge(
      (data || []).filter((row) =>
        namesLower.has(String(row.employee_username || "").trim().toLowerCase())
      )
    );
  }

  return [...byId.values()].sort((a, b) =>
    String(b.meeting_week_start || "").localeCompare(String(a.meeting_week_start || ""))
  );
}

export async function listWeeklyPlanSubmissions(user, { allAssignedSites = false } = {}) {
  const own = await loadOwnEaRows(user);
  const byId = new Map(own.map((r) => [String(r.id), r]));

  if (allAssignedSites || canViewTeamWeeklyPlans(user)) {
    const sites = sitesForUser(user);
    const { data, error } = await supabase
      .from(EA_TABLE)
      .select("*")
      .not("plan_submitted_at", "is", null)
      .order("meeting_week_start", { ascending: false })
      .limit(500);
    if (error) {
      if (!isMissingRelation(error)) throw error;
    } else {
      const siteSet = new Set(sites);
      for (const row of data || []) {
        const site = normSite(row.employee_site_name);
        if (siteSet.size && site && !siteSet.has(site)) continue;
        if (row?.id) byId.set(String(row.id), row);
      }
    }
  }

  return [...byId.values()]
    .filter((row) => row.plan_submitted_at && (row.attachment_1_url || row.attachment_2_url))
    .sort((a, b) => new Date(b.plan_submitted_at || 0) - new Date(a.plan_submitted_at || 0));
}

export async function listTasksForEa(eaId, sourceFile) {
  let q = supabase
    .from("weekly_plan_tasks")
    .select("*")
    .eq("ea_attendance_id", eaId)
    .order("task_date", { ascending: true })
    .order("sr_no", { ascending: true });
  if (sourceFile) q = q.eq("source_file", normalizeSourceFile(sourceFile));
  const { data, error } = await q;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data || []).map(mapTaskRow).filter(Boolean);
}

export async function ingestWeeklyPlanTasks(eaId, clientParsed) {
  const ea = await loadEaAttendanceById(eaId);
  if (!ea) {
    return { ok: false, inserted: 0, error: "EM attendance not found" };
  }

  const batches = Array.isArray(clientParsed) ? clientParsed : [];
  const rows = [];
  for (const batch of batches) {
    const sourceFile = normalizeSourceFile(batch?.source_file);
    const tasks = Array.isArray(batch?.tasks) ? batch.tasks : [];
    for (const t of tasks.slice(0, 400)) {
      const row = mapIngestTask(t, ea, sourceFile);
      if (row) rows.push(row);
    }
  }

  if (!rows.length) return { ok: true, inserted: 0, note: "No tasks to save" };

  const sourceFiles = [...new Set(rows.map((r) => r.source_file))];
  let existingQ = supabase
    .from("weekly_plan_tasks")
    .select("id, task_date, source_file, sr_no, task_name, half, time_slot, status")
    .eq("ea_attendance_id", eaId);
  if (sourceFiles.length === 1) existingQ = existingQ.eq("source_file", sourceFiles[0]);
  const { data: existing, error: existingErr } = await existingQ;
  if (existingErr) {
    if (isMissingRelation(existingErr) || /column .*half.* does not exist/i.test(existingErr.message || "")) {
      return {
        ok: false,
        inserted: 0,
        note: "Run supabase/weekly_plan_tasks.sql in the Supabase SQL editor, then retry.",
        error: existingErr.message,
      };
    }
    throw existingErr;
  }

  const dedupeKey = (r) =>
    [
      String(r.task_date || "").slice(0, 10),
      String(r.source_file || ""),
      r.sr_no == null ? "" : String(r.sr_no),
      String(r.task_name || "").trim().toLowerCase(),
      String(r.half ?? 0),
      String(r.time_slot || "").trim().toLowerCase(),
    ].join("|");

  const have = new Set((existing || []).map(dedupeKey));
  const toInsert = rows.filter((r) => !have.has(dedupeKey(r)));
  if (!toInsert.length) return { ok: true, inserted: 0, note: "All tasks already saved" };

  let inserted = 0;
  const chunkSize = 80;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("weekly_plan_tasks").insert(chunk).select("id");
    if (error) {
      for (const row of chunk) {
        const { error: oneErr } = await supabase.from("weekly_plan_tasks").insert(row);
        if (!oneErr) inserted += 1;
        else if (!/duplicate|unique|23505/i.test(oneErr.message || "")) {
          return { ok: false, inserted, error: oneErr.message || "Ingest failed" };
        }
      }
      continue;
    }
    inserted += Array.isArray(data) ? data.length : chunk.length;
  }

  return { ok: true, inserted };
}

export async function setWeeklyPlanTaskStatus(taskId, nextStatus) {
  if (nextStatus !== "Pending" && nextStatus !== "Completed") {
    throw new Error("status must be Pending or Completed");
  }
  const now = new Date().toISOString();
  const patchTasks =
    nextStatus === "Completed"
      ? { status: "Completed", completed_at: now, completed_via: "portal", updated_at: now }
      : { status: "Pending", completed_at: null, completed_via: null, updated_at: now };
  const patchSheet =
    nextStatus === "Completed"
      ? { status: "Completed", completed_at: now, updated_at: now }
      : { status: "Pending", completed_at: null, updated_at: now };

  const { data: existing, error: loadErr } = await supabase
    .from("weekly_plan_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (loadErr && !isMissingRelation(loadErr)) throw loadErr;

  if (existing) {
    const { data, error } = await supabase
      .from("weekly_plan_tasks")
      .update(patchTasks)
      .eq("id", taskId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return { ok: true, task: mapTaskRow(data) };
  }

  const { data: sheetUpdated, error: sheetErr } = await supabase
    .from("weekly_plan_sheet")
    .update(patchSheet)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();
  if (sheetErr) {
    if (isMissingRelation(sheetErr)) throw new Error("Run supabase/weekly_plan_tasks.sql in Supabase.");
    throw sheetErr;
  }
  if (!sheetUpdated) throw new Error("Task not found");
  return { ok: true, task: mapSheetRowToTask(sheetUpdated) };
}

async function fetchWeeklyPlanTasksForUser({ eaIds, uid, namesLower }) {
  const byId = new Map();
  const merge = (rows) => {
    for (const raw of rows || []) {
      const row = mapTaskRow(raw);
      if (row?.id) byId.set(String(row.id), row);
    }
  };

  for (let i = 0; i < eaIds.length; i += 80) {
    const chunk = eaIds.slice(i, i + 80);
    const { data, error } = await supabase
      .from("weekly_plan_tasks")
      .select("*")
      .in("ea_attendance_id", chunk)
      .order("week_start", { ascending: false })
      .limit(2000);
    if (error) {
      if (isMissingRelation(error)) return { tasks: [], missing: true };
      throw error;
    }
    merge(data);
  }

  if (uid) {
    const { data, error } = await supabase.from("weekly_plan_tasks").select("*").eq("employee_id", uid).limit(2000);
    if (error) {
      if (isMissingRelation(error)) return { tasks: [], missing: true };
      throw error;
    }
    merge(data);
  }

  if (namesLower.size) {
    const { data, error } = await supabase
      .from("weekly_plan_tasks")
      .select("*")
      .order("week_start", { ascending: false })
      .limit(2000);
    if (error) {
      if (isMissingRelation(error)) return { tasks: [...byId.values()], missing: false };
      throw error;
    }
    merge(
      (data || []).filter((row) =>
        namesLower.has(String(row.employee_username || "").trim().toLowerCase())
      )
    );
  }

  return { tasks: [...byId.values()], missing: false };
}

async function fetchWeeklyPlanSheetForUser({ eaIds, uid, namesLower }) {
  const byId = new Map();
  const merge = (rows) => {
    for (const raw of rows || []) {
      const row = mapSheetRowToTask(raw);
      if (row?.id) byId.set(String(row.id), row);
    }
  };

  for (let i = 0; i < eaIds.length; i += 80) {
    const chunk = eaIds.slice(i, i + 80);
    const { data, error } = await supabase
      .from("weekly_plan_sheet")
      .select("*")
      .in("ea_attendance_id", chunk)
      .limit(2000);
    if (error) {
      if (isMissingRelation(error)) return { tasks: [], missing: true };
      throw error;
    }
    merge(data);
  }

  if (uid) {
    const { data, error } = await supabase.from("weekly_plan_sheet").select("*").eq("employee_id", uid).limit(2000);
    if (error) {
      if (isMissingRelation(error)) return { tasks: [], missing: true };
      throw error;
    }
    merge(data);
  }

  if (namesLower.size) {
    const { data, error } = await supabase.from("weekly_plan_sheet").select("*").limit(2000);
    if (!error) {
      merge(
        (data || []).filter((row) => {
          const u = String(row.employee_username || "").trim().toLowerCase();
          const idOk = uid && String(row.employee_id || "") === uid;
          return idOk || namesLower.has(u);
        })
      );
    } else if (isMissingRelation(error)) {
      return { tasks: [...byId.values()], missing: true };
    }
  }

  return { tasks: [...byId.values()], missing: false };
}

export async function loadMyPlanTasks(user = currentPortalUser()) {
  if (!user) {
    return { tasks: [], weeks: [], uploads: [], ea_uploads: 0, note: "Please log in." };
  }

  const ownRows = await loadOwnEaRows(user);
  const namesLower = usernameSetLower(user);
  const uid = user?.id != null ? String(user.id) : null;
  const eaIds = [...new Set(ownRows.map((r) => r.id).filter(Boolean))];

  const primary = await fetchWeeklyPlanTasksForUser({ eaIds, uid, namesLower });
  let tasks = primary.tasks || [];
  let sheetCount = 0;
  const sheet = await fetchWeeklyPlanSheetForUser({ eaIds, uid, namesLower });
  if (!sheet.missing && sheet.tasks?.length) {
    const taskKeys = new Set(
      tasks.map(
        (t) =>
          `${String(t.ea_attendance_id || "")}|${String(t.task_date || "").slice(0, 10)}|${String(t.task_name || "")
            .trim()
            .toLowerCase()}`
      )
    );
    for (const row of sheet.tasks) {
      const key = `${String(row.ea_attendance_id || "")}|${String(row.task_date || "").slice(0, 10)}|${String(
        row.task_name || ""
      )
        .trim()
        .toLowerCase()}`;
      if (taskKeys.has(key)) continue;
      tasks.push(row);
      sheetCount += 1;
      taskKeys.add(key);
    }
  }

  tasks.sort((a, b) => {
    const w = String(b.week_start || "").localeCompare(String(a.week_start || ""));
    if (w) return w;
    const d = String(a.task_date || "").localeCompare(String(b.task_date || ""));
    if (d) return d;
    return (Number(a.sr_no) || 0) - (Number(b.sr_no) || 0);
  });

  const weekMap = new Map();
  for (const t of tasks) {
    const start = String(t.week_start || "").slice(0, 10);
    if (!start) continue;
    if (!weekMap.has(start)) {
      weekMap.set(start, {
        week_start: start,
        week_end: t.week_end ? String(t.week_end).slice(0, 10) : null,
        count: 0,
      });
    }
    weekMap.get(start).count += 1;
  }

  const uploads = ownRows
    .filter((r) => r.plan_submitted_at && (r.attachment_1_url || r.attachment_2_url))
    .map((r) => ({
      ea_id: r.id,
      meeting_week_start: r.meeting_week_start,
      meeting_week_end: r.meeting_week_end,
      employee_username: r.employee_username,
      plan_submitted_at: r.plan_submitted_at,
      attachment_1_url: r.attachment_1_url,
      attachment_1_name: r.attachment_1_name,
      attachment_2_url: r.attachment_2_url,
      attachment_2_name: r.attachment_2_name,
    }));

  let note;
  if (primary.missing && !tasks.length) {
    note = "Run supabase/weekly_plan_tasks.sql in the Supabase SQL editor.";
  } else if (!tasks.length && uploads.length) {
    note = "Weekly plans were uploaded, but tasks are not saved yet. Use Sync from plans.";
  } else if (!tasks.length && !ownRows.length) {
    note = "No EM attendance / weekly plan upload found for your username yet.";
  } else if (sheetCount && !(primary.tasks || []).length) {
    note = "Loaded from weekly_plan_sheet.";
  }

  return {
    tasks,
    weeks: [...weekMap.values()],
    uploads,
    ea_uploads: ownRows.length,
    note,
  };
}
