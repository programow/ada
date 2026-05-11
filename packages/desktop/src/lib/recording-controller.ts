import { getActiveModelConfigId, getModelConfigWithApiKey, saveTranscription } from './db';
import type { vox as voxApi } from './invoke';
import {
    ERR_ACCESSIBILITY_REQUIRED,
    ERR_MIC_DENIED,
    ERR_WAYLAND_PASTE_UNSUPPORTED,
} from './markers';
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

/**
 * Explicitly gate on mic permission BEFORE calling `start_recording`.
 *
 * cpal's implicit permission prompt (which fires the first time `build_input_stream`
 * touches an AVAudioEngine input on macOS) does not reliably trigger the system
 * dialog on production-signed builds — see tauri-apps/tauri#9928. We sidestep
 * that path entirely by calling `AVCaptureDevice.requestAccess` ourselves via
 * the `request_microphone_permission` command before the cpal code runs.
 *
 * The returned `mic-denied:` prefix mirrors the `accessibility-required:` marker
 * used elsewhere so the UI layer can recognise structured permission errors.
 */
async function ensureMicPermission(
    deps: RecordingDeps,
): Promise<{ ok: true } | { ok: false; reason: string }> {
    const state = await deps.vox.checkMicrophonePermission();
    if (state === 'Granted') return { ok: true };
    if (state === 'Denied') {
        return {
            ok: false,
            reason: `${ERR_MIC_DENIED} Microphone access is blocked. Open System Settings → Privacy & Security → Microphone and enable Vox Era.`,
        };
    }
    // NotDetermined — trigger the OS prompt now (via AVCaptureDevice.requestAccess
    // in the Rust side), not later when cpal opens the input stream.
    const after = await deps.vox.requestMicrophonePermission();
    if (after === 'Granted') return { ok: true };
    return {
        ok: false,
        reason: `${ERR_MIC_DENIED} Microphone permission was not granted.`,
    };
}

async function startFromIdle(deps: RecordingDeps, setState: SetState): Promise<void> {
    try {
        const gate = await ensureMicPermission(deps);
        if (!gate.ok) {
            setState({ kind: 'error', message: gate.reason });
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

        let pasteFailed: string | null = null;
        try {
            await deps.vox.pasteText(text);
        } catch (pasteErr) {
            // Don't lose the transcription — the text is on the clipboard
            // either way. We just couldn't synthesise Cmd+V. Surface the
            // error to the UI but still save to history.
            pasteFailed = errMessage(pasteErr);
            console.error('pasteText failed', pasteErr);
        }

        // Persist after paste attempt (success or failure — the transcription
        // still happened and the user paid for it). A history-write failure
        // must not un-paste the text, so swallow + log instead of bubbling up.
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

        if (pasteFailed) {
            // Translate well-known error markers into helpful UI messages.
            // Marker prefixes are defined in `@/lib/markers` (mirrored from
            // `src-tauri/src/markers.rs`) so a Rust rename can't silently
            // degrade UX — the contract test enforces agreement.
            let friendly: string;
            if (pasteFailed.includes(ERR_ACCESSIBILITY_REQUIRED)) {
                friendly =
                    "Couldn't paste — Vox Era needs Accessibility permission. Text is on your clipboard; press Cmd+V to paste manually. Grant Vox Era in System Settings → Privacy & Security → Accessibility, then try again.";
            } else if (pasteFailed.includes(ERR_WAYLAND_PASTE_UNSUPPORTED)) {
                friendly =
                    "Couldn't paste — Wayland blocks synthetic keystrokes. Text is on your clipboard; press Ctrl+V to paste it.";
            } else {
                friendly = `Couldn't paste: ${pasteFailed}. The text is on your clipboard; press Cmd+V to paste it.`;
            }
            setState({ kind: 'error', message: friendly });
            return;
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
