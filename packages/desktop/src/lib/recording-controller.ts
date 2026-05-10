import type { vox as voxApi } from './invoke';
import type { transcribe as transcribeFn } from './transcribe';

export type RecordingState =
    | { kind: 'idle' }
    | { kind: 'recording'; sessionId: string }
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
        setState({ kind: 'recording', sessionId });
    } catch (e) {
        setState({ kind: 'error', message: errMessage(e) });
    }
}

async function stopAndTranscribe(
    state: Extract<RecordingState, { kind: 'recording' }>,
    deps: RecordingDeps,
    setState: SetState,
): Promise<void> {
    try {
        const bytes = await deps.vox.stopRecording(state.sessionId);
        setState({ kind: 'transcribing' });
        const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
        const text = await deps.transcribe(blob);
        await deps.vox.pasteText(text);
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
