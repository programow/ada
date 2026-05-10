import { getActiveModelConfigId, getModelConfigWithApiKey, saveTranscription } from './db';
import type { vox as voxApi } from './invoke';
import type { transcribe as transcribeFn } from './transcribe';

export type RecordingState =
    | { kind: 'idle' }
    | { kind: 'recording'; sessionId: string; startedAt: number }
    | { kind: 'transcribing' }
    | { kind: 'error'; message: string };

export interface RecordingDeps {
    vox: Pick<
        typeof voxApi,
        | 'startRecording'
        | 'stopRecording'
        | 'pasteText'
        | 'checkMicrophonePermission'
        | 'requestMicrophonePermission'
    >;
    transcribe: typeof transcribeFn;
    /** Persist a finished transcription. Defaults to db.saveTranscription. */
    saveTranscription?: typeof saveTranscription;
    /** Resolve the active model config for the history record. Defaults to db lookup. */
    resolveActiveConfig?: () => Promise<{ providerId: string; modelId: string } | null>;
}

export type SetState = (next: RecordingState) => void;

function errMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

async function startFromIdle(deps: RecordingDeps, setState: SetState): Promise<void> {
    try {
        let permission = await deps.vox.checkMicrophonePermission();
        if (permission === 'NotDetermined') {
            permission = await deps.vox.requestMicrophonePermission();
        }
        if (permission !== 'Granted') {
            setState({
                kind: 'error',
                message:
                    'Microphone permission is required. Grant it in System Settings and try again.',
            });
            return;
        }
        const sessionId = await deps.vox.startRecording();
        setState({ kind: 'recording', sessionId, startedAt: Date.now() });
    } catch (e) {
        setState({ kind: 'error', message: errMessage(e) });
    }
}

async function defaultResolveActiveConfig(): Promise<{
    providerId: string;
    modelId: string;
} | null> {
    const activeId = await getActiveModelConfigId();
    if (!activeId) return null;
    const cfg = await getModelConfigWithApiKey(activeId);
    if (!cfg) return null;
    return { providerId: cfg.providerId, modelId: cfg.modelId };
}

async function stopAndTranscribe(
    state: Extract<RecordingState, { kind: 'recording' }>,
    deps: RecordingDeps,
    setState: SetState,
): Promise<void> {
    try {
        const bytes = await deps.vox.stopRecording(state.sessionId);
        const durationMs = Math.max(0, Date.now() - state.startedAt);
        setState({ kind: 'transcribing' });
        const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
        const text = await deps.transcribe(blob);
        await deps.vox.pasteText(text);

        // Persist after paste succeeds. A history-write failure must not
        // un-paste the text, so swallow + log instead of bubbling up.
        const save = deps.saveTranscription ?? saveTranscription;
        const resolveConfig = deps.resolveActiveConfig ?? defaultResolveActiveConfig;
        try {
            const cfg = await resolveConfig();
            if (cfg) {
                await save({
                    text,
                    durationMs,
                    providerId: cfg.providerId,
                    modelId: cfg.modelId,
                });
            }
        } catch (saveErr) {
            console.error('saveTranscription failed', saveErr);
        }

        setState({ kind: 'idle' });
    } catch (e) {
        setState({ kind: 'error', message: errMessage(e) });
    }
}

export async function toggle(
    state: RecordingState,
    deps: RecordingDeps,
    setState: SetState,
): Promise<void> {
    switch (state.kind) {
        case 'idle':
            await startFromIdle(deps, setState);
            return;
        case 'recording':
            await stopAndTranscribe(state, deps, setState);
            return;
        case 'transcribing':
            // Ignore — already in flight.
            return;
        case 'error':
            await startFromIdle(deps, setState);
            return;
    }
}
