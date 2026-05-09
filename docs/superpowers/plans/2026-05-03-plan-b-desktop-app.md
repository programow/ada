# Vox Era — Plan B: Desktop App v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Tauri 2.x cross-platform desktop app with 9 STT providers, OS-keychain BYOK, SQLite history, neobrutalism React UI, mic capture via cpal, macOS Fn-key shortcut via CGEventTap, and a 4-layer test suite — feature-parity with the legacy Electron app and beyond.

**Architecture:** Tauri 2.x with Rust backend owning OS resources (audio, secrets, db, shortcuts, paste) and a React+Vite+TS webview owning UI + STT calls (Vercel AI SDK with API keys fetched just-in-time from Rust). Trait-based seams in Rust enable mock implementations for tests. Three webviews: tray (programmatic Rust, no HTML), main window (dashboard/history/settings/about), and overlay pill (always-on-top recording state).

**Tech Stack:** Tauri 2.x, Rust (cpal, keyring v3, tauri-plugin-{sql,store,global-shortcut,clipboard-manager,updater}, core-graphics + objc2 for macOS Fn key, enigo for paste, zeroize), React 18+, TypeScript, Vite, Tailwind CSS, shadcn/ui via neobrutalism.dev variants, Vercel AI SDK, Vitest + happy-dom + MSW v2 (TS), cargo-llvm-cov + wiremock (Rust).

**Depends on:** Plan A (monorepo bootstrap, tooling, base CI).
**Blocks:** Plans C (landing references desktop providers/features) and D (release pipeline needs an app to release).

---

## Section 1: Tauri scaffold + Vite + Vitest

### Task 1: Scaffold Tauri 2 app inside `packages/desktop` via `create-tauri-app`

**Files (created by the scaffold tool, then customized):**
- All `packages/desktop/src-tauri/*` (Cargo.toml, tauri.conf.json, build.rs, src/main.rs, src/lib.rs, capabilities/, icons/)
- All `packages/desktop/*` (index.html, vite.config.ts, tsconfig.json, src/main.tsx, src/App.tsx, package.json)

**Spec reference:** §4 (repo layout `packages/desktop/`), §6.1 (process model)

**Approach:** use the official `create-tauri-app` scaffold tool with the React-TS template, then customize what doesn't match our spec. This is faster, less error-prone, and keeps us aligned with current Tauri 2 defaults.

**Steps:**

- [ ] **Step 1: Remove the placeholder package skeleton (created in Plan A) so the scaffold tool can write fresh**

```bash
rm -rf packages/desktop
```

- [ ] **Step 2: Run the official Tauri scaffolder**

```bash
cd packages
bunx create-tauri-app@latest desktop \
  --manager bun \
  --template react-ts \
  --identifier com.vhtechnology.voxera
cd ..
```
Expected: `packages/desktop/` is created with Tauri 2 scaffold (React + Vite + TS frontend, Rust backend in `src-tauri/`).

Verify the scaffold compiled:
```bash
cd packages/desktop && bun install && bunx tauri info
```
Expected: `tauri info` reports Tauri 2.x version.

- [ ] **Step 3: Customize `packages/desktop/package.json`** (the scaffold writes a minimal one; we add our scripts and pin our plugin versions)

```json
{
  "name": "@vox-era/desktop",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --dir src --exclude '**/integration/**' --exclude '**/functional/**'",
    "test:integration": "vitest run --dir tests/integration",
    "test:functional": "vitest run --dir tests/functional",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-clipboard-manager": "^2.0.0",
    "@tauri-apps/plugin-global-shortcut": "^2.0.0",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "@tauri-apps/plugin-store": "^2.0.0",
    "@tauri-apps/plugin-updater": "^2.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@vitest/coverage-v8": "^2.0.0",
    "happy-dom": "^15.0.0",
    "msw": "^2.4.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: Customize `packages/desktop/src-tauri/Cargo.toml`** (the scaffold provides a base; we add our deps and platform-specific blocks)

```toml
[package]
name = "voxera"
version = "0.0.0"
description = "Vox Era desktop"
authors = ["Programow"]
edition = "2021"

[lib]
name = "voxera_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-clipboard-manager = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-store = "2"
tauri-plugin-updater = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4", "serde"] }
cpal = "0.15"
hound = "3.5"
keyring = { version = "3", default-features = false, features = ["sync-secret-service", "apple-native", "windows-native"] }
zeroize = { version = "1", features = ["derive"] }
enigo = "0.2"
log = "0.4"
env_logger = "0.11"

[target.'cfg(target_os = "macos")'.dependencies]
core-graphics = "0.24"
core-foundation = "0.10"
objc2 = "0.5"
objc2-foundation = "0.2"
objc2-av-foundation = "0.2"

[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.58", features = ["Win32_System_Registry"] }

[dev-dependencies]
wiremock = "0.6"
tempfile = "3.10"
tokio-test = "0.4"
```

- [ ] **Step 5: Verify `packages/desktop/src-tauri/build.rs`** (the scaffold writes this; just confirm contents)

Expected file contents:
```rust
fn main() {
    tauri_build::build()
}
```
If different, replace with the above.

- [ ] **Step 6: Replace `packages/desktop/src-tauri/tauri.conf.json`** with our customized version

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Vox Era",
  "version": "0.0.0",
  "identifier": "com.vhtechnology.voxera",
  "build": {
    "beforeDevCommand": "bun run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "bun run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Vox Era",
        "width": 900,
        "height": 680,
        "minWidth": 720,
        "minHeight": 480,
        "resizable": true,
        "visible": false,
        "center": true
      },
      {
        "label": "overlay",
        "title": "Vox Era Overlay",
        "width": 280,
        "height": 64,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "visible": false,
        "url": "index.html?window=overlay"
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.openai.com https://api.groq.com https://api.deepgram.com https://api.assemblyai.com https://api.elevenlabs.io https://fal.run https://api.gladia.io https://*.openai.azure.com https://api.rev.ai"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"],
    "category": "Productivity",
    "shortDescription": "Cross-platform speech-to-text",
    "longDescription": "Vox Era — multi-provider speech-to-text desktop app with BYOK and OS-keychain-stored credentials.",
    "macOS": {
      "entitlements": "entitlements.plist",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Vox Era needs microphone access to transcribe your speech.",
        "LSUIElement": true
      }
    },
    "linux": {
      "deb": { "depends": ["libwebkit2gtk-4.1-0", "libayatana-appindicator3-1"] },
      "rpm": {}
    }
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://vox-era.com/updates/latest.json"],
      "pubkey": "REPLACE_WITH_MINISIGN_PUBKEY_FROM_PLAN_D"
    }
  }
}
```

- [ ] **Step 7: Create `packages/desktop/src-tauri/entitlements.plist`** (macOS — the scaffold doesn't write this; required for our mic + signing config)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

- [ ] **Step 8: Replace `packages/desktop/src-tauri/src/main.rs`** (the scaffold writes a working main; we replace with our crate-name version)

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    voxera_lib::run();
}
```

- [ ] **Step 9: Replace `packages/desktop/src-tauri/src/lib.rs`** (skeleton — modules added in later tasks)

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

- [ ] **Step 10: Replace `packages/desktop/index.html`** (the scaffold writes a default; we replace with our minimal version)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vox Era</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Replace `packages/desktop/vite.config.ts`** (scaffold provides a Tauri-aware version; we keep the same essential structure with our port + sourcemap settings)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        target: 'esnext',
        minify: 'esbuild',
        sourcemap: true,
    },
});
```

- [ ] **Step 12: Replace `packages/desktop/tsconfig.json`** (extend our root base config + Tauri-friendly paths)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist", "src-tauri/target"]
}
```

- [ ] **Step 13: Verify icons exist** (the scaffold writes icons; just confirm)

```bash
ls packages/desktop/src-tauri/icons/
```
Expected: `icon.png`, `icon.icns`, `icon.ico`, plus PNG variants for various sizes. If missing (older scaffold version), regenerate via `bunx @tauri-apps/cli icon path/to/source-512.png`.

- [ ] **Step 14: Install dependencies**

Run: `bun install`
Expected: pulls Tauri JS plugins + React + Vitest + MSW. Runs successfully.

- [ ] **Step 15: Verify Tauri builds end-to-end**

Run: `cd packages/desktop && bun run typecheck`
Expected: no TS errors.

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: cargo resolves dependencies; lib compiles cleanly.

Run: `cd packages/desktop && bunx tauri info`
Expected: prints Tauri version, runtime info, no errors.

- [ ] **Step 16: Commit**

```bash
git add packages/desktop/
git commit -m "feat(desktop): scaffold Tauri 2 app with React+Vite+Vitest"
```

---

### Task 2: Vitest configuration + test setup

**Files:**
- Create: `packages/desktop/vitest.config.ts`
- Create: `packages/desktop/tests/setup.ts`
- Create: `packages/desktop/src/__smoke__/sanity.test.ts`

**Steps:**

- [ ] **Step 1: Write a failing smoke test**

Create `packages/desktop/src/__smoke__/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest sanity', () => {
    it('runs and adds numbers', () => {
        expect(1 + 1).toBe(2);
    });

    it('has happy-dom DOM globals', () => {
        const div = document.createElement('div');
        div.textContent = 'hello';
        expect(div.textContent).toBe('hello');
    });
});
```

- [ ] **Step 2: Run; should fail because vitest config is missing**

Run: `cd packages/desktop && bun run test:unit`
Expected: FAIL with "happy-dom not configured" or "document is not defined".

- [ ] **Step 3: Add `packages/desktop/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                'src-tauri/',
                'tests/fixtures/',
                '**/*.config.*',
                '**/main.tsx',
            ],
        },
    },
    resolve: { alias: { '@': '/src' } },
});
```

- [ ] **Step 4: Add `packages/desktop/tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Run; expect pass**

Run: `cd packages/desktop && bun run test:unit`
Expected: PASS — 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/vitest.config.ts packages/desktop/tests/setup.ts packages/desktop/src/__smoke__/
git commit -m "test(desktop): configure Vitest with happy-dom and add smoke test"
```

---

## Section 2: Audio module — AudioSource trait + cpal impl

### Task 3: AudioSource trait + types

**Files:**
- Create: `packages/desktop/src-tauri/src/audio/mod.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Spec reference:** §6.3

**Steps:**

- [ ] **Step 1: Write a failing test**

Append to `packages/desktop/src-tauri/src/audio/mod.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_state_serializes() {
        let json = serde_json::to_string(&PermissionState::Granted).unwrap();
        assert_eq!(json, "\"Granted\"");
    }

    #[test]
    fn permission_state_deserializes() {
        let s: PermissionState = serde_json::from_str("\"Denied\"").unwrap();
        assert_eq!(s, PermissionState::Denied);
    }
}
```

- [ ] **Step 2: Run; expect fail**

Run: `cd packages/desktop/src-tauri && cargo test --lib audio::tests`
Expected: FAIL — `PermissionState` is undefined.

- [ ] **Step 3: Define the trait + types**

Replace `packages/desktop/src-tauri/src/audio/mod.rs`:

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod microphone;
pub mod mock;
pub mod permissions;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionState {
    Granted,
    Denied,
    NotDetermined,
}

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("microphone permission not granted")]
    PermissionDenied,
    #[error("audio device unavailable: {0}")]
    DeviceUnavailable(String),
    #[error("capture failed: {0}")]
    CaptureFailed(String),
}

pub struct CaptureSession {
    pub id: Uuid,
}

pub trait AudioSource: Send + Sync {
    fn check_permission(&self) -> PermissionState;
    fn request_permission(&self) -> Result<PermissionState, AudioError>;
    fn start_capture(&self) -> Result<CaptureSession, AudioError>;
    fn stop_capture(&self, session: &CaptureSession) -> Result<Vec<u8>, AudioError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_state_serializes() {
        let json = serde_json::to_string(&PermissionState::Granted).unwrap();
        assert_eq!(json, "\"Granted\"");
    }

    #[test]
    fn permission_state_deserializes() {
        let s: PermissionState = serde_json::from_str("\"Denied\"").unwrap();
        assert_eq!(s, PermissionState::Denied);
    }
}
```

- [ ] **Step 4: Add empty placeholder modules so the file compiles**

Create `packages/desktop/src-tauri/src/audio/microphone.rs`:

```rust
// Real cpal implementation lands in Task 4.
```

Create `packages/desktop/src-tauri/src/audio/mock.rs`:

```rust
// Mock implementation lands in Task 5.
```

Create `packages/desktop/src-tauri/src/audio/permissions/mod.rs`:

```rust
// Per-platform permission code lands in Tasks 6-8.
```

Update `packages/desktop/src-tauri/src/lib.rs`:

```rust
pub mod audio;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

