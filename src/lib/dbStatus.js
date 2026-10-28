// Lets any Supabase request announce that the database is down, so the app-wide gate can take over.
const listeners = new Set();

export function reportDatabaseDown(reason) {
  listeners.forEach((listener) => listener(reason));
}

/** Calls `listener` with a reason each time a request reports the database as down. Returns an unsubscribe function. */
export function subscribeDatabaseDown(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
