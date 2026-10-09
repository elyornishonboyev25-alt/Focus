import { icon } from "./icons.js";
import { enhanceWorkspace } from "./experience.js";
import { accountSection } from "./account.js";
import { syncRoute } from "../services/shell.js";
import {
  PLAN_GROUPS,
  PLAN_START_DATE,
  SHORT_PLAN_NAMES,
  TABLE_DAYS,
  WEEKDAYS,
  navItems,
} from "../core/config.js";
import {
  compFor,
  dateKey,
  ensureStudyFlow,
  ensureTodayStats,
  esc,
  examCountdownLabel,
  examDateLabel,
  examDaysLeft,
  fmtDate,
  fromKey,
  groupLabel,
  metrics,
  nextExam,
  planGroup,
  shortDate,
  sortedExams,
  studyItemsForToday,
  studySetting,
  tasksFor,
  weekday,
} from "../core/model.js";
import { bindPage } from "./events.js";
import { renderStudyWidget } from "./timers.js";
import { brownNoiseLive } from "./audio.js";
import { runtime } from "../core/runtime.js";

export function renderNav() {
  const side = document.getElementById("sideNav");
  side.innerHTML = navItems
    .map(
      ([id, label]) =>
        `<button class="${runtime.page === id ? "active" : ""}" data-page="${id}">${icon(id)}<span>${label}</span></button>`,
    )
    .join("");
  document.getElementById("mobileNav").innerHTML = navItems
    .slice(0, 4)
    .map(
      ([id, label]) =>
        `<button class="${runtime.page === id ? "active" : ""}" data-page="${id}">${icon(id)}<span>${label}</span></button>`,
    )
    .join("");
}

export function render() {
  ensureTodayStats();
  renderNav();
  renderExamQuick();
  document.body.classList.toggle("table-view", runtime.page === "table");
  document
    .getElementById("prevBtn")
    .setAttribute(
      "aria-label",
      runtime.page === "table" ? "Previous period" : "Previous day",
    );
  document
    .getElementById("nextBtn")
    .setAttribute(
      "aria-label",
      runtime.page === "table" ? "Next period" : "Next day",
    );
  const p = document.getElementById("appPage");
  p.style.paddingBottom = "";
  p.classList.toggle("sheet-page", runtime.page === "table");
  if (runtime.page === "today")
    p.innerHTML = renderDaily(
      dateKey(runtime.selectedDate) === dateKey(new Date()),
    );
  else if (runtime.page === "weekly") p.innerHTML = renderWeekly();
  else if (runtime.page === "table") p.innerHTML = renderTable();
  else if (runtime.page === "exams") p.innerHTML = renderExams();
  else if (runtime.page === "all") p.innerHTML = renderAll();
  else if (runtime.page === "manage") p.innerHTML = renderManage();
  else if (runtime.page === "pomodoro") p.innerHTML = renderPom();
  else p.innerHTML = renderSettings();
  syncRoute();
  bindPage();
  enhanceWorkspace();
  renderStudyWidget();
  if (runtime.page === "table")
    requestAnimationFrame(() => window.scrollTo(0, 0));
}

