import "server-only";

import { formatCivilDateIso } from "@/lib/datetime/civil-date";
import type { PlatformJobKind } from "@/lib/platform/job-policy";
import { parsePlatformJobPayload } from "@/lib/platform/job-payload";
import { normalizeReceiptExtraction, validateReceiptDraft } from "@/lib/finance/receipt-extraction";
import { compositeReceiptExtractionProvider } from "@/server/providers/receipt-extraction-composite";
import { readDocumentBytes } from "@/server/services/documents";
import { uploadDocument } from "@/server/services/documents";
import { buildFinancialReportCsv, buildFinancialReportPdf } from "@/server/services/reports";
import { receiptImageToBase64 } from "@/server/services/receipt-image-preprocess";
import { computeSuggestionsForTransactions } from "@/server/services/transaction-categorization-batch";
import { parseWebhookDeliveryPayload } from "@/lib/platform/job-payload";
import { executeWebhookDeliveryJob } from "@/server/services/webhook-delivery";

function periodKeyToReportQuery(periodKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) throw new Error("PERIOD_KEY_INVALID");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("PERIOD_KEY_INVALID");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: formatCivilDateIso({ year, month, day: 1 }),
    to: formatCivilDateIso({ year, month, day: lastDay }),
  };
}

async function executeReportExportJob(input: {
  userId: string;
  workspaceId: string;
  format: "pdf" | "csv";
  periodKey: string;
}): Promise<Record<string, string>> {
  const query = periodKeyToReportQuery(input.periodKey);
  const name =
    input.format === "pdf"
      ? `relatorio-${input.periodKey}.pdf`
      : `relatorio-${input.periodKey}.csv`;
  const mimeType = input.format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8";

  let fileBytes: Uint8Array;
  if (input.format === "pdf") {
    const pdf = await buildFinancialReportPdf(input.userId, input.workspaceId, query);
    if (!pdf) throw new Error("REPORT_ACCESS_DENIED");
    fileBytes = new Uint8Array(pdf);
  } else {
    const csv = await buildFinancialReportCsv(input.userId, input.workspaceId, query);
    if (!csv) throw new Error("REPORT_ACCESS_DENIED");
    fileBytes = new TextEncoder().encode(csv);
  }

  const stored = await uploadDocument(input.userId, input.workspaceId, {
    name,
    mimeType,
    bytes: fileBytes,
  });
  if (!stored || "error" in stored) throw new Error("REPORT_STORE_FAILED");

  return {
    documentId: stored.document.id,
    format: input.format,
    periodKey: input.periodKey,
    workspaceId: input.workspaceId,
  };
}

async function executeReceiptOcrJob(input: {
  userId: string;
  workspaceId: string;
  documentId: string;
}): Promise<Record<string, string>> {
  const read = await readDocumentBytes(input.userId, input.workspaceId, input.documentId);
  if (!read) throw new Error("DOCUMENT_NOT_FOUND");
  if ("unavailable" in read) throw new Error("DOCUMENT_UNAVAILABLE");

  const mime = read.doc.mimeType;
  if (!mime.startsWith("image/")) throw new Error("DOCUMENT_NOT_IMAGE");

  const imageBase64 = receiptImageToBase64(read.bytes);
  const raw = await compositeReceiptExtractionProvider.extractFromImage({
    imageBase64,
    mimeType: mime === "image/png" ? "image/png" : "image/jpeg",
  });
  const draft = normalizeReceiptExtraction(raw);
  const issues = validateReceiptDraft(draft);

  return {
    documentId: input.documentId,
    workspaceId: input.workspaceId,
    issueCount: String(issues.length),
    provider: compositeReceiptExtractionProvider.name,
    merchant: draft.merchant ?? "",
    total: draft.total ?? "",
  };
}

async function executeMlCategorizationJob(input: {
  userId: string;
  workspaceId: string;
  transactionId: string;
}): Promise<Record<string, string>> {
  const result = await computeSuggestionsForTransactions(input.userId, input.workspaceId, {
    transactionIds: [input.transactionId],
    limit: 1,
  });
  if (!result) throw new Error("CATEGORIZATION_FORBIDDEN");
  if (!result.localAiActive) throw new Error("LOCAL_AI_DISABLED");

  return {
    workspaceId: input.workspaceId,
    transactionId: input.transactionId,
    processed: String(result.processed),
    ollamaErrors: String(result.ollamaErrors),
  };
}

export async function executeClaimedJob(job: {
  kind: PlatformJobKind;
  payload: unknown;
  requestedById?: string | null;
  jobId?: string;
}): Promise<Record<string, string>> {
  if (job.kind === "WEBHOOK_DELIVERY") {
    return executeWebhookDeliveryJob(parseWebhookDeliveryPayload(job.payload));
  }

  const userId = job.requestedById?.trim();
  if (!userId) throw new Error("REQUESTED_BY_REQUIRED");

  if (job.kind === "REPORT_EXPORT") {
    const payload = parsePlatformJobPayload("REPORT_EXPORT", job.payload);
    return executeReportExportJob({
      userId,
      workspaceId: payload.workspaceId,
      format: payload.format,
      periodKey: payload.periodKey,
    });
  }

  if (job.kind === "RECEIPT_OCR") {
    const payload = parsePlatformJobPayload("RECEIPT_OCR", job.payload);
    return executeReceiptOcrJob({
      userId,
      workspaceId: payload.workspaceId,
      documentId: payload.documentId,
    });
  }

  if (job.kind === "ML_CATEGORIZATION") {
    const payload = parsePlatformJobPayload("ML_CATEGORIZATION", job.payload);
    return executeMlCategorizationJob({
      userId,
      workspaceId: payload.workspaceId,
      transactionId: payload.transactionId,
    });
  }

  throw new Error("JOB_KIND_UNSUPPORTED");
}
