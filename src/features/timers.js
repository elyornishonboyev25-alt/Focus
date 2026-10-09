import { loadJSON, saveJSON } from "../core/storage.js";
import { KEYS } from "../../shared/schema.js";
import { destroyBrownNoise, syncBrownNoise } from "./audio.js";
import { toast } from "../core/navigation.js";
import { render, timerDisplay } from "./views.js";
import {
  dateKey,
  ensureTodayStats,
  esc,
  persist,
  studyItemsForToday,
} from "../core/model.js";
import { runtime } from "../core/runtime.js";

export function sequenceFlat() {
  const out = [];
  runtime.state.pom.blocks.forEach((b, bi) => {
    const work = Math.max(1, Math.min(600, Number(b.work) || 25)) * 60,
      rest = Math.max(0, Math.min(600, Number(b.rest) || 0)) * 60,
      repeats = Math.max(1, Math.min(100, Number(b.repeats) || 1));
    for (let r = 0; r < repeats; r++)
      out.push({
        work,
        rest,
        block: out.length + 1,
        group: bi + 1,
        repeat: r + 1,
      });
  });
  return out;
}

export function saveActiveTimers() {
  saveJSON(KEYS.activePom, runtime.focusTimer);
  saveJSON(KEYS.activeStudy, runtime.studyTimer);
}

export function restoreActiveTimers() {
  const pom = loadJSON(KEYS.activePom, null);
  if (
    pom &&
    Array.isArray(pom.sequence) &&
    pom.sequence.length &&
    pom.sequence.length <= 10000 &&
    pom.sequence.every(
      (x) =>
        Number.isFinite(x.work) &&
        x.work > 0 &&
        Number.isFinite(x.rest) &&
        x.rest >= 0,
    ) &&
    Number.isInteger(pom.index) &&
    pom.index >= 0 &&
    pom.index < pom.sequence.length &&
    ["work", "rest"].includes(pom.mode)
  ) {
    runtime.focusTimer = pom;
    if (runtime.focusTimer.running) {
      syncPom(Date.now(), true);
      if (runtime.focusTimer.running) {
        clearInterval(startPom.iv);
        startPom.iv = setInterval(tick, 200);
      }
    }
  }
  const study = loadJSON(KEYS.activeStudy, null);
  if (
    study &&
    Array.isArray(study.items) &&
    study.items.length &&
    study.items.length <= 1000 &&
    study.items.every(
      (x) =>
        typeof x.name === "string" &&
        Number.isFinite(x.minutes) &&
        x.minutes > 0 &&
        Number.isFinite(x.workMinutes) &&
        x.workMinutes > 0 &&
        Number.isFinite(x.restMinutes) &&
        x.restMinutes >= 0 &&
        x.workMinutes + x.restMinutes === x.minutes,
    ) &&
    Number.isInteger(study.index) &&
    study.index >= 0 &&
    study.index < study.items.length &&
    ["work", "rest"].includes(study.phase)
  ) {
    runtime.studyTimer = study;
    if (runtime.studyTimer.running) {
      tickStudy(true);
      if (runtime.studyTimer.running) {
        clearInterval(runtime.studyInterval);
        runtime.studyInterval = setInterval(tickStudy, 250);
      }
    }
  }
}

export function startPom() {
  if (runtime.focusTimer?.running) {
    syncPom();
    syncBrownNoise();
    return;
  }
  const seq = sequenceFlat();
  if (!seq.length) {
    toast("Add a Pomodoro block first.");
    return;
  }
  if (!runtime.focusTimer || runtime.focusTimer.finished) {
    runtime.focusTimer = {
      sequence: seq,
      index: 0,
      mode: "work",
      remaining: seq[0].work * 1000,
      endAt: Date.now() + seq[0].work * 1000,
      running: true,
      paused: false,
      finished: false,
      totalBlocks: seq.length,
      block: 1,
    };
  } else {
    runtime.focusTimer.running = true;
    runtime.focusTimer.paused = false;
    runtime.focusTimer.endAt =
      Date.now() + Math.max(0, runtime.focusTimer.remaining);
  }
  saveActiveTimers();
  clearInterval(startPom.iv);
  startPom.iv = setInterval(tick, 200);
  render();
  syncBrownNoise();
}

export function tick() {
  if (!runtime.focusTimer || !runtime.focusTimer.running) return;
  if (!syncPom()) updateTimerDOM();
}

