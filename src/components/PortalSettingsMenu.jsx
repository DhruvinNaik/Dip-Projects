import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "./PortalSettingsMenu.css";

const PERSONALIZATION_KEY = "portal-personalization";
const DEFAULT_PREFERENCES = {
  accent: "orange",
  navigationFont: "dm-sans",
  headingFont: "dm-sans",
  contentFont: "dm-sans",
  sidebarLayout: "comfortable",
};
const ACCENT_THEMES = [
  { id: "orange", name: "Citrus", start: "#3d1200", middle: "#7a2e00", end: "#c96a10", thumb: "#c96a10", shadow: "rgba(61, 18, 0, .35)" },
  { id: "ocean", name: "Ocean", start: "#082f49", middle: "#0369a1", end: "#38bdf8", thumb: "#0ea5e9", shadow: "rgba(3, 105, 161, .32)" },
  { id: "forest", name: "Forest", start: "#052e16", middle: "#15803d", end: "#4ade80", thumb: "#22c55e", shadow: "rgba(21, 128, 61, .32)" },
  { id: "royal", name: "Royal", start: "#2e1065", middle: "#6d28d9", end: "#a78bfa", thumb: "#8b5cf6", shadow: "rgba(109, 40, 217, .32)" },
  { id: "rose", name: "Rose", start: "#4c0519", middle: "#be123c", end: "#fb7185", thumb: "#e11d48", shadow: "rgba(190, 18, 60, .32)" },
  { id: "slate", name: "Slate", start: "#0f172a", middle: "#334155", end: "#94a3b8", thumb: "#64748b", shadow: "rgba(51, 65, 85, .32)" },
];
const FONT_OPTIONS = [
  { value: "dm-sans", label: "DM Sans", stack: "'DM Sans', sans-serif" },
  { value: "sora", label: "Sora", stack: "'Sora', sans-serif" },
  { value: "system", label: "System", stack: "system-ui, sans-serif" },
  { value: "georgia", label: "Georgia", stack: "Georgia, serif" },
];
const SIDEBAR_LAYOUTS = [
  { value: "compact", label: "Compact", description: "More room for content", width: "210px" },
  { value: "comfortable", label: "Comfortable", description: "Balanced everyday layout", width: "248px" },
  { value: "spacious", label: "Spacious", description: "Extra room for navigation", width: "286px" },
];

function getPreferenceKey(user) {
  const identity = user?.user_name || user?.username || user?.email || user?.id || "default";
  return `${PERSONALIZATION_KEY}:${String(identity).toLowerCase()}`;
}

function readPreferences(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(getPreferenceKey(user)) || "{}");
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
      accent: ACCENT_THEMES.some((theme) => theme.id === saved.accent)
        ? saved.accent
        : DEFAULT_PREFERENCES.accent,
      navigationFont: FONT_OPTIONS.some((font) => font.value === saved.navigationFont)
        ? saved.navigationFont
        : DEFAULT_PREFERENCES.navigationFont,
      headingFont: FONT_OPTIONS.some((font) => font.value === saved.headingFont)
        ? saved.headingFont
        : DEFAULT_PREFERENCES.headingFont,
      contentFont: FONT_OPTIONS.some((font) => font.value === saved.contentFont)
        ? saved.contentFont
        : DEFAULT_PREFERENCES.contentFont,
      sidebarLayout: SIDEBAR_LAYOUTS.some((layout) => layout.value === saved.sidebarLayout)
        ? saved.sidebarLayout
        : DEFAULT_PREFERENCES.sidebarLayout,
    };
  } catch (error) {
    console.error("Could not load portal personalization settings.", error);
    return DEFAULT_PREFERENCES;
  }
}

