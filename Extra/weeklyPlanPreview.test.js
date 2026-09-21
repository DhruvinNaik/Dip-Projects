import test from "node:test";
import assert from "node:assert/strict";
import { parseWeeklyPlanMatrix } from "./weeklyPlanExcel.js";
import {
  findPendingTasksForRow,
  findTaskForSheetCell,
  getCellDisplayText,
  getCellStatusText,
  isActionablePlanCell,
  isNoWorkCell,
  isWorkUpdateColumn,
  formatWeekDate,
} from "./weeklyPlanPreview.js";

test("stores task name without mutating the task label with half suffixes", () => {
  const matrix = [
    ["SR NO", "Task", "07 Sep", "08 Sep"],
    ["", "", "1st half", "2nd half", "1st half", "2nd half"],
    ["1", "TO STUDY / FOLLOW UP", "MANPOWER REPORT PHOTOS", "", "SITE CHECK", ""],
  ];

  const parsed = parseWeeklyPlanMatrix(matrix);
  assert.equal(parsed.tasks.length > 0, true);
  assert.equal(parsed.tasks[0].task_name, "TO STUDY / FOLLOW UP");
  assert.equal(parsed.tasks[0].time_slot, "MANPOWER REPORT PHOTOS");
  assert.equal(parsed.tasks[0].half, 1);
  assert.match(parsed.tasks[0].task_date, /^\d{4}-\d{2}-\d{2}$/);
});

test("reads date headers with weekday text, like 07 Sep Monday", () => {
  const date = parseWeeklyPlanMatrix([
    ["SR NO", "Task", "07 Sep Monday", "08 Sep Tuesday"],
    ["", "", "1st half", "2nd half", "1st half", "2nd half"],
    ["1", "TO STUDY / FOLLOW UP", "SITE INSPECTION", "", "REBAR CHECKING", ""],
  ]).tasks[0];

  assert.equal(date?.task_date?.startsWith("20"), true);
  assert.equal(date?.time_slot, "SITE INSPECTION");
});

test("uses the actual task description in the preview cell and keeps status separate", () => {
  const task = {
    time_slot: "Lay slab and cure concrete",
    status: "Completed",
  };

  assert.equal(getCellDisplayText(task), "Lay slab and cure concrete");
  assert.equal(getCellStatusText(task), "Completed");
});

test("matches an Excel cell to the parsed task without renaming the row", () => {
  const tasks = [
    { id: "a", task_name: "TO CALL", time_slot: "REBAR CHECKING", status: "Pending" },
    { id: "b", task_name: "TO STUDY / FOLLOW UP", time_slot: "SITE INSPECTION", status: "Pending" },
  ];

  const matched = findTaskForSheetCell(tasks, {
    cellText: "SITE INSPECTION",
    rowTaskName: "TO STUDY / FOLLOW UP",
  });

  assert.equal(matched?.id, "b");
  assert.equal(findTaskForSheetCell(tasks, { cellText: "" }), null);
});

test("finds pending tasks for a clicked task/site row", () => {
  const tasks = [
    { id: "1", task_name: "TO CALL", time_slot: "A", status: "Pending" },
    { id: "2", task_name: "TO CALL", time_slot: "B", status: "Completed" },
    { id: "3", task_name: "OTHER", time_slot: "C", status: "Pending" },
  ];
  const pending = findPendingTasksForRow(tasks, "TO CALL");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, "1");
});

test("type 1 parses daywise time cells as tasks (not skipped as time headers)", () => {
  const matrix = [
    ["SR NO", "SITE NAME", "07-Sep-2026", "08-Sep-2026"],
    ["", "", "MONDAY", "TUESDAY"],
    ["", "", "9-00 AM TO 7-30 PM", "9-00 AM TO 7-30 PM"],
    [
      "1",
      "SITE WORK BUILDING /AGENCY/ACTIVITY VISE (AS PER SITE ENGINEER PLANNING)",
      "9-00 AM TO 11-00 AM",
      "11-00 AM TO 1-00 PM",
    ],
    ["2", "TENDER/COMPARISION/WORKSHEET WORK", "11-00 AM TO 1-00 PM", "2-00 PM TO 4-00 PM"],
  ];

  const parsed = parseWeeklyPlanMatrix(matrix);
  assert.equal(parsed.tasks.length >= 4, true);
  assert.equal(
    parsed.tasks.some(
      (t) =>
        t.task_name.includes("SITE WORK BUILDING") && t.time_slot.includes("9-00 AM TO 11-00 AM")
    ),
    true
  );
  assert.equal(
    parsed.tasks.some(
      (t) => t.task_name.includes("TENDER") && t.time_slot.includes("2-00 PM TO 4-00 PM")
    ),
    true
  );
});