export function renderDaily(isToday) {
  const d = runtime.selectedDate,
    m = metrics(d),
    k = dateKey(d),
    wd = weekday(d),
    ts = tasksFor(d),
    c = compFor(k);
  const stats = runtime.state.stats.today;
  if (!ts.length)
    return `<div class="hero"><div><div class="eyebrow">${esc(wd)} / ${esc(fmtDate(d))}</div><h1 class="title">Your day starts here.</h1><div class="subtitle">A little intention. A routine that feels like you.</div></div></div>${renderPlanEmpty(planGroup(d))}`;
  const tasks = ts.length
    ? '<div class="task-list">' +
      ts.map((t, i) => taskHTML(t, c[t.id], i)).join("") +
      "</div>"
    : '<div class="empty"><b>A little space for possibility.</b>No plans scheduled yet.<br><button class="btn black" data-action="add" style="margin-top:14px">+ Add your first plan</button></div>';
  return (
    '<div class="hero daily-hero"><div><div class="eyebrow">' +
    esc(wd) +
    " / " +
    esc(fmtDate(d)) +
    '</div><h1 class="title">' +
    (isToday ? "Make today count." : "A day with intention.") +
    '</h1><div class="subtitle">Your pace. Your priorities. Your next small win.' +
    (k > dateKey(new Date()) ? " · Future completion is locked" : "") +
    '</div></div><div class="hero-actions"><button class="btn" data-focus-select>' +
    icon("spark") +
    ' Choose a focus</button><button class="btn black" data-action="pom">' +
    icon("play") +
    " Start focus</button></div></div>" +
    '<div class="overview"><section class="panel progress-panel" aria-label="Daily progress"><div class="progress-ring" style="--progress:' +
    m.pct +
    '%"><span class="bigpct">' +
    Math.round(m.pct) +
    '<small>%</small></span></div><div class="progress-copy"><div class="focus-meta">DAILY MOMENTUM</div><div class="progress-title">' +
    (m.pct === 100 ? "You made it happen." : "Every step counts.") +
    '</div><div class="count">' +
    m.done +
    " of " +
    m.total +
    ' plans completed</div><div class="bar"><i style="width:' +
    m.pct +
    '%"></i></div><div class="status">' +
    esc(m.status) +
    "</div></div></section>" +
    '<section class="panel focus-mini" aria-label="Focus timer"><div class="focus-meta">' +
    icon("pomodoro") +
    ' YOUR FOCUS SPACE</div><div class="focus-mini-line"><div class="timer" id="miniTimer">' +
    timerDisplay() +
    '</div><button class="focus-play" data-action="pomStart" aria-label="' +
    (runtime.focusTimer?.running ? "Pause focus timer" : "Start focus timer") +
    '">' +
    (runtime.focusTimer?.running ? "Ⅱ" : icon("play")) +
    '</button></div><span class="focus-caption">One thing at a time.</span></section>' +
    '<section class="panel insights-mini" aria-label="Today’s focus statistics"><div class="focus-meta">' +
    icon("spark") +
    ' TODAY’S SMALL WINS</div><div class="insights-values"><div><b>' +
    stats.sessions +
    "</b><span>sessions</span></div><div><b>" +
    stats.minutes +
    '<small>m</small></b><span>focused</span></div></div><span class="focus-caption">Make room for deep work.</span></section></div>' +
    renderExamPreview() +
    '<div class="section-head"><div><div class="eyebrow">' +
    esc(groupLabel(planGroup(d))) +
    '</div><h2>Your daily rhythm <span class="task-count">' +
    ts.length +
    '</span></h2></div><button class="btn" data-action="add">+ Add plan</button></div>' +
    tasks
  );
}

export function renderPlanEmpty(group, compact = false) {
  const first = !PLAN_GROUPS.some(
    ({ id }) => runtime.state.templates[id]?.length,
  );
  return `<section class="plan-onboarding ${compact ? "compact" : ""}" aria-label="Create your plan"><div class="plan-onboarding-copy"><span class="plan-onboarding-kicker">${first ? "YOUR FRESH START" : `${esc(groupLabel(group)).toUpperCase()} / A FRESH START`}</span><h2>${first ? "Create your plan." : `Shape your ${group === "Weekend" ? "weekend" : "weekdays"}.`}</h2><p>Make room for what matters. Add your first plan and build a daily routine around your goals.</p><button class="btn black" data-create-plan="${esc(group)}">${icon("spark")} Create your plan ${icon("arrow")}</button><span class="plan-onboarding-note">Start with one priority. You can change it anytime.</span></div><div class="plan-onboarding-art" aria-hidden="true"><div class="plan-paper"><div class="plan-paper-header"><span>YOUR DAILY PLAN</span>${icon("today")}</div><div class="plan-paper-title">A little room<br>for <em>possibility.</em></div><div class="plan-paper-line"><i>${icon("check")}</i><span></span></div><div class="plan-paper-line"><i></i><span></span></div><div class="plan-paper-line"><i></i><span></span></div><div class="plan-paper-footer">YOUR PACE. YOUR PRIORITIES.</div></div><span class="plan-art-spark">${icon("spark")}</span></div>${compact ? "" : `<ol class="plan-onboarding-steps"><li><span>01</span><div><strong>Choose a priority</strong><p>One meaningful task is enough to begin.</p></div></li><li><span>02</span><div><strong>Find your rhythm</strong><p>Set a routine for weekdays or weekends.</p></div></li><li><span>03</span><div><strong>See your progress</strong><p>Check off your plans as you go.</p></div></li></ol>`}</section>`;
}

