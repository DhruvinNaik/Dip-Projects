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
  return { text: url, hyperlink: url };
}

export function paintBillLinks(row, columnNumber) {
  const cell = row.getCell(columnNumber);
  if (cell.value && typeof cell.value === "object" && cell.value.hyperlink) {
    cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
  }
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
