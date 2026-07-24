/**
 * T9 Prep tasks — unit tests for store + permissions (issue #33).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  canAssigneeCompletePrepTask,
  canEditorManagePrepTasks,
  classifyPrepTaskPatch,
  createPrepTask,
  deletePrepTask,
  listIncompletePrepTasksForAssignee,
  listPrepTasksForEvent,
  sanitizeCreatePrepTaskBody,
  sanitizeUpdatePrepTaskBody,
  updatePrepTask,
} from "../functions/lib/prep-tasks-store.js";
import { createEvent } from "../functions/lib/events-store.js";
import { createTestEnv } from "./helpers/memory-d1.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-08-15T18:00:00.000Z";

function baseEvent(overrides = {}) {
  return {
    id: "event-t9-1",
    title: "Saturday scrim",
    description: "",
    startsAt: NOW,
    endsAt: "",
    eventType: "scrim",
    match: { opponent: "", mapId: "", faction: "", startingPoint: "", result: "" },
    components: { stratIds: [], routePlanIds: [], whiteboardIds: [], rosterId: null },
    createdBy: "76561198000000000",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("T9 migration 0017_prep_tasks", () => {
  it("creates prep_tasks table with assignee index", () => {
    const sql = readFileSync(join(root, "migrations/0017_prep_tasks.sql"), "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS prep_tasks/i);
    assert.match(sql, /assignee_steam_id/i);
    assert.match(sql, /idx_prep_tasks_assignee/i);
  });
});

describe("T9 — sanitizeCreatePrepTaskBody", () => {
  it("requires title and assigneeSteamId", () => {
    assert.match(sanitizeCreatePrepTaskBody({}).error, /title/i);
    assert.match(sanitizeCreatePrepTaskBody({ title: "Review" }).error, /assignee/i);
  });

  it("trims and returns task payload", () => {
    const result = sanitizeCreatePrepTaskBody({
      title: "  Load mods  ",
      assigneeSteamId: " 76561198000000001 ",
      description: " Before match ",
    });
    assert.equal(result.task.title, "Load mods");
    assert.equal(result.task.assigneeSteamId, "76561198000000001");
    assert.equal(result.task.description, "Before match");
  });
});

describe("T9 — permissions helpers", () => {
  const task = { assigneeSteamId: "76561198000000001" };

  it("editors can manage tasks", () => {
    assert.equal(canEditorManagePrepTasks("editor"), true);
    assert.equal(canEditorManagePrepTasks("viewer"), false);
  });

  it("assignee or editor can complete", () => {
    assert.equal(canAssigneeCompletePrepTask(task, "76561198000000001", "viewer"), true);
    assert.equal(canAssigneeCompletePrepTask(task, "76561198000000002", "viewer"), false);
    assert.equal(canAssigneeCompletePrepTask(task, "76561198000000002", "editor"), true);
  });

  it("classifies completion vs field edits", () => {
    assert.deepEqual(classifyPrepTaskPatch({ completed: true }), {
      togglesCompletion: true,
      editsFields: false,
    });
    assert.deepEqual(classifyPrepTaskPatch({ title: "New title" }), {
      togglesCompletion: false,
      editsFields: true,
    });
  });
});

describe("T9 — prep task store integration", () => {
  it("creates, lists, completes, and deletes tasks for an event", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent());

    const created = await createPrepTask(
      env,
      "event-t9-1",
      { title: "Review strat", assigneeSteamId: "76561198000000001" },
      "76561198000000000"
    );
    assert.ok(created.task?.id);
    assert.equal(created.task.completed, false);

    const listed = await listPrepTasksForEvent(env, "event-t9-1");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].title, "Review strat");

    const completed = await updatePrepTask(env, "event-t9-1", created.task.id, {
      completed: true,
    });
    assert.equal(completed.task.completed, true);
    assert.ok(completed.task.completedAt);

    const removed = await deletePrepTask(env, "event-t9-1", created.task.id);
    assert.equal(removed.ok, true);
    assert.equal((await listPrepTasksForEvent(env, "event-t9-1")).length, 0);
  });

  it("lists incomplete tasks for assignee across upcoming events", async () => {
    const env = createTestEnv();
    await createEvent(env, baseEvent({ id: "event-a", startsAt: "2026-08-20T18:00:00.000Z" }));
    await createEvent(env, baseEvent({ id: "event-b", startsAt: "2026-08-25T18:00:00.000Z" }));

    const first = await createPrepTask(
      env,
      "event-a",
      { title: "Task A", assigneeSteamId: "76561198000000001" },
      "76561198000000000"
    );
    await createPrepTask(
      env,
      "event-b",
      { title: "Task B", assigneeSteamId: "76561198000000001" },
      "76561198000000000"
    );
    await updatePrepTask(env, "event-a", first.task.id, { completed: true });

    const mine = await listIncompletePrepTasksForAssignee(env, "76561198000000001", {
      from: "2026-08-15T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    });

    assert.equal(mine.length, 1);
    assert.equal(mine[0].title, "Task B");
    assert.equal(mine[0].eventTitle, "Saturday scrim");
  });
});

describe("T9 — sanitizeUpdatePrepTaskBody", () => {
  it("rejects empty patch", () => {
    assert.match(sanitizeUpdatePrepTaskBody({}).error, /No valid fields/i);
  });

  it("accepts completion toggle", () => {
    const result = sanitizeUpdatePrepTaskBody({ completed: true });
    assert.deepEqual(result.patch, { completed: true });
  });
});
