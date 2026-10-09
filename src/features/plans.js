import {
  esc,
  examDateLabel,
  groupLabel,
  planGroup,
  validExamDate,
} from "../core/model.js";
import { toast } from "../core/navigation.js";
import { saveJSON } from "../core/storage.js";
import { KEYS } from "../../shared/schema.js";
import { render } from "./views.js";
import { runtime } from "../core/runtime.js";

export function openPlanModal(
  task = null,
  day = runtime.page === "manage"
    ? runtime.manageDay
    : planGroup(runtime.selectedDate),
) {
  const isEdit = !!task;
  const first = !runtime.state.templates[day]?.length;
  document.getElementById("modal").innerHTML =
    `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="planModalTitle"><h2 id="planModalTitle">${isEdit ? "Edit plan" : first ? "Create your plan" : "Add plan"} — ${groupLabel(day)}</h2><p class="modal-scope">This plan appears every ${day === "Weekdays" ? "Monday through Friday" : "Saturday and Sunday"}. You can edit it anytime.</p><label for="mName">Plan name</label><input id="mName" class="field" value="${esc(task?.name || "")}" placeholder="For example: Read for 20 minutes" maxlength="160"><label for="mSchedule">Time / schedule</label><input id="mSchedule" class="field" value="${esc(task?.schedule || "")}" placeholder="Optional" maxlength="120"><label for="mNotes">Notes</label><textarea id="mNotes" class="field" rows="3" placeholder="Optional">${esc(task?.notes || "")}</textarea><label class="modal-study"><input id="mStudy" type="checkbox" ${task?.study ? "checked" : ""}> Highlight as a study task in the table</label><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn black" data-save-plan>${isEdit ? "Save changes" : first ? "Create plan" : "Add plan"}</button></div></div>`;
  const modal = document.getElementById("modal");
  modal.classList.add("show");
  document.getElementById("mName").focus();
  modal.querySelector("[data-save-plan]").onclick = () => {
    const name = document.getElementById("mName").value.trim();
    if (!name) {
      toast("Task Name is required.");
      return;
    }
    const schedule = document.getElementById("mSchedule").value.trim(),
      notes = document.getElementById("mNotes").value.trim(),
      study = document.getElementById("mStudy").checked;
    if (isEdit) {
      Object.assign(task, { name, schedule, notes, study });
    } else {
      (runtime.state.templates[day] ||= []).push({
        id: "t_" + Date.now() + "_" + Math.random().toString(36).slice(2),
        name,
        schedule,
        notes,
        study,
      });
    }
    saveJSON(KEYS.templates, runtime.state.templates);
    closeModal();
    render();
    toast(isEdit ? "Plan updated." : "Plan added.");
  };
}

export function closeModal() {
  document.getElementById("modal").classList.remove("show");
  document.getElementById("modal").innerHTML = "";
}

export function openExamModal(exam = null) {
  const isEdit = !!exam,
    modal = document.getElementById("modal");
  modal.innerHTML = `<div class="modal exam-modal" role="dialog" aria-modal="true" aria-labelledby="examModalTitle"><div class="exam-modal-kicker">EXAM DATE</div><h2 id="examModalTitle">${isEdit ? "Edit exam" : "Add an exam"}</h2><p>Give this date a name. The countdown updates automatically each day.</p><label for="examName">Exam name</label><input id="examName" class="field" maxlength="120" placeholder="For example: IELTS" value="${esc(exam?.name || "")}"><label for="examDate">Exam date</label><input id="examDate" class="field" type="date" value="${esc(exam?.date || "")}"><label for="examNotes">Notes <span>(optional)</span></label><textarea id="examNotes" class="field" rows="3" maxlength="300" placeholder="Location, target score, or anything to remember">${esc(exam?.notes || "")}</textarea><div class="modal-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn black" type="button" data-save-exam>${isEdit ? "Save changes" : "Add exam"}</button></div></div>`;
  modal.classList.add("show");
  document.getElementById("examName").focus();
  const save = modal.querySelector("[data-save-exam]");
  save.onclick = () => {
    const name = document.getElementById("examName").value.trim(),
      date = document.getElementById("examDate").value,
      notes = document.getElementById("examNotes").value.trim();
    if (!name) {
      document.getElementById("examName").focus();
      toast("Enter an exam name.");
      return;
    }
    if (!validExamDate(date)) {
      document.getElementById("examDate").focus();
      toast("Choose a valid exam date.");
      return;
    }
    if (
      runtime.state.exams.some(
        (x) =>
          x.id !== exam?.id &&
          x.date === date &&
          String(x.name || "")
            .trim()
            .toLowerCase() === name.toLowerCase(),
      )
    ) {
      toast("This exam is already in your list.");
      return;
    }
    if (isEdit) Object.assign(exam, { name, date, notes });
    else
      runtime.state.exams.push({
        id: `exam_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        date,
        notes,
      });
    saveJSON(KEYS.exams, runtime.state.exams);
    closeModal();
    render();
    toast(isEdit ? "Exam updated." : "Exam added.");
  };
  modal.querySelectorAll("input").forEach((input) =>
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save.click();
      }
    }),
  );
}

export function confirmDeleteExam(exam) {
  const modal = document.getElementById("modal");
  modal.innerHTML = `<div class="modal exam-modal" role="dialog" aria-modal="true" aria-labelledby="examDeleteTitle"><div class="exam-modal-kicker">EXAM DATE</div><h2 id="examDeleteTitle">Delete this exam?</h2><p><strong>${esc(exam.name)}</strong> on ${esc(examDateLabel(exam.date))} will be removed from your countdowns.</p><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn black" data-confirm-exam-delete>Delete exam</button></div></div>`;
  modal.classList.add("show");
  modal.querySelector("[data-confirm-exam-delete]").onclick = () => {
    runtime.state.exams = runtime.state.exams.filter((x) => x.id !== exam.id);
    saveJSON(KEYS.exams, runtime.state.exams);
    closeModal();
    render();
    toast("Exam deleted.");
  };
}

export function confirmDelete(
  task,
  day = runtime.page === "manage"
    ? runtime.manageDay
    : planGroup(runtime.selectedDate),
) {
  document.getElementById("modal").innerHTML =
    `<div class="modal" role="dialog" aria-modal="true"><h2>Delete this plan?</h2><p style="color:#666;font-size:13px;line-height:1.6"><b>${esc(task.name)}</b> will be removed from the ${groupLabel(day)} plan. Past completion data remains stored.</p><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn black" data-confirm-delete>Delete</button></div></div>`;
  document.getElementById("modal").classList.add("show");
  document.querySelector("[data-confirm-delete]").onclick = () => {
    runtime.state.templates[day] = runtime.state.templates[day].filter(
      (x) => x.id !== task.id,
    );
    saveJSON(KEYS.templates, runtime.state.templates);
    closeModal();
    render();
    toast("Recurring task deleted.");
  };
}
