import { runtime } from "../core/runtime.js";
export const routes = [
  "today",
  "weekly",
  "table",
  "exams",
  "all",
  "manage",
  "pomodoro",
  "settings",
];
export function syncRoute() {
  const home = document.body.dataset.presentation === "home";
  const next = home ? "/" : "/" + runtime.page;
  if (location.pathname !== next) history.pushState({}, "", next);
  document.title = home
    ? "Daily System · Less noise. More focus."
    : "Daily System · " +
      (runtime.page === "today"
        ? "Today"
        : runtime.page === "table"
          ? "Plan Table"
          : runtime.page[0].toUpperCase() + runtime.page.slice(1));
  document.querySelectorAll(".switch").forEach((button) => {
    button.setAttribute("role", "switch");
    button.setAttribute(
      "aria-checked",
      String(button.classList.contains("on")),
    );
    if (!button.getAttribute("aria-label"))
      button.setAttribute(
        "aria-label",
        button.closest(".toggle-row")?.querySelector("span")?.textContent ||
          "Toggle preference",
      );
  });
  document
    .querySelectorAll("[data-page]")
    .forEach((button) =>
      button.setAttribute(
        "aria-current",
        button.dataset.page === runtime.page ? "page" : "false",
      ),
    );
}
export function bindAccessibility() {
  const modalHost = document.getElementById("modal");
  let returnFocus;
  const observer = new MutationObserver(() => {
    const modal = modalHost.querySelector(".modal");
    if (!modal || !modalHost.classList.contains("show")) {
      document.querySelector(".app").inert = false;
      document.querySelector("#mobileNav").inert = false;
      document.querySelector("#studyWidget").inert = false;
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocus = null;
      return;
    }
    if (modal.dataset.enhanced === "true") return;
    modal.dataset.enhanced = "true";
    returnFocus ||= document.activeElement;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const title = modal.querySelector("h2");
    if (title) {
      title.id = "dialogTitle";
      modal.setAttribute("aria-labelledby", title.id);
    }
    modal.querySelectorAll("label").forEach((label) => {
      if (label.htmlFor) return;
      const field = label.nextElementSibling;
      if (field?.matches("input, select, textarea") && field.id)
        label.htmlFor = field.id;
    });
    document.querySelector(".app").inert = true;
    document.querySelector("#mobileNav").inert = true;
    document.querySelector("#studyWidget").inert = true;
    modal
      .querySelector("input:not([type=checkbox]), select, textarea, button")
      ?.focus();
  });
  observer.observe(modalHost, {
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !modalHost.classList.contains("show")) return;
    const fields = [
      ...modalHost.querySelectorAll("button, input, select, textarea, a[href]"),
    ].filter((el) => !el.disabled && el.getClientRects().length);
    const first = fields[0],
      last = fields.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
}
