import { useState, useEffect, useRef } from "react";
import "./SiteTourGuide.css";

// ── Role Normalizer ──
const normRole = (r) => (r || "").toLowerCase().trim();
const DEFAULT_ONBOARDING = {
  welcomeSeen: false,
  tourStatus: null,
  checklist: { attendance: false, report: false, leave: false },
};

// ── Dynamic Tour Modules strictly aligned with Sidebar Menus & Role Permissions ──
export const getTourModules = (userRole = "", isApprover = false) => {
  const role = normRole(userRole);
  // Exactly matching SitePortal.jsx logic:
  const isHead = role === "project head";
  const isIncharge = role === "site incharge";
  const isCoordinator = role === "site coordinator";
  const isSiteEngineer = role.replace(/[_\s]+/g, " ") === "site engineer";
  const canSeeSubmissions = isHead || isIncharge || isCoordinator;
  const canSeeApprovals = Boolean(isApprover) || isHead || isIncharge || isCoordinator;

  // 1. Clock In/Out Step
  const stepClock = {
    target: '[data-tour="nav-clock-in"]',
    fallbackTab: "clock-in",
    title: "Clock In / Out (Attendance Punching)",
    desc: "How to punch: Click 'Clock In' in the morning -> Allow GPS location -> Align your face in camera -> Capture & Submit. When leaving, click 'Clock Out', complete task checkpoints/remarks, and submit.",
    badge: "Attendance",
    howTo: [
      "Morning: Click 'Clock In' button. Camera modal will open with live GPS coordinates.",
      "Click 'Capture Photo' -> Verify preview -> Click 'Confirm & Submit'.",
      "Evening: Click 'Clock Out'. Mark checkpoint tasks done, attach optional proof docs, then click 'Submit & Clock Out'."
    ],
  };

  // 2. Attendance Calendar Step
  const stepCalendar = {
    target: '[data-tour="nav-calendar"]',
    fallbackTab: "calendar",
    title: "Attendance Calendar & History",
    desc: "How to inspect: View color-coded calendar dates (Green = On-time, Yellow = Late In, Red = Absent, Purple = Approved Leave). Click any date card to see logged in/out timestamps, hours worked, and selfie records.",
    badge: "Calendar",
    howTo: [
      "Click on any day cell to view attendance details.",
      "Check late markers, half-day punches, and calculated work hours.",
      "Use month switcher (< / >) to check previous salary cycle records."
    ],
  };

  // 3. Apply Leave Step
  const stepApplyLeave = {
    target: '[data-tour="nav-apply-leave"]',
    fallbackTab: "apply-leave",
    title: "Apply Leave (Form Submission)",
    desc: "How to apply: 1. Review available balance quota at the top. 2. Select Leave Type (Casual, Sick, etc.). 3. Select From & To dates. 4. Write a clear reason. 5. Click 'Submit Application'. Your request routes directly through the site approval hierarchy.",
    badge: "Leave Application",
    howTo: [
      "Check the top banner for your remaining monthly leave balance.",
      "Select 'Leave Type' (e.g. Casual Leave, Sick Leave).",
      "Pick 'From Date' and 'To Date'. Total days will calculate automatically.",
      "Type your reason and click 'Submit Application'."
    ],
  };

  // 4. My Leave Step
  const stepMyLeave = {
    target: '[data-tour="nav-my-leave"]',
    fallbackTab: "my-leave",
    title: "My Leave Records & Approval Status",
    desc: "How to track: See every leave request submitted by you. Badges clearly display approval steps (e.g., Level 1 Incharge: Approved, Project Head: Pending, or Rejection Reason if denied).",
    badge: "My Leaves",
    howTo: [
      "Switch between 'Pending' and 'All' tabs.",
      "See whether your Level Approver and Head Approver have signed off.",
      "If rejected, read the red feedback box with reviewer remarks."
    ],
  };

  // 5. Leave Approvals Step (ONLY for Approvers / Incharge / Coordinators / Heads)
  const stepLeaveApprovals = {
    target: '[data-tour="nav-leave-approvals"]',
    fallbackTab: "leave-approvals",
    title: "Leave Approvals (Managerial Review)",
    desc: "How to approve/reject: Subordinate site engineers' leaves appear here. Click 'Approve' to sign off, or click 'Reject' to open a dialogue, specify the rejection reason, and send it back to the engineer.",
    badge: "Leave Approvals",
    howTo: [
      "Review applicant details: engineer name, dates, leave type, and reason.",
      "Click green 'Approve' button for immediate sign-off.",
      "Click red 'Reject' button -> enter required reason note -> confirm rejection."
    ],
  };

  // 6. Daily Report (DPR) Step
  const stepDpr = {
    target: '[data-tour="nav-daily-report"]',
    fallbackTab: "daily-report",
    title: "Daily Progress Report (DPR Form)",
    desc: "How to fill DPR: 1. Select Report Type (Morning Plan or Evening Progress). 2. Enter executed work items, quantities & block/unit locations. 3. Input contractor manpower counts. 4. Upload site photos. 5. Click 'Submit DPR'.",
    badge: "DPR Form",
    howTo: [
      "Choose 'Morning' or 'Evening' DPR tab.",
      "Fill work progress descriptions and obstacle details.",
      "Fill manpower table with worker counts per trade.",
      "Add high-res site photos with captions and click 'Submit Report'."
    ],
  };

  // 7. Weekly Report (WPR Generator) Step
  const stepWpr = {
    target: '[data-tour="nav-wpr-generator"]',
    fallbackTab: "wpr-generator",
    title: "Weekly Progress Report (WPR Generator)",
    desc: "How to compile WPR: Select the target week range (Mon–Sat) -> Click 'Generate WPR' -> System aggregates all week DPRs into an executive summary -> Add weekly milestone notes & key photos -> Download PDF.",
    badge: "WPR Report",
    howTo: [
      "Pick week starting date and ending date.",
      "Click 'Fetch DPR Logs' to automatically pull all weekly entries.",
      "Review generated photo grid and click 'Export / Download PDF'."
    ],
  };

  // 8. Weekly Plan Step
  const stepWeeklyPlan = {
    target: '[data-tour="nav-weekly-plan"]',
    fallbackTab: "weekly-plan",
    title: "Weekly Planning & Targets",
    desc: "How to plan ahead: Outline key structural activities, concrete pour dates, material requirements, and milestone commitments for the upcoming week.",
    badge: "Weekly Plan",
    howTo: [
      "Open Weekly Plan view.",
      "Review week targets and align contractor labour requirements.",
      "Ensure materials and equipment will be ready ahead of execution."
    ],
  };

  // 9. Monthly Report Step
  const stepMonthlyReport = {
    target: '[data-tour="nav-monthly-report"]',
    fallbackTab: "monthly-report",
    title: "Month-End Cumulative Report",
    desc: "How to review monthly accomplishments: Track cumulative quantities executed, financial progress vs physical progress, and high-level site summaries for senior leadership.",
    badge: "Monthly Report",
    howTo: [
      "Select target month and site.",
      "Inspect aggregated progress percentages and milestones achieved.",
      "Generate monthly summary printout."
    ],
  };

  // 10. Site Visit Report (SVR) Step
  const stepSvr = {
    target: '[data-tour="nav-site-report"]',
    fallbackTab: "site-report",
    title: isSiteEngineer ? "Quality Audit Report" : "Site Visit Report (SVR Form)",
    desc: isSiteEngineer
      ? "How to complete a quality audit: Inspect site work against quality standards, record observations and non-conformances, attach supporting photos, and submit the audit report."
      : "How to fill SVR: When conducting site visits or client inspections, record visit purpose, progress observations, quality checks, safety concerns, and inspection photos, then submit the report.",
    badge: isSiteEngineer ? "Quality Audit" : "SVR Audit",
    howTo: isSiteEngineer
      ? [
          "Select the site and audit date.",
          "Review the work and record quality observations or non-conformances.",
          "Attach photos that support the audit findings.",
          "Submit the quality audit report.",
        ]
      : [
          "Select Site Name & Inspection Date.",
          "Document work progress verified on ground versus planned schedule.",
          "Log safety/quality remarks and snag lists.",
          "Click 'Generate & Submit Site Report'.",
        ],
  };

  // 11. My Reports Step
  const stepMyReports = {
    target: '[data-tour="nav-my-reports"]',
    fallbackTab: "my-reports",
    title: "My Reports Archive",
    desc: "How to view/download: Filter by Month and Report Type (DPR, WPR, SVR). Click 'View' to inspect the digital copy or 'Download PDF' to print or forward via WhatsApp / Email.",
    badge: "Reports Archive",
    howTo: [
      "Use the top tabs to switch between DPR, WPR, and SVR.",
      "Filter by month or site.",
      "Click blue 'Download' button next to any report to fetch official branded PDF."
    ],
  };

  // 12. Material Arrived Step
  const stepMaterial = {
    target: '[data-tour="nav-material-arrived"]',
    fallbackTab: "material-arrived",
    title: "Material Arrived Register",
    desc: "How to record delivery: Whenever trucks/vendors deliver materials on site: Click 'Add Arrived Material' -> Enter Item Name, Quantity, Unit, Vendor, Challan No. -> Snap photo of invoice/challan -> Save record.",
    badge: "Material Inward",
    howTo: [
      "Click 'Record Inward Material' button.",
      "Type Item description (e.g., OPC 53 Cement, TMT 12mm Rebar).",
      "Enter received quantity against PO challan.",
      "Upload delivery challan photo and save."
    ],
  };

  // 13. Manpower Reports Step
  const stepManpower = {
    target: '[data-tour="nav-manpower-reports"]',
    fallbackTab: "manpower-reports",
    title: "Manpower Deployment Analytics",
    desc: "How to analyze labor trends: Inspect daily worker attendance counts per contractor agency across masonry, carpentry, steel fixing, and general labor trades.",
    badge: "Manpower Report",
    howTo: [
      "Inspect manpower charts and daily headcounts.",
      "Verify contractor billings against logged labor numbers.",
      "Track labor productivity against work milestones achieved."
    ],
  };

  // 14. Report Submissions Step (ONLY for Project Head & Site Incharge)
  const stepReportSubmissions = {
    target: '[data-tour="nav-report-submissions"]',
    fallbackTab: "report-submissions",
    title: "Report Submissions (Managerial Command Center)",
    desc: "How to monitor site reports: Authorized reviewers can view consolidated live feeds of DPRs, WPRs, and SVRs submitted by site engineers across assigned projects with quick PDF download links.",
    badge: "Submissions",
    howTo: [
      "Filter reports by engineer, site, and date range.",
      "Inspect morning vs evening DPR completion rates.",
      "Download engineer PDF submissions with a single click."
    ],
  };

  const stepEaMeetingQr = {
    target: '[data-tour="navbar-qr"]',
    title: "EA Meeting Attendance QR Scanner",
    desc: "Use the QR scanner to record attendance at an EA meeting. It is separate from the Clock In / Out attendance flow.",
    badge: "EA Meeting",
    howTo: [
      "Open the QR scanner from the navbar.",
      "Scan the QR code provided for the EA meeting.",
      "Wait for the attendance confirmation.",
    ],
  };

  // 15. User Profile Step
  const stepProfile = {
    target: '[data-tour="navbar-user"]',
    title: "Profile & Settings",
    desc: "How to manage account: Click here to switch between Dark & Light theme, verify your assigned site allocation, update profile details, switch to Admin/Office portal (if authorised), or safely log out.",
    badge: "Profile",
    howTo: [
      "View assigned role, site name, and contact details.",
      "Toggle dark/light mode for comfortable outdoor site viewing.",
      "Use Portal Switcher if you also hold office or admin permissions."
    ],
  };

  const introSteps = [
    {
      target: '[data-tour="site-sidebar"]',
      title: "Your site workspace",
      desc: "Use the navigation here to move between attendance, leave, reports, planning, and materials. The sections available match your site role.",
      badge: "Navigation",
    },
    stepClock,
    stepCalendar,
    stepDpr,
    stepProfile,
  ];

  // ── Build 'all' steps strictly reflecting sidebar menus for this user ──
  const allSteps = [
    stepClock,
    stepCalendar,
    stepApplyLeave,
    stepMyLeave,
    ...(canSeeApprovals ? [stepLeaveApprovals] : []),
    stepDpr,
    stepWpr,
    stepWeeklyPlan,
    stepMonthlyReport,
    stepSvr,
    stepMyReports,
    stepMaterial,
    stepManpower,
    ...(canSeeSubmissions ? [stepReportSubmissions] : []),
    stepEaMeetingQr,
    stepProfile,
  ];

  return {
    intro: {
      id: "intro",
      title: "Your Site Portal Tour",
      tag: "Site Portal",
      description: "A quick introduction to the site workspace.",
      steps: introSteps,
    },
    all: {
      id: "all",
      title: "Complete Role Walkthrough (All Your Menus)",
      tag: "All Menus & Operations",
      description: `Walks through all ${allSteps.length} menus enabled for ${userRole || "your role"}.`,
      steps: allSteps,
    },

    clock: {
      id: "clock",
      title: "How to Punch In/Out (Attendance & Verification)",
      tag: "Attendance Guide",
      description: "Punching attendance with live GPS, selfie capture, and evening checklist remarks.",
      steps: [
        stepClock,
        stepCalendar,
      ],
    },

    dpr: {
      id: "dpr",
      title: "How to Fill & Submit DPR (Daily Progress Report)",
      tag: "DPR Guide",
      description: "Filling morning targets, evening work execution, trade labor counts, and site photos.",
      steps: [
        stepDpr,
        stepMyReports,
      ],
    },

    wpr: {
      id: "wpr",
      title: "How to Generate & Export WPR (Weekly Progress Report)",
      tag: "WPR Guide",
      description: "Compiling weekly DPR logs, selecting milestone photos, and exporting PDFs.",
      steps: [
        stepWpr,
        stepWeeklyPlan,
      ],
    },

    svr: {
      id: "svr",
      title: isSiteEngineer
        ? "How to Complete a Quality Audit"
        : "How to Conduct & Submit SVR (Site Visit Report)",
      tag: isSiteEngineer ? "Quality Audit Guide" : "SVR Guide",
      description: isSiteEngineer
        ? "Recording site quality observations, non-conformances, and supporting evidence."
        : "Documenting site visits, inspection observations, safety concerns, and report submission.",
      steps: [
        stepSvr,
        stepMyReports,
      ],
    },
    manpower: {
      id: "manpower",
      title: "Manpower Deployment Report",
      tag: "Manpower Guide",
      description: "Reviewing daily workforce counts and manpower trends across trades.",
      steps: [stepManpower],
    },
    "ea-meeting": {
      id: "ea-meeting",
      title: "EA Meeting Attendance",
      tag: "EA Meeting",
      description: "Scanning the EA meeting QR code to record meeting attendance.",
      steps: [stepEaMeetingQr],
    },

    leave: {
      id: "leave",
      title: "How to Apply & Track Leaves",
      tag: "Leave Workflow",
      description: "Checking monthly leave balances, applying with reasons, and reviewing approvals.",
      steps: [
        stepApplyLeave,
        stepMyLeave,
        ...(canSeeApprovals ? [stepLeaveApprovals] : []),
      ],
    },

    material: {
      id: "material",
      title: "How to Register Arrived Materials & Vendor Challans",
      tag: "Material Guide",
      description: "Logging inbound deliveries, checking PO quantities, and attaching delivery challans.",
      steps: [
        stepMaterial,
      ],
    },

    ...(canSeeSubmissions ? {
      submissions: {
        id: "submissions",
        title: "Report Submissions & Managerial Review",
        tag: "Report Review",
        description: "Reviewing all site engineers' DPRs, WPRs, and SVRs across projects with 1-click PDF download.",
        steps: [
          stepReportSubmissions,
          ...(canSeeApprovals ? [stepLeaveApprovals] : []),
        ],
      }
    } : {}),
  };
};

