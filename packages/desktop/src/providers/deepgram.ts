import { createDeepgram } from '@ai-sdk/deepgram';
import type { ProviderConfig } from './types';

export const deepgramConfig: ProviderConfig = {
    id: 'deepgram',
    name: 'Deepgram',
    logoSrc: '/logos/deepgram.svg',
    docsUrl: 'https://developers.deepgram.com/docs/pre-recorded-audio',
    apiKeyHelpUrl: 'https://console.deepgram.com/',
    pricingDocsUrl: 'https://deepgram.com/pricing',
    makeModel: (modelId, apiKey) => createDeepgram({ apiKey }).transcription(modelId),
    listModels: null,
    defaultModels: [{ id: 'nova-3', displayName: 'Nova 3' }],
    pricing: {
        'nova-3': { perMinuteUSD: 0.0043, lastUpdated: '2026-05-03' },
    },
};
