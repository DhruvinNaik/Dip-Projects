import { createClient } from "@supabase/supabase-js";
import { reportDatabaseDown } from "./lib/dbStatus";

const supabaseUrl =
  "https://efqfjfthsleymhljswcq.supabase.co";

const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcWZqZnRoc2xleW1obGpzd2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDY0MjMsImV4cCI6MjA5NTkyMjQyM30.PYMRiKdnhzb6pkvhDB4M4Qdp3nSGhsZpHGuclVqYNMs";

// Statuses that mean the project is paused or its gateway is down, not that one query was wrong.
const DOWN_STATUSES = new Set([402, 502, 503, 504, 520, 521, 522, 523, 524]);

/** Wraps fetch so every database call reports when the database cannot be reached. */
async function monitoredFetch(input, init) {
  let response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    reportDatabaseDown(err?.message || "Database is unreachable");
    throw err;
  }
  if (DOWN_STATUSES.has(response.status)) {
    reportDatabaseDown(`Database returned HTTP ${response.status}`);
  }
  return response;
}

export const supabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    { global: { fetch: monitoredFetch } }
  );
