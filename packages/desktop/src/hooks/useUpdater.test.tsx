import type { DownloadEvent } from '@tauri-apps/plugin-updater';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type UpdaterDeps, useUpdater } from './useUpdater';

type DownloadHandler = (event: DownloadEvent) => void;

function makeUpdate(version: string, run?: (handler: DownloadHandler) => Promise<void>) {
    return {
        version,
        downloadAndInstall: vi.fn(async (handler?: DownloadHandler) => {
            if (run && handler) await run(handler);
        }),
        // The other Update fields aren't read by the hook; cast keeps the test
        // honest about that without dragging in the full Tauri type surface.
    } as unknown as Awaited<ReturnType<UpdaterDeps['check']>>;
}

function makeDeps(overrides: Partial<UpdaterDeps> = {}): UpdaterDeps {
    return {
        check: vi.fn(async () => null) as unknown as UpdaterDeps['check'],
        restartApp: vi.fn(async () => {}),
        ...overrides,
    };
}

describe('useUpdater', () => {
    it('starts idle', () => {
        const { result } = renderHook(() => useUpdater({ deps: makeDeps() }));
        expect(result.current.status).toEqual({ kind: 'idle' });
    });

    it('reports up-to-date when check() resolves to null', async () => {
        const deps = makeDeps();
        const { result } = renderHook(() => useUpdater({ deps }));
        await act(async () => {
            await result.current.checkForUpdates();
        });
        expect(result.current.status).toEqual({ kind: 'up-to-date' });
    });

    it('reports available with version when check() returns an Update', async () => {
        const deps = makeDeps({
            check: vi.fn(async () => makeUpdate('0.2.0')) as unknown as UpdaterDeps['check'],
        });
        const { result } = renderHook(() => useUpdater({ deps }));
        await act(async () => {
            await result.current.checkForUpdates();
        });
        expect(result.current.status).toEqual({ kind: 'available', version: '0.2.0' });
    });

    it('reports error when check() throws', async () => {
        const deps = makeDeps({
            check: vi.fn(async () => {
                throw new Error('network down');
            }) as unknown as UpdaterDeps['check'],
        });
        const { result } = renderHook(() => useUpdater({ deps }));
        await act(async () => {
            await result.current.checkForUpdates();
        });
        expect(result.current.status).toEqual({ kind: 'error', message: 'network down' });
    });

    it('does nothing on install when no update has been resolved', async () => {
        const deps = makeDeps();
        const { result } = renderHook(() => useUpdater({ deps }));
        await act(async () => {
            await result.current.installAndRestart();
        });
        expect(result.current.status).toEqual({ kind: 'idle' });
        expect(deps.restartApp).not.toHaveBeenCalled();
    });

    it('progresses through downloading → installing → restart', async () => {
        const update = makeUpdate('0.2.0', async (handler: DownloadHandler) => {
            handler({ event: 'Started', data: { contentLength: 1000 } });
            handler({ event: 'Progress', data: { chunkLength: 500 } });
            handler({ event: 'Progress', data: { chunkLength: 500 } });
            handler({ event: 'Finished' });
        });
        const deps = makeDeps({
            check: vi.fn(async () => update) as unknown as UpdaterDeps['check'],
        });
        const { result } = renderHook(() => useUpdater({ deps }));
        await act(async () => {
            await result.current.checkForUpdates();
        });
        await act(async () => {
            await result.current.installAndRestart();
        });
        await waitFor(() => {
            expect(deps.restartApp).toHaveBeenCalledTimes(1);
        });
        // biome-ignore lint/style/noNonNullAssertion: makeUpdate always returns non-null
        expect(update!.downloadAndInstall).toHaveBeenCalledTimes(1);
    });

    it('surfaces an error when downloadAndInstall throws', async () => {
        const update = {
            version: '0.2.0',
            downloadAndInstall: vi.fn(async () => {
                throw new Error('signature mismatch');
            }),
        } as unknown as Awaited<ReturnType<UpdaterDeps['check']>>;
        const deps = makeDeps({
            check: vi.fn(async () => update) as unknown as UpdaterDeps['check'],
        });
        const { result } = renderHook(() => useUpdater({ deps }));
        await act(async () => {
            await result.current.checkForUpdates();
        });
        await act(async () => {
            await result.current.installAndRestart();
        });
        expect(result.current.status).toEqual({
            kind: 'error',
            message: 'signature mismatch',
        });
        expect(deps.restartApp).not.toHaveBeenCalled();
    });
});
