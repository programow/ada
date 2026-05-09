import { createAssemblyAI } from '@ai-sdk/assemblyai';
import type { ProviderConfig } from './types';

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
    defaultModels: [{ id: 'best', displayName: 'Best' }],
    pricing: {
        best: { perMinuteUSD: 0.00617, lastUpdated: '2026-05-03' },
    },
};
