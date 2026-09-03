# OpenWhispr

An open source desktop dictation application that converts speech to text using OpenAI Whisper. Features both local and cloud processing options for maximum flexibility and privacy.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=HeroTools/open-whispr&type=date&legend=top-left)](https://www.star-history.com/#HeroTools/open-whispr&type=date&legend=top-left)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. This means you can freely use, modify, and distribute this software for personal or commercial purposes.

## Features

- 🎤 **Global Hotkey**: Customizable hotkey to start/stop dictation from anywhere (macOS default: Globe / Fn)
- 🤖 **Multi-Provider AI Processing**: Choose between OpenAI, Anthropic Claude, Google Gemini, or local models
- 🎯 **Agent Naming**: Personalize your AI assistant with a custom name for natural interactions
- 🧠 **Multi-Provider AI**:
  - **OpenAI**: GPT-5, GPT-4.1, o-series reasoning models
  - **Anthropic**: Claude Opus 4.5, Claude Sonnet 4.5
  - **Google**: Gemini 2.5 Pro/Flash/Flash-Lite
  - **Groq**: Ultra-fast inference with Llama and Mixtral models
  - **Local**: Qwen, LLaMA, Mistral models via llama.cpp
- 🔒 **Privacy-First**: Local processing keeps your voice data completely private
- 🎨 **Modern UI**: Built with React 19, TypeScript, and Tailwind CSS v4
- 🚀 **Fast**: Optimized with Vite and modern tooling
- 📱 **Control Panel**: Manage settings, view history, and configure API keys
- 🗄️ **Transcription History**: SQLite database stores all your transcriptions locally
- 🔧 **Model Management**: Download and manage local Whisper models (tiny, base, small, medium, large, turbo)
- 🧹 **Model Cleanup**: One-click removal of cached Whisper models with uninstall hooks to keep disks tidy
- 🍎 **macOS**: Ships as an unsigned DMG (drag to Applications). Gatekeeper will warn on first open.
- ⚡ **Automatic Pasting**: Transcribed text automatically pastes at your cursor location
- 🖱️ **Draggable Interface**: Move the dictation panel anywhere on your screen
- 🔄 **OpenAI Responses API**: Using the latest Responses API for improved performance
- 🌐 **Globe Key Toggle (macOS)**: Optional Fn/Globe key listener for a hardware-level dictation trigger
- ⌨️ **Compound Hotkeys**: Support for multi-key combinations like `Cmd+Shift+K`

## Prerequisites

- **Node.js 18+** and npm (Download from [nodejs.org](https://nodejs.org/))
- **macOS 10.15+** (Apple Silicon or Intel). The installable product is the unsigned DMG from [Releases](https://github.com/miranda-rodrigo/transcriptor/releases).

## Quick Start

### Install from the DMG (recommended)

This fork ships an **unsigned** macOS DMG. There is no Apple Developer signature, so Gatekeeper will warn on first launch. That is expected.

1. Download **`OpenWhispr-<version>-arm64.dmg`** from [Releases](https://github.com/miranda-rodrigo/transcriptor/releases) (Apple Silicon: M1/M2/M3/M4). Intel Macs need the `x64` DMG if one is published.
2. Open the DMG and drag **OpenWhispr** onto **Applications** (or `~/Applications` if you do not have admin).
3. Eject the disk image. Do **not** run the app from the mounted DMG.
4. First open: Finder → Applications → **right-click OpenWhispr → Open**. Confirm the dialog. After that, a normal double-click works.
5. macOS will still ask for **Microphone** and **Accessibility** during onboarding. Approve both or dictation will record but will not paste.

The `.zip` next to the DMG is only for in-app auto-update (`electron-updater`).

### First-run onboarding

On first launch the Control Panel is replaced by a 6-step wizard. You cannot skip it. Progress is saved, so quitting mid-setup resumes on the same step.

| Step             | What you do                                                                                                                                                                                                         | You cannot continue until                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Welcome       | Read what the app does.                                                                                                                                                                                             | —                                                                                     |
| 2. Privacy       | Choose **Local** (whisper.cpp on device) or **Cloud** (OpenAI API).                                                                                                                                                 | You pick one. Default in the UI is Cloud.                                             |
| 3. Setup         | **Local:** pick a Whisper model and wait for the download (Base is the usual choice). **Cloud:** paste an OpenAI API key. Optional custom base URLs if you use a compatible proxy. Language selector on both paths. | Local: a model is fully downloaded. Cloud: a non-empty API key.                       |
| 4. Permissions   | Grant **Microphone** and **Accessibility**. Buttons open System Settings if needed.                                                                                                                                 | Both permissions show as granted. Accessibility is required to paste into other apps. |
| 5. Hotkey & Test | Confirm or change the hotkey (macOS default is the **Globe / Fn** key; fallback is F8/F9 if registration fails). Choose **Hold to talk** or **Tap to toggle**. Practice in the textarea.                            | A hotkey is registered.                                                               |
| 6. Agent name    | Name the AI helper used for “Hey \<name\>, …” commands (default `Agent`). Change later in Settings.                                                                                                                 | Name is not empty.                                                                    |

**What onboarding does not set up.** Parakeet (NVIDIA ASR) and Groq (or any other reasoning provider) are **not** in this wizard. After **Complete Setup**, open the Control Panel from the menu bar icon → Settings to switch the transcription engine and the cleanup LLM.

The floating dictation pill stays hidden until you reach step 5 (Hotkey & Test). After setup it lives in the menu bar; the Dock icon stays hidden.

### Run from source

```bash
git clone https://github.com/miranda-rodrigo/transcriptor.git
cd transcriptor
npm install
npm run dev
```

Cloud API keys can go in `.env` (`cp env.example .env`) or in the Control Panel. Local whisper.cpp binaries: `npm run download:whisper-cpp`.

### Build a local copy

```bash
# Unsigned .app (no certificates)
npm run pack
# Output: dist/mac-arm64/OpenWhispr.app

# Unsigned DMG + zip
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac -- --arm64 --publish never
```

Signed/notarized builds (`npm run build:mac` with Apple secrets) are optional and not what this fork currently publishes.

## Usage

### Basic Dictation

1. **Start the app** - A small draggable panel appears on your screen
2. **Press your hotkey** (macOS default: Globe / Fn) - Start dictating (panel shows recording animation)
3. **Press your hotkey again** - Stop dictation and begin transcription (panel shows processing animation)
4. **Text appears** - Transcribed text is automatically pasted at your cursor location
5. **Drag the panel** - Click and drag to move the dictation panel anywhere on your screen

### Control Panel

- **Access**: Right-click the tray icon (macOS) or through the system menu
- **Configure**: Choose between local and cloud processing
- **History**: View, copy, and delete past transcriptions
- **Models**: Download and manage local Whisper models
- **Storage Cleanup**: Remove downloaded Whisper models from cache to reclaim space
- **Settings**: Configure API keys, customize hotkeys, and manage permissions

### Uninstall & Cache Cleanup

- **In-App**: Use _Settings → General → Local Model Storage → Remove Downloaded Models_ to clear `~/.cache/openwhispr/whisper-models` (or `%USERPROFILE%\.cache\openwhispr\whisper-models` on Windows).
- **Windows Uninstall**: The NSIS uninstaller automatically deletes the same cache directory.
- **Linux Packages**: `deb`/`rpm` post-uninstall scripts also remove cached models.
- **macOS**: If you uninstall manually, remove `~/Library/Caches` or `~/.cache/openwhispr/whisper-models` if desired.

### Agent Naming & AI Processing

Once you've named your agent during setup, you can interact with it using multiple AI providers:

**🎯 Agent Commands** (for AI assistance):

- "Hey [AgentName], make this more professional"
- "Hey [AgentName], format this as a list"
- "Hey [AgentName], write a thank you email"
- "Hey [AgentName], convert this to bullet points"

**🤖 AI Provider Options**:

- **OpenAI**: GPT-5, GPT-4.1, o-series reasoning models
- **Anthropic**: Claude Opus 4.5, Sonnet 4.5, Haiku 4.5
- **Google**: Gemini 2.5 Pro/Flash/Flash-Lite
- **Groq**: Ultra-fast Llama and Mixtral inference
- **Local**: Qwen, LLaMA, Mistral via llama.cpp

**📝 Regular Dictation** (for normal text):

- "This is just normal text I want transcribed"
- "Meeting notes: John mentioned the quarterly report"
- "Dear Sarah, thank you for your help"

The AI automatically detects when you're giving it commands versus dictating regular text, and removes agent name references from the final output.

### Processing Options

- **Local Processing**:
  - Install Whisper automatically through the Control Panel
  - Download models: tiny (fastest), base (recommended), small, medium, large (best quality)
  - Complete privacy - audio never leaves your device
- **Cloud Processing**:
  - Requires OpenAI API key
  - Faster processing
  - Uses OpenAI's Whisper API

## Project Structure

```
open-whispr/
├── main.js              # Electron main process & IPC handlers
├── preload.js           # Electron preload script & API bridge
├── setup.js             # First-time setup script
├── package.json         # Dependencies and scripts
├── env.example          # Environment variables template
├── CHANGELOG.md         # Project changelog
├── src/
│   ├── App.jsx          # Main dictation interface
│   ├── main.jsx         # React entry point
│   ├── index.html       # Vite HTML template
│   ├── index.css        # Tailwind CSS v4 configuration
│   ├── vite.config.js   # Vite configuration
│   ├── components/
│   │   ├── ControlPanel.tsx     # Settings and history UI
│   │   ├── OnboardingFlow.tsx   # First-time setup wizard
│   │   ├── SettingsPage.tsx     # Settings interface
│   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── LoadingDots.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── toggle.tsx
│   │   │   └── tooltip.tsx
│   │   └── lib/
│   │       └── utils.ts         # Utility functions
│   ├── services/
│   │   └── ReasoningService.ts  # Multi-provider AI processing (OpenAI/Anthropic/Gemini)
│   ├── utils/
│   │   └── agentName.ts         # Agent name management utility
│   └── components.json          # shadcn/ui configuration
└── assets/                      # App icons and resources
```

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Build Tool**: Vite with optimized Tailwind plugin
- **Desktop**: Electron 36 with context isolation
- **UI Components**: shadcn/ui with Radix primitives
- **Database**: better-sqlite3 for local transcription storage
- **Speech-to-Text**: OpenAI Whisper (powered by whisper.cpp for local, OpenAI API for cloud)
- **Icons**: Lucide React for consistent iconography

## Development

### Scripts

- `npm run dev` - Start development with hot reload
- `npm run start` - Start production build
- `npm run setup` - First-time setup (creates .env file)
- `npm run build:renderer` - Build the React app only
- `npm run download:whisper-cpp` - Download whisper.cpp for this Mac
- `npm run build` - Full signed/notarized macOS build
- `npm run build:mac` - Signed DMG + zip (auto-update)
- `npm run pack` - Unsigned local `.app` (no certificates)
- `npm run dist` - Build and package with signing
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Architecture

The app consists of two main windows:

1. **Main Window**: Minimal overlay for dictation controls
2. **Control Panel**: Full settings and history interface

Both use the same React codebase but render different components based on URL parameters.

### Key Components

- **main.js**: Electron main process, IPC handlers, database operations
- **preload.js**: Secure bridge between main and renderer processes
- **App.jsx**: Main dictation interface with recording controls
- **ControlPanel.tsx**: Settings, history, and model management
- **src/helpers/whisper.js**: whisper.cpp integration for local processing
- **better-sqlite3**: Local database for transcription history

### Tailwind CSS v4 Setup

This project uses the latest Tailwind CSS v4 with:

- CSS-first configuration using `@theme` directive
- Vite plugin for optimal performance
- Custom design tokens for consistent theming
- Dark mode support with `@variant`

## Building

The build process creates a single executable for your platform:

```bash
# Development build
npm run pack

# Production DMG
npm run build:mac
```

Note: `build`/`pack`/`dist` download the macOS whisper.cpp binary automatically.

## Configuration

### Environment Variables

Create a `.env` file in the root directory (or use `npm run setup`):

```env
# OpenAI API Configuration (optional - only needed for cloud processing)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Customize the Whisper model
WHISPER_MODEL=whisper-1

# Optional: Set language for better transcription accuracy
LANGUAGE=

# Optional: Anthropic API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Google Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Debug mode
DEBUG=false
```

### Local Whisper Setup

For local processing, OpenWhispr uses OpenAI's Whisper model via whisper.cpp - a high-performance C++ implementation:

1. **Bundled Binary**: whisper.cpp is bundled with the app for all platforms
2. **GGML Models**: Downloads optimized GGML models on first use to `~/.cache/openwhispr/whisper-models/`
3. **No Dependencies**: No Python or other runtime required

**System Fallback**: If the bundled binary fails, install via package manager:

- macOS: `brew install whisper-cpp`
- Linux: Build from source at https://github.com/ggml-org/whisper.cpp

**From Source**: When running locally (not a packaged build), download the binary with `npm run download:whisper-cpp` so `resources/bin/` has your platform executable.

**Requirements**:

- Sufficient disk space for models (75MB - 3GB depending on model)

**Upgrading from Python-based version**: If you previously used the Python-based Whisper, you'll need to re-download models in GGML format. You can safely delete the old Python environment (`~/.openwhispr/python/`) and PyTorch models (`~/.cache/whisper/`) to reclaim disk space.

### Customization

- **Hotkey**: Change in the Control Panel (default: backtick `) - fully customizable
- **Panel Position**: Drag the dictation panel to any location on your screen`
- **Processing Method**: Choose local or cloud in Control Panel
- **Whisper Model**: Select quality vs speed in Control Panel
- **UI Theme**: Edit CSS variables in `src/index.css`
- **Window Size**: Adjust dimensions in `main.js`
- **Database**: Transcriptions stored in user data directory

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Run `npm run lint` before committing
- Follow the existing code style
- Update documentation as needed
- Test on your target platform before submitting

## Security

OpenWhispr is designed with privacy and security in mind:

- **Local Processing Option**: Keep your voice data completely private
- **No Analytics**: We don't collect any usage data or telemetry
- **Open Source**: All code is available for review
- **Secure Storage**: API keys are stored securely in your system's keychain/credential manager
- **Minimal Permissions**: Only requests necessary permissions (microphone, accessibility)

## Troubleshooting

### Common Issues

1. **Microphone permissions**: Grant permissions in System Preferences/Settings
2. **Accessibility permissions (macOS)**: Required for automatic text pasting
   - Go to System Settings → Privacy & Security → Accessibility
   - Add OpenWhispr and enable the checkbox
   - Use "Fix Permission Issues" in Control Panel if needed
3. **API key errors** (cloud processing only): Ensure your OpenAI API key is valid and has credits
   - Set key through Control Panel or .env file
   - Check logs for "OpenAI API Key present: Yes/No"
4. **Local Whisper issues**:
   - whisper.cpp is bundled with the app
   - If bundled binary fails, install via `brew install whisper-cpp` (macOS)
   - Check available disk space for models
5. **Global hotkey conflicts**: Change the hotkey in the Control Panel - any key can be used
6. **Text not pasting**: Check accessibility permissions and try manual paste with Cmd+V
7. **Panel position**: If the panel appears off-screen, restart the app to reset position

### Getting Help

- Check the [Issues](https://github.com/your-repo/open-whispr/issues) page
- Review the console logs for debugging information
- For local processing: Ensure whisper.cpp is accessible and models are downloaded
- For cloud processing: Verify your OpenAI API key and billing status
- Check the Control Panel for system status and diagnostics

### Performance Tips

- **Local Processing**: Use "base" model for best balance of speed and accuracy
- **Cloud Processing**: Generally faster but requires internet connection
- **Model Selection**: tiny (fastest) → base (recommended) → small → medium → large (best quality)
- **Permissions**: Ensure all required permissions are granted for smooth operation

## FAQ

**Q: Is OpenWhispr really free?**
A: Yes! OpenWhispr is open source and free to use. You only pay for OpenAI API usage if you choose cloud processing.

**Q: Which processing method should I use?**
A: Use local processing for privacy and offline use. Use cloud processing for speed and convenience.

**Q: Can I use this commercially?**
A: Yes! The MIT license allows commercial use.

**Q: How do I change the hotkey?**
A: Open the Control Panel (right-click tray icon) and go to Settings. You can set any key as your hotkey.

**Q: Is my data secure?**
A: With local processing, your audio never leaves your device. With cloud processing, audio is sent to OpenAI's servers (see their privacy policy).

**Q: What languages are supported?**
A: OpenWhispr supports 58 languages including English, Spanish, French, German, Chinese, Japanese, and more. Set your preferred language in the .env file or use auto-detect.

## Project Status

OpenWhispr is actively maintained and ready for production use. Current version: 1.2.12

- ✅ Core functionality complete
- ✅ Cross-platform support (macOS, Windows, Linux)
- ✅ Local and cloud processing
- ✅ Multi-provider AI (OpenAI, Anthropic, Gemini, Groq, Local)
- ✅ Compound hotkey support

## Acknowledgments

- **[OpenAI Whisper](https://github.com/openai/whisper)** - The speech recognition model that powers both local and cloud transcription
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** - High-performance C++ implementation of Whisper for local processing
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop application framework
- **[React](https://react.dev/)** - UI component library
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautiful UI components built on Radix primitives
- **[llama.cpp](https://github.com/ggerganov/llama.cpp)** - Local LLM inference for AI-powered text processing
