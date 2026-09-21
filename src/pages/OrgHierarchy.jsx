import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./OrgHierarchy.css";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function orgInitials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function parseEmployeeSites(emp) {
  if (Array.isArray(emp?.site_names) && emp.site_names.length) {
    return emp.site_names.map((s) => String(s || "").trim()).filter(Boolean);
  }
  if (emp?.site_name) return [String(emp.site_name).trim()].filter(Boolean);
  return [];
}

function orgRoleRank(employee) {
  const blob = [employee?.role, employee?.department]
    .map((value) => String(value || "").toLowerCase())
    .join(" ")
    .replace(/[.-]/g, " ");
  if (/\badmin\b/.test(String(employee?.role || "").toLowerCase())) return 0;
  if (/\bhead\b|project head|site head/.test(blob)) return 1;
  if (/co[-\s]*ordinator/.test(blob)) return 2;
  if (/incharge/.test(blob)) return 3;
  if (/jr\s+(?:site\s+)?engineer|junior\s+(?:site\s+)?engineer/.test(blob)) return 5;
  if (/engineer/.test(blob)) return 4;
  return 6;
}

function orgRoleLabel(rank) {
  return ["Admin", "Head", "Co-ordinator", "Incharge", "Engineer", "Jr. Engineer", "Other"][rank] || "Other";
}

function orgNodeMeta(node) {
  if (node.isOrgDept) return "Department";
  if (node.orgRoleRank >= 0 && node.orgRoleRank < 6) return orgRoleLabel(node.orgRoleRank);
  return String(node.department || node.role || "").trim() || "Office";
}

