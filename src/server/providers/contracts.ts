/**
 * Contratos dos adaptadores externos.
 * Integrações externas ficam isoladas atrás destas interfaces. Os adaptadores
 * nunca recebem acesso à base de dados nem podem persistir decisões.
 */

export type ProviderName = string;

export interface StorageProvider {
  save(input: {
    workspaceId: string;
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<{ storageKey: string }>;
  read(storageKey: string): Promise<Uint8Array>;
  delete(storageKey: string): Promise<void>;
}

export type OpenBankingTransaction = {
  externalId: string;
  bookingDate: string;
  amount: string;
  currency: string;
  description: string;
  counterparty?: string;
};

export type OpenBankingConsentRefreshResult = {
  consentRef: string;
  expiresAt?: string;
};

export interface OpenBankingProvider {
  readonly name: ProviderName;
  /** Apenas leitura; nunca inicia pagamentos. */
  fetchTransactions(input: {
    consentRef: string;
    accountExternalRef: string;
    from: string;
    to: string;
  }): Promise<OpenBankingTransaction[]>;
  /** TPP: renovar access token / prolongar consentimento (opcional por adaptador). */
  refreshConsent?(input: { consentRef: string }): Promise<OpenBankingConsentRefreshResult>;
  /** TPP: revogar consentimento no agregador (opcional). */
  revokeConsent?(input: { consentRef: string }): Promise<void>;
}

/** @deprecated Use OpenBankingProvider */
export interface BankDataProvider {
  readonly name: ProviderName;
}

export interface MarketDataProvider {
  readonly name: ProviderName;
}

export interface CryptoPriceProvider {
  readonly name: ProviderName;
}

export interface ForecastProvider {
  readonly name: ProviderName;
}

export interface InsightProvider {
  readonly name: ProviderName;
}

export type TransactionCategorizationDirection = "INCOME" | "EXPENSE";
export type SuggestedTransactionType = TransactionCategorizationDirection | "TRANSFER";
export type SuggestedCategoryNature = "NECESSARY" | "DISCRETIONARY";

export type TransactionCategorizationCategory = {
  name: string;
  nature: SuggestedCategoryNature;
};

export type TransactionCategorizationExample = {
  pattern: string;
  merchant: string;
  category: string | null;
  transactionType: SuggestedTransactionType;
};

export type TransactionCategorizationInput = {
  description: string;
  amount: string;
  direction: TransactionCategorizationDirection;
  availableCategories: TransactionCategorizationCategory[];
  examples: TransactionCategorizationExample[];
  /** Revisão em lote: o modelo tem de escolher uma categoria da lista. */
  forceCategory?: boolean;
};

export type TransactionCategorizationOutput = {
  merchant: string;
  category: string | null;
  transactionType: SuggestedTransactionType;
  nature: SuggestedCategoryNature | null;
  tags: string[];
  confidence: number;
  reason: string;
};

export interface TransactionCategorizationProvider {
  readonly name: ProviderName;
  suggest(input: TransactionCategorizationInput): Promise<TransactionCategorizationOutput>;
}

export type FinancialAssistantParseInput = {
  question: string;
  allowedIntents: readonly string[];
};

export type FinancialAssistantParseOutput = {
  intent: string;
  parameters: Record<string, unknown>;
  confidence: number;
  clarification: string | null;
};

export interface FinancialAssistantProvider {
  readonly name: ProviderName;
  parseIntent(input: FinancialAssistantParseInput): Promise<FinancialAssistantParseOutput>;
}

export type ReceiptExtractionModelOutput = {
  merchant: string | null;
  date: string | null;
  total: string | null;
  currency: string | null;
  fiscalNumber: string | null;
  vatAmount: string | null;
  paymentMethod: string | null;
  items: Array<{ description: string; amount: string }>;
  confidence: {
    merchant?: number;
    date?: number;
    total?: number;
    currency?: number;
    fiscalNumber?: number;
    vatAmount?: number;
    paymentMethod?: number;
  };
};

export interface ReceiptExtractionProvider {
  readonly name: ProviderName;
  extractFromImage(input: {
    imageBase64: string;
    mimeType: "image/jpeg" | "image/png";
  }): Promise<ReceiptExtractionModelOutput>;
}
