import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { supabase } from "../supabase";
import { BillActions, billExcelValue, paintBillLinks, uploadMaterialBill } from "../components/MaterialBill";
import "./ArrivedMaterial.css";

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

function same(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

const CATEGORY_COLORS = [
  { bg: "#ecfdf5", border: "#6ee7b7", ink: "#047857" },
  { bg: "#eff6ff", border: "#93c5fd", ink: "#1d4ed8" },
  { bg: "#fff7ed", border: "#fdba74", ink: "#c2410c" },
  { bg: "#fdf2f8", border: "#f9a8d4", ink: "#be185d" },
  { bg: "#f5f3ff", border: "#c4b5fd", ink: "#6d28d9" },
  { bg: "#fefce8", border: "#fde047", ink: "#a16207" },
  { bg: "#ecfeff", border: "#67e8f9", ink: "#0e7490" },
  { bg: "#fef2f2", border: "#fca5a5", ink: "#b91c1c" },
  { bg: "#f0fdf4", border: "#86efac", ink: "#15803d" },
  { bg: "#eef2ff", border: "#a5b4fc", ink: "#4338ca" },
];

function categoryColor(name) {
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

function categoryStyle(name, selected) {
  const color = categoryColor(name);
  return {
    background: color.bg,
    borderColor: selected ? color.ink : color.border,
    color: color.ink,
    boxShadow: selected ? `inset 0 0 0 1px ${color.ink}` : "none",
  };
}

function CategorySearch({ categories, categoryId, onPick }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = categories.find((row) => row.id === categoryId);
  const needle = query.trim().toLowerCase();
  const matches = categories.filter((row) => !needle || String(row.name || "").toLowerCase().includes(needle));

  const choose = (id) => {
    onPick(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    window.setTimeout(() => inputRef.current?.blur(), 0);
  };

  return (
    <div className="am-cat-search">
      <input
        ref={inputRef}
        value={open ? query : (selected?.name || "")}
        placeholder="Search category"
        aria-label="Search category"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && (
        <ul>
          {matches.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={row.id === categoryId ? "is-on" : ""}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(row.id);
                }}
              >
                {row.name}
              </button>
            </li>
          ))}
          {!matches.length && <li className="am-cat-search-empty">No category</li>}
        </ul>
      )}
    </div>
  );
}
function hexPoint(index) {
  const cols = 3;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const x = col * 78 + (row % 2 ? 39 : 0);
  const y = row * 64;
  return { x, y };
}

