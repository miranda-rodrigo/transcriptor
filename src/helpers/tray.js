const { Tray, Menu, nativeImage, app } = require("electron");
const path = require("path");
const fs = require("fs");

// Frame interval (ms) for animated tray states. Single-frame states are static.
const STATE_FRAME_INTERVAL_MS = {
  recording: 120,
  processing: 130,
};

const STATE_TOOLTIPS = {
  recording: "Recording…",
  processing: "Processing…",
  idle: "OpenWhispr - Voice Dictation",
};

class TrayManager {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
    this.controlPanelWindow = null;
    this.windowManager = null;
    this.attachedControlPanels = new WeakSet();
    this.audioDevices = [];
    this.micSettings = {
      preferBuiltInMic: true,
      selectedMicDeviceId: "",
    };
    this.baseIcon = null;
    this.trayAssetsDir = null;
    // { idle: NativeImage[], recording: NativeImage[], processing: NativeImage[] }
    this.stateFrames = null;
    this.recordingState = "idle";
    this.appliedState = null;
    this.animationTimer = null;
  }

  setWindows(mainWindow, controlPanelWindow) {
    this.mainWindow = mainWindow;
    this.controlPanelWindow = controlPanelWindow;

    if (this.mainWindow) {
      this.mainWindow.on("show", () => this.updateTrayMenu?.());
      this.mainWindow.on("hide", () => this.updateTrayMenu?.());
      this.mainWindow.on("minimize", () => this.updateTrayMenu?.());
      this.mainWindow.on("restore", () => this.updateTrayMenu?.());
    }

    if (this.controlPanelWindow) {
      this.attachControlPanelListeners(this.controlPanelWindow);
    }

    this.updateTrayMenu?.();
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  setCreateControlPanelCallback(callback) {
    this.createControlPanelCallback = callback;
  }

  attachControlPanelListeners(window) {
    if (!window || this.attachedControlPanels.has(window)) {
      return;
    }

    this.attachedControlPanels.add(window);

    window.on("show", () => {
      if (process.platform === "win32") {
        window.setSkipTaskbar(false);
      }
      this.updateTrayMenu?.();
    });

    window.on("hide", () => {
      this.updateTrayMenu?.();
    });

    window.on("destroyed", () => {
      this.controlPanelWindow = null;
      this.updateTrayMenu?.();
    });
  }

  async showControlPanelFromTray() {
    try {
      if (this.windowManager) {
        this.controlPanelWindow = this.windowManager.controlPanelWindow || this.controlPanelWindow;
      }
      this.attachControlPanelListeners(this.controlPanelWindow);

      if (this.controlPanelWindow && !this.controlPanelWindow.isDestroyed()) {
        if (process.platform === "win32") {
          this.controlPanelWindow.setSkipTaskbar(false);
        }
        if (!this.controlPanelWindow.isVisible()) {
          this.controlPanelWindow.show();
        }
        this.controlPanelWindow.focus();
        return;
      }

      if (this.createControlPanelCallback) {
        await this.createControlPanelCallback();
        if (this.windowManager) {
          this.controlPanelWindow =
            this.windowManager.controlPanelWindow || this.controlPanelWindow;
        }
        this.attachControlPanelListeners(this.controlPanelWindow);

        if (this.controlPanelWindow && !this.controlPanelWindow.isDestroyed()) {
          if (process.platform === "win32") {
            this.controlPanelWindow.setSkipTaskbar(false);
          }
          this.controlPanelWindow.show();
          this.controlPanelWindow.focus();
        }
        return;
      }

      console.error("No control panel callback available");
    } catch (error) {
      console.error("Failed to open control panel:", error);
    }
  }

  async createTray() {
    if (process.platform !== "darwin" && process.platform !== "win32") return;

    try {
      const trayIcon = await this.loadTrayIcon();
      if (!trayIcon || trayIcon.isEmpty()) {
        console.error("Failed to load tray icon");
        return;
      }

      this.baseIcon = trayIcon;
      this.stateFrames = this.loadStateFrames(trayIcon);
      this.tray = new Tray(this.getFramesForState(this.recordingState)[0]);

      if (process.platform === "darwin") {
        this.tray.setIgnoreDoubleClickEvents(true);
      }

      this.updateTrayMenu();
      this.setupTrayEventHandlers();
    } catch (error) {
      console.error("Error creating tray icon:", error.message);
    }
  }

  getAssetCandidateDirs() {
    if (process.env.NODE_ENV === "development") {
      return [path.join(__dirname, "..", "assets")];
    }
    return [
      path.join(process.resourcesPath, "src", "assets"),
      path.join(process.resourcesPath, "assets"),
      path.join(process.resourcesPath, "app.asar.unpacked", "src", "assets"),
      path.join(__dirname, "..", "..", "src", "assets"),
      path.join(app.getAppPath(), "src", "assets"),
    ];
  }

  resolveAssetPath(...segments) {
    for (const dir of this.getAssetCandidateDirs()) {
      const candidate = path.join(dir, ...segments);
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch (error) {
        console.error("Error checking tray asset path:", candidate, error.message);
      }
    }
    return null;
  }

  async loadTrayIcon() {
    if (process.platform === "darwin") {
      // Template image (alpha only): macOS tints it for light/dark menu bars and highlight.
      // createFromPath picks up the @2x/@3x variants next to the 1x file automatically.
      const idlePath = this.resolveAssetPath("tray", "idleTemplate.png");
      if (idlePath) {
        const icon = nativeImage.createFromPath(idlePath);
        if (icon && !icon.isEmpty()) {
          icon.setTemplateImage(true);
          this.trayAssetsDir = path.dirname(idlePath);
          console.log("Using tray icon:", idlePath);
          return icon;
        }
      }
    } else {
      const fileNames = process.platform === "win32" ? ["icon.ico", "icon.png"] : ["icon.png"];
      for (const fileName of fileNames) {
        const iconPath = this.resolveAssetPath(fileName);
        if (!iconPath) continue;
        const icon = nativeImage.createFromPath(iconPath);
        if (icon && !icon.isEmpty()) {
          console.log("Using tray icon:", iconPath);
          return icon;
        }
      }
    }

    console.error("Could not find tray icon in any expected location");
    return this.createFallbackIcon();
  }

  loadTemplateFrames(prefix) {
    if (!this.trayAssetsDir) return [];

    const pattern = new RegExp(`^${prefix}-(\\d+)Template\\.png$`);
    try {
      return fs
        .readdirSync(this.trayAssetsDir)
        .map((fileName) => {
          const match = fileName.match(pattern);
          return match ? { index: Number(match[1]), fileName } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.index - b.index)
        .map(({ fileName }) => {
          const image = nativeImage.createFromPath(path.join(this.trayAssetsDir, fileName));
          image.setTemplateImage(true);
          return image;
        })
        .filter((image) => !image.isEmpty());
    } catch (error) {
      console.error(`Failed to load tray "${prefix}" frames:`, error.message);
      return [];
    }
  }

  loadStateFrames(baseIcon) {
    if (process.platform === "darwin") {
      const recording = this.loadTemplateFrames("recording");
      const processing = this.loadTemplateFrames("processing");
      return {
        idle: [baseIcon],
        recording: recording.length > 0 ? recording : [baseIcon],
        processing: processing.length > 0 ? processing : [baseIcon],
      };
    }
    return this.buildStateIcons(baseIcon);
  }

  createFallbackIcon() {
    try {
      // Create a simple 16x16 PNG icon programmatically
      const { createCanvas } = require("canvas");
      const canvas = createCanvas(16, 16);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(8, 8, 6, 0, 2 * Math.PI);
      ctx.fill();

      const buffer = canvas.toBuffer("image/png");
      const fallbackIcon = nativeImage.createFromBuffer(buffer);
      console.log("✅ Created fallback tray icon");
      return fallbackIcon;
    } catch (fallbackError) {
      console.warn("Canvas not available, creating minimal fallback icon");
      // Create a minimal 16x16 black square PNG as fallback
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
        0x91, 0x68, 0x36, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x28, 0x53, 0x63, 0x08,
        0x05, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const fallbackIcon = nativeImage.createFromBuffer(pngData);
      console.log("✅ Created minimal fallback tray icon");
      return fallbackIcon;
    }
  }

  setAudioDevices(devices = []) {
    this.audioDevices = Array.isArray(devices) ? devices : [];
    this.updateTrayMenu();
  }

  // Windows fallback: derive tinted/dimmed variants from the colored base icon.
  buildStateIcons(baseIcon) {
    const fallback = { idle: [baseIcon], recording: [baseIcon], processing: [baseIcon] };
    if (!baseIcon || baseIcon.isEmpty()) {
      return fallback;
    }

    try {
      const size = baseIcon.getSize();
      const bitmap = baseIcon.toBitmap();
      if (!bitmap || bitmap.length < 4 || !size.width || !size.height) {
        return fallback;
      }

      const expectedBytes = size.width * size.height * 4;
      const scaleFromBuffer = Math.sqrt(bitmap.length / expectedBytes);
      const bitmapWidth = Math.round(size.width * (scaleFromBuffer >= 1.5 ? scaleFromBuffer : 1));
      const bitmapHeight = Math.round(size.height * (scaleFromBuffer >= 1.5 ? scaleFromBuffer : 1));
      const scaleFactor =
        typeof baseIcon.getScaleFactor === "function"
          ? baseIcon.getScaleFactor()
          : scaleFromBuffer >= 1.5
            ? scaleFromBuffer
            : 1;

      const recordingBuffer = Buffer.from(bitmap);
      const processingBuffer = Buffer.from(bitmap);

      for (let i = 0; i < recordingBuffer.length; i += 4) {
        const alpha = recordingBuffer[i + 3];
        if (alpha > 0) {
          recordingBuffer[i] = 0x30;
          recordingBuffer[i + 1] = 0x3b;
          recordingBuffer[i + 2] = 0xff;
        }
        processingBuffer[i + 3] = Math.round(processingBuffer[i + 3] * 0.5);
      }

      const recording = nativeImage.createFromBitmap(recordingBuffer, {
        width: bitmapWidth,
        height: bitmapHeight,
        scaleFactor,
      });
      recording.setTemplateImage(false);

      const processing = nativeImage.createFromBitmap(processingBuffer, {
        width: bitmapWidth,
        height: bitmapHeight,
        scaleFactor,
      });
      processing.setTemplateImage(true);

      return { idle: [baseIcon], recording: [recording], processing: [processing] };
    } catch (error) {
      console.error("Failed to build tray state icons:", error.message);
      return fallback;
    }
  }

  getFramesForState(state) {
    const frames = (this.stateFrames?.[state] || []).filter((image) => image && !image.isEmpty());
    return frames.length > 0 ? frames : [this.baseIcon];
  }

  setTrayImage(image) {
    if (!this.tray || this.tray.isDestroyed()) return;
    if (image && !image.isEmpty()) {
      this.tray.setImage(image);
    }
  }

  stopAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  applyRecordingState(state) {
    this.stopAnimation();

    const frames = this.getFramesForState(state);
    this.setTrayImage(frames[0]);

    if (frames.length > 1) {
      let index = 0;
      this.animationTimer = setInterval(() => {
        if (!this.tray || this.tray.isDestroyed()) {
          this.stopAnimation();
          return;
        }
        index = (index + 1) % frames.length;
        this.setTrayImage(frames[index]);
      }, STATE_FRAME_INTERVAL_MS[state] || 120);
    }

    this.tray.setToolTip(STATE_TOOLTIPS[state]);
    this.appliedState = state;
  }

  setRecordingState(state = "idle") {
    const nextState = state === "recording" || state === "processing" ? state : "idle";
    this.recordingState = nextState;

    if (!this.tray || this.tray.isDestroyed()) {
      return { success: true };
    }

    // Idempotent: menu rebuilds re-apply the current state without restarting the animation.
    if (this.appliedState !== nextState) {
      this.applyRecordingState(nextState);
    }
    return { success: true };
  }

  setMicSettings(settings = {}) {
    this.micSettings = {
      preferBuiltInMic: settings.preferBuiltInMic !== false,
      selectedMicDeviceId: settings.selectedMicDeviceId || "",
    };
    this.updateTrayMenu();
  }

  async applyMicSettings(settings = {}) {
    this.setMicSettings(settings);

    const payload = {
      preferBuiltInMic: settings.preferBuiltInMic !== false,
      selectedMicDeviceId: settings.selectedMicDeviceId || "",
    };

    const script = `
      try {
        localStorage.setItem("preferBuiltInMic", ${JSON.stringify(String(payload.preferBuiltInMic))});
        localStorage.setItem("selectedMicDeviceId", ${JSON.stringify(payload.selectedMicDeviceId)});
        window.dispatchEvent(new CustomEvent("openwhispr-localstorage-updated", {
          detail: { key: "preferBuiltInMic", value: ${JSON.stringify(String(payload.preferBuiltInMic))} }
        }));
        window.dispatchEvent(new CustomEvent("openwhispr-localstorage-updated", {
          detail: { key: "selectedMicDeviceId", value: ${JSON.stringify(payload.selectedMicDeviceId)} }
        }));
      } catch {}
    `;

    const windows = [this.mainWindow, this.controlPanelWindow].filter(
      (win) => win && !win.isDestroyed()
    );

    await Promise.all(
      windows.map((win) => win.webContents.executeJavaScript(script).catch(() => {}))
    );

    this.updateTrayMenu();
  }

  buildMicrophoneMenuTemplate() {
    const preferBuiltInMic = this.micSettings.preferBuiltInMic !== false;
    const selectedMicDeviceId = this.micSettings.selectedMicDeviceId || "";

    const deviceItems = this.audioDevices.map((device, index) => ({
      type: "radio",
      label: device.label || `Microphone ${index + 1}`,
      checked: !preferBuiltInMic && selectedMicDeviceId === device.deviceId,
      click: () => {
        void this.applyMicSettings({
          preferBuiltInMic: false,
          selectedMicDeviceId: device.deviceId,
        });
      },
    }));

    if (deviceItems.length === 0) {
      deviceItems.push({
        label: "No microphones detected yet",
        enabled: false,
      });
    }

    return [
      {
        type: "checkbox",
        label: "Prefer Built-in Microphone",
        checked: preferBuiltInMic,
        click: (menuItem) => {
          void this.applyMicSettings({
            preferBuiltInMic: menuItem.checked,
            selectedMicDeviceId: menuItem.checked ? "" : selectedMicDeviceId,
          });
        },
      },
      {
        type: "radio",
        label: "System Default",
        checked: !preferBuiltInMic && !selectedMicDeviceId,
        click: () => {
          void this.applyMicSettings({
            preferBuiltInMic: false,
            selectedMicDeviceId: "",
          });
        },
      },
      { type: "separator" },
      ...deviceItems,
    ];
  }

  buildContextMenuTemplate() {
    const dictationVisible = this.windowManager?.isDictationPanelVisible?.() ?? false;

    return [
      {
        label: dictationVisible ? "Hide Dictation Panel" : "Show Dictation Panel",
        click: () => {
          if (!this.windowManager) return;
          if (this.windowManager.isDictationPanelVisible()) {
            this.windowManager.hideDictationPanel();
          } else {
            this.windowManager.showDictationPanel({ focus: true });
          }
          this.updateTrayMenu();
        },
      },
      {
        label: "Open Control Panel",
        click: async () => {
          await this.showControlPanelFromTray();
        },
      },
      {
        label: "Select Microphone",
        submenu: this.buildMicrophoneMenuTemplate(),
      },
      { type: "separator" },
      {
        label: "Quit OpenWhispr",
        click: () => {
          console.log("Quitting app via tray menu");
          app.quit();
        },
      },
    ];
  }

  updateTrayMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate(this.buildContextMenuTemplate());
    this.setRecordingState(this.recordingState);
    this.tray.setContextMenu(contextMenu);
  }

  setupTrayEventHandlers() {
    if (!this.tray) {
      return;
    }

    if (process.platform === "win32") {
      this.tray.on("click", () => {
        void this.showControlPanelFromTray();
      });
      this.tray.on("right-click", () => {
        this.tray?.popUpContextMenu();
      });
    } else {
      this.tray.on("click", () => {
        this.tray?.popUpContextMenu();
      });
    }

    this.tray.on("destroyed", () => {
      console.log("Tray icon destroyed");
      this.stopAnimation();
      this.tray = null;
      this.appliedState = null;
    });
  }
}

module.exports = TrayManager;
