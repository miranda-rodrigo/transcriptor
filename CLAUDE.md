# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development (hot-reload for renderer + electron main process)
npm run dev

# Run only the renderer (Vite dev server on localhost)
npm run dev:renderer

# Run electron with already-running dev server
npm run dev:main

# Lint and format
npm run format:check   # Check without modifying
npm run format         # Auto-fix with ESLint + Prettier

# Build for current platform (unsigned, for local testing)
npm run pack

# Build distributable for specific platforms
npm run build:mac
npm run build:win
npm run build:linux

# Download whisper.cpp binary for current platform only
npm run download:whisper-cpp

# Download all platform binaries (needed for cross-platform builds)
npm run download:whisper-cpp:all

# Clean build artifacts
npm run clean
```

> **Before packaging**: `prebuild`/`prepack` scripts automatically run `compile:globe`, `download:whisper-cpp`, and `download:sherpa-onnx`. If you run these manually, ensure all three complete.

> **Unsigned builds**: `npm run pack` sets `CSC_IDENTITY_AUTO_DISCOVERY=false` — use this for local testing without an Apple Developer certificate.

## Architecture Overview

### Core Technologies
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Desktop Framework**: Electron 36 with context isolation
- **Database**: better-sqlite3 for local transcription history
- **UI Components**: shadcn/ui with Radix primitives
- **Speech Processing**: whisper.cpp (bundled native binary) + OpenAI API
- **Audio Processing**: FFmpeg (bundled via ffmpeg-static, unpacked from ASAR)

### Non-Obvious Architectural Decisions

**Dual Window Architecture**: The app has two windows sharing the same React/Vite bundle, differentiated by URL routing — a minimal overlay for dictation (always-on-top) and a full control panel for settings.

**Native Add-ons**: `compile:globe` builds a native Node addon for the macOS Globe key. This runs automatically before `start`/`dev` but must complete before Electron launches.

**Sherpa-ONNX**: A second native binary dependency (alongside whisper.cpp) used for VAD/speech detection. Downloaded via `scripts/download-sherpa-onnx.js`.

**Anthropic IPC Bridge**: Anthropic API calls are routed through the Electron main process (IPC) to avoid CORS restrictions in the renderer. OpenAI and Gemini call APIs directly from the renderer.

**Globe Key Fallback**: On macOS the default hotkey is the Globe key; on Windows/Linux it's backtick. `hotkeyManager.js` auto-falls back to F8/F9 if registration fails and notifies the renderer via IPC.

**API Key Persistence**: API keys are written to `.env` via `saveAllKeysToEnvFile()` in `environment.js` and reloaded on app start — not just stored in localStorage.

### Process Boundaries

```
Main Process (Node.js)
├── main.js              — app entry, initializes all managers
├── preload.js           — exposes window.api bridge (context-isolated)
└── src/helpers/         — all main-process modules
    ├── ipcHandlers.js   — all IPC channel registrations
    ├── whisper.js       — whisper.cpp binary wrapper
    ├── environment.js   — .env management, API key storage
    └── windowManager.js — window lifecycle

Renderer Process (React/Vite)
└── src/
    ├── components/      — React UI
    ├── hooks/           — React hooks (wrap window.api calls)
    ├── services/        — ReasoningService.ts (AI routing)
    └── models/          — ModelRegistry + modelRegistryData.json
```

**Adding a new IPC channel**: register in both `ipcHandlers.js` (main) and `preload.js` (bridge). Adding a new setting: update `useSettings.ts` + `SettingsPage.tsx`.

### Audio Pipeline

```
MediaRecorder → Blob → ArrayBuffer → IPC (10MB limit) → temp file → whisper.cpp → result → cleanup
```

### Model Registry (Single Source of Truth)

All AI model definitions live in `src/models/modelRegistryData.json`. Do **not** hardcode model IDs elsewhere — `ModelRegistry.ts`, `aiProvidersConfig.ts`, and `languages.ts` all derive from it.

```json
{
  "cloudProviders": [...],   // OpenAI (Responses API), Anthropic, Gemini
  "localProviders": [...]    // GGUF models with HuggingFace download URLs
}
```

**OpenAI uses the Responses API** (`/v1/responses` with `input[]`), not Chat Completions. GPT-5 and o-series models do not accept a `temperature` parameter.

### Key Implementation Details

**whisper.cpp binaries**: Stored in `resources/bin/whisper-cpp-{platform}-{arch}`. Falls back to system `brew install whisper-cpp` if bundled binary not found.

**GGML models**: Downloaded to `~/.cache/openwhispr/whisper-models/`. Download URLs: `{baseUrl}/{hfRepo}/resolve/main/{fileName}`.

**Debug mode**: Set `OPENWHISPR_LOG_LEVEL=debug` in `.env` or launch with `--log-level=debug`. Logs written to platform app data directory.

**Database**: Single SQLite file via better-sqlite3. Schema in `src/helpers/database.js`. Stores transcription history with optional AI-processed output.

### Platform Notes

| | macOS | Windows | Linux |
|---|---|---|---|
| Clipboard | AppleScript (requires Accessibility permission) | Standard | Standard |
| Hotkey default | Globe key | Backtick | Backtick |
| System settings URL | `x-apple.systempreferences:...` | `ms-settings:...` | None (manual) |
| whisper.cpp | arm64 + x64 | x64 | x64 |

## Code Conventions

- New React components: TypeScript (`.tsx`)
- New main-process modules: JavaScript (`.js`) following existing helper patterns
- New managers: create in `src/helpers/`, initialize in `main.js`
- All debug logging via `debugLogger.js` (not `console.log`)
