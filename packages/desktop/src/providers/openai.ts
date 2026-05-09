import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderConfig } from './types';

export const openaiConfig: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    logoSrc: '/logos/openai.svg',
    docsUrl: 'https://platform.openai.com/docs/guides/speech-to-text',
    apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
    pricingDocsUrl: 'https://openai.com/api/pricing/',
    makeModel: (modelId, apiKey) => createOpenAI({ apiKey }).transcription(modelId),
    listModels: null,
    defaultModels: [{ id: 'whisper-1', displayName: 'Whisper 1' }],
    pricing: {
        'whisper-1': { perMinuteUSD: 0.006, lastUpdated: '2026-05-03' },
    },
};
