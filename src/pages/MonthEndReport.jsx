import { useState, useEffect, useCallback } from "react";
import { curatePhotos, buildPhotoThumbnails } from "./monthEndPhotoCuration";
import { generateMonthEndDocx } from "./monthEndDocxGenerator";
import "./MonthEndReport.css";
function bucketNameFor(site) {
  return (site || "site").toString().trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63) || "site";
}

function officeViewerUrl(url) {
  if (!url) return url;
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
}
async function ensureBucket(supabase, site) {
  const { data, error } = await supabase.functions.invoke("ensure-bucket", { body: { site } });
  if (error) throw new Error(error.context?.error || error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

async function uploadBlob(supabase, bucketName, blob, path, contentType) {
  const { error } = await supabase.storage.from(bucketName).upload(path, blob, {
    contentType,
    upsert: true,
    cacheControl: "0",
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
  return urlData.publicUrl;
}

function downloadDocxBlob(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "MonthEnd_Report.docx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

async function downloadDocxFromUrl(url, filename) {
  try {
    const freshUrl = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
    const res = await fetch(freshUrl, { cache: "no-store" });
    const blob = await res.blob();
    downloadDocxBlob(blob, filename);
  } catch (err) {
    console.error("Direct download failed, opening URL:", err);
    window.open(url, "_blank");
  }
}

// Works for ANY site: finds whatever image file actually sits in the
// SiteImg folder of that site's bucket, regardless of exact filename.
async function findSiteTitleImageUrl(supabase, bucketName) {
  console.log("[SiteImg] Looking up cover image in bucket:", bucketName);
  try {
    const { data: files, error: listErr } = await supabase.storage.from(bucketName).list("SiteImg", { limit: 20 });
    if (listErr) {
      console.warn("[SiteImg] list() failed:", listErr.message);
      return null;
    }
    console.log("[SiteImg] Files found in SiteImg folder:", files?.map((f) => f.name));
    const imageFile = (files || []).find((f) => /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!imageFile) {
      console.warn("[SiteImg] No image file matched in folder listing for bucket:", bucketName);
      return null;
    }
    const { data } = supabase.storage.from(bucketName).getPublicUrl(`SiteImg/${imageFile.name}`);
    console.log("[SiteImg] Resolved public URL:", data?.publicUrl);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn("[SiteImg] Unexpected error:", e.message);
    return null;
  }
}

function monthKeyOf(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabelOf(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function asArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v) return [v];
  return [];
}

const PHOTO_TYPE_LABELS = {
  site_photo: "Site Photo",
  site_photos: "Site Photo",
  graphical: "Graphical Report",
  checklist: "Weekly Checklist",
  cube_testing: "Cube Testing",
  barchart: "Barchart & Worksheet",
  mom_review: "MOM Review",
  visitor_register: "Visitor Register Photo",
};

export default function MonthEndReport({ user, supabase }) {
  const [site, setSite] = useState(user?.site_names?.[0] || user?.site_name || "");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [jobNo, setJobNo] = useState("");
  const [existing, setExisting] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const sites = user?.site_names?.length ? user.site_names : (user?.site_name ? [user.site_name] : []);

  const checkExisting = useCallback(async () => {
    if (!site || !month) return;
    const { data } = await supabase.from("month_end_reports").select("*")
      .eq("site_name", site).eq("month", month).maybeSingle();
    setExisting(data || null);
  }, [site, month, supabase]);

  useEffect(() => { checkExisting(); }, [checkExisting]);

  useEffect(() => {
    if (!site) return;
    setJobNo("");
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("site_details").select("job_no").eq("site_name", site).maybeSingle();
      if (!cancelled && data?.job_no) setJobNo(data.job_no);
    })();
    return () => { cancelled = true; };
  }, [site, supabase]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    setResult(null);
    setProgress(5);
    setStep("Fetching this month's weekly reports and material receipts…");
  
    try {
      const [selectedYear, selectedMonth] = month.split("-").map(Number);
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const nextMonthStart = new Date(selectedYear, selectedMonth, 1).toISOString();
      const [wprResult, materialResult] = await Promise.all([
        supabase.from("wpr_reports").select("*").ilike("site_name", site).order("created_at", { ascending: true }),
        supabase.from("site_material_arrivals")
          .select("created_at, category_name, subcategory_name, type_name, quantity, unit, recorded_by, user_name, bill_url")
          .ilike("site_name", site)
          .gte("created_at", monthStart)
          .lt("created_at", nextMonthStart)
          .order("created_at", { ascending: true }),
      ]);
      const { data: allWprs, error: wprErr } = wprResult;
      if (wprErr) throw wprErr;
      const { data: materialRows, error: materialErr } = materialResult;
      if (materialErr) throw materialErr;

      const wprs = (allWprs || [])
        .filter((r) => monthKeyOf(r.report_date || r.created_at) === month)
        .sort((a, b) => new Date(a.report_date || a.created_at || 0) - new Date(b.report_date || b.created_at || 0));
      const materialReceipts = materialRows || [];

      if (!wprs.length && !materialReceipts.length) {
        setError("No weekly reports or material receipts found for this site and month.");
        setGenerating(false);
        return;
      }

      const reportLabel = (r) => `Report #${r.report_number ?? "?"}`;
      const dateOf = (r) => fmtDate(r.report_date || r.created_at);
      
      const activityLog = [];
      const officeActivity = [];
      const visitorRegister = [];
      const delayPoints = [];
      const drawingDecisionMap = new Map();
      const drawingRows = [];
      let drawingHeaders = [];

      wprs.forEach((r) => {
        const label = reportLabel(r);
        const date = dateOf(r);

        asArray(r.activities).forEach((a) => {
          activityLog.push({ reportLabel: label, date, name: a.name || "", status: a.status || "" });
        });
        asArray(r.office_activity_items).forEach((item) => {
          officeActivity.push({ reportLabel: label, date, item });
        });
        asArray(r.visitor_register_data).forEach((v) => {
          visitorRegister.push({ reportLabel: label, date, type: v.type || "", name: v.name || "", instruction: v.instruction || "" });
        });
        asArray(r.delay_points).forEach((point) => {
          delayPoints.push({ reportLabel: label, date, point });
        });
        asArray(r.drawing_decision_data).forEach((d) => {
          const key = `${d.drawingName || ""}__${d.requiredDate || ""}`;
          if (!drawingDecisionMap.has(key)) {
            drawingDecisionMap.set(key, { name: d.drawingName || "", requiredDate: d.requiredDate || "", firstReported: date });
          }
        });
        if (Array.isArray(r.drawing_register_headers) && r.drawing_register_headers.length) {
          drawingHeaders = r.drawing_register_headers;
        }
        asArray(r.drawing_register_data).forEach((row) => {
          const cols = (drawingHeaders.length ? drawingHeaders : Object.keys(row)).map((_, i) => row[`col${i}`] ?? "");
          drawingRows.push([label, ...cols]);
        });
      });

      const dedupeByText = (arr, key) => {
        const seen = new Set();
        return arr.filter((x) => {
          const k = x[key];
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      };
      const dedupedOffice = dedupeByText(officeActivity, "item");
      const dedupedDelays = dedupeByText(delayPoints, "point");
      const drawingDecisionPending = [...drawingDecisionMap.values()];

      const lastWpr = wprs[wprs.length - 1];
      const nextWeekPlan = lastWpr ? {
        source: `${reportLabel(lastWpr)} — ${dateOf(lastWpr)}`,
        plans: asArray(lastWpr.next_week_plans),
      } : { source: "", plans: [] };

      setProgress(15);
      setStep("Looking up site cover image…");
      const bucketName = bucketNameFor(site);
      const siteTitleImageUrl = await findSiteTitleImageUrl(supabase, bucketName);

      setProgress(25);
      setStep(`Found ${wprs.length} weekly report(s) — fetching photos…`);

      const wprIds = wprs.map((w) => w.id);
      let imgRows = [];
      if (wprIds.length) {
        const { data } = await supabase
          .from("wpr_images")
          .select("wpr_report_id, image_type, public_url, caption, created_at")
          .in("wpr_report_id", wprIds);
        imgRows = data || [];
      }

      const allPhotos = imgRows
        .filter((row) => row.image_type !== "site_image")
        .flatMap((row) => {
          const urls = Array.isArray(row.public_url) ? row.public_url : [row.public_url].filter(Boolean);
          const captions = Array.isArray(row.caption) ? row.caption : [row.caption].filter(Boolean);
          return urls.map((url, i) => ({
            url,
            caption: captions[i] || "",
            date: row.created_at,
            type: PHOTO_TYPE_LABELS[row.image_type] || row.image_type,
          }));
        });
      const photoCounts = {};
      allPhotos.forEach((p) => { photoCounts[p.type] = (photoCounts[p.type] || 0) + 1; });

      setProgress(35);
      const candidates = curatePhotos(allPhotos, 40);

      let finalPhotos = [];
      if (candidates.length) {
        setStep(`Preparing ${candidates.length} photo(s) for AI review…`);
        const thumbs = await buildPhotoThumbnails(candidates, (done, total) => {
          setProgress(35 + Math.round((done / total) * 15));
          setStep(`Preparing photos for AI review… (${done}/${total})`);
        });
        setStep("AI selecting the best 10 photos…");
        const { data: photoAiData, error: photoAiErr } = await supabase.functions.invoke(
          "select-month-end-photos",
          { body: { photos: thumbs, targetCount: 10 } },
        );
        let selectedIndices = [];
        if (!photoAiErr && !photoAiData?.error) {
          selectedIndices = photoAiData?.selected_indices || [];
        } else {
          console.warn("Photo AI selection failed, falling back to first 10:", photoAiErr || photoAiData?.error);
        }
        if (!selectedIndices.length) {
          selectedIndices = candidates.slice(0, 10).map((_, i) => i);
        }

        const selected = selectedIndices.map((i) => candidates[i]).filter(Boolean);

        // Every category that exists this month is compulsory — top up with one
        // photo from any category the AI's picks happened to skip entirely.
        const coveredTypes = new Set(selected.map((p) => p.type));
        const missingCategoryPhotos = [];
        for (const cat of new Set(candidates.map((c) => c.type))) {
          if (!coveredTypes.has(cat)) {
            const fallback = candidates.find((c) => c.type === cat);
            if (fallback) {
              missingCategoryPhotos.push(fallback);
              coveredTypes.add(cat);
            }
          }
        }
        finalPhotos = [...selected, ...missingCategoryPhotos];
      }

      setProgress(55);
      setStep("Summarizing month with AI…");

      const reportsPayload = wprs.map((r) => ({
        report_number: r.report_number || "",
        date: r.report_date || r.created_at || "",
        engineer: r.engineer_name || "",
        location: r.location || "",
        activities: asArray(r.activities),
        next_week_plans: asArray(r.next_week_plans),
        drawing_register_headers: asArray(r.drawing_register_headers),
        drawing_register_data: asArray(r.drawing_register_data),
        office_activity_items: asArray(r.office_activity_items),
        visitor_register_data: asArray(r.visitor_register_data),
        drawing_decision_data: asArray(r.drawing_decision_data),
        delay_points: asArray(r.delay_points),
        report_sections: asArray(r.report_sections).map((section) => ({
          title: section.title || "",
          text_items: asArray(section.textItems),
        })),
      }));
      const materialTotalsMap = new Map();
      materialReceipts.forEach((row) => {
        const key = [row.category_name, row.subcategory_name, row.type_name, row.unit].join("|");
        const item = materialTotalsMap.get(key) || {
          category: row.category_name,
          subcategory: row.subcategory_name,
          type: row.type_name,
          unit: row.unit,
          quantity: 0,
        };
        item.quantity += Number(row.quantity) || 0;
        materialTotalsMap.set(key, item);
      });
      const materialTotals = [...materialTotalsMap.values()];

      const { data: aiData, error: aiErr } = await supabase.functions.invoke(
        "generate-month-end-summary",
        { body: {
          site,
          month: monthLabelOf(month),
          reports: reportsPayload,
          materials: materialTotals,
          materialReceiptCount: materialReceipts.length,
        } },
      );
      if (aiErr) {
        let detail = aiErr.message;
        try {
          const body = await aiErr.context?.json();
          if (body?.error) detail = body.error;
        } catch {
          // context wasn't JSON, fall back to generic message
        }
        throw new Error(detail || "AI summarization failed");
      }
      if (aiData?.error) throw new Error(aiData.error);
      const summary = aiData.summary;

      setProgress(75);
      setStep("Building Word document…");

      const blob = await generateMonthEndDocx({
        site,
        monthLabel: monthLabelOf(month),
        jobNo,
        summary,
        photos: finalPhotos,
        activityLog,
        nextWeekPlan,
        drawingRegister: { headers: drawingHeaders, rows: drawingRows },
        officeActivity: dedupedOffice,
        visitorRegister,
        drawingDecisionPending,
        delayPoints: dedupedDelays,
        photoCounts,
        materials: materialReceipts.map((row) => ({
          date: fmtDate(row.created_at),
          category: row.category_name || "",
          subcategory: row.subcategory_name || "",
          type: row.type_name || "",
          quantity: row.quantity,
          unit: row.unit || "",
          recordedBy: row.recorded_by || row.user_name || "",
          billAttached: Boolean(row.bill_url),
        })),
        siteTitleImageUrl,
      });

      setProgress(88);
      setStep("Uploading…");

      await ensureBucket(supabase, site);
      const safeSite = site.replace(/\s+/g, "_");
      const timestamp = Date.now();
      const filename = `MonthEnd_${safeSite}_${month}.docx`;
      const path = `month_end_reports/${month}/MonthEnd_${safeSite}_${month}_${timestamp}.docx`;
      const url = await uploadBlob(
        supabase, bucketName, blob, path,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      // Clean up previous report file from storage if overwriting an existing report
      if (existing?.document_url) {
        try {
          const oldUrl = existing.document_url.split("?")[0];
          const marker = `/${bucketName}/`;
          const idx = oldUrl.indexOf(marker);
          if (idx !== -1) {
            const oldPath = decodeURIComponent(oldUrl.slice(idx + marker.length));
            if (oldPath && oldPath !== path) {
              await supabase.storage.from(bucketName).remove([oldPath]);
            }
          }
        } catch (e) {
          console.warn("Could not clean up previous report file:", e);
        }
      }

      setProgress(95);
      setStep("Saving record…");

      await supabase.from("month_end_reports").upsert(
        {
          site_name: site, month, job_no: jobNo,
          wpr_count: wprs.length, photo_count: finalPhotos.length,
          document_url: url, summary_json: summary,
          generated_by: user?.name || user?.user_name,
        },
        { onConflict: "site_name,month" },
      );

      setProgress(100);
      setStep("Done!");
      setResult({ url, blob, filename, wprCount: wprs.length, materialCount: materialReceipts.length, photoCount: finalPhotos.length });
      checkExisting();
    } catch (err) {
      setError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="wpr-g2" style={{ marginBottom: 16 }}>
        <div className="wpr-fg">
          <label className="wpr-lbl">Site</label>
          {sites.length > 1 ? (
            <select className="finput" value={site} onChange={(e) => setSite(e.target.value)}>
              {sites.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <input className="finput" value={site} onChange={(e) => setSite(e.target.value)} />
          )}
        </div>
        <div className="wpr-fg">
          <label className="wpr-lbl">Month</label>
          <input className="finput" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      {existing && !result && (
        <div className="mer-existing-banner">
          <div className="mer-existing-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="mer-existing-body">
            <div className="mer-existing-text">
              A month-end report for <strong>{monthLabelOf(month)}</strong> already exists
              ({existing.wpr_count} WPRs, {existing.photo_count} photos).
            </div>
            <div className="mer-existing-note">
              Generating again will create a fresh report and overwrite the existing one.
            </div>
          </div>
          <button
            type="button"
            className="mer-download-btn"
            onClick={() => downloadDocxFromUrl(existing.document_url, `MonthEnd_${(site || "Site").replace(/\s+/g, "_")}_${month}.docx`)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      )}

      {error && (
        <div className="wpr-hint" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button className="btn btn-pri" onClick={generate} disabled={generating || !site}>
        {generating ? step || "Generating…" : "Generate Month-End Report"}
      </button>

      {generating && (
        <div className="wpr-progress-bar" style={{ marginTop: 14 }}>
          <div className="wpr-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {result && (
        <div className="wpr-result-row" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
         <div className="wpr-hint" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#16a34a", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Report generated — {result.wprCount} WPRs, {result.materialCount} material receipts, and {result.photoCount} AI-selected photos included.
        </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {result.blob && (
              <button
                type="button"
                className="btn btn-success"
                style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => downloadDocxBlob(result.blob, result.filename)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Word Document (.docx)
              </button>
            )}
            <a
             
              className="btn btn-sec"
              style={{ margin: 0, padding: "8px 16px", textDecoration: "none", fontSize: "13.5px", fontWeight: 700, borderRadius: 8, background: "#e2e8f0", color: "#1e293b", display: "inline-flex", alignItems: "center" }}
              href={officeViewerUrl(result.url.includes("?") ? `${result.url}&t=${Date.now()}` : `${result.url}?t=${Date.now()}`)}
              target="_blank"
              rel="noreferrer"
            >
              Open Online
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
