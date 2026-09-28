import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeBucketName(site) {
  return (site || "site")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "site";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { site, remove, list } = body;
    if (!site || typeof site !== "string" || !site.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'site' in request body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bucketName = sanitizeBucketName(site);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: existing, error: getErr } = await supabaseAdmin
      .storage
      .getBucket(bucketName);

    if (existing && !getErr) {
      if (typeof list === "string" && list.trim()) {
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucketName)
          .list(list, { limit: 1000 });
        if (listError) {
          return new Response(
            JSON.stringify({ error: `Failed to list files: ${listError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ bucket: bucketName, created: false, files: files || [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (Array.isArray(remove) && remove.length) {
        const paths = remove.filter((path) => typeof path === "string" && path.trim());
        const { error: removeError } = await supabaseAdmin.storage.from(bucketName).remove(paths);
        if (removeError) {
          return new Response(
            JSON.stringify({ error: `Failed to remove files: ${removeError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ bucket: bucketName, created: false, removed: paths.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ bucket: bucketName, created: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: createErr } = await supabaseAdmin
      .storage
      .createBucket(bucketName, {
        public: true,
        fileSizeLimit: "20MB",
      });

    if (createErr && !/already exists/i.test(createErr.message || "")) {
      return new Response(
        JSON.stringify({ error: `Failed to create bucket: ${createErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ bucket: bucketName, created: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});