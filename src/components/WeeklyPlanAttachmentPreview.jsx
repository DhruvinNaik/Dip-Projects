import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ingestWeeklyPlanTasks, listTasksForEa, setWeeklyPlanTaskStatus } from "../lib/eaMeeting";
import {
  loadExcelSheetFromBuffer,
  omitStatusHeaderColumns,
  sheetHasContent,
} from "../lib/excelSheetPreview";
import {
  findTaskForSheetCell,
  findDateForSheetColumn,
  findHalfForSheetColumn,
  getCellStatusText,
  hasHalfPlanningLayout,
  isActionablePlanCell,
} from "../lib/weeklyPlanPreview";
import { parseWeeklyPlanBuffer } from "../lib/weeklyPlanExcel";
import { parseWeeklyPlanPdfBuffer } from "../lib/weeklyPlanPdf";
import { ExcelSheetTable } from "./ExcelSheetTable";

function isPdfAttachment(fileName, fileUrl) {
  const lower = String(fileName || fileUrl || "").toLowerCase();
  return lower.includes(".pdf") || lower.endsWith("pdf");
}

function statusClass(status) {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  if (s === "completed" || s === "complete" || s === "done") return "smt-excel-sheet__cell--done";
  if (s === "cancelled" || s === "canceled") return "smt-excel-sheet__cell--cancel";
  // Default to pending styles so the control never looks like plain text.
  return "smt-excel-sheet__cell--pending";
}

function cellBusyKey(rowIdx, colIdx) {
  return `cell-${rowIdx}-${colIdx}`;
}

function rowTaskNameFromMatrix(matrix, rowIdx) {
  const row = matrix?.[rowIdx] || [];
  return String(row[1]?.display || row[0]?.display || "").trim();
}

function preparePreviewSheet(sheet) {
  return omitStatusHeaderColumns(sheet || { matrix: [], merges: [], colWidths: [] });
}

/**
 * Shows the submitted weekly-plan Excel as a same-layout sheet.
 * PDFs are converted to an Excel-style sheet first (iframe PDF preview is unreliable).
 * Type 1: Complete on daywise time data cells.
 * Type 2: Complete on 1st/2nd half planning task data cells.
 * Headers never get Complete controls.
 */
