import { parseDateFromText } from "./weeklyPlanExcel.js";

export function getCellDisplayText(task) {
  const raw = String(task?.time_slot || task?.task_name || "").trim();
  return raw || "—";
}

export function getCellStatusText(task) {
  const status = String(task?.status || "Pending").trim();
  if (!status) return "Pending";
  return status;
}

export function normalizePreviewText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Normalize time strings so "9-00 AM" and "9:00AM" match. */
export function normalizeTimeText(value) {
  return normalizePreviewText(value)
    .replace(/\s*(am|pm)\s*/g, "$1")
    .replace(/(\d)\s*[-.]\s*(\d)/g, "$1:$2")
    .replace(/\s*(to|-|–|—)\s*/g, " to ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatWeekDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "—");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }
  );
}

function cellDisplay(matrix, r, c) {
  const cell = matrix?.[r]?.[c];
  if (cell == null) return "";
  if (typeof cell === "object") return String(cell.display ?? "").trim();
  return String(cell).trim();
}

/**
 * Resolve YYYY-MM-DD for a sheet column from the DATE header row.
 * For half layouts, dates may sit on the left of a merged day block — walk left.
 */
export function findDateForSheetColumn(matrix, colIdx) {
  if (!Array.isArray(matrix) || !Number.isFinite(colIdx) || colIdx < 0) return null;
  for (let c = colIdx; c >= 2; c -= 1) {
    for (let r = 0; r < Math.min(matrix.length, 25); r += 1) {
      const ymd = parseDateFromText(cellDisplay(matrix, r, c));
      if (ymd) return ymd;
    }
  }
  return null;
}

/** 1 / 2 for half layouts, else 0. Only inspect this column (never borrow neighbor half). */
export function findHalfForSheetColumn(matrix, colIdx) {
  if (!Array.isArray(matrix) || !Number.isFinite(colIdx) || !hasHalfPlanningLayout(matrix)) {
    return 0;
  }
  for (let r = 0; r < Math.min(matrix.length, 30); r += 1) {
    const u = cellDisplay(matrix, r, colIdx).toUpperCase();
    if (/1ST\s*HALF|FIRST\s*HALF/.test(u)) return 1;
    if (/2ND\s*HALF|SECOND\s*HALF/.test(u)) return 2;
  }
  return 0;
}

export function isHeaderLikeCell(value) {
  const t = String(value || "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  const u = t.toUpperCase();

  // Exact header labels only. Do NOT use a broad "PLANNING"+"WORK" rule —
  // real tasks like "SITE WORK … ENGINEER PLANNING" must stay as data rows.
  if (/^(SR\s*NO|SITE\s*NAME|DATE|DAYS|TIME|WORK\s*STATUS|PLAN)$/.test(u)) return true;
  if (/^(WEEKLY\s*PLAN(?:NING)?|DIP\s*PROJECTS?|PROJECT\s*CO\.?)$/.test(u)) return true;
  if (/^(1ST|2ND|FIRST|SECOND)\s*HALF(\s*PLANNING)?$/.test(u)) return true;
  if (/^DAYS\s*PLANNING$/.test(u) || /^WORK\s*UPDATE$/.test(u) || /^WORK\s*UPDATES?$/.test(u)) return true;
  if (/^(WORK|UPDATE|UPDATES?)$/.test(u)) return true;
  if (/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/.test(u)) return true;
  if (/^\d{1,2}[.\-\/]\s*[A-Za-z]{3}/.test(t)) return true;
  if (/^\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}$/.test(t)) return true;
  return false;
}

export function isNoWorkCell(value) {
  const text = String(value || "")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!text || /^[-_.\/]+$/.test(text)) return true;
  return /^(?:N\/?A|NA|NONE|NIL|NO\s+WORK|NO\s+TASK|NOT\s+APPLICABLE|OFF|WEEKLY\s+OFF|HOLIDAY|LEAVE|ON\s+LEAVE|NO\s+WORK\s+TODAY|NOT\s+REQUIRED)$/.test(
    text
  );
}

export function isWorkUpdateColumn(matrix, colIdx) {
  const limit = Math.min(Array.isArray(matrix) ? matrix.length : 0, 15);
  for (let rowIdx = 0; rowIdx < limit; rowIdx += 1) {
    const header = cellDisplay(matrix, rowIdx, colIdx).replace(/\s+/g, " ").trim().toUpperCase();
    if (/^(WORK\s+UPDATE|WORK\s+UPDATES?|UPDATE|UPDATES)$/.test(header)) return true;
  }
  return false;
}