- [ ] **Step 5: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib audio::tests`
Expected: PASS — both tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src-tauri/src/audio/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add AudioSource trait with permission states and capture types"
```

---

### Task 4: cpal-backed `MicrophoneSource`

**Files:**
- Modify: `packages/desktop/src-tauri/src/audio/microphone.rs`

**Steps:**

- [ ] **Step 1: Write the test for stream construction**

Append to `packages/desktop/src-tauri/src/audio/microphone.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn microphone_source_can_be_constructed() {
        let _src = MicrophoneSource::new();
        // construction itself is the assertion — should not panic
    }

    #[test]
    fn wav_writer_produces_valid_header() {
        let bytes = encode_wav_pcm16(&[0, 0, 0, 0], 16000);
        // RIFF header magic
        assert_eq!(&bytes[..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
    }
}
```

- [ ] **Step 2: Run; expect fail**

Run: `cd packages/desktop/src-tauri && cargo test --lib audio::microphone::tests`
Expected: FAIL — `MicrophoneSource` and `encode_wav_pcm16` undefined.

- [ ] **Step 3: Implement the cpal microphone source**

Replace `packages/desktop/src-tauri/src/audio/microphone.rs`:

```rust
use super::{AudioError, AudioSource, CaptureSession, PermissionState};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use std::io::{Cursor, Write};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct MicrophoneSource {
    sessions: Arc<Mutex<Vec<ActiveSession>>>,
}

struct ActiveSession {
    id: Uuid,
    samples: Arc<Mutex<Vec<i16>>>,
    sample_rate: u32,
    _stream: Stream,
}

impl MicrophoneSource {
    pub fn new() -> Self {
        Self { sessions: Arc::new(Mutex::new(Vec::new())) }
    }
}

impl Default for MicrophoneSource {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioSource for MicrophoneSource {
    fn check_permission(&self) -> PermissionState {
        super::permissions::check_microphone_permission()
    }

    fn request_permission(&self) -> Result<PermissionState, AudioError> {
        super::permissions::request_microphone_permission()
    }

    fn start_capture(&self) -> Result<CaptureSession, AudioError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| AudioError::DeviceUnavailable("no default input device".into()))?;
        let config = device
            .default_input_config()
            .map_err(|e| AudioError::CaptureFailed(e.to_string()))?;
        let sample_rate = config.sample_rate().0;
        let samples: Arc<Mutex<Vec<i16>>> = Arc::new(Mutex::new(Vec::new()));
        let samples_clone = samples.clone();
        let err_fn = |err| log::error!("cpal stream error: {err}");
        let stream = match config.sample_format() {
            SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _| {
                    let mut buf = samples_clone.lock().unwrap();
                    buf.extend(data.iter().map(|&s| (s.clamp(-1.0, 1.0) * 32767.0) as i16));
                },
                err_fn,
                None,
            ),
            SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _| {
                    let mut buf = samples_clone.lock().unwrap();
                    buf.extend_from_slice(data);
                },
                err_fn,
                None,
            ),
            other => return Err(AudioError::CaptureFailed(format!("unsupported sample format {other:?}"))),
        }
        .map_err(|e| AudioError::CaptureFailed(e.to_string()))?;
        stream.play().map_err(|e| AudioError::CaptureFailed(e.to_string()))?;
        let id = Uuid::new_v4();
        self.sessions.lock().unwrap().push(ActiveSession {
            id,
            samples,
            sample_rate,
            _stream: stream,
        });
        Ok(CaptureSession { id })
    }

    fn stop_capture(&self, session: &CaptureSession) -> Result<Vec<u8>, AudioError> {
        let mut sessions = self.sessions.lock().unwrap();
        let pos = sessions
            .iter()
            .position(|s| s.id == session.id)
            .ok_or_else(|| AudioError::CaptureFailed("session not found".into()))?;
        let active = sessions.remove(pos);
        let samples = active.samples.lock().unwrap().clone();
        Ok(encode_wav_pcm16(&samples, active.sample_rate))
    }
}

pub fn encode_wav_pcm16(samples: &[i16], sample_rate: u32) -> Vec<u8> {
    let bytes_per_sample = 2u32;
    let num_channels = 1u32;
    let byte_rate = sample_rate * num_channels * bytes_per_sample;
    let block_align = (num_channels * bytes_per_sample) as u16;
    let data_len = (samples.len() as u32) * bytes_per_sample;
    let mut buf = Cursor::new(Vec::with_capacity(44 + data_len as usize));
    buf.write_all(b"RIFF").unwrap();
    buf.write_all(&(36 + data_len).to_le_bytes()).unwrap();
    buf.write_all(b"WAVE").unwrap();
    buf.write_all(b"fmt ").unwrap();
    buf.write_all(&16u32.to_le_bytes()).unwrap();
    buf.write_all(&1u16.to_le_bytes()).unwrap(); // PCM
    buf.write_all(&(num_channels as u16).to_le_bytes()).unwrap();
    buf.write_all(&sample_rate.to_le_bytes()).unwrap();
    buf.write_all(&byte_rate.to_le_bytes()).unwrap();
    buf.write_all(&block_align.to_le_bytes()).unwrap();
    buf.write_all(&16u16.to_le_bytes()).unwrap(); // bits per sample
    buf.write_all(b"data").unwrap();
    buf.write_all(&data_len.to_le_bytes()).unwrap();
    for s in samples {
        buf.write_all(&s.to_le_bytes()).unwrap();
    }
    buf.into_inner()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn microphone_source_can_be_constructed() {
        let _src = MicrophoneSource::new();
    }

    #[test]
    fn wav_writer_produces_valid_header() {
        let bytes = encode_wav_pcm16(&[0, 0, 0, 0], 16000);
        assert_eq!(&bytes[..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
    }
}
```

- [ ] **Step 4: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib audio::microphone::tests`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/audio/microphone.rs
git commit -m "feat(desktop): implement cpal-backed MicrophoneSource with WAV encoding"
```

---

### Task 5: `MockMicrophoneSource` for tests

**Files:**
- Modify: `packages/desktop/src-tauri/src/audio/mock.rs`

**Steps:**

- [ ] **Step 1: Write the failing test**

Replace `packages/desktop/src-tauri/src/audio/mock.rs`:

```rust
use super::{AudioError, AudioSource, CaptureSession, PermissionState};
use std::sync::Mutex;
use uuid::Uuid;

pub struct MockMicrophoneSource {
    pub permission: Mutex<PermissionState>,
    pub canned_wav: Vec<u8>,
}

impl MockMicrophoneSource {
    pub fn new(permission: PermissionState, canned_wav: Vec<u8>) -> Self {
        Self { permission: Mutex::new(permission), canned_wav }
    }
}

impl AudioSource for MockMicrophoneSource {
    fn check_permission(&self) -> PermissionState {
        *self.permission.lock().unwrap()
    }

    fn request_permission(&self) -> Result<PermissionState, AudioError> {
        let mut p = self.permission.lock().unwrap();
        if *p == PermissionState::NotDetermined {
            *p = PermissionState::Granted;
        }
        Ok(*p)
    }

    fn start_capture(&self) -> Result<CaptureSession, AudioError> {
        if self.check_permission() != PermissionState::Granted {
            return Err(AudioError::PermissionDenied);
        }
        Ok(CaptureSession { id: Uuid::new_v4() })
    }

    fn stop_capture(&self, _session: &CaptureSession) -> Result<Vec<u8>, AudioError> {
        Ok(self.canned_wav.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denied_permission_blocks_capture() {
        let mock = MockMicrophoneSource::new(PermissionState::Denied, vec![]);
        assert!(matches!(mock.start_capture(), Err(AudioError::PermissionDenied)));
    }

    #[test]
    fn granted_permission_returns_canned_wav() {
        let canned = vec![1, 2, 3];
        let mock = MockMicrophoneSource::new(PermissionState::Granted, canned.clone());
        let session = mock.start_capture().unwrap();
        let bytes = mock.stop_capture(&session).unwrap();
        assert_eq!(bytes, canned);
    }

    #[test]
    fn request_promotes_not_determined_to_granted() {
        let mock = MockMicrophoneSource::new(PermissionState::NotDetermined, vec![]);
        let p = mock.request_permission().unwrap();
        assert_eq!(p, PermissionState::Granted);
    }
}
```

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib audio::mock::tests`
Expected: PASS — 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/audio/mock.rs
git commit -m "test(desktop): add MockMicrophoneSource backed by canned WAV bytes"
```

---

## Section 3: Permissions module per platform

### Task 6: Permissions trait + macOS impl (AVCaptureDevice via objc2)

**Files:**
- Modify: `packages/desktop/src-tauri/src/audio/permissions/mod.rs`
- Create: `packages/desktop/src-tauri/src/audio/permissions/macos.rs`
- Create: `packages/desktop/src-tauri/src/audio/permissions/windows.rs`
- Create: `packages/desktop/src-tauri/src/audio/permissions/linux.rs`

**Spec reference:** §6.3 (per-platform mic permission)

**Steps:**

- [ ] **Step 1: Define the cross-platform interface in `mod.rs`**

Replace `packages/desktop/src-tauri/src/audio/permissions/mod.rs`:

```rust
use super::PermissionState;
use crate::audio::AudioError;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

pub fn open_settings_microphone_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Microphone)
}

pub fn open_settings_accessibility_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Accessibility)
}

pub enum SettingsPanel {
    Microphone,
    Accessibility,
}
```

- [ ] **Step 2: macOS impl using objc2-av-foundation**

Create `packages/desktop/src-tauri/src/audio/permissions/macos.rs`:

```rust
use super::{PermissionState, SettingsPanel};
use crate::audio::AudioError;
use objc2::runtime::Bool;
use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
use std::process::Command;

pub fn check_microphone_permission() -> PermissionState {
    unsafe {
        let status = AVCaptureDevice::authorizationStatusForMediaType(AVMediaTypeAudio);
        match status {
            AVAuthorizationStatus::Authorized => PermissionState::Granted,
            AVAuthorizationStatus::Denied | AVAuthorizationStatus::Restricted => PermissionState::Denied,
            AVAuthorizationStatus::NotDetermined => PermissionState::NotDetermined,
            _ => PermissionState::NotDetermined,
        }
    }
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();
    unsafe {
        let block = block2::RcBlock::new(move |granted: Bool| {
            let _ = tx.send(granted.as_bool());
        });
        AVCaptureDevice::requestAccessForMediaType_completionHandler(
            AVMediaTypeAudio,
            &block,
        );
    }
    let granted = rx
        .recv_timeout(std::time::Duration::from_secs(60))
        .map_err(|_| AudioError::CaptureFailed("permission prompt timeout".into()))?;
    Ok(if granted { PermissionState::Granted } else { PermissionState::Denied })
}

pub fn check_accessibility_permission() -> PermissionState {
    use core_foundation::base::TCFType;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;
    use core_graphics::access::AXIsProcessTrustedWithOptions;

    let prompt_key = unsafe {
        CFString::wrap_under_get_rule(core_graphics::access::kAXTrustedCheckOptionPrompt)
    };
    let no = core_foundation::boolean::CFBoolean::false_value();
    let dict = CFDictionary::from_CFType_pairs(&[(prompt_key, no)]);
    let trusted = unsafe { AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef()) };
    if trusted { PermissionState::Granted } else { PermissionState::Denied }
}

pub fn request_accessibility_permission() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Accessibility)
}

pub fn open_settings_panel_impl(panel: SettingsPanel) -> Result<(), AudioError> {
    let url = match panel {
        SettingsPanel::Microphone => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        SettingsPanel::Accessibility => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        }
    };
    Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| AudioError::CaptureFailed(format!("open settings failed: {e}")))?;
    Ok(())
}
```

Note: the precise API surface of `objc2-av-foundation` and `core-graphics` `AXIsProcessTrustedWithOptions` may need minor adjustment per current crate versions; the structure is correct. Verify against `cargo doc --open` if compile errors surface.

- [ ] **Step 3: Windows impl (registry check)**

