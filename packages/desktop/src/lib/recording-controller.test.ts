import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type RecordingDeps,
    type RecordingState,
    type SetState,
    toggle,
} from './recording-controller';

function makeDeps(): RecordingDeps {
    return {
        vox: {
            startRecording: vi.fn(async () => 'session-1'),
            stopRecording: vi.fn(async () => [82, 73, 70, 70]),
            pasteText: vi.fn(async () => undefined),
            checkMicrophonePermission: vi.fn(async () => 'Granted' as const),
            requestMicrophonePermission: vi.fn(async () => 'Granted' as const),
        },
        transcribe: vi.fn(async () => 'hello world'),
    };
}

function makeSetState(): { setState: SetState; states: RecordingState[] } {
    const states: RecordingState[] = [];
    const setState: SetState = (s) => {
        states.push(s);
    };
    return { setState, states };
}

describe('recording-controller toggle', () => {
    let deps: RecordingDeps;

    beforeEach(() => {
        deps = makeDeps();
    });

    describe('from idle', () => {
        it('starts recording when mic permission is already granted', async () => {
            const { setState, states } = makeSetState();
            await toggle({ kind: 'idle' }, deps, setState);
            expect(deps.vox.checkMicrophonePermission).toHaveBeenCalled();
            expect(deps.vox.requestMicrophonePermission).not.toHaveBeenCalled();
            expect(deps.vox.startRecording).toHaveBeenCalled();
            expect(states).toEqual([{ kind: 'recording', sessionId: 'session-1' }]);
        });

        it('requests permission when undetermined and starts on grant', async () => {
            vi.mocked(deps.vox.checkMicrophonePermission).mockResolvedValueOnce('NotDetermined');
            vi.mocked(deps.vox.requestMicrophonePermission).mockResolvedValueOnce('Granted');
            const { setState, states } = makeSetState();
            await toggle({ kind: 'idle' }, deps, setState);
            expect(deps.vox.requestMicrophonePermission).toHaveBeenCalled();
            expect(states.at(-1)?.kind).toBe('recording');
        });

        it('publishes error and does not start when permission denied', async () => {
            vi.mocked(deps.vox.checkMicrophonePermission).mockResolvedValueOnce('Denied');
            const { setState, states } = makeSetState();
            await toggle({ kind: 'idle' }, deps, setState);
            expect(deps.vox.startRecording).not.toHaveBeenCalled();
            const last = states.at(-1);
            expect(last?.kind).toBe('error');
            if (last?.kind === 'error') expect(last.message).toMatch(/microphone/i);
        });

        it('publishes error when start_recording itself fails', async () => {
            vi.mocked(deps.vox.startRecording).mockRejectedValueOnce(new Error('mic in use'));
            const { setState, states } = makeSetState();
            await toggle({ kind: 'idle' }, deps, setState);
            const last = states.at(-1);
            expect(last?.kind).toBe('error');
            if (last?.kind === 'error') expect(last.message).toMatch(/mic in use/);
        });
    });

    describe('from recording', () => {
        const recState: RecordingState = { kind: 'recording', sessionId: 'session-1' };

        it('stops, publishes transcribing, then idle on the happy path', async () => {
            const { setState, states } = makeSetState();
            await toggle(recState, deps, setState);
            expect(deps.vox.stopRecording).toHaveBeenCalledWith('session-1');
            expect(deps.transcribe).toHaveBeenCalled();
            const blob = vi.mocked(deps.transcribe).mock.calls[0]?.[0];
            expect(blob).toBeInstanceOf(Blob);
            expect(blob?.type).toBe('audio/wav');
            expect(deps.vox.pasteText).toHaveBeenCalledWith('hello world');
            expect(states.map((s) => s.kind)).toEqual(['transcribing', 'idle']);
        });

        it('publishes error if stop_recording fails (no transcribing state)', async () => {
            vi.mocked(deps.vox.stopRecording).mockRejectedValueOnce(new Error('boom'));
            const { setState, states } = makeSetState();
            await toggle(recState, deps, setState);
            expect(states.map((s) => s.kind)).toEqual(['error']);
            expect(deps.transcribe).not.toHaveBeenCalled();
        });

        it('publishes transcribing then error when no model is configured', async () => {
            vi.mocked(deps.transcribe).mockRejectedValueOnce(new Error('No model selected'));
            const { setState, states } = makeSetState();
            await toggle(recState, deps, setState);
            expect(states.map((s) => s.kind)).toEqual(['transcribing', 'error']);
            const last = states.at(-1);
            if (last?.kind === 'error') expect(last.message).toMatch(/No model selected/);
            expect(deps.vox.pasteText).not.toHaveBeenCalled();
        });

        it('publishes error when paste fails', async () => {
            vi.mocked(deps.vox.pasteText).mockRejectedValueOnce(new Error('clipboard locked'));
            const { setState, states } = makeSetState();
            await toggle(recState, deps, setState);
            expect(states.map((s) => s.kind)).toEqual(['transcribing', 'error']);
        });
    });

    describe('from transcribing', () => {
        it('ignores the press (no state changes published)', async () => {
            const { setState, states } = makeSetState();
            await toggle({ kind: 'transcribing' }, deps, setState);
            expect(states).toEqual([]);
            expect(deps.vox.startRecording).not.toHaveBeenCalled();
            expect(deps.vox.stopRecording).not.toHaveBeenCalled();
        });
    });

    describe('from error', () => {
        it('treats next press as a fresh idle press', async () => {
            const { setState, states } = makeSetState();
            await toggle({ kind: 'error', message: 'whatever' }, deps, setState);
            expect(deps.vox.startRecording).toHaveBeenCalled();
            expect(states.at(-1)?.kind).toBe('recording');
        });
    });
});