export default function SiteTourGuide({ user, isApprover = false, onNavigateTab, onEnsureSidebarOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTourId, setActiveTourId] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [onboarding, setOnboarding] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const welcomeStartRef = useRef(null);
  const loadedStorageKey = useRef(null);
  const modulesRef = useRef(null);
  const actionRefs = useRef({});
  const tourViewRef = useRef(null);
  const spotlightUpdateRef = useRef(null);
  const userKey = user?.id || user?.user_name;
  const storageKey = userKey ? `site-onboarding:${userKey}` : null;
  const isSiteEngineer = normRole(user?.role).replace(/[_\s]+/g, " ") === "site engineer";

  const modules = getTourModules(user?.role, isApprover);
  modulesRef.current = modules;
  const activeTour = activeTourId ? modules[activeTourId] : null;
  const currentStep = activeTour?.steps[currentStepIdx] || null;
  tourViewRef.current = { activeTour, currentStep, onNavigateTab, onEnsureSidebarOpen };
  const showWelcome = storageReady && Boolean(userKey) && !onboarding?.welcomeSeen && !onboarding?.tourStatus;

  useEffect(() => {
    if (!storageKey) {
      loadedStorageKey.current = null;
      setOnboarding(null);
      setStorageReady(false);
      return;
    }
    setStorageReady(false);
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      saved = null;
    }
    setOnboarding({
      ...DEFAULT_ONBOARDING,
      ...(saved || {}),
      checklist: { ...DEFAULT_ONBOARDING.checklist, ...(saved?.checklist || {}) },
    });
    loadedStorageKey.current = storageKey;
    setStorageReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady || !storageKey || loadedStorageKey.current !== storageKey || !onboarding) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(onboarding));
    } catch {
      // Onboarding remains usable when browser storage is unavailable.
    }
  }, [onboarding, storageKey, storageReady]);

  useEffect(() => {
    if (showWelcome) welcomeStartRef.current?.focus();
  }, [showWelcome]);

  useEffect(() => {
    const handleAction = (event) => {
      const key = event.detail?.action;
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_ONBOARDING.checklist, key)) return;
      setOnboarding((current) => current ? {
        ...current,
        checklist: { ...current.checklist, [key]: true },
      } : current);
    };
    window.addEventListener("site-onboarding-action", handleAction);
    return () => window.removeEventListener("site-onboarding-action", handleAction);
  }, []);

  // Listen to custom event fired by SG button in Navbar
  useEffect(() => {
    const handleOpen = (e) => {
      const tourId = e.detail?.tourId;
      if (tourId && modulesRef.current[tourId]) {
        actionRefs.current.startTour(tourId);
      } else {
        setIsOpen(true);
      }
    };
    window.addEventListener("open-site-tour", handleOpen);
    return () => window.removeEventListener("open-site-tour", handleOpen);
  }, []);

  // Recalculate spotlight highlight position whenever step changes or window resizes
  const updateSpotlight = () => {
    const step = tourViewRef.current?.currentStep;
    if (!step) {
      setSpotlightRect(null);
      return;
    }

    let el = null;
    try {
      el = document.querySelector(step.target);
    } catch {
      setSpotlightRect(null);
      return;
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      const isOutsideViewport = rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight;
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleRatio = (visibleWidth * visibleHeight) / (rect.width * rect.height);
      if (isOutsideViewport || rect.width <= 0 || rect.height <= 0 || visibleRatio < 0.75) {
        setSpotlightRect(null);
        return;
      }
      const top = Math.min(Math.max(0, rect.top - 6), Math.max(0, window.innerHeight - 12));
      const left = Math.min(Math.max(0, rect.left - 6), Math.max(0, window.innerWidth - 12));
      setSpotlightRect({
        top,
        left,
        width: Math.min(rect.width + 12, window.innerWidth - left),
        height: Math.min(rect.height + 12, window.innerHeight - top),
      });

      // Smooth scroll if element is outside visible viewport
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setSpotlightRect(null);
    }
  };
  spotlightUpdateRef.current = updateSpotlight;

  useEffect(() => {
    const view = tourViewRef.current;
    if (!view?.activeTour) return;

    // Switch tab if step needs a specific page
    if (view.currentStep?.fallbackTab && view.onNavigateTab) {
      view.onNavigateTab(view.currentStep.fallbackTab);
    }

    // Delay to let React render tab changes and sidebar animation
    const update = () => spotlightUpdateRef.current?.();
    const timer = setTimeout(update, 180);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeTourId, currentStepIdx]);

  useEffect(() => {
    if (!activeTour && !showWelcome && !isOpen) return undefined;
    const handleKeys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (activeTour) actionRefs.current.skipTour();
        else if (showWelcome) actionRefs.current.dismissWelcome();
        else setIsOpen(false);
      } else if (activeTour && event.key === "ArrowRight") {
        event.preventDefault();
        actionRefs.current.nextStep();
      } else if (activeTour && event.key === "ArrowLeft") {
        event.preventDefault();
        actionRefs.current.prevStep();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [activeTour, activeTourId, currentStepIdx, showWelcome, isOpen]);

  const startTour = (tourId) => {
    if (!modules[tourId]) tourId = "all";
    setActiveTourId(tourId);
    setCurrentStepIdx(0);
    setIsOpen(false);
    setOnboarding((current) => current ? {
      ...current,
      welcomeSeen: true,
      tourStatus: "in_progress",
    } : current);
  };

  const nextStep = () => {
    if (!activeTour) return;
    if (currentStepIdx < activeTour.steps.length - 1) {
      setCurrentStepIdx((i) => i + 1);
    } else {
      finishTour();
    }
  };

  const prevStep = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((i) => i - 1);
    }
  };

  const finishTour = () => {
    setOnboarding((current) => current ? {
      ...current,
      welcomeSeen: true,
      tourStatus: "completed",
    } : current);
    setActiveTourId(null);
    setCurrentStepIdx(0);
    setSpotlightRect(null);
  };

  const skipTour = () => {
    setOnboarding((current) => current ? {
      ...current,
      welcomeSeen: true,
      tourStatus: "skipped",
    } : current);
    setActiveTourId(null);
    setCurrentStepIdx(0);
    setSpotlightRect(null);
  };

  const dismissWelcome = () => {
    setOnboarding((current) => current ? {
      ...current,
      welcomeSeen: true,
      tourStatus: "skipped",
    } : current);
  };

  actionRefs.current = { startTour, nextStep, prevStep, finishTour, skipTour, dismissWelcome };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    const query = chatInput.toLowerCase().trim();
    if (!query) return;

    if (query.includes("dpr") || query.includes("daily")) {
      startTour("dpr");
    } else if (query.includes("wpr") || query.includes("weekly")) {
      startTour("wpr");
    } else if (query.includes("svr") || query.includes("site report") || query.includes("site visit") || query.includes("inspection")) {
      startTour("svr");
    } else if (query.includes("clock") || query.includes("punch") || query.includes("attend") || query.includes("qr") || query.includes("time")) {
      startTour("clock");
    } else if (query.includes("leave") || query.includes("chhutti") || query.includes("holiday") || query.includes("sick") || query.includes("casual")) {
      startTour("leave");
    } else if (query.includes("approve") || query.includes("accept") || query.includes("reject")) {
      startTour("leave");
    } else if (query.includes("material") || query.includes("arrived") || query.includes("challan") || query.includes("cement") || query.includes("steel")) {
      startTour("material");
    } else if (query.includes("submission") || query.includes("head") || query.includes("incharge")) {
      startTour(modules.submissions ? "submissions" : "all");
    } else {
      startTour("all");
    }
    setChatInput("");
  };

  return (
    <>
      {showWelcome && (
        <div className="stg-welcome-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) dismissWelcome();
        }}>
          <section className="stg-welcome-modal" role="dialog" aria-modal="true" aria-labelledby="stg-welcome-title" aria-describedby="stg-welcome-copy">
            <button className="stg-welcome-close" type="button" aria-label="Close welcome dialog" onClick={dismissWelcome}>×</button>
            <div className="stg-welcome-mark" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 20h18M5 20V8l7-4 7 4v12M9 20v-6h6v6M8 10h.01M16 10h.01" />
              </svg>
            </div>
            <p className="stg-welcome-eyebrow">SITE PORTAL</p>
            <h2 id="stg-welcome-title">Welcome aboard{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</h2>
            <p id="stg-welcome-copy">Take a quick tour of your site workspace, from attendance and daily reports to your account settings.</p>
            <div className="stg-welcome-actions">
              <button ref={welcomeStartRef} type="button" className="stg-welcome-primary" onClick={() => startTour("intro")}>Start Tour</button>
              <button type="button" className="stg-welcome-secondary" onClick={dismissWelcome}>Maybe Later</button>
            </div>
          </section>
        </div>
      )}

      {/* ── BOT MODAL / OPT-IN LAUNCHER ── */}
      {isOpen && (
        <div className="stg-backdrop" onClick={() => setIsOpen(false)}>
          <div className="stg-modal" role="dialog" aria-modal="true" aria-label="Site Guide and Operations Tour" onClick={(e) => e.stopPropagation()}>
            <div className="stg-modal-header">
              <div className="stg-bot-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                  <rect x="4" y="8" width="16" height="12" rx="4" />
                  <circle cx="9" cy="13" r="1.5" fill="currentColor" />
                  <circle cx="15" cy="13" r="1.5" fill="currentColor" />
                  <path d="M10 17h4" />
                </svg>
              </div>
              <div className="stg-modal-titles">
                <div className="stg-modal-title">Site Guide & Operations Tour</div>
                <div className="stg-modal-sub">
                  Role: <strong>{user?.role || "Site Engineer"}</strong> · Pick any operation or type below
                </div>
              </div>
              <button className="stg-close-btn" onClick={() => setIsOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            {/* Natural Chat Query Input */}
            <form onSubmit={handleChatSubmit} className="stg-chat-form">
              <div className="stg-input-wrap">
                <span className="stg-search-icon">💬</span>
                <input
                  type="text"
                  className="stg-chat-input"
                  placeholder="Type e.g. 'dpr', 'clock in out', 'wpr', 'svr', 'leave'..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="stg-chat-go-btn">
                  Start Tour →
                </button>
              </div>
            </form>

            {/* Quick Opt-in Grid of Modules */}
            <div className="stg-optin-list">
              <div className="stg-optin-heading">Select an operation to walk through:</div>

              <div className="stg-card-opt" onClick={() => startTour("all")}>
                <div className="stg-card-badge all">Full Tour</div>
                <div className="stg-card-info">
                  <strong>Complete Role Walkthrough (All Your Menus)</strong>
                  <span>Walks through all menus and operations available for {user?.role || "your role"}.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("clock")}>
                <div className="stg-card-badge clock">Clock In/Out</div>
                <div className="stg-card-info">
                  <strong>How to Punch Attendance (Selfie + GPS)</strong>
                  <span>Morning punch-in, QR option, evening checkpoint remarks & calendar records.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("dpr")}>
                <div className="stg-card-badge dpr">DPR Form</div>
                <div className="stg-card-info">
                  <strong>How to Fill & Submit Daily Progress Reports</strong>
                  <span>Morning target plan, evening actual progress, contractor manpower & site photos.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("wpr")}>
                <div className="stg-card-badge wpr">WPR Report</div>
                <div className="stg-card-info">
                  <strong>How to Generate Weekly Reports (WPR)</strong>
                  <span>Consolidating weekly DPR entries, selecting milestone photos & exporting PDF.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("svr")}>
                <div className="stg-card-badge svr">{isSiteEngineer ? "Quality Audit" : "SVR Audit"}</div>
                <div className="stg-card-info">
                  <strong>{isSiteEngineer ? "How to Complete Quality Audits" : "How to Conduct & Submit Site Visit Reports"}</strong>
                  <span>{isSiteEngineer ? "Recording quality observations, non-conformances, and supporting photos." : "Site visit observations, safety concerns, and report submission."}</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("manpower")}>
                <div className="stg-card-badge material">Manpower</div>
                <div className="stg-card-info">
                  <strong>How to Review Manpower Reports</strong>
                  <span>Inspect daily workforce counts and manpower trends across trades.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("ea-meeting")}>
                <div className="stg-card-badge clock">EA Meeting</div>
                <div className="stg-card-info">
                  <strong>How to Record EA Meeting Attendance</strong>
                  <span>Use the navbar QR scanner to scan the EA meeting attendance code.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("leave")}>
                <div className="stg-card-badge leave">Leaves</div>
                <div className="stg-card-info">
                  <strong>How to Apply, Track & Approve Leaves</strong>
                  <span>Checking quota balance, submitting dates, and {modules.submissions || isApprover ? "approving subordinate requests" : "monitoring approval steps"}.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              <div className="stg-card-opt" onClick={() => startTour("material")}>
                <div className="stg-card-badge material">Material</div>
                <div className="stg-card-info">
                  <strong>How to Log Arrived Material Receipts</strong>
                  <span>Recording cement/steel deliveries, PO quantities, and challan uploads.</span>
                </div>
                <span className="stg-arrow">→</span>
              </div>

              {modules.submissions && (
                <div className="stg-card-opt" onClick={() => startTour("submissions")}>
                  <div className="stg-card-badge head">Submissions</div>
                  <div className="stg-card-info">
                    <strong>Report Submissions & Managerial Oversight</strong>
                    <span>Reviewing all site engineers' DPRs, WPRs & SVRs with quick PDF downloads.</span>
                  </div>
                  <span className="stg-arrow">→</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SPOTLIGHT OVERLAY & ACTIONABLE HOW-TO BALLOON ── */}
      {activeTour && (
        <div className="stg-spotlight-backdrop" aria-live="polite">
          {/* Spotlight cutout highlight */}
          {spotlightRect && (
            <div
              className="stg-spotlight-hole"
              aria-hidden="true"
              style={{
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.left}px`,
                width: `${spotlightRect.width}px`,
                height: `${spotlightRect.height}px`,
              }}
            />
          )}

          {/* Actionable Balloon Popover */}
          <div
            className="stg-popover"
            role="dialog"
            aria-labelledby="stg-popover-title"
            style={
              window.innerWidth <= 600
                ? {
                    bottom: "16px",
                    left: "12px",
                    right: "12px",
                    width: "auto",
                    maxWidth: "none",
                    top: "auto",
                  }
                : spotlightRect
                ? {
                    top: `${Math.min(
                      window.innerHeight - 340,
                      Math.max(20, spotlightRect.top + (spotlightRect.height > 160 ? 20 : spotlightRect.height + 14))
                    )}px`,
                    left: `${Math.min(
                      window.innerWidth - 420,
                      Math.max(16, spotlightRect.left + (spotlightRect.width > 280 ? 20 : 0))
                    )}px`,
                  }
                : {
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }
            }
          >
            <div className="stg-popover-header">
              <span className="stg-popover-tag">{currentStep?.badge || activeTour.tag}</span>
              <span className="stg-popover-progress" aria-label={`Step ${currentStepIdx + 1} of ${activeTour.steps.length}`}>
                Step {currentStepIdx + 1} of {activeTour.steps.length}
              </span>
              <button className="stg-popover-close" onClick={skipTour} title="Skip tour" aria-label="Skip tour">
                ✕
              </button>
            </div>

            <div className="stg-popover-body">
              <h4 className="stg-popover-title" id="stg-popover-title">{currentStep?.title}</h4>
              <p className="stg-popover-desc">{currentStep?.desc}</p>

              {/* Actionable "How you perform this" steps */}
              {currentStep?.howTo && (
                <div className="stg-howto-card">
                  <div className="stg-howto-header">
                    <span>⚡ How to perform here:</span>
                  </div>
                  <ol className="stg-howto-list">
                    {currentStep.howTo.map((item, idx) => (
                      <li key={idx} className="stg-howto-item">{item}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="stg-popover-footer">
              <button
                type="button"
                className="stg-btn-prev"
                onClick={prevStep}
                disabled={currentStepIdx === 0}
              >
                Back
              </button>

              <button type="button" className="stg-btn-skip" onClick={skipTour}>Skip Tour</button>

              <div className="stg-step-dots">
                {activeTour.steps.map((_, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className={`stg-dot${idx === currentStepIdx ? " active" : ""}`}
                    onClick={() => setCurrentStepIdx(idx)}
                    aria-label={`Jump to step ${idx + 1}`}
                    aria-current={idx === currentStepIdx ? "step" : undefined}
                  />
                ))}
              </div>

              <button type="button" className="stg-btn-next" onClick={nextStep}>
                {currentStepIdx === activeTour.steps.length - 1 ? "Got it! Finish" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
