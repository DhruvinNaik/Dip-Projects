import { useEffect, useState } from "react";
import {
  buildMergeMaps,
  mapSheetColorsForTheme,
  resolveSheetCellStyle,
  sheetHasContent,
} from "../lib/excelSheetPreview";

function cellKey(r, c) {
  return `${r}:${c}`;
}

function useDocumentDarkTheme() {
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark"
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const sync = () => setIsDark(root.getAttribute("data-theme") === "dark");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("storage", sync);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", sync);
    };
  }, []);

  return isDark;
}

export function ExcelSheetTable({ matrix, merges = [], colWidths = [], renderCell }) {
  const isDark = useDocumentDarkTheme();

  if (!sheetHasContent({ matrix })) {
    return <div className="smt-excel-preview__msg">No spreadsheet data available.</div>;
  }

  const rowCount = matrix.length;
  const colCount = matrix.reduce((max, row) => Math.max(max, (row || []).length), 0);
  const { mergeStarts, covered } = buildMergeMaps(merges);
  const rows = [];

  for (let r = 0; r < rowCount; r += 1) {
    const cells = [];
    for (let c = 0; c < colCount; c += 1) {
      if (covered.has(cellKey(r, c))) continue;
      const cell = matrix[r]?.[c] || {};
      const style = resolveSheetCellStyle(cell, r, c);
      const themed = mapSheetColorsForTheme(style.bg, style.color, isDark);
      const span = mergeStarts.get(cellKey(r, c));
      const width = Number(colWidths[c]) > 0 ? Number(colWidths[c]) : style.minWidth;
      const css = {
        background: themed.bg,
        color: themed.color,
        fontWeight: style.bold ? 700 : 500,
        textAlign: style.align,
        verticalAlign: "middle",
        whiteSpace: style.wrap ? "pre-wrap" : "nowrap",
        padding: "6px 8px",
        border: `1px solid ${themed.border}`,
        minWidth: `${width}px`,
        width: `${width}px`,
        lineHeight: 1.25,
      };

      const content = renderCell
        ? renderCell({ cell, style: { ...style, bg: themed.bg, color: themed.color }, rowIdx: r, colIdx: c })
        : style.display || "";

      cells.push(
        <td
          key={cellKey(r, c)}
          style={css}
          rowSpan={span && span.rowSpan > 1 ? span.rowSpan : undefined}
          colSpan={span && span.colSpan > 1 ? span.colSpan : undefined}
        >
          {content}
        </td>
      );
    }
    rows.push(<tr key={`r-${r}`}>{cells}</tr>);
  }

  return (
    <table className={`smt-excel-sheet${isDark ? " smt-excel-sheet--dark" : ""}`}>
      {colWidths.some((w) => Number(w) > 0) ? (
        <colgroup>
          {Array.from({ length: colCount }, (_, c) => (
            <col key={`col-${c}`} style={Number(colWidths[c]) > 0 ? { width: colWidths[c] } : undefined} />
          ))}
        </colgroup>
      ) : null}
      <tbody>{rows}</tbody>
    </table>
  );
}
