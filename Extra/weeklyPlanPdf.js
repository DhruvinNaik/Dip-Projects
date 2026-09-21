/**
 * PDF weekly plans → clean Excel-style preview.
 * Do NOT mirror messy PDF coordinates. Rebuild a proper week grid from text.
 */
import * as XLSX from "xlsx";
import { parseWeeklyPlanMatrix, parseDateFromText } from "./weeklyPlanExcel.js";

const MAX_TEXT_ITEMS = 6000;
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (pdfjs.GlobalWorkerOptions) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

function clusterBy(values, tolerance) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const groups = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i += 1) {
    const v = sorted[i];
    const g = groups[groups.length - 1];
    if (Math.abs(v - g[g.length - 1]) <= tolerance) g.push(v);
    else groups.push([v]);
  }
  return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

function nearestIndex(centers, value) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centers.length; i += 1) {
    const d = Math.abs(centers[i] - value);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function normSpace(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellStr(row, c) {
  return normSpace(row?.[c]);
}

function ymdToLabel(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(ymd || "");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[3]}-${months[Number(m[2]) - 1]}-${m[1]}`;
}

function ymdWeekday(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return WEEKDAYS[d.getUTCDay()] || "";
}

function addDaysYmd(ymd, days) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function isNoiseText(text) {
  const u = normSpace(text).toUpperCase();
  if (!u) return true;
  if (/^DIP\s*PROJECTS?$/.test(u)) return true;
  if (/^WEEKLY\s*PLAN/.test(u)) return true;
  if (/^POST\s*[-:]?\s*SITE\s*ENGINEER/.test(u)) return true;
  if (/^SITE\s*ENGINEER$/.test(u)) return true;
  if (/^WORK\s*UPDATE$/.test(u) || /^WORK\s*STATUS$/.test(u)) return true;
  if (/^DAYS\s*PLANNING(\s+UPDATE)?$/.test(u)) return true;
  if (/^(SR\s*NO|SITE\s*NAME|DATE|DAYS|TIME|PLAN|WORK|UPDATE)$/.test(u)) return true;
  if (/^SR\s*NO\s*SITE\s*NAME$/.test(u.replace(/\s+/g, " "))) return true;
  return false;
}

function isStatusOnly(text) {
  return /^(COMPLETED|COMPLETE|DONE|PENDING|IN\s*PROGRESS|ON\s*HOLD|CANCELLED?|MATERIAL\s*AWAITED)([\s\-:].*)?$/i.test(
    normSpace(text)
  );
}

function isJunkPlanCell(text) {
  const t = normSpace(text);
  if (!t) return true;
  if (isNoiseText(t) || isStatusOnly(t)) return true;
  if (/^(WORK|UPDATE|PLAN|DAYS|TIME|DATE)(\s+PLANNING|\s+UPDATE)?$/i.test(t)) return true;
  if (/^DAYS\s*PLANNING(\s+UPDATE)?$/i.test(t)) return true;
  // Time-band leftovers from the TIME header row
  if (/^\d{1,2}\s*[-.:]?\s*\d{0,2}\s*(AM|PM)\s*(TO|-|–|—)\s*\d{1,2}/i.test(t) && t.length < 40) {
    // Allow as plan only if it's a short daywise slot inside a real site row — still skip pure full-day bands
    if (/7[-.:]?0?0?\s*PM|7[-.:]?30\s*PM/i.test(t) && /9[-.:]?0?0?\s*AM/i.test(t)) return true;
  }
  return false;
}

function isJunkSiteName(name) {
  const t = normSpace(name);
  if (!t) return true;
  if (/^SITE\s*\d+$/i.test(t)) return true;
  if (/SR\s*NO/i.test(t) || /^SITE\s*NAME$/i.test(t)) return true;
  if (isNoiseText(t)) return true;
  if (/^(DATE|DAYS|TIME|PLAN|WORK|UPDATE)$/i.test(t)) return true;
  // Need a real project/site phrase, not a single filler word
  if (t.length < 6) return true;
  return false;
}

function looksLikeSiteName(text) {
  const t = normSpace(text);
  if (isJunkSiteName(t)) return false;
  if (parseDateFromText(t)) return false;
  if (/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return /[A-Za-z]{3,}/.test(t);
}

/**
 * Build structured sites from lines under the date header.
 */
function extractSites(lines, days, dateLineY) {
  const body = lines.filter((l) => l.y > dateLineY + 8);
  const sites = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    if (isJunkSiteName(current.name)) {
      current = null;
      return;
    }
    const cells = current.cells.map((c) => (isJunkPlanCell(c) ? "" : c));
    if (!cells.some(Boolean)) {
      current = null;
      return;
    }
    sites.push({ ...current, cells });
    current = null;
  };

  for (const line of body) {
    if (looksLikeHeaderOnly(line)) continue;

    const leftItems = line.items.filter((it) => it.x < days[0].x - 20);
    const leftText = normSpace(leftItems.map((i) => i.str).join(" "));
    if (isNoiseText(leftText) || /SR\s*NO.*SITE\s*NAME/i.test(leftText)) continue;

    const srMatch = leftText.match(/^(\d+)\s*(.*)$/);
    const srOnly = leftItems.find((it) => /^\d+$/.test(it.str));
    const nameParts = leftItems.filter((it) => !/^\d+$/.test(it.str)).map((it) => it.str);
    let name = normSpace(nameParts.join(" "));
    let sr = srMatch ? Number(srMatch[1]) : srOnly ? Number(srOnly.str) : null;
    if (srMatch && srMatch[2]) name = normSpace(srMatch[2] || name);

    // Day cell texts on this line
    const dayBits = days.map(() => []);
    for (const it of line.items) {
      if (it.x < days[0].x - 20) continue;
      const di = dayBandForX(days, it.x);
      if (di < 0) continue;
      if (isJunkPlanCell(it.str) || isNoiseText(it.str)) continue;
      if (/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i.test(it.str)) continue;
      if (parseDateFromText(it.str)) continue;
      dayBits[di].push(it.str);
    }
    const dayTexts = dayBits.map((parts) => normSpace(parts.join(" ")));
    const usefulDayTexts = dayTexts.map((t) => (isJunkPlanCell(t) ? "" : t));

    const realName = looksLikeSiteName(name);
    if (sr != null) {
      flush();
      current = {
        sr,
        name: realName ? name : "",
        cells: days.map(() => ""),
      };
    } else if (realName && name.length >= 8 && (!current || current.cells.some(Boolean))) {
      flush();
      current = {
        sr: sites.length + 1,
        name,
        cells: days.map(() => ""),
      };
    } else if (current && realName) {
      if (!current.name) current.name = name;
      else if (!current.name.toLowerCase().includes(name.toLowerCase())) {
        current.name = normSpace(`${current.name} ${name}`);
      }
    }

    // Do NOT invent "Site N" rows from orphan header leftovers.
    if (!current) continue;

    for (let i = 0; i < days.length; i += 1) {
      const bit = usefulDayTexts[i];
      if (!bit) continue;
      if (!current.cells[i]) current.cells[i] = bit;
      else if (!current.cells[i].toLowerCase().includes(bit.toLowerCase())) {
        current.cells[i] = normSpace(`${current.cells[i]} ${bit}`);
      }
    }
  }
  flush();

  // Merge consecutive rows that share the same cleaned site name.
  const merged = [];
  for (const s of sites) {
    const name = normSpace(s.name).replace(/\bTOWER\s+([AB])\b/i, "TOWER $1");
    const prev = merged[merged.length - 1];
    if (prev && prev.name.toLowerCase() === name.toLowerCase()) {
      for (let i = 0; i < prev.cells.length; i += 1) {
        const bit = s.cells[i];
        if (!bit) continue;
        if (!prev.cells[i]) prev.cells[i] = bit;
        else if (!prev.cells[i].toLowerCase().includes(bit.toLowerCase())) {
          prev.cells[i] = normSpace(`${prev.cells[i]} ${bit}`);
        }
      }
      continue;
    }
    merged.push({
      sr: Number.isFinite(Number(s.sr)) ? Number(s.sr) : merged.length + 1,
      name,
      cells: s.cells.map((c) =>
        normSpace(c)
          .replace(/\s+-\s*$/g, "")
          .replace(/\s+&\s*$/g, " &")
          .replace(/\s{2,}/g, " ")
      ),
    });
  }

  // Display SR as 1..n after cleanup
  return merged.map((s, idx) => ({ ...s, sr: idx + 1 }));
}

function looksLikeHeaderOnly(line) {
  const u = line.text.toUpperCase().replace(/\s+/g, " ");
  if (/^(DATE|DAYS|TIME)\b/.test(u)) return true;
  if (/SR\s*NO/.test(u) && /SITE\s*NAME/.test(u)) return true;
  if (/DAYS\s*PLANNING/.test(u) && !/EXCAVATION|CASTING|PLASTER|BRICK|COLUMN|FOUNDATION|RESIDENCY|TOWER|HEIGHTS/i.test(u)) {
    return true;
  }
  if (/^(WORK|UPDATE|PLAN)\b/.test(u) && u.length < 40) return true;
  if (/1ST\s*HALF|2ND\s*HALF/.test(u) && !/EXCAVATION|CASTING|PLASTER|BRICK|COLUMN|FOUNDATION/i.test(u)) {
    return true;
  }
  return false;
}

/** Join PDF glyph fragments on the same line into readable tokens. */
function itemsToLines(items, yTol = 3.5) {
  const yCenters = clusterBy(
    items.map((i) => i.y),
    yTol
  ).slice(0, 160);
  return yCenters.map((yc) => {
    const lineItems = items
      .filter((it) => Math.abs(it.y - yc) <= yTol + 1.5)
      .sort((a, b) => a.x - b.x);

    const merged = [];
    for (const it of lineItems) {
      const width = Number(it.width) || Math.max(6, String(it.str).length * 4.2);
      const xEnd = it.x + width;
      const last = merged[merged.length - 1];
      const gap = last ? it.x - last.xEnd : 999;
      // Small gap = same word/cell fragment (PDF often splits "07-Sep-2026").
      if (last && gap < 10) {
        const join =
          last.str.endsWith(" ") || String(it.str).startsWith(" ")
            ? `${last.str}${it.str}`
            : /[A-Za-z0-9]$/.test(last.str) && /^[A-Za-z0-9]/.test(it.str)
              ? `${last.str}${it.str}`
              : `${last.str} ${it.str}`;
        last.str = normSpace(join);
        last.xEnd = Math.max(last.xEnd, xEnd);
      } else {
        merged.push({ str: normSpace(it.str), x: it.x, xEnd, y: it.y });
      }
    }

    return {
      y: yc,
      items: merged,
      text: merged.map((m) => m.str).join(" "),
    };
  });
}

/** Find every parseable date token on a line (including joined windows). */
function datesOnLine(line) {
  const found = [];
  const items = line?.items || [];
  for (let i = 0; i < items.length; i += 1) {
    const windows = [
      items[i].str,
      [items[i].str, items[i + 1]?.str].filter(Boolean).join(" "),
      [items[i].str, items[i + 1]?.str, items[i + 2]?.str].filter(Boolean).join(" "),
    ];
    for (const w of windows) {
      const ymd = parseDateFromText(w);
      if (!ymd) continue;
      if (found.some((d) => d.ymd === ymd && Math.abs(d.x - items[i].x) < 8)) continue;
      found.push({ ymd, x: items[i].x, xEnd: items[i].xEnd, text: w });
      break;
    }
  }
  found.sort((a, b) => a.x - b.x);
  // De-dupe same ymd keeping leftmost
  const uniq = [];
  for (const d of found) {
    if (uniq.some((u) => u.ymd === d.ymd)) continue;
    uniq.push(d);
  }
  return uniq;
}

function findBestDateLine(lines) {
  let best = null;
  for (const line of lines) {
    const dates = datesOnLine(line);
    if (dates.length < 2) continue;
    if (!best || dates.length > best.dates.length) {
      best = { line, dates };
    }
  }
  return best;
}

function findAllDates(lines) {
  const byYmd = new Map();
  let bestLine = null;
  let bestCount = 0;
  for (const line of lines) {
    const dates = datesOnLine(line);
    if (dates.length > bestCount) {
      bestCount = dates.length;
      bestLine = { line, dates };
    }
    for (const d of dates) {
      if (!byYmd.has(d.ymd) || d.x < byYmd.get(d.ymd).x) byYmd.set(d.ymd, d);
    }
  }
  const allDates = [...byYmd.values()].sort((a, b) => a.ymd.localeCompare(b.ymd));
  return { bestLine, allDates };
}

/**
 * If PDF only exposes Mon–Tue clearly, still expand through the week when the
 * first date looks like a week start (Mon) or we see WEEKLY PLAN labels.
 */
function expandWeekDays(dates, lines) {
  const sorted = [...dates].sort((a, b) => a.ymd.localeCompare(b.ymd));
  if (!sorted.length) return [];
  const allText = lines.map((l) => l.text).join(" ").toUpperCase();
  const wantsWeek = /WEEKLY\s*PLAN|WORK\s*UPDATE\s*PLAN|DAYS\s*PLANNING|WORK\s*UPDATE/.test(allText);
  if (sorted.length >= 7) return sorted;

  const gap =
    sorted.length >= 2
      ? Math.max(50, (sorted[sorted.length - 1].x - sorted[0].x) / Math.max(1, sorted.length - 1))
      : 90;

  // Prefer a Monday-start week when this is clearly a weekly plan.
  let start = sorted[0].ymd;
  if (wantsWeek && ymdWeekday(start) !== "MONDAY") {
    // Walk back up to 6 days to Monday
    for (let i = 0; i < 6; i += 1) {
      const prev = addDaysYmd(start, -1);
      if (!prev) break;
      start = prev;
      if (ymdWeekday(start) === "MONDAY") break;
    }
  } else if (wantsWeek || ymdWeekday(sorted[0].ymd) === "MONDAY") {
    start = sorted[0].ymd;
  } else {
    // Non-weekly short range: fill inclusive gaps only
    const span = [];
    let cur = sorted[0].ymd;
    const max = sorted[sorted.length - 1].ymd;
    let guard = 0;
    while (cur && cur <= max && guard < 14) {
      const existing = sorted.find((d) => d.ymd === cur);
      const prevX = span.length ? span[span.length - 1].x : sorted[0].x;
      span.push(
        existing || {
          ymd: cur,
          x: prevX + gap,
          xEnd: prevX + gap + 60,
          text: ymdToLabel(cur),
          synthetic: true,
        }
      );
      cur = addDaysYmd(cur, 1);
      guard += 1;
    }
    return span;
  }

  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const ymd = addDaysYmd(start, i);
    if (!ymd) break;
    const existing = sorted.find((d) => d.ymd === ymd);
    if (existing) out.push(existing);
    else {
      const prevX = out.length ? out[out.length - 1].x : sorted[0].x - gap;
      out.push({
        ymd,
        x: prevX + gap,
        xEnd: prevX + gap + 60,
        text: ymdToLabel(ymd),
        synthetic: true,
      });
    }
  }
  return out.length ? out : sorted;
}

function detectHalfLayout(lines) {
  let first = 0;
  let second = 0;
  for (const line of lines) {
    const u = line.text.toUpperCase();
    if (/1ST\s*HALF|FIRST\s*HALF/.test(u)) first += 1;
    if (/2ND\s*HALF|SECOND\s*HALF/.test(u)) second += 1;
  }
  return first >= 1 && second >= 1;
}

function dayBandForX(days, x) {
  if (!days.length) return -1;
  // Assign by nearest day center, but never left of first day margin.
  if (x < days[0].x - 25) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < days.length; i += 1) {
    const cx = (days[i].x + (days[i].xEnd || days[i].x)) / 2;
    const d = Math.abs(cx - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function findTimeLabel(lines, days) {
  for (const line of lines) {
    if (!/TIME|AM|PM/i.test(line.text)) continue;
    const times = [];
    for (const it of line.items) {
      if (!/\d{1,2}\s*[-.:]?\s*\d{0,2}\s*(AM|PM)/i.test(it.str)) continue;
      const di = dayBandForX(days, it.x);
      if (di >= 0) times[di] = normSpace(it.str);
    }
    if (times.filter(Boolean).length) return times;
    // Whole-line fallback
    const m = line.text.match(/\d{1,2}\s*[-.:]?\s*\d{0,2}\s*(AM|PM)\s*(TO|-|–|—)\s*\d{1,2}\s*[-.:]?\s*\d{0,2}\s*(AM|PM)/i);
    if (m) return days.map(() => normSpace(m[0]));
  }
  return days.map(() => "9-00 AM TO 7-30 PM");
}

function styleCell(kind, display) {
  const base = {
    display: display || "",
    bold: false,
    align: "center",
    wrap: true,
    bg: "#FFFFFF",
    color: "#111827",
  };
  switch (kind) {
    case "title":
      return { ...base, bold: true, align: "left", bg: "#F3F4F6", color: "#111827" };
    case "label":
      return { ...base, bold: true, align: "left", bg: "#EEF2FF", color: "#312E81" };
    case "date":
      return { ...base, bold: true, bg: "#FFF2CC", color: "#7A4E00" };
    case "day":
      return { ...base, bold: true, bg: "#E2EFDA", color: "#1F4E19" };
    case "time":
      return { ...base, bold: true, bg: "#DDEBF7", color: "#1F4E79" };
    case "sr":
      return { ...base, bold: true, align: "center", bg: "#F8FAFC", color: "#334155" };
    case "site":
      return { ...base, bold: true, align: "left", bg: "#F8FAFC", color: "#0F172A" };
    case "planEven":
      return { ...base, align: "center", bg: "#FFF7ED", color: "#111827" };
    case "planOdd":
      return { ...base, align: "center", bg: "#FFFBEB", color: "#111827" };
    case "empty":
      return { ...base, bg: "#FFFFFF" };
    default:
      return base;
  }
}

/**
 * Build a pristine weekly-plan preview sheet (not a PDF coordinate dump).
 */
export function buildCleanWeeklyPlanSheet({ title, days, times, sites, half = false }) {
  const dayList = Array.isArray(days) ? days : [];
  const siteList = Array.isArray(sites) ? sites : [];
  if (!dayList.length) return { matrix: [], merges: [], colWidths: [] };

  const cols = 2 + dayList.length;
  const matrix = [];

  const titleRow = Array.from({ length: cols }, () => styleCell("empty", ""));
  titleRow[0] = styleCell("title", title || "WEEKLY PLAN");
  titleRow[1] = styleCell("title", "");
  matrix.push(titleRow);

  const dateRow = Array.from({ length: cols }, () => styleCell("empty", ""));
  dateRow[0] = styleCell("label", "");
  dateRow[1] = styleCell("date", "DATE");
  dayList.forEach((d, i) => {
    dateRow[2 + i] = styleCell("date", d.label || ymdToLabel(d.ymd));
  });
  matrix.push(dateRow);

  const daysRow = Array.from({ length: cols }, () => styleCell("empty", ""));
  daysRow[0] = styleCell("label", "");
  daysRow[1] = styleCell("day", "DAYS");
  dayList.forEach((d, i) => {
    daysRow[2 + i] = styleCell("day", d.weekday || ymdWeekday(d.ymd));
  });
  matrix.push(daysRow);

  const timeRow = Array.from({ length: cols }, () => styleCell("empty", ""));
  timeRow[0] = styleCell("label", "");
  timeRow[1] = styleCell("time", half ? "HALF" : "TIME");
  dayList.forEach((d, i) => {
    timeRow[2 + i] = styleCell("time", (times && times[i]) || d.time || "9-00 AM TO 7-30 PM");
  });
  matrix.push(timeRow);

  const headRow = Array.from({ length: cols }, () => styleCell("empty", ""));
  headRow[0] = styleCell("label", "SR NO");
  headRow[1] = styleCell("label", "SITE NAME");
  dayList.forEach((_, i) => {
    // Leave day title cells blank — DATE/DAYS/TIME already label the columns.
    // Half layouts keep an explicit half label once per column.
    headRow[2 + i] = styleCell("label", half ? (i % 2 === 0 ? "1ST HALF" : "2ND HALF") : "");
  });
  matrix.push(headRow);

  for (const site of siteList) {
    const row = Array.from({ length: cols }, () => styleCell("empty", ""));
    row[0] = styleCell("sr", String(site.sr ?? ""));
    row[1] = styleCell("site", site.name || "");
    dayList.forEach((_, i) => {
      const text = site.cells?.[i] || "";
      row[2 + i] = styleCell(i % 2 === 0 ? "planEven" : "planOdd", text);
    });
    matrix.push(row);
  }

  const colWidths = Array.from({ length: cols }, (_, c) => {
    if (c === 0) return 64;
    if (c === 1) return 240;
    return 150;
  });

  return { matrix, merges: [], colWidths };
}

/** Plain string matrix for the Excel task parser. */
function sheetToStringMatrix(sheet) {
  return (sheet?.matrix || []).map((row) => (row || []).map((c) => normSpace(c?.display)));
}

async function extractPdfItems(arrayBuffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const items = [];
  const pageLimit = Math.min(doc.numPages || 1, 4);

  for (let pageNum = 1; pageNum <= pageLimit; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const content = await page.getTextContent();
    for (const item of content.items || []) {
      if (items.length >= MAX_TEXT_ITEMS) break;
      const str = normSpace(item.str);
      if (!str) continue;
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const x = Number(tx[4]) || 0;
      const y = viewport.height - (Number(tx[5]) || 0) + (pageNum - 1) * (viewport.height + 48);
      const width = Number(item.width) || Math.max(8, str.length * 4.5);
      items.push({ str, x, y, width, page: pageNum });
    }
    if (items.length >= MAX_TEXT_ITEMS) break;
  }
  return items;
}

function rebuildFromPdfItems(items) {
  if (!items.length) {
    return {
      sheet: { matrix: [], merges: [], colWidths: [] },
      tasks: [],
      meta: { error: "empty_pdf", via: "pdf" },
      matrix: [],
    };
  }

  const lines = itemsToLines(items, 3.2);
  const { bestLine, allDates } = findAllDates(lines);
  if (!bestLine || allDates.length < 2) {
    return {
      sheet: { matrix: [], merges: [], colWidths: [] },
      tasks: [],
      meta: { error: "no_dates", via: "pdf" },
      matrix: [],
    };
  }

  // Use every distinct date found anywhere, with X from the richest date line when possible.
  const dateSeed = allDates.map((d) => {
    const onBest = bestLine.dates.find((x) => x.ymd === d.ymd);
    return onBest || d;
  });

  let days = expandWeekDays(dateSeed, lines).map((d) => ({
    ymd: d.ymd,
    x: d.x,
    xEnd: d.xEnd,
    label: ymdToLabel(d.ymd),
    weekday: ymdWeekday(d.ymd),
    synthetic: Boolean(d.synthetic),
  }));

  const half = detectHalfLayout(lines);
  const times = findTimeLabel(lines, days);
  const sites = extractSites(lines, days, bestLine.line.y);

  const sheet = buildCleanWeeklyPlanSheet({
    title: "WEEKLY WORK UPDATE PLAN",
    days,
    times,
    sites,
    half,
  });

  const stringMatrix = sheetToStringMatrix(sheet);
  const parsed = parseWeeklyPlanMatrix(stringMatrix);

  return {
    sheet,
    matrix: stringMatrix,
    tasks: parsed.tasks || [],
    meta: {
      ...parsed.meta,
      via: "pdf",
      convertedToExcel: true,
      rebuilt: true,
      days: days.map((d) => d.ymd),
      sites: sites.length,
      half,
    },
    dayCols: parsed.dayCols,
  };
}

/** Kept for tests / callers that still pass a raw matrix. */
export function consolidateWrappedRows(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return [];
  const out = [];
  for (let r = 0; r < matrix.length; r += 1) {
    const row = [...(matrix[r] || [])];
    const sr = cellStr(row, 0);
    const prev = out[out.length - 1];
    const prevIsData = prev && /^\d+$/.test(cellStr(prev, 0));
    const thisIsData = /^\d+$/.test(sr);
    const headerish =
      /^(DATE|DAYS|TIME|SR\s*NO|SITE\s*NAME)$/i.test(cellStr(row, 1)) ||
      /^(DATE|DAYS|TIME|SR\s*NO)$/i.test(sr);
    if (prevIsData && !thisIsData && !headerish) {
      const width = Math.max(prev.length, row.length);
      for (let c = 0; c < width; c += 1) {
        const cur = cellStr(row, c);
        if (!cur) continue;
        const prevVal = cellStr(prev, c);
        if (!prevVal) prev[c] = cur;
        else if (!prevVal.toLowerCase().includes(cur.toLowerCase())) {
          prev[c] = normSpace(`${prevVal} ${cur}`);
        }
      }
      continue;
    }
    out.push(row);
  }
  return out;
}

export function matrixToPreviewSheet(matrix) {
  const rows = Array.isArray(matrix) ? matrix : [];
  if (!rows.length) return { matrix: [], merges: [], colWidths: [] };

  // Clean rebuild shape: explicit DATE label in column 1.
  const dateRow = rows.find((r) => /^DATE$/i.test(cellStr(r, 1)));
  if (dateRow) {
    const days = [];
    for (let c = 2; c < dateRow.length; c += 1) {
      const label = cellStr(dateRow, c);
      const ymd = parseDateFromText(label);
      if (ymd) days.push({ ymd, label, weekday: ymdWeekday(ymd) });
    }
    const sites = [];
    for (const row of rows) {
      if (!/^\d+$/.test(cellStr(row, 0))) continue;
      sites.push({
        sr: Number(cellStr(row, 0)),
        name: cellStr(row, 1),
        cells: days.map((_, i) => cellStr(row, 2 + i)),
      });
    }
    const timeRow = rows.find((r) => /^TIME$/i.test(cellStr(r, 1)));
    const times = days.map((_, i) => (timeRow ? cellStr(timeRow, 2 + i) : "9-00 AM TO 7-30 PM"));
    return buildCleanWeeklyPlanSheet({ days, times, sites });
  }

  // Fallback: light styling for arbitrary matrices
  const colCount = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
  const styled = rows.map((row, rowIdx) =>
    Array.from({ length: colCount }, (_, c) => {
      const display = cellStr(row, c);
      const isDate = Boolean(parseDateFromText(display));
      const isDay = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i.test(display);
      let bg = c >= 2 ? "#FFF7ED" : "#F8FAFC";
      if (isDate) bg = "#FFF2CC";
      if (isDay) bg = "#E2EFDA";
      return {
        display,
        bg,
        color: "#111827",
        bold: c < 2 || isDate || isDay || rowIdx < 3,
        align: c <= 1 ? "left" : "center",
        wrap: true,
      };
    })
  );
  return {
    matrix: styled,
    merges: [],
    colWidths: Array.from({ length: colCount }, (_, c) => (c === 1 ? 220 : c === 0 ? 64 : 140)),
  };
}

export function matrixToExcelBuffer(matrix) {
  const rows = (Array.isArray(matrix) ? matrix : []).map((row) =>
    (row || []).map((cell) => {
      if (cell && typeof cell === "object") return normSpace(cell.display);
      return normSpace(cell);
    })
  );
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Weekly Plan");
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export async function parseWeeklyPlanPdfBuffer(arrayBuffer) {
  try {
    const items = await extractPdfItems(arrayBuffer);
    const rebuilt = rebuildFromPdfItems(items);
    if (!rebuilt.sheet?.matrix?.length) {
      return {
        tasks: [],
        meta: rebuilt.meta || { error: "empty_pdf", via: "pdf" },
        matrix: [],
        sheet: { matrix: [], merges: [], colWidths: [] },
        excelBuffer: null,
      };
    }

    let excelBuffer = null;
    try {
      excelBuffer = matrixToExcelBuffer(sheetToStringMatrix(rebuilt.sheet));
    } catch {
      excelBuffer = null;
    }

    return {
      tasks: rebuilt.tasks || [],
      matrix: rebuilt.matrix || sheetToStringMatrix(rebuilt.sheet),
      sheet: rebuilt.sheet,
      excelBuffer,
      meta: rebuilt.meta,
      dayCols: rebuilt.dayCols,
    };
  } catch (err) {
    return {
      tasks: [],
      meta: { error: err.message || "pdf_parse_failed", via: "pdf" },
      matrix: [],
      sheet: { matrix: [], merges: [], colWidths: [] },
      excelBuffer: null,
    };
  }
}

export async function parseWeeklyPlanPdfFile(file) {
  if (!file) return { tasks: [], meta: { error: "no_file" } };
  const buffer = await file.arrayBuffer();
  return parseWeeklyPlanPdfBuffer(buffer);
}

// Test helpers
export const __test = {
  itemsToLines,
  datesOnLine,
  expandWeekDays,
  extractSites,
  buildCleanWeeklyPlanSheet,
  ymdToLabel,
  ymdWeekday,
};