export function renderExamQuick() {
  const quick = document.getElementById("quickExam"),
    exam = nextExam();
  quick.classList.toggle("active", runtime.page === "exams");
  quick.innerHTML = exam
    ? `<span class="exam-quick-dot"></span><span class="exam-quick-name">${esc(exam.name)}</span><strong>${examDaysLeft(exam.date) === 0 ? "Today" : `${examDaysLeft(exam.date)}d`}</strong>`
    : `<span class="exam-quick-dot"></span><span>Add exam date</span>`;
  quick.title = exam
    ? `${exam.name} - ${examDateLabel(exam.date)} (${examCountdownLabel(examDaysLeft(exam.date))})`
    : "Add an exam date";
}

export function renderExamPreview() {
  const exam = nextExam();
  return exam
    ? `<section class="exam-preview"><div class="exam-preview-main"><div class="exam-overline">NEXT EXAM</div><strong>${esc(exam.name)}</strong><span>${esc(examDateLabel(exam.date))}</span></div><div class="exam-preview-count"><b>${examDaysLeft(exam.date)}</b><span>${examDaysLeft(exam.date) === 0 ? "EXAM DAY" : "DAYS LEFT"}</span></div><button class="exam-preview-link" data-open-exams aria-label="View exam dates">View all <span aria-hidden="true">→</span></button></section>`
    : `<section class="exam-preview exam-preview-empty"><div class="exam-preview-main"><div class="exam-overline">EXAM DATES</div><strong>Keep your deadlines in sight</strong><span>Add a date to start the countdown.</span></div><button class="btn black" data-add-exam>Add exam date</button></section>`;
}

export function examCard(exam, featured = false) {
  const days = examDaysLeft(exam.date),
    past = days < 0,
    date = fromKey(exam.date),
    month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `<article class="exam-card ${featured ? "featured" : ""} ${past ? "past" : ""} ${days >= 0 && days <= 7 ? "soon" : ""}"><div class="exam-card-date"><span>${month}</span><b>${date.getDate()}</b><small>${date.getFullYear()}</small></div><div class="exam-card-main"><div class="exam-card-label">${past ? "PAST EXAM" : featured ? "NEXT UP" : "UPCOMING"}</div><h3>${esc(exam.name)}</h3><p>${esc(examDateLabel(exam.date))}</p>${exam.notes ? `<div class="exam-card-notes">${esc(exam.notes)}</div>` : ""}</div><div class="exam-card-count"><b>${Math.abs(days)}</b><span>${days === 0 ? "TODAY" : past ? (Math.abs(days) === 1 ? "DAY AGO" : "DAYS AGO") : days === 1 ? "DAY LEFT" : "DAYS LEFT"}</span></div><div class="exam-card-actions"><button type="button" class="tiny" data-edit-exam="${esc(exam.id)}">Edit</button><button type="button" class="tiny" data-delete-exam="${esc(exam.id)}">Delete</button></div></article>`;
}

export function renderExams() {
  const all = sortedExams(),
    upcoming = all.filter((x) => examDaysLeft(x.date) >= 0),
    past = all.filter((x) => examDaysLeft(x.date) < 0).reverse(),
    next = upcoming[0];
  return `<div class="exam-hero"><div><div class="eyebrow">EXAM DATES</div><h1>Know what comes next.</h1><p>Add your exams and see exactly how many days remain.</p></div><button class="btn black" data-add-exam>+ Add exam</button></div>${next ? `<div class="exam-feature"><div><span>NEXT EXAM</span><h2>${esc(next.name)}</h2><p>${esc(examDateLabel(next.date))}</p></div><div class="exam-feature-count"><b>${examDaysLeft(next.date)}</b><span>${examDaysLeft(next.date) === 0 ? "EXAM DAY" : "DAYS TO GO"}</span></div></div>` : ""}<div class="exam-list-head"><h2>Upcoming exams</h2><span>${upcoming.length} scheduled</span></div>${upcoming.length ? `<div class="exam-list">${upcoming.map((x, i) => examCard(x, i === 0)).join("")}</div>` : `<div class="exam-list-empty"><strong>No upcoming exams</strong><p>Add a date to start your countdown.</p><button class="btn black" data-add-exam>+ Add exam</button></div>`}${past.length ? `<div class="exam-list-head exam-past-head"><h2>Past exams</h2><span>${past.length} saved</span></div><div class="exam-list">${past.map((x) => examCard(x)).join("")}</div>` : ""}`;
}

