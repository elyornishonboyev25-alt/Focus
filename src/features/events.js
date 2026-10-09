import { validateBackup } from "../../shared/schema.js";
import { resetWorkspace, flush } from "../services/storage.js";
import { PLAN_GROUPS } from "../core/config.js";
import { render } from "./views.js";
import { goToday, navigate, setPage, toast } from "../core/navigation.js";
import {
  closeModal,
  confirmDelete,
  confirmDeleteExam,
  openExamModal,
  openPlanModal,
} from "./plans.js";
import {
  compFor,
  dateKey,
  ensurePlanGroups,
  ensureStudyCategories,
  ensureStudyFlow,
  esc,
  fromKey,
  persist,
  planGroup,
  studyItemsForToday,
  tasksFor,
  upgradeWeekendPlan,
  upgradeWorkweekPlan,
} from "../core/model.js";
import { saveJSON } from "../core/storage.js";
import { KEYS } from "../../shared/schema.js";
import {
  pausePom,
  resetPom,
  saveActiveTimers,
  startPom,
  startStudyFlow,
  syncPom,
  tickStudy,
  updateTimerDOM,
} from "./timers.js";
import { setBrownVolume, syncBrownNoise } from "./audio.js";
import { runtime } from "../core/runtime.js";

export function bindPage() {
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.page === "table") {
          runtime.tablePage = 0;
          runtime.tableGroup = PLAN_GROUPS.some(
            (g) => g.id === runtime.state.prefs.tableGroup,
          )
            ? runtime.state.prefs.tableGroup
            : "Weekdays";
        }
        runtime.page = b.dataset.page;
        runtime.menuOpen = false;
        document.querySelector(".sidebar").style.display = "";
        render();
      }),
  );
  document
    .querySelectorAll("[data-open-exams]")
    .forEach((b) => (b.onclick = () => setPage("exams")));
  document
    .querySelectorAll("[data-add-exam]")
    .forEach((b) => (b.onclick = () => openExamModal()));
  document.querySelectorAll("[data-edit-exam]").forEach(
    (b) =>
      (b.onclick = () => {
        const exam = runtime.state.exams.find(
          (x) => x.id === b.dataset.editExam,
        );
        if (exam) openExamModal(exam);
      }),
  );
  document.querySelectorAll("[data-delete-exam]").forEach(
    (b) =>
      (b.onclick = () => {
        const exam = runtime.state.exams.find(
          (x) => x.id === b.dataset.deleteExam,
        );
        if (exam) confirmDeleteExam(exam);
      }),
  );
  document.querySelectorAll("[data-open-date]").forEach(
    (b) =>
      (b.onclick = () => {
        runtime.selectedDate = fromKey(b.dataset.openDate);
        runtime.page = "today";
        render();
      }),
  );
  document.querySelectorAll("[data-manage-day]").forEach(
    (b) =>
      (b.onclick = () => {
        runtime.manageDay = b.dataset.manageDay;
        render();
      }),
  );
  document.querySelectorAll("[data-table-page]").forEach(
    (b) =>
      (b.onclick = () => {
        runtime.tablePage = Math.max(
          0,
          runtime.tablePage + Number(b.dataset.tablePage),
        );
        render();
      }),
  );
  document
    .querySelector("[data-table-start]")
    ?.addEventListener("click", () => {
      runtime.tablePage = 0;
      render();
    });
  document.querySelectorAll("[data-table-group]").forEach(
    (b) =>
      (b.onclick = () => {
        runtime.tableGroup = b.dataset.tableGroup;
        runtime.state.prefs.tableGroup = runtime.tableGroup;
        saveJSON(KEYS.prefs, runtime.state.prefs);
        render();
      }),
  );
  document.querySelectorAll("[data-edit-group]").forEach(
    (b) =>
      (b.onclick = () => {
        runtime.manageDay = b.dataset.editGroup;
        runtime.page = "manage";
        render();
        window.scrollTo(0, 0);
      }),
  );
  document
    .querySelectorAll("[data-complete-date]")
    .forEach((ch) => (ch.onchange = () => toggleTableCell(ch)));
  document.querySelectorAll(".sheet-cell").forEach(
    (cell) =>
      (cell.onclick = (e) => {
        if (e.target.matches("input")) return;
        const ch = cell.querySelector("input");
        if (!ch.disabled) ch.click();
      }),
  );
  document.querySelectorAll(".task-check").forEach(
    (ch) =>
      (ch.onchange = () => {
        const row = ch.closest(".task"),
          id = row.dataset.taskId,
          k = dateKey(runtime.selectedDate);
        if (k > dateKey(new Date())) {
          ch.checked = false;
          return;
        }
        compFor(k)[id] = ch.checked;
        saveJSON(KEYS.completions, runtime.state.completions);
        render();
      }),
  );
  document.querySelectorAll("[data-edit-task]").forEach(
    (b) =>
      (b.onclick = () => {
        const day =
            runtime.page === "manage"
              ? runtime.manageDay
              : planGroup(runtime.selectedDate),
          t = (runtime.state.templates[day] || []).find(
            (x) => x.id === b.dataset.editTask,
          );
        if (t) openPlanModal(t, day);
      }),
  );
  document.querySelectorAll("[data-delete-task]").forEach(
    (b) =>
      (b.onclick = () => {
        const day =
            runtime.page === "manage"
              ? runtime.manageDay
              : planGroup(runtime.selectedDate),
          t = (runtime.state.templates[day] || []).find(
            (x) => x.id === b.dataset.deleteTask,
          );
        if (t) confirmDelete(t, day);
      }),
  );
  document
    .querySelectorAll("[data-up]")
    .forEach((b) => (b.onclick = () => moveTask(b.dataset.up, -1)));
  document
    .querySelectorAll("[data-down]")
    .forEach((b) => (b.onclick = () => moveTask(b.dataset.down, 1)));
  document
    .querySelectorAll("[data-action=add]")
    .forEach((b) => (b.onclick = () => openPlanModal()));
  document
    .querySelectorAll("[data-create-plan]")
    .forEach(
      (button) =>
        (button.onclick = () => openPlanModal(null, button.dataset.createPlan)),
    );
  document.querySelectorAll("[data-action=pom],[data-action=pomStart]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.action === "pomStart") {
          runtime.focusTimer?.running ? pausePom() : startPom();
        } else {
          runtime.page = "pomodoro";
          startPom();
        }
        syncBrownNoise();
      }),
  );
  document.querySelectorAll("[data-pom]").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.pom === "start") startPom();
      if (b.dataset.pom === "pause") pausePom();
      if (b.dataset.pom === "reset") resetPom();
    };
  });
  document
    .querySelector("[data-study-start]")
    ?.addEventListener("click", startStudyFlow);
  document.querySelectorAll("[data-study-enabled]").forEach(
    (ch) =>
      (ch.onchange = () => {
        const group = planGroup(new Date()),
          id = ch.dataset.studyEnabled,
          minutes =
            Number(
              document.querySelector(`[data-study-minutes="${id}"]`)?.value,
            ) || 25;
        (runtime.state.prefs.studyFlow[group] ||= {})[id] = {
          enabled: ch.checked,
          minutes: Math.max(1, Math.min(600, minutes)),
        };
        saveJSON(KEYS.prefs, runtime.state.prefs);
        const p = document.querySelector(".study-panel-top p");
        if (p)
          p.textContent = `${studyItemsForToday().length} selected tasks · Study time includes 5 min rest for short tasks or 10 min for longer tasks. The flow continues automatically.`;
      }),
  );
  document.querySelectorAll("[data-study-minutes]").forEach(
    (inp) =>
      (inp.onchange = () => {
        const group = planGroup(new Date()),
          id = inp.dataset.studyMinutes,
          minutes = Math.max(1, Math.min(600, Number(inp.value) || 25));
        inp.value = minutes;
        (runtime.state.prefs.studyFlow[group] ||= {})[id] = {
          enabled: !!document.querySelector(`[data-study-enabled="${id}"]`)
            ?.checked,
          minutes,
        };
        saveJSON(KEYS.prefs, runtime.state.prefs);
      }),
  );
  document
    .querySelectorAll("[data-toggle]")
    .forEach((b) => (b.onclick = () => togglePref(b.dataset.toggle)));
  document
    .querySelectorAll("[data-setting-toggle]")
    .forEach((b) => (b.onclick = () => togglePref(b.dataset.settingToggle)));
  const bv = document.getElementById("brownVolume");
  if (bv) {
    bv.oninput = () => {
      runtime.state.pom.brownVolume = +bv.value;
      const out = document.getElementById("brownVolumeValue");
      if (out) out.textContent = bv.value + "%";
      setBrownVolume(bv.value);
      persist();
    };
  }
  document.querySelectorAll("[data-seq]").forEach(
    (inp) =>
      (inp.onchange = () => {
        const i = +inp.dataset.seq,
          key = inp.dataset.key,
          v = Math.max(key === "rest" ? 0 : 1, Math.min(600, +inp.value || 0));
        runtime.state.pom.blocks[i][key] = v;
        persist();
        render();
      }),
  );
  document.querySelectorAll("[data-remove-block]").forEach(
    (b) =>
      (b.onclick = () => {
        if (runtime.state.pom.blocks.length <= 1) {
          toast("Keep at least one block.");
          return;
        }
        runtime.state.pom.blocks.splice(+b.dataset.removeBlock, 1);
        persist();
        render();
      }),
  );
  document.querySelector("[data-add-block]")?.addEventListener("click", () => {
    runtime.state.pom.blocks.push({ work: 25, rest: 5, repeats: 1 });
    persist();
    render();
  });
  document
    .querySelectorAll("[data-data]")
    .forEach((b) => (b.onclick = () => dataAction(b.dataset.data)));
  document
    .querySelector("[data-focus-select]")
    ?.addEventListener("click", openFocusSelect);
  document.querySelectorAll("[data-drag]").forEach(bindPlanDrag);
}

