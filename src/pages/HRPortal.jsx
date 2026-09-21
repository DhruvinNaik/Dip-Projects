import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../supabase";
import Navbar from "../components/Navbar";
import PortalFloaters from "../components/PortalFloaters";
import "./HRPortal.css";

const MENU = [
  { label: "Overview", icon: "grid", section: "Main", color: "#be3d3d" },
  { label: "Employees", icon: "users", section: "Main", color: "#2563eb" },
  { label: "Attendance Register", icon: "calendar", section: "Main", color: "#2563eb" },
  { label: "Leave Records", icon: "leave", section: "HR Management", color: "#7c3aed" },
  { label: "Leave Tracker", icon: "tracker", section: "HR Management", color: "#7c3aed" },
  { label: "Expenses", icon: "money", section: "HR Management", color: "#d97706" },
  { label: "Assets", icon: "briefcase", section: "Assets & More", color: "#0f766e" },
  { label: "Insurance", icon: "shield", section: "Assets & More", color: "#0f766e" },
  { label: "Documents", icon: "folder", section: "Assets & More", color: "#d97706" },
  { label: "Birthdays", icon: "gift", section: "Assets & More", color: "#db2777" },
  { label: "New Recruitment", icon: "user-plus", section: "Recruitment", color: "#ea580c" },
  { label: "Salary Slip", icon: "wallet", section: "Recruitment", color: "#16a34a" },
];

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const DAY_ABBR = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtAttTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function getMonthDays(year, month) {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month - 1, day);
    return {
      day,
      key: `${year}-${pad2(month)}-${pad2(day)}`,
      weekday: DAY_ABBR[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

function statusForDay(record) {
  if (!record?.clock_in) return "A";
  if (String(record.clock_in_status || "").toLowerCase() === "late") return "L";
  return "P";
}
function Icon({ name, size = 18 }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.6-3 2.5-5 6-5s5.4 2 6 5" />
        <path d="M15 5.2a3 3 0 0 1 0 5.6M17 15c2.3.4 3.5 2 4 4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </>
    ),
    leave: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 14h8M8 18h5" />
      </>
    ),
    tracker: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2M5.5 5.5l-1.8-1.8M18.5 5.5l1.8-1.8" />
      </>
    ),
    money: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9.5c-.5-.7-1.5-1.2-3-1.2-1.7 0-2.8.8-2.8 1.9 0 2.9 5.8 1.1 5.8 4 0 1.2-1.2 2-3 2-1.4 0-2.5-.4-3.1-1.2M12 6.5v11" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    folder: (
      <>
        <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </>
    ),
    gift: (
      <>
        <rect x="3" y="9" width="18" height="12" rx="2" />
        <path d="M12 9v12M3 13h18M12 9H8.5a2.5 2.5 0 1 1 2.5-2.5V9ZM12 9h3.5a2.5 2.5 0 1 0-2.5-2.5V9Z" />
      </>
    ),
    "user-plus": (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.6-3 2.5-5 6-5s5.4 2 6 5M19 11v6M16 14h6" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v11H6.5A2.5 2.5 0 0 1 4 15.5z" />
        <path d="M4 8h17M16 13h3" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 5 5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    "check-circle": (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    "calendar-off": (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M9 15l4 4m0-4-4 4" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </>
    ),
  };
  return (
    <svg
      className="hr-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDays() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: localDateKey(date),
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
    };
  });
}

function initialsFor(name) {
  return String(name || "NA")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function getFiscalYearStart(date = new Date()) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function getFiscalMonths(startYear) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (index + 3) % 12;
    const year = startYear + (index < 9 ? 0 : 1);
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return {
      key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("en-IN", { month: "short" }),
      year,
      start: localDateKey(start),
      end: localDateKey(end),
    };
  });
}

function countLeaveDaysInMonth(fromDate, toDate, month) {
  if (!fromDate || !toDate) return 0;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const monthStart = new Date(`${month.start}T00:00:00`);
  const monthEnd = new Date(`${month.end}T00:00:00`);
  const overlapStart = from > monthStart ? from : monthStart;
  const overlapEnd = to < monthEnd ? to : monthEnd;
  if (overlapStart > overlapEnd) return 0;
  return Math.floor((overlapEnd - overlapStart) / 86400000) + 1;
}

function statusForEmployee(employee, attendanceByUser, leaveUsernames) {
  if (leaveUsernames.has(employee.username))
    return { label: "On leave", color: "orange" };
  if (attendanceByUser.has(employee.username))
    return { label: "Present", color: "green" };
  return { label: "Absent", color: "violet" };
}