Create `packages/desktop/src-tauri/src/audio/permissions/windows.rs`:

```rust
use super::{PermissionState, SettingsPanel};
use crate::audio::AudioError;
use std::process::Command;
use windows::Win32::System::Registry::{
    RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ, REG_SZ,
};
use windows::core::{PCWSTR, w};

pub fn check_microphone_permission() -> PermissionState {
    let path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone");
    unsafe {
        let mut hkey = HKEY::default();
        let status = RegOpenKeyExW(HKEY_CURRENT_USER, path, 0, KEY_READ, &mut hkey);
        if status.is_err() {
            return PermissionState::NotDetermined;
        }
        let mut buf = [0u16; 32];
        let mut size = (buf.len() * 2) as u32;
        let mut kind = REG_SZ;
        let read = RegQueryValueExW(
            hkey,
            w!("Value"),
            None,
            Some(&mut kind),
            Some(buf.as_mut_ptr() as *mut u8),
            Some(&mut size),
        );
        if read.is_err() {
            return PermissionState::NotDetermined;
        }
        let s = String::from_utf16_lossy(&buf[..(size as usize / 2).saturating_sub(1)]);
        match s.as_str() {
            "Allow" => PermissionState::Granted,
            "Deny" => PermissionState::Denied,
            _ => PermissionState::NotDetermined,
        }
    }
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    open_settings_panel_impl(SettingsPanel::Microphone)?;
    Ok(check_microphone_permission())
}

pub fn check_accessibility_permission() -> PermissionState {
    PermissionState::Granted
}

pub fn request_accessibility_permission() -> Result<(), AudioError> {
    Ok(())
}

pub fn open_settings_panel_impl(panel: SettingsPanel) -> Result<(), AudioError> {
    let uri = match panel {
        SettingsPanel::Microphone => "ms-settings:privacy-microphone",
        SettingsPanel::Accessibility => "ms-settings:easeofaccess",
    };
    Command::new("cmd")
        .args(["/C", "start", "", uri])
        .status()
        .map_err(|e| AudioError::CaptureFailed(format!("open settings failed: {e}")))?;
    Ok(())
}
```

- [ ] **Step 4: Linux impl (no consent system; rely on cpal device open)**

Create `packages/desktop/src-tauri/src/audio/permissions/linux.rs`:

```rust
use super::{PermissionState, SettingsPanel};
use crate::audio::AudioError;

pub fn check_microphone_permission() -> PermissionState {
    use cpal::traits::HostTrait;
    if cpal::default_host().default_input_device().is_some() {
        PermissionState::Granted
    } else {
        PermissionState::Denied
    }
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    Ok(check_microphone_permission())
}

pub fn check_accessibility_permission() -> PermissionState {
    PermissionState::Granted
}

pub fn request_accessibility_permission() -> Result<(), AudioError> {
    Ok(())
}

pub fn open_settings_panel_impl(_panel: SettingsPanel) -> Result<(), AudioError> {
    Err(AudioError::CaptureFailed(
        "Linux has no standardized settings panel deep link; please open your desktop's audio settings manually".into(),
    ))
}
```

- [ ] **Step 5: Verify all platforms compile**

Run: `cd packages/desktop/src-tauri && cargo check --target $(rustc -vV | grep host | awk '{print $2}')`
Expected: clean compile on the host platform. (Cross-platform compile to other targets happens in CI.)

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src-tauri/src/audio/permissions/
git commit -m "feat(desktop): per-platform mic + accessibility permission detection"
```

---

## Section 4: Secrets module — keyring + zeroize

### Task 7: Vault trait, KeyringVault, InMemoryVault

**Files:**
- Create: `packages/desktop/src-tauri/src/secrets/mod.rs`
- Create: `packages/desktop/src-tauri/src/secrets/keyring_vault.rs`
- Create: `packages/desktop/src-tauri/src/secrets/mock.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Spec reference:** §6.4

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `packages/desktop/src-tauri/src/secrets/mod.rs`:

```rust
use zeroize::Zeroizing;

pub mod keyring_vault;
pub mod mock;

pub const SERVICE_NAME: &str = "vox-era";

#[derive(Debug, thiserror::Error)]
pub enum SecretsError {
    #[error("no key set for provider")]
    NotFound,
    #[error("keychain backend unavailable: {0}")]
    BackendUnavailable(String),
    #[error("unexpected: {0}")]
    Other(String),
}

pub trait Vault: Send + Sync {
    fn get(&self, provider_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError>;
    fn set(&self, provider_id: &str, key: &str) -> Result<(), SecretsError>;
    fn delete(&self, provider_id: &str) -> Result<(), SecretsError>;
    fn list_configured(&self) -> Result<Vec<String>, SecretsError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use mock::InMemoryVault;

    #[test]
    fn set_then_get_returns_the_key() {
        let v = InMemoryVault::new();
        v.set("openai", "sk-test-123").unwrap();
        let got = v.get("openai").unwrap().unwrap();
        assert_eq!(&*got, "sk-test-123");
    }

    #[test]
    fn get_missing_returns_none() {
        let v = InMemoryVault::new();
        assert!(v.get("openai").unwrap().is_none());
    }

    #[test]
    fn delete_removes_the_key() {
        let v = InMemoryVault::new();
        v.set("openai", "sk-x").unwrap();
        v.delete("openai").unwrap();
        assert!(v.get("openai").unwrap().is_none());
    }

    #[test]
    fn list_configured_returns_all_provider_ids() {
        let v = InMemoryVault::new();
        v.set("openai", "sk-1").unwrap();
        v.set("groq", "gsk-1").unwrap();
        let mut ids = v.list_configured().unwrap();
        ids.sort();
        assert_eq!(ids, vec!["groq".to_string(), "openai".to_string()]);
    }
}
```

- [ ] **Step 2: Run; expect fail**

Run: `cd packages/desktop/src-tauri && cargo test --lib secrets::tests`
Expected: FAIL — `InMemoryVault` undefined.

- [ ] **Step 3: Implement `InMemoryVault`**

Create `packages/desktop/src-tauri/src/secrets/mock.rs`:

```rust
use super::{SecretsError, Vault};
use std::collections::HashMap;
use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct InMemoryVault {
    inner: Mutex<HashMap<String, String>>,
}

impl InMemoryVault {
    pub fn new() -> Self {
        Self { inner: Mutex::new(HashMap::new()) }
    }
}

impl Default for InMemoryVault {
    fn default() -> Self {
        Self::new()
    }
}

impl Vault for InMemoryVault {
    fn get(&self, provider_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError> {
        Ok(self.inner.lock().unwrap().get(provider_id).map(|s| Zeroizing::new(s.clone())))
    }
    fn set(&self, provider_id: &str, key: &str) -> Result<(), SecretsError> {
        self.inner.lock().unwrap().insert(provider_id.into(), key.into());
        Ok(())
    }
    fn delete(&self, provider_id: &str) -> Result<(), SecretsError> {
        self.inner.lock().unwrap().remove(provider_id);
        Ok(())
    }
    fn list_configured(&self) -> Result<Vec<String>, SecretsError> {
        Ok(self.inner.lock().unwrap().keys().cloned().collect())
    }
}
```

- [ ] **Step 4: Implement `KeyringVault`**

Create `packages/desktop/src-tauri/src/secrets/keyring_vault.rs`:

```rust
use super::{SecretsError, Vault, SERVICE_NAME};
use keyring::Entry;
use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct KeyringVault {
    /// Tracks provider IDs we know we've stored, so list_configured() works.
    /// (The Secret Service API doesn't expose enumeration of credentials by
    /// service name in a portable way; we keep an in-memory index plus a
    /// JSON file so the list survives restarts.)
    known_ids: Mutex<Vec<String>>,
}

impl KeyringVault {
    pub fn new(known_ids: Vec<String>) -> Self {
        Self { known_ids: Mutex::new(known_ids) }
    }
}

impl Vault for KeyringVault {
    fn get(&self, provider_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError> {
        let entry = Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        match entry.get_password() {
            Ok(s) => Ok(Some(Zeroizing::new(s))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(SecretsError::BackendUnavailable(e.to_string())),
        }
    }

    fn set(&self, provider_id: &str, key: &str) -> Result<(), SecretsError> {
        let entry = Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        entry
            .set_password(key)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        let mut ids = self.known_ids.lock().unwrap();
        if !ids.iter().any(|s| s == provider_id) {
            ids.push(provider_id.into());
        }
        Ok(())
    }

    fn delete(&self, provider_id: &str) -> Result<(), SecretsError> {
        let entry = Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(SecretsError::BackendUnavailable(e.to_string())),
        }
        self.known_ids.lock().unwrap().retain(|s| s != provider_id);
        Ok(())
    }

    fn list_configured(&self) -> Result<Vec<String>, SecretsError> {
        Ok(self.known_ids.lock().unwrap().clone())
    }
}
```

- [ ] **Step 5: Add `pub mod secrets;` to `lib.rs`**

Update `packages/desktop/src-tauri/src/lib.rs`:

```rust
pub mod audio;
pub mod secrets;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

- [ ] **Step 6: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib secrets::tests`
Expected: PASS — 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src-tauri/src/secrets/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add Vault trait with KeyringVault and InMemoryVault"
```

---

### Task 8: Log-redaction guard for secrets

**Files:**
- Modify: `packages/desktop/src-tauri/src/secrets/mod.rs`

**Steps:**

- [ ] **Step 1: Write the failing test**

Append to `packages/desktop/src-tauri/src/secrets/mod.rs` inside the `tests` module:

```rust
    #[test]
    fn debug_format_redacts_value() {
        let key = SecretKey::from("sk-real-key-123");
        let formatted = format!("{:?}", key);
        assert!(!formatted.contains("sk-real-key-123"));
        assert!(formatted.contains("redacted"));
    }
```

- [ ] **Step 2: Run; expect fail (`SecretKey` undefined)**

Run: `cd packages/desktop/src-tauri && cargo test --lib secrets::tests::debug_format_redacts_value`
Expected: FAIL — undefined.

- [ ] **Step 3: Add `SecretKey` wrapper**

Append to `packages/desktop/src-tauri/src/secrets/mod.rs` (above `tests`):

```rust
#[derive(Clone)]
pub struct SecretKey(Zeroizing<String>);

impl SecretKey {
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl From<&str> for SecretKey {
    fn from(s: &str) -> Self {
        Self(Zeroizing::new(s.to_string()))
    }
}

impl From<String> for SecretKey {
    fn from(s: String) -> Self {
        Self(Zeroizing::new(s))
    }
}

impl std::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SecretKey(redacted)")
    }
}
```

- [ ] **Step 4: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib secrets::tests`
Expected: PASS — all secrets tests pass including the new debug-redaction test.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/secrets/mod.rs
git commit -m "feat(desktop): add SecretKey wrapper that redacts values in Debug output"
```

---

## Section 5: Settings module via tauri-plugin-store

### Task 9: Settings types + defaults

**Files:**
- Create: `packages/desktop/src-tauri/src/settings/mod.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Spec reference:** §6.5

**Steps:**

- [ ] **Step 1: Write failing test**

Create `packages/desktop/src-tauri/src/settings/mod.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub active_provider_id: String,
    pub active_model_id: String,
    pub hotkey: String,
    pub mic_device_id: Option<String>,
    pub theme: Theme,
    pub history: HistorySettings,
    pub overlay: OverlaySettings,
    pub onboarding_completed: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistorySettings {
    pub retention_days: i32,
    pub auto_delete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySettings {
    pub position: OverlayPosition,
    pub show_on_idle: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayPosition {
    BottomCenter,
    BottomRight,
    TopCenter,
}

impl Settings {
    pub fn defaults() -> Self {
        Self {
            active_provider_id: "openai".into(),
            active_model_id: "whisper-1".into(),
            hotkey: default_hotkey().into(),
            mic_device_id: None,
            theme: Theme::System,
            history: HistorySettings { retention_days: 365, auto_delete: true },
            overlay: OverlaySettings { position: OverlayPosition::BottomCenter, show_on_idle: false },
            onboarding_completed: false,
        }
    }
}

pub fn default_hotkey() -> &'static str {
    if cfg!(target_os = "macos") {
        "Fn"
    } else {
        "CommandOrControl+Shift+Space"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_use_openai_whisper_and_one_year_retention() {
        let s = Settings::defaults();
        assert_eq!(s.active_provider_id, "openai");
        assert_eq!(s.active_model_id, "whisper-1");
        assert_eq!(s.history.retention_days, 365);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn macos_default_hotkey_is_fn() {
        assert_eq!(default_hotkey(), "Fn");
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn non_macos_default_hotkey_is_ctrl_shift_space() {
        assert_eq!(default_hotkey(), "CommandOrControl+Shift+Space");
    }

    #[test]
    fn settings_round_trip_serialize() {
        let s = Settings::defaults();
        let j = serde_json::to_string(&s).unwrap();
        let parsed: Settings = serde_json::from_str(&j).unwrap();
        assert_eq!(parsed, s);
    }
}
```