export function taskHTML(t, done, i) {
  return `<div class="task ${done ? "done" : ""} ${t.study ? "study-task" : ""}" data-task-id="${esc(t.id)}"><input class="task-check" type="checkbox" ${done ? "checked" : ""} ${dateKey(runtime.selectedDate) > dateKey(new Date()) ? 'disabled title="Future days cannot be completed yet"' : ""} aria-label="Complete ${esc(t.name)}"><span class="task-index" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div class="task-main"><div class="task-name">${esc(t.name)}</div>${t.schedule ? `<div class="task-meta">${esc(t.schedule)}</div>` : ""}${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ""}</div>${t.study ? '<span class="task-category">Deep work</span>' : '<span class="task-category routine-category">Routine</span>'}<div class="task-actions"><button class="tiny" data-edit-task="${esc(t.id)}">Edit</button><button class="tiny" data-delete-task="${esc(t.id)}">Delete</button></div></div>`;
}

export function renderWeekly() {
  const monday = new Date(runtime.selectedDate);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = WEEKDAYS.map((name, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { name, date, m: metrics(date) };
  });
  const done = days.reduce((n, d) => n + d.m.done, 0),
    total = days.reduce((n, d) => n + d.m.total, 0),
    pct = total ? Math.round((done / total) * 100) : 0;
  if (!total)
    return `<div class="hero"><div><div class="eyebrow">YOUR WEEK, WITH INTENTION</div><h1 class="title">Week of ${esc(shortDate(monday))}</h1><div class="subtitle">Build a rhythm for the days ahead.</div></div></div>${renderPlanEmpty(planGroup(runtime.selectedDate))}`;
  return (
    '<div class="hero"><div><div class="eyebrow">YOUR WEEK, WITH INTENTION</div><h1 class="title">Week of ' +
    shortDate(monday) +
    '</h1><div class="subtitle">Seven days. Plenty of possibility.</div></div></div><div class="weekly">' +
    days
      .map(
        ({ name, date, m }) =>
          '<button type="button" class="day-card ' +
          (dateKey(date) === dateKey(new Date()) ? "today" : "") +
          '" data-open-date="' +
          dateKey(date) +
          '"><span class="day-name">' +
          name.slice(0, 3).toUpperCase() +
          '</span><div class="date">' +
          shortDate(date) +
          '</div><div class="num">' +
          m.done +
          " / " +
          m.total +
          '</div><div class="subtitle">' +
          m.pct.toFixed(1) +
          '%</div><div class="mini-bar"><i style="width:' +
          m.pct +
          '%"></i></div><div class="status-sm">' +
          m.status +
          "</div></button>",
      )
      .join("") +
    "</div>" +
    '<div class="week-insights"><section class="panel week-momentum"><div class="eyebrow">THE BIGGER PICTURE</div><h2>Your week, at a glance.</h2><div class="week-summary"><strong>' +
    pct +
    "<small>%</small></strong><p><b>" +
    done +
    " of " +
    total +
    ' plans completed</b><span>Every small win becomes momentum.</span></p></div><div class="week-chart" aria-label="Daily completion percentages">' +
    days
      .map(
        ({ name, m }) =>
          "<div><span>" +
          Math.round(m.pct) +
          '%</span><div class="week-chart-track"><i style="height:' +
          Math.max(3, m.pct) +
          '%"></i></div><b>' +
          name.slice(0, 3) +
          "</b></div>",
      )
      .join("") +
    '</div></section><section class="week-reflection"><span aria-hidden="true">✧</span><div class="eyebrow">A GENTLE REMINDER</div><h2>Consistency over<br> <em>intensity.</em></h2><p>You don’t need a perfect week. Just a clear next step, and a little space to begin again.</p><button class="btn" data-page="manage">Shape your routine ' +
    icon("arrow") +
    "</button></section></div>"
  );
}