test("type 1 shows Pending only on daywise time data cells, not headers or site name", () => {
  const matrix = [
    [
      { display: "SR NO" },
      { display: "DATE" },
      { display: "07-Sep-2026" },
      { display: "08-Sep-2026" },
    ],
    [
      { display: "" },
      { display: "DAYS" },
      { display: "MONDAY" },
      { display: "TUESDAY" },
    ],
    [
      { display: "" },
      { display: "TIME" },
      { display: "9-00 AM TO 7-30 PM" },
      { display: "9-00 AM TO 7-30 PM" },
    ],
    [
      { display: "1" },
      { display: "SITE WORK BUILDING /AGENCY/ACTIVITY VISE (AS PER SITE ENGINEER PLANNING)" },
      { display: "9-00 AM TO 11-00 AM" },
      { display: "11-00 AM TO 1-00 PM" },
    ],
    [
      { display: "2" },
      { display: "TENDER/COMPARISION/WORKSHEET WORK" },
      { display: "11-00 AM TO 1-00 PM" },
      { display: "2-00 PM TO 4-00 PM" },
    ],
  ];

  assert.equal(isActionablePlanCell(matrix, 2, 2, "9-00 AM TO 7-30 PM"), false);
  assert.equal(
    isActionablePlanCell(
      matrix,
      3,
      1,
      "SITE WORK BUILDING /AGENCY/ACTIVITY VISE (AS PER SITE ENGINEER PLANNING)"
    ),
    false
  );
  assert.equal(isActionablePlanCell(matrix, 3, 2, "9-00 AM TO 11-00 AM"), true);
  assert.equal(isActionablePlanCell(matrix, 3, 3, "11-00 AM TO 1-00 PM"), true);
  assert.equal(isActionablePlanCell(matrix, 4, 2, "11-00 AM TO 1-00 PM"), true);
});

test("does not make empty or no-work cells actionable", () => {
  const matrix = [
    ["SR NO", "SITE NAME", "07-Sep-2026", "08-Sep-2026"],
    ["1", "TO STUDY / FOLLOW UP", "-", "ON LEAVE"],
  ];

  for (const value of ["", "-", "—", "OFF", "ON LEAVE", "NO WORK", "N/A", "HOLIDAY"]) {
    assert.equal(isNoWorkCell(value), true, value);
    assert.equal(isActionablePlanCell(matrix, 1, 2, value), false, value);
  }
  assert.equal(isActionablePlanCell(matrix, 1, 2, "SITE INSPECTION"), true);
});

test("does not make work update columns actionable", () => {
  const matrix = [
    ["SR NO", "SITE NAME", "DAYS PLANNING", "WORK UPDATE"],
    ["1", "GREENFIELD RESIDENCY", "EXCAVATION", "COMPLETED"],
  ];

  assert.equal(isWorkUpdateColumn(matrix, 3), true);
  assert.equal(isActionablePlanCell(matrix, 1, 2, "EXCAVATION"), true);
  assert.equal(isActionablePlanCell(matrix, 1, 3, "COMPLETED"), false);
});

