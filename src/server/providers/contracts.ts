/**
 * Contratos dos adaptadores externos.
 * A Fase 1 só define as interfaces. Nenhuma integração bancária,
 * de mercado ou de machine learning está implementada.
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
