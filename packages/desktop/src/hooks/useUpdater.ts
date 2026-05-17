import { vox } from '@/lib/invoke';
import { type Update, check } from '@tauri-apps/plugin-updater';
import { useCallback, useRef, useState } from 'react';

export type UpdaterStatus =
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'up-to-date' }
    | { kind: 'available'; version: string }
    | { kind: 'downloading'; progress: number }
    | { kind: 'installing' }
    | { kind: 'error'; message: string };

export interface UpdaterDeps {
    check: typeof check;
    restartApp: () => Promise<void>;
}

const defaultDeps: UpdaterDeps = {
    check,
    restartApp: () => vox.restartApp(),
};

export interface UseUpdaterOptions {
    /** Override deps in tests. */
    deps?: UpdaterDeps;
}

export interface UseUpdaterReturn {
    status: UpdaterStatus;
    checkForUpdates: () => Promise<void>;
    installAndRestart: () => Promise<void>;
}

export function useUpdater(options: UseUpdaterOptions = {}): UseUpdaterReturn {
    const deps = options.deps ?? defaultDeps;
    const [status, setStatus] = useState<UpdaterStatus>({ kind: 'idle' });
    // Hold the latest Update across callbacks without forcing re-renders or
    // depending on it in the install callback's closure.
    const updateRef = useRef<Update | null>(null);

    const checkForUpdates = useCallback(async () => {
        setStatus({ kind: 'checking' });
        try {
            const result = await deps.check();
            updateRef.current = result;
            if (result) {
                setStatus({ kind: 'available', version: result.version });
            } else {
                setStatus({ kind: 'up-to-date' });
            }
        } catch (e) {
            setStatus({
                kind: 'error',
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }, [deps]);

    const installAndRestart = useCallback(async () => {
        const update = updateRef.current;
        if (!update) return;
        setStatus({ kind: 'downloading', progress: 0 });
        try {
            let contentLength = 0;
            let downloaded = 0;
            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength ?? 0;
                        downloaded = 0;
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        setStatus({
                            kind: 'downloading',
                            progress: contentLength > 0 ? downloaded / contentLength : 0,
                        });
                        break;
                    case 'Finished':
                        setStatus({ kind: 'installing' });
                        break;
                }
            });
            // On macOS/Linux `downloadAndInstall` returns after staging the
            // new binary; the running process must restart for the user to
            // see the new version. On Windows the installer typically exits
            // the app on its own, but calling restart is a harmless no-op
            // if the process is already gone.
            await deps.restartApp();
        } catch (e) {
            setStatus({
                kind: 'error',
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }, [deps]);

    return { status, checkForUpdates, installAndRestart };
}
