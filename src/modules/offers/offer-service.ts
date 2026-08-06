import { randomUUID } from "node:crypto";
import type { Database } from "../../shared/database.js";
import { recordAuditEvent, recordDomainEvent, type CommandContext } from "../../shared/audit.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";

export interface OfferInput {
  clientId: string;
  currency: string;
  pricePolicyId?: string;
  items: Array<{ productId?: string; description: string; quantity: number; unitPriceMinor: number }>;
}

interface OfferRow {
  id: string;
  client_id: string;
  price_policy_id: string | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  created_at: string;
  updated_at: string;
}

export class OfferService {
  constructor(private readonly database: Database) {}

  list() {
    const rows = this.database.prepare("SELECT id FROM commercial_offers ORDER BY created_at DESC LIMIT 100").all() as Array<{ id: string }>;
    return rows.map((row) => this.get(row.id));
  }

  create(input: OfferInput, context: CommandContext) {
    const client = this.database.prepare("SELECT id FROM clients WHERE id = ?").get(input.clientId);
    if (!client) throw new NotFoundError("Client");

    let discountBasisPoints = 0;
    if (input.pricePolicyId) {
      const policy = this.database.prepare(`
        SELECT currency, discount_basis_points, active FROM price_policies WHERE id = ?
      `).get(input.pricePolicyId) as { currency: string; discount_basis_points: number; active: number } | undefined;
      if (!policy) throw new NotFoundError("Price policy");
      if (!policy.active || policy.currency !== input.currency) {
        throw new ConflictError("INVALID_PRICE_POLICY", "Price policy must be active and use the offer currency");
      }
      discountBasisPoints = policy.discount_basis_points;
    }

    for (const item of input.items) {
      if (item.productId && !this.database.prepare("SELECT id FROM products WHERE id = ? AND active = 1").get(item.productId)) {
        throw new NotFoundError("Active product");
      }
    }

    const subtotalMinor = input.items.reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0);
    const discountMinor = Math.floor((subtotalMinor * discountBasisPoints) / 10_000);
    const totalMinor = subtotalMinor - discountMinor;
    if (!Number.isSafeInteger(subtotalMinor) || !Number.isSafeInteger(discountMinor) || !Number.isSafeInteger(totalMinor)) {
      throw new ConflictError("AMOUNT_OVERFLOW", "Calculated offer amount exceeds safe integer limits");
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO commercial_offers
        (id, client_id, price_policy_id, status, currency, subtotal_minor, discount_minor, total_minor, created_at, updated_at)
      VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
    `).run(id, input.clientId, input.pricePolicyId ?? null, input.currency, subtotalMinor, discountMinor, totalMinor, now, now);

    const insertItem = this.database.prepare(`
      INSERT INTO commercial_offer_items
        (id, commercial_offer_id, product_id, description, quantity, unit_price_minor, line_total_minor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of input.items) {
      insertItem.run(randomUUID(), id, item.productId ?? null, item.description, item.quantity, item.unitPriceMinor, item.quantity * item.unitPriceMinor);
    }
    const eventPayload = {
      clientId: input.clientId, subtotalMinor, discountMinor, totalMinor, currency: input.currency,
    };
    recordDomainEvent(this.database, "COMMERCIAL_OFFER_DRAFT_CREATED", "COMMERCIAL_OFFER", id, eventPayload, context);
    recordAuditEvent(this.database, "COMMERCIAL_OFFER_DRAFT_CREATED", "COMMERCIAL_OFFER", id, eventPayload, context);
    return this.get(id);
  }

