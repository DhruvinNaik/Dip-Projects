const HR_BUCKET = "documents";
const HR_TABLE = "hr_documents";
let pending;

async function resolveHrBucket(supabase) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const existing = (buckets || []).find((bucket) => bucket.name === HR_BUCKET);
  if (existing) return existing.name;

  const { error: createErr } = await supabase.storage.createBucket(HR_BUCKET, {
    public: true,
  });
  if (!createErr || /already exists/i.test(createErr.message || "")) return HR_BUCKET;

  const { data, error } = await supabase.functions.invoke("ensure-bucket", {
    body: { site: HR_BUCKET },
  });
  if (!error && !data?.error) return data?.bucket || HR_BUCKET;

  throw new Error(
    data?.error || error?.message || createErr.message || "Could not prepare the HR storage bucket.",
  );
}

/** Use the existing HR bucket, or create it once if it is missing. */
export function ensureHrBucket(supabase) {
  if (!pending) {
    pending = resolveHrBucket(supabase).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

export async function uploadHrFile(supabase, path, file) {
  const bucket = await ensureHrBucket(supabase);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not get file URL");
  return data.publicUrl;
}

function storagePathFromPublicUrl(url, bucketName) {
  if (!url) return null;
  const raw = String(url).trim().split("?")[0];
  if (!raw) return null;
  if (!raw.includes("://")) return decodeURIComponent(raw.replace(/^\/+/, ""));
  try {
    const parsed = new URL(raw);
    const markers = [
      `/object/public/${bucketName}/`,
      `/object/sign/${bucketName}/`,
      `/object/authenticated/${bucketName}/`,
    ];
    for (const marker of markers) {
      const idx = parsed.pathname.indexOf(marker);
      if (idx !== -1) return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    }
    const hrIdx = parsed.pathname.indexOf("/hr_docs/");
    if (hrIdx !== -1) return decodeURIComponent(parsed.pathname.slice(hrIdx + 1));
  } catch {
    return null;
  }
  return null;
}

async function listHrFolder(supabase, bucket, folder) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  if (!error && data?.length) return data;

  const { data: remote, error: fnErr } = await supabase.functions.invoke("ensure-bucket", {
    body: { site: bucket, list: folder },
  });
  if (fnErr || remote?.error) return data || [];
  return remote?.files || data || [];
}

function rowMatchesDoc(row, docKey, docLabel) {
  const raw = String(row.doc_type || row.type || row.category || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const label = String(row.name || row.doc_type || row.type || "")
    .trim()
    .toLowerCase();
  return raw === docKey || label === String(docLabel || "").trim().toLowerCase();
}

async function removeHrPaths(supabase, bucket, paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;

  const { data, error } = await supabase.storage.from(bucket).remove(unique);
  if (!error && (data?.length || 0) >= unique.length) return;

  const { data: remote, error: fnErr } = await supabase.functions.invoke("ensure-bucket", {
    body: { site: bucket, remove: unique },
  });
  if (fnErr || remote?.error || remote?.removed !== unique.length) {
    throw new Error(remote?.error || fnErr?.message || error?.message || "Could not delete the previous file from storage.");
  }
}

/** Delete every previous file and table row for this employee document, then store the new one. */
export async function replaceEmployeeDocument(supabase, { username, employeeName, docKey, docLabel, file }) {
  const bucket = await ensureHrBucket(supabase);
  const folder = `hr_docs/${username}`;

  const { data: rows, error: listErr } = await supabase
    .from(HR_TABLE)
    .select("id, file_url, url, document_url, doc_type, type, name")
    .eq("user_name", username);
  if (listErr) throw listErr;

  const matches = (rows || []).filter((row) => rowMatchesDoc(row, docKey, docLabel));
  const paths = new Set();
  matches.forEach((row) => {
    [row.file_url, row.url, row.document_url].forEach((url) => {
      const path = storagePathFromPublicUrl(url, bucket);
      if (path) paths.add(path);
    });
  });

  const stored = await listHrFolder(supabase, bucket, folder);
  stored.forEach((item) => {
    const name = item?.name || "";
    if (!name || name === ".emptyFolderPlaceholder") return;
    if (name === docKey || name.startsWith(`${docKey}.`) || name.startsWith(`${docKey}_`)) {
      paths.add(`${folder}/${name}`);
    }
  });

  await removeHrPaths(supabase, bucket, [...paths]);

  if (matches.length) {
    const { error: deleteErr } = await supabase
      .from(HR_TABLE)
      .delete()
      .in("id", matches.map((row) => row.id));
    if (deleteErr) throw deleteErr;
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${docKey}_${Date.now()}.${ext}`;
  const publicUrl = await uploadHrFile(supabase, path, file);
  const payload = {
    user_name: username,
    employee_name: employeeName,
    doc_type: docKey,
    type: docKey,
    name: docLabel,
    file_name: file.name,
    file_url: publicUrl,
    url: publicUrl,
    document_url: publicUrl,
  };
  const { data, error: insertErr } = await supabase
    .from(HR_TABLE)
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (insertErr) throw insertErr;
  return { id: data?.id, url: publicUrl, file_name: file.name };
}
