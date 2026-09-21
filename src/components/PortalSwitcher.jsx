import "./PortalSwitcher.css";

const SWAP_ICON = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 3L4 7l4 4" />
    <path d="M4 7h12" />
    <path d="M16 21l4-4-4-4" />
    <path d="M20 17H8" />
  </svg>
);

/**
 * Compact portal switcher for sidebars.
 * items: [{ key, label, href, title? }]
 */
export default function PortalSwitcher({ items = [] }) {
  const list = (items || []).filter((item) => item && item.href && item.label);
  if (!list.length) return null;

  return (
    <div className="portal-switcher">
      <div className="portal-switcher-label">Portals</div>
      <div className="portal-switcher-list" role="navigation" aria-label="Switch portal">
        {list.map((item) => (
          <button
            key={item.key || item.href}
            type="button"
            className="portal-switcher-item"
            title={item.title || `Open ${item.label} portal`}
            onClick={() => window.location.assign(item.href)}
          >
            <span className="portal-switcher-ico">{SWAP_ICON}</span>
            <span className="portal-switcher-text">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
