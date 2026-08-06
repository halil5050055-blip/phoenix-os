import type { Database } from "../../shared/database.js";
import { recordAuditEvent, recordDomainEvent, type CommandContext } from "../../shared/audit.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";

interface TaskRow {
  id: string;
  type: "FOLLOW_UP";
  status: "OPEN" | "COMPLETED";
  related_entity_type: string;
  related_entity_id: string;
  due_at: string;
  due_updated_at: string | null;
  due_updated_by: string | null;
  notes: string | null;
  created_at: string;
  assignee_id: string | null;
  assignment_updated_at: string | null;
  assignment_updated_by: string | null;
  assignee_display_name: string | null;
  assignee_role: "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTANT" | null;
  assignee_active: number | null;
  completion_note: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

export class TaskService {
  constructor(private readonly database: Database) {}

  list() {
    const rows = this.database.prepare(`
      SELECT t.id, t.type, t.status, t.related_entity_type, t.related_entity_id, t.due_at,
             t.due_updated_at, t.due_updated_by, t.notes, t.created_at,
             t.assignee_id, t.assignment_updated_at, t.assignment_updated_by,
             u.display_name AS assignee_display_name, u.role AS assignee_role, u.active AS assignee_active,
             t.completion_note, t.completed_at, t.completed_by
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      ORDER BY CASE t.status WHEN 'OPEN' THEN 0 ELSE 1 END, t.due_at, t.created_at LIMIT 100
    `).all() as unknown as TaskRow[];
    return rows.map((row) => this.project(row));
  }

  get(id: string) {
    const row = this.database.prepare(`
      SELECT t.id, t.type, t.status, t.related_entity_type, t.related_entity_id, t.due_at,
             t.due_updated_at, t.due_updated_by, t.notes, t.created_at,
             t.assignee_id, t.assignment_updated_at, t.assignment_updated_by,
             u.display_name AS assignee_display_name, u.role AS assignee_role, u.active AS assignee_active,
             t.completion_note, t.completed_at, t.completed_by
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?
    `).get(id) as unknown as TaskRow | undefined;
    if (!row) throw new NotFoundError("Task");
    return this.project(row);
  }

  complete(id: string, note: string | undefined, completedBy: string, context: CommandContext) {
    const task = this.get(id);
    if (task.status !== "OPEN") throw new ConflictError("INVALID_TASK_STATE", "Only an open task can be completed");
    const completedAt = new Date().toISOString();
    this.database.prepare(`
      UPDATE tasks SET status = 'COMPLETED', completion_note = ?, completed_at = ?, completed_by = ?
      WHERE id = ? AND status = 'OPEN'
    `).run(note ?? null, completedAt, completedBy, id);
    const payload = { taskId: id, relatedEntityType: task.relatedEntityType, relatedEntityId: task.relatedEntityId, completedBy, completedAt, note: note ?? null };
    recordDomainEvent(this.database, "TASK_COMPLETED", "TASK", id, payload, context);
    recordAuditEvent(this.database, "TASK_COMPLETED", "TASK", id, payload, context);
    return this.get(id);
  }

  eligibleAssignees() {
    return this.database.prepare(`
      SELECT id, display_name AS displayName, role
      FROM users WHERE active = 1 AND role IN ('ADMIN', 'MANAGER', 'SALES')
      ORDER BY display_name COLLATE NOCASE, id
    `).all() as Array<{ id: string; displayName: string; role: "ADMIN" | "MANAGER" | "SALES" }>;
  }

  assign(id: string, assigneeId: string | null, assignedBy: string, context: CommandContext) {
    const task = this.get(id);
    if (task.status !== "OPEN") throw new ConflictError("INVALID_TASK_STATE", "Only an open task can be assigned");
    if (task.assigneeId === assigneeId) throw new ConflictError("TASK_ASSIGNMENT_UNCHANGED", "Choose a different task assignee");
    if (assigneeId && !this.database.prepare(`
      SELECT 1 FROM users WHERE id = ? AND active = 1 AND role IN ('ADMIN', 'MANAGER', 'SALES')
    `).get(assigneeId)) {
      throw new ConflictError("INVALID_TASK_ASSIGNEE", "Task assignee must be an active Admin, Manager, or Sales user");
    }
    const assignedAt = new Date().toISOString();
    this.database.prepare(`
      UPDATE tasks SET assignee_id = ?, assignment_updated_at = ?, assignment_updated_by = ?
      WHERE id = ? AND status = 'OPEN'
    `).run(assigneeId, assignedAt, assignedBy, id);
    const payload = { taskId: id, previousAssigneeId: task.assigneeId, assigneeId, assignedBy, assignedAt };
    const eventType = assigneeId ? "TASK_ASSIGNED" : "TASK_UNASSIGNED";
    recordDomainEvent(this.database, eventType, "TASK", id, payload, context);
    recordAuditEvent(this.database, eventType, "TASK", id, payload, context);
    return this.get(id);
  }

  reschedule(id: string, dueAt: string, actorId: string, actorRole: "ADMIN" | "MANAGER" | "SALES", context: CommandContext) {
    const task = this.get(id);
    if (task.status !== "OPEN") throw new ConflictError("INVALID_TASK_STATE", "Only an open task can be rescheduled");
    if (!["ADMIN", "MANAGER"].includes(actorRole) && task.assigneeId !== actorId) {
      throw new ForbiddenError("Sales users may reschedule only tasks assigned to them");
    }
    const nextDueTime = Date.parse(dueAt);
    if (!Number.isFinite(nextDueTime) || nextDueTime <= Date.now()) {
      throw new ConflictError("INVALID_TASK_DUE_AT", "Task due date must be in the future");
    }
    if (nextDueTime === Date.parse(task.dueAt)) {
      throw new ConflictError("TASK_DUE_AT_UNCHANGED", "Choose a different task due date");
    }
    const updatedAt = new Date().toISOString();
    this.database.prepare(`
      UPDATE tasks SET due_at = ?, due_updated_at = ?, due_updated_by = ?
      WHERE id = ? AND status = 'OPEN'
    `).run(dueAt, updatedAt, actorId, id);
    const payload = { taskId: id, previousDueAt: task.dueAt, dueAt, updatedAt, updatedBy: actorId };
    recordDomainEvent(this.database, "TASK_RESCHEDULED", "TASK", id, payload, context);
    recordAuditEvent(this.database, "TASK_RESCHEDULED", "TASK", id, payload, context);
    return this.get(id);
  }

  private project(row: TaskRow) {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      dueAt: row.due_at,
      dueUpdatedAt: row.due_updated_at,
      dueUpdatedBy: row.due_updated_by,
      notes: row.notes,
      createdAt: row.created_at,
      assigneeId: row.assignee_id,
      assignmentUpdatedAt: row.assignment_updated_at,
      assignmentUpdatedBy: row.assignment_updated_by,
      assigneeDisplayName: row.assignee_display_name,
      assigneeRole: row.assignee_role,
      assigneeActive: row.assignee_active === null ? null : Boolean(row.assignee_active),
      completionNote: row.completion_note,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
    };
  }
}
