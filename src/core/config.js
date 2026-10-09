export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const PLAN_GROUPS = [
  {
    id: "Weekdays",
    label: "Mon–Fri",
    detail: "One shared plan for every weekday",
  },
  {
    id: "Weekend",
    label: "Sat–Sun",
    detail: "One shared plan for every Saturday and Sunday",
  },
];

// Every workspace starts with the user's own plans.
export const WORKWEEK_PLAN = [];
export const WEEKEND_PLAN = [];
export const STUDY_PRESETS = {};
export const STUDY_HIGHLIGHTS = {};
export const SCHEDULE = Object.fromEntries(WEEKDAYS.map((day) => [day, []]));

export const defaults = {
  pom: {
    blocks: [
      { work: 25, rest: 5, repeats: 5 },
      { work: 50, rest: 10, repeats: 1 },
      { work: 25, rest: 5, repeats: 2 },
    ],
    loop: true,
    sound: true,
    notifications: false,
    selectedTask: "",
    brownNoise: true,
    brownVolume: 35,
  },
  stats: {
    today: { date: "", sessions: 0, minutes: 0, blocks: 0 },
    totalSessions: 0,
    totalMinutes: 0,
    totalBlocks: 0,
    streak: 0,
    lastFocusDate: "",
  },
  prefs: { sound: true, notifications: false, loop: true },
};

export const PLAN_START_DATE = "2026-09-30",
  TABLE_DAYS = 30;

export const navItems = [
  ["today", "Today"],
  ["weekly", "Weekly"],
  ["table", "Plan Table"],
  ["exams", "Exam Dates"],
  ["all", "All Days"],
  ["manage", "Manage Plans"],
  ["pomodoro", "Pomodoro"],
  ["settings", "Settings"],
];

export const SHORT_PLAN_NAMES = {};

export const BROWN_NOISE_VIDEO = "0GDfOAuUvQ0";
