import type { Database } from "../../shared/database.js";

interface TaskRow {
  id: string;
  type: "FOLLOW_UP";
  status: "OPEN";
  related_entity_type: string;
  related_entity_id: string;
  due_at: string;
  notes: string | null;
  created_at: string;
}

export class TaskService {
  constructor(private readonly database: Database) {}

  list() {
    const rows = this.database.prepare(`
      SELECT id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at
      FROM tasks ORDER BY due_at, created_at LIMIT 100
    `).all() as unknown as TaskRow[];
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      dueAt: row.due_at,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  }
}