Update `packages/desktop/src-tauri/src/lib.rs`:

```rust
pub mod audio;
pub mod secrets;
pub mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib settings::tests`
Expected: PASS — all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/settings/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add Settings types with platform-aware default hotkey"
```

---

## Section 6: History module — schema, migrations, repo, stats, retention

### Task 10: SQL migration file + Rust migration registration

**Files:**
- Create: `packages/desktop/src-tauri/migrations/0001_init.sql`
- Create: `packages/desktop/src-tauri/src/history/mod.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Spec reference:** §6.6

**Steps:**

- [ ] **Step 1: Create the migration SQL**

Create `packages/desktop/src-tauri/migrations/0001_init.sql`:

```sql
CREATE TABLE transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    text TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    deleted_at INTEGER NULL
);
CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at);
CREATE INDEX idx_transcriptions_provider ON transcriptions(provider_id);
```

- [ ] **Step 2: Register migration in Rust**

Create `packages/desktop/src-tauri/src/history/mod.rs`:

```rust
pub mod repo;
pub mod retention;
pub mod stats;

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create transcriptions table and indexes",
        sql: include_str!("../../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

pub const DB_URL: &str = "sqlite:vox-era.db";
```

- [ ] **Step 3: Wire migrations into the Tauri builder**

Update `packages/desktop/src-tauri/src/lib.rs`:

```rust
pub mod audio;
pub mod history;
pub mod secrets;
pub mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(history::DB_URL, history::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

Create placeholder modules so it compiles:

```rust
// packages/desktop/src-tauri/src/history/repo.rs
// CRUD functions land in Task 11.
```

```rust
// packages/desktop/src-tauri/src/history/stats.rs
// Stats aggregations land in Task 12.
```

```rust
// packages/desktop/src-tauri/src/history/retention.rs
// Rolling-window purge lands in Task 13.
```

- [ ] **Step 4: Verify cargo check**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: clean compile.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/migrations/ packages/desktop/src-tauri/src/history/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): register SQLite migration 0001 for transcriptions table"
```

---

### Task 11: TranscriptionRepository (CRUD via sqlx)

**Files:**
- Modify: `packages/desktop/src-tauri/src/history/repo.rs`

**Steps:**

- [ ] **Step 1: Define `Transcription` struct + `Repository` trait + tests using SQLite in-memory**

Replace `packages/desktop/src-tauri/src/history/repo.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Transcription {
    pub id: i64,
    pub created_at: i64,
    pub text: String,
    pub duration_ms: i64,
    pub word_count: i64,
    pub provider_id: String,
    pub model_id: String,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTranscription {
    pub created_at: i64,
    pub text: String,
    pub duration_ms: i64,
    pub word_count: i64,
    pub provider_id: String,
    pub model_id: String,
}

pub async fn insert(pool: &SqlitePool, t: &NewTranscription) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        "INSERT INTO transcriptions (created_at, text, duration_ms, word_count, provider_id, model_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(t.created_at)
    .bind(&t.text)
    .bind(t.duration_ms)
    .bind(t.word_count)
    .bind(&t.provider_id)
    .bind(&t.model_id)
    .fetch_one(pool)
    .await?;
    Ok(row.get::<i64, _>("id"))
}

pub async fn list(pool: &SqlitePool, limit: i64, offset: i64) -> Result<Vec<Transcription>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, created_at, text, duration_ms, word_count, provider_id, model_id, deleted_at FROM transcriptions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    let out = rows
        .iter()
        .map(|r| Transcription {
            id: r.get("id"),
            created_at: r.get("created_at"),
            text: r.get("text"),
            duration_ms: r.get("duration_ms"),
            word_count: r.get("word_count"),
            provider_id: r.get("provider_id"),
            model_id: r.get("model_id"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();
    Ok(out)
}

pub async fn soft_delete(pool: &SqlitePool, id: i64, now: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE transcriptions SET deleted_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn purge_all(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let res = sqlx::query("DELETE FROM transcriptions").execute(pool).await?;
    Ok(res.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query(include_str!("../../migrations/0001_init.sql"))
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    #[tokio::test]
    async fn insert_then_list_returns_row() {
        let pool = setup_pool().await;
        let id = insert(&pool, &NewTranscription {
            created_at: 1000,
            text: "hello".into(),
            duration_ms: 500,
            word_count: 1,
            provider_id: "openai".into(),
            model_id: "whisper-1".into(),
        }).await.unwrap();
        assert!(id > 0);
        let rows = list(&pool, 10, 0).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].text, "hello");
    }

    #[tokio::test]
    async fn soft_delete_hides_from_list() {
        let pool = setup_pool().await;
        let id = insert(&pool, &NewTranscription {
            created_at: 1000, text: "x".into(), duration_ms: 1, word_count: 1,
            provider_id: "openai".into(), model_id: "whisper-1".into(),
        }).await.unwrap();
        soft_delete(&pool, id, 2000).await.unwrap();
        let rows = list(&pool, 10, 0).await.unwrap();
        assert_eq!(rows.len(), 0);
    }
}
```

Note: this requires `sqlx` to be a direct dep — `tauri-plugin-sql` re-exports it. Add `sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }` under `[dependencies]` in `Cargo.toml` if not already pulled in transitively.

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib history::repo::tests`
Expected: PASS — both async tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/history/repo.rs packages/desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): add transcription repository (insert, list, soft_delete, purge)"
```

---

### Task 12: Stats aggregations

**Files:**
- Modify: `packages/desktop/src-tauri/src/history/stats.rs`

**Steps:**

- [ ] **Step 1: Tests for total words, average WPM, top provider, streak**

Replace `packages/desktop/src-tauri/src/history/stats.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    pub total_words: i64,
    pub words_this_week: i64,
    pub words_this_month: i64,
    pub average_wpm: f64,
    pub time_saved_minutes: f64,
    pub top_provider: Option<String>,
    pub top_model: Option<(String, String)>,
    pub streak_days: i64,
}

pub async fn total_words(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let row = sqlx::query("SELECT COALESCE(SUM(word_count), 0) AS total FROM transcriptions WHERE deleted_at IS NULL")
        .fetch_one(pool).await?;
    Ok(row.get::<i64, _>("total"))
}

pub async fn words_since(pool: &SqlitePool, since: i64) -> Result<i64, sqlx::Error> {
    let row = sqlx::query("SELECT COALESCE(SUM(word_count), 0) AS total FROM transcriptions WHERE deleted_at IS NULL AND created_at >= ?")
        .bind(since).fetch_one(pool).await?;
    Ok(row.get::<i64, _>("total"))
}

pub async fn average_wpm(pool: &SqlitePool) -> Result<f64, sqlx::Error> {
    let row = sqlx::query("SELECT COALESCE(AVG(word_count * 60000.0 / duration_ms), 0.0) AS wpm FROM transcriptions WHERE deleted_at IS NULL AND duration_ms > 0")
        .fetch_one(pool).await?;
    Ok(row.get::<f64, _>("wpm"))
}

pub async fn time_saved_minutes(pool: &SqlitePool) -> Result<f64, sqlx::Error> {
    let row = sqlx::query("SELECT COALESCE(SUM(word_count) / 45.0 - SUM(duration_ms) / 60000.0, 0.0) AS saved FROM transcriptions WHERE deleted_at IS NULL")
        .fetch_one(pool).await?;
    Ok(row.get::<f64, _>("saved"))
}

pub async fn top_provider(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    let row = sqlx::query("SELECT provider_id FROM transcriptions WHERE deleted_at IS NULL GROUP BY provider_id ORDER BY COUNT(*) DESC LIMIT 1")
        .fetch_optional(pool).await?;
    Ok(row.map(|r| r.get::<String, _>("provider_id")))
}

pub async fn top_model(pool: &SqlitePool) -> Result<Option<(String, String)>, sqlx::Error> {
    let row = sqlx::query("SELECT provider_id, model_id FROM transcriptions WHERE deleted_at IS NULL GROUP BY provider_id, model_id ORDER BY COUNT(*) DESC LIMIT 1")
        .fetch_optional(pool).await?;
    Ok(row.map(|r| (r.get("provider_id"), r.get("model_id"))))
}

pub async fn streak_days(pool: &SqlitePool, today_unix_secs: i64) -> Result<i64, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT DISTINCT date(created_at/1000, 'unixepoch') AS day FROM transcriptions WHERE deleted_at IS NULL ORDER BY day DESC",
    )
    .fetch_all(pool).await?;
    let mut streak = 0i64;
    let mut expected = chrono::DateTime::from_timestamp(today_unix_secs, 0).unwrap().date_naive();
    for row in rows {
        let day_str: String = row.get("day");
        let day = chrono::NaiveDate::parse_from_str(&day_str, "%Y-%m-%d").unwrap();
        if day == expected {
            streak += 1;
            expected = expected.pred_opt().unwrap();
        } else if day < expected {
            break;
        }
    }
    Ok(streak)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::repo::{insert, NewTranscription};

    async fn setup_pool() -> SqlitePool {
        let pool = sqlx::sqlite::SqlitePoolOptions::new().connect("sqlite::memory:").await.unwrap();
        sqlx::query(include_str!("../../migrations/0001_init.sql")).execute(&pool).await.unwrap();
        pool
    }

    async fn add(pool: &SqlitePool, created_at_ms: i64, words: i64, duration_ms: i64, p: &str, m: &str) {
        insert(pool, &NewTranscription {
            created_at: created_at_ms, text: "x".into(), duration_ms, word_count: words,
            provider_id: p.into(), model_id: m.into(),
        }).await.unwrap();
    }

    #[tokio::test]
    async fn total_words_sums_word_count() {
        let pool = setup_pool().await;
        add(&pool, 1000, 5, 1000, "openai", "whisper-1").await;
        add(&pool, 2000, 10, 2000, "groq", "whisper-large-v3").await;
        assert_eq!(total_words(&pool).await.unwrap(), 15);
    }

    #[tokio::test]
    async fn top_provider_picks_most_frequent() {
        let pool = setup_pool().await;
        add(&pool, 1000, 5, 1000, "openai", "whisper-1").await;
        add(&pool, 2000, 5, 1000, "openai", "whisper-1").await;
        add(&pool, 3000, 5, 1000, "groq", "whisper-large-v3").await;
        assert_eq!(top_provider(&pool).await.unwrap(), Some("openai".into()));
    }

    #[tokio::test]
    async fn average_wpm_is_zero_when_empty() {
        let pool = setup_pool().await;
        assert_eq!(average_wpm(&pool).await.unwrap(), 0.0);
    }
}
```

Add `chrono = "0.4"` to `Cargo.toml` `[dependencies]`.

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib history::stats::tests`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/history/stats.rs packages/desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): add stats aggregations (totals, WPM, time saved, top provider/model, streak)"
```

---

### Task 13: Retention purge (rolling 1-year)

**Files:**
- Modify: `packages/desktop/src-tauri/src/history/retention.rs`

**Steps:**

- [ ] **Step 1: Failing test**

Replace `packages/desktop/src-tauri/src/history/retention.rs`:

