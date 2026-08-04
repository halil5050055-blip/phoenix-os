import { z } from "zod";

const trimmed = z.string().trim().min(1).max(200);
const optionalTrimmed = z.string().trim().min(1).max(500).optional();

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
  dueAt: z.iso.datetime(),
  notes: optionalTrimmed,
}).strict();

export const submitForApprovalSchema = z.object({
  reason: optionalTrimmed,
}).strict();
