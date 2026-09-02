const { app, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const debugLogger = require("./debugLogger");

const THEME_SOURCES = ["light", "dark", "system"];
const SETTINGS_FILE = "ui-settings.json";

// Must match --background in src/index.css for each scheme so the window
// never paints a mismatched color before the renderer's first frame.
const BACKGROUND_COLORS = {
  dark: "#1b1916",
  light: "#f8f7f4",
};

class ThemeManager {
  constructor() {
    this.themeSource = "system";
    this.loaded = false;
  }

  getSettingsPath() {
    return path.join(app.getPath("userData"), SETTINGS_FILE);
  }

  load() {
    if (this.loaded) return this.themeSource;
    this.loaded = true;
    try {
      const raw = fs.readFileSync(this.getSettingsPath(), "utf8");
      const parsed = JSON.parse(raw);
      if (THEME_SOURCES.includes(parsed?.themeSource)) {
        this.themeSource = parsed.themeSource;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        debugLogger.warn("Failed to read UI settings; using system theme", {
          error: error?.message,
        });
      }
    }
    nativeTheme.themeSource = this.themeSource;
    return this.themeSource;
  }

  get() {
    return this.themeSource;
  }

  set(source) {
    if (!THEME_SOURCES.includes(source)) {
      return { success: false, error: `Invalid theme source: ${String(source)}` };
    }
    this.themeSource = source;
    nativeTheme.themeSource = source;
    try {
      fs.writeFileSync(
        this.getSettingsPath(),
        JSON.stringify({ themeSource: source }, null, 2) + "\n",
        "utf8"
      );
    } catch (error) {
      debugLogger.warn("Failed to persist theme source", { error: error?.message });
      return { success: false, error: error?.message };
    }
    return { success: true, themeSource: source };
  }

  getBackgroundColor() {
    return nativeTheme.shouldUseDarkColors ? BACKGROUND_COLORS.dark : BACKGROUND_COLORS.light;
  }

  // Keeps the native window background in sync so resizes and reveals don't
  // flash the previous scheme's color.
  bindWindow(win) {
    if (!win || win.isDestroyed()) return;
    const update = () => {
      if (win.isDestroyed()) return;
      win.setBackgroundColor(this.getBackgroundColor());
    };
    nativeTheme.on("updated", update);
    win.once("closed", () => {
      nativeTheme.removeListener("updated", update);
    });
  }
}

module.exports = ThemeManager;
