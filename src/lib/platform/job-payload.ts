import { z } from "zod";
import type { PlatformJobKind } from "@/lib/platform/job-policy";

const schemas = {
  REPORT_EXPORT: z.object({
    workspaceId: z.string().min(1),
    format: z.enum(["pdf", "csv"]),
    periodKey: z.string().regex(/^\d{4}-\d{2}$/),
  }).strict(),
  RECEIPT_OCR: z.object({
    workspaceId: z.string().min(1),
    documentId: z.string().min(1),
  }).strict(),
  ML_CATEGORIZATION: z.object({
    workspaceId: z.string().min(1),
    transactionId: z.string().min(1),
  }).strict(),
} satisfies Record<PlatformJobKind, z.ZodType>;

export function parsePlatformJobPayload(kind: PlatformJobKind, payload: unknown) {
  const parsed = schemas[kind].safeParse(payload);
  if (!parsed.success) throw new Error("PAYLOAD_INVALID");
  return parsed.data;
}