export function advanceWork(deadline) {
  const seq = runtime.focusTimer.sequence;
  runtime.focusTimer.index++;
  if (runtime.focusTimer.index >= seq.length) {
    if (runtime.state.pom.loop) runtime.focusTimer.index = 0;
    else {
      runtime.focusTimer.running = false;
      runtime.focusTimer.paused = false;
      runtime.focusTimer.finished = true;
      runtime.focusTimer.remaining = 0;
      runtime.focusTimer.endAt = null;
      clearInterval(startPom.iv);
      return;
    }
  }
  runtime.focusTimer.mode = "work";
  runtime.focusTimer.block = runtime.focusTimer.index + 1;
  runtime.focusTimer.endAt =
    deadline + seq[runtime.focusTimer.index].work * 1000;
}

export function syncPom(now = Date.now(), silent = false) {
  if (!runtime.focusTimer?.running) return false;
  const seq = runtime.focusTimer.sequence;
  if (!Number.isFinite(runtime.focusTimer.endAt))
    runtime.focusTimer.endAt =
      now + Math.max(0, runtime.focusTimer.remaining || 0);
  let changed = false,
    message = "";
  const cycle = seq.reduce((total, x) => total + (x.work + x.rest) * 1000, 0);
  if (
    runtime.state.pom.loop &&
    cycle > 0 &&
    now - runtime.focusTimer.endAt >= cycle
  ) {
    runtime.focusTimer.endAt +=
      Math.floor((now - runtime.focusTimer.endAt) / cycle) * cycle;
    changed = true;
  }
  let guard = seq.length * 2 + 3;
  while (
    runtime.focusTimer.running &&
    runtime.focusTimer.endAt <= now &&
    guard-- > 0
  ) {
    const deadline = runtime.focusTimer.endAt,
      cur = seq[runtime.focusTimer.index];
    if (runtime.focusTimer.mode === "work") {
      if (!silent) recordFocus(cur.work / 60);
      if (cur.rest > 0) {
        runtime.focusTimer.mode = "rest";
        runtime.focusTimer.endAt = deadline + cur.rest * 1000;
        message = "Work session completed - Rest begins.";
      } else {
        advanceWork(deadline);
        message = runtime.focusTimer.running
          ? "Work session completed - Next work session begins."
          : "Pomodoro sequence complete.";
      }
    } else {
      advanceWork(deadline);
      message = runtime.focusTimer.running
        ? "Rest completed - Work session begins."
        : "Pomodoro sequence complete.";
    }
    changed = true;
  }
  runtime.focusTimer.remaining = runtime.focusTimer.running
    ? Math.max(0, runtime.focusTimer.endAt - now)
    : 0;
  if (changed) {
    saveActiveTimers();
    if (!silent) {
      destroyBrownNoise();
      sound();
      if (message) notify(message);
      if (runtime.focusTimer.finished) toast(message);
      render();
      syncBrownNoise();
    }
  }
  return changed;
}

export function pausePom() {
  if (!runtime.focusTimer?.running) return;
  syncPom(Date.now(), true);
  if (!runtime.focusTimer.running) {
    render();
    return;
  }
  runtime.focusTimer.remaining = Math.max(
    0,
    runtime.focusTimer.endAt - Date.now(),
  );
  runtime.focusTimer.running = false;
  runtime.focusTimer.paused = true;
  runtime.focusTimer.endAt = null;
  clearInterval(startPom.iv);
  destroyBrownNoise();
  saveActiveTimers();
  render();
}

export function resetPom() {
  clearInterval(startPom.iv);
  runtime.focusTimer = null;
  destroyBrownNoise();
  saveActiveTimers();
  render();
}

export function recordFocus(minutes) {
  ensureTodayStats();
  const k = dateKey(new Date());
  runtime.state.stats.today.sessions++;
  runtime.state.stats.today.minutes += minutes;
  runtime.state.stats.today.blocks++;
  runtime.state.stats.totalSessions++;
  runtime.state.stats.totalMinutes += minutes;
  runtime.state.stats.totalBlocks++;
  const prev = runtime.state.stats.lastFocusDate;
  if (prev !== k) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    runtime.state.stats.streak =
      prev === dateKey(y) ? runtime.state.stats.streak + 1 : 1;
    runtime.state.stats.lastFocusDate = k;
  }
  persist();
}

export function updateTimerDOM() {
  const a = document.getElementById("mainTimer"),
    b = document.getElementById("miniTimer");
  if (a) a.textContent = timerDisplay();
  if (b) b.textContent = timerDisplay();
}

export function sound() {
  if (!runtime.state.pom.sound) return;
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    const c = new A(),
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.27);
  } catch {}
}

