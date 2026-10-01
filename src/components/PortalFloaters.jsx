import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { supabase } from "../supabase";
import { answerDipQuery, DIP_CHIPS, DIP_HR_CHIPS, DIP_SITE_CHIPS, DIP_OFFICE_CHIPS } from "../lib/dipBot";
import { BillActions, fillArrivedMaterialBook, uploadMaterialBill } from "./MaterialBill";
import logoUrl from "../assets/logo.png";
import "./PortalFloaters.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function roomIdFor(a, b) {
  return [String(a || ""), String(b || "")].sort().join("::");
}

function roomForPeer(me, peer) {
  if (peer?.isGroup) return `group::${peer.id}`;
  return roomIdFor(me, peer?.username);
}

const GROUP_READS_KEY = (username) => `pf-group-reads:${username || ""}`;
const SYSTEM_NOTICE_TTL_MS = 24 * 60 * 60 * 1000;

function loadLocalGroupReads(username) {
  if (!username) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(GROUP_READS_KEY(username)) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveLocalGroupRead(username, roomId, last_read_at) {
  if (!username || !roomId || !last_read_at) return;
  const map = loadLocalGroupReads(username);
  const prev = map[roomId];
  if (!prev || new Date(last_read_at).getTime() > new Date(prev).getTime()) {
    map[roomId] = last_read_at;
    localStorage.setItem(GROUP_READS_KEY(username), JSON.stringify(map));
  }
}

function isExpiredSystemNotice(message) {
  if (message?.sender_username !== "system") return false;
  const created = new Date(message.created_at).getTime();
  if (Number.isNaN(created)) return true;
  return Date.now() - created >= SYSTEM_NOTICE_TTL_MS;
}

function keepChatMessage(message) {
  if (!message) return false;
  if (message.sender_username === "system") return !isExpiredSystemNotice(message);
  return true;
}

async function cleanupExpiredSystemNotices() {
  const cutoff = new Date(Date.now() - SYSTEM_NOTICE_TTL_MS).toISOString();
  await supabase
    .from("portal_chat_messages")
    .delete()
    .eq("sender_username", "system")
    .lt("created_at", cutoff);
}

async function markRoomRead(roomId, username, latestMessageAt) {
  if (!roomId || !username) return { error: null, last_read_at: null };
  const nowMs = Date.now();
  const latestMs = latestMessageAt ? new Date(latestMessageAt).getTime() : 0;
  // Stay ahead of message timestamps so server/client clock skew cannot leave badges stuck.
  const last_read_at = new Date(Math.max(nowMs, latestMs) + 5000).toISOString();
  saveLocalGroupRead(username, roomId, last_read_at);

  let { error } = await supabase.from("portal_chat_room_reads").upsert(
    { room_id: roomId, username, last_read_at },
    { onConflict: "room_id,username" },
  );
  if (error) {
    const upd = await supabase
      .from("portal_chat_room_reads")
      .update({ last_read_at })
      .eq("room_id", roomId)
      .eq("username", username)
      .select("room_id");
    if (!upd.error && upd.data?.length) {
      error = null;
    } else {
      const ins = await supabase
        .from("portal_chat_room_reads")
        .insert({ room_id: roomId, username, last_read_at });
      error = ins.error;
    }
  }
  return { error, last_read_at };
}

function clamp(n, min, max) {
  return Math.round(Math.min(max, Math.max(min, n)));
}

function readPanelSize(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved?.w && saved?.h) return saved;
  } catch {
    /* ignore bad saved size */
  }
  return { w: 420, h: 560 };
}

