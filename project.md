# OpenWhispr — Project Overview

OpenWhispr is a desktop dictation application built with Electron, React, and whisper.cpp. It turns speech into text locally or via cloud APIs, pastes the result into the active application, and optionally processes commands through AI reasoning models. The app prioritizes privacy (local-first processing), minimal screen footprint, and a frictionless dictation workflow.

**Version:** 1.2.13  
**Platforms:** macOS, Windows, Linux  
**Stack:** Electron 36, React 19, TypeScript, Tailwind CSS v4, Vite, better-sqlite3, whisper.cpp, FFmpeg

---

## Table of Contents

1. [What the App Does](#what-the-app-does)
2. [Core Concepts](#core-concepts)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [Window System](#window-system)
5. [UI Design Language](#ui-design-language)
6. [Screens & User Flows](#screens--user-flows)
   - [Onboarding (6 steps)](#onboarding-6-steps)
   - [Dictation Overlay](#dictation-overlay)
   - [Control Panel](#control-panel)
   - [Settings Modal](#settings-modal)
   - [Prompt Studio](#prompt-studio)
   - [System Tray](#system-tray)
7. [Interaction Model](#interaction-model)
8. [AI Agent System](#ai-agent-system)
9. [Accessibility & Permissions](#accessibility--permissions)
10. [Platform-Specific Behavior](#platform-specific-behavior)

---

## What the App Does

OpenWhispr sits quietly on your desktop as a small floating button. Press a global hotkey (or click the button), speak, and the app transcribes your speech into text. The transcription is automatically copied to the clipboard and pasted into whatever application has focus — a text editor, a chat window, an email composer, a browser field.

Beyond plain dictation, users can address a named AI agent (e.g., "Hey Atlas, summarize this email") and the app will route the transcribed text through an AI reasoning model (OpenAI, Anthropic, Gemini, or a local GGUF model) before pasting the processed result.

### Key Value Propositions

- **Privacy-first**: Full local processing with whisper.cpp — no audio ever leaves the machine.
- **Cloud option**: OpenAI-compatible API for higher accuracy when desired.
- **Invisible UX**: A tiny floating widget that stays out of the way.
- **Universal input**: Works with any application that accepts paste.
- **AI-powered commands**: Natural language instructions processed by frontier models.
- **Cross-platform**: macOS, Windows, and Linux support.

---

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Transcription Mode** | Local (whisper.cpp) or Cloud (OpenAI/Groq API). Chosen during onboarding, changeable in settings. |
| **Activation Mode** | Hold-to-talk (release stops recording) or Toggle (press to start, press again to stop). |
| **Agent Name** | A custom name the user gives their AI assistant. Saying "Hey [Name]..." triggers AI reasoning instead of plain transcription. |
| **Reasoning Model** | The AI model used to process agent-addressed commands (GPT-5, Claude, Gemini, or local GGUF). |
| **Hotkey** | A global keyboard shortcut that starts/stops dictation from any application. Defaults to Globe (macOS) or backtick (Windows/Linux), with F8/F9 fallback. |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│                   Electron Main Process              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ Window   │  │ Hotkey   │  │ IPC Handlers      │ │
│  │ Manager  │  │ Manager  │  │ (audio, whisper,  │ │
│  │          │  │          │  │  clipboard, db)   │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ Tray     │  │ Database │  │ whisper.cpp       │ │
│  │ Manager  │  │ (SQLite) │  │ (native binary)   │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (context isolation)
┌──────────────────────▼──────────────────────────────┐
│              Electron Renderer Process               │
│  ┌────────────────┐    ┌──────────────────────────┐ │
│  │ Dictation      │    │ Control Panel            │ │
│  │ Overlay Window │    │ (Settings, History,      │ │
│  │ (App.jsx)      │    │  Onboarding)             │ │
│  └────────────────┘    └──────────────────────────┘ │
│              React 19 + Tailwind CSS v4              │
└─────────────────────────────────────────────────────┘
```

Both windows share the same React codebase. URL-based routing determines which view renders: the absence of `panel=true` renders the dictation overlay; its presence renders the control panel.

---

## Window System

### Dictation Overlay (Main Window)

| Property | Value |
|----------|-------|
| Size | 240 × 240 px |
| Frame | None (frameless, transparent) |
| Always on top | Yes |
| Resizable | No |
| Taskbar | Visible (not skipped) |
| Click-through | Yes, when not hovered |
| Position | Bottom-right corner of the work area |
| macOS type | `"panel"` (floats above all spaces) |

The window is transparent and frameless. Only the small circular button is visible. When the user is not hovering, mouse events pass through the window entirely (`setIgnoreMouseEvents(true, { forward: true })`), so it never interferes with applications underneath.

### Control Panel Window

| Property | Value |
|----------|-------|
| Size | 1200 × 800 px |
| Frame | None (custom title bar) |
| Resizable | Yes |
| macOS | Hidden-inset title bar with traffic light positioning |
| Close behavior | macOS: minimizes. Windows: hides to tray. |

---

## UI Design Language

### Typography
- **Font**: Noto Sans (Google Fonts), loaded in the HTML entry point.
- **Headings**: Negative letter-spacing for tightness.

### Color Palette

| Role | Value | Usage |
|------|-------|-------|
| Primary | Indigo (`#4f46e5`) | Buttons, active states, links, tab indicators |
| Recording | Blue (`blue-600`) | Mic button background, pulse rings |
| Processing | Purple (`purple-600`) | Mic button background, processing indicators |
| Surface | White / `stone-50` | Card backgrounds, page backgrounds |
| Input surface | Parchment (`#f9f6f1`) | Text inputs, textareas (warm beige) |
| Input border | `#ddd4c7` | Input borders |
| Text | `neutral-900` / white | Context-dependent |
| Dark mode | oklch-based variables | Available but secondary |

### Component System
- Built on **shadcn/ui** with **Radix UI** primitives (Dialog, Select, Tabs, etc.).
- Custom product components layer domain-specific logic on top.
- Cards have subtle shadows with hover lift (`translateY(-1px)`).
- Modals use backdrop blur with fade/zoom/slide entrance animations.

### Motion
- Micro-interactions: 150–250ms transitions with `cubic-bezier(0.4, 0, 0.2, 1)`.
- Recording pulse: CSS `animate-pulse` on border ring.
- Processing: Voice wave bars with staggered `animate-pulse` delays.
- Loading dots: Interval-based 350ms animation.
- Modal entrance: Radix `data-state` driven `animate-in` (fade + zoom + slide).

---

## Screens & User Flows

### Onboarding (6 Steps)

The onboarding flow appears on first launch, replacing the control panel until completed. It uses a distinctive **notebook-style** visual design: horizontal ruled lines across the background, a subtle red vertical margin line on the left, and a central card on top.

A **step progress bar** at the top shows numbered circles connected by lines. Completed steps display a green checkmark. The current step is highlighted.

#### Step 0 — Welcome

A welcoming introduction screen listing the app's key benefits in a blue info card. Sets the tone and explains what OpenWhispr does.

**Actions:** Next →

#### Step 1 — Processing Mode

The user chooses between **Local** (whisper.cpp, privacy-focused) and **Cloud** (API-based, higher accuracy) transcription. This is the most fundamental architectural choice and affects all subsequent steps.

The `ProcessingModeSelector` component presents two visual cards side by side, each with an icon, title, and bullet-point description of trade-offs.

**Actions:** ← Previous | Next →

#### Step 2 — Setup

Content varies by the mode chosen in Step 1:

**Local mode:**
- `LocalWhisperPicker`: A list of whisper.cpp models (tiny through large/turbo) with size indicators and download buttons. A progress bar appears during download.
- `LanguageSelector`: Dropdown with 58 languages or "Auto" detection.

**Cloud mode:**
- `ApiKeyInput`: Secure field for OpenAI API key with optional custom base URL fields (transcription and reasoning endpoints).
- `ModelCardList`: Visual cards for selecting a reasoning model from available OpenAI models.
- `LanguageSelector`: Same dropdown.

**Validation:** Cannot proceed until a local model is downloaded or a cloud API key is entered.

**Actions:** ← Previous | Next →

#### Step 3 — Permissions

Platform-aware permission checks:

- **Microphone**: `PermissionCard` with status indicator and a button to open OS microphone privacy settings.
- **MicPermissionWarning**: Appears if permission is denied, with platform-specific guidance.
- **Accessibility** (macOS only): Required for auto-paste via AppleScript.
- **PasteToolsInfo** (Linux): Guidance on installing `xdotool` or `wtype` for auto-paste.

Each permission shows its current status (granted/denied/unknown) with actionable buttons.

**Actions:** ← Previous | Next →

#### Step 4 — Hotkey & Test

This is the step where the dictation overlay first becomes visible (via `showDictationPanel`).

- `HotkeyInput`: Displays the current hotkey with a "Change" button that captures the next key press.
- `ActivationModeSelector`: Toggle switch between "Hold to talk" and "Toggle" modes, with a sliding white indicator.
- **Practice area**: A large textarea where the user can test dictation for the first time. The hotkey label is shown as a keyboard shortcut badge.

**Actions:** ← Previous | Next →

#### Step 5 — Agent Name

The user names their AI agent. A purple/blue help card explains how agent commands work with examples ("Hey Atlas, write an email to...").

The name is stored both in localStorage and the database for consistent reference.

**Validation:** Name must be non-empty.

**Actions:** ← Previous | Complete Setup ✓

---

### Dictation Overlay

The dictation overlay is the primary interface users interact with during daily use. It's a single floating circular button (40 × 40 px) anchored at the bottom-right of a transparent 240 × 240 px window.

#### States

```
┌──────────┐    hover     ┌──────────┐    click/     ┌───────────┐   auto    ┌────────────┐
│          │─────────────▶│          │───hotkey──▶   │           │────────▶  │            │
│   Idle   │              │  Hover   │               │ Recording │          │ Processing │
│          │◀─────────────│          │◀──click/──────│           │          │            │
└──────────┘   mouse out  └──────────┘   hotkey      └───────────┘          └────────────┘
                                                           │                      │
                                                           │ cancel (X)           │ done
                                                           ▼                      ▼
                                                     ┌──────────┐          ┌──────────┐
                                                     │ Cancelled│          │   Idle   │
                                                     └──────────┘          └──────────┘
```

| State | Background | Icon | Ring | Cursor |
|-------|-----------|------|------|--------|
| **Idle** | `black/50` (semi-transparent) | Static sound wave bars (white, 3 bars) | None | Pointer |
| **Hover** | `black/50` + gradient overlay | Slightly larger sound wave bars | None | Pointer |
| **Recording** | `blue-600` (solid blue) | Animated loading dots | Pulsing blue ring | Pointer |
| **Processing** | `purple-600` (solid purple) | Voice wave animation (4 pulsing bars) | Semi-transparent purple ring | Not-allowed |

#### Interactions

- **Hover**: Activates window interactivity (mouse events are captured). Shows tooltip with hotkey hint.
- **Mouse leave**: Deactivates window interactivity (click-through resumes).
- **Left click**: Toggles dictation (start/stop recording).
- **Right click**: Opens a context menu floating above the button with "Start/Stop listening" and "Hide this for now".
- **Drag**: The button is draggable. A 5px movement threshold differentiates clicks from drags.
- **Cancel button**: Appears on hover during recording — a small circle with an X that aborts the current recording.
- **Escape**: Closes the context menu, or hides the overlay entirely.

#### Tooltip

A custom tooltip appears above the button on hover. Dark gradient background (`neutral-800` → `neutral-700`), white text at 9.7px, with a small arrow pointing down.

#### Audio Pipeline

1. User starts recording → `MediaRecorder` API captures audio chunks.
2. User stops recording → Chunks assembled into a Blob → converted to ArrayBuffer.
3. ArrayBuffer sent via IPC to main process.
4. Main process writes a temporary WAV file.
5. whisper.cpp (or cloud API) processes the file.
6. Transcription result sent back to renderer.
7. Text copied to clipboard and auto-pasted into the focused application.
8. If the text addresses the AI agent, it's routed through the reasoning pipeline first.
9. Temporary audio file deleted.

---

### Control Panel

The control panel is the app's "home base" — a full-sized window for managing settings, viewing history, and accessing configuration.

#### Title Bar

A custom draggable title bar (`-webkit-app-region: drag`) with:
- **Update indicator**: Badge/button when an app update is available.
- **Support dropdown**: Links to help resources.
- **Settings button**: Gear icon that opens the Settings Modal.
- **Window controls** (Windows/Linux): Custom minimize, maximize/restore, close buttons replacing the native title bar.

#### Main Content — Transcription History

The primary view shows a "Recent Transcriptions" card:

- **Empty state**: A microphone icon, explanatory text, and a numbered "Quick Start" guide with the current hotkey displayed as a `<kbd>` badge.
- **Loading state**: A block emoji icon with "Loading..." text.
- **With items**: A scrollable list (`max-h-80`) of `TranscriptionItem` components, each showing:
  - Index number and timestamp.
  - Transcription text (original or processed).
  - Copy button (copies to clipboard).
  - Delete button (with confirmation dialog).
- **Clear all**: Button to wipe the entire transcription history (with confirmation).

#### Toasts

A toast notification system in the bottom-right corner. Three variants: default, destructive (red), and success (green). Cards with borders that animate in and auto-dismiss.

---

### Settings Modal

Opened from the control panel's gear icon. Uses a `SidebarModal` (Radix Dialog) with:

- **Overlay**: Dark backdrop with blur effect.
- **Layout**: Fixed-width sidebar (`w-72`, ~288px) on the left with navigation items; scrollable content area on the right.
- **Entrance animation**: Combined fade + zoom + slide via Radix `data-state` classes.

#### Sidebar Sections

1. **General**
2. **Transcription Mode**
3. **AI Models**
4. **Agent Configuration**
5. **AI Prompts**

#### General Settings

- **Process status cards**: Color-coded indicators showing whether Whisper server, Llama server, and MLX server are running.
- **Updates**: Current version display, check-for-updates button, Markdown-rendered release notes.
- **Hotkey configuration**: `HotkeyInput` component to view/change the global shortcut.
- **Activation mode**: Toggle between hold-to-talk and toggle modes.
- **Permissions**: Status and links to OS settings for microphone, accessibility, etc.
- **Microphone settings**: Device selection, preference for built-in mic.
- **About**: Three informational cards about the app.
- **Danger zone**: Destructive actions — cleanup transcription database, open/delete whisper model folder.

#### Transcription Mode

`TranscriptionModelPicker` component with:
- Toggle between **Local** and **Cloud** processing.
- **Cloud sub-tabs**: Provider tabs (OpenAI, Groq; Nvidia marked "Coming Soon") with API key inputs and model selection.
- **Local**: Embedded `LocalWhisperPicker` for downloading/managing whisper.cpp models.

The `LocalWhisperPicker` uses a context-aware color scheme: **blue** when shown during onboarding, **purple** when inside settings.

#### AI Models

`ReasoningModelSelector` component:
- Cloud provider selection with API key management for OpenAI, Anthropic, and Gemini.
- Custom base URL support for self-hosted endpoints.
- Local model management: GGUF download and configuration for llama.cpp, MLX models.
- Model card grid showing available models with descriptions.

#### Agent Configuration

Simple interface to view and change the agent name, with example usage patterns showing how to invoke the agent in speech.

#### AI Prompts (Prompt Studio)

See [Prompt Studio](#prompt-studio) below.

---

### Prompt Studio

A dedicated section within settings for managing the AI prompts that control how the reasoning models process transcriptions. Three sub-tabs, indicated by an indigo bottom border on the active tab:

#### Current Prompts (read-only)

Displays the active system prompts used for agent-addressed and regular transcription processing. The `{{agentName}}` template variable is resolved to show the actual configured name. A copy button allows quick clipboard access.

#### Customize

Two large textareas for editing the agent prompt and the regular processing prompt. Changes are saved to localStorage under the `customPrompts` key. A reset button restores the default prompts.

#### Test

An interactive testing environment:
- **Model selector**: Dropdown populated from `REASONING_PROVIDERS`, showing all available cloud and local models.
- **Test input**: A large textarea pre-filled with a representative sample text.
- **Mode badge**: Shows "Agent Mode" or "Regular Mode" based on whether the test text addresses the agent.
- **Run button**: Sends the text through the actual reasoning pipeline (cloud `ReasoningService` or local `processLocalReasoning` via IPC).
- **Results area**: Shows the processed output with execution time. Errors are styled distinctly.

---

### System Tray

The system tray provides persistent access to the app when all windows are closed or hidden.

**Availability:** macOS and Windows only (not created on Linux).

**Icon:**
- macOS: Template image (`iconTemplate@3x.png`) that adapts to light/dark menu bar.
- Windows: `icon.ico` or `icon.png` with fallback generation.

**Menu items:**
1. **Show/Hide Dictation Panel** — Toggles the overlay visibility.
2. **Open Control Panel** — Brings up the settings window.
3. **Select Microphone** — Submenu with:
   - "Prefer Built-in Microphone" option.
   - "System Default" option.
   - Radio buttons for each detected audio input device.
4. **Quit** — Exits the application.

**Behavior:**
- macOS: Click opens the menu.
- Windows: Left-click opens the control panel; right-click opens the menu.
- Microphone selection syncs bidirectionally with localStorage and renderer windows.

---

## Interaction Model

### Global Hotkey Flow

The global hotkey is the primary way users interact with OpenWhispr. It works regardless of which application is focused.

```
Any Application          OpenWhispr                  Active App
     │                       │                           │
     │──── Press Hotkey ────▶│                           │
     │                       │── Start recording         │
     │                       │   (mic captures audio)    │
     │──── Press Hotkey ────▶│                           │
     │                       │── Stop recording          │
     │                       │── Process audio           │
     │                       │   (whisper.cpp or API)    │
     │                       │── Copy to clipboard       │
     │                       │── Auto-paste ────────────▶│
     │                       │                           │── Text appears
```

### Activation Modes

| Mode | Start | Stop | Best for |
|------|-------|------|----------|
| **Toggle** | Press hotkey | Press hotkey again | Longer dictations, hands-free |
| **Hold** | Press and hold hotkey | Release hotkey | Quick phrases, walkie-talkie style |

### Mouse Interaction Model

The dictation overlay has a sophisticated mouse interaction system:

1. **Click-through by default**: When not hovered, the window is invisible to mouse events.
2. **Hover activates**: Moving the mouse over the button area enables interaction.
3. **Leave deactivates**: Moving away restores click-through (unless a context menu is open).
4. **Drag vs. click detection**: A 5px movement threshold distinguishes intentional drags from clicks.

---

## AI Agent System

### How It Works

1. User records speech: "Hey Atlas, write a professional reply to this email declining the meeting."
2. whisper.cpp transcribes the audio to text.
3. `ReasoningService` detects the agent name pattern ("Hey Atlas").
4. The transcribed text is sent to the configured AI model with the agent system prompt.
5. The AI processes the command and returns the result.
6. The agent name reference is stripped from the output.
7. The processed text is pasted into the active application.

### Supported Providers

| Provider | Models | Integration |
|----------|--------|-------------|
| **OpenAI** | GPT-5.2, GPT-5 Mini, GPT-5 Nano, GPT-4.1 series | Responses API (direct) |
| **Anthropic** | Claude Opus 4.5, Sonnet 4.5, Haiku 4.5 | Via IPC bridge (avoids CORS) |
| **Google Gemini** | Gemini 2.5 Pro/Flash/Flash Lite, 2.0 Flash | Direct API |
| **Local** | Qwen, Llama, Mistral, GPT-OSS (GGUF format) | llama.cpp / MLX |

All model definitions are centralized in `src/models/modelRegistryData.json` as a single source of truth.

---

## Accessibility & Permissions

### Required Permissions

| Permission | Platform | Purpose | How to Grant |
|-----------|----------|---------|--------------|
| **Microphone** | All | Audio capture | OS prompt on first use; settings link in app |
| **Accessibility** | macOS | Auto-paste via AppleScript | System Preferences link in app |

### OS Settings Integration

The app can open platform-specific system settings panels directly:

| Setting | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Microphone privacy | `x-apple.systempreferences:...Privacy_Microphone` | `ms-settings:privacy-microphone` | Manual |
| Sound input | `x-apple.systempreferences:...sound?input` | `ms-settings:sound` | `pavucontrol` (manual) |
| Accessibility | `x-apple.systempreferences:...Privacy_Accessibility` | N/A | N/A |

---

## Platform-Specific Behavior

### macOS
- Frameless panel window floats above all spaces.
- Traffic lights (close/minimize/zoom) positioned via `titleBarStyle: "hiddenInset"`.
- Globe key as default hotkey.
- AppleScript for reliable clipboard paste.
- System tray uses template images (auto light/dark).
- Closing the control panel minimizes instead of quitting.
- Notarization required for distribution.

### Windows
- Custom window controls (minimize, maximize/restore, close) in the title bar.
- Backtick (`` ` ``) as default hotkey.
- Closing the control panel hides to system tray.
- NSIS installer for distribution.
- No accessibility permission needed for paste.

### Linux
- Custom window controls in the title bar.
- Backtick (`` ` ``) as default hotkey.
- No system tray (not created on Linux).
- No standardized URL scheme for system settings.
- Privacy settings button hidden in UI.
- AppImage for distribution.
- May require `xdotool` (X11) or `wtype` (Wayland) for auto-paste.