export default function HRPortal() {
  const [user, setUser] = useState(null);
  const [activeItem, setActiveItem] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window === "undefined" ? true : window.innerWidth > 760),
  );
  const [hoveredNavKey, setHoveredNavKey] = useState(null);
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");

  const [employeeStats, setEmployeeStats] = useState(null);
  const [employeeStatsLoading, setEmployeeStatsLoading] = useState(false);
  const [employeeStatsError, setEmployeeStatsError] = useState("");
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [leaveRecordsLoading, setLeaveRecordsLoading] = useState(false);
  const [leaveRecordsError, setLeaveRecordsError] = useState("");
  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [leaveTrackerRecords, setLeaveTrackerRecords] = useState([]);
  const [leaveTrackerLoading, setLeaveTrackerLoading] = useState(false);
  const [leaveTrackerError, setLeaveTrackerError] = useState("");
  const [trackerYearStart, setTrackerYearStart] = useState(getFiscalYearStart());
  const [registerYear, setRegisterYear] = useState(() => new Date().getFullYear());
  const [registerMonth, setRegisterMonth] = useState(() => new Date().getMonth() + 1);
  const [registerDays, setRegisterDays] = useState(() => {
    const d = new Date();
    return getMonthDays(d.getFullYear(), d.getMonth() + 1);
  });
  const [registerRows, setRegisterRows] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerLoaded, setRegisterLoaded] = useState(false);

  useEffect(() => setUser(getStoredUser()), []);

  useEffect(() => {
    if (
      !user ||
      activeItem !== "Employees" ||
      employeeStats
    )
      return;
    let cancelled = false;

    async function loadEmployeeStats() {
  setEmployeeStatsLoading(true);
  setEmployeeStatsError("");
  const [attendanceResult, leavesResult] = await Promise.all([
    supabase.from("attendance").select("user_name, clock_in, clock_in_status"),
    supabase.from("leaves").select("user_name, from_date, to_date, status"),
  ]);

  const firstError = attendanceResult.error || leavesResult.error;
  if (firstError) {
    if (!cancelled) setEmployeeStatsError(firstError.message || "Could not load employee stats.");
    if (!cancelled) setEmployeeStatsLoading(false);
    return;
  }

  const stats = new Map();
  const ensure = (key) => {
    const normalizedKey = normalizeUsername(key);
    if (!normalizedKey) return null;
    if (!stats.has(normalizedKey)) stats.set(normalizedKey, { present: 0, late: 0, leave: 0 });
    return stats.get(normalizedKey);
  };

  (attendanceResult.data || []).forEach((row) => {
        if (!row.clock_in || !row.user_name) return;
        const bucket = ensure(row.user_name);
        if (!bucket) return;
        if (String(row.clock_in_status || "").toLowerCase() === "late")
          bucket.late += 1;
        else bucket.present += 1;
      });

      (leavesResult.data || []).forEach((row) => {
        if (
          !row.user_name ||
          !["approved", "pending"].includes(String(row.status || "").trim().toLowerCase())
        )
          return;
        const bucket = ensure(row.user_name);
        if (!bucket) return;
        const todayKey = localDateKey(new Date());
        if (!row.from_date || !row.to_date || (row.from_date <= todayKey && row.to_date >= todayKey)) bucket.leave += 1;
      });

      if (!cancelled) {
        setEmployeeStats(stats);
        setEmployeeStatsLoading(false);
      }
    }

    loadEmployeeStats();
    return () => {
      cancelled = true;
    };
  }, [user, activeItem, employeeStats]);

  async function loadAttendanceRegister(year = registerYear, month = registerMonth) {
    setRegisterLoading(true);
    setRegisterError("");
    const days = getMonthDays(year, month);
    const from = days[0]?.key;
    const to = days[days.length - 1]?.key;
    setRegisterDays(days);

    const [usersResult, attendanceResult] = await Promise.all([
      supabase.from("user_details").select("username, name").order("name"),
      supabase
        .from("attendance")
        .select("user_name, name, date, clock_in, clock_out, clock_in_status")
        .gte("date", from)
        .lte("date", to),
    ]);

    if (usersResult.error || attendanceResult.error) {
      setRegisterError(
        (usersResult.error || attendanceResult.error).message ||
          "Could not load attendance register.",
      );
      setRegisterLoading(false);
      return;
    }

    const byUser = new Map();
    (usersResult.data || []).forEach((employee) => {
      const username = employee.username;
      const key = normalizeUsername(username);
      if (!key) return;
      byUser.set(key, {
        username,
        name: employee.name || username || "Unnamed employee",
        days: {},
        present: 0,
        late: 0,
        absent: 0,
      });
    });

    (attendanceResult.data || []).forEach((row) => {
      const key = normalizeUsername(row.user_name);
      if (!key || !row.date) return;
      if (!byUser.has(key)) {
        byUser.set(key, {
          username: row.user_name,
          name: row.name || row.user_name || "Unnamed employee",
          days: {},
          present: 0,
          late: 0,
          absent: 0,
        });
      }
      const bucket = byUser.get(key);
      if (!bucket.name && row.name) bucket.name = row.name;
      bucket.days[row.date] = {
        status: statusForDay(row),
        clockIn: fmtAttTime(row.clock_in),
        clockOut: fmtAttTime(row.clock_out),
        clockInRaw: row.clock_in,
        clockOutRaw: row.clock_out,
      };
    });

    const rows = [...byUser.values()]
      .map((employee) => {
        let present = 0;
        let late = 0;
        let absent = 0;
        days.forEach((day) => {
          const cell = employee.days[day.key];
          const status = cell?.status || "A";
          if (status === "P") present += 1;
          else if (status === "L") late += 1;
          else absent += 1;
          if (!cell) {
            employee.days[day.key] = {
              status: "A",
              clockIn: "",
              clockOut: "",
            };
          }
        });
        return { ...employee, present, late, absent };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setRegisterRows(rows);
    setRegisterLoaded(true);
    setRegisterLoading(false);
  }

  function downloadRegisterPdf() {
    if (!registerRows.length || !registerDays.length) return;
    const monthLabel =
      MONTH_OPTIONS.find((m) => m.value === registerMonth)?.label || registerMonth;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(`Attendance Register — ${monthLabel} ${registerYear}`, 40, 36);

    const dayCount = registerDays.length;
    const head = [
      [
        "Employee",
        ...registerDays.map((d) => `${d.day}\n${d.weekday}`),
        "P",
        "L",
        "A",
      ],
    ];
    const body = registerRows.map((row) => [
      row.name,
      ...registerDays.map((day) => {
        const cell = row.days[day.key] || { status: "A" };
        const lines = [cell.status || "A"];
        if (cell.clockIn) lines.push(`In ${cell.clockIn}`);
        if (cell.clockOut) lines.push(`Out ${cell.clockOut}`);
        return lines.join("\n");
      }),
      String(row.present),
      String(row.late),
      String(row.absent),
    ]);

    const statusStyles = {
      P: { fillColor: [219, 234, 254], textColor: [29, 78, 216] },
      L: { fillColor: [254, 243, 199], textColor: [180, 83, 9] },
      A: { fillColor: [254, 226, 226], textColor: [185, 28, 28] },
    };

    const dayColWidth = Math.max(28, Math.min(42, (780 - 100) / Math.max(dayCount, 1)));

    autoTable(doc, {
      head,
      body,
      startY: 48,
      styles: {
        fontSize: 5.5,
        cellPadding: 1.5,
        halign: "center",
        valign: "middle",
        lineColor: [203, 213, 225],
        lineWidth: 0.3,
        overflow: "linebreak",
        minCellHeight: 22,
      },
      headStyles: {
        fillColor: [203, 213, 225],
        textColor: [15, 23, 42],
        fontSize: 5.5,
        fontStyle: "bold",
        minCellHeight: 16,
      },
      columnStyles: {
        0: {
          halign: "left",
          cellWidth: 88,
          fillColor: [226, 232, 240],
          textColor: [15, 23, 42],
          fontSize: 5.5,
        },
        ...Object.fromEntries(
          registerDays.map((_, index) => [
            index + 1,
            { cellWidth: dayColWidth, fontSize: 5 },
          ]),
        ),
        [dayCount + 1]: { cellWidth: 18, fontStyle: "bold" },
        [dayCount + 2]: { cellWidth: 18, fontStyle: "bold" },
        [dayCount + 3]: { cellWidth: 18, fontStyle: "bold" },
      },
      didParseCell(data) {
        const col = data.column.index;
        if (data.section === "head") {
          if (col === dayCount + 1) {
            data.cell.styles.fillColor = [22, 163, 74];
          } else if (col === dayCount + 2) {
            data.cell.styles.fillColor = [217, 119, 6];
          } else if (col === dayCount + 3) {
            data.cell.styles.fillColor = [220, 38, 38];
          } else if (col > 0 && col <= dayCount) {
            const day = registerDays[col - 1];
            if (day?.isWeekend) {
              data.cell.styles.fillColor = [196, 181, 253];
              data.cell.styles.textColor = [76, 29, 149];
            } else {
              data.cell.styles.fillColor = [191, 219, 254];
              data.cell.styles.textColor = [30, 58, 138];
            }
          }
          return;
        }

        if (data.section !== "body") return;

        if (col > 0 && col <= dayCount) {
          const day = registerDays[col - 1];
          const row = registerRows[data.row.index];
          const status = row?.days?.[day.key]?.status || "A";
          const style = statusStyles[status] || statusStyles.A;
          data.cell.styles.fillColor = style.fillColor;
          data.cell.styles.textColor = style.textColor;
          data.cell.styles.fontStyle = "bold";
        } else if (col === dayCount + 1) {
          data.cell.styles.fillColor = [240, 253, 244];
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        } else if (col === dayCount + 2) {
          data.cell.styles.fillColor = [255, 251, 235];
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = "bold";
        } else if (col === dayCount + 3) {
          data.cell.styles.fillColor = [254, 242, 242];
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    doc.save(`attendance-register-${registerYear}-${pad2(registerMonth)}.pdf`);
  }

  useEffect(() => {
    if (!user || activeItem !== "Attendance Register" || registerLoaded) return;
    loadAttendanceRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeItem, registerLoaded]);

  useEffect(() => {
    if (!user || activeItem !== "Leave Records") return;
    let cancelled = false;

    async function loadLeaveRecords() {
      setLeaveRecordsLoading(true);
      setLeaveRecordsError("");
      const { data, error } = await supabase
        .from("leaves")
        .select("id, user_name, name, leave_type, from_date, to_date, reason, created_at, status")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setLeaveRecordsError(error.message || "Could not load leave records.");
        setLeaveRecords([]);
      } else {
        setLeaveRecords(data || []);
      }
      setLeaveRecordsLoading(false);
    }

    loadLeaveRecords();
    return () => { cancelled = true; };
  }, [user, activeItem]);

  useEffect(() => {
    if (!user || activeItem !== "Leave Tracker") return;
    let cancelled = false;
    async function loadLeaveTracker() {
      setLeaveTrackerLoading(true);
      setLeaveTrackerError("");
      const months = getFiscalMonths(trackerYearStart);
      const { data, error } = await supabase
        .from("leaves")
        .select("id, user_name, name, from_date, to_date, status")
        .lte("from_date", months[months.length - 1].end)
        .gte("to_date", months[0].start)
        .order("from_date", { ascending: true });
      if (cancelled) return;
      if (error) {
        setLeaveTrackerError(error.message || "Could not load leave tracker data.");
        setLeaveTrackerRecords([]);
      } else {
        setLeaveTrackerRecords(data || []);
      }
      setLeaveTrackerLoading(false);
    }
    loadLeaveTracker();
    return () => { cancelled = true; };
  }, [user, activeItem, trackerYearStart]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadOverview() {
      setOverviewError("");
      const weekDays = getWeekDays();
      const todayKey = localDateKey(new Date());
      const [usersResult, attendanceResult, leavesResult] = await Promise.all([
        supabase
          .from("user_details")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("attendance")
          .select("user_name, name, date, clock_in, clock_out, clock_in_status")
          .gte("date", weekDays[0].key)
          .lte("date", weekDays[4].key),
        supabase
          .from("leaves")
          .select(
            "user_name, name, leave_type, from_date, to_date, status, created_at",
          )
          .eq("status", "Pending")
          .order("created_at", { ascending: false }),
      ]);

      const firstError =
        usersResult.error || attendanceResult.error || leavesResult.error;
      if (firstError) {
        if (!cancelled)
          setOverviewError(firstError.message || "Could not load HR data.");
        return;
      }

      const users = usersResult.data || [];
      const attendance = attendanceResult.data || [];
      const pendingLeaves = leavesResult.data || [];
      const attendanceToday = attendance.filter(
        (row) => row.date === todayKey && row.clock_in,
      );
      const attendanceByUser = new Map(
        attendanceToday.map((row) => [row.user_name, row]),
      );
      const leaveUsernames = new Set(
        pendingLeaves
          .filter((row) => row.from_date <= todayKey && row.to_date >= todayKey)
          .map((row) => row.user_name),
      );
      const attendanceDays = weekDays.map((day) => {
        const rows = attendance.filter((row) => row.date === day.key);
        const present = rows.filter((row) => row.clock_in).length;
        const remote = rows.filter(
          (row) => row.clock_in && !row.clock_out,
        ).length;
        return { ...day, present, remote, total: users.length };
      });
      const people = users.slice(0, 4).map((employee, index) => {
        const username = employee.username || employee.user_name;
        const status = statusForEmployee(
          { ...employee, username },
          attendanceByUser,
          leaveUsernames,
        );
        return {
          name: employee.name || username || "Unnamed employee",
          role:
            employee.role ||
            employee.designation ||
            employee.department ||
            "Employee",
          ...status,
          initials: initialsFor(employee.name || username),
          color: index === 0 ? "blue" : status.color,
        };
      });

      if (!cancelled)
        setOverview({
          users,
          attendance,
          attendanceToday,
          pendingLeaves,
          attendanceDays,
          people,
          weekDays,
        });
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const firstName = user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
  const totalEmployees = overview?.users.length || 0;
  const presentToday = overview?.attendanceToday.length || 0;
  const presentRate = totalEmployees
    ? Math.round((presentToday / totalEmployees) * 100)
    : 0;
  const livePeople = overview?.people || [];
  const pendingLeaves = overview?.pendingLeaves || [];
  const attendanceDays = overview?.attendanceDays || [];
  const selectItem = (label) => {
    setActiveItem(label);
    if (typeof window !== "undefined" && window.innerWidth <= 760) {
      setSidebarOpen(false);
    }
  };

  const employeeList = (overview?.users || []).filter((employee) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const dept =
      employee.department || employee.designation || employee.role || "";
    return (
      (employee.name || "").toLowerCase().includes(q) ||
      dept.toLowerCase().includes(q)
    );
  });

  const filteredLeaveRecords = leaveRecords.filter((leave) => {
    const query = leaveSearch.trim().toLowerCase();
    const name = String(leave.name || leave.user_name || "").toLowerCase();
    const status = String(leave.status || "").trim().toLowerCase();
    const matchesSearch = !query || name.includes(query);
    const matchesStatus = leaveStatusFilter === "all" || status === leaveStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const trackerMonths = getFiscalMonths(trackerYearStart);
  const trackerEmployees = new Map();
  (overview?.users || []).forEach((employee) => {
    const username = employee.username || employee.user_name;
    const key = normalizeUsername(username || employee.name);
    if (key) trackerEmployees.set(key, { name: employee.name || username || "Unnamed employee", username });
  });
  leaveTrackerRecords.forEach((leave) => {
    const username = leave.user_name || leave.name;
    const key = normalizeUsername(username);
    if (key && !trackerEmployees.has(key)) trackerEmployees.set(key, { name: leave.name || username || "Unnamed employee", username });
  });
  const trackerRows = [...trackerEmployees.entries()]
    .map(([key, employee]) => {
      const approvedLeaves = leaveTrackerRecords.filter((leave) => normalizeUsername(leave.user_name || leave.name) === key && String(leave.status || "").trim().toLowerCase() === "approved");
      const months = trackerMonths.map((month) => approvedLeaves.reduce((total, leave) => total + countLeaveDaysInMonth(leave.from_date, leave.to_date, month), 0));
      return { ...employee, months, used: months.reduce((total, value) => total + value, 0), balance: Math.max(0, 60 - months.reduce((total, value) => total + value, 0)) };
    })
    .filter((row) => !leaveSearch.trim() || row.name.toLowerCase().includes(leaveSearch.trim().toLowerCase()) || String(row.username || "").toLowerCase().includes(leaveSearch.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 760) setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!user)
    return (
      <div className="hr-loading">
        <span className="hr-loading-dot" />
        Preparing your workspace...
      </div>
    );

  return (
    <div className="hr-root">
      <Navbar
        onMenuToggle={() => setSidebarOpen((open) => !open)}
        menuOpen={sidebarOpen}
      />
      <div className="hr-body">
        {sidebarOpen && (
          <button
            className="hr-sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`hr-sidebar${sidebarOpen ? "" : " collapsed"}`}>
          <div className="hr-sidebar-header">
            <button
              className="hr-sidebar-close"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <nav className="hr-nav" aria-label="HR portal navigation">
            {MENU.map((item, index) => {
              const showSection =
                index === 0 || item.section !== MENU[index - 1].section;
              const isActive = activeItem === item.label;
              const isHovered = hoveredNavKey === item.label;
              const highlighted = isActive || isHovered;
              return (
                <div key={item.label}>
                  {showSection && (
                    <div className="hr-nav-section">{item.section}</div>
                  )}
                  <button
                    className={`hr-nav-item${isActive ? " active" : ""}`}
                    onClick={() => selectItem(item.label)}
                    onMouseEnter={() => setHoveredNavKey(item.label)}
                    onMouseLeave={() => setHoveredNavKey(null)}
                    style={{
                      background: highlighted ? `${item.color}18` : undefined,
                      color: highlighted ? item.color : undefined,
                    }}
                  >
                    <span className="hr-nav-icon" style={{ color: item.color }}>
                      <Icon name={item.icon} size={17} />
                    </span>
                    {item.label}
                    {item.label === "Leave Records" && pendingLeaves.length > 0 && (
                      <span className="hr-nav-badge">{pendingLeaves.length}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>
        <main className="hr-main">
          <div className="hr-page-header">
            <div className="hr-page-title-row">
              <h1 className="hr-page-title">{activeItem}</h1>
              <label className="hr-search">
                <Icon name="search" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search employees, leave…"
                  aria-label="Search"
                />
              </label>
            </div>
          </div>
          <section className="hr-content">
          {overviewError && (
            <div className="hr-data-alert">
              Could not load live HR data: {overviewError}
            </div>
          )}
          {activeItem === "Overview" ? (
            <>
              <div className="hr-welcome-row">
                <div>
                  <p className="hr-kicker">{today}</p>
                  <h2>
                    {greeting}, {firstName}
                  </h2>
                  <p className="hr-subtitle">
                    Here is what is happening across your people operations
                    today.
                  </p>
                </div>
                <button
                  className="hr-primary-button"
                  onClick={() => selectItem("New Recruitment")}
                >
                  <Icon name="plus" size={16} /> Add employee
                </button>
              </div>
              <div className="hr-stat-grid">
                <article className="hr-stat-card hr-stat-blue">
                  <div className="hr-stat-icon">
                    <Icon name="users" size={19} />
                  </div>
                  <span>Total employees</span>
                  <strong>{overview ? totalEmployees : "—"}</strong>
                  <small>
                    <b>Live</b> from employee records
                  </small>
                  <div className="hr-sparkline">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </article>
                <article className="hr-stat-card hr-stat-purple">
                  <div className="hr-stat-icon">
                    <Icon name="calendar" size={19} />
                  </div>
                  <span>Present today</span>
                  <strong>{overview ? presentToday : "—"}</strong>
                  <small>
                    <b>{overview ? `${presentRate}%` : "—"}</b> attendance rate
                  </small>
                  <div className="hr-progress">
                    <i style={{ width: `${presentRate}%` }} />
                  </div>
                </article>
                <article className="hr-stat-card hr-stat-orange">
                  <div className="hr-stat-icon">
                    <Icon name="leave" size={19} />
                  </div>
                  <span>On leave</span>
                  <strong>
                    {overview
                      ? pendingLeaves.filter(
                          (leave) =>
                            leave.from_date <=
                              new Date().toISOString().slice(0, 10) &&
                            leave.to_date >=
                              new Date().toISOString().slice(0, 10),
                        ).length
                      : "—"}
                  </strong>
                  <small>
                    <b>{pendingLeaves.length}</b> pending requests
                  </small>
                  <div className="hr-progress">
                    <i
                      style={{
                        width: `${Math.min(pendingLeaves.length * 10, 100)}%`,
                      }}
                    />
                  </div>
                </article>
                <article className="hr-stat-card hr-stat-green">
                  <div className="hr-stat-icon">
                    <Icon name="user-plus" size={19} />
                  </div>
                  <span>Open positions</span>
                  <strong>—</strong>
                  <small>
                    <b>Not connected</b> to a recruitment table
                  </small>
                  <div className="hr-sparkline">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </article>
              </div>
              <div className="hr-dashboard-grid">
                <article className="hr-panel hr-attendance-panel">
                  <div className="hr-panel-heading">
                    <div>
                      <h2>Attendance overview</h2>
                      <p>Team presence for this week</p>
                    </div>
                    <button
                      className="hr-quiet-button"
                      onClick={() => selectItem("Attendance Register")}
                    >
                      View register <Icon name="arrow" size={14} />
                    </button>
                  </div>
                  <div className="hr-chart">
                    <div className="hr-chart-y">
                      <span>100%</span>
                      <span>75%</span>
                      <span>50%</span>
                      <span>25%</span>
                      <span>0%</span>
                    </div>
                    <div className="hr-chart-area">
                      <div className="hr-grid-lines">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="hr-bars">
                        <div>
                          {attendanceDays.map((day) => (
                            <i
                              key={`present-${day.key}`}
                              style={{
                                height: `${totalEmployees ? Math.max((day.present / totalEmployees) * 100, 2) : 2}%`,
                              }}
                            />
                          ))}
                        </div>
                        <div>
                          {attendanceDays.map((day) => (
                            <i
                              key={`remote-${day.key}`}
                              style={{
                                height: `${totalEmployees ? Math.max((day.remote / totalEmployees) * 100, 2) : 2}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="hr-chart-x">
                        {(overview?.weekDays || getWeekDays()).map((day) => (
                          <span key={day.key}>{day.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="hr-legend">
                    <span>
                      <i className="present" />
                      Present
                    </span>
                    <span>
                      <i className="remote" />
                      No clock-out
                    </span>
                  </div>
                </article>
                <article className="hr-panel hr-leave-panel">
                  <div className="hr-panel-heading">
                    <div>
                      <h2>Leave requests</h2>
                      <p>Needs your attention</p>
                    </div>
                    <span className="hr-count-badge">
                      {pendingLeaves.length} pending
                    </span>
                  </div>
                  <div className="hr-leave-list">
                    {pendingLeaves.slice(0, 3).map((leave, index) => (
                      <div
                        className="hr-leave-row"
                        key={`${leave.user_name}-${leave.created_at || index}`}
                      >
                        <div
                          className={`hr-mini-avatar ${["blue", "orange", "green"][index]}`}
                        >
                          {initialsFor(leave.name || leave.user_name)}
                        </div>
                        <div>
                          <strong>
                            {leave.name ||
                              leave.user_name ||
                              "Unnamed employee"}
                          </strong>
                          <span>
                            {leave.leave_type || "Leave"} ·{" "}
                            {leave.from_date || "Date not set"}
                          </span>
                        </div>
                        <button
                          aria-label={`Review ${leave.name || leave.user_name || "leave"}`}
                          onClick={() => selectItem("Leave Records")}
                        >
                          Review
                        </button>
                      </div>
                    ))}
                    {overview && !pendingLeaves.length && (
                      <div className="hr-list-empty">
                        No pending leave requests
                      </div>
                    )}
                  </div>
                  <button
                    className="hr-panel-link"
                    onClick={() => selectItem("Leave Records")}
                  >
                    See all requests <Icon name="arrow" size={14} />
                  </button>
                </article>
              </div>
              <div className="hr-bottom-grid">
                <article className="hr-panel">
                  <div className="hr-panel-heading">
                    <div>
                      <h2>People pulse</h2>
                      <p>Quick view of your team</p>
                    </div>
                    <button
                      className="hr-quiet-button"
                      onClick={() => selectItem("Employees")}
                    >
                      View all <Icon name="arrow" size={14} />
                    </button>
                  </div>
                  <div className="hr-people-list">
                    {livePeople.map((person) => (
                      <div className="hr-person-row" key={person.name}>
                        <div className={`hr-mini-avatar ${person.color}`}>
                          {person.initials}
                        </div>
                        <div>
                          <strong>{person.name}</strong>
                          <span>{person.role}</span>
                        </div>
                        <em className={`hr-person-status ${person.color}`}>
                          {person.status}
                        </em>
                      </div>
                    ))}
                    {overview && !livePeople.length && (
                      <div className="hr-list-empty">
                        No employee records found
                      </div>
                    )}
                  </div>
                </article>
                <article className="hr-panel hr-birthday-panel">
                  <div className="hr-panel-heading">
                    <div>
                      <h2>Coming up</h2>
                      <p>Birthday data is not available</p>
                    </div>
                    <Icon name="gift" size={19} />
                  </div>
                  <div className="hr-birthday-date">
                    <strong>—</strong>
                    <span>
                      <b>No birth date field</b>
                      <small>
                        Add one to employee records to enable this card
                      </small>
                    </span>
                  </div>
                  <div className="hr-birthday-names">
                    <p>Connect a birthday field when the HR schema is ready</p>
                  </div>
                  <button
                    className="hr-panel-link"
                    onClick={() => selectItem("Birthdays")}
                  >
                    Open birthday calendar <Icon name="arrow" size={14} />
                  </button>
                </article>
              </div>
            </>
            ) : activeItem === "Employees" ? (
              <>
                <div className="hr-welcome-row">
                  <div>
                    <p className="hr-kicker">People directory</p>
                    <h2>Employees</h2>
                    <p className="hr-subtitle">{overview ? `${employeeList.length} of ${overview.users.length} employees` : "Loading employee records..."}</p>
                  </div>
                </div>
                {employeeStatsError && <div className="hr-data-alert">Could not load attendance stats: {employeeStatsError}</div>}
                <div className="hr-employee-grid">
                  {employeeList.map((employee) => {
                    const username = employee.username || employee.user_name;
                    const dept = employee.department || employee.designation || employee.role || "—";
                    const stat = employeeStats?.get(normalizeUsername(username)) || { present: 0, late: 0, leave: 0 };
                    return (
                      <article className="hr-employee-card" key={username || employee.name}>
                        <div className="hr-employee-avatar">{initialsFor(employee.name || username)}</div>
                        <strong className="hr-employee-name">{employee.name || username || "Unnamed employee"}</strong>
                        <span className="hr-employee-dept">{dept}</span>
                        <div className="hr-employee-stats">
                          <div className="hr-employee-stat is-present"><Icon name="check-circle" size={14} /><b>{employeeStatsLoading ? "—" : stat.present}</b><small>Present</small></div>
                          <div className="hr-employee-stat is-late"><Icon name="clock" size={14} /><b>{employeeStatsLoading ? "—" : stat.late}</b><small>Late</small></div>
                          <div className="hr-employee-stat is-leave"><Icon name="calendar-off" size={14} /><b>{employeeStatsLoading ? "—" : stat.leave}</b><small>Leave</small></div>
                        </div>
                      </article>
                    );
                  })}
                  {overview && !employeeList.length && <div className="hr-list-empty">No employees found</div>}
                </div>
              </>
            ) : activeItem === "Attendance Register" ? (
              <>
                <div className="hr-att-toolbar">
                  <div className="hr-att-title">
                    <Icon name="calendar" size={18} />
                    <strong>Attendance Register</strong>
                  </div>
                  <div className="hr-att-filters">
                    <label>
                      <span>Year</span>
                      <select
                        value={registerYear}
                        onChange={(event) => setRegisterYear(Number(event.target.value))}
                        aria-label="Attendance year"
                      >
                        {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(
                          (year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      <span>Month</span>
                      <select
                        value={registerMonth}
                        onChange={(event) => setRegisterMonth(Number(event.target.value))}
                        aria-label="Attendance month"
                      >
                        {MONTH_OPTIONS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="hr-primary-button"
                      type="button"
                      disabled={registerLoading}
                      onClick={() => loadAttendanceRegister(registerYear, registerMonth)}
                    >
                      Show
                    </button>
                    <button
                      className="hr-quiet-button"
                      type="button"
                      disabled={!registerRows.length || registerLoading}
                      onClick={downloadRegisterPdf}
                    >
                      <Icon name="download" size={15} /> Download PDF
                    </button>
                  </div>
                </div>

                {registerError && (
                  <div className="hr-data-alert">{registerError}</div>
                )}

                <div className="hr-att-wrap">
                  <table className="hr-att-table">
                    <thead>
                      <tr>
                        <th className="hr-att-emp-head">Employee</th>
                        {registerDays.map((day) => (
                          <th
                            key={day.key}
                            className={`hr-att-day-head${day.isWeekend ? " is-weekend" : ""}`}
                          >
                            <strong>{day.day}</strong>
                            <small>{day.weekday}</small>
                          </th>
                        ))}
                        <th className="hr-att-sum-head is-p">P</th>
                        <th className="hr-att-sum-head is-l">L</th>
                        <th className="hr-att-sum-head is-a">A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registerRows.map((row) => (
                        <tr key={row.username || row.name}>
                          <td className="hr-att-emp">{row.name}</td>
                          {registerDays.map((day) => {
                            const cell = row.days[day.key] || { status: "A" };
                            const status = cell.status || "A";
                            return (
                              <td
                                key={`${row.username}-${day.key}`}
                                className={`hr-att-cell status-${status.toLowerCase()}${day.isWeekend ? " is-weekend" : ""}`}
                              >
                                <span className={`hr-att-badge status-${status.toLowerCase()}`}>
                                  {status}
                                </span>
                                {cell.clockIn ? (
                                  <span className="hr-att-time is-in">
                                    <svg width="8" height="8" viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M12 4l8 14H4z" fill="#16a34a" />
                                    </svg>
                                    {cell.clockIn}
                                  </span>
                                ) : null}
                                {cell.clockOut ? (
                                  <span className="hr-att-time is-out">
                                    <svg width="8" height="8" viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M12 20L4 6h16z" fill="#dc2626" />
                                    </svg>
                                    {cell.clockOut}
                                  </span>
                                ) : null}
                              </td>
                            );
                          })}
                          <td className="hr-att-sum is-p">{row.present}</td>
                          <td className="hr-att-sum is-l">{row.late}</td>
                          <td className="hr-att-sum is-a">{row.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {registerLoading && (
                    <div className="hr-list-empty">Loading attendance…</div>
                  )}
                  {!registerLoading && registerLoaded && !registerRows.length && (
                    <div className="hr-list-empty">No employees found for this month.</div>
                  )}
                </div>

                <div className="hr-att-legend">
                  <span className="hr-att-leg">
                    <i className="dot p" /> P = Present
                  </span>
                  <span className="hr-att-leg">
                    <i className="dot l" /> L = Late
                  </span>
                  <span className="hr-att-leg">
                    <i className="dot a" /> A = Absent
                  </span>
                  <span className="hr-att-leg">
                    <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 4l8 14H4z" fill="#16a34a" />
                    </svg>
                    In
                  </span>
                  <span className="hr-att-leg">
                    <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 20L4 6h16z" fill="#dc2626" />
                    </svg>
                    Out (24hr)
                  </span>
                </div>
              </>
            ) : activeItem === "Leave Records" ? (
              <>
                <div className="hr-welcome-row">
                  <div>
                    <p className="hr-kicker">HR management</p>
                    <h2>Leave records</h2>
                    <p className="hr-subtitle">Review every leave application and its final status.</p>
                  </div>
                </div>
                <div className="hr-leave-toolbar">
                  <label className="hr-leave-search">
                    <Icon name="search" size={16} />
                    <input value={leaveSearch} onChange={(event) => setLeaveSearch(event.target.value)} placeholder="Search employee name" aria-label="Search employee name" />
                  </label>
                  <label className="hr-status-filter">
                    <span>Status</span>
                    <select value={leaveStatusFilter} onChange={(event) => setLeaveStatusFilter(event.target.value)} aria-label="Filter leave records by status">
                      <option value="all">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <span className="hr-record-count">{leaveRecordsLoading ? "Loading records..." : `${filteredLeaveRecords.length} record${filteredLeaveRecords.length === 1 ? "" : "s"}`}</span>
                </div>
                {leaveRecordsError && <div className="hr-data-alert">Could not load leave records: {leaveRecordsError}</div>}
                <div className="hr-leave-table-wrap">
                  <table className="hr-leave-table">
                    <thead><tr><th>Employee</th><th>Leave type</th><th>From</th><th>To</th><th>Reason</th><th>Applied on</th><th>Final status</th></tr></thead>
                    <tbody>
                      {filteredLeaveRecords.map((leave) => {
                        const status = String(leave.status || "Unknown").trim();
                        const statusClass = status.toLowerCase().replace(/\s+/g, "-");
                        const appliedOn = leave.created_at;
                        return <tr key={leave.id || `${leave.user_name}-${leave.from_date}-${appliedOn}`}>
                          <td><div className="hr-table-person"><span className="hr-table-avatar">{initialsFor(leave.name || leave.user_name)}</span><div><strong>{leave.name || leave.user_name || "Unnamed employee"}</strong><small>{leave.user_name || ""}</small></div></div></td>
                          <td>
                            <span
                              style={{
                                color: "#1d4ed8",
                                backgroundColor: "#eff6ff",
                                borderRadius: "999px",
                                padding: "4px 12px",
                                display: "inline-block",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              {leave.leave_type || "—"}
                            </span>
                          </td>
                          <td>{leave.from_date || "—"}</td>
                          <td>{leave.to_date || "—"}</td>
                          <td className="hr-reason-cell" title={leave.reason || ""}>{leave.reason || "—"}</td>
                          <td>{appliedOn ? new Date(appliedOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                          <td><span className={`hr-leave-status ${statusClass}`}>{status}</span></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                  {!leaveRecordsLoading && !filteredLeaveRecords.length && <div className="hr-list-empty">No leave records match your filters.</div>}
                </div>
              </>
          ) : activeItem === "Leave Tracker" ? (
            <>
              <div className="hr-welcome-row hr-tracker-heading">
                <div>
                  <p className="hr-kicker">HR management</p>
                  <h2>Leave tracker</h2>
                  <p className="hr-subtitle">Annual leave usage across the April to March cycle.</p>
                </div>
                <button className="hr-primary-button" onClick={() => selectItem("Leave Records")}><Icon name="calendar" size={16} /> View leave records</button>
              </div>
              <div className="hr-tracker-toolbar">
                <label className="hr-leave-search"><Icon name="search" size={16} /><input value={leaveSearch} onChange={(event) => setLeaveSearch(event.target.value)} placeholder="Search employee..." aria-label="Search employee in leave tracker" /></label>
                <label className="hr-tracker-cycle"><span>Leave cycle</span><select value={trackerYearStart} onChange={(event) => setTrackerYearStart(Number(event.target.value))}><option value={getFiscalYearStart()}>{getFiscalYearStart()} - {getFiscalYearStart() + 1}</option><option value={getFiscalYearStart() - 1}>{getFiscalYearStart() - 1} - {getFiscalYearStart()}</option></select></label>
                <div className="hr-tracker-policy"><Icon name="calendar" size={15} /><strong>60 days / year</strong><span>5 leaves per month · Sundays included</span></div>
                <span className="hr-record-count">{leaveTrackerLoading ? "Loading tracker..." : `${trackerRows.length} employee${trackerRows.length === 1 ? "" : "s"}`}</span>
              </div>
              {leaveTrackerError && <div className="hr-data-alert">Could not load leave tracker: {leaveTrackerError}</div>}
              <div className="hr-tracker-wrap">
                <table className="hr-tracker-table">
                  <thead><tr><th className="hr-tracker-employee-head">Employee</th>{trackerMonths.map((month) => <th key={month.key} className={month.key === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}` ? "is-current-month" : ""}><strong>{month.label}</strong><small>{month.year}</small></th>)}<th className="hr-used-head">Used</th><th className="hr-balance-head">Balance</th></tr></thead>
                  <tbody>{trackerRows.map((row) => <tr key={row.username || row.name}><td className="hr-tracker-employee"><strong>{row.name}</strong><small>{row.username || "Employee"}</small></td>{row.months.map((days, index) => <td key={`${row.username}-${trackerMonths[index].key}`} className={days > 0 ? "has-leave" : "no-leave"}>{days > 0 ? <b>{days}</b> : <span>—</span>}</td>)}<td className="hr-used-value">{row.used}</td><td className="hr-balance-value"><b>{row.balance}</b><span><i style={{ width: `${Math.min((row.balance / 60) * 100, 100)}%` }} /></span></td></tr>)}</tbody>
                </table>
                {!leaveTrackerLoading && !trackerRows.length && <div className="hr-list-empty">No employees or leave records match your search.</div>}
              </div>
              <div className="hr-tracker-note"><span className="hr-tracker-dot approved" /> Only approved leaves are included in Used. Each leave period is counted by calendar days, including Sundays.</div>
            </>
          ) : (
            <div className="hr-empty-view">
              <div className="hr-empty-icon">
                <Icon
                  name={
                    MENU.find((item) => item.label === activeItem)?.icon ||
                    "grid"
                  }
                  size={27}
                />
              </div>
              <p className="hr-kicker">HR workspace</p>
              <h1>{activeItem}</h1>
              <p>
                This workspace is ready for your {activeItem.toLowerCase()}{" "}
                workflow. We can shape the tables, forms, approvals, and reports
                here next.
              </p>
              <button
                className="hr-primary-button"
                onClick={() => selectItem("Overview")}
              >
                <Icon name="arrow" size={16} /> Back to overview
              </button>
            </div>
          )}
        </section>
        </main>
      </div>
      <PortalFloaters showBot botScope="hr" />
    </div>
  );
}
