import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabase";

/* ── helpers ─────────────────────────────────────────────────────────── */
const DOB_KEYS = ["dob", "date_of_birth", "birth_date", "birthday", "birthdate", "d_o_b"];
const PHONE_KEYS = ["whatsapp", "phone", "mobile", "contact_number", "contact", "phone_number", "mobile_number"];

function pickField(emp, keys) {
  for (const k of keys) if (emp?.[k]) return emp[k];
  return "";
}

// Returns { y, m, d } or null. Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, ISO strings.
function parseDob(value) {
  if (!value) return null;
  const s = String(value).trim();
  let m;
  // Timestamp with a timezone (e.g. 1995-10-06T18:30:00+00:00) -> read the date in IST
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const dt = new Date(s);
    if (!isNaN(dt)) {
      const ist = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
      m = ist.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    }
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid({ y: +m[1], m: +m[2], d: +m[3] });
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    if (b > 12 && a <= 12) [a, b] = [b, a]; // MM/DD/YYYY -> swap
    return valid({ y: +m[3], m: b, d: a });
  }
  const dt = new Date(s);
  if (isNaN(dt)) return null;
  return valid({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() });
}

function valid(o) {
  return o && o.m >= 1 && o.m <= 12 && o.d >= 1 && o.d <= 31 ? o : null;
}

function fmtDob(dob) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dob.d} ${months[dob.m - 1]} ${dob.y}`;
}

function cleanPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`; // India default
  return digits;
}

function initialsFor(name) {
  return String(name || "NA").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function birthdaysFor(employees, date = new Date()) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (employees || [])
    .map((e) => ({ emp: e, dob: parseDob(pickField(e, DOB_KEYS)) }))
    .filter((x) => x.dob && x.dob.m === m && x.dob.d === d);
}

export function upcomingBirthdays(employees, days = 30, now = new Date()) {
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return (employees || [])
    .map((e) => ({ emp: e, dob: parseDob(pickField(e, DOB_KEYS)) }))
    .filter((x) => x.dob)
    .map((x) => {
      let nextUTC = Date.UTC(now.getFullYear(), x.dob.m - 1, x.dob.d);
      if (nextUTC <= todayUTC) nextUTC = Date.UTC(now.getFullYear() + 1, x.dob.m - 1, x.dob.d);
      return { ...x, next: new Date(nextUTC), inDays: Math.round((nextUTC - todayUTC) / 86400000) };
    })
    .filter((x) => x.inDays >= 1 && x.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays);
}

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── card templates (drawn on canvas → PNG) ──────────────────────────── */
const W = 800;
const H = 1000;
const FONT = '"DM Sans", "Segoe UI", Arial, sans-serif';

function confetti(ctx, rand, colors, count = 70) {
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate(rand() * W, rand() * H);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.5 + rand() * 0.5;
    ctx.fillRect(-6, -3, 12 + rand() * 8, 6);
    ctx.restore();
  }
}

function balloon(ctx, x, y, r, color) {
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.25);
  ctx.bezierCurveTo(x - 14, y + r * 2, x + 14, y + r * 2.5, x, y + r * 3.2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.82, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.35, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function fitText(ctx, text, maxWidth, startSize, weight = 800) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 24);
}

function drawBase(ctx, { name, dobText, accent, textColor, subColor }) {
  ctx.textAlign = "center";
  ctx.fillStyle = subColor;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText("Wishing you a wonderful day,", W / 2, 520);
  ctx.fillStyle = textColor;
  fitText(ctx, name, W - 120, 78);
  ctx.fillText(name, W / 2, 610);
  ctx.fillStyle = accent;
  ctx.fillRect(W / 2 - 50, 640, 100, 5);
  ctx.fillStyle = subColor;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(`Born ${dobText}`, W / 2, 700);
  ctx.fillStyle = textColor;
  ctx.font = `500 27px ${FONT}`;
  ctx.fillText("May this year bring you joy, growth and success.", W / 2, 790);
  ctx.fillStyle = subColor;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("— With love from the HR Team", W / 2, 900);
}

function headline(ctx, color, y1 = 330, y2 = 430) {
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = `800 96px ${FONT}`;
  ctx.fillText("Happy", W / 2, y1);
  ctx.fillText("Birthday!", W / 2, y2);
}

