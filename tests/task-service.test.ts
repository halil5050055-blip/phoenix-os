import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { TaskService } from "../src/modules/tasks/task-service.js";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";

describe("TaskService", () => {
  let database: Database;

  beforeEach(() => {
    database = createDatabase(":memory:");
  });

  afterEach(() => database.close());

  it("returns open follow-ups in due-date order using the public projection", () => {
    const insert = database.prepare(`
      INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at)
      VALUES (?, 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', ?, ?, ?, ?)
    `);
    insert.run("later", "offer-2", "2100-02-01T10:00:00.000Z", null, "2099-01-01T00:00:00.000Z");
    insert.run("sooner", "offer-1", "2100-01-01T10:00:00.000Z", "Call the client", "2099-01-01T00:00:00.000Z");

    expect(new TaskService(database).list()).toEqual([
      {
        id: "sooner",
        type: "FOLLOW_UP",
        status: "OPEN",
        relatedEntityType: "COMMERCIAL_OFFER",
        relatedEntityId: "offer-1",
        dueAt: "2100-01-01T10:00:00.000Z",
        dueUpdatedAt: null,
        dueUpdatedBy: null,
        notes: "Call the client",
        createdAt: "2099-01-01T00:00:00.000Z",
        assigneeId: null,
        assignmentUpdatedAt: null,
        assignmentUpdatedBy: null,
        assigneeDisplayName: null,
        assigneeRole: null,
        assigneeActive: null,
        completionNote: null,
        completedAt: null,
        completedBy: null,
      },
      {
        id: "later",
        type: "FOLLOW_UP",
        status: "OPEN",
        relatedEntityType: "COMMERCIAL_OFFER",
        relatedEntityId: "offer-2",
        dueAt: "2100-02-01T10:00:00.000Z",
        dueUpdatedAt: null,
        dueUpdatedBy: null,
        notes: null,
        createdAt: "2099-01-01T00:00:00.000Z",
        assigneeId: null,
        assignmentUpdatedAt: null,
        assignmentUpdatedBy: null,
        assigneeDisplayName: null,
        assigneeRole: null,
        assigneeActive: null,
        completionNote: null,
        completedAt: null,
        completedBy: null,
      },
    ]);
  });

  it("completes an open task exactly once with actor and audit context", () => {
    const userId = randomUUID();
    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, active, auth_version, created_at, updated_at)
      VALUES (?, 'operator@phoenix.test', 'Task Operator', 'not-used', 'SALES', 1, 1, ?, ?)
    `).run(userId, now, now);
    database.prepare(`
      INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at)
      VALUES ('task-1', 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', 'offer-1', '2100-01-01T00:00:00.000Z', 'Call client', ?)
    `).run(now);
    const context = { commandId: randomUUID(), commandName: "COMPLETE_TASK", actorId: userId, actorType: "USER" as const };
    const service = new TaskService(database);

    expect(service.complete("task-1", "Client confirmed", userId, context)).toMatchObject({
      status: "COMPLETED",
      completionNote: "Client confirmed",
      completedBy: userId,
    });
    expect(() => service.complete("task-1", undefined, userId, context))
      .toThrowError(expect.objectContaining({ code: "INVALID_TASK_STATE" }));
    expect(() => database.prepare("UPDATE tasks SET status = 'OPEN' WHERE id = 'task-1'").run()).toThrow();
    expect(() => database.prepare(`
      INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, created_at, completed_at, completed_by)
      VALUES ('task-bypass', 'FOLLOW_UP', 'COMPLETED', 'COMMERCIAL_OFFER', 'offer-1', ?, ?, ?, ?)
    `).run(now, now, now, userId)).toThrow();
    expect(database.prepare("SELECT event_type FROM domain_events WHERE command_id = ?").all(context.commandId))
      .toEqual([{ event_type: "TASK_COMPLETED" }]);
    expect(database.prepare("SELECT action, actor_id FROM audit_events WHERE command_id = ?").all(context.commandId))
      .toEqual([{ action: "TASK_COMPLETED", actor_id: userId }]);
  });

  it("assigns open tasks only to eligible active users and retains assignment history", () => {
    const managerId = randomUUID();
    const salesId = randomUUID();
    const accountantId = randomUUID();
    const now = new Date().toISOString();
    const insertUser = database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, active, auth_version, created_at, updated_at)
      VALUES (?, ?, ?, 'not-used', ?, ?, 1, ?, ?)
    `);
    insertUser.run(managerId, "manager-assignment@phoenix.test", "Assignment Manager", "MANAGER", 1, now, now);
    insertUser.run(salesId, "sales-assignment@phoenix.test", "Sales Owner", "SALES", 1, now, now);
    insertUser.run(accountantId, "accountant-assignment@phoenix.test", "Accounting User", "ACCOUNTANT", 1, now, now);
    database.prepare(`
      INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, created_at)
      VALUES ('assignment-task', 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', 'offer-1', '2100-01-01T00:00:00.000Z', ?)
    `).run(now);
    const service = new TaskService(database);
    const context = { commandId: randomUUID(), commandName: "ASSIGN_TASK", actorId: managerId, actorType: "USER" as const };

    expect(service.eligibleAssignees()).toEqual([
      { id: managerId, displayName: "Assignment Manager", role: "MANAGER" },
      { id: salesId, displayName: "Sales Owner", role: "SALES" },
    ]);
    expect(() => service.assign("assignment-task", accountantId, managerId, context))
      .toThrowError(expect.objectContaining({ code: "INVALID_TASK_ASSIGNEE" }));
    expect(() => database.prepare(`
      UPDATE tasks SET assignee_id = ?, assignment_updated_at = ?, assignment_updated_by = ? WHERE id = 'assignment-task'
    `).run(accountantId, now, managerId)).toThrow();
    expect(service.assign("assignment-task", salesId, managerId, context)).toMatchObject({
      assigneeId: salesId,
      assigneeDisplayName: "Sales Owner",
      assigneeRole: "SALES",
      assigneeActive: true,
      assignmentUpdatedBy: managerId,
    });
    expect(() => service.assign("assignment-task", salesId, managerId, context))
      .toThrowError(expect.objectContaining({ code: "TASK_ASSIGNMENT_UNCHANGED" }));
    expect(service.assign("assignment-task", null, managerId, { ...context, commandId: randomUUID() })).toMatchObject({
      assigneeId: null,
      assigneeDisplayName: null,
      assignmentUpdatedBy: managerId,
    });
    service.complete("assignment-task", undefined, salesId, { ...context, commandId: randomUUID(), commandName: "COMPLETE_TASK", actorId: salesId });
    expect(() => service.assign("assignment-task", managerId, managerId, { ...context, commandId: randomUUID() }))
      .toThrowError(expect.objectContaining({ code: "INVALID_TASK_STATE" }));
    expect(database.prepare("SELECT event_type FROM domain_events WHERE command_id = ?").all(context.commandId))
      .toEqual([{ event_type: "TASK_ASSIGNED" }]);
  });

  it("reschedules open tasks for managers or the current assignee with history", () => {
    const managerId = randomUUID();
    const ownerId = randomUUID();
    const otherSalesId = randomUUID();
    const now = new Date().toISOString();
    const insertUser = database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, active, auth_version, created_at, updated_at)
      VALUES (?, ?, ?, 'not-used', ?, 1, 1, ?, ?)
    `);
    insertUser.run(managerId, "schedule-manager@phoenix.test", "Schedule Manager", "MANAGER", now, now);
    insertUser.run(ownerId, "schedule-owner@phoenix.test", "Schedule Owner", "SALES", now, now);
    insertUser.run(otherSalesId, "other-sales@phoenix.test", "Other Sales", "SALES", now, now);
    database.prepare(`
      INSERT INTO tasks (
        id, type, status, related_entity_type, related_entity_id, due_at, created_at,
        assignee_id, assignment_updated_at, assignment_updated_by
      ) VALUES ('schedule-task', 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', 'offer-1', '2100-01-01T00:00:00.000Z', ?, ?, ?, ?)
    `).run(now, ownerId, now, managerId);
    const service = new TaskService(database);
    const ownerContext = { commandId: randomUUID(), commandName: "RESCHEDULE_TASK", actorId: ownerId, actorType: "USER" as const };

    expect(() => service.reschedule("schedule-task", "2101-01-01T00:00:00.000Z", otherSalesId, "SALES", { ...ownerContext, actorId: otherSalesId }))
      .toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => service.reschedule("schedule-task", "2000-01-01T00:00:00.000Z", ownerId, "SALES", ownerContext))
      .toThrowError(expect.objectContaining({ code: "INVALID_TASK_DUE_AT" }));
    expect(() => service.reschedule("schedule-task", "2100-01-01T00:00:00.000Z", ownerId, "SALES", ownerContext))
      .toThrowError(expect.objectContaining({ code: "TASK_DUE_AT_UNCHANGED" }));
    expect(service.reschedule("schedule-task", "2101-01-01T00:00:00.000Z", ownerId, "SALES", ownerContext)).toMatchObject({
      dueAt: "2101-01-01T00:00:00.000Z",
      dueUpdatedBy: ownerId,
    });
    expect(database.prepare("SELECT event_type FROM domain_events WHERE command_id = ?").all(ownerContext.commandId))
      .toEqual([{ event_type: "TASK_RESCHEDULED" }]);
    const managerContext = { ...ownerContext, commandId: randomUUID(), actorId: managerId };
    expect(service.reschedule("schedule-task", "2102-01-01T00:00:00.000Z", managerId, "MANAGER", managerContext)).toMatchObject({
      dueAt: "2102-01-01T00:00:00.000Z",
      dueUpdatedBy: managerId,
    });
    expect(() => database.prepare(`
      UPDATE tasks SET due_at = '2103-01-01T00:00:00.000Z', due_updated_at = ?, due_updated_by = ? WHERE id = 'schedule-task'
    `).run(now, otherSalesId)).toThrow();
    service.complete("schedule-task", undefined, ownerId, { ...ownerContext, commandId: randomUUID(), commandName: "COMPLETE_TASK" });
    expect(() => service.reschedule("schedule-task", "2103-01-01T00:00:00.000Z", managerId, "MANAGER", { ...ownerContext, actorId: managerId }))
      .toThrowError(expect.objectContaining({ code: "INVALID_TASK_STATE" }));
  });
});
