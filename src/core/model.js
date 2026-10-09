import { removeSeededPlans } from "../../shared/plans.js";
import { loadJSON, saveJSON } from "./storage.js";
import { KEYS } from "../../shared/schema.js";
import {
  PLAN_GROUPS,
  STUDY_HIGHLIGHTS,
  STUDY_PRESETS,
  WEEKDAYS,
  defaults,
} from "./config.js";
import { restoreActiveTimers } from "../features/timers.js";
import { render } from "../features/views.js";
import { syncBrownNoise } from "../features/audio.js";
import { runtime } from "./runtime.js";

export function init() {
  runtime.state.templates = loadJSON(KEYS.templates, {
    Weekdays: [],
    Weekend: [],
  });
  runtime.state.completions = loadJSON(KEYS.completions, {});
  runtime.state.custom = loadJSON(KEYS.custom, {});
  runtime.state.pom = loadJSON(KEYS.pom, defaults.pom);
  runtime.state.stats = loadJSON(KEYS.stats, defaults.stats);
  runtime.state.prefs = loadJSON(KEYS.prefs, {
    sound: true,
    notifications: false,
    loop: true,
  });
  runtime.state.exams = loadJSON(KEYS.exams, []);
  if (!Array.isArray(runtime.state.exams)) runtime.state.exams = [];
  const values = {
    [KEYS.templates]: runtime.state.templates,
    [KEYS.completions]: runtime.state.completions,
    [KEYS.prefs]: runtime.state.prefs,
  };
  const cleaned = removeSeededPlans(values);
  if (cleaned !== values) {
    runtime.state.templates = cleaned[KEYS.templates];
    runtime.state.completions = cleaned[KEYS.completions];
    runtime.state.prefs = cleaned[KEYS.prefs];
    for (const [key, value] of Object.entries(cleaned)) saveJSON(key, value);
  }
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
  runtime.state.pom.sound = runtime.state.prefs.sound;
  runtime.state.pom.loop = runtime.state.prefs.loop;
  runtime.state.pom.brownNoise = runtime.state.pom.brownNoise !== false;
  runtime.state.pom.brownVolume = Number.isFinite(
    +runtime.state.pom.brownVolume,
  )
    ? Math.max(0, Math.min(100, +runtime.state.pom.brownVolume))
    : 35;
  ensureTodayStats();
  restoreActiveTimers();
  render();
  syncBrownNoise();
}

export function ensurePlanGroups() {
  let changed = false;
  for (const { id } of PLAN_GROUPS) {
    if (!Array.isArray(runtime.state.templates[id])) {
      // Preserve the user's older per-day plans when opening a legacy backup.
      const days = id === "Weekdays" ? WEEKDAYS.slice(0, 5) : WEEKDAYS.slice(5);
      runtime.state.templates[id] =
        days
          .map((day) => runtime.state.templates[day])
          .find((tasks) => Array.isArray(tasks) && tasks.length) || [];
      changed = true;
    }
  }
  if (changed) saveJSON(KEYS.templates, runtime.state.templates);
}

// Legacy import hooks now only normalize groups; they never populate plans.
export function upgradeWorkweekPlan() {
  ensurePlanGroups();
}
export function upgradeWeekendPlan() {
  ensurePlanGroups();
}

export function ensureStudyFlow() {
  if (
    !runtime.state.prefs.studyFlow ||
    typeof runtime.state.prefs.studyFlow !== "object"
  )
    runtime.state.prefs.studyFlow = {};
  let changed = false;
  for (const group of PLAN_GROUPS) {
    const settings = (runtime.state.prefs.studyFlow[group.id] ||= {});
    for (const task of runtime.state.templates[group.id] || []) {
      if (settings[task.id]) continue;
      const minutes = STUDY_PRESETS[group.id]?.[task.name];
      if (minutes) {
        settings[task.id] = { enabled: true, minutes };
        changed = true;
      }
    }
  }
  if (changed) saveJSON(KEYS.prefs, runtime.state.prefs);
}