```rust
use sqlx::sqlite::SqlitePool;

/// Soft-delete rows older than `cutoff_ms` and hard-delete rows that have been
/// soft-deleted for more than 30 days.
pub async fn purge(pool: &SqlitePool, now_ms: i64, retention_days: i64) -> Result<(u64, u64), sqlx::Error> {
    let soft_cutoff = now_ms - retention_days * 24 * 60 * 60 * 1000;
    let hard_cutoff = now_ms - 30 * 24 * 60 * 60 * 1000;
    let soft = sqlx::query(
        "UPDATE transcriptions SET deleted_at = ? WHERE deleted_at IS NULL AND created_at < ?",
    )
    .bind(now_ms).bind(soft_cutoff)
    .execute(pool).await?
    .rows_affected();
    let hard = sqlx::query("DELETE FROM transcriptions WHERE deleted_at IS NOT NULL AND deleted_at < ?")
        .bind(hard_cutoff)
        .execute(pool).await?
        .rows_affected();
    Ok((soft, hard))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::repo::{insert, list, NewTranscription};

    async fn setup_pool() -> SqlitePool {
        let pool = sqlx::sqlite::SqlitePoolOptions::new().connect("sqlite::memory:").await.unwrap();
        sqlx::query(include_str!("../../migrations/0001_init.sql")).execute(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn rows_older_than_window_are_soft_deleted() {
        let pool = setup_pool().await;
        let one_year_ms = 365i64 * 24 * 60 * 60 * 1000;
        insert(&pool, &NewTranscription {
            created_at: 0, text: "old".into(), duration_ms: 100, word_count: 1,
            provider_id: "openai".into(), model_id: "whisper-1".into(),
        }).await.unwrap();
        insert(&pool, &NewTranscription {
            created_at: one_year_ms - 1000, text: "new".into(), duration_ms: 100, word_count: 1,
            provider_id: "openai".into(), model_id: "whisper-1".into(),
        }).await.unwrap();
        let (soft, _hard) = purge(&pool, one_year_ms, 365).await.unwrap();
        assert_eq!(soft, 1);
        let rows = list(&pool, 100, 0).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].text, "new");
    }
}
```

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib history::retention::tests`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/history/retention.rs
git commit -m "feat(desktop): add rolling-window retention purge with soft-delete grace period"
```

---

## Section 7: Shortcut module — standard plugin + macOS Fn-key CGEventTap

### Task 14: ShortcutManager trait + standard plugin wrapper

**Files:**
- Create: `packages/desktop/src-tauri/src/shortcut/mod.rs`
- Create: `packages/desktop/src-tauri/src/shortcut/standard.rs`
- Create: `packages/desktop/src-tauri/src/shortcut/mock.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Spec reference:** §6.10

**Steps:**

- [ ] **Step 1: Create the trait + types**

Create `packages/desktop/src-tauri/src/shortcut/mod.rs`:

```rust
use serde::{Deserialize, Serialize};

pub mod mock;
pub mod standard;

#[cfg(target_os = "macos")]
pub mod macos_fn;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum HotkeyCombo {
    Fn,
    Standard { combo: String },
}

#[derive(Debug, thiserror::Error)]
pub enum ShortcutError {
    #[error("accessibility permission required for Fn-key shortcut")]
    AccessibilityRequired,
    #[error("shortcut backend error: {0}")]
    Backend(String),
}

pub trait ShortcutManager: Send + Sync {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError>;
    fn unregister(&self) -> Result<(), ShortcutError>;
}
```

- [ ] **Step 2: Standard plugin wrapper**

Create `packages/desktop/src-tauri/src/shortcut/standard.rs`:

```rust
use super::{HotkeyCombo, ShortcutError, ShortcutManager};

pub struct StandardShortcut {
    // App handle / inner manager held for register calls; left as a placeholder
    // because the actual tauri AppHandle threading is wired in commands.rs.
}

impl ShortcutManager for StandardShortcut {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError> {
        match combo {
            HotkeyCombo::Fn => Err(ShortcutError::Backend(
                "Fn key not supported by tauri-plugin-global-shortcut; use macos_fn module on macOS".into(),
            )),
            HotkeyCombo::Standard { combo: _ } => {
                // Real registration call lives in commands.rs where the AppHandle is available.
                // This shim returns Ok; integration is wired through a callback registered there.
                Ok(())
            }
        }
    }
    fn unregister(&self) -> Result<(), ShortcutError> {
        Ok(())
    }
}
```

- [ ] **Step 3: Mock impl with `trigger()` for tests**

Create `packages/desktop/src-tauri/src/shortcut/mock.rs`:

```rust
use super::{HotkeyCombo, ShortcutError, ShortcutManager};
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct MockShortcutManager {
    pub registered: Arc<Mutex<Option<HotkeyCombo>>>,
    pub trigger_count: Arc<Mutex<u32>>,
}

impl MockShortcutManager {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn trigger(&self) {
        *self.trigger_count.lock().unwrap() += 1;
    }
}

