import { load } from '@tauri-apps/plugin-store';

/**
 * Filename for the onboarding-state store. Stored in `app_data_dir` per
 * Tauri's plugin-store convention. The `.bin` extension is the
 * plugin-store default (msgpack-encoded); kept short and namespaced under
 * the app's own data directory.
 *
 * Versioned (`_v1`) so a future onboarding redesign can introduce a new
 * key without colliding with existing user state.
 */
const STORE_PATH = 'vox-era-onboarding.bin';
const STORE_KEY = 'onboarding_v1_completed';

/**
 * Returns true if the user has previously completed (or skipped)
 * onboarding on this machine. The store auto-saves on modification — the
 * default debounce is 100ms.
 *
 * Returns `false` on first launch (key absent) and on any plugin-store
 * error — we'd rather show the onboarding screen redundantly than skip
 * it because a transient I/O blip swallowed the read.
 */
export async function isOnboardingCompleted(): Promise<boolean> {
    try {
        const store = await load(STORE_PATH);
        const value = await store.get<boolean>(STORE_KEY);
        return value === true;
    } catch (e) {
        console.error('isOnboardingCompleted: store load failed', e);
        return false;
    }
}

/**
 * Persists that the user completed (or explicitly skipped) onboarding.
 * Subsequent launches skip the onboarding screen and route straight to
 * the main UI.
 */
export async function markOnboardingCompleted(): Promise<void> {
    const store = await load(STORE_PATH);
    await store.set(STORE_KEY, true);
    await store.save();
}
