import {
  api,
  flush,
  getSyncInfo,
  resolveConflict,
} from "../services/storage.js";
import { esc } from "../core/model.js";
export function updateAccountUI() {
  const { session, status } = getSyncInfo();
  const button = document.getElementById("accountBtn");
  if (button) {
    button.textContent = session?.user?.email || "Guest workspace";
    button.title = "Account and saving";
  }
  const statusElement = document.getElementById("syncStatus");
  if (statusElement) statusElement.textContent = status;
  const settingsStatus = document.getElementById("settingsSyncStatus");
  if (settingsStatus) settingsStatus.textContent = status;
}
export function accountSection() {
  const { session, status } = getSyncInfo();
  return (
    '<div class="panel setting-section"><h3>Account & saving</h3><p>' +
    (session?.user
      ? esc(session.user.email)
      : "Use this guest workspace or create an account to open your planner on other devices.") +
    '</p><div class="data-actions"><button class="btn black" data-account>Manage account</button><span class="account-sync" id="settingsSyncStatus">' +
    esc(status) +
    "</span></div></div>"
  );
}
export function openAccount(mode = "register") {
  const { session, status, conflict } = getSyncInfo();
  const signedIn = !!session?.user;
  const host = document.getElementById("modal");
  host.innerHTML =
    '<div class="modal account-modal"><div class="eyebrow">DAILY SYSTEM</div><h2>' +
    (conflict
      ? "Review your changes"
      : signedIn
        ? "Your workspace"
        : mode === "login"
          ? "Welcome back"
          : "Save your progress") +
    "</h2>" +
    (conflict
      ? '<p>Plans changed on another device. Your local changes are still saved here. Choose the version to continue with; export a backup from Settings first if you need both.</p><div class="modal-actions"><button class="btn" data-use-server>Use server version</button><button class="btn black" data-use-local>Keep device changes</button></div>'
      : signedIn
        ? "<p>" +
          esc(session.user.email) +
          '</p><p class="account-sync">' +
          esc(status) +
          '</p><div class="modal-actions"><button class="btn" data-close>Close</button><button class="btn black" data-logout>Sign out</button></div>'
        : "<p>" +
          (mode === "register"
            ? "Your current plans move into your new account. You can then sign in on another device."
            : "Sign in to open your account’s plans. Your guest workspace remains saved separately on this device.") +
          '</p><form id="accountForm"><label for="accountEmail">Email</label><input class="field" id="accountEmail" type="email" autocomplete="email" required maxlength="254"><label for="accountPassword">Password · 12 characters minimum</label><input class="field" id="accountPassword" type="password" autocomplete="' +
          (mode === "register" ? "new-password" : "current-password") +
          '" required minlength="12" maxlength="256"><p class="form-error" id="accountError" role="alert"></p><div class="modal-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn black" type="submit">' +
          (mode === "register" ? "Create account" : "Sign in") +
          '</button></div></form><button class="account-mode" data-account-mode>' +
          (mode === "register"
            ? "Already have an account? Sign in"
            : "Create a new account") +
          "</button>") +
    '<p class="form-error" id="accountActionError" role="alert"></p></div>';
  host.classList.add("show");
  host
    .querySelector("[data-account-mode]")
    ?.addEventListener("click", () =>
      openAccount(mode === "login" ? "register" : "login"),
    );
  async function action(button, task) {
    button.disabled = true;
    try {
      await task();
    } catch (error) {
      host.querySelector("#accountError, #accountActionError").textContent =
        error.message;
      button.disabled = false;
    }
  }
  host.querySelector("#accountForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    action(form.querySelector("[type=submit]"), async () => {
      if (!(await flush()))
        throw new Error(
          "Your changes are still pending. Reconnect or review the saving status first.",
        );
      await api("/api/auth/" + mode, {
        method: "POST",
        data: {
          email: form.querySelector("#accountEmail").value,
          password: form.querySelector("#accountPassword").value,
        },
      });
      location.reload();
    });
  });
  host.querySelector("[data-logout]")?.addEventListener("click", (event) =>
    action(event.currentTarget, async () => {
      if (!(await flush()))
        throw new Error("Save your pending changes before signing out.");
      await api("/api/auth/logout", { method: "POST", data: {} });
      location.reload();
    }),
  );
  host
    .querySelector("[data-use-server]")
    ?.addEventListener("click", (event) =>
      action(event.currentTarget, () => resolveConflict("server")),
    );
  host
    .querySelector("[data-use-local]")
    ?.addEventListener("click", (event) =>
      action(event.currentTarget, () => resolveConflict("local")),
    );
}
export function bindAccount() {
  document
    .getElementById("accountBtn")
    .addEventListener("click", () => openAccount());
  document
    .getElementById("accountMobile")
    .addEventListener("click", () => openAccount());
  document
    .getElementById("syncStatus")
    .addEventListener("click", () => openAccount());
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-account]")) openAccount();
  });
  window.addEventListener("planner:sync", updateAccountUI);
  updateAccountUI();
}
