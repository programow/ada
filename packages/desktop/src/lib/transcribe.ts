import type { TranscriptionModel } from 'ai';
import { experimental_transcribe as transcribeAi } from 'ai';
import { PROVIDERS } from '../providers';
import { getActiveModelConfigId, getModelConfigWithApiKey } from './db';
import { vox } from './invoke';

export async function transcribe(audio: Blob): Promise<string> {
    const activeId = await getActiveModelConfigId();
    if (!activeId) throw new Error('No model selected');
    const cfg = await getModelConfigWithApiKey(activeId);
    if (!cfg) throw new Error(`Active model config ${activeId} no longer exists`);
    const provider = PROVIDERS.find((p) => p.id === cfg.providerId);
    if (!provider) throw new Error(`Unknown provider: ${cfg.providerId}`);
    const apiKey = await vox.getSecret(cfg.apiKeyId);
    if (!apiKey) throw new Error(`No API key found in keychain for ${cfg.apiKeyNickname}`);
    const model = provider.makeModel(cfg.modelId, apiKey);
    const { text } = await transcribeAi({
        model: model as TranscriptionModel,
        audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return text;
}