test("does not bleed Pending/Completed across days with the same time slot", () => {
  const matrix = [
    [
      { display: "SR NO" },
      { display: "DATE" },
      { display: "07-Sep-2026" },
      { display: "08-Sep-2026" },
      { display: "09-Sep-2026" },
    ],
    [
      { display: "" },
      { display: "DAYS" },
      { display: "MONDAY" },
      { display: "TUESDAY" },
      { display: "WEDNESDAY" },
    ],
    [
      { display: "1" },
      { display: "SITE WORK BUILDING" },
      { display: "9-00 AM TO 11-00 AM" },
      { display: "9-00 AM TO 11-00 AM" },
      { display: "9-00 AM TO 11-00 AM" },
    ],
  ];

  const tasks = [
    {
      id: "mon",
      sr_no: 1,
      task_name: "SITE WORK BUILDING",
      time_slot: "9-00 AM TO 11-00 AM",
      task_date: "2026-09-07",
      status: "Completed",
    },
    {
      id: "tue",
      sr_no: 1,
      task_name: "SITE WORK BUILDING",
      time_slot: "9-00 AM TO 11-00 AM",
      task_date: "2026-09-08T00:00:00.000Z",
      status: "Pending",
    },
    {
      id: "wed",
      sr_no: 1,
      task_name: "SITE WORK BUILDING",
      time_slot: "9-00 AM TO 11-00 AM",
      task_date: "2026-09-09",
      status: "Pending",
    },
  ];

  const mon = findTaskForSheetCell(tasks, {
    cellText: "9-00 AM TO 11-00 AM",
    rowTaskName: "SITE WORK BUILDING",
    colIdx: 2,
    rowIdx: 2,
    matrix,
  });
  const tue = findTaskForSheetCell(tasks, {
    cellText: "9-00 AM TO 11-00 AM",
    rowTaskName: "SITE WORK BUILDING",
    colIdx: 3,
    rowIdx: 2,
    matrix,
  });
  const wed = findTaskForSheetCell(tasks, {
    cellText: "9-00 AM TO 11-00 AM",
    rowTaskName: "SITE WORK BUILDING",
    colIdx: 4,
    rowIdx: 2,
    matrix,
  });

  assert.equal(mon?.id, "mon");
  assert.equal(tue?.id, "tue");
  assert.equal(wed?.id, "wed");
  assert.equal(getCellStatusText(mon), "Completed");
  assert.equal(getCellStatusText(tue), "Pending");
  assert.equal(getCellStatusText(wed), "Pending");
});

test("matches half-layout cells by date + half, not neighbor columns", () => {
  const matrix = [
    ["SR NO", "Task", "07 Sep 2026", "", "08 Sep 2026", ""],
    ["", "", "1st half", "2nd half", "1st half", "2nd half"],
    ["1", "TO STUDY / FOLLOW UP", "SITE INSPECTION", "CONTRACTOR MEETING", "REBAR CHECK", "PHOTOS"],
  ];

  const tasks = [
    {
      id: "d1h1",
      sr_no: 1,
      task_name: "TO STUDY / FOLLOW UP",
      time_slot: "SITE INSPECTION",
      task_date: "2026-09-07",
      half: 1,
      status: "Completed",
    },
    {
      id: "d1h2",
      sr_no: 1,
      task_name: "TO STUDY / FOLLOW UP",
      time_slot: "CONTRACTOR MEETING",
      task_date: "2026-09-07",
      half: 2,
      status: "Pending",
    },
    {
      id: "d2h1",
      sr_no: 1,
      task_name: "TO STUDY / FOLLOW UP",
      time_slot: "REBAR CHECK",
      task_date: "2026-09-08",
      half: 1,
      status: "Pending",
    },
  ];

  assert.equal(
    findTaskForSheetCell(tasks, {
      cellText: "SITE INSPECTION",
      rowTaskName: "TO STUDY / FOLLOW UP",
      colIdx: 2,
      rowIdx: 2,
      matrix,
    })?.id,
    "d1h1"
  );
  assert.equal(
    findTaskForSheetCell(tasks, {
      cellText: "CONTRACTOR MEETING",
      rowTaskName: "TO STUDY / FOLLOW UP",
      colIdx: 3,
      rowIdx: 2,
      matrix,
    })?.id,
    "d1h2"
  );
  assert.equal(
    findTaskForSheetCell(tasks, {
      cellText: "REBAR CHECK",
      rowTaskName: "TO STUDY / FOLLOW UP",
      colIdx: 4,
      rowIdx: 2,
      matrix,
    })?.id,
    "d2h1"
  );
});