export function toggleTableCell(input) {
  const key = input.dataset.completeDate,
    id = input.dataset.completeTask;
  if (key > dateKey(new Date())) {
    input.checked = false;
    return;
  }
  const date = fromKey(key),
    task = tasksFor(date).find((t) => t.id === id);
  if (!task) {
    input.checked = false;
    return;
  }
  const checks = compFor(key),
    done = input.checked;
  if (done) checks[id] = true;
  else delete checks[id];
  saveJSON(KEYS.completions, runtime.state.completions);
  const kind = done ? "done" : key < dateKey(new Date()) ? "missed" : "today";
  const label = done
    ? "Completed"
    : kind === "missed"
      ? "Not completed"
      : "Mark completed";
  input.closest("td").className =
    `sheet-cell ${kind} ${task.study ? "study-column" : ""}`;
  input.setAttribute("aria-label", `${task.name} — ${key}: ${label}`);
}

export function moveTask(id, dir) {
  const a = runtime.state.templates[runtime.manageDay],
    i = a.findIndex((x) => x.id === id),
    j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  saveJSON(KEYS.templates, runtime.state.templates);
  render();
}

export function reorderDrag(from, to, before) {
  if (!from || !to || from === to) return;
  const a = runtime.state.templates[runtime.manageDay],
    i = a.findIndex((x) => x.id === from),
    j = a.findIndex((x) => x.id === to);
  if (i < 0 || j < 0) return;
  let dest = j + (before ? 0 : 1);
  if (i < dest) dest--;
  if (i === dest) return;
  const [task] = a.splice(i, 1);
  a.splice(dest, 0, task);
  saveJSON(KEYS.templates, runtime.state.templates);
  render();
}