export function renderAll() {
  if (!PLAN_GROUPS.some(({ id }) => runtime.state.templates[id]?.length))
    return `<div class="hero"><div><div class="eyebrow">ALL DAYS / YOUR JOURNEY</div><h1 class="title">Your progress begins here.</h1><div class="subtitle">Your timeline grows with every plan you complete.</div></div></div>${renderPlanEmpty(planGroup(runtime.selectedDate))}`;
  const start = new Date(runtime.selectedDate);
  start.setDate(start.getDate() - 30);
  const days = Array.from({ length: 61 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return (
    '<div class="hero"><div><div class="eyebrow">ALL DAYS / YOUR JOURNEY</div><h1 class="title">Daily Timeline</h1><div class="subtitle">A little progress, day after day. Your 61-day view.</div></div></div><div class="all-list">' +
    days
      .map((d, i) => {
        const m = metrics(d),
          c = compFor(dateKey(d)),
          today = dateKey(d) === dateKey(new Date());
        const month =
          i === 0 || d.getMonth() !== days[i - 1].getMonth()
            ? '<h2 class="timeline-month">' +
              d.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              }) +
              "</h2>"
            : "";
        return (
          month +
          '<article class="all-day ' +
          (today ? "today-timeline" : "") +
          '"><div class="all-head"><div class="timeline-date"><span>' +
          d.toLocaleDateString("en-US", { month: "short" }) +
          "</span><b>" +
          d.getDate() +
          '</b></div><div class="timeline-main"><h3>' +
          weekday(d) +
          (today ? ' <span class="timeline-today">TODAY</span>' : "") +
          "</h3><p>" +
          m.done +
          " / " +
          m.total +
          " completed · " +
          m.pct.toFixed(1) +
          '%</p></div><button class="tiny" data-open-date="' +
          dateKey(d) +
          '">Open day ' +
          icon("arrow") +
          '</button></div><details class="timeline-detail"><summary>View ' +
          tasksFor(d).length +
          " plans <span>" +
          esc(m.status) +
          '</span></summary><div class="all-tasks">' +
          tasksFor(d)
            .map(
              (t) =>
                '<div class="all-task ' +
                (c[t.id] ? "done" : "") +
                '"><span>' +
                (c[t.id] ? "✓" : "○") +
                "</span>" +
                esc(t.name) +
                (t.schedule ? " — " + esc(t.schedule) : "") +
                "</div>",
            )
            .join("") +
          "</div></details></article>"
        );
      })
      .join("") +
    "</div>"
  );
}

