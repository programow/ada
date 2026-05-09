import { invoke } from '@tauri-apps/api/core';
import type { TranscriptionModel } from 'ai';
import { experimental_transcribe as transcribeAi } from 'ai';
import { PROVIDERS } from '../providers';

export async function transcribe(audio: Blob): Promise<string> {
    const activeProviderId = await invoke<string>('get_setting', {
        key: 'activeProviderId',
    });
    const activeModelId = await invoke<string>('get_setting', {
        key: 'activeModelId',
    });
    const provider = PROVIDERS.find((p) => p.id === activeProviderId);
    if (!provider) throw new Error(`Unknown provider: ${activeProviderId}`);
    const apiKey = await invoke<string | null>('get_secret', {
        providerId: provider.id,
    });
    if (!apiKey) throw new Error(`No API key configured for provider ${provider.name}`);
    const model = provider.makeModel(activeModelId, apiKey);
    const { text } = await transcribeAi({
        model: model as TranscriptionModel,
        audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return text;
}