function sortOrgNodes(a, b) {
  return (
    a.orgRoleRank - b.orgRoleRank ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function isCarDriverOrOfficeBoy(node) {
  const blob = [node?.role, node?.department, node?.name]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return /car\s*drivers?|office\s*boys?|officeboy/.test(blob);
}

function isHrPerson(node) {
  if (node?.isOrgDept) return false;
  const blob = [node?.role, node?.department, node?.name]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return /\bhr\b|human\s*resources?/.test(blob);
}

function isRootPerson(node) {
  return normalizeText(node?.name) === "chirag shah";
}

function uniqueHierarchyEmployees(employees) {
  const seenIds = new Set();
  const seenNames = new Set();
  return employees.filter((employee) => {
    const nameKey = normalizeText(employee.name);
    const isDuplicate =
      (employee.id != null && seenIds.has(employee.id)) ||
      (nameKey && seenNames.has(nameKey));
    if (isDuplicate) return false;
    if (employee.id != null) seenIds.add(employee.id);
    if (nameKey) seenNames.add(nameKey);
    return true;
  });
}

function buildSiteSupervisorMap(nodes, sites) {
  const byName = new Map();
  (sites || []).forEach((site) => {
    const key = normalizeText(site.site_name || site.name);
    if (key) byName.set(key, site);
  });
  const empByName = new Map(nodes.map((n) => [normalizeText(n.name), n]));
  const map = new Map();

  nodes.forEach((emp) => {
    const empSites = parseEmployeeSites(emp);
    if (!empSites.length) return;
    for (const siteName of empSites) {
      const site = byName.get(normalizeText(siteName));
      if (!site) continue;
      const coordinator = empByName.get(normalizeText(site.coordinator_name));
      const incharge = nodes.find(
        (n) =>
          n.orgRoleRank === 3 &&
          parseEmployeeSites(n).some((s) => normalizeText(s) === normalizeText(siteName)),
      );
      if (coordinator || incharge) {
        map.set(emp.id, {
          coordinatorId: coordinator?.id || null,
          inchargeId: incharge?.id || null,
        });
        break;
      }
    }
  });
  return map;
}

function detachMatching(node, predicate, out) {
  if (!node?.children?.length) return;
  const keep = [];
  node.children.forEach((child) => {
    detachMatching(child, predicate, out);
    if (predicate(child)) out.push(child);
    else keep.push(child);
  });
  node.children = keep;
}

function normalizeHeadBranch(head, byId, siteSupervisorMap) {
  const branch = [];
  const visit = (node) => {
    (node.children || []).forEach((child) => {
      branch.push(child);
      visit(child);
    });
  };
  visit(head);
  branch.forEach((node) => {
    node.children = [];
  });
  head.children = [];

  const byRank = new Map();
  branch.forEach((node) => {
    if (!byRank.has(node.orgRoleRank)) byRank.set(node.orgRoleRank, []);
    byRank.get(node.orgRoleRank).push(node);
  });

  const TIER_RANKS = [2, 3, 4, 5];
  let primaryRank = null;
  for (const rank of TIER_RANKS) {
    if ((byRank.get(rank) || []).length) {
      primaryRank = rank;
      break;
    }
  }
  const primaryTier = primaryRank != null ? byRank.get(primaryRank) || [] : [];
  const primaryTierIds = new Set(primaryTier.map((n) => n.id));
  const placed = new Set();
  const lifted = [];

  const takeLifted = (node) => {
    if (isCarDriverOrOfficeBoy(node) || isHrPerson(node)) {
      lifted.push(node);
      placed.add(node.id);
      return true;
    }
    return false;
  };

  if (primaryRank != null) {
    TIER_RANKS.filter((rank) => rank > primaryRank).forEach((rank) => {
      (byRank.get(rank) || []).forEach((node) => {
        if (placed.has(node.id)) return;
        if (takeLifted(node)) return;
        const sup = siteSupervisorMap.get(node.id);
        let parent = null;
        if (sup?.coordinatorId && primaryTierIds.has(sup.coordinatorId)) {
          parent = byId.get(sup.coordinatorId);
        } else if (sup?.inchargeId && primaryTierIds.has(sup.inchargeId)) {
          parent = byId.get(sup.inchargeId);
        }
        if (!parent) parent = primaryTier.length === 1 ? primaryTier[0] : head;
        parent.children.push(node);
        placed.add(node.id);
      });
    });
  }

  primaryTier.forEach((node) => {
    if (placed.has(node.id)) return;
    if (takeLifted(node)) return;
    head.children.push(node);
    placed.add(node.id);
  });

  (byRank.get(6) || []).forEach((node) => {
    if (placed.has(node.id)) return;
    if (takeLifted(node)) return;
    head.children.push(node);
    placed.add(node.id);
  });

  branch.forEach((node) => {
    if (placed.has(node.id)) return;
    takeLifted(node);
  });

  return lifted;
}

function inferParentHead(node, heads, sites) {
  const empSites = parseEmployeeSites(node);
  const siteByName = new Map(
    (sites || []).map((s) => [normalizeText(s.site_name || s.name), s]),
  );
  for (const siteName of empSites) {
    const site = siteByName.get(normalizeText(siteName));
    if (!site) continue;
    const head = heads.find((h) => normalizeText(h.name) === normalizeText(site.head_name));
    if (head && head.id !== node.id) return head;
  }
  for (const head of heads) {
    const headSites = parseEmployeeSites(head);
    if (empSites.some((s) => headSites.some((hs) => normalizeText(hs) === normalizeText(s)))) {
      return head;
    }
  }
  return null;
}

function buildOrgTree(employees, sites = []) {
  const nodes = employees.map((employee) => ({
    ...employee,
    name: employee.name || employee.username || "—",
    orgRoleRank: orgRoleRank(employee),
    children: [],
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const siteSupervisorMap = buildSiteSupervisorMap(nodes, sites);

  const root =
    nodes.find((node) => isRootPerson(node)) ||
    nodes.find((node) => node.orgRoleRank === 0) ||
    null;

  const heads = nodes.filter((node) => node !== root && node.orgRoleRank === 1);
  const leftovers = [];

  nodes.forEach((node) => {
    if (node === root || heads.includes(node)) return;
    const head = inferParentHead(node, heads, sites);
    if (head) head.children.push(node);
    else leftovers.push(node);
  });

  const lifted = [];
  heads.forEach((head) => {
    lifted.push(...normalizeHeadBranch(head, byId, siteSupervisorMap));
  });

  leftovers.forEach((node) => {
    if (isHrPerson(node) || isCarDriverOrOfficeBoy(node) || node.orgRoleRank > 1) {
      lifted.push(node);
    }
  });

  if (root) {
    heads.forEach((head) => {
      detachMatching(head, (n) => isCarDriverOrOfficeBoy(n) || isHrPerson(n), lifted);
    });

    const seen = new Set();
    const uniq = (list) => {
      const out = [];
      list.forEach((node) => {
        const key = node.id ?? normalizeText(node.name);
        if (key === "" || key == null || seen.has(key)) return;
        seen.add(key);
        out.push(node);
      });
      return out;
    };

    const hrPeople = uniq(lifted.filter((n) => isHrPerson(n)));
    const drivers = uniq(
      lifted.filter((n) => /car\s*drivers?/.test([n.role, n.department].map((v) => String(v || "").toLowerCase()).join(" "))),
    );
    const officeBoys = uniq(
      lifted.filter((n) => /office\s*boys?|officeboy/.test([n.role, n.department].map((v) => String(v || "").toLowerCase()).join(" "))),
    );
    const otherPeers = uniq(
      lifted.filter((n) => !isHrPerson(n) && !isCarDriverOrOfficeBoy(n) && n.orgRoleRank > 1 && !heads.includes(n)),
    );

    const hrPeers = hrPeople.length
      ? hrPeople
      : [
          {
            id: `org-dept-hr-${root.id}`,
            name: "HR",
            department: "HR",
            orgRoleRank: 1,
            isOrgDept: true,
            children: [],
          },
        ];

    root.children = [
      ...uniq(heads).sort(sortOrgNodes),
      ...hrPeers,
      ...drivers,
      ...officeBoys,
      ...otherPeers,
    ];
    root._orgPeerRow = true;
    return [root];
  }

  heads.forEach((head) => head.children.sort(sortOrgNodes));
  return heads.sort(sortOrgNodes);
}

function shouldStackChildren(children, parentNode = null) {
  if (!children?.length) return false;
  if (parentNode?.orgRoleRank === 1 && !parentNode?.isOrgDept && children.length >= 1) return true;
  const allLeaves = children.every((child) => !child.children?.length);
  if (allLeaves && children.length >= 2) return true;
  const leafHeavy = children.filter((child) => !child.children?.length || child.children.length <= 1).length;
  return children.length >= 4 && leafHeavy >= Math.ceil(children.length * 0.75);
}

function OrgBranch({ node, depth = 0, renderedIds }) {
  const nodeKey = node.id ?? normalizeText(node.name);
  if (renderedIds.has(nodeKey)) return null;
  renderedIds.add(nodeKey);

  const level = Math.min(depth, 3);
  const peerRow = !!node._orgPeerRow || isRootPerson(node);
  const stack = !peerRow && shouldStackChildren(node.children, node);
  const kids = peerRow ? node.children : [...(node.children || [])].sort(sortOrgNodes);
  const meta = orgNodeMeta(node);
  const sitesLabel = node.isOrgDept ? "" : parseEmployeeSites(node).join(", ");

  return (
    <div className="org-branch">
      {node.isOrgGroup ? (
        <div className="org-node-group-anchor" />
      ) : (
        <div
          className={`org-node org-node-d${level}${depth === 0 ? " org-node-root" : ""}${node.isOrgDept ? " org-node-dept" : ""}`}
          title={[node.name, meta, sitesLabel].filter(Boolean).join(" — ")}
        >
          <div className="org-node-avatar">{node.isOrgDept ? "HR" : orgInitials(node.name)}</div>
          <div className="org-node-info">
            <span className="org-node-name">{node.name}</span>
            <span className="org-node-meta">{meta}</span>
            {sitesLabel ? <span className="org-node-sites">{sitesLabel}</span> : null}
          </div>
        </div>
      )}
      {kids?.length > 0 && (
        <div
          className={`org-branch-children${peerRow ? " org-branch-children-peers" : ""}${stack ? " org-branch-children-stack" : ""}`}
        >
          {kids.map((child) => (
            <OrgBranch
              key={child.id ?? child.name}
              node={child}
              depth={depth + 1}
              renderedIds={renderedIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function drawOrgTreeLines(treeEl, host) {
  if (!treeEl || !host) return;
  const existing = host.querySelector(".org-tree-svg");
  if (existing) existing.remove();

  const hostRect = host.getBoundingClientRect();
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "org-tree-svg");
  const width = Math.max(host.scrollWidth, treeEl.scrollWidth, 1);
  const height = Math.max(host.scrollHeight, treeEl.scrollHeight, 1);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  const addLine = (d) => {
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("class", "org-line");
    path.setAttribute("fill", "none");
    path.setAttribute("d", d);
    svg.appendChild(path);
  };

  const curveToChild = (px, py, cx, cy) => {
    const midY = py + Math.max(8, (cy - py) * 0.42);
    const bend = Math.min(14, Math.abs(cx - px) * 0.3);
    if (Math.abs(cx - px) < 2) return `M ${px} ${py} V ${cy}`;
    return `M ${px} ${py} V ${midY - bend} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${midY + bend} V ${cy}`;
  };

  treeEl.querySelectorAll(".org-branch").forEach((branch) => {
    const parentNode = branch.querySelector(":scope > .org-node, :scope > .org-node-group-anchor");
    const childrenWrap = branch.querySelector(":scope > .org-branch-children");
    if (!parentNode || !childrenWrap) return;

    const pRect = parentNode.getBoundingClientRect();
    const px = pRect.left + pRect.width / 2 - hostRect.left;
    const py = pRect.bottom - hostRect.top;
    const kids = Array.from(childrenWrap.children)
      .map((childBranch) => childBranch.querySelector(":scope > .org-node, :scope > .org-node-group-anchor"))
      .filter(Boolean);

    if (childrenWrap.classList.contains("org-branch-children-stack") && kids.length) {
      const first = kids[0].getBoundingClientRect();
      const last = kids[kids.length - 1].getBoundingClientRect();
      const wrapRect = childrenWrap.getBoundingClientRect();
      const spineX = wrapRect.left - hostRect.left + 8;
      const elbowY = py + 12;
      const firstCy = first.top + first.height / 2 - hostRect.top;
      const lastCy = last.top + last.height / 2 - hostRect.top;
      const spineBot = Math.max(firstCy, lastCy);
      addLine(`M ${px} ${py} V ${elbowY} H ${spineX} V ${spineBot}`);
      kids.forEach((childNode) => {
        const cRect = childNode.getBoundingClientRect();
        const cy = cRect.top + cRect.height / 2 - hostRect.top;
        const cleft = cRect.left - hostRect.left;
        addLine(`M ${spineX} ${cy} H ${Math.max(cleft, spineX)}`);
      });
      return;
    }

    kids.forEach((childNode) => {
      const cRect = childNode.getBoundingClientRect();
      const cx = cRect.left + cRect.width / 2 - hostRect.left;
      const cy = cRect.top - hostRect.top;
      addLine(curveToChild(px, py, cx, cy));
    });
  });

  host.insertBefore(svg, treeEl);
}

export default function OrgHierarchy({ employees = [], sites = [] }) {
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);
  const fitRef = useRef(null);
  const treeRef = useRef(null);

  const chartEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = uniqueHierarchyEmployees(
      employees.filter((emp) => {
        const status = String(emp.status || "Active").toLowerCase();
        const role = normalizeText(emp.role);
        const dept = normalizeText(emp.department);
        if (status && status !== "active") return false;
        if (role === "client" || dept === "client") return false;
        return true;
      }),
    );
    if (!q) return base;
    return base.filter(
      (emp) =>
        String(emp.name || "").toLowerCase().includes(q) ||
        String(emp.role || "").toLowerCase().includes(q) ||
        String(emp.department || "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const roots = useMemo(() => buildOrgTree(chartEmployees, sites), [chartEmployees, sites]);

  const fitToView = useCallback((mode = "screen") => {
    const wrap = wrapRef.current;
    const fit = fitRef.current;
    const treeEl = treeRef.current;
    if (!wrap || !fit || !treeEl) return;

    fit.style.transform = "none";
    fit.style.zoom = "";
    fit.style.marginRight = "0";
    fit.style.marginBottom = "0";
    fit.style.width = "max-content";

    drawOrgTreeLines(treeEl, fit);

    const natW = Math.max(fit.scrollWidth, fit.offsetWidth, 1);
    const natH = Math.max(fit.scrollHeight, fit.offsetHeight, 1);
    const pageW = 1540;
    const pageH = 1060;
    const containerW = Math.max(wrap.clientWidth - 16, 280);
    const availW = mode === "print" ? pageW : containerW;
    const availH =
      mode === "print"
        ? pageH
        : Math.max(window.innerHeight - wrap.getBoundingClientRect().top - 28, 360);

    let scale = Math.min(1, availW / natW);
    if (mode === "print") scale = Math.min(availW / natW, availH / natH);

    if (mode === "print") {
      fit.style.transform = "none";
      fit.style.zoom = String(Number(scale.toFixed(4)));
    } else if (scale < 0.999) {
      fit.style.zoom = "";
      fit.style.transform = `scale(${scale.toFixed(4)})`;
      fit.style.marginRight = `${Math.ceil(-natW * (1 - scale))}px`;
      fit.style.marginBottom = `${Math.ceil(-natH * (1 - scale))}px`;
    }

    wrap.style.minHeight = `${Math.ceil(natH * scale) + 8}px`;
  }, []);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => fitToView("screen"));
    return () => cancelAnimationFrame(id);
  }, [roots, fitToView]);

  useEffect(() => {
    const onResize = () => fitToView("screen");
    const onAfterPrint = () => {
      document.body.classList.remove("org-print-mode");
      fitToView("screen");
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("afterprint", onAfterPrint);
      document.body.classList.remove("org-print-mode");
    };
  }, [fitToView]);

  const downloadPdf = () => {
    document.body.classList.add("org-print-mode");
    requestAnimationFrame(() => {
      fitToView("print");
      setTimeout(() => window.print(), 120);
    });
  };

  return (
    <div className="org-page">
      <div className="org-page-head">
        <div className="org-page-title-wrap">
          <div className="org-page-ico" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="4" rx="1" />
              <rect x="2" y="18" width="6" height="4" rx="1" />
              <rect x="9" y="18" width="6" height="4" rx="1" />
              <rect x="16" y="18" width="6" height="4" rx="1" />
              <line x1="12" y1="6" x2="12" y2="11" />
              <line x1="5" y1="18" x2="5" y2="14" />
              <line x1="12" y1="18" x2="12" y2="14" />
              <line x1="19" y1="18" x2="19" y2="14" />
              <line x1="5" y1="14" x2="19" y2="14" />
            </svg>
          </div>
          <div>
            <h2>Organization Hierarchy</h2>
            <p>{chartEmployees.length} active member{chartEmployees.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button type="button" className="org-pdf-btn" onClick={downloadPdf}>
          Download as PDF
        </button>
      </div>

      <div className="org-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, role or department…"
        />
      </div>

      <div className="org-tree-wrap" ref={wrapRef}>
        {roots.length === 0 ? (
          <div className="org-tree-empty">No active employees to show yet.</div>
        ) : (
          <div className="org-tree-fit" ref={fitRef}>
            <div className="org-tree" ref={treeRef}>
              {(() => {
                const renderedIds = new Set();
                return roots.map((root) => (
                  <OrgBranch key={root.id ?? root.name} node={root} renderedIds={renderedIds} />
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
