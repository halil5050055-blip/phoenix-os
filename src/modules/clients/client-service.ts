import type { Database } from "../../shared/database.js";

interface ClientRow {
  id: string;
  name: string;
  primary_contact_id: string | null;
  source_lead_id: string;
  created_at: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  primaryContactId: string | null;
  sourceLeadId: string;
  createdAt: string;
}

export class ClientService {
  constructor(private readonly database: Database) {}

  list(): ClientSummary[] {
    const rows = this.database.prepare(`
      SELECT id, name, primary_contact_id, source_lead_id, created_at
      FROM clients ORDER BY created_at DESC
    `).all() as unknown as ClientRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      primaryContactId: row.primary_contact_id,
      sourceLeadId: row.source_lead_id,
      createdAt: row.created_at,
    }));
  }
}
