// import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// const GEMINI_MODEL = "gemini-2.5-flash";
// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
// };

// const SCHEMA = `{
//   "executive_summary": string,
//   "key_activities": string[],
//   "progress_highlights": string[],
//   "delays_and_flags": string[],
//   "visitor_summary": string,
//   "pending_drawings_decisions": string[],
//   "next_month_outlook": string[],
//   "report_count": number
// }`;

// serve(async (req) => {
//   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

//   try {
//     const body = await req.json().catch(() => ({}));
//     const apiKey = body?.apiKey || GEMINI_API_KEY;

//     if (!apiKey) {
//       return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured. Set the Supabase secret or pass apiKey in the request body." }), {
//         status: 500,
//         headers: corsHeaders,
//       });
//     }

//     const { site, month, reports } = body;
//     if (!Array.isArray(reports) || !reports.length) {
//       return new Response(JSON.stringify({ error: "No WPR data provided" }), {
//         status: 400,
//         headers: corsHeaders,
//       });
//     }

//     const systemPrompt =
//       "You are a construction project reporting assistant. You write concise, factual month-end progress reports based on the full set of weekly progress report (WPR) entries for the selected month. Use all reports supplied in the array; do not focus on only the last week. Merge repeated items across weeks, but keep all genuine activities, delays, visits, and next steps present in the month. Never invent facts not present in the source data. Respond with ONLY valid JSON — no markdown fences, no commentary.";

//     const userPrompt = `Site: ${site}
// Month: ${month}

// Raw weekly report data (JSON array, oldest first):

// ${JSON.stringify(reports)}

// Produce a month-end summary as JSON matching this schema:
// ${SCHEMA}

// Rules:
// - Merge and deduplicate similar/repeated points across weeks (e.g. the same activity mentioned in 3 WPRs should appear once, optionally noting progression).
// - Keep each bullet under 20 words.
// - Only summarize what is actually present in the data — do not fabricate figures, dates, or names.
// - Output raw JSON only, nothing else.`;

//     const resp = await fetch(
//       `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
//       {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({
//           system_instruction: { parts: [{ text: systemPrompt }] },
//           contents: [{ role: "user", parts: [{ text: userPrompt }] }],
//           generationConfig: {
//             temperature: 0.3,
//             maxOutputTokens: 2000,
//             responseMimeType: "application/json",
//           },
//         }),
//       },
//     );

//     if (!resp.ok) {
//       const errText = await resp.text();
//       let parsedErr = errText;
//       try {
//         parsedErr = JSON.stringify(JSON.parse(errText), null, 2);
//       } catch {
//         parsedErr = errText;
//       }
//       return new Response(JSON.stringify({ error: `Gemini API error (${resp.status}): ${parsedErr}` }), {
//         status: 502,
//         headers: corsHeaders,
//       });
//     }

//     const data = await resp.json();
//     const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n").trim() || "";
//     const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

//     let summary;
//     try {
//       summary = JSON.parse(cleaned);
//     } catch {
//       return new Response(
//         JSON.stringify({ error: "Failed to parse AI response as JSON", raw: text }),
//         { status: 502, headers: corsHeaders },
//       );
//     }

//     const normalizedSummary = {
//       executive_summary: summary.executive_summary || "",
//       key_activities: Array.isArray(summary.key_activities) ? summary.key_activities : [],
//       progress_highlights: Array.isArray(summary.progress_highlights) ? summary.progress_highlights : [],
//       delays_and_flags: Array.isArray(summary.delays_and_flags) ? summary.delays_and_flags : [],
//       visitor_summary: summary.visitor_summary || "",
//       pending_drawings_decisions: Array.isArray(summary.pending_drawings_decisions) ? summary.pending_drawings_decisions : [],
//       next_month_outlook: Array.isArray(summary.next_month_outlook) ? summary.next_month_outlook : [],
//       report_count: Number(summary.report_count || reports.length),
//     };

//     return new Response(JSON.stringify({ summary: normalizedSummary }), {
//       headers: { ...corsHeaders, "content-type": "application/json" },
//     });
//   } catch (err) {
//     return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
//       status: 500,
//       headers: corsHeaders,
//     });
//   }
// });

//2nd
// import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// const GEMINI_MODEL = "gemini-3.6-flash";
// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
// };

// // Deliberately small — every raw field is shown in full elsewhere in the
// // document. This call only produces narrative commentary that sits ON TOP
// // of the raw data, so it can never contradict or omit anything.
// const SCHEMA = `{
//   "executive_summary": string,
//   "activity_highlights": string[],
//   "visitor_summary": string,
//   "delay_commentary": string
// }`;

// serve(async (req) => {
//   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

//   try {
//     const body = await req.json().catch(() => ({}));
//     const apiKey = body?.apiKey || GEMINI_API_KEY;
//     if (!apiKey) {
//       return new Response(
//         JSON.stringify({ error: "GEMINI_API_KEY not configured." }),
//         { status: 500, headers: corsHeaders },
//       );
//     }

//     const { site, month, reports } = body;
//     if (!Array.isArray(reports) || !reports.length) {
//       return new Response(JSON.stringify({ error: "No WPR data provided" }), {
//         status: 400,
//         headers: corsHeaders,
//       });
//     }

//     const systemPrompt =
//       "You are a construction project reporting assistant. You write SHORT narrative commentary that sits alongside a full raw data dump the reader will also see in tables. Do not repeat the raw data verbatim — add color, trend, and context instead (e.g. 'excavation progressed from 40% to 75% over the month' rather than re-listing every activity). Never invent facts. Respond with ONLY valid JSON — no markdown fences, no commentary outside the JSON.";