export function notify(msg) {
  if (runtime.state.pom.notifications && "Notification" in window) {
    if (Notification.permission === "granted") new Notification(msg);
    else if (Notification.permission !== "denied")
      Notification.requestPermission()
        .then((x) => {
          if (x === "granted") new Notification(msg);
        })
        .catch(() => {});
  }
}

export function studyTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function studyChime() {
  try {
    if (!runtime.studyAudio)
      runtime.studyAudio = new (
        window.AudioContext || window.webkitAudioContext
      )();
    runtime.studyAudio.resume();
    for (const [i, freq] of [740, 988].entries()) {
      const at = runtime.studyAudio.currentTime + i * 0.19,
        o = runtime.studyAudio.createOscillator(),
        g = runtime.studyAudio.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.12, at + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      o.connect(g).connect(runtime.studyAudio.destination);
      o.start(at);
      o.stop(at + 0.2);
    }
  } catch {}
}

export function startStudyFlow() {
  const items = studyItemsForToday();
  if (!items.length) {
    toast("Select at least one study task first.");
    return;
  }
  clearInterval(runtime.studyInterval);
  const duration = items[0].workMinutes * 60000;
  runtime.studyTimer = {
    items,
    index: 0,
    phase: "work",
    remaining: duration,
    endAt: Date.now() + duration,
    running: true,
    finished: false,
    minimized: false,
  };
  saveActiveTimers();
  try {
    if (!runtime.studyAudio)
      runtime.studyAudio = new (
        window.AudioContext || window.webkitAudioContext
      )();
    runtime.studyAudio.resume();
  } catch {}
  runtime.studyInterval = setInterval(tickStudy, 250);
  render();
  toast(`Study Flow started: ${items[0].name}`);
}

export function tickStudy(silent = false) {
  if (!runtime.studyTimer?.running) return;
  const now = Date.now();
  if (!Number.isFinite(runtime.studyTimer.endAt))
    runtime.studyTimer.endAt =
      now + Math.max(0, runtime.studyTimer.remaining || 0);
  let message = "",
    changed = false,
    guard = runtime.studyTimer.items.length * 2 + 1;
  while (
    runtime.studyTimer.running &&
    runtime.studyTimer.endAt <= now &&
    guard-- > 0
  ) {
    message = advanceStudy(runtime.studyTimer.endAt);
    changed = true;
  }
  runtime.studyTimer.remaining = runtime.studyTimer.running
    ? Math.max(0, runtime.studyTimer.endAt - now)
    : 0;
  if (changed) {
    saveActiveTimers();
    if (!silent) {
      studyChime();
      if (message) {
        toast(message);
        notify(`Study Flow: ${message}`);
      }
      renderStudyWidget();
    }
  } else updateStudyWidget();
}

export function advanceStudy(deadline = Date.now()) {
  if (!runtime.studyTimer || runtime.studyTimer.finished) return "";
  const current = runtime.studyTimer.items[runtime.studyTimer.index];
  if (runtime.studyTimer.phase === "work" && current.restMinutes > 0) {
    runtime.studyTimer.phase = "rest";
    runtime.studyTimer.endAt = deadline + current.restMinutes * 60000;
    return `Rest time: ${current.restMinutes} min after ${current.name}`;
  }
  runtime.studyTimer.index++;
  if (runtime.studyTimer.index >= runtime.studyTimer.items.length) {
    runtime.studyTimer.index = runtime.studyTimer.items.length - 1;
    runtime.studyTimer.remaining = 0;
    runtime.studyTimer.running = false;
    runtime.studyTimer.finished = true;
    runtime.studyTimer.endAt = null;
    clearInterval(runtime.studyInterval);
    return "Study Flow complete.";
  }
  runtime.studyTimer.phase = "work";
  runtime.studyTimer.endAt =
    deadline +
    runtime.studyTimer.items[runtime.studyTimer.index].workMinutes * 60000;
  return `Next: ${runtime.studyTimer.items[runtime.studyTimer.index].name}`;
}

export function skipStudy() {
  if (!runtime.studyTimer || runtime.studyTimer.finished) return;
  const message = advanceStudy(Date.now());
  runtime.studyTimer.remaining = runtime.studyTimer.running
    ? Math.max(0, runtime.studyTimer.endAt - Date.now())
    : 0;
  saveActiveTimers();
  studyChime();
  if (message) {
    toast(message);
    notify(`Study Flow: ${message}`);
  }
  renderStudyWidget();
}