function CategoryHoneycomb({ categories, categoryId, onPick, onAdd }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const moved = useRef(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 320, h: 320 });
  const items = [{ id: "other" }, ...categories.map((row) => ({ id: row.id, row }))];
  const points = items.map((_, index) => hexPoint(index));
  const midX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const midY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const panLimitX = Math.max(...points.map((point) => Math.abs(point.x - midX))) + 24;
  const panLimitY = Math.max(...points.map((point) => Math.abs(point.y - midY))) + 24;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const read = () => setSize({ w: node.clientWidth || 320, h: node.clientHeight || 320 });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    moved.current = 0;
    ref.current.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    moved.current += Math.hypot(dx, dy);
    current.x = event.clientX;
    current.y = event.clientY;
    setPan((value) => ({
      x: Math.max(-panLimitX, Math.min(panLimitX, value.x + dx)),
      y: Math.max(-panLimitY, Math.min(panLimitY, value.y + dy)),
    }));
  };
  const onPointerUp = (event) => {
    if (drag.current?.id === event.pointerId && ref.current?.hasPointerCapture(event.pointerId)) {
      ref.current.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  };

  const cx = size.w / 2;
  const cy = size.h / 2;

  return (
    <div
      className="am-honey"
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {items.map((item, index) => {
        const point = points[index];
        const left = cx + (point.x - midX) + pan.x;
        const top = cy + (point.y - midY) + pan.y;
        const dist = Math.hypot(left - cx, top - cy);
        const reach = Math.max(120, Math.min(cx, cy));
        const t = Math.min(dist / reach, 1);
        const scale = 1.12 - t * 0.62;
        const style = {
          left,
          top,
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity: 1 - t * 0.42,
          zIndex: Math.round((1 - t) * 20),
        };
        if (!item.row) {
          return (
            <button
              key="other"
              type="button"
              className="am-cat am-other"
              style={style}
              onClick={() => {
                if (moved.current > 8) return;
                onAdd();
              }}
            >
              + Other
            </button>
          );
        }
        return (
          <button
            key={item.row.id}
            type="button"
            className={`am-cat${categoryId === item.row.id ? " is-on" : ""}`}
            style={{ ...style, ...categoryStyle(item.row.name, categoryId === item.row.id) }}
            onClick={() => {
              if (moved.current > 8) return;
              onPick(item.row.id);
            }}
          >
            <span className="am-cat-name">{item.row.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ArrivedMaterial({ user }) {
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
    const allowed = assignedSites(user);
    const rows = (arrivals.data || []).filter((row) => allowed.some((name) => same(name, row.site_name)));
    setRecords(rows);
    setLoading(false);
  }, [user]);

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

  const subcategories = sortByName(catalog.subcategories.filter((row) => row.category_id === categoryId));
  const types = sortByName(catalog.types.filter((row) => row.subcategory_id === subcategoryId));
  const units = sortText(catalog.units.filter((row) => row.subcategory_id === subcategoryId).map((row) => row.unit));
  const sortedCategories = sortByName(catalog.categories);
  const sortedSites = sortText(sites);

  const siteRecords = useMemo(
    () => records.filter((row) => !siteName || same(row.site_name, siteName)),
    [records, siteName],
  );

  const filterSubcategories = catalog.subcategories.filter((row) => !filterCategory || row.category_id === filterCategory);
  const filterTypes = catalog.types.filter((row) => {
    if (filterSubcategory) return row.subcategory_id === filterSubcategory;
    if (!filterCategory) return true;
    return filterSubcategories.some((sub) => sub.id === row.subcategory_id);
  });
  const sortedFilterSubcategories = sortByName(filterSubcategories);
  const sortedFilterTypes = sortByName(filterTypes);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categoryName = catalog.categories.find((row) => row.id === filterCategory)?.name || "";
    const subcategoryName = catalog.subcategories.find((row) => row.id === filterSubcategory)?.name || "";
    const typeName = catalog.types.find((row) => row.id === filterType)?.name || "";
    return siteRecords.filter((row) => {
      if (categoryName && !same(row.category_name, categoryName)) return false;
      if (subcategoryName && !same(row.subcategory_name, subcategoryName)) return false;
      if (typeName && !same(row.type_name, typeName)) return false;
      if (!q) return true;
      return [row.category_name, row.subcategory_name, row.type_name, row.unit, row.recorded_by, row.site_name, row.quantity]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [siteRecords, search, filterCategory, filterSubcategory, filterType, catalog]);

  const pickCategory = (id) => {
    setCategoryId(id);
    setSubcategoryId("");
    setTypeId("");
    setQuantity("");
    setUnit("");
    setFilterCategory(id);
    setFilterSubcategory("");
    setFilterType("");
  };

  const pickSubcategory = (id) => {
    setSubcategoryId(id);
    setTypeId("");
    setQuantity("");
    const nextUnits = catalog.units.filter((row) => row.subcategory_id === id).map((row) => row.unit);
    setUnit(nextUnits.length === 1 ? nextUnits[0] : "");
    setFilterSubcategory(id);
    setFilterType("");
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

  const addCatalog = async () => {
    const name = draftName.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Enter a name.");
      return;
    }
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
    if (!siteName) {
      setError("No site is assigned to this login.");
      return;
    }
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
      site_name: siteName,
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

  const downloadExcel = async () => {
    const headers = ["Date", "Site", "Category", "Subcategory", "Type", "Quantity", "Unit", "Bill photo", "Recorded by"];
    const rows = filteredRecords.map((row) => [
      row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "",
      row.site_name || "",
      row.category_name || "",
      row.subcategory_name || "",
      row.type_name || "",
      row.quantity ?? "",
      row.unit || "",
      billExcelValue(row.bill_url),
      row.recorded_by || "",
    ]);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Arrived material");
    sheet.columns = [
      { width: 22 }, { width: 22 }, { width: 16 }, { width: 16 },
      { width: 14 }, { width: 12 }, { width: 12 }, { width: 42 }, { width: 20 },
    ];
    const header = sheet.addRow(headers);
    header.height = 22;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { vertical: "middle" };
    });
    rows.forEach((values, index) => {
      const added = sheet.addRow(values);
      if (index % 2 === 1) {
        added.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
        });
      }
      paintBillLinks(added, 8);
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await book.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `arrived-material${siteName ? `-${siteName.replace(/\s+/g, "-")}` : ""}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const category = catalog.categories.find((row) => row.id === categoryId);
  const subcategory = catalog.subcategories.find((row) => row.id === subcategoryId);
  const type = catalog.types.find((row) => row.id === typeId);

  return (
    <div className="am-page">
      <div className="am-top">
        <p className="am-lead">Record material received on site. Pick a category, then the cards under it.</p>
        {sites.length > 1 ? (
          <label className="am-site">
            Site
            <select value={siteName} onChange={(event) => setSiteName(event.target.value)}>
              {sortedSites.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="am-site-name">{siteName || "No site assigned"}</div>
        )}
      </div>

      {error && !adding && <div className="am-error">{error}</div>}

      <section className="am-block">
        <div className="am-block-head">
          <h3>Add arrival</h3>
          {(category || subcategory || type) && (
            <div className="am-path">
              {category?.name}
              {subcategory ? ` / ${subcategory.name}` : ""}
              {type ? ` / ${type.name}` : ""}
            </div>
          )}
        </div>

        <div className="am-cat-head">
          <div className="am-label">Category</div>
          <CategorySearch categories={sortedCategories} categoryId={categoryId} onPick={pickCategory} />
        </div>
        <div className="am-cats">
          <button type="button" className="am-cat am-other" onClick={() => openAdd("category")}>
            + Other
          </button>
          {sortedCategories.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`am-cat${categoryId === row.id ? " is-on" : ""}`}
              style={categoryStyle(row.name, categoryId === row.id)}
              onClick={() => pickCategory(row.id)}
            >
              <span className="am-cat-name">{row.name}</span>
            </button>
          ))}
        </div>
        <p className="am-honey-hint">Drag the cards. The one in the center grows.</p>
        <CategoryHoneycomb
          categories={sortedCategories}
          categoryId={categoryId}
          onPick={pickCategory}
          onAdd={() => openAdd("category")}
        />

        {categoryId && (
          <>
            <div className="am-label">Subcategory</div>
            <div className="am-subs">
              {subcategories.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`am-sub${subcategoryId === row.id ? " is-on" : ""}`}
                  onClick={() => pickSubcategory(row.id)}
                >
                  {row.name}
                </button>
              ))}
              <button type="button" className="am-sub am-other" onClick={() => openAdd("subcategory")}>
                + Other
              </button>
            </div>
          </>
        )}

        {subcategoryId && (
          <>
            <div className="am-label">Type</div>
            <div className="am-types">
              {types.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`am-type${typeId === row.id ? " is-on" : ""}`}
                  onClick={() => {
                    setTypeId(row.id);
                    setFilterType(row.id);
                  }}
                >
                  {row.name}
                </button>
              ))}
              <button type="button" className="am-type am-other" onClick={() => openAdd("type")}>
                + Other
              </button>
            </div>
          </>
        )}

        {typeId && (
          <div className="am-qty-row">
            <label className="am-qty">
              Quantity
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                placeholder="0"
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <div className="am-units">
              <div className="am-label">Unit</div>
              <div className="am-types">
                {units.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`am-type${unit === item ? " is-on" : ""}`}
                    onClick={() => setUnit(item)}
                  >
                    {item}
                  </button>
                ))}
                <button type="button" className="am-type am-other" onClick={() => openAdd("unit")}>
                  + Other
                </button>
              </div>
            </div>
            <button type="button" className="am-save" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
            <label className="am-bill">
              Bill photo
              <span>Optional</span>
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
              {billPreview && <img src={billPreview} alt="Selected bill" />}
            </label>
          </div>
        )}
      </section>

      <section className="am-block">
        <div className="am-block-head">
          <h3>History</h3>
          <button type="button" className="am-excel" onClick={downloadExcel} disabled={!filteredRecords.length}>
            Download Excel
          </button>
        </div>
        <div className="am-filters">
          <input
            value={search}
            placeholder="Search category, type, unit"
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={filterCategory}
            aria-label="Filter category"
            onChange={(event) => pickCategory(event.target.value)}
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
              const id = event.target.value;
              if (!id) {
                setSubcategoryId("");
                setTypeId("");
                setQuantity("");
                setUnit("");
                setFilterSubcategory("");
                setFilterType("");
                return;
              }
              pickSubcategory(id);
            }}
          >
            <option value="">All subcategories</option>
            {sortedFilterSubcategories.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <select
            value={filterType}
            aria-label="Filter type"
            onChange={(event) => {
              setTypeId(event.target.value);
              setFilterType(event.target.value);
            }}
          >
            <option value="">All types</option>
            {sortedFilterTypes.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </div>
        <div className="am-table-wrap">
          <table className="am-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Bill</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((row) => (
                <tr key={row.id}>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>{row.site_name || "—"}</td>
                  <td>{row.category_name}</td>
                  <td>{row.subcategory_name}</td>
                  <td>{row.type_name}</td>
                  <td>{row.quantity}</td>
                  <td>{row.unit}</td>
                  <td><BillActions url={row.bill_url} /></td>
                  <td>{row.recorded_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="am-empty">Loading…</div>}
          {!loading && !filteredRecords.length && <div className="am-empty">No arrived material for this site yet.</div>}
        </div>
      </section>

      {toast && <div className="am-toast" role="status">{toast}</div>}
      {adding && (
        <div className="am-pop" role="dialog" aria-label={`Add ${adding}`}>
          <div className="am-pop-card">
            <div className="am-pop-head">
              <strong>Add {adding}</strong>
              <button type="button" onClick={closeAdd}>Close</button>
            </div>
            <input
              value={draftName}
              placeholder={`New ${adding}`}
              autoFocus
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addCatalog();
              }}
            />
            {error && <div className="am-error">{error}</div>}
            <button type="button" className="am-save" disabled={catalogSaving} onClick={addCatalog}>
              {catalogSaving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