//     const userPrompt = `Site: ${site}
// Month: ${month}

// Raw weekly report data for the full month (JSON array, oldest first). The reader will see all of this in full elsewhere — your job is only to summarize trends and add narrative color:

// ${JSON.stringify(reports)}

// Produce JSON matching this schema:
// ${SCHEMA}

// Rules:
// - executive_summary: 3-5 sentence overview of how the month went (progress trend, notable events).
// - activity_highlights: up to 6 short bullets (under 20 words each) on the most significant activity progressions across the month — not a full list, just what stands out.
// - visitor_summary: 1-3 sentences on notable visits/patterns this month (or empty string if no visitors).
// - delay_commentary: 1-3 sentences on delay/red-flag trends this month (or empty string if none).
// - Only reference what is actually present in the data.
// - Output raw JSON only.`;

//     const resp = await fetch(
//       `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
//       {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({
//           system_instruction: { parts: [{ text: systemPrompt }] },
//           contents: [{ role: "user", parts: [{ text: userPrompt }] }],
//           generationConfig: {
//             temperature: 0.3,
//             maxOutputTokens: 1200,
//           },
//         }),
//       },
//     );

//     if (!resp.ok) {
//       const errText = await resp.text();
//       console.error(`Gemini API error (${resp.status}):`, errText);
//       return new Response(
//         JSON.stringify({ error: `Gemini API error (${resp.status}): ${errText.substring(0, 500)}` }),
//         { status: 502, headers: corsHeaders },
//       );
//     }

//     const data = await resp.json();
//     const text =
//       data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n").trim() || "";
//     const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

//     let summary;
//     try {
//       summary = JSON.parse(cleaned);
//     } catch {
//       return new Response(
//         JSON.stringify({ error: "Failed to parse AI response as JSON", raw: text }),
//         { status: 502, headers: corsHeaders },
//       );
//     }

//     const normalized = {
//       executive_summary: summary.executive_summary || "",
//       activity_highlights: Array.isArray(summary.activity_highlights) ? summary.activity_highlights : [],
//       visitor_summary: summary.visitor_summary || "",
//       delay_commentary: summary.delay_commentary || "",
//     };

//     return new Response(JSON.stringify({ summary: normalized }), {
//       headers: { ...corsHeaders, "content-type": "application/json" },
//     });
//   } catch (err) {
//     return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
//       status: 500,
//       headers: corsHeaders,
//     });
//   }
// });

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = "openai/gpt-oss-120b"; // alt: "llama-3.1-8b-instant" for faster/cheaper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Deliberately small — every raw field is shown in full elsewhere in the
// document. This call only produces narrative commentary that sits ON TOP
// of the raw data, so it can never contradict or omit anything.
const SCHEMA = `{
  "executive_summary": string,
  "activity_highlights": string[],
  "material_summary": string,
  "visitor_summary": string,
  "delay_commentary": string
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = body?.apiKey || GROQ_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured." }),
        { status: 500, headers: corsHeaders },
      );
    }

    const { site, month } = body;
    const reports = Array.isArray(body?.reports) ? body.reports : [];
    const materials = Array.isArray(body?.materials) ? body.materials : [];
    const materialReceiptCount = Number(body?.materialReceiptCount) || 0;
    if (!reports.length && !materials.length) {
      return new Response(JSON.stringify({ error: "No WPR or material receipt data provided" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const systemPrompt =
      "You are a construction project reporting assistant. Write concise, professional commentary based only on the supplied weekly progress reports and material receipt totals. The reader will see the raw records in tables, so explain trends and context without repeating the tables. Never invent facts, infer quality or consumption, or claim a delivery was used. Respond with ONLY valid JSON — no markdown fences or commentary outside the JSON.";

    const userPrompt = `Site: ${site}
Month: ${month}

Raw weekly report data for the full month (JSON array, oldest first):

${JSON.stringify(reports)}

Material receipt totals for the same month, grouped by category, subcategory, type, and unit:
${JSON.stringify(materials)}
Total material receipt records: ${materialReceiptCount}

Produce JSON matching this schema:
${SCHEMA}

Rules:
- executive_summary: 3-5 sentence overview of how the month went (progress trend, notable events).
- activity_highlights: up to 6 short bullets (under 20 words each) on the most significant activity progressions across the month — not a full list, just what stands out.
- material_summary: 1-3 sentences describing recorded receipts and notable category or quantity patterns. Distinguish receipts from usage; use the provided units and totals.
- visitor_summary: 1-3 sentences on notable visits/patterns this month (or empty string if no visitors).
- delay_commentary: 1-3 sentences on delay/red-flag trends this month (or empty string if none).
- Only reference what is actually present in the data.
- If weekly reports or material receipts are absent, summarize only the data that is present.
- Output raw JSON only.`;

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1600,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Groq API error (${resp.status}):`, errText);
      return new Response(
        JSON.stringify({ error: `Groq API error (${resp.status}): ${errText.substring(0, 500)}` }),
        { status: 502, headers: corsHeaders },
      );
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

    let summary;
    try {
      summary = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response as JSON", raw: text }),
        { status: 502, headers: corsHeaders },
      );
    }

    const normalized = {
      executive_summary: summary.executive_summary || "",
      activity_highlights: Array.isArray(summary.activity_highlights) ? summary.activity_highlights : [],
      material_summary: summary.material_summary || "",
      visitor_summary: summary.visitor_summary || "",
      delay_commentary: summary.delay_commentary || "",
    };

    return new Response(JSON.stringify({ summary: normalized }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});