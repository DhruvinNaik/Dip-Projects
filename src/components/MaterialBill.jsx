import { supabase } from "../supabase";
import "./MaterialBill.css";

const BUCKET = "documents";

export async function uploadMaterialBill(file, siteName) {
  const safeSite = String(siteName || "site").replace(/[^\w.-]+/g, "-").slice(0, 48) || "site";
  const ext = String(file.name || "").split(".").pop()?.toLowerCase().replace(/[^\w]/g, "") || "jpg";
  const path = `material-bills/${safeSite}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Could not upload the bill photo.");
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("The bill photo uploaded, but its link could not be created.");
  return data.publicUrl;
}

export function billExcelValue(url) {
  if (!url) return "";
  return { text: "📄 Open bill", hyperlink: url };
}

export function paintBillLinks(row, columnNumber) {
  const cell = row.getCell(columnNumber);
  if (cell.value && typeof cell.value === "object" && cell.value.hyperlink) {
    cell.font = { color: { argb: "FF047857" }, underline: true, bold: true };
  }
}

function sheetName(label, used) {
  const clean = String(label || "Other")
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Other";
  let name = clean;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = `${clean.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function arrivalExcelRow(row) {
  return [
    row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "",
    row.site_name || "",
    row.category_name || "",
    row.subcategory_name || "",
    row.type_name || "",
    row.quantity ?? "",
    row.unit || "",
    billExcelValue(row.bill_url),
    row.recorded_by || "",
  ];
}

function fillSheet(book, title, rows) {
  const sheet = book.addWorksheet(title);
  sheet.columns = [
    { width: 22 }, { width: 22 }, { width: 16 }, { width: 16 },
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 20 },
  ];
  const header = sheet.addRow(["Date", "Site", "Category", "Subcategory", "Type", "Quantity", "Unit", "Bill photo", "Recorded by"]);
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
}

export function fillArrivedMaterialBook(book, records) {
  const groups = new Map();
  (records || []).forEach((row) => {
    const key = String(row.subcategory_name || "Other").trim() || "Other";
    const label = key;
    const existing = [...groups.keys()].find((name) => name.toLowerCase() === label.toLowerCase());
    const name = existing || label;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  });
  if (groups.size <= 1) {
    fillSheet(book, "Arrived material", (records || []).map(arrivalExcelRow));
    return;
  }
  const used = new Set();
  [...groups.keys()]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .forEach((name) => {
      fillSheet(book, sheetName(name, used), groups.get(name).map(arrivalExcelRow));
    });
}

function fileNameFromUrl(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return last || "bill.jpg";
  } catch {
    return "bill.jpg";
  }
}

export async function downloadBill(url) {
  const name = fileNameFromUrl(url);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch {
    const link = document.createElement("a");
    const join = url.includes("?") ? "&" : "?";
    link.href = `${url}${join}download=${encodeURIComponent(name)}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }
}

export function BillActions({ url }) {
  if (!url) return "—";
  return (
    <span className="bill-actions">
      <a href={url} target="_blank" rel="noopener noreferrer" title="View bill" aria-label="View bill">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </a>
      <button type="button" title="Download bill" aria-label="Download bill" onClick={() => downloadBill(url)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </span>
  );
}
