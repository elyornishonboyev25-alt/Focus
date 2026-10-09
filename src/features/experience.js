import { runtime } from "../core/runtime.js";
import { setPage } from "../core/navigation.js";
import { createFocusSculpture } from "./sculpture.js";
let ready = false;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
export function showHome(push = true) {
  document.body.dataset.presentation = "home";
  document.body.classList.remove("table-view");
  document.querySelector(".sidebar").style.display = "";
  runtime.menuOpen = false;
  if (push && location.pathname !== "/") history.pushState({}, "", "/");
  document.title = "Daily System · Less noise. More focus.";
  document.querySelector('meta[name="theme-color"]').content = "#10251d";
  if (push) window.scrollTo({ top: 0, behavior: "instant" });
}
export function showWorkspace(page = "today", renderPage = true) {
  document.body.dataset.presentation = "workspace";
  document.querySelector('meta[name="theme-color"]').content = "#f5f6f0";
  if (renderPage && ready) setPage(page);
  else {
    runtime.page = page;
    if (renderPage && location.pathname !== "/" + page)
      history.pushState({}, "", "/" + page);
  }
  if (renderPage)
    document.getElementById("appPage").focus({ preventScroll: true });
}
export function setExperienceReady() {
  ready = true;
}
export function bindExperience() {
  document.body.classList.add("motion-enabled");
  if (location.pathname === "/") showHome(false);
  else showWorkspace(location.pathname.split("/")[1], false);
  document.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const home = event.target.closest("[data-home]");
    if (home) {
      event.preventDefault();
      showHome();
      document.querySelector(".landing-login").focus({ preventScroll: true });
      return;
    }
    const link = event.target.closest("[data-enter]");
    if (link) {
      event.preventDefault();
      showWorkspace(link.dataset.enter);
      return;
    }
    if (runtime.menuOpen && !event.target.closest(".sidebar,#menuBtn")) {
      runtime.menuOpen = false;
      document.querySelector(".sidebar").style.display = "";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && runtime.menuOpen) {
      runtime.menuOpen = false;
      document.querySelector(".sidebar").style.display = "";
      document.getElementById("menuBtn").focus();
    }
  });
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          reveal.unobserve(entry.target);
        }
    },
    { threshold: 0.12 },
  );
  document
    .querySelectorAll("[data-reveal]")
    .forEach((el) => reveal.observe(el));
  createFocusSculpture(
    document.getElementById("focusSculpture"),
    document.getElementById("sculptureStage"),
  );
}
export function enhanceWorkspace() {
  const page = document.getElementById("appPage");
  const previous = page.dataset.view;
  page.dataset.view = runtime.page;
  if (
    previous !== runtime.page &&
    !motion.matches &&
    document.body.dataset.presentation === "workspace"
  ) {
    page.getAnimations().forEach((animation) => animation.cancel());
    page.animate(
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 360, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }
  const nav = document.querySelector('#sideNav [aria-current="page"]');
  let breadcrumb = document.getElementById("workspaceBreadcrumb");
  if (!breadcrumb) {
    breadcrumb = document.createElement("div");
    breadcrumb.id = "workspaceBreadcrumb";
    breadcrumb.className = "workspace-breadcrumb";
    document
      .querySelector(".topbar")
      .insertBefore(breadcrumb, document.getElementById("prevBtn"));
  }
  breadcrumb.textContent = nav?.textContent.trim() || "Workspace";
}