/** True when the cell looks like a clock range (header timing or type-1 plan). */
export function isDaywiseTimeValue(value) {
  const t = String(value || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (isHeaderLikeCell(t)) return false;
  return /\d{1,2}\s*[-.:]?\s*\d{0,2}\s*(AM|PM)\s*(TO|-|–|—)\s*\d{1,2}/i.test(t);
}

/** Detect 1st/2nd half planning layout from header labels. */
export function hasHalfPlanningLayout(matrix) {
  const limit = Math.min(Array.isArray(matrix) ? matrix.length : 0, 20);
  let first = 0;
  let second = 0;
  for (let r = 0; r < limit; r += 1) {
    const row = matrix[r] || [];
    for (let c = 0; c < row.length; c += 1) {
      const t = cellDisplay(matrix, r, c).toUpperCase();
      if (/1ST\s*HALF|FIRST\s*HALF/.test(t)) first += 1;
      if (/2ND\s*HALF|SECOND\s*HALF/.test(t)) second += 1;
    }
  }
  return first >= 1 && second >= 1;
}

function rowLabel(matrix, r) {
  return cellDisplay(matrix, r, 1).toUpperCase() || cellDisplay(matrix, r, 0).toUpperCase();
}

/** DATE / DAYS / TIME / half-planning header rows (never actionable). */
export function isPreviewHeaderBandRow(matrix, rowIdx) {
  const label = rowLabel(matrix, rowIdx);
  if (/^(DATE|DAYS|TIME|SITE\s*NAME|SR\s*NO)$/.test(label)) return true;

  // Real task rows always have a site/task title in col 1 — never treat as header.
  const siteOrTask = cellDisplay(matrix, rowIdx, 1);
  if (siteOrTask && !isHeaderLikeCell(siteOrTask) && !/^(DATE|DAYS|TIME|SITE\s*NAME)$/i.test(siteOrTask)) {
    return false;
  }

  const row = matrix?.[rowIdx] || [];
  let halfHits = 0;
  let weekdayHits = 0;
  let dateHits = 0;
  let timeHits = 0;
  let other = 0;
  for (let c = 2; c < row.length; c += 1) {
    const t = cellDisplay(matrix, rowIdx, c);
    if (!t) continue;
    const u = t.toUpperCase();
    if (/1ST\s*HALF|2ND\s*HALF|FIRST\s*HALF|SECOND\s*HALF/.test(u)) halfHits += 1;
    else if (/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/.test(u)) weekdayHits += 1;
    else if (isHeaderLikeCell(t) && /^\d{1,2}/.test(t)) dateHits += 1;
    else if (isDaywiseTimeValue(t)) timeHits += 1;
    else other += 1;
  }

  if (halfHits >= 1 && other === 0) return true;
  if (weekdayHits >= 1 && other === 0) return true;
  if (dateHits >= 1 && other === 0) return true;
  // TIME header row only when the row label is TIME (not a data row of time slots).
  if (timeHits >= 1 && other === 0 && /^TIME$/.test(label)) return true;
  return false;
}

/**
 * First body row = numeric SR + task/site name.
 * Ignores title rows and DATE/DAYS/TIME/HALF header bands.
 */
export function findPreviewDataStartRow(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return 0;

  let halfHeaderRow = -1;
  if (hasHalfPlanningLayout(matrix)) {
    for (let r = 0; r < Math.min(matrix.length, 30); r += 1) {
      const row = matrix[r] || [];
      let hits = 0;
      for (let c = 0; c < row.length; c += 1) {
        const t = cellDisplay(matrix, r, c).toUpperCase();
        if (/1ST\s*HALF|2ND\s*HALF|FIRST\s*HALF|SECOND\s*HALF/.test(t)) hits += 1;
      }
      if (hits >= 1) halfHeaderRow = r;
    }
  }

  for (let r = 0; r < Math.min(matrix.length, 50); r += 1) {
    if (halfHeaderRow >= 0 && r <= halfHeaderRow) continue;
    if (isPreviewHeaderBandRow(matrix, r)) continue;

    const a = cellDisplay(matrix, r, 0);
    const b = cellDisplay(matrix, r, 1);
    if (!/^\d+$/.test(a)) continue;
    if (!b || isHeaderLikeCell(b)) continue;
    return r;
  }

  // Fallback: first non-header band row after half headers.
  for (let r = Math.max(0, halfHeaderRow + 1); r < Math.min(matrix.length, 50); r += 1) {
    if (isPreviewHeaderBandRow(matrix, r)) continue;
    const b = cellDisplay(matrix, r, 1);
    if (b && !isHeaderLikeCell(b)) return r;
  }

  return Math.min(matrix.length, 8);
}

/**
 * Type 1: Pending control on daywise time data cells.
 * Type 2: Pending control on 1st/2nd half planning task data cells.
 * Never on headers (including TIME timing row).
 */
export function isActionablePlanCell(matrix, rowIdx, colIdx, cellText) {
  const text = String(cellText || "").trim();
  if (!text || colIdx < 2) return false;
  if (isNoWorkCell(text)) return false;
  if (isHeaderLikeCell(text)) return false;
  if (isWorkUpdateColumn(matrix, colIdx)) return false;
  if (isPreviewHeaderBandRow(matrix, rowIdx)) return false;
  const dataStart = findPreviewDataStartRow(matrix);
  if (rowIdx < dataStart) return false;

  // Never put Pending on column-title / meta rows.
  const siteOrTask = cellDisplay(matrix, rowIdx, 1);
  if (!siteOrTask || isHeaderLikeCell(siteOrTask) || /^SITE\s*\d+$/i.test(siteOrTask)) return false;
  if (/SR\s*NO|SITE\s*NAME/i.test(siteOrTask)) return false;

  if (hasHalfPlanningLayout(matrix)) {
    // Type 2 — task text only; never the timing header values.
    if (isDaywiseTimeValue(text)) return false;
    return true;
  }

  // Type 1 — daywise scheduled time (or any non-empty plan cell in body).
  if (isDaywiseTimeValue(text)) return true;
  // Reject short header leftovers that slipped into body cells.
  if (/^(WORK|UPDATE|PLAN|DAYS|TIME|DATE)(\s+PLANNING|\s+UPDATE)?$/i.test(text)) return false;
  return Boolean(text);
}

function taskYmd(value) {
  const s = String(value || "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function slotTextMatches(task, text) {
  const slot = normalizePreviewText(task?.time_slot);
  const slotTime = normalizeTimeText(task?.time_slot);
  const textNorm = normalizePreviewText(text);
  const textTime = normalizeTimeText(text);
  if (!textNorm || !slot) return false;
  // Exact only — fuzzy includes caused Mon/Tue (and other rows) to share one task.
  if (slot === textNorm) return true;
  if (slotTime && textTime && slotTime === textTime) return true;
  return false;
}

/** Looser match for PDF-converted cells (wrapped text / minor punctuation drift). */
function slotTextNearMatch(task, text) {
  if (slotTextMatches(task, text)) return true;
  const slot = normalizePreviewText(task?.time_slot);
  const textNorm = normalizePreviewText(text);
  if (!slot || !textNorm || textNorm.length < 6 || slot.length < 6) return false;
  if (slot.includes(textNorm) || textNorm.includes(slot)) return true;
  // Compare alnum-only cores so "EXCAVATION & FOUNDATION" ≈ "EXCAVATION FOUNDATION"
  const core = (v) => v.replace(/[^a-z0-9]+/g, "");
  const a = core(slot);
  const b = core(textNorm);
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

function sameTaskRow(task, rowName, srNo) {
  if (srNo != null && Number(task.sr_no) === srNo) return true;
  if (rowName && normalizePreviewText(task.task_name) === rowName) return true;
  return false;
}

/**
 * Match a visible Excel data cell to exactly one weekly_plan_tasks row.
 * Requires same calendar day + same sheet row when those can be resolved,
 * so Pending/Completed never bleed across days or sibling time cells.
 */
export function findTaskForSheetCell(tasks, { cellText, rowTaskName, taskDate, colIdx, matrix, rowIdx, half } = {}) {
  const text = normalizePreviewText(cellText);
  if (!text || text === "—") return null;
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return null;

  const rowName = normalizePreviewText(rowTaskName);
  const srRaw = Array.isArray(matrix) && Number.isFinite(rowIdx) ? cellDisplay(matrix, rowIdx, 0) : "";
  const srNo = /^\d+$/.test(srRaw) ? Number(srRaw) : null;
  const resolvedDate =
    taskDate ||
    (Array.isArray(matrix) && Number.isFinite(colIdx) ? findDateForSheetColumn(matrix, colIdx) : null);
  const resolvedHalf =
    half != null
      ? Number(half) || 0
      : Array.isArray(matrix) && Number.isFinite(colIdx)
        ? findHalfForSheetColumn(matrix, colIdx)
        : 0;

  let candidates = list.filter((task) => slotTextMatches(task, cellText));
  if (!candidates.length) {
    candidates = list.filter((task) => slotTextNearMatch(task, cellText));
  }
  if (!candidates.length) {
    // Fallback: map this day column to the Nth task on the same row/date.
    candidates = list.filter((task) => sameTaskRow(task, rowName, srNo));
  } else if (rowName || srNo != null) {
    const byRow = candidates.filter((task) => sameTaskRow(task, rowName, srNo));
    if (byRow.length) candidates = byRow;
  }

  if (resolvedDate) {
    const want = taskYmd(resolvedDate) || String(resolvedDate);
    const byDate = candidates.filter((task) => taskYmd(task.task_date) === want);
    if (byDate.length) candidates = byDate;
    else return null;
  }

  if (resolvedHalf > 0) {
    const byHalf = candidates.filter((task) => Number(task.half) === resolvedHalf);
    if (byHalf.length) candidates = byHalf;
  }

  if (candidates.length === 1) return candidates[0];

  if (candidates.length > 1 && Array.isArray(matrix) && Number.isFinite(colIdx) && Number.isFinite(rowIdx)) {
    const dayCols = [];
    const colCount = (matrix[rowIdx] || []).length;
    for (let c = 2; c < colCount; c += 1) {
      const val = cellDisplay(matrix, rowIdx, c);
      if (!val || !isActionablePlanCell(matrix, rowIdx, c, val)) continue;
      if (resolvedDate) {
        const colDate = findDateForSheetColumn(matrix, c);
        if (colDate && colDate !== resolvedDate) continue;
      }
      dayCols.push(c);
    }
    const sorted = [...candidates].sort((a, b) => {
      const d = String(taskYmd(a.task_date) || a.task_date || "").localeCompare(
        String(taskYmd(b.task_date) || b.task_date || "")
      );
      if (d) return d;
      const h = (Number(a.half) || 0) - (Number(b.half) || 0);
      if (h) return h;
      return String(a.time_slot || "").localeCompare(String(b.time_slot || ""));
    });
    const slot = dayCols.indexOf(colIdx);
    if (slot >= 0 && sorted[slot]) return sorted[slot];
  }

  // Last resort: exact slot+row+date only — never pick an arbitrary open task.
  if (candidates.length > 1) {
    const exact = candidates.filter((task) => {
      const slot = normalizePreviewText(task.time_slot);
      return slot === text && sameTaskRow(task, rowName, srNo);
    });
    if (exact.length === 1) return exact[0];
    return null;
  }

  if (!Array.isArray(matrix) || !Number.isFinite(colIdx) || !Number.isFinite(rowIdx)) {
    return candidates[0] || null;
  }

  let rowTasks = list.filter((task) => {
    if (resolvedDate) {
      const want = taskYmd(resolvedDate) || String(resolvedDate);
      if (taskYmd(task.task_date) !== want) return false;
    }
    return sameTaskRow(task, rowName, srNo);
  });
  rowTasks = [...rowTasks].sort((a, b) => {
    const d = String(taskYmd(a.task_date) || a.task_date || "").localeCompare(
      String(taskYmd(b.task_date) || b.task_date || "")
    );
    if (d) return d;
    return (Number(a.half) || 0) - (Number(b.half) || 0);
  });
  if (!rowTasks.length) return null;

  const dayCols = [];
  const colCount = (matrix[rowIdx] || []).length;
  for (let c = 2; c < colCount; c += 1) {
    const val = cellDisplay(matrix, rowIdx, c);
    if (val && isActionablePlanCell(matrix, rowIdx, c, val)) {
      if (resolvedDate) {
        const colDate = findDateForSheetColumn(matrix, c);
        if (colDate && colDate !== resolvedDate) continue;
      }
      dayCols.push(c);
    }
  }
  const slot = dayCols.indexOf(colIdx);
  if (slot < 0 || !rowTasks[slot]) return null;
  return rowTasks[slot];
}

/** Prefer open tasks for one Excel task/site row. */
export function findPendingTasksForRow(tasks, rowTaskName) {
  const rowName = normalizePreviewText(rowTaskName);
  if (!rowName) return [];
  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (normalizePreviewText(task.task_name) !== rowName) return false;
    const s = String(task.status || "");
    return s !== "Completed" && s !== "Cancelled";
  });
}