  get(id: string) {
    const offer = this.database.prepare("SELECT * FROM commercial_offers WHERE id = ?").get(id) as unknown as OfferRow | undefined;
    if (!offer) throw new NotFoundError("Commercial offer");
    const items = this.database.prepare(`
      SELECT id, product_id, description, quantity, unit_price_minor, line_total_minor
      FROM commercial_offer_items WHERE commercial_offer_id = ? ORDER BY rowid
    `).all(id) as Array<Record<string, unknown>>;
    const approval = this.database.prepare(`
      SELECT id, status, request_reason, requested_at, decision_reason, decided_at, decided_by
      FROM offer_approvals WHERE commercial_offer_id = ?
    `).get(id) as { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; request_reason: string | null; requested_at: string; decision_reason: string | null; decided_at: string | null; decided_by: string | null } | undefined;
    return {
      id: offer.id,
      clientId: offer.client_id,
      pricePolicyId: offer.price_policy_id,
      status: offer.status,
      currency: offer.currency,
      subtotalMinor: offer.subtotal_minor,
      discountMinor: offer.discount_minor,
      totalMinor: offer.total_minor,
      createdAt: offer.created_at,
      updatedAt: offer.updated_at,
      approval: approval ? {
        id: approval.id,
        status: approval.status,
        requestReason: approval.request_reason,
        requestedAt: approval.requested_at,
        decisionReason: approval.decision_reason,
        decidedAt: approval.decided_at,
        decidedBy: approval.decided_by,
      } : null,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unitPriceMinor: item.unit_price_minor,
        lineTotalMinor: item.line_total_minor,
      })),
    };
  }

  submitForApproval(id: string, reason: string | undefined, context: CommandContext) {
    const offer = this.get(id);
    if (offer.status !== "DRAFT") {
      throw new ConflictError("INVALID_OFFER_STATE", `Only DRAFT offers can be submitted for approval; current status is ${offer.status}`);
    }

    const approvalId = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO offer_approvals (id, commercial_offer_id, status, request_reason, requested_at)
      VALUES (?, ?, 'PENDING', ?, ?)
    `).run(approvalId, id, reason ?? null, now);

    const approvalPayload = { commercialOfferId: id, requestReason: reason ?? null, requestedAt: now };
    recordDomainEvent(this.database, "OFFER_APPROVAL_REQUESTED", "OFFER_APPROVAL", approvalId, approvalPayload, context);
    recordDomainEvent(this.database, "COMMERCIAL_OFFER_SUBMITTED_FOR_APPROVAL", "COMMERCIAL_OFFER", id, { approvalId }, context);
    recordAuditEvent(this.database, "OFFER_APPROVAL_REQUESTED", "OFFER_APPROVAL", approvalId, approvalPayload, context);
    recordAuditEvent(this.database, "COMMERCIAL_OFFER_SUBMITTED_FOR_APPROVAL", "COMMERCIAL_OFFER", id, { approvalId }, context);
    return this.get(id);
  }

  decideApproval(id: string, decision: "APPROVED" | "REJECTED", reason: string | undefined, reviewerId: string, context: CommandContext) {
    const offer = this.get(id);
    if (offer.status !== "PENDING_APPROVAL" || offer.approval?.status !== "PENDING") {
      throw new ConflictError("INVALID_APPROVAL_STATE", "Only a pending approval can receive a decision");
    }
    if (decision === "REJECTED" && !reason) {
      throw new ConflictError("REJECTION_REASON_REQUIRED", "A rejection reason is required");
    }

    const decidedAt = new Date().toISOString();
    this.database.prepare(`
      UPDATE offer_approvals
      SET status = ?, decision_reason = ?, decided_at = ?, decided_by = ?
      WHERE id = ? AND status = 'PENDING'
    `).run(decision, reason ?? null, decidedAt, reviewerId, offer.approval.id);

    const payload = { commercialOfferId: id, decision, reason: reason ?? null, reviewerId, decidedAt };
    recordDomainEvent(this.database, "OFFER_APPROVAL_DECIDED", "OFFER_APPROVAL", offer.approval.id, payload, context);
    recordDomainEvent(this.database, `COMMERCIAL_OFFER_${decision}`, "COMMERCIAL_OFFER", id, { approvalId: offer.approval.id }, context);
    recordAuditEvent(this.database, "OFFER_APPROVAL_DECIDED", "OFFER_APPROVAL", offer.approval.id, payload, context);
    recordAuditEvent(this.database, `COMMERCIAL_OFFER_${decision}`, "COMMERCIAL_OFFER", id, { approvalId: offer.approval.id }, context);
    return this.get(id);
  }

  createFollowUp(id: string, dueAt: string, notes: string | undefined, context: CommandContext) {
    this.get(id);
    if (!Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= Date.now()) {
      throw new ConflictError("INVALID_FOLLOW_UP_DUE_AT", "Follow-up due date must be in the future");
    }
    const taskId = randomUUID();
    const now = new Date().toISOString();
    const actorId = context.actorType === "USER" ? context.actorId : null;
    const assigneeId = actorId && this.database.prepare(`
      SELECT 1 FROM users WHERE id = ? AND active = 1 AND role IN ('ADMIN', 'MANAGER', 'SALES')
    `).get(actorId) ? actorId : null;
    this.database.prepare(`
      INSERT INTO tasks (
        id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at,
        assignee_id, assignment_updated_at, assignment_updated_by
      )
      VALUES (?, 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, id, dueAt, notes ?? null, now, assigneeId, assigneeId ? now : null, assigneeId);
    const eventPayload = { commercialOfferId: id, dueAt, assigneeId };
    recordDomainEvent(this.database, "FOLLOW_UP_TASK_CREATED", "TASK", taskId, eventPayload, context);
    recordAuditEvent(this.database, "FOLLOW_UP_TASK_CREATED", "TASK", taskId, eventPayload, context);
    return { id: taskId, type: "FOLLOW_UP", status: "OPEN", relatedEntityType: "COMMERCIAL_OFFER", relatedEntityId: id, dueAt, notes: notes ?? null, createdAt: now, assigneeId, assignmentUpdatedAt: assigneeId ? now : null, assignmentUpdatedBy: assigneeId };
  }
}