export function pauseStudy() {
  if (!runtime.studyTimer?.running) return;
  tickStudy(true);
  if (!runtime.studyTimer.running) {
    renderStudyWidget();
    return;
  }
  runtime.studyTimer.remaining = Math.max(
    0,
    runtime.studyTimer.endAt - Date.now(),
  );
  runtime.studyTimer.running = false;
  runtime.studyTimer.endAt = null;
  clearInterval(runtime.studyInterval);
  saveActiveTimers();
  renderStudyWidget();
}

export function resumeStudy() {
  if (!runtime.studyTimer || runtime.studyTimer.finished) return;
  runtime.studyTimer.running = true;
  runtime.studyTimer.endAt =
    Date.now() + Math.max(0, runtime.studyTimer.remaining);
  saveActiveTimers();
  clearInterval(runtime.studyInterval);
  runtime.studyInterval = setInterval(tickStudy, 250);
  renderStudyWidget();
}

export function closeStudy() {
  clearInterval(runtime.studyInterval);
  runtime.studyTimer = null;
  saveActiveTimers();
  renderStudyWidget();
  if (runtime.page === "pomodoro") render();
}

export function updateStudyWidget() {
  if (!runtime.studyTimer) return;
  const time = document.querySelector("#studyWidget .study-widget-time"),
    bar = document.querySelector("#studyWidget .study-widget-progress i");
  if (time) time.textContent = studyTime(runtime.studyTimer.remaining);
  const peek = document.querySelector("#studyWidget .study-widget-peek");
  if (peek) peek.textContent = studyTime(runtime.studyTimer.remaining);
  if (bar) {
    const item = runtime.studyTimer.items[runtime.studyTimer.index],
      duration =
        (runtime.studyTimer.phase === "rest"
          ? item.restMinutes
          : item.workMinutes) * 60000;
    bar.style.width = `${Math.max(0, Math.min(100, (1 - runtime.studyTimer.remaining / duration) * 100))}%`;
  }
}

export function renderStudyWidget() {
  const host = document.getElementById("studyWidget");
  if (!host) return;
  document.body.classList.toggle("study-active", !!runtime.studyTimer);
  if (!runtime.studyTimer) {
    host.innerHTML = "";
    return;
  }
  const item = runtime.studyTimer.items[runtime.studyTimer.index],
    next = runtime.studyTimer.items[runtime.studyTimer.index + 1],
    resting = runtime.studyTimer.phase === "rest";
  host.innerHTML = `<aside class="study-widget ${runtime.studyTimer.minimized ? "minimized" : ""} ${resting ? "resting" : ""}" aria-label="Study Flow timer"><div class="study-widget-head"><span>${runtime.studyTimer.finished ? "COMPLETE" : resting ? "REST TIME" : "FOCUS TIME"} · ${runtime.studyTimer.index + 1}/${runtime.studyTimer.items.length}</span><span class="study-widget-peek">${studyTime(runtime.studyTimer.remaining)}</span><div><button type="button" data-study-minimize aria-label="${runtime.studyTimer.minimized ? "Expand" : "Minimize"} Study Flow">${runtime.studyTimer.minimized ? "▢" : "−"}</button><button type="button" data-study-close aria-label="Close Study Flow">×</button></div></div><div class="study-widget-body"><div class="study-widget-task" title="${esc(item.name)}">${resting ? "Rest after " : ""}${esc(item.name)}</div><div class="study-widget-time">${studyTime(runtime.studyTimer.remaining)}</div><div class="study-widget-progress"><i></i></div><div class="study-widget-next">${runtime.studyTimer.finished ? "Sequence complete" : resting ? (next ? `Next: ${esc(next.name)}` : "Final rest") : item.restMinutes ? `Rest: ${item.restMinutes} min${next ? ` · Then ${esc(next.name)}` : ""}` : next ? `Next: ${esc(next.name)}` : "Final task"}</div><div class="study-widget-actions">${runtime.studyTimer.finished ? "" : `<button type="button" data-study-toggle>${runtime.studyTimer.running ? "Pause" : "Resume"}</button><button type="button" data-study-skip>Skip phase →</button>`}</div></div></aside>`;
  host.querySelector("[data-study-minimize]").onclick = () => {
    runtime.studyTimer.minimized = !runtime.studyTimer.minimized;
    saveActiveTimers();
    renderStudyWidget();
  };
  host.querySelector("[data-study-close]").onclick = closeStudy;
  host
    .querySelector("[data-study-toggle]")
    ?.addEventListener("click", () =>
      runtime.studyTimer.running ? pauseStudy() : resumeStudy(),
    );
  host.querySelector("[data-study-skip]")?.addEventListener("click", skipStudy);
  updateStudyWidget();
}
