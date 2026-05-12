import type { PlatformInfo } from './invoke';

/**
 * Permissions Vox Era cares about. Each value matches a row the onboarding
 * screen can render. Note these are also the keys used by the
 * `check_*_permission` / `request_*_permission` commands — e.g.
 * `microphone` ↔ `check_microphone_permission`.
 */
export type PermissionKey = 'microphone' | 'accessibility' | 'input-monitoring';

/**
 * Informational notice the onboarding screen surfaces alongside the
 * permission rows. Currently the only variant is the Linux/Wayland paste
 * fallback (Wayland blocks synthetic keystrokes, so Vox Era can only copy
 * to clipboard — the user has to press Ctrl+V themselves).
 */
export type OnboardingInfo = { kind: 'wayland-paste-fallback' };

export interface RequiredPermissions {
    /**
     * Permissions the onboarding screen MUST list and the user MUST grant
     * before "Continue" enables. These are the gates without which the
     * corresponding feature does not work at all on this platform.
     */
    required: PermissionKey[];
    /**
     * Soft notices that are surfaced but never block the Continue button.
     * Empty / undefined on platforms with no informational state.
     */
    informational?: OnboardingInfo[];
}

/**
 * Computes which permissions Vox Era requires on the current platform.
 *
 * - **macOS**: Microphone (record), Accessibility (paste keystroke), Input
 *   Monitoring (Fn-key tap). All three are distinct TCC buckets.
 * - **Windows**: just Microphone. There is no AX/Input Monitoring gate
 *   — the Rust stubs return `Granted` unconditionally.
 * - **Linux**: just Microphone (cpal device probe). When the session is
 *   Wayland we additionally surface the paste-fallback notice so the user
 *   isn't surprised when Vox Era can only copy-to-clipboard.
 */
export function requiredPermissions(info: PlatformInfo): RequiredPermissions {
    if (info.os === 'macos') {
        return { required: ['microphone', 'accessibility', 'input-monitoring'] };
    }
    if (info.os === 'windows') {
        return { required: ['microphone'] };
    }
    // linux
    return {
        required: ['microphone'],
        informational: info.isWayland ? [{ kind: 'wayland-paste-fallback' }] : undefined,
    };
}
