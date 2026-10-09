import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEYS } from "../shared/schema.js";
import { removeSeededPlans } from "../shared/plans.js";
import { openDatabase } from "../server/database.mjs";
import { WORKWEEK_PLAN, WEEKEND_PLAN, SCHEDULE } from "../src/core/config.js";

test("new workspaces have no default plans", () => {
  assert.deepEqual(WORKWEEK_PLAN, []);
  assert.deepEqual(WEEKEND_PLAN, []);
  assert.ok(Object.values(SCHEDULE).every((tasks) => tasks.length === 0));
});

test("seed cleanup keeps user plans, edits and completion history; repeated cleanup is stable", () => {
  const seed = {
    id: "t_Weekdays_v2_0_old",
    name: "Get up at 5.00",
    schedule: "",
    notes: "",
  };
  const own = { ...seed, id: "t_123_own" };
  const edited = {
    ...seed,
    id: "t_Weekdays_v2_1_old",
    name: "My morning walk",
  };
  const values = {
    [KEYS.templates]: { Weekdays: [seed, own, edited], Weekend: [] },
    [KEYS.completions]: { "2026-10-09": { [seed.id]: true, [own.id]: true } },
    [KEYS.prefs]: {
      studyFlow: {
        Weekdays: {
          [seed.id]: { enabled: true, minutes: 25 },
          [own.id]: { enabled: true, minutes: 15 },
        },
      },
    },
  };
  const cleaned = removeSeededPlans(values);
  assert.deepEqual(cleaned[KEYS.templates].Weekdays, [own, edited]);
  assert.deepEqual(cleaned[KEYS.completions]["2026-10-09"], { [own.id]: true });
  assert.deepEqual(Object.keys(cleaned[KEYS.prefs].studyFlow.Weekdays), [
    own.id,
  ]);
  assert.equal(removeSeededPlans(cleaned), cleaned);
  assert.equal(values[KEYS.templates].Weekdays.length, 3);
});

test("existing SQLite seed plans are removed on restart with a new revision; user plans survive", async () => {
  const dir = await mkdtemp(join(tmpdir(), "daily-onboarding-"));
  const filename = join(dir, "test.sqlite");
  let database = openDatabase(filename);
  try {
    const id = database.createWorkspace();
    const seed = {
      id: "t_Weekend_0_old",
      name: "Get up at 5.00",
      schedule: "",
      notes: "",
    };
    const own = { id: "t_123_own", name: "Read", schedule: "", notes: "" };
    database.update(id, 0, {
      [KEYS.templates]: { Weekdays: [], Weekend: [seed, own] },
    });
    database.close();
    database = openDatabase(filename);
    assert.deepEqual(database.read(id).values[KEYS.templates].Weekend, [own]);
    assert.equal(database.read(id).revision, 2);
    assert.equal(database.update(id, 1, { [KEYS.templates]: {} }), null);
    database.close();
    database = openDatabase(filename);
    assert.equal(database.read(id).revision, 2);
  } finally {
    database.close();
    await rm(dir, { recursive: true, force: true });
  }
});
