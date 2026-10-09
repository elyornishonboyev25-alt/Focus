import { runtime } from "../core/runtime.js";
import { KEYS, SYNC_KEYS } from "../../shared/schema.js";
const META = "daily-system:active-workspace";
let session = null,
  namespace = "",
  revision = 0,
  baseline = {},
  outbox = {},
  conflict = null;
let busy = false,
  debounce,
  hydration = false;
let status = "Connecting…";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const clone = (value) => JSON.parse(JSON.stringify(value));
function cacheKey(key) {
  return namespace + key;
}
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(key))) ?? clone(fallback);
  } catch {
    return clone(fallback);
  }
}
function write(key, value) {
  localStorage.setItem(cacheKey(key), JSON.stringify(value));
}
function signal(message) {
  status = message;
  window.dispatchEvent(
    new CustomEvent("planner:sync", { detail: getSyncInfo() }),
  );
}
export function getSyncInfo() {
  return {
    session,
    status,
    pending: Object.keys(outbox).length,
    conflict: !!conflict,
  };
}
export async function api(
  path,
  { method = "GET", data, signal: abortSignal } = {},
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal: abortSignal || AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(value.error || "Request failed."), {
      status: response.status,
      data: value,
    });
  return value;
}
function persistQueue() {
  write("outbox", outbox);
  write("baseline", { values: baseline, revision });
}
function importServer(snapshot) {
  revision = snapshot.revision;
  baseline = snapshot.values;
  for (const [key, value] of Object.entries(baseline))
    if (SYNC_KEYS.includes(key) && !outbox[key]) write(key, value);
  persistQueue();
}
function reconcile(snapshot) {
  const conflicts = [];
  for (const [key, item] of Object.entries(outbox)) {
    const incoming = snapshot.values[key];
    if (equal(incoming, item.value)) delete outbox[key];
    else if (!equal(incoming, item.base)) conflicts.push(key);
    else item.base = incoming;
  }
  importServer(snapshot);
  if (conflicts.length) {
    conflict = snapshot;
    signal("Changes need review");
    return false;
  }
  return true;
}
export async function bootstrapStorage() {
  let previous;
  try {
    previous = JSON.parse(localStorage.getItem(META));
  } catch {}
  try {
    session = await api("/api/session");
  } catch {
    session = previous || { workspaceId: "offline", user: null };
    signal("Offline · saved on this device");
  }
  namespace = "daily-system:" + session.workspaceId + ":";
  if (session.csrf && previous?.workspaceId === "offline") {
    for (const key of SYNC_KEYS) {
      const offline = localStorage.getItem("daily-system:offline:" + key);
      if (offline) {
        localStorage.setItem(cacheKey(key), offline);
        outbox[key] = { value: JSON.parse(offline), base: undefined };
      }
    }
  }
  if (!previous && !session.user) {
    for (const key of Object.values(KEYS)) {
      const legacy = localStorage.getItem(key);
      if (legacy && !localStorage.getItem(cacheKey(key)))
        localStorage.setItem(cacheKey(key), legacy);
    }
  }
  try {
    localStorage.setItem(
      META,
      JSON.stringify({ workspaceId: session.workspaceId, user: session.user }),
    );
  } catch {}
  const saved = read("baseline", { values: {}, revision: 0 });
  baseline = saved.values;
  revision = saved.revision;
  outbox = { ...read("outbox", {}), ...outbox };
  if (session.csrf) {
    try {
      const snapshot = await api("/api/state");
      if (!Object.keys(snapshot.values).length) {
        for (const key of SYNC_KEYS) {
          const cached = read(key, null);
          if (cached !== null && !outbox[key])
            outbox[key] = { value: cached, base: undefined };
        }
      }
      reconcile(snapshot);
      signal(
        conflict
          ? "Changes need review"
          : Object.keys(outbox).length
            ? "Saving…"
            : "Saved to server",
      );
    } catch {
      signal("Offline · saved on this device");
    }
  }
  hydration = true;
  window.addEventListener("online", () => {
    if (!session.csrf) location.reload();
    else flush();
  });
  window.addEventListener("offline", () =>
    signal("Offline · saved on this device"),
  );
  setInterval(() => {
    if (Object.keys(outbox).length && !conflict && navigator.onLine) flush();
  }, 15000);
}
export function loadJSON(key, fallback) {
  return read(key, fallback);
}
export function saveJSON(key, value) {
  try {
    write(key, value);
    if (hydration && SYNC_KEYS.includes(key)) {
      if (!equal(value, baseline[key]) || outbox[key]) {
        outbox[key] = {
          value: clone(value),
          base: outbox[key] ? outbox[key].base : baseline[key],
        };
        persistQueue();
        if (!conflict)
          signal(
            session.csrf && navigator.onLine
              ? "Saving…"
              : "Offline · saved on this device",
          );
        clearTimeout(debounce);
        debounce = setTimeout(flush, 500);
      }
    }
    return true;
  } catch {
    signal("Device storage is full · export a backup");
    return false;
  }
}
export async function flush() {
  if (busy || conflict || !session?.csrf || !Object.keys(outbox).length)
    return !Object.keys(outbox).length;
  busy = true;
  const batch = clone(outbox);
  try {
    const result = await api("/api/state", {
      method: "PUT",
      data: {
        revision,
        changes: Object.fromEntries(
          Object.entries(batch).map(([key, item]) => [key, item.value]),
        ),
      },
    });
    for (const [key, item] of Object.entries(batch)) {
      if (equal(outbox[key]?.value, item.value)) delete outbox[key];
      else if (outbox[key]) outbox[key].base = result.values[key];
    }
    importServer(result);
    signal(Object.keys(outbox).length ? "Saving…" : "Saved to server");
  } catch (error) {
    if (error.status === 409) reconcile(error.data);
    else
      signal(
        error.status === 403
          ? "Session expired · refresh to reconnect"
          : error.status === 400
            ? "Data needs review · export a backup"
            : "Offline · saved on this device",
      );
  } finally {
    busy = false;
  }
  if (!conflict && Object.keys(outbox).length && status === "Saving…")
    debounce = setTimeout(flush, 500);
  return !Object.keys(outbox).length && !conflict;
}
export async function resolveConflict(choice) {
  if (!conflict) return;
  // The local copy remains available until the user chooses which version to use.
  if (choice === "server") {
    outbox = {};
    importServer(conflict);
    conflict = null;
    runtime.skipUnloadSave = true;
    location.reload();
  } else {
    for (const [key, item] of Object.entries(outbox))
      item.base = conflict.values[key];
    conflict = null;
    persistQueue();
    signal("Saving…");
    await flush();
    if (!Object.keys(outbox).length) {
      runtime.skipUnloadSave = true;
      location.reload();
    }
  }
}
export async function resetWorkspace() {
  if (!session?.csrf)
    throw new Error("Connect to the server before resetting data.");
  if (!(await flush()))
    throw new Error("Resolve pending changes before resetting.");
  await api("/api/state/reset", { method: "POST", data: { revision } });
  for (const key of [...Object.values(KEYS), "baseline", "outbox"])
    localStorage.removeItem(cacheKey(key));
}
export function getSession() {
  return session;
}
