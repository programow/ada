import { createGroq } from '@ai-sdk/groq';
import type { ProviderConfig } from './types';

export const groqConfig: ProviderConfig = {
    id: 'groq',
    name: 'Groq',
    logoSrc: '/logos/groq.svg',
    docsUrl: 'https://console.groq.com/docs/speech-text',
    apiKeyHelpUrl: 'https://console.groq.com/keys',
    pricingDocsUrl: 'https://groq.com/pricing/',
    makeModel: (modelId, apiKey) => createGroq({ apiKey }).transcription(modelId),
    listModels: null,
    defaultModels: [{ id: 'whisper-large-v3', displayName: 'Whisper Large v3' }],
    pricing: {
        'whisper-large-v3': { perMinuteUSD: 0.000185, lastUpdated: '2026-05-03' },
    },
};