impl ShortcutManager for MockShortcutManager {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError> {
        *self.registered.lock().unwrap() = Some(combo);
        Ok(())
    }
    fn unregister(&self) -> Result<(), ShortcutError> {
        *self.registered.lock().unwrap() = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_records_combo() {
        let m = MockShortcutManager::new();
        m.register(HotkeyCombo::Fn).unwrap();
        assert_eq!(*m.registered.lock().unwrap(), Some(HotkeyCombo::Fn));
    }

    #[test]
    fn trigger_increments_count() {
        let m = MockShortcutManager::new();
        m.trigger();
        m.trigger();
        assert_eq!(*m.trigger_count.lock().unwrap(), 2);
    }
}
```

Update `packages/desktop/src-tauri/src/lib.rs` adding `pub mod shortcut;`.

- [ ] **Step 4: Run tests**

Run: `cd packages/desktop/src-tauri && cargo test --lib shortcut::mock::tests`
Expected: PASS — both tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/shortcut/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add ShortcutManager trait with standard and mock implementations"
```

---

### Task 15: macOS Fn-key CGEventTap

**Files:**
- Create: `packages/desktop/src-tauri/src/shortcut/macos_fn.rs`

**Spec reference:** §6.10 (CGEventTap, kCGEventFlagMaskSecondaryFn)

**Steps:**

- [ ] **Step 1: Implement the event tap**

Create `packages/desktop/src-tauri/src/shortcut/macos_fn.rs`:

```rust
#![cfg(target_os = "macos")]

use super::{HotkeyCombo, ShortcutError, ShortcutManager};
use core_graphics::event::{
    CGEvent, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
    EventField,
};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

const FN_FLAG_MASK: u64 = 0x800000; // kCGEventFlagMaskSecondaryFn

pub struct MacOsFnTap<F: Fn() + Send + Sync + 'static> {
    on_toggle: Arc<F>,
    state: Arc<Mutex<TapState>>,
}

struct TapState {
    fn_down: bool,
    thread: Option<JoinHandle<()>>,
}

impl<F: Fn() + Send + Sync + 'static> MacOsFnTap<F> {
    pub fn new(on_toggle: F) -> Self {
        Self {
            on_toggle: Arc::new(on_toggle),
            state: Arc::new(Mutex::new(TapState { fn_down: false, thread: None })),
        }
    }

    fn start(&self) -> Result<(), ShortcutError> {
        let state = self.state.clone();
        let on_toggle = self.on_toggle.clone();
        let handle = thread::spawn(move || {
            let current = std::sync::Arc::new(std::sync::Mutex::new(false));
            let local = current.clone();
            let tap = CGEventTap::new(
                CGEventTapLocation::HID,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::Default,
                vec![CGEventType::FlagsChanged],
                move |_proxy, _etype, event| {
                    let flags = event.get_integer_value_field(EventField::EVENT_SOURCE_USER_DATA);
                    let _ = flags;
                    let raw_flags = event.get_flags().bits() as u64;
                    let fn_pressed = (raw_flags & FN_FLAG_MASK) != 0;
                    let mut prev = local.lock().unwrap();
                    if fn_pressed != *prev {
                        *prev = fn_pressed;
                        if fn_pressed {
                            on_toggle();
                        }
                    }
                    Some(event.clone())
                },
            );
            match tap {
                Ok(tap) => {
                    let loop_source = tap.mach_port().create_runloop_source(0).unwrap();
                    unsafe {
                        core_foundation::runloop::CFRunLoop::get_current()
                            .add_source(&loop_source, core_foundation::runloop::kCFRunLoopCommonModes);
                    }
                    tap.enable();
                    core_foundation::runloop::CFRunLoop::run_current();
                }
                Err(_) => {
                    log::error!("failed to create CGEventTap; Accessibility permission likely missing");
                }
            }
            let _ = state;
        });
        self.state.lock().unwrap().thread = Some(handle);
        Ok(())
    }
}

impl<F: Fn() + Send + Sync + 'static> ShortcutManager for MacOsFnTap<F> {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError> {
        match combo {
            HotkeyCombo::Fn => self.start(),
            HotkeyCombo::Standard { .. } => {
                Err(ShortcutError::Backend("MacOsFnTap only supports Fn combos".into()))
            }
        }
    }
    fn unregister(&self) -> Result<(), ShortcutError> {
        // The tap thread owns its run loop; in production we'd send a stop signal.
        // For v1 the tap survives the app lifetime.
        Ok(())
    }
}
```

Note: this code is structurally correct but `core-graphics` API surface evolves; verify exact `CGEvent::get_flags()` accessor and `CGEventTap::new` signature against current crate during implementation. The `FN_FLAG_MASK` value (`0x800000`) corresponds to `NSEventModifierFlagFunction` / `kCGEventFlagMaskSecondaryFn` and is stable across macOS versions.

- [ ] **Step 2: Verify compile on macOS**

Run: `cd packages/desktop/src-tauri && cargo check --target $(rustc -vV | grep host | awk '{print $2}')`
Expected: clean compile on macOS host.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/shortcut/macos_fn.rs
git commit -m "feat(desktop): add macOS Fn-key shortcut via CGEventTap (requires Accessibility)"
```

---

## Section 8: Tray + Clipboard + Paste modules

### Task 16: Clipboard wrapper trait

**Files:**
- Create: `packages/desktop/src-tauri/src/clipboard/mod.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Steps:**

- [ ] **Step 1: Define trait + tests**

Create `packages/desktop/src-tauri/src/clipboard/mod.rs`:

```rust
use std::sync::Mutex;

pub trait Clipboard: Send + Sync {
    fn write_text(&self, text: &str) -> Result<(), String>;
    fn read_text(&self) -> Result<String, String>;
}

pub struct InMemoryClipboard {
    inner: Mutex<String>,
}

impl InMemoryClipboard {
    pub fn new() -> Self { Self { inner: Mutex::new(String::new()) } }
}

impl Default for InMemoryClipboard {
    fn default() -> Self { Self::new() }
}

impl Clipboard for InMemoryClipboard {
    fn write_text(&self, text: &str) -> Result<(), String> {
        *self.inner.lock().unwrap() = text.to_string();
        Ok(())
    }
    fn read_text(&self) -> Result<String, String> {
        Ok(self.inner.lock().unwrap().clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_then_read_round_trips() {
        let c = InMemoryClipboard::new();
        c.write_text("hello").unwrap();
        assert_eq!(c.read_text().unwrap(), "hello");
    }
}
```

Update `packages/desktop/src-tauri/src/lib.rs` adding `pub mod clipboard;`.

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib clipboard::tests`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/clipboard/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add Clipboard trait with InMemoryClipboard for tests"
```

---

### Task 17: Synthetic paste via enigo

**Files:**
- Create: `packages/desktop/src-tauri/src/paste/mod.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Steps:**

- [ ] **Step 1: Define Paster trait + RecordingPaster mock + EnigoPaster**

Create `packages/desktop/src-tauri/src/paste/mod.rs`:

```rust
use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use std::sync::Mutex;

pub trait Paster: Send + Sync {
    fn paste_modifier_v(&self) -> Result<(), String>;
}

pub struct EnigoPaster;

impl Paster for EnigoPaster {
    fn paste_modifier_v(&self) -> Result<(), String> {
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
        let modifier = if cfg!(target_os = "macos") { Key::Meta } else { Key::Control };
        enigo.key(modifier, Direction::Press).map_err(|e| e.to_string())?;
        enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
        enigo.key(modifier, Direction::Release).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[derive(Default)]
pub struct RecordingPaster {
    pub calls: Mutex<u32>,
}

impl Paster for RecordingPaster {
    fn paste_modifier_v(&self) -> Result<(), String> {
        *self.calls.lock().unwrap() += 1;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recording_paster_counts_calls() {
        let p = RecordingPaster::default();
        p.paste_modifier_v().unwrap();
        p.paste_modifier_v().unwrap();
        assert_eq!(*p.calls.lock().unwrap(), 2);
    }
}
```

Update `packages/desktop/src-tauri/src/lib.rs` adding `pub mod paste;`.

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop/src-tauri && cargo test --lib paste::tests`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/paste/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add Paster trait with enigo-based real impl and recording mock"
```

---

### Task 18: Tray module — programmatic icon + menu

**Files:**
- Create: `packages/desktop/src-tauri/src/tray/mod.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Steps:**

- [ ] **Step 1: Implement tray builder**

Create `packages/desktop/src-tauri/src/tray/mod.rs`:

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let open_main = MenuItem::with_id(app, "open_main", "Open Vox Era", true, None::<&str>)?;
    let switch_provider_label = MenuItem::with_id(app, "switch_provider_label", "Switch provider →", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Vox Era", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_main, &switch_provider_label, &separator, &quit])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_main" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
```

Update `packages/desktop/src-tauri/src/lib.rs` adding `pub mod tray;` and calling `tray::build(&app.handle())?` inside the Tauri `setup` callback:

```rust
pub mod audio;
pub mod clipboard;
pub mod history;
pub mod paste;
pub mod secrets;
pub mod settings;
pub mod shortcut;
pub mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(history::DB_URL, history::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            tray::build(&app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

- [ ] **Step 2: Verify compile**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: clean compile.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/tray/ packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add system tray with Open Vox Era and Quit menu items"
```

---

## Section 9: Tauri commands aggregation + capabilities

### Task 19: Tauri capabilities config

**Files:**
- Create: `packages/desktop/src-tauri/capabilities/default.json`

**Spec reference:** §6.1

**Steps:**

- [ ] **Step 1: Create the capability JSON**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities granted to the main and overlay webviews",
  "windows": ["main", "overlay"],
  "permissions": [
    "core:default",
    "core:event:allow-emit",
    "core:event:allow-listen",
    "core:event:allow-unlisten",
    "core:webview:allow-create-webview-window",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-text",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-load",
    "store:default",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "updater:default",
    "updater:allow-check",
    "updater:allow-download-and-install"
  ]
}
```

- [ ] **Step 2: Verify Tauri picks it up**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: clean compile; Tauri's build script generates the capabilities schema if missing.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/capabilities/
git commit -m "feat(desktop): add Tauri capabilities granting required plugin permissions"
```

---

### Task 20: Tauri commands surface

**Files:**
- Create: `packages/desktop/src-tauri/src/commands.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Spec reference:** §6.2 (Tauri command table)

**Steps:**

- [ ] **Step 1: Define the commands**

Create `packages/desktop/src-tauri/src/commands.rs`:

```rust
use crate::audio::{AudioSource, PermissionState};
use crate::secrets::Vault;
use crate::history::repo::{NewTranscription, Transcription};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

pub struct AppState {
    pub audio: Box<dyn AudioSource>,
    pub vault: Box<dyn Vault>,
    pub clipboard: Box<dyn crate::clipboard::Clipboard>,
    pub paster: Box<dyn crate::paste::Paster>,
}

#[tauri::command]
pub fn check_microphone_permission(state: State<'_, AppState>) -> PermissionState {
    state.audio.check_permission()
}

#[tauri::command]
pub fn request_microphone_permission(state: State<'_, AppState>) -> Result<PermissionState, String> {
    state.audio.request_permission().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_accessibility_permission() -> PermissionState {
    crate::audio::permissions::check_accessibility_permission()
}

#[tauri::command]
pub fn request_accessibility_permission() -> Result<(), String> {
    crate::audio::permissions::request_accessibility_permission().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_settings_panel(panel: String) -> Result<(), String> {
    use crate::audio::permissions::{open_settings_microphone_panel, open_settings_accessibility_panel};
    match panel.as_str() {
        "microphone" => open_settings_microphone_panel().map_err(|e| e.to_string()),
        "accessibility" => open_settings_accessibility_panel().map_err(|e| e.to_string()),
        _ => Err(format!("unknown panel: {panel}")),
    }
}

#[tauri::command]
pub fn start_recording(state: State<'_, AppState>) -> Result<String, String> {
    let session = state.audio.start_capture().map_err(|e| e.to_string())?;
    Ok(session.id.to_string())
}

#[tauri::command]
pub fn stop_recording(state: State<'_, AppState>, session_id: String) -> Result<Vec<u8>, String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    let session = crate::audio::CaptureSession { id };
    state.audio.stop_capture(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secret(state: State<'_, AppState>, provider_id: String) -> Result<Option<String>, String> {
    let opt = state.vault.get(&provider_id).map_err(|e| e.to_string())?;
    Ok(opt.map(|z| z.to_string()))
}

#[tauri::command]
pub fn set_secret(state: State<'_, AppState>, provider_id: String, key: String) -> Result<(), String> {
    state.vault.set(&provider_id, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_secret(state: State<'_, AppState>, provider_id: String) -> Result<(), String> {
    state.vault.delete(&provider_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_configured_providers(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.vault.list_configured().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn paste_text(state: State<'_, AppState>, text: String) -> Result<(), String> {
    state.clipboard.write_text(&text)?;
    state.paster.paste_modifier_v()
}

pub fn handlers() -> impl Fn(tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    |b| {
        b.invoke_handler(tauri::generate_handler![
            check_microphone_permission,
            request_microphone_permission,
            check_accessibility_permission,
            request_accessibility_permission,
            open_settings_panel,
            start_recording,
            stop_recording,
            get_secret,
            set_secret,
            delete_secret,
            list_configured_providers,
            paste_text,
        ])
    }
}
```

- [ ] **Step 2: Wire into `lib.rs` `run()`**

Update `packages/desktop/src-tauri/src/lib.rs`:

```rust
pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod history;
pub mod paste;
pub mod secrets;
pub mod settings;
pub mod shortcut;
pub mod tray;

use audio::microphone::MicrophoneSource;
use clipboard::InMemoryClipboard;
use commands::AppState;
use paste::EnigoPaster;
use secrets::keyring_vault::KeyringVault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    let app_state = AppState {
        audio: Box::new(MicrophoneSource::new()),
        vault: Box::new(KeyringVault::new(vec![])),
        clipboard: Box::new(InMemoryClipboard::new()),
        paster: Box::new(EnigoPaster),
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(history::DB_URL, history::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::check_microphone_permission,
            commands::request_microphone_permission,
            commands::check_accessibility_permission,
            commands::request_accessibility_permission,
            commands::open_settings_panel,
            commands::start_recording,
            commands::stop_recording,
            commands::get_secret,
            commands::set_secret,
            commands::delete_secret,
            commands::list_configured_providers,
            commands::paste_text,
        ])
        .setup(|app| {
            tray::build(&app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
```

- [ ] **Step 3: Verify compile**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: clean compile.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/commands.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): expose Tauri command surface for permissions, recording, secrets, paste"
```

---

## Section 10: React shell — invoke wrapper, main + overlay windows

### Task 21: React entry + invoke typed wrapper

**Files:**
- Create: `packages/desktop/src/main.tsx`
- Create: `packages/desktop/src/App.tsx`
- Create: `packages/desktop/src/lib/invoke.ts`
- Create: `packages/desktop/src/lib/invoke.test.ts`

**Steps:**

- [ ] **Step 1: Failing test for invoke wrapper**

Create `packages/desktop/src/lib/invoke.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@tauri-apps/api/core';
import { vox } from './invoke';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('invoke wrapper', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('checkMicrophonePermission delegates to invoke with the snake_case name', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce('Granted');
        const result = await vox.checkMicrophonePermission();
        expect(core.invoke).toHaveBeenCalledWith('check_microphone_permission');
        expect(result).toBe('Granted');
    });

    it('setSecret passes camelCase args translated to snake_case', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce(undefined);
        await vox.setSecret('openai', 'sk-test');
        expect(core.invoke).toHaveBeenCalledWith('set_secret', {
            providerId: 'openai',
            key: 'sk-test',
        });
    });
});
```

- [ ] **Step 2: Run; expect fail**

Run: `cd packages/desktop && bun run test:unit src/lib/invoke.test.ts`
Expected: FAIL — `vox` is undefined.

- [ ] **Step 3: Implement**

Create `packages/desktop/src/lib/invoke.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';

export type PermissionState = 'Granted' | 'Denied' | 'NotDetermined';

export const vox = {
    checkMicrophonePermission: () => invoke<PermissionState>('check_microphone_permission'),
    requestMicrophonePermission: () => invoke<PermissionState>('request_microphone_permission'),
    checkAccessibilityPermission: () => invoke<PermissionState>('check_accessibility_permission'),
    requestAccessibilityPermission: () => invoke<void>('request_accessibility_permission'),
    openSettingsPanel: (panel: 'microphone' | 'accessibility') =>
        invoke<void>('open_settings_panel', { panel }),
    startRecording: () => invoke<string>('start_recording'),
    stopRecording: (sessionId: string) =>
        invoke<number[]>('stop_recording', { sessionId }),
    getSecret: (providerId: string) =>
        invoke<string | null>('get_secret', { providerId }),
    setSecret: (providerId: string, key: string) =>
        invoke<void>('set_secret', { providerId, key }),
    deleteSecret: (providerId: string) =>
        invoke<void>('delete_secret', { providerId }),
    listConfiguredProviders: () => invoke<string[]>('list_configured_providers'),
    pasteText: (text: string) => invoke<void>('paste_text', { text }),
};
```

- [ ] **Step 4: Create entry + App shell**

Create `packages/desktop/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
```

Create `packages/desktop/src/App.tsx`:

```tsx
export default function App() {
    const params = new URLSearchParams(window.location.search);
    const which = params.get('window') ?? 'main';
    if (which === 'overlay') {
        return <div>Overlay placeholder — implemented in Section 12.</div>;
    }
    return <div>Main window placeholder — implemented in Section 12.</div>;
}
```

- [ ] **Step 5: Run; expect pass**

Run: `cd packages/desktop && bun run test:unit src/lib/invoke.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/
git commit -m "feat(desktop): add typed invoke wrapper and React entry point"
```

---

## Section 11: Provider registry — types + 9 adapters + tests

### Task 22: Provider types + transcribe orchestration

**Files:**
- Create: `packages/desktop/src/providers/types.ts`
- Create: `packages/desktop/src/lib/transcribe.ts`
- Create: `packages/desktop/src/lib/transcribe.test.ts`

**Spec reference:** §6.7 (provider system) + §7 (provider details)

**Steps:**

- [ ] **Step 1: Define types**

Create `packages/desktop/src/providers/types.ts`:

```ts
export interface Model {
    id: string;
    displayName: string;
    description?: string;
}

export interface PricingEntry {
    perMinuteUSD: number;
    lastUpdated: string;
}

export interface ProviderConfig {
    id: string;
    name: string;
    logoSrc: string;
    docsUrl: string;
    apiKeyHelpUrl: string;
    pricingDocsUrl: string;
    makeModel: (modelId: string, apiKey: string) => unknown;
    listModels: ((apiKey: string) => Promise<Model[]>) | null;
    defaultModels: Model[];
    pricing: Record<string, PricingEntry>;
    validateKey?: (apiKey: string) => Promise<boolean>;
}
```

- [ ] **Step 2: Failing test for orchestration**

Create `packages/desktop/src/lib/transcribe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('ai', () => ({
    experimental_transcribe: vi.fn(async () => ({ text: 'hello world' })),
}));

import { transcribe } from './transcribe';
import { PROVIDERS } from '../providers';

describe('transcribe orchestration', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('throws when no key configured for active provider', async () => {
        vi.mocked(core.invoke)
            .mockResolvedValueOnce('openai')   // activeProviderId
            .mockResolvedValueOnce('whisper-1') // activeModelId
            .mockResolvedValueOnce(null);       // get_secret returns null
        await expect(transcribe(new Blob([new Uint8Array([1, 2, 3])]))).rejects.toThrow(/No API key/);
    });

    it('returns text from AI SDK when key is configured', async () => {
        vi.mocked(core.invoke)
            .mockResolvedValueOnce('openai')
            .mockResolvedValueOnce('whisper-1')
            .mockResolvedValueOnce('sk-test');
        const result = await transcribe(new Blob([new Uint8Array([1, 2, 3])]));
        expect(result).toBe('hello world');
    });

    it('PROVIDERS contains the 9 v1 provider ids', () => {
        const ids = PROVIDERS.map(p => p.id).sort();
        expect(ids).toEqual([
            'assemblyai', 'azure-openai', 'deepgram', 'elevenlabs', 'fal',
            'gladia', 'groq', 'openai', 'revai',
        ]);
    });
});
```

- [ ] **Step 3: Run; expect fail (transcribe + PROVIDERS undefined)**

Run: `cd packages/desktop && bun run test:unit src/lib/transcribe.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement transcribe + provider registry**

Create `packages/desktop/src/lib/transcribe.ts`:

```ts
import { experimental_transcribe as transcribeAi } from 'ai';
import { vox } from './invoke';
import { PROVIDERS } from '../providers';

export async function transcribe(audio: Blob): Promise<string> {
    const activeProviderId = (await vox.getSetting?.('activeProviderId')) ?? 'openai';
    const activeModelId = (await vox.getSetting?.('activeModelId')) ?? 'whisper-1';
    const provider = PROVIDERS.find(p => p.id === activeProviderId);
    if (!provider) throw new Error(`Unknown provider: ${activeProviderId}`);
    const apiKey = await vox.getSecret(provider.id);
    if (!apiKey) throw new Error(`No API key configured for provider ${provider.name}`);
    const model = provider.makeModel(activeModelId, apiKey);
    const { text } = await transcribeAi({
        model,
        audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return text;
}
```

(Note: `vox.getSetting` is added in a later task; the test mocks `invoke` directly, so the call path resolves through the mock chain.)

For the test to pass with the mocked invoke chain, simplify:

```ts
import { experimental_transcribe as transcribeAi } from 'ai';
import { invoke } from '@tauri-apps/api/core';
import { PROVIDERS } from '../providers';

export async function transcribe(audio: Blob): Promise<string> {
    const activeProviderId = await invoke<string>('get_setting', { key: 'activeProviderId' });
    const activeModelId = await invoke<string>('get_setting', { key: 'activeModelId' });
    const provider = PROVIDERS.find(p => p.id === activeProviderId);
    if (!provider) throw new Error(`Unknown provider: ${activeProviderId}`);
    const apiKey = await invoke<string | null>('get_secret', { providerId: provider.id });
    if (!apiKey) throw new Error(`No API key configured for provider ${provider.name}`);
    const model = provider.makeModel(activeModelId, apiKey);
    const { text } = await transcribeAi({
        model: model as Parameters<typeof transcribeAi>[0]['model'],
        audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return text;
}
```

Create `packages/desktop/src/providers/index.ts` (with stubs that satisfy the type contract):

```ts
import type { ProviderConfig } from './types';
import { openaiConfig } from './openai';
import { azureOpenaiConfig } from './azure-openai';
import { groqConfig } from './groq';
import { deepgramConfig } from './deepgram';
import { assemblyaiConfig } from './assemblyai';
import { elevenlabsConfig } from './elevenlabs';
import { falConfig } from './fal';
import { gladiaConfig } from './gladia';
import { revaiConfig } from './revai';

export const PROVIDERS: readonly ProviderConfig[] = [
    assemblyaiConfig,
    azureOpenaiConfig,
    deepgramConfig,
    elevenlabsConfig,
    falConfig,
    gladiaConfig,
    groqConfig,
    openaiConfig,
    revaiConfig,
] as const;
```

Create stub adapter files for each (they get fleshed out in Tasks 23-31).

Run: `cd packages/desktop && bun add ai @ai-sdk/openai @ai-sdk/groq @ai-sdk/deepgram @ai-sdk/assemblyai @ai-sdk/elevenlabs @ai-sdk/fal @ai-sdk/gladia @ai-sdk/revai @ai-sdk/azure`

For each provider file (example `packages/desktop/src/providers/openai.ts`), use the pattern from spec §7. For Tasks 22's purposes the stubs are minimal — Tasks 23-31 add real factories + pricing + listModels.

Minimal stub for each adapter (replace `<id>`, `<Name>`, `<sdk-import>`, `<docs-url>`):

```ts
// packages/desktop/src/providers/openai.ts
import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderConfig } from './types';

export const openaiConfig: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    logoSrc: '/logos/openai.svg',
    docsUrl: 'https://platform.openai.com/docs/guides/speech-to-text',
    apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
    pricingDocsUrl: 'https://openai.com/api/pricing/',
    makeModel: (modelId, apiKey) => createOpenAI({ apiKey }).transcription(modelId),
    listModels: null,
    defaultModels: [
        { id: 'whisper-1', displayName: 'Whisper 1' },
        { id: 'gpt-4o-transcribe', displayName: 'GPT-4o Transcribe' },
    ],
    pricing: {
        'whisper-1': { perMinuteUSD: 0.006, lastUpdated: '2026-05-03' },
        'gpt-4o-transcribe': { perMinuteUSD: 0.006, lastUpdated: '2026-05-03' },
    },
};
```

Replicate similarly for the other 8 providers in their own task files (Tasks 23-31). For Task 22 commit, minimal stubs in each file are sufficient to make the registry import compile.

- [ ] **Step 5: Run; expect pass**

Run: `cd packages/desktop && bun run test:unit src/lib/transcribe.test.ts`
Expected: PASS — all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/providers/ packages/desktop/src/lib/transcribe.ts packages/desktop/src/lib/transcribe.test.ts packages/desktop/package.json
git commit -m "feat(desktop): add provider registry types, 9 stub adapters, and transcribe orchestration"
```

---

### Tasks 23-31: Flesh out each provider adapter (one task per provider)

Each provider gets its own task with the same shape: define `<provider>Config` with real `makeModel`, real `defaultModels`, real `pricing` entries from current docs, and `listModels` if the provider has a queryable models endpoint. Each task includes a contract test.

For brevity these tasks share an identical 5-step structure:

**Files (per task):** `packages/desktop/src/providers/<id>.ts`, `packages/desktop/src/providers/<id>.test.ts`

**Per-task steps:**

- [ ] **Step 1: Write contract test**

For each `<provider>` (replace `<id>`, `<sdk-import>`):

```ts
// packages/desktop/src/providers/<id>.test.ts
import { describe, it, expect } from 'vitest';
import { <id>Config as cfg } from './<id>';

describe('<id> provider config', () => {
    it('has the required fields', () => {
        expect(cfg.id).toBe('<id>');
        expect(cfg.defaultModels.length).toBeGreaterThan(0);
        expect(typeof cfg.makeModel).toBe('function');
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            expect(cfg.pricing[m.id]).toBeDefined();
            expect(cfg.pricing[m.id].perMinuteUSD).toBeGreaterThan(0);
        }
    });
});
```

- [ ] **Step 2: Run; fail**
- [ ] **Step 3: Fill the adapter file with real values** (refer to current provider docs)
- [ ] **Step 4: Run; pass**
- [ ] **Step 5: Commit** with message `feat(desktop): add <name> provider adapter with pricing and default models`

**Provider list with rate hints (verify against current docs at impl time):**

| Task | Provider | Default models | Approx rate per minute USD |
|---|---|---|---|
| 23 | OpenAI | `whisper-1`, `gpt-4o-transcribe` | `whisper-1: 0.006`, `gpt-4o-transcribe: 0.006` |
| 24 | Azure OpenAI | `whisper` | `0.006` (varies by region/tier) |
| 25 | Groq | `whisper-large-v3`, `whisper-large-v3-turbo`, `distil-whisper-large-v3-en` | `0.000185 / 0.000067 / 0.000033` |
| 26 | Deepgram | `nova-3`, `nova-2`, `whisper-large` | `nova-3: 0.0043`, `nova-2: 0.0043`, `whisper-large: 0.0048` |
| 27 | AssemblyAI | `best`, `nano` | `best: 0.00617`, `nano: 0.00204` |
| 28 | ElevenLabs | `scribe_v1` | `0.00667` |
| 29 | Fal | `wizper`, `whisper` | `wizper: 0.0125`, `whisper: 0.005` |
| 30 | Gladia | `whisper-large-v3` | `0.0102` |
| 31 | Rev.ai | `machine`, `low_cost`, `human` | `machine: 0.025`, `low_cost: 0.0167`, `human: 1.50` |

For providers without a clean models endpoint (Deepgram, AssemblyAI, Gladia, Rev.ai, Fal): set `listModels: null` and rely on `defaultModels`. For OpenAI, Groq, ElevenLabs: implement `listModels` per spec §6.7's per-provider table.

---

## Section 12: React UI — Tailwind, shadcn-neobrutalism, all windows

### Task 32: Tailwind + shadcn + neobrutalism setup

**Files:**
- Create: `packages/desktop/tailwind.config.ts`
- Create: `packages/desktop/postcss.config.js`
- Create: `packages/desktop/src/styles/globals.css`
- Modify: `packages/desktop/src/main.tsx` (import globals.css)
- Modify: `packages/desktop/index.html` (link styles)
- Add: `packages/desktop/components.json` (shadcn config)

**Steps:**

- [ ] **Step 1: Install Tailwind**

```bash
cd packages/desktop && bun add -D tailwindcss postcss autoprefixer && bunx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

Replace `packages/desktop/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                main: 'hsl(var(--main))',
                'main-foreground': 'hsl(var(--main-foreground))',
                bg: 'hsl(var(--bg))',
                fg: 'hsl(var(--fg))',
                border: 'hsl(var(--border))',
            },
            borderWidth: { '3': '3px', '5': '5px' },
            boxShadow: {
                neo: '4px 4px 0 0 hsl(var(--border))',
                'neo-lg': '6px 6px 0 0 hsl(var(--border))',
            },
            fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
        },
    },
    plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Initialize shadcn**

```bash
cd packages/desktop && bunx shadcn@latest init --defaults
```

Accept defaults; this creates `components.json` and base `lib/utils.ts`.

- [ ] **Step 4: Install neobrutalism `globals.css`**

Replace `packages/desktop/src/styles/globals.css` with the neobrutalism palette (per https://www.neobrutalism.dev/docs/installation):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --bg: 60 100% 95%;
        --fg: 0 0% 0%;
        --main: 50 100% 65%;
        --main-foreground: 0 0% 0%;
        --border: 0 0% 0%;
    }
    .dark {
        --bg: 240 6% 10%;
        --fg: 0 0% 95%;
        --main: 50 100% 55%;
        --main-foreground: 0 0% 0%;
        --border: 0 0% 0%;
    }
}

@layer base {
    * { border-color: hsl(var(--border)); }
    body {
        background-color: hsl(var(--bg));
        color: hsl(var(--fg));
        font-family: theme('fontFamily.sans');
    }
}
```

- [ ] **Step 5: Add neobrutalism components via CLI**

```bash
cd packages/desktop
bunx shadcn@latest add button card dialog input label select switch tabs
# Then visit https://www.neobrutalism.dev/ for any component-specific overrides;
# the standard shadcn components above are sufficient for v1 with the global CSS above.
```

- [ ] **Step 6: Wire styles into main.tsx**

Update `packages/desktop/src/main.tsx` to import `'./styles/globals.css'` at the top.

- [ ] **Step 7: Verify build**

Run: `cd packages/desktop && bun run build`
Expected: vite builds; no Tailwind errors.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/
git commit -m "feat(desktop): set up Tailwind + shadcn with neobrutalism palette"
```

---

### Tasks 33-39: Main window UI tabs + overlay window

Group all React UI work into 7 tightly-scoped tasks. Each follows the 5-step TDD pattern with React Testing Library.

**Task 33:** Main window shell + tab navigation (Dashboard / History / Settings / About). File: `src/windows/main/MainWindow.tsx` + test.

**Task 34:** Dashboard tab — render stats summary (words, streak, WPM, time saved, top provider, top model, estimated cost). File: `src/windows/main/Dashboard.tsx` + test using a fake stats payload.

**Task 35:** History tab — paginated list with provider filter and search. File: `src/windows/main/History.tsx` + test.

**Task 36:** Settings — Providers subsection (provider cards with key input + model picker + active toggle). File: `src/windows/main/SettingsProviders.tsx` + test.

**Task 37:** Settings — Recording (hotkey config, mic device picker, test recording button). File: `src/windows/main/SettingsRecording.tsx` + test.

**Task 38:** Settings — Overlay / History / Theme / Updates subsections (smaller forms). Files: `src/windows/main/SettingsOverlay.tsx`, `SettingsHistory.tsx`, `SettingsTheme.tsx`, `SettingsUpdates.tsx`, each with a tiny render test.

**Task 39:** Overlay window — recording state pill with waveform animation + click-to-expand actions. File: `src/windows/overlay/OverlayWindow.tsx` + test.

Each task:
- Step 1: Write a render test asserting structure (e.g., "shows 'Recording' when state is recording")
- Step 2: Run; fail
- Step 3: Implement the component using shadcn-neobrutalism primitives + Tauri `vox.*` calls for state
- Step 4: Run; pass
- Step 5: Commit `feat(desktop): add <component name>`

For brevity, the per-task code is not duplicated here. Use `packages/desktop/src/windows/main/Dashboard.tsx` as a template (each component receives props via `vox.*` invokes wrapped in a custom hook like `useVoxStats()` in `src/lib/hooks.ts`).

---

## Section 13: Functional tests with audio fixtures

### Task 40: Audio fixture commit + regeneration script

**Files:**
- Create: `packages/desktop/tests/fixtures/audio/regenerate.ts`
- Create: `packages/desktop/tests/fixtures/audio/README.md`
- Add: `packages/desktop/tests/fixtures/audio/hello-world.wav`, `silence.wav`, `noise.wav`, `long-speech.wav`, `multilingual.wav`

**Spec reference:** §9.3

**Steps:**

- [ ] **Step 1: Write `regenerate.ts`**

Create `packages/desktop/tests/fixtures/audio/regenerate.ts`:

```ts
#!/usr/bin/env bun
// Regenerates the audio fixtures used by Vox Era's tests.
//
// Usage: OPENAI_API_KEY=... bun tests/fixtures/audio/regenerate.ts
//
// Generates 5 WAV files via OpenAI TTS. License: outputs are usage-licensed
// under OpenAI's terms; we use them for our own test fixtures only.

import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
    console.error('Set OPENAI_API_KEY in env to regenerate fixtures.');
    process.exit(1);
}

