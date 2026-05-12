import { createElevenLabs } from '@ai-sdk/elevenlabs';
import type { Model, ProviderConfig } from './types';

const DEFAULT_MODELS: Model[] = [{ id: 'scribe_v1', displayName: 'Scribe v1' }];

interface ElevenLabsModelEntry {
    model_id: string;
    name?: string;
    can_do_transcribe?: boolean;
}

export const elevenlabsConfig: ProviderConfig = {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    logoSrc: '/logos/elevenlabs.svg',
    docsUrl: 'https://elevenlabs.io/docs/capabilities/speech-to-text',
    apiKeyHelpUrl: 'https://elevenlabs.io/app/settings/api-keys',
    pricingDocsUrl: 'https://elevenlabs.io/pricing',
    makeModel: (modelId, apiKey) => createElevenLabs({ apiKey }).transcription(modelId),
    listModels: async (apiKey) => {
        const res = await fetch('https://api.elevenlabs.io/v1/models', {
            headers: { 'xi-api-key': apiKey },
        });
        if (!res.ok) {
            throw new Error(`ElevenLabs listModels failed: ${res.status}`);
        }
        const body = (await res.json()) as ElevenLabsModelEntry[];
        return body
            .filter((m) => m.can_do_transcribe === true)
            .map((m) => ({
                id: m.model_id,
                displayName: m.name ?? m.model_id,
            }));
    },
    defaultModels: DEFAULT_MODELS,
    pricing: {
        scribe_v1: { perMinuteUSD: 0.00667, lastUpdated: '2026-05-03' },
    },
};