export function ensureStudyCategories() {
  let changed = false;
  for (const group of PLAN_GROUPS)
    for (const task of runtime.state.templates[group.id] || []) {
      if (
        task.study === undefined &&
        STUDY_HIGHLIGHTS[group.id]?.has(task.name)
      ) {
        task.study = true;
        changed = true;
      }
    }
  if (changed) saveJSON(KEYS.templates, runtime.state.templates);
}

export function studySetting(group, task) {
  return (
    runtime.state.prefs.studyFlow?.[group]?.[task.id] || {
      enabled: false,
      minutes: 25,
    }
  );
}

export function studyItemsForToday() {
  const group = planGroup(new Date());
  return (runtime.state.templates[group] || [])
    .filter((t) => studySetting(group, t).enabled)
    .map((t) => {
      const minutes = Math.max(
        1,
        Math.min(600, Number(studySetting(group, t).minutes) || 25),
      );
      const restMinutes =
        t.study === true ? Math.min(minutes - 1, minutes <= 30 ? 5 : 10) : 0;
      return {
        id: t.id,
        name: t.name,
        minutes,
        restMinutes,
        workMinutes: minutes - restMinutes,
      };
    });
}

export function ensureTodayStats() {
  const k = dateKey(new Date());
  if (runtime.state.stats.today.date !== k)
    runtime.state.stats.today = { date: k, sessions: 0, minutes: 0, blocks: 0 };
}

export function dateKey(d) {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, "0"),
    day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function weekday(d) {
  return WEEKDAYS[(d.getDay() + 6) % 7];
}

export function planGroup(d) {
  const day = weekday(d);
  return day === "Saturday" || day === "Sunday" ? "Weekend" : "Weekdays";
}

export function groupLabel(group) {
  return PLAN_GROUPS.find((x) => x.id === group)?.label || group;
}

export function fmtDate(d) {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(d) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}

export function validExamDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [year, month, day] = key.split("-").map(Number),
    d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function examDaysLeft(key, now = new Date()) {
  if (!validExamDate(key)) return NaN;
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  );
}

export function sortedExams() {
  return runtime.state.exams
    .filter((x) => x && typeof x.name === "string" && validExamDate(x.date))
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
    );
}

export function nextExam() {
  return sortedExams().find((x) => examDaysLeft(x.date) >= 0) || null;
}

export function examDateLabel(key) {
  return fromKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function examCountdownLabel(days) {
  return days === 0
    ? "Today"
    : days === 1
      ? "1 day left"
      : days > 1
        ? `${days} days left`
        : `${Math.abs(days)} ${days === -1 ? "day" : "days"} ago`;
}

export function seedExamDates() {}

export function tasksFor(d) {
  return runtime.state.templates[planGroup(d)] || [];
}

export function compFor(k) {
  return runtime.state.completions[k] || (runtime.state.completions[k] = {});
}

export function metrics(d) {
  const ts = tasksFor(d),
    c = compFor(dateKey(d));
  let done = ts.filter((t) => c[t.id]).length,
    total = ts.length;
  let pct = total ? (done / total) * 100 : 0;
  return {
    done,
    total,
    pct,
    status: !total
      ? "Ready when you are"
      : pct >= 90
        ? "Excellent"
        : pct >= 75
          ? "Very Good"
          : pct >= 60
            ? "Good"
            : pct >= 40
              ? "Average"
              : "Low Progress",
  };
}

export function persist() {
  saveJSON(KEYS.templates, runtime.state.templates);
  saveJSON(KEYS.completions, runtime.state.completions);
  saveJSON(KEYS.custom, runtime.state.custom);
  saveJSON(KEYS.pom, runtime.state.pom);
  saveJSON(KEYS.stats, runtime.state.stats);
  saveJSON(KEYS.prefs, runtime.state.prefs);
  saveJSON(KEYS.exams, runtime.state.exams);
}
