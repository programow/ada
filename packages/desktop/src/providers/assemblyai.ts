import { createAssemblyAI } from '@ai-sdk/assemblyai';
import type { Model, ProviderConfig } from './types';

const DEFAULT_MODELS: Model[] = [
    {
        id: 'best',
        displayName: 'Best',
        description: 'Highest accuracy AssemblyAI model tier',
    },
    {
        id: 'nano',
        displayName: 'Nano',
        description: 'Lower-cost AssemblyAI model tier',
    },
];

export const assemblyaiConfig: ProviderConfig = {
    id: 'assemblyai',
    name: 'AssemblyAI',
    logoSrc: '/logos/assemblyai.svg',
    docsUrl: 'https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio',
    apiKeyHelpUrl: 'https://www.assemblyai.com/app/api-keys',
    pricingDocsUrl: 'https://www.assemblyai.com/pricing',
    makeModel: (modelId, apiKey) =>
        createAssemblyAI({ apiKey }).transcription(modelId as 'best' | 'nano'),
    listModels: null,
    defaultModels: DEFAULT_MODELS,
    pricing: {
        best: { perMinuteUSD: 0.00617, lastUpdated: '2026-05-03' },
        nano: { perMinuteUSD: 0.00204, lastUpdated: '2026-05-03' },
    },
};
