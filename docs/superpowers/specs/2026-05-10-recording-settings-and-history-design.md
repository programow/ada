# Vox Era — Recording Settings & Transcription History — Design

**Date:** 2026-05-10
**Status:** Draft (awaiting user review)
**Author branch:** `execution`
**Depends on:** Plans A, B, C delivered; PR #4 (Luan's recording loop) merged into `execution`.
**Blocks:** none. Plan D (release pipeline) is independent.

---

## 1. Goal

Wire two Settings panels that ship today as placeholder cards (`opacity-60` + `ComingSoonBadge`) and complete the History feature surface that PR #4 only partially delivered:

1. **Settings → Recording** — microphone picker (with graceful fallback) and a customizable global hotkey.
2. **Settings → History + History tab + Dashboard** — retention picker, Clear all, per-row delete with 5-second undo, per-row + bulk export, and Dashboard stats wired to the database.

Non-goals (deferred):

- Fn-key on macOS as the default hotkey (`shortcut/macos_fn.rs` exists but isn't reachable from the picker yet)
- Hotkey conflict detection / system-reserved combo warnings
- Push-to-talk vs toggle modes (v1 is toggle only)
- Per-app hotkey scoping
- Audio level meter / waveform in the Test Recording
- Microphone calibration

---

## 2. Decisions

| Question | Decision |
|---|---|
| Hotkey customization | Single configurable combo with click-to-record capture UX |
| Mic picker default | System default by default; explicit picker; missing device falls back to default with a toast |
| History scope | Full: retention sweep, Clear all, per-row delete + undo, Dashboard stats, export |
| Delete UX | Per-row soft + 5-sec undo; Clear-all hard with confirmation; export per row as .txt + .md |

---

## 3. Architecture overview

```
            ┌───────────────────────────────────────┐
            │  React webview (main window)             │
            │                                          │
            │  SettingsRecording  ─┐                    │
            │                      │ lib/db.ts          │
            │  SettingsHistory   ─┼─► app_state CRUD    │
            │                      │ transcriptions DAO │
            │  Dashboard         ─┘                    │
            │                                          │
            │  History (tab)     ─── listTranscriptions │
            │                                          │
            │  HotkeyInput (new component)             │
            └─────────────┬────────────────────────────┘
                          │ Tauri invoke
                          ▼
            ┌───────────────────────────────────────┐
            │  Rust backend                            │
            │                                          │
            │  list_audio_input_devices  (NEW)         │
            │  start_recording(deviceId?)  (MODIFIED)  │
            │  register_hotkey(combo)    (NEW)         │
            │  unregister_hotkey()        (NEW)        │
            │                                          │
            │  Removed: history/{repo,retention,        │
            │           stats}.rs (dead code from        │
            │           Plan B Section 6 — PR #4 moved   │
            │           DB ops to JS via plugin-sql)    │
            └───────────────────────────────────────┘
```

Persistence stays in the existing `app_state` key-value table to mirror Luan's pattern (`overlay_enabled`, `overlay_x/y`, `active_model_config_id`). No new SQL tables; one new migration adding three new keys is unnecessary because `app_state` already accepts arbitrary keys. No schema migration is required for the recording / history features beyond what's already in `0002_provider_configs.sql`.

---

## 4. Recording — Hotkey + Mic picker

### 4.1 New `app_state` keys

| key | type | default | meaning |
|---|---|---|---|
| `selected_mic_device_id` | text \| null | null | cpal device id; `null` means "use system default at capture time" |
| `hotkey_combo` | text | platform-aware: `Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (else) | persisted combo string for the global shortcut |

Each key is independently optional; reading an unset key returns the default.

### 4.2 New Tauri commands (Rust)

```rust
#[tauri::command]
pub fn list_audio_input_devices() -> Result<Vec<AudioDeviceInfo>, String> { ... }

#[tauri::command]
pub fn register_hotkey(state: State<'_, AppState>, combo: String) -> Result<(), String> { ... }

#[tauri::command]
pub fn unregister_hotkey(state: State<'_, AppState>) -> Result<(), String> { ... }

#[derive(serde::Serialize)]
pub struct AudioDeviceInfo {
    pub id: String,        // cpal device name (stable on macOS; less stable on Linux ALSA)
    pub label: String,     // user-visible (often equals id)
    pub is_default: bool,  // matches cpal::Host::default_input_device at enumeration time
}
```

`list_audio_input_devices` enumerates `cpal::host::default_host().input_devices()`, marks the device whose name matches `default_input_device()` as default, and returns the list. On enumeration failure it returns the empty list rather than erroring (so the UI can still render "System default" as the only option).

### 4.3 Modified Tauri command

```rust
#[tauri::command]
pub fn start_recording(
    state: State<'_, AppState>,
    device_id: Option<String>,  // NEW — None means system default
) -> Result<String, String>
```

The `MicrophoneSource` trait gains:

```rust
fn start_capture_with_device(&self, device_id: Option<&str>) -> Result<CaptureSession, AudioError>;
```

The existing `start_capture()` becomes a thin wrapper for `start_capture_with_device(None)`. If a named device is passed but cpal can't find it (user unplugged the mic between Settings and pressing the hotkey), `MicrophoneSource` returns `AudioError::DeviceUnavailable(name)`. The Tauri command translates that into a structured error the JS catches; the React side emits a `vox-era://device-fallback` event the UI shows as a toast ("Mic 'Shure SM7B' not available — using system default.") and retries `start_recording(None)` automatically.

### 4.4 Hotkey re-registration flow

`lib.rs` setup currently calls `app.global_shortcut().on_shortcut(default_record_shortcut(), ...)` directly. Change to:

1. **App startup:** the JS side calls `vox.registerHotkey(persistedCombo)` immediately after the DB plugin is loaded. The Rust `register_hotkey` command:
   - Parses `combo` via the new `shortcut::parse` module.
   - Unregisters any prior shortcut held by this app (idempotent).
   - Registers the new shortcut to emit `vox-era://shortcut-toggle` on `Pressed`.
   - Persists the combo string (the JS side did the DB write; Rust just trusts the string is what the user wants).
2. **Settings → Recording change:** the `HotkeyInput` capture flow calls `vox.registerHotkey(newCombo)`. Same Rust path.
3. **Quit:** Tauri tears down the global shortcut plugin; no explicit cleanup needed.

### 4.5 Combo parser (`src-tauri/src/shortcut/parse.rs`)

New module exposing:

```rust
pub fn parse_combo(s: &str) -> Result<Shortcut, ParseError>;
pub fn format_combo(shortcut: &Shortcut) -> String;

pub enum ParseError {
    NoModifier,           // e.g. "K" alone
    NoKey,                // e.g. "Cmd+Shift"
    UnknownKey(String),   // e.g. "Cmd+Shift+Foobar"
    Empty,
}
```

Format: `"Cmd+Shift+Space"` with stable order (Cmd → Ctrl → Alt → Shift → Key). Mac uses `Cmd`; Windows/Linux uses `Ctrl` for the same `Modifiers::META | Modifiers::CONTROL` slot.

Key names cover the common set: alphanumeric, function keys F1–F12, arrows, Space, Enter, Escape, Tab, Backspace, Delete. Round-trip property: `parse → format → parse` returns the same `Shortcut`.

### 4.6 React UI (`SettingsRecording.tsx`)

Drop `ComingSoonBadge` and `opacity-60`. Wire all callbacks.

```
┌─ Recording ──────────────────────────────┐
│ Hotkey                                       │
│ [ Cmd+Shift+Space        ] [ Capture… ]      │
│                                              │
│ Microphone                                   │
│ [ System default ▾          ] [ Refresh ]    │
│                                              │
│                                [ Test ▶ ]    │
└──────────────────────────────────────────┘
```

- **Hotkey field:** the new `<HotkeyInput>` component (§4.7).
- **Microphone select:** populated from `vox.listAudioInputDevices()` on mount; "System default" is always the first option (`value=""`). Changes immediately persist to `selected_mic_device_id`. "Refresh" re-enumerates without saving.
- **Test recording button:** calls `vox.startRecording(device || undefined)` → `setTimeout(3000)` → `vox.stopRecording(sessionId)` → builds a `Blob` from bytes → plays via a temporary `<audio>` element so the user can verify the mic captured anything.

### 4.7 `HotkeyInput` component (`src/components/HotkeyInput.tsx`)

Stateful: `idle | capturing | captured`.

- **idle:** displays the current combo as text + a "Capture…" button.
- **capturing:** "Press a key combo…" placeholder, listens to `keydown` on `window`. Modifier-only presses are ignored. The first non-modifier key with at least one modifier triggers capture: format the combo, call `onChange(combo)`, transition to `captured`.
- **captured:** shows the new combo briefly, then transitions back to `idle`.
- **Esc** at any time cancels and reverts to the previous combo.

Formatting handles platform conventions: macOS shows `⌘⇧␣` (visual), Windows/Linux shows `Ctrl+Shift+Space` (text). Both serialize to the same string for persistence.

---

## 5. History — Retention, Delete, Stats, Export

### 5.1 New `app_state` keys

| key | type | default | meaning |
|---|---|---|---|
| `history_retention_days` | text | `365` | days of transcriptions to keep; `-1` means forever |
| `history_last_sweep` | text | unset | unix-ms of the last successful retention sweep |

### 5.2 New `lib/db.ts` functions

```ts
// Per-row
export async function softDeleteTranscription(id: number): Promise<void>;
export async function restoreTranscription(id: number): Promise<void>;     // for undo
export async function hardDeleteTranscription(id: number): Promise<void>;

// Bulk
export async function clearAllTranscriptions(): Promise<{ deleted: number }>; // hard delete

// Retention
export async function getRetentionDays(): Promise<number>;          // 30 | 90 | 365 | -1
export async function setRetentionDays(days: number): Promise<void>;
export async function purgeOlderThan(retentionDays: number): Promise<{
    softDeleted: number;
    hardDeleted: number;
}>;

// Stats
export interface HistoryStats {
    totalWords: number;
    streakDays: number;             // consecutive days ending today with at least one transcription
    avgWPM: number | null;          // null when no transcriptions have duration_ms > 0
    timeSavedMinutes: number;       // (totalWords / 45) - (totalDurationMs / 60000); 45 wpm baseline
    topProvider: string | null;
}
export async function getHistoryStats(
    range: 'week' | 'month' | 'all'
): Promise<HistoryStats>;
```

### 5.3 Retention sweep

`App.tsx` adds a `useEffect`:

1. On mount: read `history_retention_days` and `history_last_sweep`. If never swept (key unset) or last sweep > 24h ago, run `purgeOlderThan(retentionDays)` and write `Date.now()` to `history_last_sweep`.
2. Schedule `setTimeout(nextSweep, 24h - elapsed)` so the next sweep fires roughly daily as long as the app stays open. If the app is closed and reopened, the on-mount path catches up.

`purgeOlderThan(retentionDays)` semantics (matches spec §6.6):

```sql
-- Soft-delete rows older than the retention window:
UPDATE transcriptions
SET deleted_at = ?
WHERE created_at < ? AND deleted_at IS NULL;

-- Hard-delete rows that have been soft-deleted for more than 30 days
-- (the undo grace window):
DELETE FROM transcriptions
WHERE deleted_at IS NOT NULL AND deleted_at < ?;
```

When `retentionDays === -1` (forever), the soft-delete step is skipped; only the 30-day grace cleanup of already-soft-deleted rows runs.

### 5.4 History tab UX changes (`History.tsx`)

Each row gains:

- **"Copy"** button — writes `text` to clipboard via `navigator.clipboard.writeText`.
- **"Export ▾"** dropdown — ".txt" or ".md". Builds the content client-side, creates a `Blob`, triggers a download via a synthetic `<a download>` click. (No filesystem permission needed because it's a browser save dialog.)
- **"Delete"** button — calls `softDeleteTranscription(id)`, removes the row from local state, shows a Toast: `"Deleted. Undo (5s)"`. Clicking "Undo" calls `restoreTranscription(id)` and adds the row back. After 5 sec the toast auto-dismisses.

New at the filtered-view header: **"Export filtered"** button — builds a single bundled `.md` file with one H2 section per row.

### 5.5 Settings → History UX changes (`SettingsHistory.tsx`)

Drop `ComingSoonBadge` + `opacity-60`. Wire callbacks.

```
┌─ History ────────────────────────────────┐
│ Retain transcriptions for                  │
│ [ 365 days ▾ ]                              │
│   - 30 days                                │
│   - 90 days                                │
│   - 365 days  (default)                    │
│   - Forever                                │
│                                            │
│                              [ Clear all ] │
└──────────────────────────────────────┘
```

- **Retain for** is a `<select>` with the four options. Changing it persists `history_retention_days` and triggers a one-shot `purgeOlderThan(newDays)`.
- **Clear all** opens a confirmation dialog: `"Delete N transcriptions? This cannot be undone."`. On confirm, calls `clearAllTranscriptions()`. The current count comes from a quick `SELECT COUNT(*) FROM transcriptions WHERE deleted_at IS NULL` rendered in the dialog.

### 5.6 Dashboard stats (`Dashboard.tsx`)

Five read-only cards laid out in a grid. Wired via `getHistoryStats('all')` on mount + on every transition to `recordingState.kind === 'idle'` (so the numbers refresh after each completed transcription).

Metrics:

1. **Total words** — lifetime sum across non-deleted rows.
2. **Current streak (days)** — consecutive days ending today with at least one transcription.
3. **Avg WPM** — across all rows where `duration_ms > 0`. Null state: "—".
4. **Time saved (min)** — `(totalWords / 45) - (totalDurationMs / 60000)`. Negative values clamp to 0 (rare; means dictation was slower than typing).
5. **Top provider** — most-used `provider_id` by row count.

Loading state shows a skeleton shimmer for ~50ms; error state shows "Stats unavailable" + a Retry button.

### 5.7 Export format

Per-row .txt:

```
<text>
```

Per-row .md:

```markdown
# Transcription · <ISO date>

- Provider: <provider id>
- Model: <model id>
- Duration: <Ns>
- Words: <N>

> <text>
```

Bulk .md (one H2 section per row, ordered newest first; same body shape as per-row .md but the top header becomes `# Vox Era — Transcription Export · <range description>` and each entry uses `## ` instead of `# `).

---

## 6. Removed code

After PR #4 moved DB ownership to JS via `tauri-plugin-sql`, the Rust `history` modules became dead code:

- `packages/desktop/src-tauri/src/history/repo.rs`
- `packages/desktop/src-tauri/src/history/retention.rs`
- `packages/desktop/src-tauri/src/history/stats.rs`

Keep `packages/desktop/src-tauri/src/history/mod.rs` ONLY for `DB_URL` and `migrations()` (consumed by `lib.rs`'s `tauri_plugin_sql::Builder::add_migrations`). Strip its DAO re-exports.

The `Cargo.toml` `sqlx` dependency stays — `tauri-plugin-sql` uses it transitively. We don't keep our own pool any more.

---

## 7. Test plan

### 7.1 Rust

- `audio::microphone::tests::list_devices_returns_at_least_default()` — cpal always returns the default on the test runner (CI macOS / Ubuntu / Windows).
- `shortcut::parse::tests::roundtrip_combo_string()` — `parse → format → parse` is a fixed point for every well-formed combo.
- `shortcut::parse::tests::rejects_invalid_combos()` — covers `NoModifier`, `NoKey`, `UnknownKey`, `Empty`.

### 7.2 TypeScript / Vitest

- `db.test.ts` extension:
  - `softDeleteTranscription` / `restoreTranscription` / `hardDeleteTranscription` happy paths
  - `purgeOlderThan` covers both soft and hard branches; covers the `-1` (forever) case
  - `getRetentionDays` returns default when unset; persisted value when set
  - `getHistoryStats` over a fixed dataset of mocked rows: total words, streak (continuous + with-gap), avgWPM, time saved, top provider
- `HotkeyInput.test.tsx`: capture flow, modifier-only ignored, Esc cancels, formatting symmetry, two-modifier combos
- `SettingsRecording.test.tsx`: device list renders, persists on change, Test Recording happy path (mocks `vox.startRecording` + `vox.stopRecording`, asserts the audio Blob played)
- `SettingsHistory.test.tsx`: retention picker persists; Clear-all opens dialog, calls `clearAllTranscriptions` on confirm only
- `History.test.tsx`: Delete shows undo Toast; Undo restores; Copy writes to clipboard; Export downloads (mock `URL.createObjectURL`)
- `Dashboard.test.tsx`: renders five cards, refreshes on `recordingState.kind === 'idle'`

### 7.3 Functional

- `tests/functional/recording-settings-flow.test.ts` — register hotkey via Tauri command → simulate the `vox-era://shortcut-toggle` event → the controller fires.
- `tests/functional/history-purge-flow.test.ts` — insert 5 rows with backdated timestamps spanning the retention window → run `purgeOlderThan(30)` → assert the right rows survived in the right state.

---

## 8. Out of scope (deferred)

| Item | Reason |
|---|---|
| Fn-key on macOS | The CGEventTap path exists in `shortcut/macos_fn.rs` but needs the Accessibility-permission UX flow polished; spec §6.10 had this as the macOS default but PR #4 already shipped without it. |
| System-reserved combo detection | Tauri's `register_hotkey` returns an error for already-registered combos; we surface that via toast, but we don't proactively enumerate system combos. |
| Push-to-talk vs toggle | v1 is toggle only. |
| Audio level meter in Test Recording | Would need a continuous capture stream; not blocking. |
| Per-app hotkey scoping | macOS doesn't expose this without a private API. |
| Multi-device export (zip) | Per-row + bulk-md cover the v1 use cases. |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| cpal device id is unstable on Linux ALSA (the same physical mic gets a different name across reboots) | Persist by `(name, host_name)` tuple; fall back to system default with toast on mismatch. The `selected_mic_device_id` becomes `null` automatically the next time the picker is opened with the absent device. |
| User picks a hotkey already held by another app | Tauri's `register_hotkey` errors; we catch and show "Combo already in use — try another." The previous combo stays registered. |
| Sweep runs while a transcription is mid-flight | Sweep only operates on rows with `created_at` more than the retention window, which is days/weeks/months in the past — mid-flight rows are written with current `created_at` and can't be in scope. No locking needed. |
| User rapidly toggles Cmd-Z (undo) on a soft-deleted row | The UI optimistically restores the row; the DB write is idempotent (`UPDATE ... SET deleted_at = NULL WHERE id = ?`); rapid toggle settles to whichever state was last clicked. |
| Stats query slows down at 10k+ rows | All five aggregations are indexed (`idx_transcriptions_created_at`, `idx_transcriptions_provider`); at 10k rows each takes <50ms. We revisit if a real user hits 100k. |

---

## 10. References

- Spec §6.5 (settings schema), §6.6 (history retention + stats), §6.10 (hotkey) — `docs/superpowers/specs/2026-05-03-vox-era-tauri-monorepo-design.md`
- Tauri 2 `tauri-plugin-global-shortcut` — https://tauri.app/plugin/global-shortcut/
- cpal device enumeration — https://docs.rs/cpal/latest/cpal/struct.Host.html#method.input_devices
- React `URL.createObjectURL` for Blob downloads — https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
- Existing `Toast` component (added in commit `2d284fc`) — reused for the undo flow.
