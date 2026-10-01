// import { title } from "node:process";

// Dynamic docx loader ensuring window.docx or CDN UMD bundle is ready
let docxPromise = null;

export async function loadDocx() {
  if (typeof window !== "undefined" && window.docx && typeof window.docx.Paragraph === "function") {
    return window.docx;
  }
  if (docxPromise) return docxPromise;

  docxPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("docx library can only be loaded in a browser environment"));
    }

    if (window.docx && typeof window.docx.Paragraph === "function") {
      return resolve(window.docx);
    }

    const loadCdn = () => {
      const cdnScript = document.createElement("script");
      cdnScript.src = "https://cdn.jsdelivr.net/npm/docx@8.1.0/build/index.umd.js";
      cdnScript.onload = () => {
        if (window.docx && typeof window.docx.Paragraph === "function") {
          resolve(window.docx);
        } else {
          reject(new Error("docx library loaded but window.docx.Paragraph is not a function"));
        }
      };
      cdnScript.onerror = (e) => reject(new Error("Failed to load docx from CDN: " + (e?.message || "network error")));
      document.head.appendChild(cdnScript);
    };

    const localScript = document.createElement("script");
    localScript.src = (process.env.PUBLIC_URL || "") + "/docx.umd.js";
    localScript.onload = () => {
      if (window.docx && typeof window.docx.Paragraph === "function") {
        resolve(window.docx);
      } else {
        loadCdn();
      }
    };
    localScript.onerror = () => {
      loadCdn();
    };
    document.head.appendChild(localScript);
  });

  return docxPromise;
}

function imageTypeFromContentType(contentType) {
  if (!contentType) return null;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("bmp")) return "bmp";
  return null;
}

function typeFromExtension(url) {
  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "gif") return "gif";
  if (ext === "bmp") return "bmp";
  return null;
}

