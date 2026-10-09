import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createApp } from "./app.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
const host = process.env.HOST || (dev ? "127.0.0.1" : "0.0.0.0");
const port = Number(process.env.PORT || 3000);
const origin = process.env.APP_ORIGIN || undefined;
if (!dev && (!origin || !origin.startsWith("https://"))) {
  console.error(
    "Production requires APP_ORIGIN=https://your-domain. For local use run npm run dev.",
  );
  process.exit(1);
}
if (!dev && !existsSync(resolve(root, "dist/index.html"))) {
  console.error("Run npm run build first.");
  process.exit(1);
}
let vite;
const app = createApp({
  dbPath: resolve(
    process.env.DATABASE_PATH || resolve(root, "data/daily-system.sqlite"),
  ),
  distPath: resolve(root, "dist"),
  origin,
  secure: !dev,
  devMiddleware: dev
    ? (req, res, next) => vite.middlewares(req, res, next)
    : undefined,
});
if (dev) {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server: app.server } },
    appType: "spa",
  });
}
app.server.listen(port, host, () =>
  console.log("Daily System listening on http://" + host + ":" + port),
);
async function shutdown() {
  await app.close();
  await vite?.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