const TEMPLATES = [
  {
    id: "confetti-pop",
    label: "Confetti pop",
    draw(ctx, p, rand) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#ff5f8d");
      g.addColorStop(1, "#7c3aed");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      confetti(ctx, rand, ["#fde047", "#ffffff", "#34d399", "#60a5fa", "#fb923c"], 90);
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.beginPath();
      ctx.arc(W / 2, 380, 250, 0, Math.PI * 2);
      ctx.fill();
      headline(ctx, "#ffffff");
      drawBase(ctx, { ...p, accent: "#fde047", textColor: "#ffffff", subColor: "rgba(255,255,255,.85)" });
    },
  },
  {
    id: "midnight-gold",
    label: "Midnight gold",
    draw(ctx, p, rand) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) star(ctx, rand() * W, rand() * H, 3 + rand() * 6, `rgba(250,204,21,${0.3 + rand() * 0.6})`);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 4;
      ctx.strokeRect(36, 36, W - 72, H - 72);
      ctx.strokeStyle = "rgba(250,204,21,.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(54, 54, W - 108, H - 108);
      headline(ctx, "#facc15");
      drawBase(ctx, { ...p, accent: "#facc15", textColor: "#fef9c3", subColor: "rgba(254,249,195,.75)" });
    },
  },
  {
    id: "balloon-sky",
    label: "Balloon sky",
    draw(ctx, p, rand) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#38bdf8");
      g.addColorStop(1, "#e0f2fe");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.8)";
      [[130, 120, 70], [640, 90, 55], [700, 260, 45]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.arc(x + r * 0.9, y + 10, r * 0.75, 0, Math.PI * 2);
        ctx.arc(x - r * 0.9, y + 14, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      });
      [["#f43f5e", 110, 330, 62], ["#f59e0b", 220, 250, 52], ["#22c55e", 590, 300, 58], ["#a855f7", 690, 400, 48], ["#ec4899", 70, 470, 40]].forEach(
        ([c, x, y, r]) => balloon(ctx, x, y, r, c),
      );
      ctx.textAlign = "center";
      ctx.fillStyle = "#0c4a6e";
      ctx.font = `800 96px ${FONT}`;
      ctx.fillText("Happy", W / 2, 330);
      ctx.fillText("Birthday!", W / 2, 430);
      drawBase(ctx, { ...p, accent: "#f43f5e", textColor: "#0c4a6e", subColor: "#075985" });
    },
  },
  {
    id: "sunset-glow",
    label: "Sunset glow",
    draw(ctx, p, rand) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#fb923c");
      g.addColorStop(0.55, "#f43f5e");
      g.addColorStop(1, "#7e22ce");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(254,240,138,.9)";
      ctx.beginPath();
      ctx.arc(W / 2, 200, 120, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 36; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.5})`;
        ctx.beginPath();
        ctx.arc(rand() * W, rand() * H, 2 + rand() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      headline(ctx, "#ffffff", 370, 470);
      drawBase(ctx, { ...p, accent: "#fef08a", textColor: "#ffffff", subColor: "rgba(255,255,255,.88)" });
    },
  },
];

function renderCard(tpl, name, dobText, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  tpl.draw(ctx, { name, dobText }, seeded(seed));
  return canvas;
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/* ── shared hooks ────────────────────────────────────────────────────── */
function isMobileDevice() {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// DOB / phone are often saved in hr_employee_profiles (Info tab), not user_details.
// This merges them in so every birthday view sees the same data.
function useMergedEmployees(employees, skip = false) {
  const [profiles, setProfiles] = useState(null);

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("hr_employee_profiles").select("*");
        if (!cancelled) setProfiles(error ? [] : data || []);
      } catch {
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skip]);

  return useMemo(() => {
    if (skip || !profiles?.length) return employees || [];
    const byUser = new Map(profiles.map((p) => [String(p.user_name || "").trim().toLowerCase(), p]));
    return (employees || []).map((e) => {
      const key = String(e.username || e.user_name || "").trim().toLowerCase();
      const p = byUser.get(key);
      if (!p) return e;
      const extra = {};
      [...DOB_KEYS, ...PHONE_KEYS].forEach((k) => {
        if (p[k] != null && String(p[k]).trim() !== "") extra[k] = p[k];
      });
      return { ...e, ...extra };
    });
  }, [employees, profiles, skip]);
}

// Builds 3–4 random cards and prepares a File for mobile sharing.
function useBirthdayCards(name, dob, shuffleKey) {
  const base = useMemo(() => {
    if (!dob) return [];
    const dobText = fmtDob(dob);
    const seed = shuffleKey * 7919 + name.length * 31 + (Date.now() % 100000);
    const rand = seeded(seed);
    const count = rand() < 0.5 ? 3 : 4;
    return shuffle(TEMPLATES, rand)
      .slice(0, count)
      .map((tpl, i) => {
        const canvas = renderCard(tpl, name, dobText, seed + i * 101);
        return { id: tpl.id, label: tpl.label, canvas, url: canvas.toDataURL("image/png") };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, dob?.d, dob?.m, dob?.y, shuffleKey]);

  const [files, setFiles] = useState({});
  useEffect(() => {
    let cancelled = false;
    setFiles({});
    base.forEach((card) => {
      card.canvas.toBlob((blob) => {
        if (cancelled || !blob) return;
        const file = new File([blob], `birthday-${name.replace(/\s+/g, "-").toLowerCase()}-${card.id}.png`, { type: "image/png" });
        setFiles((prev) => ({ ...prev, [card.id]: file }));
      }, "image/png");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  return useMemo(() => base.map((c) => ({ ...c, file: files[c.id] })), [base, files]);
}

// Download / WhatsApp handlers.
// WhatsApp links cannot attach an image, so on desktop the card is copied to the
// clipboard first and a visible notice explains the paste step BEFORE the chat opens
// (opening the chat moves focus to another tab, so a toast would never be seen).
function useCardActions(name, phone) {
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState(null); // { ok, card }
  const timer = useRef(null);

  const flash = (text) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3800);
  };

  const fileName = (card) => `birthday-${String(name).replace(/\s+/g, "-").toLowerCase()}-${card.id}.png`;

  const download = (card) => {
    try {
      const a = document.createElement("a");
      a.href = card.url;
      a.download = fileName(card);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      flash("Could not download the image.");
    }
  };

  const chatUrl = phone ? `https://wa.me/${phone}` : "https://web.whatsapp.com/";
  const openChat = () => window.open(chatUrl, "_blank", "noopener");
  const canShareFile = (card) => !!(card?.file && navigator.canShare?.({ files: [card.file] }));
  const shareFile = (card) =>
    navigator.share({ files: [card.file] }).catch((err) => {
      if (err?.name !== "AbortError") flash("Sharing failed. Try the Download button instead.");
    });

  const sendWhatsApp = (card) => {
    try {
      // Phone: share the image itself (WhatsApp appears in the share sheet, no text)
      if (isMobileDevice() && canShareFile(card)) {
        shareFile(card);
        return;
      }
      // Desktop: copy the image, then show the paste instructions
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const blobPromise = card.file
          ? Promise.resolve(card.file)
          : new Promise((res) => card.canvas.toBlob(res, "image/png"));
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": blobPromise })])
          .then(() => setNotice({ ok: true, card }))
          .catch(() => setNotice({ ok: false, card }));
        return;
      }
      setNotice({ ok: false, card });
    } catch {
      setNotice({ ok: false, card });
    }
  };

  const overlay = (
    <>
      {notice && (
        <div className="hrb-notice" role="dialog" aria-label="Send on WhatsApp">
          <strong>{notice.ok ? "Card copied ✓" : "Could not copy the card"}</strong>
          <p>
            {notice.ok
              ? "Open the WhatsApp chat, click the message box, press Ctrl+V, then Send."
              : "Download it, then attach it in the WhatsApp chat."}
          </p>
          <div className="hrb-notice-actions">
            <button
              type="button"
              className="hrb-wa"
              onClick={() => {
                openChat();
                setNotice(null);
              }}
            >
              Open WhatsApp chat
            </button>
            {!notice.ok && (
              <button type="button" className="hrb-dl" onClick={() => download(notice.card)}>
                Download
              </button>
            )}
            {notice.ok && canShareFile(notice.card) && (
              <button
                type="button"
                className="hrb-dl"
                onClick={() => {
                  shareFile(notice.card);
                  setNotice(null);
                }}
              >
                Share…
              </button>
            )}
            <button type="button" className="hrb-dl" onClick={() => setNotice(null)}>
              Close
            </button>
          </div>
        </div>
      )}
      {toast && <div className="hrb-toast">{toast}</div>}
    </>
  );

  return { overlay, download, sendWhatsApp };
}