export function bindPlanDrag(row) {
  let active = null;
  function markTarget() {
    document
      .querySelectorAll(".manage-item.drop-before,.manage-item.drop-after")
      .forEach((el) => el.classList.remove("drop-before", "drop-after"));
    active.target = null;
    const target = document
      .elementFromPoint(active.x, active.y)
      ?.closest(".manage-item");
    if (!target || target === row) return;
    active.target = target;
    active.before =
      active.y < target.getBoundingClientRect().top + target.offsetHeight / 2;
    target.classList.add(active.before ? "drop-before" : "drop-after");
  }
  row.onpointerdown = (e) => {
    if (
      e.button !== 0 ||
      e.target.closest(".manage-actions") ||
      (e.pointerType === "touch" && !e.target.closest(".drag-handle"))
    )
      return;
    active = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      target: null,
      before: false,
      frame: 0,
    };
    row.setPointerCapture(e.pointerId);
  };
  row.onpointermove = (e) => {
    if (!active || e.pointerId !== active.id) return;
    active.x = e.clientX;
    active.y = e.clientY;
    if (
      !active.dragging &&
      Math.hypot(active.x - active.startX, active.y - active.startY) < 5
    )
      return;
    if (!active.dragging) {
      active.dragging = true;
      row.classList.add("dragging");
    }
    markTarget();
    if (!active.frame) {
      const scroll = () => {
        if (!active?.dragging) return;
        const edge = 65,
          delta =
            active.y < edge
              ? -Math.min(15, (edge - active.y) / 4)
              : active.y > innerHeight - edge
                ? Math.min(15, (active.y - innerHeight + edge) / 4)
                : 0;
        if (delta) {
          window.scrollBy(0, delta);
          markTarget();
        }
        active.frame = requestAnimationFrame(scroll);
      };
      active.frame = requestAnimationFrame(scroll);
    }
  };
  const finish = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const drag = active;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    row.classList.remove("dragging");
    document
      .querySelectorAll(".manage-item.drop-before,.manage-item.drop-after")
      .forEach((el) => el.classList.remove("drop-before", "drop-after"));
    active = null;
    if (e.type === "pointerup" && drag.dragging && drag.target)
      reorderDrag(row.dataset.drag, drag.target.dataset.drag, drag.before);
  };
  row.onpointerup = finish;
  row.onpointercancel = finish;
}

