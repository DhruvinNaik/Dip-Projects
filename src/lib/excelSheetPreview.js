import ExcelJS from "exceljs";

function argbToCss(color) {
  if (!color) return "";
  const raw = String(color.argb || color || "").trim();
  if (!raw) return "";
  const hex = raw.replace(/^#/, "");
  if (/^[0-9A-Fa-f]{8}$/.test(hex)) {
    const a = parseInt(hex.slice(0, 2), 16) / 255;
    const r = parseInt(hex.slice(2, 4), 16);
    const g = parseInt(hex.slice(4, 6), 16);
    const b = parseInt(hex.slice(6, 8), 16);
    if (a < 1) return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
    return `#${hex.slice(2)}`;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return `#${hex}`;
  return "";
}

function cellDisplay(cell) {
  if (!cell) return "";
  const v = cell.value;
  if (v == null || v === "") return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((p) => p.text || "").join("");
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.hyperlink) return String(v.text || v.hyperlink);
    if (v instanceof Date) return v.toLocaleDateString("en-GB");
  }
  if (typeof v === "number" && cell.numFmt && /d|m|y/i.test(String(cell.numFmt))) {
    try {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + v * 86400000);
      return d.toLocaleDateString("en-GB", { timeZone: "UTC" });
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function colLettersToIndex(letters) {
  let n = 0;
  const s = String(letters || "").toUpperCase();
  for (let i = 0; i < s.length; i += 1) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

function a1ToRc(a1) {
  const m = String(a1 || "").match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { r: 0, c: 0 };
  return { r: Number(m[2]) - 1, c: colLettersToIndex(m[1]) };
}

function parseMergeRange(addr) {
  const [start, end] = String(addr || "").split(":");
  const s = a1ToRc(start);
  const e = a1ToRc(end || start);
  return { s, e };
}

function cellKey(r, c) {
  return `${r}:${c}`;
}

export function sheetHasContent(sheet) {
  const matrix = sheet?.matrix || sheet;
  if (!Array.isArray(matrix)) return false;
  return matrix.some((row) =>
    (row || []).some((cell) => {
      if (cell == null) return false;
      if (typeof cell === "object") return String(cell.display || "").trim() !== "";
      return String(cell).trim() !== "";
    })
  );
}

export function buildMergeMaps(merges = []) {
  const mergeStarts = new Map();
  const covered = new Set();
  for (const m of merges || []) {
    const sr = m.s?.r ?? m.startRow ?? m.row ?? 0;
    const sc = m.s?.c ?? m.startCol ?? m.col ?? 0;
    const er = m.e?.r ?? (m.endRow != null ? m.endRow : sr + (m.rowSpan || 1) - 1);
    const ec = m.e?.c ?? (m.endCol != null ? m.endCol : sc + (m.colSpan || 1) - 1);
    const rowSpan = er - sr + 1;
    const colSpan = ec - sc + 1;
    if (rowSpan < 1 || colSpan < 1) continue;
    mergeStarts.set(cellKey(sr, sc), { rowSpan, colSpan });
    for (let r = sr; r <= er; r += 1) {
      for (let c = sc; c <= ec; c += 1) {
        if (r === sr && c === sc) continue;
        covered.add(cellKey(r, c));
      }
    }
  }
  return { mergeStarts, covered };
}

export function resolveSheetCellStyle(cell) {
  const display = cell?.display != null ? String(cell.display) : "";
  return {
    display,
    bg: cell?.bg || "#ffffff",
    color: cell?.color || "#111827",
    bold: Boolean(cell?.bold),
    align: cell?.align || (display.length > 24 ? "left" : "center"),
    wrap: Boolean(cell?.wrap) || display.length > 28,
    minWidth: Number(cell?.minWidth) > 0 ? Number(cell.minWidth) : Math.min(220, Math.max(72, display.length * 8)),
  };
}

export function isBlankSheetFill(bg) {
  const t = String(bg || "")
    .replace(/\s/g, "")
    .toLowerCase();
  return (
    !t ||
    t === "#fff" ||
    t === "#ffffff" ||
    t === "#ffffffff" ||
    t === "white" ||
    t === "transparent" ||
    t === "rgba(0,0,0,0)"
  );
}

const LIGHT_COL_TINTS = [
  "#F1F5F9",
  "#EEF2FF",
  "#EFF6FF",
  "#ECFDF5",
  "#FFF7ED",
  "#FEFCE8",
  "#F5F3FF",
  "#FDF2F8",
  "#ECFEFF",
  "#F0FDF4",
];

const DARK_COL_TINTS = [
  "#1e293b",
  "#1e1b4b",
  "#172554",
  "#14532d",
  "#431407",
  "#422006",
  "#2e1065",
  "#4a044e",
  "#164e63",
  "#052e16",
];

export function lightColumnBg(colIdx, isDark = false) {
  const pal = isDark ? DARK_COL_TINTS : LIGHT_COL_TINTS;
  const i = Number.isFinite(colIdx) ? Math.max(0, colIdx) : 0;
  return pal[i % pal.length];
}

export function mapSheetColorsForTheme(bg, color, isDark) {
  if (!isDark) {
    return { bg: bg || "#fff", color: color || "#111827", border: "#c5cdd6" };
  }
  const lightBg = !bg || /^#fff/i.test(bg) || bg === "#ffffff";
  return {
    bg: lightBg ? "#1f2937" : bg,
    color: color && color !== "#111827" ? color : "#f3f4f6",
    border: "#374151",
  };
}

function isDroppedPlanHeader(text) {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!t) return false;
  if (t === "STATUS" || t === "STATUSES") return true;
  if (/^WORK\s*STATUS$/.test(t)) return true;
  if (/^WORK\s*UPDATES?$/.test(t)) return true;
  if (/^(UPDATE|UPDATES)$/.test(t)) return true;
  return false;
}

/** Strip STATUS / Work Update columns — they are not used in the portal preview. */
export function omitStatusHeaderColumns(sheet) {
  const matrix = sheet?.matrix || [];
  if (!matrix.length) return sheet || { matrix: [], merges: [], colWidths: [] };
  const headerRows = matrix.slice(0, 15);
  const drop = new Set();
  headerRows.forEach((row) => {
    (row || []).forEach((cell, c) => {
      const t = typeof cell === "object" ? cell?.display : cell;
      if (isDroppedPlanHeader(t)) drop.add(c);
    });
  });
  if (!drop.size) return sheet;
  const keep = (row) => (row || []).filter((_, c) => !drop.has(c));
  return {
    ...sheet,
    matrix: matrix.map(keep),
    colWidths: (sheet.colWidths || []).filter((_, c) => !drop.has(c)),
    merges: [],
  };
}

export async function loadExcelSheetFromBuffer(buffer, fileName = "") {
  const wb = new ExcelJS.Workbook();
  const name = String(fileName || "").toLowerCase();
  if (name.endsWith(".csv")) {
    await wb.csv.load(buffer);
  } else {
    await wb.xlsx.load(buffer);
  }
  const ws = wb.worksheets[0];
  if (!ws) return { matrix: [], merges: [], colWidths: [] };

  const rowCount = ws.rowCount || 0;
  const colCount = ws.columnCount || 0;
  const matrix = [];
  for (let r = 1; r <= rowCount; r += 1) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= colCount; c += 1) {
      const cell = row.getCell(c);
      const fill = cell.fill && cell.fill.fgColor ? argbToCss(cell.fill.fgColor) : "";
      const fontColor = cell.font?.color ? argbToCss(cell.font.color) : "";
      const align = String(cell.alignment?.horizontal || "").toLowerCase() || undefined;
      cells.push({
        display: cellDisplay(cell).trim(),
        bg: fill || "#ffffff",
        color: fontColor || "#111827",
        bold: Boolean(cell.font?.bold),
        align: align === "right" || align === "center" || align === "left" ? align : undefined,
        wrap: Boolean(cell.alignment?.wrapText),
      });
    }
    matrix.push(cells);
  }

  const merges = (ws.model?.merges || []).map(parseMergeRange);

  const colWidths = [];
  for (let c = 1; c <= colCount; c += 1) {
    const w = ws.getColumn(c).width;
    colWidths.push(w ? Math.round(Number(w) * 8) : 0);
  }

  return { matrix, merges, colWidths };
}
