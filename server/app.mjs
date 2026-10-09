import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { openDatabase } from "./database.mjs";
import { createAuth } from "./auth.mjs";
import { validateValues } from "../shared/schema.js";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
export function createApp({
  dbPath = ":memory:",
  distPath,
  origin,
  secure = false,
  devMiddleware,
} = {}) {
  const store = openDatabase(dbPath),
    auth = createAuth(store, { secure });
  const attempts = new Map();
  const maintenance = setInterval(() => {
    store.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    for (const [key, entry] of attempts)
      if (entry.until < Date.now()) attempts.delete(key);
  }, 60000).unref();
  function json(res, status, data) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    if (!String(req.headers["content-type"]).startsWith("application/json"))
      throw Object.assign(new Error("JSON is required."), { status: 415 });
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4 * 1024 * 1024)
        throw Object.assign(new Error("Request exceeds 4 MB."), {
          status: 413,
        });
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString());
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw Error();
      return value;
    } catch {
      throw Object.assign(new Error("Invalid JSON request."), { status: 400 });
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const path = new URL(req.url, "http://localhost").pathname;
    try {
      if (path === "/api/health" && req.method === "GET")
        return json(res, 200, { ok: true });
      if (path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store");
        const current = auth.session(req, res);
        if (!["GET", "HEAD"].includes(req.method)) {
          const expectedOrigin = origin || "http://" + req.headers.host;
          if (
            req.headers.origin !== expectedOrigin ||
            req.headers["x-csrf-token"] !== current.csrf
          )
            return json(res, 403, {
              error: "Refresh the page before trying again.",
            });
        }
        if (path === "/api/session" && req.method === "GET")
          return json(res, 200, auth.info(current));
        if (path === "/api/state" && req.method === "GET")
          return json(res, 200, store.read(current.workspaceId));
        if (path === "/api/state" && req.method === "PUT") {
          const input = await body(req);
          if (!Number.isSafeInteger(input.revision) || input.revision < 0)
            return json(res, 400, { error: "Invalid revision." });
          try {
            validateValues(input.changes);
          } catch (error) {
            return json(res, 400, { error: error.message });
          }
          const result = store.update(
            current.workspaceId,
            input.revision,
            input.changes,
          );
          return json(
            res,
            result ? 200 : 409,
            result || {
              error: "Data changed on another device.",
              ...store.read(current.workspaceId),
            },
          );
        }
        if (path === "/api/state/reset" && req.method === "POST") {
          const input = await body(req);
          if (!Number.isSafeInteger(input.revision) || input.revision < 0)
            return json(res, 400, { error: "Invalid revision." });
          const result = store.reset(current.workspaceId, input.revision);
          return json(
            res,
            result ? 200 : 409,
            result || {
              error: "Data changed on another device.",
              ...store.read(current.workspaceId),
            },
          );
        }
        if (
          [
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/logout",
          ].includes(path) &&
          req.method === "POST"
        ) {
          const action = path.split("/").at(-1);
          if (action !== "logout") {
            const key = req.socket.remoteAddress || "unknown";
            let entry = attempts.get(key);
            if (!entry || entry.until < Date.now()) {
              entry = { count: 0, until: Date.now() + 900000 };
              attempts.set(key, entry);
            }
            if (++entry.count > 12) {
              res.setHeader(
                "Retry-After",
                String(Math.ceil((entry.until - Date.now()) / 1000)),
              );
              return json(res, 429, {
                error: "Too many attempts. Try again in 15 minutes.",
              });
            }
          }
          const input = await body(req);
          const next = await auth[action](current, res, input);
          return json(res, 200, auth.info(next));
        }
        return json(res, 404, { error: "API endpoint not found." });
      }
      if (devMiddleware)
        return devMiddleware(req, res, () =>
          json(res, 404, { error: "Page not found." }),
        );
      if (!distPath)
        return json(res, 404, { error: "Build the frontend first." });
      if (!["GET", "HEAD"].includes(req.method))
        return json(res, 405, { error: "Method not allowed." });
      const base = resolve(distPath);
      let filename = resolve(base, "." + decodeURIComponent(path));
      if (filename !== base && !filename.startsWith(base + sep))
        return json(res, 403, { error: "Invalid path." });
      try {
        if (!(await stat(filename)).isFile()) throw Error();
      } catch {
        if (extname(path)) return json(res, 404, { error: "Asset not found." });
        filename = resolve(base, "index.html");
      }
      const content = await readFile(filename);
      res.writeHead(200, {
        "Content-Type": MIME[extname(filename)] || "application/octet-stream",
        "Cache-Control": path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (error.status)
        return json(res, error.status, { error: error.message });
      console.error("Request failed:", error);
      if (!res.headersSent)
        json(res, 500, {
          error: "The server could not complete this request.",
        });
      else res.end();
    }
  });
  return {
    server,
    store,
    close: async () => {
      clearInterval(maintenance);
      await new Promise((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      });
      store.close();
    },
  };
}
