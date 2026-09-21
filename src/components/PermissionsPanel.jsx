import { useMemo, useState } from "react";
import { supabase } from "../supabase";
import { PERM_FLAGS, isAdminUser } from "../lib/permissions";

function roleBadge(emp) {
  if (isAdminUser(emp)) {
    return <span className="perm-role perm-role-admin">ADMIN</span>;
  }
  const role = String(emp.role || emp.department || "employee").trim();
  return (
    <span className="perm-role perm-role-emp">
      {role ? role.toUpperCase() : "EMPLOYEE"}
    </span>
  );
}

function PermToggle({ on, disabled, busy, onClick, title }) {
  return (
    <button
      type="button"
      className={`perm-toggle ${on ? "is-yes" : "is-no"}`}
      disabled={disabled || busy}
      onClick={onClick}
      title={title}
    >
      {busy ? "…" : on ? "Yes" : "No"}
    </button>
  );
}

export default function PermissionsPanel({ employees, loading, onChanged, showToast }) {
  const [busyKey, setBusyKey] = useState("");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (employees || [])
      .filter((e) => String(e.status || "Active").toLowerCase() !== "inactive")
      .filter((e) => {
        if (!q) return true;
        return (
          String(e.name || "").toLowerCase().includes(q) ||
          String(e.username || "").toLowerCase().includes(q) ||
          String(e.role || "").toLowerCase().includes(q) ||
          String(e.department || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [employees, query]);

  const toggle = async (emp, flag) => {
    if (isAdminUser(emp)) return;
    const next = !emp[flag];
    const lock = `${emp.id}:${flag}`;
    setBusyKey(lock);
    const { error } = await supabase
      .from("user_details")
      .update({ [flag]: next })
      .eq("id", emp.id);
    setBusyKey("");
    if (error) {
      showToast?.("error", error.message || "Failed to update permission.");
      return;
    }
    onChanged?.(emp.id, flag, next);
    showToast?.(
      "success",
      `${emp.name || emp.username}: ${PERM_FLAGS.find((f) => f.key === flag)?.label || flag} → ${next ? "Yes" : "No"}`,
    );
  };

  if (loading) {
    return (
      <div className="op-empty-state">
        <div className="op-spinner" />
        <p className="op-empty-text">Loading employees…</p>
      </div>
    );
  }

  return (
    <div className="perm-page">
      <div className="perm-head">
        <h2 className="perm-title">Permissions</h2>
        <p className="perm-sub">
          Decide what each employee is allowed to do — Add task, Add site, Add
          employee, resolve tickets, verify tasks, MIS, Office ↔ Site / MDO —
          without making them a full admin. These flags override role and
          department.
        </p>
        <input
          className="ap-input perm-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username, role…"
        />
      </div>

      {!rows.length ? (
        <div className="op-empty-state">
          <p className="op-empty-text">No employees found.</p>
        </div>
      ) : (
        <div className="ap-table-wrap perm-table-wrap">
          <table className="ap-table perm-table">
            <thead>
              <tr>
                <th className="ap-th">Name</th>
                <th className="ap-th">Role</th>
                {PERM_FLAGS.map((f) => (
                  <th key={f.key} className="ap-th perm-th">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((emp) => {
                const adminRow = isAdminUser(emp);
                return (
                  <tr key={emp.id} className="ap-tr">
                    <td className="ap-td ap-td-title">{emp.name || "—"}</td>
                    <td className="ap-td">{roleBadge(emp)}</td>
                    {PERM_FLAGS.map((f) => {
                      const on = adminRow || !!emp[f.key];
                      return (
                        <td key={f.key} className="ap-td perm-td">
                          <PermToggle
                            on={on}
                            disabled={adminRow}
                            busy={busyKey === `${emp.id}:${f.key}`}
                            title={
                              adminRow
                                ? "Admins already have full access"
                                : `Toggle "${f.label}" for ${emp.name || emp.username}`
                            }
                            onClick={() => toggle(emp, f.key)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
