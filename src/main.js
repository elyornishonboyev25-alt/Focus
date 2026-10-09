import "./styles/original.css";
import "./styles/product.css";
import "./styles/motion.css";
import {
  bindExperience,
  showHome,
  showWorkspace,
  setExperienceReady,
} from "./features/experience.js";
import { init, dateKey } from "./core/model.js";
import { runtime } from "./core/runtime.js";
import { bindShell } from "./features/events.js";
import { render } from "./features/views.js";
import { bindAccount } from "./features/account.js";
import { bootstrapStorage } from "./services/storage.js";
import { bindAccessibility, routes } from "./services/shell.js";
bindExperience();
async function boot() {
  await bootstrapStorage();
  runtime.renderedDay = dateKey(new Date());
  const route = location.pathname.split("/")[1];
  runtime.page = routes.includes(route) ? route : "today";
  setExperienceReady();
  bindShell();
  bindAccessibility();
  bindAccount();
  init();
  window.addEventListener("popstate", () => {
    if (location.pathname === "/") {
      showHome(false);
      return;
    }
    const route = location.pathname.split("/")[1];
    showWorkspace(routes.includes(route) ? route : "today", false);
    render();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator)
    navigator.serviceWorker.register("/sw.js").catch(() => {});
}
boot().catch((error) => {
  console.error(error);
  const page = document.getElementById("appPage");
  page.textContent =
    "Your planner could not open. Refresh the page to try again.";
  const retry = document.createElement("button");
  retry.className = "btn black";
  retry.textContent = "Refresh";
  retry.onclick = () => location.reload();
  page.append(retry);
});
