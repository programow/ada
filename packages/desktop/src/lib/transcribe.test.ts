import * as core from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('ai', () => ({
    experimental_transcribe: vi.fn(async () => ({ text: 'hello world' })),
}));

import { PROVIDERS } from '../providers';
import { transcribe } from './transcribe';

describe('transcribe orchestration', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('throws when no key configured for active provider', async () => {
        vi.mocked(core.invoke)
            .mockResolvedValueOnce('openai') // get_setting activeProviderId
            .mockResolvedValueOnce('whisper-1') // get_setting activeModelId
            .mockResolvedValueOnce(null); // get_secret returns null
        await expect(transcribe(new Blob([new Uint8Array([1, 2, 3])]))).rejects.toThrow(
            /No API key/,
        );
    });

    it('returns text from AI SDK when key is configured', async () => {
        vi.mocked(core.invoke)
            .mockResolvedValueOnce('openai')
            .mockResolvedValueOnce('whisper-1')
            .mockResolvedValueOnce('sk-test');
        const result = await transcribe(new Blob([new Uint8Array([1, 2, 3])]));
        expect(result).toBe('hello world');
    });

    it('throws on unknown provider id', async () => {
        vi.mocked(core.invoke)
            .mockResolvedValueOnce('does-not-exist')
            .mockResolvedValueOnce('whatever');
        await expect(transcribe(new Blob([new Uint8Array([1, 2, 3])]))).rejects.toThrow(
            /Unknown provider/,
        );
    });

    it('PROVIDERS contains the 9 v1 provider ids', () => {
        const ids = PROVIDERS.map((p) => p.id).sort();
        expect(ids).toEqual([
            'assemblyai',
            'azure-openai',
            'deepgram',
            'elevenlabs',
            'fal',
            'gladia',
            'groq',
            'openai',
            'revai',
        ]);
    });
});
