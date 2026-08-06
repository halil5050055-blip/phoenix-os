import { z } from "zod";
import { ROLES } from "../modules/users/user-service.js";

const trimmed = z.string().trim().min(1).max(200);
const optionalTrimmed = z.string().trim().min(1).max(500).optional();
const futureDateTime = z.iso.datetime().refine((value) => Date.parse(value) > Date.now(), "Date and time must be in the future");

export const createLeadSchema = z.object({
  companyName: trimmed,
  contact: z.object({
    firstName: trimmed,
    lastName: optionalTrimmed,
    email: z.email().optional(),
    phone: z.string().trim().min(3).max(50).optional(),
  }).optional(),
}).strict();

export const qualifyLeadSchema = z.object({ notes: optionalTrimmed }).strict();
export const convertLeadSchema = z.object({}).strict();

export const createOfferSchema = z.object({
  clientId: z.uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  pricePolicyId: z.uuid().optional(),
  items: z.array(z.object({
    productId: z.uuid().optional(),
    description: trimmed,
    quantity: z.int().positive().max(1_000_000),
    unitPriceMinor: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }).strict()).min(1).max(500),
}).strict();

export const followUpSchema = z.object({
  dueAt: futureDateTime,
  notes: optionalTrimmed,
}).strict();

export const completeTaskSchema = z.object({ note: optionalTrimmed }).strict();
export const assignTaskSchema = z.object({ assigneeId: z.uuid().nullable() }).strict();
export const rescheduleTaskSchema = z.object({ dueAt: futureDateTime }).strict();

export const submitForApprovalSchema = z.object({
  reason: optionalTrimmed,
}).strict();

export const approvalDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED"), reason: optionalTrimmed }).strict(),
  z.object({ decision: z.literal("REJECTED"), reason: z.string().trim().min(1).max(500) }).strict(),
]);

const email = z.email().max(254).transform((value) => value.trim().toLowerCase());
const password = z.string().min(12).max(128);

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

export const createUserSchema = z.object({
  email,
  displayName: trimmed,
  password,
  role: z.enum(ROLES),
}).strict();

export const updateUserSchema = z.object({
  email: email.optional(),
  displayName: trimmed.optional(),
  password: password.optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const telegramAuditSchema = z.object({
  updateId: z.int().nonnegative(),
  telegramUserId: z.string().regex(/^\d+$/),
  command: z.string().trim().min(1).max(100),
  allowed: z.boolean(),
}).strict();