function usePanelSize(storageKey) {
  const [size, setSize] = useState(() => readPanelSize(storageKey));
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onResizeStart = (e) => {
    if (window.innerWidth <= 760) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...sizeRef.current };
    const move = (ev) => {
      const maxW = Math.max(340, window.innerWidth - 36);
      const maxH = Math.max(420, window.innerHeight - 156);
      const next = {
        w: clamp(start.w + (startX - ev.clientX), 340, maxW),
        h: clamp(start.h + (startY - ev.clientY), 420, maxH),
      };
      sizeRef.current = next;
      setSize(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      localStorage.setItem(storageKey, JSON.stringify(sizeRef.current));
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "nwse-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return { size, onResizeStart };
}

/** Pin floating panels inside the mobile visual viewport (above keyboard). */
function useMobileViewportLock() {
  const [vvStyle, setVvStyle] = useState(null);

  useEffect(() => {
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mobile = window.matchMedia("(max-width: 760px)").matches;
        if (!mobile) {
          setVvStyle(null);
          return;
        }
        const vv = window.visualViewport;
        const height = vv?.height ?? window.innerHeight;
        const width = vv?.width ?? window.innerWidth;
        const offsetTop = vv?.offsetTop ?? 0;
        const offsetLeft = vv?.offsetLeft ?? 0;
        const layoutH = window.innerHeight;
        const keyboardOpen = layoutH - height > 50 || offsetTop > 0;
        // Full visible height with keyboard; bottom sheet otherwise.
        const sheetH = Math.max(
          280,
          Math.round(keyboardOpen ? height : Math.min(height * 0.86, height - 8)),
        );
        const top = Math.round(offsetTop + Math.max(0, height - sheetH));
        setVvStyle({
          top: `${top}px`,
          left: `${offsetLeft}px`,
          right: "auto",
          bottom: "auto",
          width: `${Math.round(width)}px`,
          height: `${sheetH}px`,
          maxHeight: `${sheetH}px`,
          borderRadius: keyboardOpen ? "0px" : "16px 16px 0 0",
        });
      });
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return vvStyle;
}

/** Scroll only the message list — never the page/header (unlike scrollIntoView). */
function scrollBodyToEnd(bodyEl) {
  if (!bodyEl) return;
  if (bodyEl.scrollHeight <= bodyEl.clientHeight + 8) return;
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

/** Stop the browser from scrolling the page when the composer is focused. */
function holdWindowScroll() {
  const x = window.scrollX;
  const y = window.scrollY;
  requestAnimationFrame(() => {
    window.scrollTo(x, y);
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}

function formatChatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const NAME_COLORS = [
  "#1d4ed8",
  "#c2410c",
  "#047857",
  "#7c3aed",
  "#be185d",
  "#0f766e",
  "#b45309",
  "#4338ca",
  "#b91c1c",
  "#0369a1",
];

function nameColor(key) {
  const s = String(key || "user");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function SeenTicks({ seen, light }) {
  return (
    <span
      className={`pf-ticks${seen ? " is-seen" : ""}${light ? " is-light" : ""}`}
      title={seen ? "Seen" : "Sent"}
    >
      <svg viewBox="0 0 18 11" width="16" height="11" aria-hidden="true">
        <path d="M1 6.2 4.2 9.2 10 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.2 6.2 9.4 9.2 16.2 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {seen ? <span>Seen</span> : null}
    </span>
  );
}

function ResizablePanel({ storageKey, label, className = "", children }) {
  const { size, onResizeStart } = usePanelSize(storageKey);
  const vvStyle = useMobileViewportLock();
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const panelStyle = {
    "--pf-wm": `url(${logoUrl})`,
    ...(vvStyle
      ? vvStyle
      : isMobile
        ? {}
        : { width: size.w, height: size.h }),
  };

  return (
    <div
      className={`pf-panel${className ? ` ${className}` : ""}${vvStyle ? " is-mobile-sheet" : ""}`}
      role="dialog"
      aria-label={label}
      style={panelStyle}
    >
      <button
        type="button"
        className="pf-resize"
        aria-label="Drag to resize"
        title="Drag to resize"
        onPointerDown={onResizeStart}
      />
      {children}
    </div>
  );
}

function Ico({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (name === "bot") {
    return (
      <svg {...common}>
        <rect x="5" y="8" width="14" height="10" rx="3" />
        <path d="M12 8V5M9 13h.01M15 13h.01M8 19v1M16 19v1" />
        <circle cx="12" cy="5" r="1" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg {...common}>
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </svg>
    );
  }
  if (name === "close") {
    return (
      <svg {...common}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  if (name === "back") {
    return (
      <svg {...common}>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    );
  }
  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === "people-plus") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    );
  }
  if (name === "people-minus") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    );
  }
  if (name === "chevron-down") {
    return (
      <svg {...common}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  }
  if (name === "exit") {
    return (
      <svg {...common}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    );
  }
  if (name === "rename") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ResultTable({ columns, rows }) {
  const [visible, setVisible] = useState(20);
  if (!columns?.length || !rows?.length) return null;
  const shown = rows.slice(0, visible);
  const remaining = rows.length - shown.length;
  const nextCount = Math.min(10, remaining);
  return (
    <>
      <div className="pf-table-wrap">
        <table className="pf-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>{row[c] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <button
          type="button"
          className="pf-load-more"
          onClick={() => setVisible((count) => count + 10)}
        >
          Load more ({nextCount})
        </button>
      )}
    </>
  );
}

function DipPanel({ user, onClose, scope = "admin" }) {
  const chips = scope === "hr" ? DIP_HR_CHIPS : scope === "site" ? DIP_SITE_CHIPS : scope === "office" ? DIP_OFFICE_CHIPS : DIP_CHIPS;
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text:
        scope === "hr"
          ? `Hi${user?.name ? ` ${user.name}` : ""}, I’m DIP Bot for HR. Ask me about employees, attendance, leaves, expenses, or documents.`
          : scope === "site"
            ? `Hi${user?.name ? ` ${user.name}` : ""}, I’m DIP Bot for your sites. Ask me about daily and weekly reports, site visits, arrived material, tasks, or leave.`
            : scope === "office"
              ? `Hi${user?.name ? ` ${user.name}` : ""}, I’m DIP Bot. Ask me about your profile, tasks, leave, attendance, or tickets.`
              : `Hi${user?.name ? ` ${user.name}` : ""}, I’m DIP Bot. Ask me who is on leave, task lists, delegated work, tickets, or anything else in this portal.`,
      chips,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    scrollBodyToEnd(bodyRef.current);
  }, [messages, busy]);

  const send = async (value) => {
    const text = String(value || draft).trim();
    if (!text || busy) return;
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    try {
      const history = messages
        .filter((item) => item.text && (item.role === "user" || item.role === "bot"))
        .slice(-6)
        .map((item) => ({ role: item.role === "bot" ? "assistant" : "user", content: item.text }));
      const answer = await answerDipQuery(text, user, { scope, history });
      setMessages((prev) => [...prev, { role: "bot", ...answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: err.message || "Something went wrong while fetching data." },
      ]);
    }
    setBusy(false);
  };

  return (
    <ResizablePanel storageKey="pf-size-bot" label="DIP Bot">
      <div className="pf-head pf-head-dip">
        <div className="pf-head-avatar">
          <Ico name="bot" />
        </div>
        <div className="pf-head-copy">
          <div className="pf-head-title">DIP Bot</div>
          <div className="pf-head-sub">
            {scope === "hr"
              ? "Ask about employees, attendance, leaves & HR data"
              : scope === "site"
                ? "Ask about your sites, reports, material & tasks"
                : scope === "office"
                  ? "Ask about your profile, tasks, leave & attendance"
                  : "Ask about leaves, tasks, tickets & people"}
          </div>
        </div>
        <button className="pf-icon-btn" onClick={onClose} aria-label="Close DIP Bot">
          <Ico name="close" />
        </button>
      </div>
      <div className="pf-body pf-wm" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={`pf-msg ${m.role === "user" ? "pf-msg-user" : ""}`}>
            <div className={`pf-bubble ${m.role === "user" ? "pf-bubble-user" : "pf-bubble-bot"}`}>
              {m.text}
              <ResultTable columns={m.columns} rows={m.rows} />
              {m.role === "bot" && m.chips?.length ? (
                <div className="pf-chips">
                  {m.chips.map((c) => (
                    <button key={c} className="pf-chip" onClick={() => send(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy && (
          <div className="pf-msg">
            <div className="pf-bubble pf-bubble-bot">
              <div className="pf-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>
      <form
        className="pf-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="pf-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={holdWindowScroll}
          placeholder={
            scope === "hr"
              ? "Ask about leave, attendance, employees…"
              : "Ask DIP Bot…"
          }
          autoFocus
          enterKeyHint="send"
        />
        <button className="pf-send" disabled={busy || !draft.trim()} aria-label="Send">
          <Ico name="send" />
        </button>
      </form>
    </ResizablePanel>
  );
}

function ChatPanel({
  user,
  onClose,
  unreadByUser,
  unreadByGroup = {},
  refreshUnread,
  onGroupOpened,
}) {
  const me = user?.user_name || user?.username;
  const [people, setPeople] = useState([]);
  const [tab, setTab] = useState("users");
  const [threads, setThreads] = useState([]);
  const [query, setQuery] = useState("");
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [setupError, setSetupError] = useState("");
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState(false);
  const [removingFromGroup, setRemovingFromGroup] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [memberVisibleCount, setMemberVisibleCount] = useState(5);
  const [transferringCreator, setTransferringCreator] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [groupName, setGroupName] = useState("");
  const [pickedUsers, setPickedUsers] = useState({});
  const [groupSaving, setGroupSaving] = useState(false);
  const bodyRef = useRef(null);
  const peerRef = useRef(null);
  const membersScrollRef = useRef(null);
  peerRef.current = peer;

  useEffect(() => {
    scrollBodyToEnd(bodyRef.current);
  }, [messages, peer]);

  const loadPeople = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_details")
      .select("id, name, username, role, department")
      .order("name", { ascending: true });
    if (error) {
      setSetupError(error.message);
      return;
    }
    setPeople((data || []).filter((p) => p.username && p.username !== me));
  }, [me]);

  const loadChats = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase
      .from("portal_chat_messages")
      .select(
        "id, room_id, sender_username, sender_name, recipient_username, body, read_at, created_at",
      )
      .or(`sender_username.eq."${me}",recipient_username.eq."${me}"`)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) {
      setSetupError(error.message);
      return;
    }
    const byUser = new Map();
    (data || []).forEach((row) => {
      if (String(row.room_id || "").startsWith("group::")) return;
      const other =
        row.sender_username === me ? row.recipient_username : row.sender_username;
      if (!other || other === "group" || byUser.has(other)) return;
      byUser.set(other, row);
    });
    setThreads([...byUser.entries()].map(([username, last]) => ({ username, last })));

    const { data: memberships, error: memberError } = await supabase
      .from("portal_chat_group_members")
      .select("group_id")
      .eq("username", me);
    if (memberError) {
      setGroups([]);
      return;
    }
    const groupIds = [...new Set((memberships || []).map((row) => row.group_id).filter(Boolean))];
    if (!groupIds.length) {
      setGroups([]);
      return;
    }
    const [{ data: groupRows }, { data: memberRows }, { data: groupMessages }] = await Promise.all([
      supabase.from("portal_chat_groups").select("*").in("id", groupIds),
      supabase
        .from("portal_chat_group_members")
        .select("group_id, username, member_name")
        .in("group_id", groupIds),
      supabase
        .from("portal_chat_messages")
        .select("id, room_id, sender_username, sender_name, body, created_at")
        .in("room_id", groupIds.map((id) => `group::${id}`))
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    const membersByGroup = {};
    (memberRows || []).forEach((row) => {
      membersByGroup[row.group_id] = membersByGroup[row.group_id] || [];
      membersByGroup[row.group_id].push(row);
    });
    const lastByRoom = {};
    (groupMessages || []).forEach((row) => {
      if (!keepChatMessage(row)) return;
      if (!lastByRoom[row.room_id]) lastByRoom[row.room_id] = row;
    });
    setGroups(
      (groupRows || [])
        .map((group) => ({
          ...group,
          isGroup: true,
          members: membersByGroup[group.id] || [],
          last: lastByRoom[`group::${group.id}`] || null,
        }))
        .sort((a, b) => {
          const at = new Date(a.last?.created_at || a.created_at || 0).getTime();
          const bt = new Date(b.last?.created_at || b.created_at || 0).getTime();
          return bt - at;
        }),
    );
  }, [me]);

  useEffect(() => {
    loadPeople();
    loadChats();
    cleanupExpiredSystemNotices();
  }, [loadPeople, loadChats]);

  const openPerson = (person) => {
    if (!person?.username) return;
    setPeer(person);
  };

  const loadThread = useCallback(
    async (other) => {
      if (!me || (!other?.username && !other?.isGroup)) return;
      const room = roomForPeer(me, other);
      const { data, error } = await supabase
        .from("portal_chat_messages")
        .select("*")
        .eq("room_id", room)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) {
        setSetupError(error.message);
        setMessages([]);
        return;
      }
      setSetupError("");
      const readAt = new Date().toISOString();
      const visible = (data || []).filter(keepChatMessage);
      if (other.isGroup) {
        setMessages(visible);
        const latest = visible.length
          ? visible[visible.length - 1].created_at
          : data?.length
            ? data[data.length - 1].created_at
            : null;
        onGroupOpened?.(other.id);
        const marked = await markRoomRead(room, me, latest);
        if (marked?.last_read_at) onGroupOpened?.(other.id, marked.last_read_at);
        await refreshUnread();
        loadChats();
        cleanupExpiredSystemNotices();
        return;
      }
      const unreadIds = visible
        .filter((m) => m.recipient_username === me && !m.read_at)
        .map((m) => m.id);
      setMessages(
        visible.map((m) =>
          unreadIds.includes(m.id) ? { ...m, read_at: readAt } : m,
        ),
      );
      if (unreadIds.length) {
        await supabase
          .from("portal_chat_messages")
          .update({ read_at: readAt })
          .in("id", unreadIds);
        refreshUnread();
        loadChats();
      }
    },
    [me, refreshUnread, loadChats, onGroupOpened],
  );

  useEffect(() => {
    if (peer) loadThread(peer);
  }, [peer, loadThread]);

  useEffect(() => {
    if (!peer || peer.isGroup || !me) return undefined;
    const room = roomForPeer(me, peer);
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("portal_chat_messages")
        .select("id, read_at")
        .eq("room_id", room)
        .eq("sender_username", me);
      if (!data) return;
      const seen = new Map(data.map((row) => [row.id, row.read_at]));
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (!seen.has(m.id) || m.read_at === seen.get(m.id)) return m;
          changed = true;
          return { ...m, read_at: seen.get(m.id) };
        });
        return changed ? next : prev;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [peer, me]);

  useEffect(() => {
    if (!me) return undefined;
    const channel = supabase
      .channel("portal-chat-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portal_chat_messages" },
        (payload) => {
          const row = payload.new;
          const current = peerRef.current;
          const inOpenRoom =
            current && row.room_id === roomForPeer(me, current);

          if (inOpenRoom) {
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) || !keepChatMessage(row)
                ? prev
                : [...prev, row],
            );
            if (current.isGroup) {
              onGroupOpened?.(current.id);
              markRoomRead(row.room_id, me, row.created_at).then(async (marked) => {
                if (marked?.last_read_at) onGroupOpened?.(current.id, marked.last_read_at);
                await refreshUnread();
                loadChats();
              });
            } else if (row.recipient_username === me && !row.read_at) {
              const readAt = new Date().toISOString();
              setMessages((prev) =>
                prev.map((m) => (m.id === row.id ? { ...m, read_at: readAt } : m)),
              );
              supabase
                .from("portal_chat_messages")
                .update({ read_at: readAt })
                .eq("id", row.id)
                .then(() => {
                  refreshUnread();
                  loadChats();
                });
            } else {
              loadChats();
            }
            return;
          }

          if (
            row.recipient_username === me ||
            row.sender_username === me ||
            String(row.room_id || "").startsWith("group::")
          ) {
            refreshUnread();
            loadChats();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "portal_chat_messages" },
        (payload) => {
          const row = payload.new;
          const current = peerRef.current;
          if (current && row.room_id === roomForPeer(me, current)) {
            setMessages((prev) =>
              prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)),
            );
          }
          if (row.sender_username === me || row.recipient_username === me) {
            loadChats();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, refreshUnread, loadChats, onGroupOpened]);

  const personByUsername = useMemo(() => {
    const map = {};
    people.forEach((p) => {
      map[p.username] = p;
    });
    return map;
  }, [people]);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = people.filter((p) => {
      if (!q) return true;
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.username || "").toLowerCase().includes(q) ||
        String(p.role || "").toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) => {
      const ua = unreadByUser[a.username] || 0;
      const ub = unreadByUser[b.username] || 0;
      if (ub !== ua) return ub - ua;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [people, query, unreadByUser]);

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter(({ username, last }) => {
      if (!q) return true;
      const person = personByUsername[username];
      const name = String(person?.name || last.sender_name || username).toLowerCase();
      return name.includes(q) || String(username).toLowerCase().includes(q);
    });
  }, [threads, query, personByUsername]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((group) => {
      if (!q) return true;
      return String(group.name || "").toLowerCase().includes(q);
    });
  }, [groups, query]);

  const pickedList = people.filter((person) => pickedUsers[person.username]);

  const togglePick = (username) => {
    setPickedUsers((prev) => {
      const next = { ...prev };
      if (next[username]) delete next[username];
      else next[username] = true;
      return next;
    });
  };

  const openCreateGroup = () => {
    setPeer(null);
    setAddingToGroup(false);
    setRemovingFromGroup(false);
    setTransferringCreator(false);
    setGroupDetailsOpen(false);
    setQuery("");
    setGroupName("");
    setPickedUsers({});
    setCreatingGroup(true);
  };

  const openAddToGroup = () => {
    if (!peer?.isGroup) return;
    const creator =
      liveGroup?.created_by_username || peer.created_by_username;
    if (creator && creator !== me) {
      setSetupError("Only the group creator can add people.");
      return;
    }
    setGroupDetailsOpen(false);
    setRemovingFromGroup(false);
    setTransferringCreator(false);
    setQuery("");
    setPickedUsers({});
    setAddingToGroup(true);
  };

  const openRemoveFromGroup = () => {
    if (!peer?.isGroup) return;
    const creator =
      liveGroup?.created_by_username || peer.created_by_username;
    if (creator && creator !== me) {
      setSetupError("Only the group creator can remove people.");
      return;
    }
    setGroupDetailsOpen(false);
    setAddingToGroup(false);
    setTransferringCreator(false);
    setQuery("");
    setPickedUsers({});
    setRemovingFromGroup(true);
  };

  const openGroupDetails = () => {
    if (!peer?.isGroup) return;
    setMemberVisibleCount(5);
    setRenameDraft(peer.name || "");
    setTransferringCreator(false);
    setSetupError("");
    setGroupDetailsOpen(true);
  };

  const openTransferCreator = () => {
    if (!peer?.isGroup) return;
    setGroupDetailsOpen(false);
    setAddingToGroup(false);
    setRemovingFromGroup(false);
    setQuery("");
    setPickedUsers({});
    setSetupError("");
    setTransferringCreator(true);
  };

  const existingMemberSet = useMemo(() => {
    const set = new Set();
    if (peer?.isGroup) {
      (peer.members || []).forEach((m) => {
        if (m.username) set.add(m.username);
      });
    }
    const live = groups.find((g) => g.id === peer?.id);
    (live?.members || []).forEach((m) => {
      if (m.username) set.add(m.username);
    });
    if (me) set.add(me);
    return set;
  }, [peer, groups, me]);

  const candidatesForAdd = useMemo(() => {
    if (!addingToGroup) return filteredPeople;
    return filteredPeople.filter((p) => !existingMemberSet.has(p.username));
  }, [addingToGroup, filteredPeople, existingMemberSet]);

  const groupMemberNames = useMemo(() => {
    if (!peer?.isGroup) return [];
    const live = groups.find((g) => g.id === peer.id);
    const rows = live?.members?.length ? live.members : peer.members || [];
    const names = rows.map((row) => {
      const person = personByUsername[row.username];
      return {
        username: row.username,
        name: person?.name || row.member_name || row.username,
      };
    });
    return names.sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }),
    );
  }, [peer, groups, personByUsername]);

  useEffect(() => {
    const el = membersScrollRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [
    peer?.id,
    groupMemberNames.length,
    addingToGroup,
    creatingGroup,
    removingFromGroup,
    transferringCreator,
    groupDetailsOpen,
  ]);

  const candidatesForRemove = useMemo(() => {
    if (!removingFromGroup || !peer?.isGroup) return [];
    const q = query.trim().toLowerCase();
    return groupMemberNames
      .filter((m) => m.username !== me)
      .filter((m) => {
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          String(m.username || "").toLowerCase().includes(q)
        );
      })
      .map((m) => ({
        username: m.username,
        name: m.name,
        id: m.username,
      }));
  }, [removingFromGroup, peer, groupMemberNames, me, query]);

  const candidatesForTransfer = useMemo(() => {
    if (!transferringCreator || !peer?.isGroup) return [];
    const q = query.trim().toLowerCase();
    return groupMemberNames
      .filter((m) => m.username !== me)
      .filter((m) => {
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          String(m.username || "").toLowerCase().includes(q)
        );
      })
      .map((m) => ({
        username: m.username,
        name: m.name,
        id: m.username,
      }));
  }, [transferringCreator, peer, groupMemberNames, me, query]);

  const liveGroup = peer?.isGroup
    ? groups.find((g) => g.id === peer.id) || peer
    : null;

  const groupCreatorUsername =
    liveGroup?.created_by_username || peer?.created_by_username || "";
  const isGroupCreator = !!(peer?.isGroup && me && groupCreatorUsername === me);

  const pickerList = transferringCreator
    ? candidatesForTransfer
    : removingFromGroup
      ? candidatesForRemove
      : addingToGroup
        ? candidatesForAdd
        : filteredPeople;

  const pickForTransfer = (username) => {
    setPickedUsers({ [username]: true });
  };

  const createGroup = async () => {
    const name = groupName.trim();
    const members = pickedList;
    if (!name || !members.length || !me || groupSaving) return;
    setGroupSaving(true);
    const { data: group, error } = await supabase
      .from("portal_chat_groups")
      .insert({
        name,
        created_by_username: me,
        created_by_name: user?.name || me,
      })
      .select("*")
      .single();
    if (error) {
      setGroupSaving(false);
      setSetupError(error.message);
      return;
    }
    const memberRows = [
      { group_id: group.id, username: me, member_name: user?.name || me },
      ...members.map((person) => ({
        group_id: group.id,
        username: person.username,
        member_name: person.name || person.username,
      })),
    ];
    const { error: memberError } = await supabase
      .from("portal_chat_group_members")
      .insert(memberRows);
    setGroupSaving(false);
    if (memberError) {
      setSetupError(memberError.message);
      return;
    }
    setSetupError("");
    setCreatingGroup(false);
    setTab("chats");
    setPeer({
      isGroup: true,
      id: group.id,
      name: group.name,
      created_at: group.created_at,
      created_by_username: group.created_by_username || me,
      created_by_name: group.created_by_name || user?.name || me,
      memberCount: memberRows.length,
      members: memberRows,
    });
    loadChats();
  };

  const renameGroup = async () => {
    const name = renameDraft.trim();
    if (!peer?.isGroup || !name || !me || groupSaving) return;
    if (!isGroupCreator) {
      setSetupError("Only the group creator can rename the group.");
      return;
    }
    if (name === peer.name) return;
    setGroupSaving(true);
    const { error } = await supabase
      .from("portal_chat_groups")
      .update({ name })
      .eq("id", peer.id);
    setGroupSaving(false);
    if (error) {
      setSetupError(error.message);
      return;
    }
    setSetupError("");
    setPeer((prev) => (prev ? { ...prev, name } : prev));
    loadChats();
  };

  const addMembersToGroup = async () => {
    const members = pickedList.filter((p) => !existingMemberSet.has(p.username));
    if (!peer?.isGroup || !members.length || !me || groupSaving) return;
    if (!isGroupCreator) {
      setSetupError("Only the group creator can add people.");
      return;
    }
    setGroupSaving(true);
    const memberRows = members.map((person) => ({
      group_id: peer.id,
      username: person.username,
      member_name: person.name || person.username,
    }));
    const { error: memberError } = await supabase
      .from("portal_chat_group_members")
      .insert(memberRows);
    if (memberError) {
      setGroupSaving(false);
      setSetupError(memberError.message);
      return;
    }
    const room = roomForPeer(me, peer);
    const noticeRows = members.map((person) => ({
      room_id: room,
      sender_username: "system",
      sender_name: "System",
      recipient_username: "group",
      body: `${person.name || person.username} is added to the group`,
      read_at: new Date().toISOString(),
    }));
    const { data: notices, error: noticeError } = await supabase
      .from("portal_chat_messages")
      .insert(noticeRows)
      .select("*");
    setGroupSaving(false);
    if (noticeError) {
      setSetupError(noticeError.message);
      return;
    }
    setSetupError("");
    setAddingToGroup(false);
    setPickedUsers({});
    setQuery("");
    setGroupDetailsOpen(true);
    setPeer((prev) =>
      prev
        ? {
            ...prev,
            members: [...(prev.members || []), ...memberRows],
            memberCount: (prev.memberCount || 0) + memberRows.length,
          }
        : prev,
    );
    if (notices?.length) {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...notices.filter((n) => !ids.has(n.id))];
      });
    }
    loadChats();
  };

  const removeMembersFromGroup = async () => {
    const members = pickedList.filter((p) => p.username !== me);
    if (!peer?.isGroup || !members.length || !me || groupSaving) return;
    if (!isGroupCreator) {
      setSetupError("Only the group creator can remove people.");
      return;
    }
    if (members.some((p) => p.username === groupCreatorUsername)) {
      setSetupError("Transfer creator to someone else before removing the creator.");
      return;
    }
    setGroupSaving(true);
    const usernames = members.map((p) => p.username);
    const { error: memberError } = await supabase
      .from("portal_chat_group_members")
      .delete()
      .eq("group_id", peer.id)
      .in("username", usernames);
    if (memberError) {
      setGroupSaving(false);
      setSetupError(memberError.message);
      return;
    }
    const room = roomForPeer(me, peer);
    const noticeRows = members.map((person) => ({
      room_id: room,
      sender_username: "system",
      sender_name: "System",
      recipient_username: "group",
      body: `${person.name || person.username} is removed from the group`,
      read_at: new Date().toISOString(),
    }));
    const { data: notices, error: noticeError } = await supabase
      .from("portal_chat_messages")
      .insert(noticeRows)
      .select("*");
    setGroupSaving(false);
    if (noticeError) {
      setSetupError(noticeError.message);
      return;
    }
    setSetupError("");
    setRemovingFromGroup(false);
    setPickedUsers({});
    setQuery("");
    setGroupDetailsOpen(true);
    setPeer((prev) => {
      if (!prev) return prev;
      const nextMembers = (prev.members || []).filter(
        (m) => !usernames.includes(m.username),
      );
      return {
        ...prev,
        members: nextMembers,
        memberCount: nextMembers.length,
      };
    });
    if (notices?.length) {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...notices.filter((n) => !ids.has(n.id))];
      });
    }
    loadChats();
  };

  const leaveGroupMembership = async () => {
    const room = roomForPeer(me, peer);
    const myName = user?.name || me;
    const { error: memberError } = await supabase
      .from("portal_chat_group_members")
      .delete()
      .eq("group_id", peer.id)
      .eq("username", me);
    if (memberError) {
      setGroupSaving(false);
      setSetupError(memberError.message);
      return false;
    }
    await supabase.from("portal_chat_messages").insert({
      room_id: room,
      sender_username: "system",
      sender_name: "System",
      recipient_username: "group",
      body: `${myName} left the group`,
      read_at: new Date().toISOString(),
    });
    setGroupSaving(false);
    setGroupDetailsOpen(false);
    setTransferringCreator(false);
    setAddingToGroup(false);
    setRemovingFromGroup(false);
    setPickedUsers({});
    setPeer(null);
    setTab("chats");
    loadChats();
    refreshUnread();
    return true;
  };

  const transferCreatorAndExit = async () => {
    const next = pickedList[0];
    if (!peer?.isGroup || !next || !me || groupSaving) return;
    if (!isGroupCreator) {
      setSetupError("Only the group creator can transfer ownership.");
      return;
    }
    if (!window.confirm(`Make ${next.name || next.username} the creator and exit "${peer.name}"?`)) {
      return;
    }
    setGroupSaving(true);
    const { error } = await supabase
      .from("portal_chat_groups")
      .update({
        created_by_username: next.username,
        created_by_name: next.name || next.username,
      })
      .eq("id", peer.id);
    if (error) {
      setGroupSaving(false);
      setSetupError(error.message);
      return;
    }
    const room = roomForPeer(me, peer);
    await supabase.from("portal_chat_messages").insert({
      room_id: room,
      sender_username: "system",
      sender_name: "System",
      recipient_username: "group",
      body: `${next.name || next.username} is now the group creator`,
      read_at: new Date().toISOString(),
    });
    await leaveGroupMembership();
  };

  const exitGroup = async () => {
    if (!peer?.isGroup || !me || groupSaving) return;
    const others = groupMemberNames.filter((m) => m.username !== me);
    if (isGroupCreator && others.length > 0) {
      openTransferCreator();
      return;
    }
    if (!window.confirm(`Exit "${peer.name}"?`)) return;
    setGroupSaving(true);
    await leaveGroupMembership();
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !peer || !me || sending) return;
    setSending(true);
    const row = {
      room_id: roomForPeer(me, peer),
      sender_username: me,
      sender_name: user?.name || me,
      recipient_username: peer.isGroup ? "group" : peer.username,
      body,
    };
    const { data, error } = await supabase
      .from("portal_chat_messages")
      .insert(row)
      .select("*")
      .single();
    setSending(false);
    if (error) {
      setSetupError(error.message);
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    loadChats();
  };

  const missingTable =
    /portal_chat_messages|portal_chat_groups|does not exist|schema cache/i.test(setupError || "");

  const headerTitle = creatingGroup
    ? "New group"
    : transferringCreator
      ? "Transfer creator"
      : addingToGroup
        ? "Add people"
        : removingFromGroup
          ? "Remove people"
          : groupDetailsOpen
            ? "Group details"
            : peer
              ? peer.name || peer.username
              : "Chat";
  const headerSub = creatingGroup
    ? "Name the group and add people"
    : transferringCreator
      ? "Pick who becomes creator, then exit"
      : addingToGroup
        ? `Add members to ${peer?.name || "group"}`
        : removingFromGroup
          ? `Remove members from ${peer?.name || "group"}`
          : groupDetailsOpen
            ? peer?.name || "Group"
            : peer?.isGroup
              ? `Group · ${peer.memberCount || groupMemberNames.length || 0} people`
              : peer
                ? peer.role || peer.username
                : "Users and your conversations";

  const createdLabel = (() => {
    const raw = liveGroup?.created_at || peer?.created_at;
    if (!raw) return "Created date unavailable";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "Created date unavailable";
    return `Created ${d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  })();

  const visibleDetailMembers = groupMemberNames.slice(0, memberVisibleCount);
  const moreDetailMembers = Math.max(0, groupMemberNames.length - memberVisibleCount);
  const inPickerMode =
    creatingGroup || addingToGroup || removingFromGroup || transferringCreator;

  return (
    <ResizablePanel storageKey="pf-size-chat" label="Chat">
      <div
        className={`pf-head pf-head-chat${
          peer?.isGroup && !inPickerMode && !groupDetailsOpen ? " is-clickable" : ""
        }`}
        onClick={() => {
          if (peer?.isGroup && !inPickerMode && !groupDetailsOpen) {
            openGroupDetails();
          }
        }}
      >
        {peer || inPickerMode || groupDetailsOpen ? (
          <button
            className="pf-icon-btn pf-icon-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (addingToGroup || removingFromGroup || transferringCreator) {
                setAddingToGroup(false);
                setRemovingFromGroup(false);
                setTransferringCreator(false);
                setPickedUsers({});
                setQuery("");
                setGroupDetailsOpen(true);
                return;
              }
              if (groupDetailsOpen) {
                setGroupDetailsOpen(false);
                return;
              }
              setPeer(null);
              setCreatingGroup(false);
            }}
            aria-label="Back"
          >
            <Ico name="back" />
          </button>
        ) : (
          <div className="pf-head-avatar">
            <Ico name="chat" />
          </div>
        )}
        {peer?.isGroup && !creatingGroup && (
          <button
            type="button"
            className="pf-group-profile"
            onClick={(e) => {
              e.stopPropagation();
              if (addingToGroup || removingFromGroup || transferringCreator) {
                setAddingToGroup(false);
                setRemovingFromGroup(false);
                setTransferringCreator(false);
                setPickedUsers({});
                setQuery("");
              }
              openGroupDetails();
            }}
            aria-label="Group profile"
            title="Group details"
          >
            {initials(peer.name)}
          </button>
        )}
        <div className="pf-head-copy">
          <div className="pf-head-title">{headerTitle}</div>
          <div className="pf-head-sub">{headerSub}</div>
          {peer?.isGroup &&
            !inPickerMode &&
            !groupDetailsOpen &&
            groupMemberNames.length > 0 && (
              <div ref={membersScrollRef} className="pf-head-members">
                {groupMemberNames.map((member, i) => (
                  <span key={member.username}>
                    {i > 0 ? ", " : ""}
                    {member.name}
                  </span>
                ))}
              </div>
            )}
        </div>
        {!peer && !inPickerMode && (
          <button
            className="pf-icon-btn pf-icon-btn-plus"
            onClick={(e) => {
              e.stopPropagation();
              openCreateGroup();
            }}
            aria-label="Create group"
            title="Create group"
          >
            <Ico name="people" />
          </button>
        )}
        <button
          className="pf-icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close chat"
        >
          <Ico name="close" />
        </button>
      </div>

      {groupDetailsOpen && peer?.isGroup ? (
        <div className="pf-body pf-scroll-chat pf-group-details">
          <div className="pf-group-hero">
            <div className="pf-group-hero-ava">{initials(peer.name)}</div>
            {isGroupCreator ? (
              <div className="pf-rename-row">
                <input
                  className="pf-input pf-rename-input"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  placeholder="Group name"
                  maxLength={80}
                />
                <button
                  type="button"
                  className="pf-rename-save"
                  onClick={renameGroup}
                  disabled={
                    groupSaving ||
                    !renameDraft.trim() ||
                    renameDraft.trim() === peer.name
                  }
                  aria-label={groupSaving ? "Saving" : "Rename group"}
                  title={groupSaving ? "Saving…" : "Rename"}
                >
                  <Ico name="rename" />
                </button>
              </div>
            ) : (
              <div className="pf-group-hero-name">{peer.name}</div>
            )}
            <div className="pf-group-hero-date">{createdLabel}</div>
            {setupError && !missingTable && (
              <div className="pf-group-hint">{setupError}</div>
            )}
          </div>
          {isGroupCreator && (
            <div className="pf-group-actions">
              <button
                type="button"
                className="pf-group-action"
                onClick={openAddToGroup}
                title="Add people"
              >
                <Ico name="people-plus" />
                <span>Add</span>
              </button>
              <button
                type="button"
                className="pf-group-action remove"
                onClick={openRemoveFromGroup}
                title="Remove people"
              >
                <Ico name="people-minus" />
                <span>Remove</span>
              </button>
            </div>
          )}
          <div className="pf-group-section-label">People</div>
          <div className="pf-people">
            {visibleDetailMembers.map((member) => (
              <div key={member.username} className="pf-person pf-person-static">
                <span
                  className="pf-ava"
                  style={{ color: nameColor(member.username) }}
                >
                  {initials(member.name)}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <div className="pf-person-name">
                    {member.name}
                    {member.username === groupCreatorUsername && (
                      <span className="pf-creator-badge">Creator</span>
                    )}
                  </div>
                  <div className="pf-person-meta">{member.username}</div>
                </span>
              </div>
            ))}
          </div>
          {moreDetailMembers > 0 && (
            <button
              type="button"
              className="pf-load-members"
              onClick={() => setMemberVisibleCount((n) => n + 10)}
              title={`Load ${Math.min(10, moreDetailMembers)} more`}
            >
              <Ico name="chevron-down" />
              <span>Load {Math.min(10, moreDetailMembers)} more</span>
            </button>
          )}
          <button
            type="button"
            className="pf-exit-group"
            onClick={exitGroup}
            disabled={groupSaving}
          >
            <Ico name="exit" />
            <span>
              {groupSaving
                ? "Leaving…"
                : isGroupCreator && groupMemberNames.some((m) => m.username !== me)
                  ? "Transfer & exit"
                  : "Exit group"}
            </span>
          </button>
        </div>
      ) : inPickerMode ? (
        <>
          {creatingGroup && (
            <div className="pf-search pf-search-group-name">
              <input
                className="pf-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                autoFocus
              />
            </div>
          )}
          {transferringCreator && (
            <div className="pf-setup pf-transfer-hint">
              Choose a new creator before you can leave this group.
            </div>
          )}
          <div className="pf-search pf-search-add-people">
            <input
              className="pf-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                transferringCreator
                  ? "Search members…"
                  : removingFromGroup
                    ? "Search members…"
                    : "Add people…"
              }
              autoFocus={addingToGroup || removingFromGroup || transferringCreator}
            />
          </div>
          {pickedList.length > 0 && (
            <div className="pf-group-picks">
              {pickedList.map((person) => (
                <button
                  key={person.username}
                  type="button"
                  className="pf-chip"
                  onClick={() => togglePick(person.username)}
                >
                  {person.name || person.username} ×
                </button>
              ))}
            </div>
          )}
          <div className="pf-body pf-scroll-chat pf-list">
            {missingTable && (
              <div className="pf-setup">
                Groups need a one-time database setup. Run{" "}
                <code>supabase/portal_chat.sql</code> in the Supabase SQL editor, then
                refresh.
              </div>
            )}
            {!pickerList.length ? (
              <div className="pf-empty">
                {transferringCreator
                  ? "No other members to transfer to."
                  : removingFromGroup
                    ? "No members available to remove."
                    : addingToGroup
                      ? "Everyone is already in this group."
                      : "No people found."}
              </div>
            ) : (
              <div className="pf-people">
                {pickerList.map((person) => {
                  const on = !!pickedUsers[person.username];
                  return (
                    <button
                      key={person.id || person.username}
                      type="button"
                      className={`pf-person${on ? " is-picked" : ""}`}
                      onClick={() =>
                        transferringCreator
                          ? pickForTransfer(person.username)
                          : togglePick(person.username)
                      }
                    >
                      <span className={`pf-check${on ? " is-on" : ""}`} aria-hidden="true">
                        {on ? "✓" : ""}
                      </span>
                      <span className="pf-ava">{initials(person.name || person.username)}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <div className="pf-person-name">{person.name || person.username}</div>
                        <div className="pf-person-meta">
                          {person.role || person.username}
                          {person.department ? ` · ${person.department}` : ""}
                        </div>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="pf-composer">
            <button
              type="button"
              className="pf-create-group"
              disabled={
                groupSaving ||
                !pickedList.length ||
                (creatingGroup && !groupName.trim())
              }
              onClick={
                creatingGroup
                  ? createGroup
                  : transferringCreator
                    ? transferCreatorAndExit
                    : removingFromGroup
                      ? removeMembersFromGroup
                      : addMembersToGroup
              }
            >
              {groupSaving
                ? creatingGroup
                  ? "Creating…"
                  : transferringCreator
                    ? "Transferring…"
                    : removingFromGroup
                      ? "Removing…"
                      : "Adding…"
                : creatingGroup
                  ? "Create group"
                  : transferringCreator
                    ? "Make creator & exit"
                    : removingFromGroup
                      ? "Remove from group"
                      : "Add to group"}
            </button>
          </div>
        </>
      ) : !peer ? (
        <>
          <div className="pf-tabs">
            <button
              type="button"
              className={`pf-tab${tab === "users" ? " is-on" : ""}`}
              onClick={() => setTab("users")}
            >
              Users
            </button>
            <button
              type="button"
              className={`pf-tab${tab === "chats" ? " is-on" : ""}`}
              onClick={() => setTab("chats")}
            >
              My chats
            </button>
          </div>
          <div className="pf-search">
            <input
              className="pf-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "users" ? "Search people…" : "Search chats…"}
            />
          </div>
          <div className="pf-body pf-scroll-chat pf-list">
            {missingTable && (
              <div className="pf-setup">
                Chat needs a one-time database setup. Run{" "}
                <code>supabase/portal_chat.sql</code> in the Supabase SQL editor, then
                refresh.
              </div>
            )}
            {tab === "users" ? (
              !filteredPeople.length ? (
                <div className="pf-empty">No people found.</div>
              ) : (
                <div className="pf-people">
                  {filteredPeople.map((p) => (
                    <button
                      key={p.id || p.username}
                      className="pf-person"
                      onClick={() => openPerson(p)}
                    >
                      <span className="pf-ava">{initials(p.name || p.username)}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <div className="pf-person-name">{p.name || p.username}</div>
                        <div className="pf-person-meta">
                          {p.role || p.username}
                          {p.department ? ` · ${p.department}` : ""}
                        </div>
                      </span>
                      {unreadByUser[p.username] > 0 && (
                        <span className="pf-unread-dot">{unreadByUser[p.username]}</span>
                      )}
                    </button>
                  ))}
                </div>
              )
            ) : !filteredThreads.length && !filteredGroups.length ? (
              <div className="pf-empty">No chats yet. Open Users, or tap + to create a group.</div>
            ) : (
              <div className="pf-people">
                {filteredGroups.map((group) => {
                  const mine = group.last?.sender_username === me;
                  return (
                    <button
                      key={group.id}
                      className="pf-person"
                      onClick={() =>
                        setPeer({
                          isGroup: true,
                          id: group.id,
                          name: group.name,
                          created_at: group.created_at,
                          memberCount: group.members?.length || 0,
                          members: group.members || [],
                        })
                      }
                    >
                      <span className="pf-ava pf-ava-group">{initials(group.name)}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <div className="pf-person-name">{group.name}</div>
                        <div className="pf-person-meta pf-preview">
                          <span>
                            {group.last
                              ? `${mine ? "You" : group.last.sender_name || group.last.sender_username}: ${group.last.body}`
                              : `${group.members?.length || 0} members`}
                          </span>
                        </div>
                      </span>
                      {group.last && (
                        <span className="pf-thread-side">
                          <span className="pf-thread-time">{formatChatTime(group.last.created_at)}</span>
                          {unreadByGroup[group.id] > 0 && (
                            <span className="pf-unread-dot">{unreadByGroup[group.id]}</span>
                          )}
                        </span>
                      )}
                      {!group.last && unreadByGroup[group.id] > 0 && (
                        <span className="pf-unread-dot">{unreadByGroup[group.id]}</span>
                      )}
                    </button>
                  );
                })}
                {filteredThreads.map(({ username, last }) => {
                  const person = personByUsername[username];
                  const name = person?.name || username;
                  const mine = last.sender_username === me;
                  return (
                    <button
                      key={username}
                      className="pf-person"
                      onClick={() =>
                        openPerson(
                          person || { username, name: last.sender_name || username },
                        )
                      }
                    >
                      <span className="pf-ava">{initials(name)}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <div className="pf-person-name">{name}</div>
                        <div className="pf-person-meta pf-preview">
                          {mine && (
                            <SeenTicks seen={!!last.read_at} light />
                          )}
                          <span>
                            {mine ? "You: " : ""}
                            {last.body}
                          </span>
                        </div>
                      </span>
                      <span className="pf-thread-side">
                        <span className="pf-thread-time">{formatChatTime(last.created_at)}</span>
                        {unreadByUser[username] > 0 && (
                          <span className="pf-unread-dot">{unreadByUser[username]}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="pf-body pf-scroll-chat pf-wm" ref={bodyRef}>
            {missingTable && (
              <div className="pf-setup">
                Chat needs a one-time database setup. Run{" "}
                <code>supabase/portal_chat.sql</code> in the Supabase SQL editor, then
                refresh.
              </div>
            )}
            {!messages.length && !missingTable && (
              <div className="pf-empty">
                {peer.isGroup
                  ? `No messages yet. Say hello in ${peer.name}.`
                  : `No messages yet. Say hello to ${peer.name || peer.username}.`}
              </div>
            )}
            {messages.filter(keepChatMessage).map((m) => {
              const isSystem = m.sender_username === "system";
              if (isSystem) {
                return (
                  <div key={m.id} className="pf-sys-msg">
                    <div className="pf-sys-pill">{m.body}</div>
                  </div>
                );
              }
              const mine = m.sender_username === me;
              return (
                <div key={m.id} className={`pf-msg ${mine ? "pf-msg-user" : ""}`}>
                  <div className={`pf-bubble ${mine ? "pf-bubble-user" : "pf-bubble-bot"}`}>
                    {!mine && peer.isGroup && (
                      <div
                        className="pf-sender"
                        style={{ color: nameColor(m.sender_username || m.sender_name) }}
                      >
                        {m.sender_name || m.sender_username}
                      </div>
                    )}
                    {m.body}
                    <div className="pf-msg-meta">
                      <span>{formatChatTime(m.created_at)}</span>
                      {mine && !peer.isGroup && <SeenTicks seen={!!m.read_at} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            className="pf-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              className="pf-input pf-input-area"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={holdWindowScroll}
              onKeyDown={(e) => {
                // Enter = new line; send only via the Send button
                if (e.key === "Enter") e.stopPropagation();
              }}
              placeholder={`Message ${peer.name || peer.username}…`}
              rows={2}
              enterKeyHint="enter"
            />
            <button
              type="submit"
              className="pf-send chat"
              disabled={sending || !draft.trim()}
              aria-label="Send"
            >
              <Ico name="send" />
            </button>
          </form>
        </>
      )}
    </ResizablePanel>
  );
}

function assignedSites(user) {
  const out = [];
  const push = (value) => {
    const name = String(value || "").trim();
    if (!name || out.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    out.push(name);
  };
  const raw = user?.site_names;
  if (Array.isArray(raw)) raw.forEach(push);
  else if (typeof raw === "string" && raw.trim()) {
    const text = raw.trim();
    if (text.startsWith("{") && text.endsWith("}")) {
      text.slice(1, -1).split(",").forEach((part) => push(part.replace(/^"|"$/g, "")));
    } else if (text.startsWith("[")) {
      try {
        JSON.parse(text).forEach(push);
      } catch {
        text.split(",").forEach(push);
      }
    } else {
      text.split(",").forEach(push);
    }
  }
  push(user?.site_name);
  return out;
}

function sortByName(rows) {
  return [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
}

function sortText(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
}

function MaterialPanel({ user, onClose }) {
  const sites = useMemo(() => assignedSites(user), [user]);
  const [siteName, setSiteName] = useState(() => assignedSites(user)[0] || "");
  const userName = user?.user_name || user?.username || "";
  const recordedBy = user?.name || userName;
  const [catalog, setCatalog] = useState({ categories: [], subcategories: [], types: [], units: [] });
  const [records, setRecords] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [tab, setTab] = useState("add");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSubcategory, setFilterSubcategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState("");
  const [draftName, setDraftName] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [billFile, setBillFile] = useState(null);
  const [billPreview, setBillPreview] = useState("");
  const toastTimer = useRef(null);
  const billPreviewRef = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [categories, subcategories, types, units, arrivals] = await Promise.all([
      supabase.from("material_categories").select("id, name, sort_order").order("sort_order"),
      supabase.from("material_subcategories").select("id, category_id, name, sort_order").order("sort_order"),
      supabase.from("material_types").select("id, subcategory_id, name, sort_order").order("sort_order"),
      supabase.from("material_units").select("id, subcategory_id, unit, sort_order").order("sort_order"),
      supabase.from("site_material_arrivals").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    const failed = [categories, subcategories, types, units, arrivals].find((result) => result.error);
    if (failed?.error) {
      setError("Material tables are not ready. Run supabase/site_material.sql in the Supabase SQL editor.");
      setLoading(false);
      return;
    }
    setCatalog({
      categories: categories.data || [],
      subcategories: subcategories.data || [],
      types: types.data || [],
      units: units.data || [],
    });
    const rows = arrivals.data || [];
    setRecords(siteName ? rows.filter((row) => row.site_name === siteName) : rows);
    setLoading(false);
  }, [siteName]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (siteName || !sites[0]) return;
    setSiteName(sites[0]);
  }, [siteName, sites]);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    if (billPreviewRef.current) URL.revokeObjectURL(billPreviewRef.current);
  }, []);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1600);
  };

  const openAdd = (kind) => {
    setError("");
    setDraftName("");
    setAdding(kind);
  };

  const closeAdd = () => {
    setAdding("");
    setDraftName("");
    setError("");
  };

  const filterSubcategories = catalog.subcategories.filter((row) => !filterCategory || row.category_id === filterCategory);
  const filterTypes = catalog.types.filter((row) => {
    if (filterSubcategory) return row.subcategory_id === filterSubcategory;
    if (!filterCategory) return true;
    return filterSubcategories.some((sub) => sub.id === row.subcategory_id);
  });
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categoryName = catalog.categories.find((row) => row.id === filterCategory)?.name || "";
    const subcategoryName = catalog.subcategories.find((row) => row.id === filterSubcategory)?.name || "";
    const typeName = catalog.types.find((row) => row.id === filterType)?.name || "";
    return records.filter((row) => {
      if (categoryName && row.category_name !== categoryName) return false;
      if (subcategoryName && row.subcategory_name !== subcategoryName) return false;
      if (typeName && row.type_name !== typeName) return false;
      if (!q) return true;
      return [row.category_name, row.subcategory_name, row.type_name, row.unit, row.recorded_by, row.site_name, row.quantity]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [records, search, filterCategory, filterSubcategory, filterType, catalog]);

  const downloadExcel = async () => {
    const book = new ExcelJS.Workbook();
    fillArrivedMaterialBook(book, filteredRecords);
    const buffer = await book.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `arrived-material${siteName ? `-${siteName.replace(/\s+/g, "-")}` : ""}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const subcategories = sortByName(catalog.subcategories.filter((row) => row.category_id === categoryId));
  const types = sortByName(catalog.types.filter((row) => row.subcategory_id === subcategoryId));
  const units = sortText(catalog.units.filter((row) => row.subcategory_id === subcategoryId).map((row) => row.unit));
  const sortedCategories = sortByName(catalog.categories);
  const sortedSites = sortText(sites);
  const sortedFilterSubcategories = sortByName(filterSubcategories);
  const sortedFilterTypes = sortByName(filterTypes);

  const pickCategory = (id) => {
    setCategoryId(id);
    setSubcategoryId("");
    setTypeId("");
    setQuantity("");
    setUnit("");
  };

  const pickSubcategory = (id) => {
    setSubcategoryId(id);
    setTypeId("");
    setQuantity("");
    const nextUnits = catalog.units.filter((row) => row.subcategory_id === id).map((row) => row.unit);
    setUnit(nextUnits.length === 1 ? nextUnits[0] : "");
  };

  const addCatalog = async () => {
    const name = draftName.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Enter a name.");
      return;
    }
    const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
    const nextOrder = (rows) => rows.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0) + 1;
    setCatalogSaving(true);
    setError("");
    let inserted = null;
    let saveErr = null;
    if (adding === "category") {
      if (catalog.categories.some((row) => same(row.name, name))) {
        setCatalogSaving(false);
        setError("That category already exists.");
        return;
      }
      const result = await supabase.from("material_categories").insert({ name, sort_order: nextOrder(catalog.categories) }).select("id, name, sort_order").single();
      inserted = result.data;
      saveErr = result.error;
      if (inserted) {
        setCatalog((prev) => ({ ...prev, categories: [...prev.categories, inserted] }));
        pickCategory(inserted.id);
      }
    } else if (adding === "subcategory") {
      if (!categoryId) {
        setCatalogSaving(false);
        setError("Select a category first.");
        return;
      }
      const siblings = catalog.subcategories.filter((row) => row.category_id === categoryId);
      if (siblings.some((row) => same(row.name, name))) {
        setCatalogSaving(false);
        setError("That subcategory already exists.");
        return;
      }
      const result = await supabase.from("material_subcategories").insert({
        category_id: categoryId,
        name,
        sort_order: nextOrder(siblings),
      }).select("id, category_id, name, sort_order").single();
      inserted = result.data;
      saveErr = result.error;
      if (inserted) {
        setCatalog((prev) => ({ ...prev, subcategories: [...prev.subcategories, inserted] }));
        pickSubcategory(inserted.id);
      }
    } else if (adding === "type") {
      if (!subcategoryId) {
        setCatalogSaving(false);
        setError("Select a subcategory first.");
        return;
      }
      const siblings = catalog.types.filter((row) => row.subcategory_id === subcategoryId);
      if (siblings.some((row) => same(row.name, name))) {
        setCatalogSaving(false);
        setError("That type already exists.");
        return;
      }
      const result = await supabase.from("material_types").insert({
        subcategory_id: subcategoryId,
        name,
        sort_order: nextOrder(siblings),
      }).select("id, subcategory_id, name, sort_order").single();
      inserted = result.data;
      saveErr = result.error;
      if (inserted) {
        setCatalog((prev) => ({ ...prev, types: [...prev.types, inserted] }));
        setTypeId(inserted.id);
      }
    } else if (adding === "unit") {
      if (!subcategoryId) {
        setCatalogSaving(false);
        setError("Select a subcategory first.");
        return;
      }
      const siblings = catalog.units.filter((row) => row.subcategory_id === subcategoryId);
      if (siblings.some((row) => same(row.unit, name))) {
        setCatalogSaving(false);
        setError("That unit already exists.");
        return;
      }
      const result = await supabase.from("material_units").insert({
        subcategory_id: subcategoryId,
        unit: name,
        sort_order: nextOrder(siblings),
      }).select("id, subcategory_id, unit, sort_order").single();
      inserted = result.data;
      saveErr = result.error;
      if (inserted) {
        setCatalog((prev) => ({ ...prev, units: [...prev.units, inserted] }));
        setUnit(inserted.unit);
      }
    }
    setCatalogSaving(false);
    if (saveErr) {
      setError(saveErr.message || "Could not add that.");
      return;
    }
    setDraftName("");
    setAdding("");
    showToast("Saved");
  };

  const save = async () => {
    const category = catalog.categories.find((row) => row.id === categoryId);
    const subcategory = catalog.subcategories.find((row) => row.id === subcategoryId);
    const type = catalog.types.find((row) => row.id === typeId);
    const qty = Number(quantity);
    if (!category || !subcategory || !type || !unit || !Number.isFinite(qty) || qty <= 0) {
      setError("Choose category, subcategory, type, unit, and a quantity.");
      return;
    }
    setSaving(true);
    setError("");
    let billUrl = null;
    if (billFile) {
      try {
        billUrl = await uploadMaterialBill(billFile, siteName);
      } catch (err) {
        setSaving(false);
        setError(err.message || "Could not upload the bill photo.");
        return;
      }
    }
    const { error: saveErr } = await supabase.from("site_material_arrivals").insert({
      site_name: siteName || null,
      user_name: userName || null,
      recorded_by: recordedBy || null,
      category_name: category.name,
      subcategory_name: subcategory.name,
      type_name: type.name,
      quantity: qty,
      unit,
      ...(billUrl ? { bill_url: billUrl } : {}),
    });
    setSaving(false);
    if (saveErr) {
      setError(saveErr.message || "Could not save material.");
      return;
    }
    setQuantity("");
    if (billPreviewRef.current) URL.revokeObjectURL(billPreviewRef.current);
    billPreviewRef.current = "";
    setBillFile(null);
    setBillPreview("");
    showToast("Saved");
    await load();
  };

  return (
    <ResizablePanel storageKey="pf-size-material" label="Arrived material" className="pf-panel-material">
      <div className="pf-head pf-head-material">
        <div className="pf-head-avatar">
          <Ico name="box" />
        </div>
        <div className="pf-head-copy">
          <div className="pf-head-title">Arrived material</div>
          {sites.length > 1 ? (
            <select
              className="pf-head-site"
              value={siteName}
              aria-label="Site"
              onChange={(event) => setSiteName(event.target.value)}
            >
              {sortedSites.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : (
            <div className="pf-head-sub">{siteName || "Material received on site"}</div>
          )}
        </div>
        <button className="pf-icon-btn" onClick={onClose} aria-label="Close">
          <Ico name="close" />
        </button>
      </div>
      <div className="pf-mat-tabs">
        <button type="button" className={tab === "add" ? "is-on" : ""} onClick={() => setTab("add")}>Add</button>
        <button type="button" className={tab === "records" ? "is-on" : ""} onClick={() => setTab("records")}>Records</button>
      </div>
      <div className="pf-body pf-mat-body">
        {error && !adding && <div className="pf-mat-error">{error}</div>}
        {tab === "records" ? (
          <>
            <input
              className="pf-mat-search"
              value={search}
              placeholder="Search category, subcategory, type"
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="pf-mat-filters">
              <select
                value={filterCategory}
                aria-label="Filter category"
                onChange={(event) => {
                  setFilterCategory(event.target.value);
                  setFilterSubcategory("");
                  setFilterType("");
                }}
              >
                <option value="">All categories</option>
                {sortedCategories.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
              <select
                value={filterSubcategory}
                aria-label="Filter subcategory"
                onChange={(event) => {
                  setFilterSubcategory(event.target.value);
                  setFilterType("");
                }}
              >
                <option value="">All subcategories</option>
                {sortedFilterSubcategories.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
              <select value={filterType} aria-label="Filter type" onChange={(event) => setFilterType(event.target.value)}>
                <option value="">All types</option>
                {sortedFilterTypes.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </div>
            <button type="button" className="pf-mat-save" onClick={downloadExcel} disabled={!filteredRecords.length}>
              Download Excel
            </button>
            <div className="pf-mat-table-wrap">
              <table className="pf-mat-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Subcategory</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row) => (
                    <tr key={row.id}>
                      <td>{row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN") : "—"}</td>
                      <td>{row.category_name}</td>
                      <td>{row.subcategory_name}</td>
                      <td>{row.type_name}</td>
                      <td>{row.quantity}</td>
                      <td>{row.unit}</td>
                      <td><BillActions url={row.bill_url} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="pf-empty">Loading…</div>}
              {!loading && !filteredRecords.length && <div className="pf-empty">No material records match.</div>}
            </div>
          </>
        ) : (
          <>
        <label className="pf-mat-field">
          Category
          <select
            value={categoryId}
            onChange={(event) => {
              if (event.target.value === "__other") {
                openAdd("category");
                return;
              }
              pickCategory(event.target.value);
            }}
          >
            <option value="__other">+ Other</option>
            <option value="">Select category</option>
            {sortedCategories.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        {categoryId && (
          <label className="pf-mat-field">
            Subcategory
            <select
              value={subcategoryId}
              onChange={(event) => {
                if (event.target.value === "__other") {
                  openAdd("subcategory");
                  return;
                }
                pickSubcategory(event.target.value);
              }}
            >
              <option value="__other">+ Other</option>
              <option value="">{subcategories.length ? "Select subcategory" : "No subcategories yet"}</option>
              {subcategories.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>
        )}
        {subcategoryId && (
          <label className="pf-mat-field">
            Type
            <select
              value={typeId}
              onChange={(event) => {
                if (event.target.value === "__other") {
                  openAdd("type");
                  return;
                }
                setTypeId(event.target.value);
              }}
            >
              <option value="__other">+ Other</option>
              <option value="">Select type</option>
              {types.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>
        )}
        {typeId && (
          <label className="pf-mat-field">
            Quantity
            <span className="pf-mat-qty">
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                placeholder="0"
                onChange={(event) => setQuantity(event.target.value)}
              />
              <select
                value={unit}
                aria-label="Unit"
                onChange={(event) => {
                  if (event.target.value === "__other") {
                    openAdd("unit");
                    return;
                  }
                  setUnit(event.target.value);
                }}
              >
                <option value="__other">+ Other</option>
                <option value="">Unit</option>
                {units.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </span>
          </label>
        )}
        {typeId && (
          <label className="pf-mat-field">
            Bill photo
            <span className="pf-mat-optional">Optional</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (billPreviewRef.current) URL.revokeObjectURL(billPreviewRef.current);
                if (!file) {
                  billPreviewRef.current = "";
                  setBillFile(null);
                  setBillPreview("");
                  return;
                }
                const url = URL.createObjectURL(file);
                billPreviewRef.current = url;
                setBillFile(file);
                setBillPreview(url);
              }}
            />
            {billPreview && <img className="pf-mat-bill-preview" src={billPreview} alt="Selected bill" />}
          </label>
        )}
        {typeId && (
          <button type="button" className="pf-mat-save" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        )}
          </>
        )}
      </div>
      {toast && <div className="pf-mat-toast" role="status">{toast}</div>}
      {adding && (
        <div className="pf-mat-pop" role="dialog" aria-label={`Add ${adding}`}>
          <div className="pf-mat-pop-card">
            <div className="pf-mat-pop-head">
              <strong>Add {adding}</strong>
              <button type="button" className="pf-mat-pop-close" onClick={closeAdd}>Close</button>
            </div>
            <input
              className="pf-mat-pop-input"
              value={draftName}
              placeholder={`New ${adding}`}
              autoFocus
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addCatalog();
              }}
            />
            {error && <div className="pf-mat-error">{error}</div>}
            <button type="button" className="pf-mat-save" disabled={catalogSaving} onClick={addCatalog}>
              {catalogSaving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </ResizablePanel>
  );
}

export default function PortalFloaters({ showBot = false, botScope = "admin" }) {
  const user = getStoredUser();
  const me = user?.user_name || user?.username;
  const showMaterial = String(user?.department || "").trim().toLowerCase() === "site engineer";
  const [open, setOpen] = useState(null);
  const [unread, setUnread] = useState(0);
  const [unreadByUser, setUnreadByUser] = useState({});
  const [unreadByGroup, setUnreadByGroup] = useState({});
  const groupReadOverrideRef = useRef(loadLocalGroupReads(me));

  const onGroupOpened = useCallback((groupId, lastReadAt) => {
    if (!groupId) return;
    const room = `group::${groupId}`;
    const stamp = lastReadAt || new Date(Date.now() + 5000).toISOString();
    groupReadOverrideRef.current[room] = stamp;
    if (me) saveLocalGroupRead(me, room, stamp);
    setUnreadByGroup((prev) => {
      const drop = prev[groupId] || 0;
      if (drop) {
        setUnread((count) => Math.max(0, count - drop));
      }
      if (!prev[groupId]) return prev;
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, [me]);

  const refreshUnread = useCallback(async () => {
    if (!me) return;

    const { data: personal, error: personalError } = await supabase
      .from("portal_chat_messages")
      .select("id, sender_username")
      .eq("recipient_username", me)
      .is("read_at", null);

    const map = {};
    if (!personalError) {
      (personal || []).forEach((row) => {
        if (row.sender_username === "system") return;
        map[row.sender_username] = (map[row.sender_username] || 0) + 1;
      });
    }

    const groupMap = {};
    const { data: memberships } = await supabase
      .from("portal_chat_group_members")
      .select("group_id, created_at")
      .eq("username", me);

    if (memberships?.length) {
      const rooms = memberships.map((row) => `group::${row.group_id}`);
      const joinByRoom = {};
      memberships.forEach((row) => {
        joinByRoom[`group::${row.group_id}`] = row.created_at;
      });

      const [readsRes, msgsRes] = await Promise.all([
        supabase
          .from("portal_chat_room_reads")
          .select("room_id, last_read_at")
          .eq("username", me)
          .in("room_id", rooms),
        supabase
          .from("portal_chat_messages")
          .select("id, room_id, sender_username, created_at")
          .in("room_id", rooms)
          .neq("sender_username", me)
          .order("created_at", { ascending: false })
          .limit(800),
      ]);

      const localReads = loadLocalGroupReads(me);
      const readByRoom = { ...localReads, ...groupReadOverrideRef.current };

      const pickLater = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
      };

      if (!readsRes.error) {
        (readsRes.data || []).forEach((row) => {
          readByRoom[row.room_id] = pickLater(readByRoom[row.room_id], row.last_read_at);
        });
      }

      // Keep local mirror in sync with the newest known read times.
      Object.entries(readByRoom).forEach(([roomId, stamp]) => {
        saveLocalGroupRead(me, roomId, stamp);
        groupReadOverrideRef.current[roomId] = pickLater(
          groupReadOverrideRef.current[roomId],
          stamp,
        );
      });

      (msgsRes.data || []).forEach((row) => {
        if (!keepChatMessage(row)) return;
        const since = readByRoom[row.room_id] || joinByRoom[row.room_id];
        if (since && new Date(row.created_at).getTime() <= new Date(since).getTime()) {
          return;
        }
        const groupId = String(row.room_id || "").replace(/^group::/, "");
        if (!groupId) return;
        groupMap[groupId] = (groupMap[groupId] || 0) + 1;
      });
    }

    setUnreadByUser(map);
    setUnreadByGroup(groupMap);
    const personalCount = Object.values(map).reduce((sum, n) => sum + n, 0);
    const groupCount = Object.values(groupMap).reduce((sum, n) => sum + n, 0);
    setUnread(personalCount + groupCount);
  }, [me]);

  useEffect(() => {
    refreshUnread();
    if (!me) return undefined;
    const channel = supabase
      .channel("portal-chat-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_chat_messages" },
        () => refreshUnread(),
      )
      .subscribe();
    const timer = setInterval(refreshUnread, 25000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [me, refreshUnread]);

  const backdropTouchY = useRef(null);

  if (!user) return null;

  return (
    <>
      {open && (
        <button
          className="pf-backdrop"
          aria-label="Close popup"
          onClick={() => setOpen(null)}
          onWheel={(e) => {
            // Let page scroll when wheel is over the dimmed area outside the panel.
            window.scrollBy({ top: e.deltaY, left: e.deltaX });
          }}
          onTouchStart={(e) => {
            backdropTouchY.current = e.touches[0]?.clientY ?? null;
          }}
          onTouchMove={(e) => {
            const y = e.touches[0]?.clientY;
            if (backdropTouchY.current == null || y == null) return;
            const dy = backdropTouchY.current - y;
            backdropTouchY.current = y;
            window.scrollBy(0, dy);
          }}
          onTouchEnd={() => {
            backdropTouchY.current = null;
          }}
        />
      )}
      {showBot && open === "bot" && (
        <DipPanel user={user} scope={botScope} onClose={() => setOpen(null)} />
      )}
      {open === "chat" && (
        <ChatPanel
          user={user}
          onClose={() => setOpen(null)}
          unreadByUser={unreadByUser}
          unreadByGroup={unreadByGroup}
          refreshUnread={refreshUnread}
          onGroupOpened={onGroupOpened}
        />
      )}
      {showMaterial && open === "material" && (
        <MaterialPanel user={user} onClose={() => setOpen(null)} />
      )}
      <div className="pf-stack">
        {showMaterial && (
          <button
            className={`pf-fab pf-fab-material${open === "material" ? " is-open" : ""}`}
            onClick={() => setOpen((v) => (v === "material" ? null : "material"))}
            title="Arrived material"
            aria-label="Arrived material"
          >
            <Ico name="box" />
          </button>
        )}
        {showBot && (
          <button
            className={`pf-fab pf-fab-dip${open === "bot" ? " is-open" : ""}`}
            onClick={() => setOpen((v) => (v === "bot" ? null : "bot"))}
            title="DIP Bot"
            aria-label="DIP Bot"
          >
            <Ico name="bot" />
          </button>
        )}
        <button
          className={`pf-fab pf-fab-chat${open === "chat" ? " is-open" : ""}`}
          onClick={() => setOpen((v) => (v === "chat" ? null : "chat"))}
          title="Chat"
          aria-label="Chat"
        >
          <Ico name="chat" />
          {unread > 0 && <span className="pf-badge">{unread > 99 ? "99+" : unread}</span>}
        </button>
      </div>
    </>
  );
}
