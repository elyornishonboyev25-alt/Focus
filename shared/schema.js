export const KEYS = Object.freeze({
  templates: "planner_recurring_templates",
  completions: "planner_task_completions",
  custom: "planner_custom_tasks",
  pom: "planner_pomodoro_settings",
  stats: "planner_pomodoro_stats",
  exams: "planner_exam_dates",
  prefs: "planner_preferences",
  activePom: "planner_active_pomodoro",
  activeStudy: "planner_active_study_flow",
});
export const SYNC_KEYS = Object.values(KEYS).filter(
  (key) => key !== KEYS.activePom && key !== KEYS.activeStudy,
);
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const number = (value, min = 0, max = 1e12) =>
  Number.isFinite(value) && value >= min && value <= max;
const text = (value, max = 10000) =>
  typeof value === "string" && value.length <= max;
const boolean = (value) => typeof value === "boolean";
const everyValue = (value, check) =>
  object(value) && Object.values(value).every(check);
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function safeTree(value, depth = 0) {
  if (depth > 16) return false;
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(
    ([key, item]) =>
      !["__proto__", "prototype", "constructor"].includes(key) &&
      safeTree(item, depth + 1),
  );
}
const task = (value) =>
  object(value) &&
  text(value.id, 200) &&
  text(value.name, 500) &&
  value.name.trim().length > 0 &&
  text(value.schedule ?? "", 500) &&
  text(value.notes ?? "") &&
  (value.study === undefined || boolean(value.study));
const validators = {
  [KEYS.templates]: (value) =>
    everyValue(
      value,
      (list) => Array.isArray(list) && list.length <= 1000 && list.every(task),
    ),
  [KEYS.completions]: (value) =>
    everyValue(value, (checks) => everyValue(checks, boolean)) &&
    Object.keys(value).every(validDate),
  [KEYS.custom]: (value) => object(value),
  [KEYS.pom]: (value) =>
    object(value) &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.length <= 100 &&
    value.blocks.every(
      (block) =>
        object(block) &&
        number(block.work, 1, 600) &&
        number(block.rest, 0, 600) &&
        Number.isInteger(block.repeats) &&
        number(block.repeats, 1, 600),
    ) &&
    ["loop", "sound", "notifications"].every((key) => boolean(value[key])) &&
    text(value.selectedTask ?? "", 500) &&
    (value.brownNoise === undefined || boolean(value.brownNoise)) &&
    (value.brownVolume === undefined || number(value.brownVolume, 0, 100)),
  [KEYS.stats]: (value) =>
    object(value) &&
    object(value.today) &&
    text(value.today.date, 10) &&
    ["sessions", "minutes", "blocks"].every((key) =>
      number(value.today[key]),
    ) &&
    ["totalSessions", "totalMinutes", "totalBlocks", "streak"].every((key) =>
      number(value[key]),
    ) &&
    text(value.lastFocusDate, 10),
  [KEYS.prefs]: (value) =>
    object(value) &&
    ["sound", "notifications", "loop"].every((key) => boolean(value[key])) &&
    (value.studyFlow === undefined ||
      everyValue(value.studyFlow, (group) =>
        everyValue(
          group,
          (item) =>
            object(item) &&
            boolean(item.enabled) &&
            number(item.minutes, 1, 600),
        ),
      )),
  [KEYS.exams]: (value) =>
    Array.isArray(value) &&
    value.length <= 1000 &&
    value.every(
      (exam) =>
        object(exam) &&
        text(exam.id, 200) &&
        text(exam.name, 500) &&
        exam.name.trim().length > 0 &&
        validDate(exam.date) &&
        text(exam.notes ?? ""),
    ),
};
export function validateValues(values, { complete = false } = {}) {
  if (!object(values) || !safeTree(values))
    throw new Error("Invalid planner data.");
  if (complete && !SYNC_KEYS.every((key) => Object.hasOwn(values, key)))
    throw new Error("The backup is missing planner data.");
  for (const [key, value] of Object.entries(values)) {
    if (!validators[key] || !validators[key](value))
      throw new Error("Invalid data: " + key + ".");
  }
  return values;
}
export function validateBackup(backup) {
  if (!object(backup)) throw new Error("Invalid backup file.");
  const values = Object.fromEntries(
    ["templates", "completions", "pom", "stats", "prefs"].map((name) => [
      KEYS[name],
      backup[name],
    ]),
  );
  values[KEYS.custom] = backup.custom ?? {};
  values[KEYS.exams] = backup.exams ?? [];
  validateValues(values, { complete: true });
  return backup;
}