export function WeeklyPlanAttachmentPreview({
  eaId,
  sourceFile,
  fileUrl,
  fileName,
}) {
  const isPdf = isPdfAttachment(fileName, fileUrl);
  const [sheet, setSheet] = useState({ matrix: [], merges: [], colWidths: [] });
  const [tasks, setTasks] = useState([]);
  const [parsedTasks, setParsedTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(fileUrl || eaId));
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [note, setNote] = useState("");
  const [fromPdf, setFromPdf] = useState(false);
  const cancelledRef = useRef(false);

  const layoutHint = useMemo(
    () => (hasHalfPlanningLayout(sheet.matrix) ? "half" : "daily"),
    [sheet.matrix]
  );

  const loadTasks = useCallback(async () => {
    if (!eaId) return [];
    const tasks = await listTasksForEa(eaId, sourceFile);
    if (tasks.length || !sourceFile) return tasks;
    return listTasksForEa(eaId);
  }, [eaId, sourceFile]);

  const ingestParsed = useCallback(
    async (parsed) => {
      if (!eaId || !parsed?.tasks?.length) return [];
      const result = await ingestWeeklyPlanTasks(eaId, [
        {
          source_file: sourceFile || "attachment_1",
          tasks: parsed.tasks.slice(0, 400),
          meta: parsed.meta || null,
        },
      ]);
      if (!result?.ok && !Number(result?.inserted)) {
        throw new Error(
          result?.note || result?.error || "Could not save weekly-plan tasks."
        );
      }
      return loadTasks();
    },
    [eaId, loadTasks, sourceFile]
  );

  const load = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    setError("");
    setNote("");
    setFromPdf(false);
    try {
      const dbTasksPromise = loadTasks().catch(() => []);

      const [dbTasks, fileRes] = await Promise.all([
        dbTasksPromise,
        fileUrl ? fetch(fileUrl) : Promise.resolve(null),
      ]);
      if (cancelledRef.current) return;

      let nextSheet = { matrix: [], merges: [], colWidths: [] };
      let parsed = null;
      let convertedFromPdf = false;

      if (fileRes) {
        if (!fileRes.ok) throw new Error("Could not download plan file");
        const buf = await fileRes.arrayBuffer();
        if (cancelledRef.current) return;

        if (isPdf) {
          const pdfParsed = await parseWeeklyPlanPdfBuffer(buf);
          if (cancelledRef.current) return;
          convertedFromPdf = true;

          // Prefer the styled PDF→sheet matrix (colors + merged wraps).
          // Raw xlsx round-trip strips formatting.
          if (sheetHasContent(pdfParsed?.sheet)) {
            nextSheet = preparePreviewSheet(pdfParsed.sheet);
          } else if (pdfParsed?.excelBuffer) {
            try {
              nextSheet = preparePreviewSheet(
                await loadExcelSheetFromBuffer(
                  pdfParsed.excelBuffer,
                  "weekly-plan-from-pdf.xlsx"
                )
              );
            } catch {
              nextSheet = { matrix: [], merges: [], colWidths: [] };
            }
          }

          parsed = pdfParsed;
          if (!sheetHasContent(nextSheet) && !pdfParsed?.tasks?.length) {
            throw new Error(
              pdfParsed?.meta?.error
                ? `Could not convert PDF to Excel preview (${pdfParsed.meta.error}).`
                : "Could not convert this PDF into an Excel weekly-plan preview."
            );
          }
        } else {
          nextSheet = preparePreviewSheet(await loadExcelSheetFromBuffer(buf, fileName));
          try {
            parsed = parseWeeklyPlanBuffer(buf);
          } catch {
            parsed = null;
          }
        }
      }

      setFromPdf(convertedFromPdf);
      setSheet(nextSheet);
      setTasks(Array.isArray(dbTasks) ? dbTasks : []);
      setParsedTasks(Array.isArray(parsed?.tasks) ? parsed.tasks : []);
      setLoading(false);

      let nextTasks = Array.isArray(dbTasks) ? dbTasks : [];
      if (!nextTasks.length && parsed?.tasks?.length) {
        try {
          nextTasks = await ingestParsed(parsed);
          if (!cancelledRef.current) setTasks(nextTasks);
        } catch {
          // Preview already mirrors the sheet; ingest is only for click-to-complete.
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err.message || "Could not load weekly plan file.");
        setSheet({ matrix: [], merges: [], colWidths: [] });
        setTasks([]);
        setFromPdf(false);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [fileName, fileUrl, ingestParsed, isPdf, loadTasks]);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const setTaskStatus = async (taskList, nextStatus, busyKey) => {
    const wanted = nextStatus === "Pending" ? "Pending" : "Completed";
    const targets = (Array.isArray(taskList) ? taskList : []).filter((task) => {
      if (!task?.id) return false;
      const s = String(task.status || "");
      if (s === "Cancelled") return false;
      return s !== wanted;
    });
    if (!targets.length) {
      if (busyKey) setBusyId("");
      return;
    }

    // Busy is always the clicked sheet cell — never the shared task id
    // (duplicate labels must not show "…" on other cells).
    if (busyKey) setBusyId(busyKey);
    setNote("");
    const at = new Date().toISOString();
    const targetIds = new Set(targets.map((task) => task.id));
    const previousById = new Map(targets.map((task) => [task.id, task]));
    const optimistic =
      wanted === "Completed"
        ? { status: "Completed", completed_at: at, completed_via: "portal" }
        : { status: "Pending", completed_at: null, completed_via: null };

    setTasks((prev) =>
      prev.map((task) => (targetIds.has(task.id) ? { ...task, ...optimistic } : task))
    );
    try {
      const results = await Promise.all(
        targets.map((task) => setWeeklyPlanTaskStatus(task.id, wanted))
      );
      const refreshedTasks = await loadTasks();
      const byId = new Map(
        results
          .map((result) => result?.task)
          .filter((task) => task?.id)
          .map((task) => [task.id, task])
      );
      setTasks((prev) =>
        (refreshedTasks.length ? refreshedTasks : prev).map((t) =>
          byId.has(t.id) ? { ...t, ...byId.get(t.id), status: wanted } : t
        )
      );
    } catch (err) {
      setTasks((prev) =>
        prev.map((task) => (previousById.has(task.id) ? previousById.get(task.id) : task))
      );
      setNote(err.message || `Could not mark task ${wanted}.`);
    } finally {
      setBusyId("");
    }
  };

  const completeCell = async ({ task, cellText, rowTaskName, rowIdx, colIdx, taskDate, half }) => {
    const busyKey = cellBusyKey(rowIdx, colIdx);
    if (task?.id) {
      const done = String(task.status || "") === "Completed";
      await setTaskStatus([task], done ? "Pending" : "Completed", busyKey);
      return;
    }
    if (!parsedTasks.length) {
      setNote("This plan cell is not linked to a saved task. Re-parse the file and try again.");
      return;
    }

    setBusyId(busyKey);
    setNote("");
    try {
      const refreshed = await ingestParsed({ tasks: parsedTasks });
      setTasks(refreshed);
      const matched = findTaskForSheetCell(refreshed, {
        cellText,
        rowTaskName,
        colIdx,
        rowIdx,
        taskDate,
        half,
        matrix: sheet.matrix,
      });
      if (!matched?.id) throw new Error("Could not link this plan cell to a saved task.");
      await setTaskStatus([matched], "Completed", busyKey);
    } catch (err) {
      setNote(err.message || "Could not complete task.");
      setBusyId("");
    }
  };

  const renderCell = ({ style, rowIdx, colIdx }) => {
    const text = style.display || "";
    if (!isActionablePlanCell(sheet.matrix, rowIdx, colIdx, text)) {
      return text;
    }

    const rowName = rowTaskNameFromMatrix(sheet.matrix, rowIdx);
    const taskDate = findDateForSheetColumn(sheet.matrix, colIdx);
    const half = findHalfForSheetColumn(sheet.matrix, colIdx);
    const task = findTaskForSheetCell(tasks, {
      cellText: text,
      rowTaskName: rowName,
      colIdx,
      rowIdx,
      taskDate,
      half,
      matrix: sheet.matrix,
    });

    const status = task ? getCellStatusText(task) : "Pending";
    const statusCss = statusClass(status);
    const done = statusCss === "smt-excel-sheet__cell--done";
    const cancelled = statusCss === "smt-excel-sheet__cell--cancel";
    const clickable = Boolean(eaId) && !cancelled;
    const busyKey = cellBusyKey(rowIdx, colIdx);
    const busy = busyId === busyKey;

    return (
      <div className={`smt-excel-sheet__plan ${statusCss}`}>
        <div className="smt-excel-sheet__text">{text}</div>
        <button
          type="button"
          className={`smt-excel-sheet__status-btn ${statusCss}`}
          disabled={!clickable || busy}
          title={
            cancelled
              ? "Cancelled"
              : done
                ? "Click Completed to mark Pending"
                : "Click Pending to mark Completed"
          }
          onClick={() => {
            if (clickable && !busyId) {
              completeCell({
                task,
                cellText: text,
                rowTaskName: rowName,
                rowIdx,
                colIdx,
                taskDate,
                half,
              });
            }
          }}
        >
          {busy ? "…" : done ? "Completed" : cancelled ? "Cancelled" : "Pending"}
        </button>
      </div>
    );
  };

  const hasSheet = sheetHasContent(sheet);

  return (
    <div className="smt-excel-preview">
      <div className="smt-excel-preview__head">
        <strong className="smt-excel-preview__name">
          {fileName || (isPdf ? "PDF plan" : "Weekly plan")}
        </strong>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="smt-excel-preview__link"
            onClick={load}
            disabled={loading}
            style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
          >
            Refresh
          </button>
          {fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="smt-excel-preview__link">
              Open file
            </a>
          ) : null}
        </div>
      </div>

      {note ? <div className="smt-excel-preview__msg">{note}</div> : null}

      {loading ? (
        <div className="smt-excel-preview__msg">
          {isPdf ? "Converting PDF to Excel preview…" : "Loading spreadsheet preview…"}
        </div>
      ) : error ? (
        <div className="smt-excel-preview__msg smt-excel-preview__msg--err">{error}</div>
      ) : !hasSheet ? (
        <div className="smt-excel-preview__msg">
          {fileUrl
            ? isPdf
              ? "Could not convert this PDF into an Excel weekly-plan preview. Open the original PDF instead."
              : "Could not read this file as a spreadsheet."
            : "No weekly plan file attached."}
        </div>
      ) : (
        <>
          <div className="smt-excel-preview__msg" style={{ paddingTop: 0 }}>
            {fromPdf ? "Rebuilt from PDF · " : ""}
            {layoutHint === "half"
              ? "Type 2 · click Pending on 1st/2nd half planning task cells"
              : "Type 1 · click Pending on plan cells"}
          </div>
          <div className="smt-excel-scroll smt-task-scroll">
            <ExcelSheetTable
              matrix={sheet.matrix}
              merges={sheet.merges}
              colWidths={sheet.colWidths}
              renderCell={renderCell}
            />
          </div>
        </>
      )}
    </div>
  );
}