test("type 2 never puts Pending on TIME header timing cells, only planning task data", () => {
  const matrix = [
    [
      { display: "SR NO" },
      { display: "DATE" },
      { display: "07-Sep-2026" },
      { display: "" },
    ],
    [
      { display: "" },
      { display: "DAYS" },
      { display: "MONDAY" },
      { display: "" },
    ],
    [
      { display: "" },
      { display: "TIME" },
      { display: "9-00 AM TO 1-00 PM" },
      { display: "2-00 PM TO 7-30 PM" },
    ],
    [
      { display: "" },
      { display: "SITE NAME" },
      { display: "1ST HALF PLANNING" },
      { display: "2ND HALF PLANNING" },
    ],
    [
      { display: "1" },
      { display: "TO STUDY / FOLLOW UP" },
      { display: "SITE INSPECTION - FOUNDATION WORK" },
      { display: "CONTRACTOR COORDINATION MEETING" },
    ],
  ];

  assert.equal(isActionablePlanCell(matrix, 2, 2, "9-00 AM TO 1-00 PM"), false);
  assert.equal(isActionablePlanCell(matrix, 2, 3, "2-00 PM TO 7-30 PM"), false);
  assert.equal(isActionablePlanCell(matrix, 3, 2, "1ST HALF PLANNING"), false);
  assert.equal(isActionablePlanCell(matrix, 4, 1, "TO STUDY / FOLLOW UP"), false);
  assert.equal(isActionablePlanCell(matrix, 4, 2, "SITE INSPECTION - FOUNDATION WORK"), true);
  assert.equal(isActionablePlanCell(matrix, 4, 3, "CONTRACTOR COORDINATION MEETING"), true);
});

test("keeps the daily planning layout without exposing work update columns", () => {
  const matrix = [
    ["", "", "07 Sep 2026", "", "08 Sep 2026", ""],
    ["", "", "DAYS PLANNING", "WORK UPDATE", "DAYS PLANNING", "WORK UPDATE"],
    ["1", "TO STUDY / FOLLOW UP", "SITE INSPECTION / FOUNDATION WORK", "COMPLETED", "BARCUTTING", ""],
  ];

  const parsed = parseWeeklyPlanMatrix(matrix);
  assert.equal(parsed.meta.halves, false);
  assert.equal(parsed.tasks.length >= 2, true);
  assert.equal(parsed.tasks.some((task) => task.task_name === "TO STUDY / FOLLOW UP"), true);
  assert.equal(parsed.tasks.some((task) => task.time_slot === "SITE INSPECTION"), true);
  assert.equal(parsed.tasks.some((task) => task.time_slot === "FOUNDATION WORK"), true);
});

test("uses the actual half-column header positions when the date cells are offset from task cells", () => {
  const matrix = [
    ["", "", "DATE", "", "07-Sep-2026", "", "08-Sep-2026"],
    ["", "", "DAYS", "", "MONDAY", "", "TUESDAY"],
    ["", "", "TIME", "", "9-00 AM TO 1-00 PM", "", "9-00 AM TO 7-00 PM"],
    ["SR NO", "SITE NAME", "1ST HALF PLANNING", "2ND HALF PLANNING", "1ST HALF PLANNING", "2ND HALF PLANNING"],
    ["1", "TO STUDY / FOLLOW UP", "SITE INSPECTION - FOUNDATION WORK", "CONTRACTOR COORDINATION MEETING", "", ""],
    ["2", "TO CALL", "REBAR CHECKING - COLUMN", "", "2nd half task", ""],
  ];

  const parsed = parseWeeklyPlanMatrix(matrix);
  assert.equal(parsed.tasks.length > 0, true);
  assert.equal(parsed.tasks.some((task) => task.time_slot === "SITE INSPECTION - FOUNDATION WORK"), true);
  assert.equal(parsed.tasks.some((task) => task.time_slot === "CONTRACTOR COORDINATION MEETING"), true);
});

