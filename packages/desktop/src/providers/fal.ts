import { createFal } from '@ai-sdk/fal';
import type { ProviderConfig } from './types';

export const falConfig: ProviderConfig = {
    id: 'fal',
    name: 'Fal',
    logoSrc: '/logos/fal.svg',
    docsUrl: 'https://fal.ai/models/fal-ai/whisper',
    apiKeyHelpUrl: 'https://fal.ai/dashboard/keys',
    pricingDocsUrl: 'https://fal.ai/pricing',
    makeModel: (modelId, apiKey) => createFal({ apiKey }).transcription(modelId),
    listModels: null,
    defaultModels: [{ id: 'whisper', displayName: 'Whisper' }],
    pricing: {
        whisper: { perMinuteUSD: 0.005, lastUpdated: '2026-05-03' },
    },
};