export function renderTable() {
  const group =
    PLAN_GROUPS.find((g) => g.id === runtime.tableGroup) || PLAN_GROUPS[0];
  // Keep only yesterday as the carryover day; this also shows the previous
  // month's final date when the calendar rolls over.
  const yesterday = new Date();
  yesterday.setHours(12, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const cursor = fromKey(
    dateKey(yesterday) < PLAN_START_DATE ? PLAN_START_DATE : dateKey(yesterday),
  );
  const filtered = [];
  let skip = runtime.tablePage * TABLE_DAYS;
  while (filtered.length < TABLE_DAYS) {
    if (planGroup(cursor) === group.id) {
      if (skip) skip--;
      else filtered.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const start = filtered[0],
    end = filtered[filtered.length - 1];
  const title =
    start.getFullYear() === end.getFullYear()
      ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${shortDate(end)}`
      : `${shortDate(start)} – ${shortDate(end)}`;
  return `<div class="sheet-intro"><div><div class="sheet-kicker">PLAN TABLE / ${esc(group.label.toUpperCase())}</div><h1>${esc(group.label)} schedule <span>30 days</span></h1></div><button class="btn black sheet-edit" data-edit-group="${group.id}">Edit plan</button></div><div class="sheet-controls"><div class="sheet-groups" role="group" aria-label="Choose plan group">${PLAN_GROUPS.map((g) => `<button type="button" class="${g.id === group.id ? "active" : ""}" data-table-group="${g.id}" aria-pressed="${g.id === group.id}">${g.label}</button>`).join("")}</div><div class="sheet-actions"><button class="btn" data-table-page="-1" aria-label="Previous period" ${runtime.tablePage === 0 ? "disabled" : ""}>←</button><span class="sheet-month">${esc(title)}</span><button class="btn" data-table-page="1" aria-label="Next period">→</button><button class="btn" data-table-start>Upcoming</button></div></div>${renderPlanTable(group, filtered)}`;
}

export function shortPlanName(name) {
  return SHORT_PLAN_NAMES[name] || name;
}

export function renderPlanTable(group, days) {
  const tasks = runtime.state.templates[group.id] || [];
  if (!tasks.length) return renderPlanEmpty(group.id);
  const headers = tasks
    .map(
      (task, i) =>
        `<th class="${task.study ? "study-column" : ""}" scope="col" title="${esc(task.name)}${task.schedule ? ` · ${esc(task.schedule)}` : ""}" aria-label="${esc(task.name)}"><span class="sheet-number">${String(i + 1).padStart(2, "0")}</span><span class="sheet-label">${esc(shortPlanName(task.name))}</span></th>`,
    )
    .join("");
  const rows = days
    .map((d) => {
      const key = dateKey(d),
        today = key === dateKey(new Date());
      return `<tr class="${today ? "today-row" : ""}"><td class="sheet-day">${weekday(d)}</td><td class="sheet-date" title="${esc(fmtDate(d))}">${d.getDate()}</td>${tasks.map((task) => renderPlanCell(key, task)).join("")}</tr>`;
    })
    .join("");
  return `<section class="sheet-wrap" aria-label="${group.label} plan table"><table class="sheet-table"><thead><tr><th class="sheet-day" scope="col">Day</th><th class="sheet-date" scope="col">Date</th>${headers}</tr></thead><tbody>${rows}</tbody></table></section>`;
}

export function renderPlanCell(key, task) {
  const future = key > dateKey(new Date()),
    done = !!runtime.state.completions[key]?.[task.id];
  const kind = future
    ? "future"
    : done
      ? "done"
      : key < dateKey(new Date())
        ? "missed"
        : "today";
  const label = future
    ? "Future day"
    : done
      ? "Completed"
      : kind === "missed"
        ? "Not completed"
        : "Mark completed";
  return `<td class="sheet-cell ${kind} ${task.study ? "study-column" : ""}" data-label="${esc(task.name)}"><input class="sheet-check" type="checkbox" data-complete-date="${key}" data-complete-task="${esc(task.id)}" aria-label="${esc(task.name)} — ${key}: ${label}" ${done && !future ? "checked" : ""} ${future ? "disabled" : ""}></td>`;
}

export function renderManage() {
  const ts = runtime.state.templates[runtime.manageDay] || [];
  const group =
    PLAN_GROUPS.find((x) => x.id === runtime.manageDay) || PLAN_GROUPS[0];
  if (!ts.length)
    return `<div class="hero"><div><div class="eyebrow">MANAGE PLANS</div><h1 class="title">Your routine, your way.</h1><div class="subtitle">Create a shared routine for weekdays or weekends.</div></div></div><div class="sheet-groups" role="group" aria-label="Choose plan group">${PLAN_GROUPS.map((g) => `<button class="${g.id === runtime.manageDay ? "active" : ""}" data-manage-day="${g.id}" aria-pressed="${g.id === runtime.manageDay}">${g.label}</button>`).join("")}</div>${renderPlanEmpty(group.id)}`;
  return `<div class="hero"><div><div class="eyebrow">MANAGE PLANS</div><h1 class="title">${group.label} plan</h1><div class="subtitle">${group.detail}. Changes appear in upcoming weeks automatically.</div></div><button class="btn black" data-action="add">+ Add plan</button></div><div class="plan-summary"><span class="group-badge">${group.label}</span><span><strong>${ts.length}</strong> plans</span><span>Plan order also sets the table column order.</span></div><p class="manage-hint">Drag to reorder (use the ⋮⋮ handle on touch screens), or use ↑ and ↓.</p><div class="manage-grid"><div class="weekday-list">${PLAN_GROUPS.map((g) => `<button class="${g.id === runtime.manageDay ? "active" : ""}" data-manage-day="${g.id}">${g.label}</button>`).join("")}</div><div class="panel" style="padding:0 18px">${ts.length ? ts.map((t, i) => `<div class="manage-item" data-drag="${esc(t.id)}"><div class="idx">${String(i + 1).padStart(2, "0")}</div><button class="drag-handle" type="button" aria-label="Drag ${esc(t.name)} to reorder" title="Drag to reorder">⋮⋮</button><div><b>${esc(t.name)}</b>${t.schedule ? `<div class="task-meta">${esc(t.schedule)}</div>` : ""}${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ""}</div><div class="manage-actions"><button class="tiny" data-edit-task="${esc(t.id)}">Edit</button><button class="tiny" data-up="${esc(t.id)}" aria-label="Move ${esc(t.name)} up" ${i === 0 ? "disabled" : ""}>↑</button><button class="tiny" data-down="${esc(t.id)}" aria-label="Move ${esc(t.name)} down" ${i === ts.length - 1 ? "disabled" : ""}>↓</button><button class="tiny" data-delete-task="${esc(t.id)}">Delete</button></div></div>`).join("") : `<div class="empty" style="margin:18px 0">No plans yet.<br><button class="btn black" data-action="add" style="margin-top:12px">+ Add plan</button></div>`}</div></div>`;
}

export function timerDisplay() {
  if (!runtime.focusTimer) return "25:00";
  let s = Math.max(0, Math.ceil(runtime.focusTimer.remaining / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function renderStudyPanel() {
  ensureStudyFlow();
  const group = planGroup(new Date()),
    tasks = runtime.state.templates[group] || [],
    selected = studyItemsForToday();
  const rows = tasks
    .map((task) => {
      const setting = studySetting(group, task);
      return `<div class="study-config-row"><label><input type="checkbox" data-study-enabled="${esc(task.id)}" ${setting.enabled ? "checked" : ""}><span>${esc(task.name)}</span></label><div><input type="number" min="1" max="600" step="1" value="${setting.minutes}" data-study-minutes="${esc(task.id)}" aria-label="Minutes for ${esc(task.name)}"><span>min</span></div></div>`;
    })
    .join("");
  return `<section class="study-panel"><div class="study-panel-top"><div><div class="study-eyebrow">AUTOMATIC STUDY FLOW · ${esc(groupLabel(group))}</div><h2>Today's study sequence</h2><p>${selected.length} selected tasks · Study time includes 5 min rest for short tasks or 10 min for longer tasks. The flow continues automatically.</p></div><button class="btn black" data-study-start>${runtime.studyTimer ? "Restart flow" : "Start Study Flow"}</button></div><details class="study-config"><summary>Choose tasks and set minutes</summary><div class="study-config-list">${rows}</div></details></section>`;
}

export function renderPom() {
  const f = runtime.focusTimer,
    blocks = runtime.state.pom.blocks;
  const mode = f ? f.mode : "work",
    block = f ? f.block : 1,
    totalBlocks = f ? f.totalBlocks : blocks.reduce((a, b) => a + b.repeats, 0);
  return `<div class="hero"><div><div class="eyebrow">POMODORO</div><h1 class="title">Focus Timer</h1><div class="subtitle">${runtime.state.pom.loop ? "Continuous sequence enabled" : "Stops after final block"}</div></div></div>
 ${renderStudyPanel()}<div class="pom-wrap"><div class="panel timer-panel"><div class="mode">${mode.toUpperCase()}</div><div class="timer" id="mainTimer">${timerDisplay()}</div><div class="timer-sub">Current block ${block} / ${totalBlocks}${runtime.state.pom.selectedTask ? ` • ${esc(runtime.state.pom.selectedTask)}` : ""}</div><div class="brown-pill" style="margin:14px auto 0"><i class="brown-dot ${brownNoiseLive() ? "live" : ""}"></i>Brown Noise ${runtime.state.pom.brownNoise ? "ON" : "OFF"} • ${runtime.state.pom.brownVolume}%</div><div class="timer-controls">${f && f.running ? `<button class="btn black" data-pom="pause">PAUSE</button>` : `<button class="btn black" data-pom="start">${f && f.paused ? "RESUME" : "START"}</button>`}<button class="btn" data-pom="reset">RESET</button></div></div>
 <div class="panel sequence-panel"><div class="section-head" style="margin-top:0"><h2>SEQUENCE</h2><button class="tiny" data-add-block>+ Add Block</button></div>${blocks.map((b, i) => `<div class="sequence-row"><div class="seq-top"><div class="seq-title">Block ${i + 1}</div><button class="tiny" data-remove-block="${i}">Delete</button></div><div class="seq-values"><label>Work<input type="number" min="1" max="600" value="${b.work}" data-seq="${i}" data-key="work"></label><label>Rest<input type="number" min="0" max="600" value="${b.rest}" data-seq="${i}" data-key="rest"></label><label>Repeats<input type="number" min="1" max="100" value="${b.repeats}" data-seq="${i}" data-key="repeats"></label></div></div>`).join("")}
 <div class="toggle-row"><span>Loop Sequence</span><button class="switch ${runtime.state.pom.loop ? "on" : ""}" data-toggle="loop" aria-label="Toggle loop"><i></i></button></div><div class="toggle-row"><span>Completion Sound</span><button class="switch ${runtime.state.pom.sound ? "on" : ""}" data-toggle="sound"><i></i></button></div><div class="toggle-row"><span>Notifications</span><button class="switch ${runtime.state.pom.notifications ? "on" : ""}" data-toggle="notifications"><i></i></button></div>
<div class="brown-noise"><div class="brown-head"><div><div class="brown-title">Brown Noise</div><div class="brown-sub">Plays only during Work sessions.</div></div><span class="brown-pill"><i class="brown-dot ${brownNoiseLive() ? "live" : ""}"></i>${brownNoiseLive() ? "Playing" : "Off"}</span><button class="switch ${runtime.state.pom.brownNoise ? "on" : ""}" data-toggle="brownNoise" aria-label="Toggle Brown Noise"><i></i></button></div>
<div class="volume-row"><input id="brownVolume" type="range" min="0" max="100" step="1" value="${runtime.state.pom.brownVolume}" aria-label="Brown Noise volume"><div class="volume-value" id="brownVolumeValue">${runtime.state.pom.brownVolume}%</div></div></div>
</div></div>`;
}

export function renderSettings() {
  return `<div class="hero"><div><div class="eyebrow">SETTINGS</div><h1 class="title">Preferences</h1><div class="subtitle">Your preferences, account and backups.</div></div></div><div class="settings-grid">${accountSection()}<div class="panel setting-section"><h3>Theme</h3><p>A calm canvas, forest tones, and a little room to breathe.</p><div class="theme-preview" aria-label="Forest and Linen color palette"><span><i style="background:#10251d"></i>Forest</span><span><i style="background:#bbd5a0"></i>Sage</span><span><i style="background:#f5f6f0"></i>Linen</span></div><div class="toggle-row" style="border:0;padding:8px 0"><span>Forest & Linen</span><b>ON</b></div></div><div class="panel setting-section"><h3>Pomodoro</h3><p>Defaults can be adjusted directly in the Pomodoro sequence.</p>${settingToggle("Sound", "sound", runtime.state.prefs.sound)}${settingToggle("Notifications", "notifications", runtime.state.prefs.notifications)}${settingToggle("Pomodoro Loop", "loop", runtime.state.prefs.loop)}${settingToggle("Brown Noise During Work", "brownNoise", runtime.state.pom.brownNoise)}</div><div class="panel setting-section"><h3>Data</h3><p>Export everything as JSON or restore a previous export.</p><div class="data-actions"><button class="btn black" data-data="export">Export Data</button><button class="btn" data-data="import">Import Data</button><button class="btn" data-data="reset">Reset Data</button></div></div><div class="panel setting-section"><h3>Keyboard shortcuts</h3><p>N next day • P previous day • T today • Space pause/resume Pomodoro • R reset Pomodoro</p></div></div>`;
}

export function settingToggle(label, key, val) {
  return `<div class="toggle-row"><span>${label}</span><button class="switch ${val ? "on" : ""}" data-setting-toggle="${key}"><i></i></button></div>`;
}
