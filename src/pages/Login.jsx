import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import LOGO_URL from "../assets/logo.png";
import "./Login.css";
import { defaultPortalFor } from "../access.js";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const getSafeNext = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next || !next.startsWith("/site/qr-scan")) return null;
    return next;
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    const next = getSafeNext();
    if (next) navigate(next);
    else redirectUser(user.department);
  }, [navigate]);

  const redirectUser = (department) => {
    const normalizeddepartment = department?.trim()?.toLowerCase();
    switch (normalizeddepartment) {
      case "hr":              navigate("/hr");     break;
      case "client":          navigate("/client"); break;
      case "admin":           navigate("/admin");  break;
      case "project head":    navigate("/head");   break;
      case "engineer office": navigate("/office"); break;
      case "site engineer":   navigate("/site");   break;
      case "mdo office":      navigate("/mdo");    break;
      default: alert(`No portal assigned for department: ${department}`);
    }
  };

  const clearAlerts = () => { setError(""); setMessage(""); };

  const handlePasswordReset = async () => {
    clearAlerts();
    if (!resetEmail.trim()) { setError("Please enter your email address."); return; }
    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    setMessage("If that email is registered, a reset link has been sent. Check your inbox.");
    setResetEmail("");
    setResetSent(true);
  };

  const login = async () => {
    clearAlerts();
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    const { data: userRow, error: userError } = await supabase
      .from("user_details")
      .select("*")
      .eq("username", username.trim())
      .single();

    if (userError || !userRow) {
      setLoading(false);
      setError("Invalid username or password. Please try again.");
      return;
    }
    if (userRow.password !== password) {
      setLoading(false);
      setError("Invalid username or password. Please try again.");
      return;
    }
    setLoading(false);
const userData = {
      id:          userRow.id,
      user_name:   userRow.username,
      name:        userRow.name,
      department:  userRow.department,
      role:        userRow.role || "",
      status:      userRow.status,
      site_name:   userRow.site_name || "",
      site_names:  userRow.site_names || null,
      designation: userRow.department || "",
      can_add_task: !!userRow.can_add_task,
      can_add_site: !!userRow.can_add_site,
      can_add_employee: !!userRow.can_add_employee,
      can_resolve_tickets: !!userRow.can_resolve_tickets,
      can_verify: !!userRow.can_verify,
      is_mis_executive: !!userRow.is_mis_executive,
      can_switch_office_site: !!userRow.can_switch_office_site,
      can_switch_office_mdo: !!userRow.can_switch_office_mdo,
    };
    localStorage.setItem("user", JSON.stringify(userData));
    const next = getSafeNext();
    if (next) navigate(next);
    else redirectUser(userData.department);
  };
  

  return (
    <div className="lp-page">
      {/* Left decorative panel */}
      <div className="lp-panel">
        <div className="lp-panel-inner">
          <img src={LOGO_URL} alt="DIP Projects" className="lp-panel-logo" />
          <div className="lp-panel-name">DIP Projects</div>
          <div className="lp-panel-tagline">Civil Project Management Consultants</div>
          <div className="lp-panel-divider" />
          <div className="lp-panel-quote">
            "Quality + Quantity to be dilevered on time."
          </div>
          <div className="lp-panel-dots">
            
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="lp-form-side">
        <div className="lp-card">
          {/* Mobile logo */}
          <div className="lp-mobile-brand">
            <img src={LOGO_URL} alt="DIP Projects" className="lp-mobile-logo" />
            <div>
              <div className="lp-mobile-name">DIP Projects</div>
              <div className="lp-mobile-sub">Civil Project Management</div>
            </div>
          </div>

          <div className="lp-heading">DIP Projects Platform</div>
          <div className="lp-subheading">Sign in to access project intelligence, reporting, and collaboration tools.</div>

          {message && (
            <div className="lp-alert lp-alert-success">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              {message}
            </div>
          )}
          {error && (
            <div className="lp-alert lp-alert-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div className="lp-field">
            <label className="lp-label">Username</label>
            <div className="lp-input-wrap">
              <svg className="lp-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input
                className="lp-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                onKeyDown={e => e.key === "Enter" && login()}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="lp-field">
            <label className="lp-label">Password</label>
            <div className="lp-input-wrap">
              <svg className="lp-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input
                className="lp-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={e => e.key === "Enter" && login()}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="lp-eye-btn"
                onClick={() => setShowPassword(p => !p)}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <button className="lp-btn-primary" onClick={login} disabled={loading}>
            {loading ? (
              <><span className="lp-spinner" /> Signing in…</>
            ) : (
              <>
                Sign In
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </>
            )}
          </button>

          <button
            type="button"
            className="lp-forgot-link"
            onClick={() => { clearAlerts(); setShowResetPanel(p => !p); setResetSent(false); }}
          >
            Forgot your password?
          </button>

          {showResetPanel && (
            <div className="lp-reset-panel">
              {!resetSent ? (
                <>
                  <div className="lp-reset-title">Reset Password</div>
                  <p className="lp-reset-sub">Enter your registered email to receive a reset link.</p>
                  <div className="lp-input-wrap" style={{ marginBottom: 12 }}>
                    <svg className="lp-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <input
                      className="lp-input"
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="your@email.com"
                      onKeyDown={e => e.key === "Enter" && handlePasswordReset()}
                    />
                  </div>
                  <button className="lp-btn-secondary" onClick={handlePasswordReset} disabled={resetLoading}>
                    {resetLoading ? "Sending…" : "Send Reset Link"}
                  </button>
                </>
              ) : (
                <div className="lp-reset-sent">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span>Reset link sent! Check your inbox — it expires in 1 hour.</span>
                  <button type="button" className="lp-forgot-link" style={{ marginTop: 8 }}
                    onClick={() => { setResetSent(false); setMessage(""); }}>
                    Try a different email
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="lp-footer">© {new Date().getFullYear()} DIP Projects · All rights reserved</div>
        </div>
      </div>
    </div>
  );
}