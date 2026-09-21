import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import PortalFloaters from "../components/PortalFloaters";
import "./HRPortal.css";

const MENU = [
  { label: "Overview", icon: "grid", section: "Main" },
  { label: "Employees", icon: "users", section: "Main" },
  { label: "Attendance Register", icon: "calendar", section: "Main" },
  { label: "Leave Records", icon: "leave", section: "HR Management" },
  { label: "Leave Tracker", icon: "tracker", section: "HR Management" },
  { label: "Expenses", icon: "money", section: "HR Management" },
  { label: "Assets", icon: "briefcase", section: "Assets & More" },
  { label: "Insurance", icon: "shield", section: "Assets & More" },
  { label: "Documents", icon: "folder", section: "Assets & More" },
  { label: "Birthdays", icon: "gift", section: "Assets & More" },
  { label: "New Recruitment", icon: "user-plus", section: "Recruitment" },
  { label: "Salary Slip", icon: "wallet", section: "Recruitment" },
];


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
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeItem, setActiveItem] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const initials = (user?.name || "HR")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
    setSidebarOpen(false);
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

  if (!user)
    return (
      <div className="hr-loading">
        <span className="hr-loading-dot" />
        Preparing your workspace...
      </div>
    );

  return (
    <div className="hr-portal">
      <aside className={`hr-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="hr-brand">
          <div className="hr-brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>HR Portal</strong>
            <small>People & operations</small>
          </div>
        </div>
        <div className="hr-date">{today}</div>
        <nav className="hr-nav" aria-label="HR portal navigation">
          {MENU.map((item, index) => (
            <div key={item.label}>
              {(index === 0 || item.section !== MENU[index - 1].section) && (
                <div className="hr-nav-section">{item.section}</div>
              )}
              <button
                className={`hr-nav-item${activeItem === item.label ? " is-active" : ""}`}
                onClick={() => selectItem(item.label)}
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
                {item.label === "Leave Records" && (
                  <b className="hr-nav-count">4</b>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="hr-sidebar-footer">
          <div className="hr-sidebar-note">
            <span className="hr-status-pulse" />
            All systems operational
          </div>
          <button
            className="hr-signout"
            onClick={() => {
              localStorage.removeItem("user");
              navigate("/");
            }}
          >
            <Icon name="arrow" size={16} /> Sign out
          </button>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="hr-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="hr-main">
        <header className="hr-topbar">
          <button
            className="hr-menu-toggle"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="hr-breadcrumb">
            <span>Workspace</span>
            <b>/</b>
            <strong>{activeItem}</strong>
          </div>
          <div className="hr-top-actions">
            <label className="hr-search">
              <Icon name="search" size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search anything"
                aria-label="Search anything"
              />
            </label>
            <button className="hr-icon-button" aria-label="Notifications">
              <Icon name="bell" size={18} />
              <i />
            </button>
            <div className="hr-user-chip">
              <div className="hr-avatar">{initials}</div>
              <div>
                <strong>{user.name || "HR Admin"}</strong>
                <small>{user.role || "HR Manager"}</small>
              </div>
              <span className="hr-chevron">⌄</span>
            </div>
          </div>
        </header>
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
                  <p className="hr-kicker">Monday, {today}</p>
                  <h1>
                    Good morning, {firstName}
                    <span>.</span>
                  </h1>
                  <p className="hr-subtitle">
                    Here is what is happening across your people operations
                    today.
                  </p>
                </div>
                <button
                  className="hr-primary-button"
                  onClick={() => selectItem("New Recruitment")}
                >
                  <span>+</span> Add employee
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
                    <h1>Employees<span>.</span></h1>
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
            ) : activeItem === "Leave Records" ? (
              <>
                <div className="hr-welcome-row">
                  <div>
                    <p className="hr-kicker">HR management</p>
                    <h1>Leave records<span>.</span></h1>
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
                                color: "#6B21A8",
                                backgroundColor: "#F3E8FF",
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
                  <h1>Leave tracker<span>.</span></h1>
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
      <PortalFloaters />
    </div>
  );
}
