import type { TranscriptionModel } from 'ai';

export interface Model {
    id: string;
    displayName: string;
    description?: string;
}

export interface PricingEntry {
    perMinuteUSD: number;
    lastUpdated: string;
}

export interface ProviderConfig {
    id: string;
    name: string;
    logoSrc: string;
    docsUrl: string;
    apiKeyHelpUrl: string;
    pricingDocsUrl: string;
    makeModel: (modelId: string, apiKey: string) => TranscriptionModel;
    listModels: ((apiKey: string) => Promise<Model[]>) | null;
    defaultModels: Model[];
    pricing: Record<string, PricingEntry>;
    validateKey?: (apiKey: string) => Promise<boolean>;
}