export function togglePref(key) {
  if (key === "sound") {
    runtime.state.prefs.sound = !runtime.state.prefs.sound;
    runtime.state.pom.sound = runtime.state.prefs.sound;
  }
  if (key === "loop") {
    runtime.state.prefs.loop = !runtime.state.prefs.loop;
    runtime.state.pom.loop = runtime.state.prefs.loop;
  }
  if (key === "notifications") {
    runtime.state.prefs.notifications = !runtime.state.prefs.notifications;
    runtime.state.pom.notifications = runtime.state.prefs.notifications;
    if (runtime.state.prefs.notifications && "Notification" in window)
      Notification.requestPermission().catch(() => {});
  }
  if (key === "brownNoise") {
    runtime.state.pom.brownNoise = !runtime.state.pom.brownNoise;
    syncBrownNoise();
  }
  persist();
  render();
  syncBrownNoise();
}

export function openFocusSelect() {
  const ts = tasksFor(runtime.selectedDate);
  document.getElementById("modal").innerHTML =
    `<div class="modal"><h2>Focus on task</h2><label>Today's task</label><select id="focusTask" class="field"><option value="">No selected task</option>${ts.map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("")}</select><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn black" data-save-focus>Save</button></div></div>`;
  document.getElementById("modal").classList.add("show");
  document.getElementById("focusTask").value =
    runtime.state.pom.selectedTask || "";
  document.querySelector("[data-save-focus]").onclick = () => {
    runtime.state.pom.selectedTask = document.getElementById("focusTask").value;
    persist();
    closeModal();
    render();
  };
}

