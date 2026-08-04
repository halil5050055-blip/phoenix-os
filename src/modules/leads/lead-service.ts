import { randomUUID } from "node:crypto";
import type { Database } from "../../shared/database.js";
import { recordAuditEvent, recordDomainEvent, type CommandContext } from "../../shared/audit.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";

export interface ContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface LeadInput {
  companyName: string;
  contact?: ContactInput;
}

export interface Lead {
  id: string;
  companyName: string;
  status: "NEW" | "QUALIFIED" | "CONVERTED";
  qualificationNotes: string | null;
  qualifiedAt: string | null;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  contact: (ContactInput & { id: string }) | null;
}

interface LeadRow {
  id: string;
  company_name: string;
  status: Lead["status"];
  qualification_notes: string | null;
  qualified_at: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

function mapLead(row: LeadRow): Lead {
  return {
    id: row.id,
    companyName: row.company_name,
    status: row.status,
    qualificationNotes: row.qualification_notes,
    qualifiedAt: row.qualified_at,
    clientId: row.client_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contact: row.contact_id && row.first_name ? {
      id: row.contact_id,
      firstName: row.first_name,
      ...(row.last_name ? { lastName: row.last_name } : {}),
      ...(row.email ? { email: row.email } : {}),
      ...(row.phone ? { phone: row.phone } : {}),
    } : null,
  };
}

const leadSelect = `
  SELECT l.*, c.first_name, c.last_name, c.email, c.phone
  FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
`;

export class LeadService {
  constructor(private readonly database: Database) {}

  create(input: LeadInput, context: CommandContext): Lead {
    const now = new Date().toISOString();
    const leadId = randomUUID();
    let contactId: string | null = null;

    if (input.contact) {
      contactId = randomUUID();
      this.database.prepare(`
        INSERT INTO contacts (id, first_name, last_name, email, phone, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(contactId, input.contact.firstName, input.contact.lastName ?? null, input.contact.email ?? null, input.contact.phone ?? null, now);
    }

    this.database.prepare(`
      INSERT INTO leads (id, company_name, contact_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'NEW', ?, ?)
    `).run(leadId, input.companyName, contactId, now, now);
    const eventPayload = { companyName: input.companyName, contactId };
    recordDomainEvent(this.database, "LEAD_CREATED", "LEAD", leadId, eventPayload, context);
    recordAuditEvent(this.database, "LEAD_CREATED", "LEAD", leadId, eventPayload, context);
    return this.get(leadId);
  }

  list(): Lead[] {
    return (this.database.prepare(`${leadSelect} ORDER BY l.created_at DESC`).all() as unknown as LeadRow[]).map(mapLead);
  }

  get(id: string): Lead {
    const row = this.database.prepare(`${leadSelect} WHERE l.id = ?`).get(id) as unknown as LeadRow | undefined;
    if (!row) throw new NotFoundError("Lead");
    return mapLead(row);
  }

  qualify(id: string, notes: string | undefined, context: CommandContext): Lead {
    const lead = this.get(id);
    if (lead.status !== "NEW") {
      throw new ConflictError("INVALID_LEAD_STATE", `Only NEW leads can be qualified; current status is ${lead.status}`);
    }
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE leads SET status = 'QUALIFIED', qualification_notes = ?, qualified_at = ?, updated_at = ? WHERE id = ?
    `).run(notes ?? null, now, now, id);
    const eventPayload = { notes: notes ?? null, qualifiedAt: now };
    recordDomainEvent(this.database, "LEAD_QUALIFIED", "LEAD", id, eventPayload, context);
    recordAuditEvent(this.database, "LEAD_QUALIFIED", "LEAD", id, eventPayload, context);
    return this.get(id);
  }

  convert(id: string, context: CommandContext): { lead: Lead; client: { id: string; name: string; primaryContactId: string | null; sourceLeadId: string; createdAt: string } } {
    const lead = this.get(id);
    if (lead.status !== "QUALIFIED") {
      throw new ConflictError("INVALID_LEAD_STATE", `Only QUALIFIED leads can be converted; current status is ${lead.status}`);
    }
    const clientId = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO clients (id, name, primary_contact_id, source_lead_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(clientId, lead.companyName, lead.contact?.id ?? null, id, now);
    this.database.prepare(`UPDATE leads SET status = 'CONVERTED', client_id = ?, updated_at = ? WHERE id = ?`).run(clientId, now, id);
    recordDomainEvent(this.database, "CLIENT_CREATED", "CLIENT", clientId, { sourceLeadId: id }, context);
    recordDomainEvent(this.database, "LEAD_CONVERTED", "LEAD", id, { clientId }, context);
    recordAuditEvent(this.database, "CLIENT_CREATED", "CLIENT", clientId, { sourceLeadId: id }, context);
    recordAuditEvent(this.database, "LEAD_CONVERTED", "LEAD", id, { clientId }, context);
    return {
      lead: this.get(id),
      client: { id: clientId, name: lead.companyName, primaryContactId: lead.contact?.id ?? null, sourceLeadId: id, createdAt: now },
    };
  }
}