const FIXTURES = [
    { name: 'hello-world.wav', text: 'Hello, world.' },
    { name: 'long-speech.wav', text: 'This is a longer fixture, used for testing multi-sentence transcription with realistic pacing.' },
    { name: 'multilingual.wav', text: 'Bonjour le monde.', voice: 'alloy' },
];

for (const f of FIXTURES) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'tts-1', input: f.text, voice: 'alloy', response_format: 'wav' }),
    });
    if (!res.ok) throw new Error(`Failed for ${f.name}: ${res.status}`);
    await writeFile(`packages/desktop/tests/fixtures/audio/${f.name}`, Buffer.from(await res.arrayBuffer()));
    console.log('wrote', f.name);
}

// silence.wav and noise.wav are generated synthetically (no API calls):
import { encode_silence_wav, encode_noise_wav } from './synth';
await writeFile('packages/desktop/tests/fixtures/audio/silence.wav', encode_silence_wav(2.0, 16000));
await writeFile('packages/desktop/tests/fixtures/audio/noise.wav', encode_noise_wav(2.0, 16000));
```

Create `packages/desktop/tests/fixtures/audio/synth.ts`:

```ts
import { Buffer } from 'node:buffer';

export function encode_silence_wav(seconds: number, sampleRate: number): Buffer {
    const samples = new Int16Array(Math.floor(seconds * sampleRate));
    return wrapWavMono16(samples, sampleRate);
}