test("still finds half headers when they are a few rows below the date row", () => {
  const matrix = [
    ["", "", "07-Sep-2026", "", "08-Sep-2026", ""],
    ["", "", "MONDAY", "", "TUESDAY", ""],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["", "", "1ST HALF PLANNING", "2ND HALF PLANNING", "1ST HALF PLANNING", "2ND HALF PLANNING"],
    ["1", "TO STUDY / FOLLOW UP", "SITE INSPECTION", "CONTRACTOR COORDINATION", "", ""],
    ["2", "TO CALL", "REBAR CHECKING", "", "2nd half task", ""],
  ];

  const parsed = parseWeeklyPlanMatrix(matrix);
  assert.equal(parsed.meta.halves, true);
  assert.equal(parsed.tasks.some((task) => task.half === 2), true);
  assert.equal(parsed.tasks.some((task) => task.time_slot === "CONTRACTOR COORDINATION"), true);
});

test("PDF wrapped lines merge so work cells become actionable tasks", async () => {
  const { consolidateWrappedRows, matrixToPreviewSheet } = await import("./weeklyPlanPdf.js");
  const matrix = [
    ["SR NO", "SITE NAME", "07-Sep-2026", "08-Sep-2026"],
    ["", "DAYS", "MONDAY", "TUESDAY"],
    ["", "TIME", "9-00 AM TO 7-30 PM", "9-00 AM TO 7-30 PM"],
    ["1", "GREENFIELD RESIDENCY - TOWER A", "EXCAVATION &", "COLUMN CASTING"],
    ["", "", "FOUNDATION LAYOUT", ""],
    ["2", "SUNRISE HEIGHTS PHASE 2", "PLASTERING WORK", "TILE WORK"],
  ];
  const fixed = consolidateWrappedRows(matrix);
  assert.equal(fixed[3][2], "EXCAVATION & FOUNDATION LAYOUT");
  const parsed = parseWeeklyPlanMatrix(fixed);
  assert.equal(parsed.tasks.length, 4);
  const sheet = matrixToPreviewSheet(fixed);
  assert.equal(
    isActionablePlanCell(sheet.matrix, 3, 2, "EXCAVATION & FOUNDATION LAYOUT"),
    true
  );
  assert.match(String(sheet.matrix[0][2].bg || ""), /^#/i);
});

test("builds a clean weekly sheet with all day columns and styled headers", async () => {
  const { buildCleanWeeklyPlanSheet } = await import("./weeklyPlanPdf.js");
  const days = [
    { ymd: "2026-09-07", label: "07-Sep-2026", weekday: "MONDAY" },
    { ymd: "2026-09-08", label: "08-Sep-2026", weekday: "TUESDAY" },
    { ymd: "2026-09-09", label: "09-Sep-2026", weekday: "WEDNESDAY" },
    { ymd: "2026-09-10", label: "10-Sep-2026", weekday: "THURSDAY" },
    { ymd: "2026-09-11", label: "11-Sep-2026", weekday: "FRIDAY" },
    { ymd: "2026-09-12", label: "12-Sep-2026", weekday: "SATURDAY" },
    { ymd: "2026-09-13", label: "13-Sep-2026", weekday: "SUNDAY" },
  ];
  const sheet = buildCleanWeeklyPlanSheet({
    title: "WEEKLY WORK UPDATE PLAN",
    days,
    times: days.map(() => "9-00 AM TO 7-30 PM"),
    sites: [
      {
        sr: 1,
        name: "GREENFIELD RESIDENCY - TOWER A",
        cells: ["EXCAVATION & FOUNDATION LAYOUT", "COLUMN CASTING", "", "", "", "", ""],
      },
    ],
  });
  assert.equal(sheet.matrix[1][1].display, "DATE");
  assert.equal(sheet.matrix[1].length, 9);
  assert.equal(sheet.matrix[1][8].display, "13-Sep-2026");
  assert.equal(sheet.matrix[1][2].bg, "#FFF2CC");
  assert.equal(sheet.matrix[5][1].display, "GREENFIELD RESIDENCY - TOWER A");
  assert.equal(isActionablePlanCell(sheet.matrix, 5, 2, "EXCAVATION & FOUNDATION LAYOUT"), true);
  const parsed = parseWeeklyPlanMatrix(
    sheet.matrix.map((row) => row.map((c) => c.display))
  );
  assert.ok(parsed.tasks.length >= 2);
});