const MenuIcon = ({ children }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export default function PortalSettingsMenu({
  user,
  isDark,
  onThemeToggle,
  onProfileClick,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [preferences, setPreferences] = useState(() => readPreferences(user));
  const navigate = useNavigate();
  const preferenceKey = getPreferenceKey(user);
  const preferenceOwner = useRef(preferenceKey);
  const skipPreferenceSave = useRef(false);

  useEffect(() => {
    if (preferenceOwner.current === preferenceKey) return;
    preferenceOwner.current = preferenceKey;
    skipPreferenceSave.current = true;
    setPreferences(readPreferences(user));
  }, [preferenceKey, user]);

  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENT_THEMES.find((theme) => theme.id === preferences.accent) || ACCENT_THEMES[0];
    const fonts = Object.fromEntries(
      FONT_OPTIONS.map((font) => [font.value, font.stack]),
    );
    const layout = SIDEBAR_LAYOUTS.find((item) => item.value === preferences.sidebarLayout) || SIDEBAR_LAYOUTS[1];
    root.setAttribute("data-portal-accent", accent.id);
    root.setAttribute("data-portal-sidebar", layout.value);
    root.style.setProperty("--portal-accent-start", accent.start);
    root.style.setProperty("--portal-accent-middle", accent.middle);
    root.style.setProperty("--portal-accent-end", accent.end);
    root.style.setProperty("--portal-scrollbar-thumb", accent.thumb);
    root.style.setProperty("--portal-accent-shadow", accent.shadow);
    root.style.setProperty("--portal-font-navigation", fonts[preferences.navigationFont]);
    root.style.setProperty("--portal-font-heading", fonts[preferences.headingFont]);
    root.style.setProperty("--portal-font-content", fonts[preferences.contentFont]);
    root.style.setProperty("--portal-sidebar-width", layout.width);
    if (skipPreferenceSave.current) {
      skipPreferenceSave.current = false;
      return;
    }
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    } catch (error) {
      console.error("Could not save portal personalization settings.", error);
    }
  }, [preferences, preferenceKey]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      setMenuPosition({
        left: Math.max(8, Math.min(
          trigger.left + trigger.width / 2,
          window.innerWidth - 228,
        )),
        bottom: Math.max(8, window.innerHeight - trigger.top + 8),
      });
    };
    const handlePointerDown = (event) => {
      if (
        !menuRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!personalizationOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPersonalizationOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [personalizationOpen]);

  const confirmLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("portalName");
    navigate("/");
  };

  const updatePreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <div className="portal-settings" ref={menuRef}>
        <button
          type="button"
          className="portal-settings-trigger"
          ref={triggerRef}
          aria-label="Open settings menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </MenuIcon>
          <span>Settings</span>
        </button>
      </div>
      {menuOpen && menuPosition && createPortal(
          <div
            className="portal-settings-menu"
            ref={popupRef}
            role="menu"
            aria-label="Settings"
            style={{
              left: `${menuPosition.left}px`,
              bottom: `${menuPosition.bottom}px`,
            }}
          >
            <button
              type="button"
              className="portal-settings-item"
              role="menuitem"
              disabled={!onProfileClick}
              onClick={() => {
                if (!onProfileClick) return;
                setMenuOpen(false);
                onProfileClick();
              }}
            >
              <MenuIcon>
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21a7 7 0 0 1 14 0" />
              </MenuIcon>
              <span>Profile</span>
            </button>
            <button
              type="button"
              className="portal-settings-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setPersonalizationOpen(true);
              }}
            >
              <MenuIcon>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="9" cy="6" r="2.5" fill="currentColor" stroke="none" />
                <circle cx="15" cy="12" r="2.5" fill="currentColor" stroke="none" />
                <circle cx="9" cy="18" r="2.5" fill="currentColor" stroke="none" />
              </MenuIcon>
              <span>Personalization</span>
            </button>
            <button
              type="button"
              className="portal-settings-item"
              role="menuitem"
              aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
              onClick={() => {
                onThemeToggle();
                setMenuOpen(false);
              }}
            >
              <MenuIcon>
                {isDark ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </>
                ) : (
                  <path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z" />
                )}
              </MenuIcon>
              <span>Theme</span>
              <span className="portal-settings-value">{isDark ? "Dark" : "Light"}</span>
            </button>
            <div className="portal-settings-divider" />
            <button
              type="button"
              className="portal-settings-item portal-settings-logout"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setLogoutOpen(true);
              }}
            >
              <MenuIcon>
                <path d="M10 17l5-5-5-5m5 5H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
              </MenuIcon>
              <span>Logout</span>
            </button>
          </div>,
          document.body,
        )}

      {personalizationOpen && createPortal(
        <div
          className="portal-personalization-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPersonalizationOpen(false);
          }}
          role="presentation"
        >
          <section
            className="portal-personalization-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-personalization-title"
          >
            <header className="portal-personalization-header">
              <div>
                <span className="portal-personalization-eyebrow">YOUR WORKSPACE</span>
                <h2 id="portal-personalization-title">Personalization</h2>
                <p>Tailor the look and feel of your Office and MDO portals.</p>
              </div>
              <button
                type="button"
                className="portal-personalization-close"
                aria-label="Close personalization"
                onClick={() => setPersonalizationOpen(false)}
              >
                <MenuIcon>
                  <path d="m18 6-12 12M6 6l12 12" />
                </MenuIcon>
              </button>
            </header>

            <div className="portal-personalization-content">
              <section className="portal-preference-section" aria-labelledby="accent-title">
                <div className="portal-preference-heading">
                  <h3 id="accent-title">Accent theme</h3>
                  <span>Header bar &amp; scrollbars</span>
                </div>
                <div className="portal-accent-options" role="radiogroup" aria-label="Accent theme">
                  {ACCENT_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      role="radio"
                      aria-checked={preferences.accent === theme.id}
                      className={`portal-accent-option${preferences.accent === theme.id ? " selected" : ""}`}
                      onClick={() => updatePreference("accent", theme.id)}
                    >
                      <span
                        className="portal-accent-swatch"
                        style={{ background: `linear-gradient(135deg, ${theme.start}, ${theme.middle}, ${theme.end})` }}
                      />
                      <span>{theme.name}</span>
                      {preferences.accent === theme.id && <span className="portal-accent-check" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="portal-preference-section" aria-labelledby="fonts-title">
                <div className="portal-preference-heading">
                  <h3 id="fonts-title">Typography</h3>
                  <span>Choose a font for each area</span>
                </div>
                <div className="portal-font-grid">
                  {[
                    ["navigationFont", "Navigation & controls"],
                    ["headingFont", "Section headings"],
                    ["contentFont", "Page content"],
                  ].map(([key, label]) => (
                    <label className="portal-font-field" key={key}>
                      <span>{label}</span>
                      <select
                        value={preferences[key]}
                        onChange={(event) => updatePreference(key, event.target.value)}
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option value={font.value} key={font.value}>{font.label}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              <section className="portal-preference-section" aria-labelledby="sidebar-title">
                <div className="portal-preference-heading">
                  <h3 id="sidebar-title">Sidebar layout</h3>
                  <span>Adjust navigation width</span>
                </div>
                <div className="portal-sidebar-options" role="radiogroup" aria-label="Sidebar layout">
                  {SIDEBAR_LAYOUTS.map((layout) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={preferences.sidebarLayout === layout.value}
                      className={`portal-sidebar-option${preferences.sidebarLayout === layout.value ? " selected" : ""}`}
                      key={layout.value}
                      onClick={() => updatePreference("sidebarLayout", layout.value)}
                    >
                      <span className={`portal-sidebar-preview ${layout.value}`} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="portal-sidebar-option-copy">
                        <strong>{layout.label}</strong>
                        <small>{layout.description}</small>
                      </span>
                      {preferences.sidebarLayout === layout.value && <span className="portal-sidebar-selected" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <footer className="portal-personalization-footer">
              <span>Changes are saved automatically for this account.</span>
              <button
                type="button"
                className="portal-personalization-reset"
                onClick={() => setPreferences(DEFAULT_PREFERENCES)}
              >
                Reset to defaults
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}

      {logoutOpen && createPortal(
        <div
          className="logout-backdrop"
          onClick={() => setLogoutOpen(false)}
          role="presentation"
        >
          <div
            className="logout-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="portal-settings-logout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="logout-modal-icon">
              <MenuIcon>
                <path d="M10 17l5-5-5-5m5 5H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
              </MenuIcon>
            </div>
            <div className="logout-modal-title" id="portal-settings-logout-title">
              Sign Out?
            </div>
            <div className="logout-modal-sub">
              You&apos;ll be returned to the login screen. Any unsaved changes will be lost.
            </div>
            {user && (
              <div className="logout-modal-user">
                <div className="logout-modal-avatar">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="logout-modal-uname">{user.name}</div>
                  <div className="logout-modal-urole">
                    {user.role || user.designation || ""}
                  </div>
                </div>
              </div>
            )}
            <div className="logout-modal-btns">
              <button
                type="button"
                className="logout-btn-cancel"
                onClick={() => setLogoutOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-btn-confirm"
                onClick={confirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