async function fetchImageBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const contentType = res.headers.get("content-type") || "";
  const type = imageTypeFromContentType(contentType) || typeFromExtension(url);
  if (!type) throw new Error(`Not a supported image type: ${contentType || "unknown"}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new Error("Image data too small — likely an error response");
  const data = new Uint8Array(buf);
  const blob = new Blob([data], { type: `image/${type === "jpg" ? "jpeg" : type}` });
  const bitmap = await createImageBitmap(blob);
  return { data, type, width: bitmap.width, height: bitmap.height };
}

function scaledSize(img, targetWidth) {
  const ratio = img.height / img.width;
  return { width: targetWidth, height: Math.round(targetWidth * ratio) };
}
function scaledSizeFit(img, maxWidth, maxHeight) {
  const widthRatio = maxWidth / img.width;
  const heightRatio = maxHeight / img.height;
  const scale = Math.min(widthRatio, heightRatio, 1);
  return {
    width: Math.round(img.width * scale),
    height: Math.round(img.height * scale),
  };
}

export function stripReportColumn(headers = [], rows = []) {
  const cleanedHeaders = (headers || []).filter((h) => !/^Report\b/i.test(String(h ?? "")));
  const cleanedRows = (rows || []).map((row) => {
    if (!Array.isArray(row)) return row;
    const next = [...row];
    if (next.length && /^Report\b/i.test(String(next[0] ?? ""))) next.shift();
    return next;
  });
  return { headers: cleanedHeaders.length ? cleanedHeaders : headers, rows: cleanedRows };
}

export async function generateMonthEndDocx({
  site, monthLabel, jobNo, summary,
  photos, activityLog, nextWeekPlan, drawingRegister,
  officeActivity, visitorRegister, drawingDecisionPending, delayPoints, photoCounts,
  materials = [],
  siteTitleImageUrl,
  logoUrl = "/dip-logo.png",
}) {
  console.log("DOCX GEN VERSION:", new Date().toISOString());

  // 1. Ensure docx classes are loaded
  const docx = await loadDocx();
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel = { HEADING_1: "Heading1", HEADING_2: "Heading2" },
    ImageRun,
    AlignmentType = { CENTER: "center", LEFT: "left", RIGHT: "right", JUSTIFIED: "both" },
    Table,
    TableRow,
    TableCell,
    WidthType = { PERCENTAGE: "pct", DXA: "dxa", AUTO: "auto" },
    TextRun,
    Header,
    VerticalAlign = { CENTER: "center", TOP: "top", BOTTOM: "bottom" },
    SectionType = { NEXT_PAGE: "nextPage", CONTINUOUS: "continuous" },
    TableOfContents,
    Footer,
    PageNumber = { CURRENT: "PAGE", TOTAL_PAGES: "NUMPAGES" },
    BorderStyle = { SINGLE: "single", NONE: "none" },
  } = docx;

  const cellBorder = { style: BorderStyle?.SINGLE || "single", size: 2, color: "CCCCCC" };
  const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const noBorders = {
    top: { style: BorderStyle?.NONE || "none" }, bottom: { style: BorderStyle?.NONE || "none" },
    left: { style: BorderStyle?.NONE || "none" }, right: { style: BorderStyle?.NONE || "none" },
  };

  function bulletList(items) {
    return (items || []).map(
      (t) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 80 } }),
    );
  }

  function headerCell(text, width) {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
      shading: { fill: "1E3A5F" },
      borders: allBorders,
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    });
  }

  function bodyCell(text, width) {
    return new TableCell({
      children: [new Paragraph({ text: text ?? "" })],
      borders: allBorders,
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    });
  }

  function tableCaption(number, description) {
    return new Paragraph({
      children: [new TextRun({ text: `Table ${String(number).padStart(2, "0")}: ${description}`, bold: true, size: 18 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 180 },
    });
  }

  function makeNumberedTable(headers, rows, description, number) {
    if (!rows?.length) return null;
    const srWidth = 8;
    const restWidth = (100 - srWidth) / headers.length;
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [headerCell("Sr. No.", srWidth), ...headers.map((h) => headerCell(h, restWidth))],
        }),
        ...rows.map((r, i) => new TableRow({
          cantSplit: true,
          children: [bodyCell(String(i + 1), srWidth), ...r.map((c) => bodyCell(String(c ?? ""), restWidth))],
        })),
      ],
    });
    return [table, tableCaption(number, description)];
  }
     
  function sectionHeading(children, title) {
    children.push(new Paragraph({
      children: [new TextRun({ text: title, bold: true, underline: {} })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 },
      keepNext: true,
      pageBreakBefore: /^(1\.|8\.)/.test(title),
    }));
  }
  
  function spacer(children) {
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  function pushSection(children, title, contentNodes) {
    if (!contentNodes || (Array.isArray(contentNodes) && contentNodes.length === 0)) return;
    sectionHeading(children, title);
    children.push(...(Array.isArray(contentNodes) ? contentNodes.flat() : [contentNodes]));
    spacer(children);
  }

  function coloredBadge(text, width = 100) {
    return new Table({
      width: { size: width, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: { ...noBorders, insideHorizontal: { style: BorderStyle?.NONE || "none" }, insideVertical: { style: BorderStyle?.NONE || "none" } },
      rows: [new TableRow({
        children: [new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: noBorders,
          shading: { fill: "B5642A" },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
          })],
        })],
      })],
    });
  }

  function photoCell(img, caption, cellWidthPct, maxW, maxH) {
    return new TableCell({
      width: { size: cellWidthPct, type: WidthType.PERCENTAGE },
      borders: noBorders,
      children: [
        new Paragraph({
          children: [new ImageRun({ data: img.data, type: img.type, transformation: scaledSizeFit(img, maxW, maxH) })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        }),
      ],
    });
  }

  function photoGrid(photosWithImg, columns, maxW, maxH) {
    const rows = [];
    for (let i = 0; i < photosWithImg.length; i += columns) {
      const rowItems = photosWithImg.slice(i, i + columns);
      const cells = rowItems.map(({ img, caption }) => photoCell(img, caption, 100 / columns, maxW, maxH));
      while (cells.length < columns) {
        cells.push(new TableCell({ width: { size: 100 / columns, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ text: "" })] }));
      }
      rows.push(new TableRow({ cantSplit: true, children: cells }));
    }
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...noBorders, insideHorizontal: { style: BorderStyle?.NONE || "none" }, insideVertical: { style: BorderStyle?.NONE || "none" } },
      rows,
    });
  }

  let logo = null;
  try { logo = await fetchImageBytes(logoUrl); } catch (e) { console.warn("Could not load logo:", e.message); }

  let siteImage = null;
  if (siteTitleImageUrl) {
    try { siteImage = await fetchImageBytes(siteTitleImageUrl); } catch (e) { console.warn("Could not load site cover image:", e.message); }
  }

  const emptyHeader = new Header({ children: [new Paragraph({ text: "" })] });
  const runningHeader = logo
    ? new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new ImageRun({ data: logo.data, type: logo.type, transformation: scaledSize(logo, 90) })],
      })],
    })
    : emptyHeader;

  const pageNumberFooter = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT] })],
    })],
  });

  // ── SECTION 1: COVER ──
  const coverChildren = [];
  if (logo) {
    coverChildren.push(new Paragraph({
      children: [new ImageRun({ data: logo.data, type: logo.type, transformation: scaledSize(logo, 220) })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }
  const [monthWord, yearWord] = (monthLabel || "").split(" ");
  coverChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `${(monthWord || "MONTH").toUpperCase()} REPORT ${yearWord || ""}`.trim(), bold: true, size: 44 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: site, bold: true, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: monthLabel, size: 18 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
    }),
  );
  if (siteImage) {
    coverChildren.push(new Paragraph({
      children: [new ImageRun({ data: siteImage.data, type: siteImage.type, transformation: scaledSizeFit(siteImage, 440, 320) })],
      alignment: AlignmentType.CENTER,
    }));
  }

  // ── SECTION 2: BODY ──
  const bodyChildren = [];
  let tableNumber = 0;
  const reportTable = (headers, rows, description) => {
    if (!rows?.length) return null;
    tableNumber += 1;
    return makeNumberedTable(headers, rows, description, tableNumber);
  };
  bodyChildren.push(new Paragraph({
    children: [new TextRun({ text: "INDEX", bold: true, size: 32, color: "1E3A5F", underline: {} })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));
  bodyChildren.push(new TableOfContents("Index", { hyperlink: true, headingStyleRange: "1-2" }));
  bodyChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));

  const hasSummaryText = !!(summary?.executive_summary && summary.executive_summary.trim());
  const hasHighlights = !!(summary?.activity_highlights?.length);
  if (hasSummaryText || hasHighlights) {
    const summaryNodes = [];
    if (hasSummaryText) summaryNodes.push(new Paragraph({ text: summary.executive_summary, spacing: { after: 200 } }));
    if (hasHighlights) {
      summaryNodes.push(new Paragraph({ children: [new TextRun({ text: "Highlights", bold: true })], spacing: { before: 100, after: 60 } }));
      summaryNodes.push(...bulletList(summary.activity_highlights));
    }
    pushSection(bodyChildren, "Work Summary", summaryNodes);
  }

  pushSection(
    bodyChildren, "1. Current Status of Activities",
    reportTable(["Date", "Activity", "Status / Note"], (activityLog || []).map((a) => [a.date, a.name, a.status]), "Current status of activities"),
  );

  if (nextWeekPlan?.plans?.length) {
    const planNodes = [];
    if (nextWeekPlan.source) {
      planNodes.push(new Paragraph({
        spacing: { after: 100 },
      }));
    }
    planNodes.push(...bulletList(nextWeekPlan.plans));
    pushSection(bodyChildren, "2. Next Month Planning", planNodes);
  }

  pushSection(bodyChildren, "3. Office Activity", reportTable(["Date", "Detail"], (officeActivity || []).map((o) => [o.date, o.item]), "Office activity details"));

  const drawingData = stripReportColumn(drawingRegister?.headers || [], drawingRegister?.rows || []);
  pushSection(bodyChildren, "4. Drawing Register", reportTable(drawingData.headers, drawingData.rows, "Drawing register"));

  if (visitorRegister?.length) {
    const visNodes = [reportTable(
      ["Date", "Visitor Type", "Name / Company", "Notes"],
      visitorRegister.map((v) => [v.date, v.type, v.name, v.instruction]),
      "Visitors list",
    )];
    if (summary?.visitor_summary) visNodes.push(new Paragraph({ text: summary.visitor_summary, spacing: { before: 120 } }));
    pushSection(bodyChildren, "5. Visitors List", visNodes);
  }

  pushSection(
    bodyChildren, "6. Drawing & Decision Pending",
    reportTable(["Drawing / Decision Name", "Required Date", "First Reported"], (drawingDecisionPending || []).map((d) => [d.name, d.requiredDate, d.firstReported]), "Pending drawings and decisions"),
  );

  if (delayPoints?.length) {
    const delayNodes = [reportTable(["Date", "Point"], delayPoints.map((d) => [d.date, d.point]), "Delay points, highlights, and red flags")];
    if (summary?.delay_commentary) delayNodes.push(new Paragraph({ text: summary.delay_commentary, spacing: { before: 120 } }));
    pushSection(bodyChildren, "7. Delay Points / Highlights / Red Flags", delayNodes);
  }

  // ── 8. Site Photographs — one heading per category, photos side by side under it ──
  if (photos?.length) {
    const photoNodes = [];
    const groups = new Map();
    for (const p of photos) {
      const category = String(p.type || "Other").trim() || "Other";
      const key = category.toLocaleLowerCase();
      if (!groups.has(key)) groups.set(key, { title: category, photos: [] });
      groups.get(key).photos.push(p);
    }

    let figNum = 1;
    let categoryNumber = 1;
    for (const { title, photos: groupPhotos } of groups.values()) {
      const loaded = [];
      for (const p of groupPhotos) {
        try {
          const img = await fetchImageBytes(p.url);
          const caption = [`Fig ${figNum}`, p.date, p.caption].filter(Boolean).join(" — ");
          loaded.push({ img, caption });
          figNum++;
        } catch (e) {
          console.warn("Skipping photo (could not embed):", p.url, e.message);
        }
      }
      if (!loaded.length) continue;

      photoNodes.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `8.${categoryNumber} ${title}`, bold: true, size: 24, color: "1E3A5F", underline: {} })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 240 },
        keepNext: true,
      }));

      const forcedSingleColumn = ["graphical report", "cube testing"];
      const isSingleColumn = forcedSingleColumn.includes(title.toLowerCase()) || loaded.length === 1;
      const columns = isSingleColumn ? 1 : 2;
      const [maxW, maxH] = isSingleColumn ? [560, 430] : [340, 260];

      photoNodes.push(photoGrid(loaded, columns, maxW, maxH));
      photoNodes.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      categoryNumber += 1;
    }
    pushSection(bodyChildren, "8. Progress Photographs", photoNodes);
  }

  const materialNodes = [];
  if (summary?.material_summary) {
    materialNodes.push(new Paragraph({ text: summary.material_summary, spacing: { after: 180 } }));
  }
  if (materials.length) {
    materialNodes.push(reportTable(
      ["Date", "Category / Subcategory", "Type", "Quantity", "Recorded By", "Bill"],
      materials.map((item) => [
        item.date,
        [item.category, item.subcategory].filter(Boolean).join(" / "),
        item.type,
        [item.quantity, item.unit].filter((value) => value !== null && value !== undefined && value !== "").join(" "),
        item.recordedBy,
        item.billAttached ? "Attached" : "—",
      ]),
      "Material receipts recorded during the month",
    ));
  } else {
    materialNodes.push(new Paragraph({ text: "No material receipts were recorded for this month." }));
  }
  pushSection(bodyChildren, "9. Materials Received", materialNodes);

  // ── SECTION 3: THANK YOU ──
  const thankYouChildren = [];
  if (logo) {
    thankYouChildren.push(new Paragraph({
      children: [new ImageRun({ data: logo.data, type: logo.type, transformation: scaledSize(logo, 170) })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 3600, after: 350 },
    }));
  }
  thankYouChildren.push(new Paragraph({
    children: [new TextRun({ text: "MONTH-END PROJECT REPORT", bold: true, size: 22, color: "B5642A" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
  }));
  thankYouChildren.push(new Paragraph({
    children: [new TextRun({ text: "Thank You", bold: true, size: 56, color: "1E3A5F" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
  }));
  thankYouChildren.push(new Paragraph({
    children: [new TextRun({
      text: "This report has been prepared to ensure transparency, quality, and continuous improvement at the project site.",
      color: "666666", size: 22,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 320 },
  }));
  thankYouChildren.push(coloredBadge("DIP PROJECTS", 55));

  const doc = new Document({
    sections: [
      {
        properties: { type: SectionType.NEXT_PAGE, page: { verticalAlign: VerticalAlign.CENTER } },
        headers: { default: emptyHeader },
        children: coverChildren,
      },
      {
        properties: { type: SectionType.NEXT_PAGE, page: { pageNumbers: { start: 1 } } },
        headers: { default: runningHeader },
        footers: { default: pageNumberFooter },
        children: bodyChildren,
      },
      {
        properties: { type: SectionType.NEXT_PAGE, page: { verticalAlign: VerticalAlign.CENTER } },
        headers: { default: emptyHeader },
        footers: { default: pageNumberFooter },
        children: thankYouChildren,
      },
    ],
  });
  return await Packer.toBlob(doc);
}
