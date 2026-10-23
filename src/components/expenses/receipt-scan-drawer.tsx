"use client";

import { useRef, useState, useTransition } from "react";
import {
  createExpenseFromReceiptAction,
  extractReceiptAction,
  type ReceiptExtractActionResult,
} from "@/lib/finance/receipt-actions";
import type { ReceiptDraft, ReceiptValidationIssue } from "@/lib/finance/receipt-extraction";
import {
  RECEIPT_DUPLICATE_HIGH_SCORE,
  type ReceiptDuplicateCandidate,
} from "@/lib/finance/receipt-expense-match";
import { SideDrawer } from "@/components/ui/side-drawer";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";

type Account = { id: string; name: string };
type Category = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  today: string;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
};

type Step = "pick" | "analyzing" | "review";

function issueTone(code: ReceiptValidationIssue["code"]): string {
  if (code === "TOTAL_REQUIRES_REVIEW" || code === "TOTAL_LOW_CONFIDENCE" || code === "TOTAL_MISSING") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function ReceiptScanDrawer({ open, onClose, accounts, categories, today, returnFocusRef }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [issues, setIssues] = useState<ReceiptValidationIssue[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [duplicateCandidates, setDuplicateCandidates] = useState<ReceiptDuplicateCandidate[]>([]);
  const [duplicateAck, setDuplicateAck] = useState(false);
  const [pendingExtract, startExtract] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("pick");
    setError(null);
    setDraft(null);
    setIssues([]);
    setDocumentId(null);
    setDescription("");
    setCategoryId("");
    setDuplicateCandidates([]);
    setDuplicateAck(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function applyResult(result: ReceiptExtractActionResult) {
    if (!result.ok) {
      setError(result.error);
      setStep("pick");
      return;
    }
    setDraft(result.result.draft);
    setIssues(result.result.issues);
    setDocumentId(result.result.documentId);
    setDescription(result.result.description);
    setCategoryId(result.result.suggestedCategoryId ?? "");
    setDuplicateCandidates(result.result.duplicateCandidates ?? []);
    setDuplicateAck(false);
    setStep("review");
    setError(null);
  }

  function runExtract(file: File) {
    setStep("analyzing");
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startExtract(async () => {
      const result = await extractReceiptAction(formData);
      applyResult(result);
    });
  }

  function onFileChange(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    runExtract(file);
  }

  return (
    <SideDrawer open={open} onClose={handleClose} titleId="receipt-scan-title" returnFocusRef={returnFocusRef}>
      <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
        <div>
          <h2 id="receipt-scan-title" className="text-lg font-semibold">
            Digitalizar recibo
          </h2>
          <p className="text-sm text-slate-500">
            Análise local com Moondream. Confirma sempre o total antes de registar.
          </p>
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={handleClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="grid gap-4 overflow-y-auto p-5">
        {step === "pick" ? (
          <>
            <p className="text-sm text-slate-600">
              Tira uma fotografia nítida ou escolhe uma imagem (JPEG/PNG). O ficheiro fica no armazenamento privado
              do workspace.
            </p>
            {error ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files)}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => cameraInputRef.current?.click()}
            >
              Tirar fotografia
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => fileInputRef.current?.click()}
            >
              Escolher imagem
            </button>
          </>
        ) : null}

        {step === "analyzing" ? (
          <p className="text-sm text-slate-600" aria-live="polite">
            {pendingExtract ? "A analisar o recibo localmente…" : "A preparar…"}
          </p>
        ) : null}

        {step === "review" && draft ? (
          <>
            <ul className="grid gap-2 text-sm">
              {issues.map((issue) => (
                <li
                  key={`${issue.code}-${issue.message}`}
                  className={`rounded-lg border px-3 py-2 ${issueTone(issue.code)}`}
                >
                  {issue.message}
                </li>
              ))}
            </ul>
            <form action={createExpenseFromReceiptAction} className="grid gap-4">
              <input type="hidden" name="receiptDocumentId" value={documentId ?? ""} />
              <input
                type="hidden"
                name="receiptDuplicateScore"
                value={String(duplicateCandidates[0]?.score ?? 0)}
              />
              {duplicateCandidates.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  <p className="font-medium">Possível duplicado</p>
                  <ul className="mt-2 list-disc pl-5">
                    {duplicateCandidates.map((hit) => (
                      <li key={hit.transactionId}>
                        {hit.occurredAt} · {hit.amount} € · {hit.description.slice(0, 60)} (
                        {hit.reasons.join(", ")})
                      </li>
                    ))}
                  </ul>
                  {duplicateCandidates[0]!.score >= RECEIPT_DUPLICATE_HIGH_SCORE ? (
                    <label className="mt-3 flex items-start gap-2">
                      <input
                        type="checkbox"
                        name="receiptDuplicateAcknowledged"
                        value="yes"
                        checked={duplicateAck}
                        onChange={(e) => setDuplicateAck(e.target.checked)}
                        className="mt-1"
                      />
                      <span>Confirmo que isto não é um pagamento duplicado</span>
                    </label>
                  ) : null}
                </div>
              ) : null}
              <label className={labelClassName}>
                Conta
                <select name="accountId" required className={inputClassName} defaultValue={accounts[0]?.id}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClassName}>
                Comerciante / descrição
                <input
                  name="description"
                  required
                  className={inputClassName}
                  defaultValue={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className={labelClassName}>
                Categoria
                <select
                  name="categoryId"
                  className={inputClassName}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClassName}>
                {draft.currency === "EUR" ? "Total (€)" : `Total lido (${draft.currency}) → regista em €`}
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  className={`${inputClassName} font-semibold`}
                  defaultValue={draft.currency === "EUR" ? (draft.total ?? "") : ""}
                  placeholder={
                    draft.currency !== "EUR" && draft.total
                      ? `Documento: ${draft.total} ${draft.currency} — converte para EUR`
                      : undefined
                  }
                  aria-describedby="receipt-total-hint"
                />
              </label>
              <p id="receipt-total-hint" className="-mt-2 text-xs text-amber-800">
                Compara este valor com o documento original. Faturas em USD/outras moedas exigem conversão manual para
                EUR antes de registar.
              </p>
              <label className={labelClassName}>
                Data
                <input
                  name="occurredAt"
                  type="date"
                  required
                  className={inputClassName}
                  defaultValue={draft.date ?? today}
                />
              </label>
              {draft.fiscalNumber ? (
                <p className="text-xs text-slate-500">
                  {draft.fiscalNumber.includes("-") ? "EIN" : "NIF"} lido:{" "}
                  <strong>{draft.fiscalNumber}</strong>
                </p>
              ) : null}
              {draft.vatAmount ? (
                <p className="text-xs text-slate-500">
                  IVA/VAT lido:{" "}
                  <strong>
                    {draft.vatAmount} {draft.currency === "EUR" ? "€" : draft.currency}
                  </strong>
                </p>
              ) : null}
              {draft.paymentMethod ? (
                <p className="text-xs text-slate-500">
                  Meio de pagamento: <strong>{draft.paymentMethod}</strong>
                </p>
              ) : null}
              {draft.items.length > 0 ? (
                <div className="rounded-lg border border-[var(--border)] p-3 text-xs">
                  <p className="font-medium text-slate-700">Itens lidos (referência)</p>
                  <ul className="mt-2 space-y-1">
                    {draft.items.map((item) => (
                      <li key={`${item.description}-${item.amount}`} className="flex justify-between gap-2">
                        <span className="truncate">{item.description}</span>
                        <span>{item.amount} €</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="receiptReviewAcknowledged" value="yes" required className="mt-1" />
                <span>Confirmo que revi o total, a data e o comerciante face ao recibo original.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primaryButtonClassName}>
                  Registar despesa
                </button>
                <button type="button" className={secondaryButtonClassName} onClick={() => setStep("pick")}>
                  Analisar outra imagem
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </SideDrawer>
  );
}
