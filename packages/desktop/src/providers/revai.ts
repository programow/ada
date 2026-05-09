import { createRevai } from '@ai-sdk/revai';
import type { ProviderConfig } from './types';

export const revaiConfig: ProviderConfig = {
    id: 'revai',
    name: 'Rev.ai',
    logoSrc: '/logos/revai.svg',
    docsUrl: 'https://docs.rev.ai/api/asynchronous/',
    apiKeyHelpUrl: 'https://www.rev.ai/access-token',
    pricingDocsUrl: 'https://www.rev.ai/pricing',
    makeModel: (modelId, apiKey) =>
        createRevai({ apiKey }).transcription(modelId as 'machine' | 'low_cost' | 'fusion'),
    listModels: null,
    defaultModels: [{ id: 'machine', displayName: 'Machine' }],
    pricing: {
        machine: { perMinuteUSD: 0.025, lastUpdated: '2026-05-03' },
    },
};
