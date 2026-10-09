import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";
import { KEYS, validateBackup } from "../shared/schema.js";
import { defaults } from "../src/core/config.js";
function fixture() {
  return {
    templates: {
      Weekdays: ["Read for 20 minutes", "Build my project"].map((name, i) => ({
        id: "w" + i,
        name,
        schedule: "",
        notes: "",
      })),
      Weekend: ["Plan next week"].map((name, i) => ({
        id: "e" + i,
        name,
        schedule: "",
        notes: "",
      })),
    },
    completions: {},
    custom: {},
    pom: structuredClone(defaults.pom),
    stats: structuredClone(defaults.stats),
    prefs: structuredClone(defaults.prefs),
    exams: [],
  };
}
async function harness(dbPath = ":memory:") {
  const app = createApp({ dbPath });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + app.server.address().port;
  function client() {
    let cookie, csrf;
    return {
      async request(path, method = "GET", data, token = true) {
        const response = await fetch(origin + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(csrf && token ? { "X-CSRF-Token": csrf } : {}),
          },
          ...(data ? { body: JSON.stringify(data) } : {}),
        });
        if (response.headers.get("set-cookie"))
          cookie = response.headers.get("set-cookie").split(";")[0];
        const value = await response.json();
        if (value.csrf) csrf = value.csrf;
        return { status: response.status, value, headers: response.headers };
      },
    };
  }
  return { ...app, client };
}
test("guest workspaces are isolated; revisions and CSRF protect writes", async () => {
  const app = await harness();
  try {
    const a = app.client(),
      b = app.client();
    const sessionA = await a.request("/api/session"),
      sessionB = await b.request("/api/session");
    assert.notEqual(sessionA.value.workspaceId, sessionB.value.workspaceId);
    assert.equal(
      (
        await a.request(
          "/api/state",
          "PUT",
          { revision: 0, changes: { [KEYS.exams]: [] } },
          false,
        )
      ).status,
      403,
    );
    const saved = await a.request("/api/state", "PUT", {
      revision: 0,
      changes: {
        [KEYS.exams]: [
          { id: "exam-a", name: "Math", date: "2026-10-14", notes: "" },
        ],
      },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.value.revision, 1);
    assert.deepEqual((await b.request("/api/state")).value.values, {});
    const conflict = await a.request("/api/state", "PUT", {
      revision: 0,
      changes: { [KEYS.exams]: [] },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.value.values[KEYS.exams][0].name, "Math");
    assert.equal(
      (
        await a.request("/api/state", "PUT", {
          revision: 1,
          changes: {
            [KEYS.exams]: [{ id: "bad", name: "Bad", date: "2026-02-30" }],
          },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await a.request("/api/state", "PUT", {
          revision: 1,
          changes: { arbitrary: {} },
        })
      ).status,
      400,
    );
    assert.equal((await a.request("/api/state")).value.revision, 1);
    assert.match(saved.headers.get("cache-control"), /no-store/);
  } finally {
    await app.close();
  }
});
test("registration retains guest plans; login restores them on another device", async () => {
  const app = await harness();
  try {
    const a = app.client();
    const guest = (await a.request("/api/session")).value;
    const backup = fixture();
    const changes = Object.fromEntries(
      Object.entries(backup).map(([name, value]) => [KEYS[name], value]),
    );
    assert.equal(
      (await a.request("/api/state", "PUT", { revision: 0, changes })).status,
      200,
    );
    const credentials = {
      email: "test@example.com",
      password: "correct horse battery staple",
    };
    const registered = await a.request(
      "/api/auth/register",
      "POST",
      credentials,
    );
    assert.equal(registered.status, 200);
    assert.equal(registered.value.workspaceId, guest.workspaceId);
    const b = app.client();
    await b.request("/api/session");
    assert.equal(
      (
        await b.request("/api/auth/login", "POST", {
          ...credentials,
          password: "incorrect password here",
        })
      ).status,
      401,
    );
    assert.equal(
      (await b.request("/api/auth/login", "POST", credentials)).status,
      200,
    );
    assert.equal(
      (await b.request("/api/state")).value.values[KEYS.templates].Weekdays
        .length,
      2,
    );
    const anonymous = await b.request("/api/auth/logout", "POST", {});
    assert.equal(anonymous.value.user, null);
    assert.notEqual(anonymous.value.workspaceId, guest.workspaceId);
    assert.deepEqual((await b.request("/api/state")).value.values, {});
    assert.equal(
      (await a.request("/api/state")).value.values[KEYS.templates].Weekend
        .length,
      1,
    );
    assert.equal(
      (await a.request("/api/state/reset", "POST", { revision: 1 })).status,
      200,
    );
    assert.deepEqual((await a.request("/api/state")).value.values, {});
  } finally {
    await app.close();
  }
});
test("SQLite survives a server restart and preserves registered account data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "daily-system-test-"));
  const dbPath = join(dir, "test.sqlite");
  let app = await harness(dbPath);
  try {
    const a = app.client();
    await a.request("/api/session");
    const credentials = {
      email: "persistent@example.com",
      password: "persistent secure password",
    };
    await a.request("/api/auth/register", "POST", credentials);
    await a.request("/api/state", "PUT", {
      revision: 0,
      changes: {
        [KEYS.exams]: [
          {
            id: "persist",
            name: "Persistent exam",
            date: "2026-11-05",
            notes: "After restart",
          },
        ],
      },
    });
    await app.close();
    app = await harness(dbPath);
    const b = app.client();
    await b.request("/api/session");
    await b.request("/api/auth/login", "POST", credentials);
    assert.equal(
      (await b.request("/api/state")).value.values[KEYS.exams][0].notes,
      "After restart",
    );
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("legacy backup imports preserve both schedules; malformed imports fail before mutation", () => {
  const valid = fixture();
  assert.equal(validateBackup(valid), valid);
  assert.throws(() => validateBackup({ ...valid, pom: { blocks: [] } }));
  assert.throws(() =>
    validateBackup({
      ...valid,
      exams: [{ id: "x", name: "Exam", date: "2026-02-30" }],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...valid,
      completions: { "2026-10-09": { task: "yes" } },
    }),
  );
});
