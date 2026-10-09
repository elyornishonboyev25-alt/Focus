import { render } from "../features/views.js";
import { runtime } from "./runtime.js";

export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2200);
}

export function navigate(delta) {
  if (runtime.page === "table")
    runtime.tablePage = Math.max(0, runtime.tablePage + delta);
  else runtime.selectedDate.setDate(runtime.selectedDate.getDate() + delta);
  render();
}

export function goToday() {
  runtime.selectedDate = new Date();
  runtime.selectedDate.setHours(12, 0, 0, 0);
  runtime.page = "today";
  render();
}

export function setPage(p) {
  runtime.page = p;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
