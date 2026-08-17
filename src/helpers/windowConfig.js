const path = require("path");

// Compact dictation HUD — a thin bar, not a full floating panel.
const OVERLAY_LAYOUTS = {
  bar: { width: 188, height: 40 },
  popover: { width: 260, height: 156 },
};

const MAIN_WINDOW_CONFIG = {
  ...OVERLAY_LAYOUTS.bar,
  title: "Voice Recorder",
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    sandbox: true,
  },
  frame: false,
  alwaysOnTop: true,
  resizable: false,
  transparent: true,
  backgroundColor: "#00000000",
  show: false, // Start hidden, show after setup
  skipTaskbar: false, // Keep visible in Dock/taskbar so app stays discoverable
  focusable: true,
  visibleOnAllWorkspaces: process.platform !== "win32",
  fullScreenable: false,
  hasShadow: false,
  acceptsFirstMouse: true,
  roundedCorners: true,
  type: process.platform === "darwin" ? "panel" : "normal",
};

// Control panel window configuration
const CONTROL_PANEL_CONFIG = {
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    sandbox: false,
    webSecurity: false,
    spellcheck: false,
  },
  title: "Control Panel",
  resizable: true,
  show: false,
  frame: false,
  ...(process.platform === "darwin" && {
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 20 },
  }),
  transparent: false,
  backgroundColor: "#121212",
  minimizable: true,
  maximizable: true,
  closable: true,
  fullscreenable: true,
  skipTaskbar: false,
  alwaysOnTop: false,
  visibleOnAllWorkspaces: false,
  type: "normal",
};

class WindowPositionUtil {
  static getMainWindowPosition(display, size = OVERLAY_LAYOUTS.bar) {
    const { width, height } = size;
    const MARGIN = 12;
    const workArea = display.workArea || display.bounds;
    const x = Math.max(workArea.x, workArea.x + workArea.width - width - MARGIN);
    const y = Math.max(workArea.y, workArea.y + workArea.height - height - MARGIN);
    return { x, y, width, height };
  }

  static setupAlwaysOnTop(window) {
    if (process.platform === "darwin") {
      window.setAlwaysOnTop(true, "floating", 1);
      window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true,
      });
      window.setFullScreenable(false);

      if (window.isVisible()) {
        window.setAlwaysOnTop(true, "floating", 1);
      }
    } else if (process.platform === "win32") {
      window.setAlwaysOnTop(true, "pop-up-menu");
    } else {
      window.setAlwaysOnTop(true, "screen-saver");
    }

    if (window.isVisible()) {
      window.moveTop();
    }
  }

  static setupControlPanel(window) {
    // Control panel should behave like a normal application window
  }
}

module.exports = {
  MAIN_WINDOW_CONFIG,
  CONTROL_PANEL_CONFIG,
  OVERLAY_LAYOUTS,
  WindowPositionUtil,
};