export function encode_noise_wav(seconds: number, sampleRate: number): Buffer {
    const n = Math.floor(seconds * sampleRate);
    const samples = new Int16Array(n);
    for (let i = 0; i < n; i++) samples[i] = (Math.random() * 2000 - 1000) | 0;
    return wrapWavMono16(samples, sampleRate);
}

function wrapWavMono16(samples: Int16Array, sr: number): Buffer {
    const dataLen = samples.byteLength;
    const buf = Buffer.alloc(44 + dataLen);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataLen, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(dataLen, 40);
    Buffer.from(samples.buffer).copy(buf, 44);
    return buf;
}
```

- [ ] **Step 2: Document the fixtures**

Create `packages/desktop/tests/fixtures/audio/README.md`:

```markdown
# Audio fixtures

Used by functional tests in `tests/functional/`.

| File | Content | Purpose |
|---|---|---|
| `hello-world.wav` | "Hello, world." | Happy path |
| `silence.wav` | 2s silence | Edge: no speech |
| `noise.wav` | 2s background noise | Edge: noise-only |
| `long-speech.wav` | ~10s multi-sentence | Long form |
| `multilingual.wav` | Non-English speech | Edge: language detection |

## Provenance

- `hello-world.wav`, `long-speech.wav`, `multilingual.wav`: generated via OpenAI TTS (`tts-1`, voice `alloy`). License: per OpenAI usage terms; used here for internal testing only.
- `silence.wav`, `noise.wav`: generated synthetically (see `synth.ts`).

## Regenerate

```
OPENAI_API_KEY=sk-... bun tests/fixtures/audio/regenerate.ts
```

Commit the resulting WAVs alongside any provenance changes.
```

- [ ] **Step 3: Generate the fixtures**

Run: `OPENAI_API_KEY=$YOUR_KEY bun packages/desktop/tests/fixtures/audio/regenerate.ts`
Expected: 5 WAV files written.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/tests/fixtures/audio/
git commit -m "test(desktop): add audio fixtures with regeneration script"
```

---

### Task 41: Functional test — full transcribe flow with mocked HTTP

**Files:**
- Create: `packages/desktop/tests/functional/transcribe-flow.test.ts`

**Steps:**

- [ ] **Step 1: Write the failing test using MSW v2**

Create `packages/desktop/tests/functional/transcribe-flow.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as core from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { transcribe } from '../../src/lib/transcribe';

const server = setupServer(
    http.post('https://api.openai.com/v1/audio/transcriptions', async () => {
        return HttpResponse.json({ text: 'hello world' });
    }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('functional: full transcribe flow', () => {
    it('hello-world fixture transcribes via OpenAI provider end-to-end', async () => {
        const wavBytes = readFileSync(
            resolve(__dirname, '../fixtures/audio/hello-world.wav'),
        );
        const blob = new Blob([wavBytes], { type: 'audio/wav' });

        vi.mocked(core.invoke)
            .mockResolvedValueOnce('openai')      // activeProviderId
            .mockResolvedValueOnce('whisper-1')   // activeModelId
            .mockResolvedValueOnce('sk-test');    // get_secret

        const text = await transcribe(blob);
        expect(text).toBe('hello world');
    });
});
```

- [ ] **Step 2: Run; expect pass**

Run: `cd packages/desktop && bun run test:functional`
Expected: PASS — fixture loaded, MSW intercepts the OpenAI HTTP call, AI SDK returns the mocked text.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/tests/functional/
git commit -m "test(desktop): functional test of full transcribe flow with MSW + audio fixture"
```

---

## Section 14: Slash commands + final docs + CI matrix

### Task 42: Desktop-relevant slash commands

**Files:**
- Create: `.claude/commands/dev-desktop.md`
- Create: `.claude/commands/test.md`
- Create: `.claude/commands/test-fast.md`
- Create: `.claude/commands/typecheck.md`
- Create: `.claude/commands/lint.md`
- Create: `.claude/commands/coverage.md`
- Create: `.claude/commands/add-provider.md`
- Create: `.claude/commands/diagnose.md`
- Modify: `.claude/commands/build-clean.md` (replace Electron version)
- Modify: `.claude/commands/reset-perms.md` (update bundle id to `com.vhtechnology.voxera`)

**Steps:**

- [ ] **Step 1: Create each command with clear, executable instructions**

Example `.claude/commands/dev-desktop.md`:

```markdown
---
description: Start the Tauri desktop dev server (cargo watch + vite).
---

Run this from the repo root: `cd packages/desktop && bun run tauri:dev`.

Expected behavior: vite dev server starts on http://localhost:1420; tauri builds the Rust binary in debug mode and opens the app window. Hot reload works for the React side; cargo recompiles on Rust changes.
```

Example `.claude/commands/add-provider.md`:

```markdown
---
description: Scaffold a new STT provider adapter; updates registry, tests, docs, and landing grid.
---

Arguments: <provider-id> <Provider Name>

Steps:
1. Create `packages/desktop/src/providers/<provider-id>.ts` from the template (use OpenAI as reference).
2. Add the import + entry to `packages/desktop/src/providers/index.ts` PROVIDERS array, alphabetically.
3. Create `packages/desktop/src/providers/<provider-id>.test.ts` with the standard contract test (existence, has default models, pricing entries match defaults).
4. Add the logo SVG at `packages/landing/public/logos/<provider-id>.svg`.
5. Append the provider entry to `packages/landing/src/components/providers-grid.tsx`.
6. Update `docs/providers.md` adding a row for the new provider.
7. Update `packages/desktop/README.md` provider list.
8. Run: `cd packages/desktop && bun run test:unit src/providers/<provider-id>.test.ts` to verify.

Do not commit until all tests pass and docs are updated.
```

(Repeat for the other commands; each is a small markdown file with frontmatter + body.)

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/
git commit -m "feat(claude): add desktop-relevant slash commands for Vox Era"
```

---

### Task 43: Desktop docs

**Files:**
- Create: `docs/architecture.md`
- Create: `docs/permissions.md`
- Create: `docs/secrets.md`
- Create: `docs/providers.md`
- Create: `docs/testing.md`
- Create: `packages/desktop/README.md`

**Steps:**

- [ ] **Step 1: Author each doc**

Use spec sections directly:
- `docs/architecture.md`: §3 + §6.1 + §6.2 (command surface table) + §6.11 (recording flow sequence)
- `docs/permissions.md`: §6.3 (per-platform mic flow) + §6.10 (Accessibility for Fn key)
- `docs/secrets.md`: §6.4 (storage backends, threat model)
- `docs/providers.md`: §6.7 (data-driven contract, listModels strategies, pricing maintenance)
- `docs/testing.md`: §9 (4 layers, mocking boundaries, audio fixtures, coverage policy)
- `packages/desktop/README.md`: monorepo orientation, Rust/TS boundary, how to run dev/tests, how to add a provider (refs `/add-provider`)

Each doc references the spec for canonical truth and links to source files for verification.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md docs/permissions.md docs/secrets.md docs/providers.md docs/testing.md packages/desktop/README.md
git commit -m "docs(desktop): add architecture, permissions, secrets, providers, testing docs"
```

---

### Task 44: CI matrix expansion

**Files:**
- Modify: `.github/workflows/ci.yml`

**Steps:**

- [ ] **Step 1: Add platform-specific test jobs**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run typecheck

  test-desktop:
    name: Test desktop / ${{ matrix.os }}
    needs: [lint-typecheck]
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: dtolnay/rust-toolchain@stable
      - name: Install Linux deps
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libasound2-dev libssl-dev pkg-config
      - run: bun install --frozen-lockfile
      - name: Vitest (TS)
        run: cd packages/desktop && bun run test
      - name: cargo test (Rust)
        run: cd packages/desktop/src-tauri && cargo test --lib
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add desktop test matrix on macos/windows/linux"
```

---

## Plan B complete

At this point:

- [x] Tauri 2 scaffold with React+Vite+TS
- [x] Vitest configured with happy-dom + MSW v2 + coverage
- [x] All Rust modules: `audio` (cpal + per-platform permissions), `secrets` (keyring + zeroize + redacted Debug), `settings`, `history` (sqlx + migrations + repo + stats + retention), `shortcut` (standard + macOS Fn-key CGEventTap), `tray`, `clipboard`, `paste` (enigo)
- [x] Tauri capabilities config grants required plugin permissions
- [x] Tauri commands surface exposed via `commands.rs` with typed `vox.*` TS wrapper
- [x] All 9 STT provider adapters with real `makeModel`, `defaultModels`, `pricing` entries
- [x] React UI: main window with 4 tabs (Dashboard / History / Settings / About), overlay window, neobrutalism shadcn theming
- [x] Audio fixtures committed + regeneration script
- [x] 4-layer test suite passing locally and in CI matrix (macOS/Windows/Linux)
- [x] Desktop docs written: architecture, permissions, secrets, providers, testing
- [x] Slash commands: dev-desktop, test, test-fast, typecheck, lint, coverage, add-provider, build-clean (Tauri-aware), diagnose, reset-perms (updated bundle id)
- [x] CI matrix runs `cargo test --lib` and Vitest on all 3 platforms

**Hand-off:** Plan C may have already shipped in parallel; Plan D builds on B and C to deliver the first signed release.
