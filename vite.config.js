import { defineConfig } from "vite";
import { createHash } from "node:crypto";
export default defineConfig({
  build: { target: "es2022", sourcemap: true },
  plugins: [
    {
      name: "daily-system-offline",
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle).filter(
          (name) => !name.endsWith(".map"),
        );
        const version = createHash("sha256")
          .update(
            assets
              .map(
                (name) =>
                  name + ":" + (bundle[name].code || bundle[name].source),
              )
              .join("|"),
          )
          .digest("hex")
          .slice(0, 12);
        const urls = [
          "/",
          "/index.html",
          "/favicon.svg",
          "/manifest.webmanifest",
          ...assets.map((name) => "/" + name),
        ];
        const source =
          "const CACHE=" +
          JSON.stringify("daily-system-" + version) +
          ";const SHELL=" +
          JSON.stringify([...new Set(urls)]) +
          ";" +
          "self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});" +
          "self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('daily-system-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});" +
          "self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;}if(SHELL.includes(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));}});";
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
});