export async function dataAction(type) {
  if (type === "export") {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      templates: runtime.state.templates,
      completions: runtime.state.completions,
      custom: runtime.state.custom,
      pom: runtime.state.pom,
      stats: runtime.state.stats,
      prefs: runtime.state.prefs,
      exams: runtime.state.exams,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "daily-system-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Data exported.");
  } else if (type === "import") document.getElementById("importFile").click();
  else if (type === "reset") {
    if (confirm("Reset all Daily System data? This cannot be undone.")) {
      try {
        await resetWorkspace();
        runtime.skipUnloadSave = true;
        clearInterval(startPom.iv);
        clearInterval(runtime.studyInterval);
        location.reload();
      } catch (error) {
        toast(error.message);
      }
    }
  }
}

export function syncTimersAfterReturn() {
  if (runtime.focusTimer?.running) {
    syncPom();
    updateTimerDOM();
  }
  if (runtime.studyTimer?.running) tickStudy();
}

export function refreshCalendarDay() {
  const today = dateKey(new Date());
  if (today === runtime.renderedDay) return;
  if (dateKey(runtime.selectedDate) === runtime.renderedDay)
    runtime.selectedDate = fromKey(today);
  runtime.renderedDay = today;
  render();
}

export function bindShell() {
  document.getElementById("importFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024) throw Error();
      const x = validateBackup(JSON.parse(await file.text()));
      if (confirm("Replace existing data with this backup?")) {
        clearInterval(startPom.iv);
        clearInterval(runtime.studyInterval);
        runtime.focusTimer = null;
        runtime.studyTimer = null;
        saveActiveTimers();
        runtime.state.templates = x.templates;
        runtime.state.completions = x.completions;
        runtime.state.custom = x.custom || {};
        runtime.state.pom = x.pom;
        runtime.state.stats = x.stats;
        runtime.state.prefs = x.prefs;
        runtime.state.exams = Array.isArray(x.exams) ? x.exams : [];
        ensurePlanGroups();
        upgradeWorkweekPlan();
        upgradeWeekendPlan();
        ensureStudyCategories();
        ensureStudyFlow();
        runtime.tableGroup = PLAN_GROUPS.some(
          (g) => g.id === runtime.state.prefs.tableGroup,
        )
          ? runtime.state.prefs.tableGroup
          : "Weekdays";
        persist();
        render();
        toast("Data imported successfully.");
      }
    } catch {
      toast("Invalid Daily System backup file.");
    }
    e.target.value = "";
  };
  document.getElementById("prevBtn").onclick = () => navigate(-1);
  document.getElementById("nextBtn").onclick = () => navigate(1);
  document.getElementById("todayBtn").onclick = goToday;
  document.getElementById("quickExam").onclick = () => setPage("exams");
  document.getElementById("quickPom").onclick = () => setPage("pomodoro");
  document.getElementById("menuBtn").onclick = () => {
    runtime.menuOpen = !runtime.menuOpen;
    document.querySelector(".sidebar").style.display = runtime.menuOpen
      ? "flex"
      : "none";
    document.querySelector(".sidebar").style.position = "fixed";
  };
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal" || e.target.matches("[data-close]"))
      closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.getElementById("modal").classList.contains("show")
    ) {
      closeModal();
      return;
    }
    if (document.getElementById("modal").classList.contains("show")) return;
    if (document.body.dataset.presentation === "home") return;
    if (
      e.target.matches("input,textarea,select") ||
      e.target.isContentEditable ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key.toLowerCase() === "n") navigate(1);
    if (e.key.toLowerCase() === "p") navigate(-1);
    if (e.key.toLowerCase() === "t") goToday();
    if (e.code === "Space") {
      e.preventDefault();
      runtime.focusTimer?.running ? pausePom() : startPom();
    }
    if (e.key.toLowerCase() === "r") resetPom();
  });
  window.addEventListener("beforeunload", () => {
    if (!runtime.skipUnloadSave) {
      persist();
      saveActiveTimers();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncTimersAfterReturn();
  });
  setInterval(refreshCalendarDay, 60000);
  window.addEventListener("focus", () => {
    refreshCalendarDay();
    syncTimersAfterReturn();
  });
}
