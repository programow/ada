import { createElevenLabs } from '@ai-sdk/elevenlabs';
import type { ProviderConfig } from './types';

export const elevenlabsConfig: ProviderConfig = {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    logoSrc: '/logos/elevenlabs.svg',
    docsUrl: 'https://elevenlabs.io/docs/capabilities/speech-to-text',
    apiKeyHelpUrl: 'https://elevenlabs.io/app/settings/api-keys',
    pricingDocsUrl: 'https://elevenlabs.io/pricing',
    makeModel: (modelId, apiKey) => createElevenLabs({ apiKey }).transcription(modelId),
    listModels: null,
    defaultModels: [{ id: 'scribe_v1', displayName: 'Scribe v1' }],
    pricing: {
        scribe_v1: { perMinuteUSD: 0.00667, lastUpdated: '2026-05-03' },
    },
};