/* ── component ───────────────────────────────────────────────────────── */
export default function HrBirthdayWishes({ employees, compact = false, skipMerge = false }) {
  const merged = useMergedEmployees(employees, skipMerge);
  const todays = useMemo(() => birthdaysFor(merged), [merged]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [shuffleKey, setShuffleKey] = useState(0);

  const current = todays[Math.min(activeIdx, todays.length - 1)];
  const name = current ? current.emp.name || current.emp.username || "Team member" : "";
  const phone = current ? cleanPhone(pickField(current.emp, PHONE_KEYS)) : "";
  const cards = useBirthdayCards(name, current?.dob, shuffleKey);
  const { overlay, download, sendWhatsApp } = useCardActions(name, phone);

  if (!current) return null;
  const first = name.split(" ")[0];

  return (
    <article className={`hrb${compact ? " is-compact" : ""}`}>
      <header className="hrb-head">
        <div className="hrb-person">
          <span className="hrb-avatar">{initialsFor(name)}</span>
          <div>
            <h2>It’s {first}’s birthday today</h2>
            <p>
              {name} · {fmtDob(current.dob)}
              {phone ? ` · +${phone}` : " · no phone on file"}
            </p>
          </div>
        </div>
        <button type="button" className="hr-quiet-button" onClick={() => setShuffleKey((k) => k + 1)}>
          Shuffle designs
        </button>
      </header>

      {todays.length > 1 && (
        <div className="hrb-tabs" role="tablist" aria-label="Employees with a birthday today">
          {todays.map((t, i) => (
            <button
              key={t.emp.username || t.emp.name}
              type="button"
              role="tab"
              aria-selected={i === activeIdx}
              className={`hrb-tab${i === activeIdx ? " active" : ""}`}
              onClick={() => setActiveIdx(i)}
            >
              {t.emp.name || t.emp.username}
            </button>
          ))}
        </div>
      )}

      <div className="hrb-cards">
        {cards.map((card) => (
          <figure className="hrb-card" key={card.id}>
            <img src={card.url} alt={`${card.label} birthday card for ${name}`} />
            <figcaption>
              <span>{card.label}</span>
              <div className="hrb-actions">
                <button type="button" className="hrb-wa" onClick={() => sendWhatsApp(card)}>
                  Send on WhatsApp
                </button>
                <button type="button" className="hrb-dl" onClick={() => download(card)}>
                  Download
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {overlay}
    </article>
  );
}

export function HrBirthdayOverview({ employees, onOpen }) {
  const merged = useMergedEmployees(employees);
  const todays = useMemo(() => birthdaysFor(merged), [merged]);

  return (
    <article className="hr-panel hrb-overview-panel">
      <div className="hr-panel-heading">
        <div>
          <h2>Birthdays today</h2>
          <p>{todays.length ? `${todays.length} team member${todays.length === 1 ? "" : "s"}` : "No birthdays today"}</p>
        </div>
      </div>
      {todays.length ? (
        <ul className="hrb-overview-list">
          {todays.map(({ emp }) => {
            const name = emp.name || emp.username || "Team member";
            return (
              <li key={emp.username || emp.user_name || name}>
                <span className="hrb-avatar sm">{initialsFor(name)}</span>
                <strong>{name}</strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="hr-list-empty">No birthdays today.</div>
      )}
      <button type="button" className="hr-panel-link" onClick={onOpen}>
        Open birthday menu <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

/* ── Birthdays page (sidebar item) ───────────────────────────────────── */
export function HrBirthdays({ employees, search = "" }) {
  const merged = useMergedEmployees(employees);
  const today = useMemo(() => birthdaysFor(merged), [merged]);
  const upcoming = useMemo(() => {
    const q = search.trim().toLowerCase();
    return upcomingBirthdays(merged, 60).filter((x) => !q || String(x.emp.name || "").toLowerCase().includes(q));
  }, [merged, search]);
  const missing = merged.filter((e) => !parseDob(pickField(e, DOB_KEYS))).length;

  return (
    <div className="hrb-page">
      {today.length ? (
        <HrBirthdayWishes employees={merged} skipMerge />
      ) : (
        <div className="hr-list-empty">No birthdays today.</div>
      )}

      <article className="hr-panel">
        <div className="hr-panel-heading">
          <div>
            <h2>Next 60 days</h2>
            <p>{missing ? `${missing} employee${missing === 1 ? "" : "s"} have no date of birth on record` : "Upcoming birthdays"}</p>
          </div>
        </div>
        <ul className="hrb-upcoming">
          {upcoming.map((x) => (
            <li key={x.emp.username || x.emp.name}>
              <span className="hrb-avatar sm">{initialsFor(x.emp.name)}</span>
              <div>
                <strong>{x.emp.name || x.emp.username}</strong>
                <small className="hrb-dob">DOB {fmtDob(x.dob)}</small>
              </div>
              <span>{x.next.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
              <em>{x.inDays === 1 ? "Tomorrow" : `in ${x.inDays} days`}</em>
            </li>
          ))}
          {!upcoming.length && <li className="hr-list-empty">No upcoming birthdays found.</li>}
        </ul>
      </article>
    </div>
  );
}

/* ── Small popup for a single employee (used from Employee detail modal) ── */
export function HrBirthdayCardPopup({ employee, onClose }) {
  const username = employee?.username || employee?.user_name || "";
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(!username);
  const [shuffleKey, setShuffleKey] = useState(0);

  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("hr_employee_profiles").select("*").eq("user_name", username).maybeSingle();
        if (!cancelled) setProfile(data || null);
      } catch {
        /* ignore – fall back to the employee record */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = employee?.name || username || "Team member";
  const first = name.split(" ")[0];
  const dob = parseDob(pickField(profile, DOB_KEYS) || pickField(employee, DOB_KEYS));
  const phone = cleanPhone(pickField(profile, PHONE_KEYS) || pickField(employee, PHONE_KEYS));
  const cards = useBirthdayCards(name, dob, shuffleKey);
  const { overlay, download, sendWhatsApp } = useCardActions(name, phone);

  const popup = (
    <div className="hrbp-overlay" onClick={onClose} role="presentation">
      <div
        className="hrbp-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Birthday cards for ${name}`}
      >
        <header className="hrbp-head">
          <div>
            <strong>Birthday cards</strong>
            <small>
              {name}
              {dob ? ` · ${fmtDob(dob)}` : ""}
            </small>
          </div>
          <div className="hrbp-head-actions">
            {dob && (
              <button type="button" className="hrbp-shuffle" onClick={() => setShuffleKey((k) => k + 1)}>
                Shuffle
              </button>
            )}
            <button type="button" className="hrbp-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        {dob ? (
          <div className="hrbp-grid">
            {cards.map((card) => (
              <figure className="hrbp-card" key={card.id}>
                <img src={card.url} alt={`${card.label} birthday card for ${name}`} />
                <div className="hrbp-fabs">
                  <button
                    type="button"
                    className="hrbp-fab is-wa"
                    onClick={() => sendWhatsApp(card)}
                    aria-label={`Send ${card.label} card on WhatsApp`}
                    title="Send on WhatsApp"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2.5a9.5 9.5 0 0 0-8.1 14.4L2.7 21.5l4.7-1.2A9.5 9.5 0 1 0 12 2.5zm0 1.9a7.6 7.6 0 1 1-3.9 14.1l-.3-.2-2.8.7.7-2.7-.2-.3A7.6 7.6 0 0 1 12 4.4z" />
                      <path d="M9.2 7.9c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.4 1.9.7 2.3.6 2.7.5.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.5-.3-1.6-.8c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.7-1-.6-.6-1-1.2-1.2-1.4-.1-.2 0-.3.1-.4l.4-.4.2-.4v-.4l-.7-1.6z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="hrbp-fab is-dl"
                    onClick={() => download(card)}
                    aria-label={`Download ${card.label} card`}
                    title="Download"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                    </svg>
                  </button>
                </div>
                <figcaption>
                  <span>{card.label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="hrbp-empty">
            {loaded
              ? `No date of birth saved for ${first}. Add DOB in the Info tab, then open this again.`
              : "Loading…"}
          </div>
        )}
        {overlay}
      </div>
    </div>
  );

  // Portal to <body> so the employee modal's overflow / blur can't clip or swallow clicks.
  return createPortal(popup, document.body);
}