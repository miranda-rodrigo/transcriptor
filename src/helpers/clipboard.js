const { clipboard, systemPreferences, dialog } = require("electron");
const { spawn } = require("child_process");
const { killProcess } = require("../utils/process");

const CACHE_TTL_MS = 30000;
const PASTE_DELAY_MS = 50;

class ClipboardManager {
  constructor() {
    this.accessibilityCache = { value: null, expiresAt: 0 };
    this.accessibilityDialogShown = false;
  }

  safeLog(...args) {
    if (process.env.NODE_ENV === "development") {
      try {
        console.log(...args);
      } catch (error) {
        if (error.code !== "EPIPE") {
          process.stderr.write(`Log error: ${error.message}\n`);
        }
      }
    }
  }

  async pasteText(text) {
    const startTime = Date.now();

    try {
      clipboard.writeText(text);
      this.safeLog("📋 Text copied to clipboard:", text.substring(0, 50) + "...");

      this.safeLog("🔍 Checking accessibility permissions for paste operation...");
      const hasPermissions = await this.checkAccessibilityPermissions();

      if (!hasPermissions) {
        this.safeLog("⚠️ No accessibility permissions - text copied to clipboard only");
        throw new Error(
          "Accessibility permissions required for automatic pasting. Text has been copied to clipboard - please paste manually with Cmd+V."
        );
      }

      this.safeLog("✅ Permissions granted, attempting to paste...");
      await this.pasteMacOS();

      this.safeLog("✅ Paste operation complete", {
        elapsedMs: Date.now() - startTime,
        textLength: text.length,
      });
    } catch (error) {
      this.safeLog("❌ Paste operation failed", {
        elapsedMs: Date.now() - startTime,
        error: error.message,
      });
      throw error;
    }
  }

  async captureSelectedText() {
    try {
      if (!this.isAccessibilityTrusted(false)) {
        return null;
      }

      const previous = clipboard.readText();
      await this.keystrokeMacOS("c");
      await new Promise((resolve) => setTimeout(resolve, 80));
      const selected = clipboard.readText();
      clipboard.writeText(previous || "");

      const trimmed = String(selected || "").trim();
      const previousTrimmed = String(previous || "").trim();
      if (!trimmed || trimmed === previousTrimmed) {
        return null;
      }
      return trimmed.length > 8000 ? trimmed.slice(0, 8000) : trimmed;
    } catch (error) {
      this.safeLog("captureSelectedText failed", error.message);
      return null;
    }
  }

  async keystrokeMacOS(key) {
    return new Promise((resolve, reject) => {
      const processRef = spawn("osascript", [
        "-e",
        `tell application "System Events" to keystroke "${key}" using command down`,
      ]);

      const timeoutId = setTimeout(() => {
        killProcess(processRef, "SIGKILL");
        reject(new Error("Keyboard simulation timed out"));
      }, 3000);

      processRef.on("close", (code) => {
        clearTimeout(timeoutId);
        if (code === 0) resolve();
        else reject(new Error(`Keyboard simulation failed (code ${code})`));
      });
      processRef.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async pasteMacOS() {
    await new Promise((resolve) => setTimeout(resolve, PASTE_DELAY_MS));
    await this.keystrokeMacOS("v");
    this.safeLog("✅ Text pasted successfully via Cmd+V simulation");
  }

  isAccessibilityTrusted(prompt = false) {
    if (typeof systemPreferences.isTrustedAccessibilityClient !== "function") {
      return false;
    }
    try {
      return systemPreferences.isTrustedAccessibilityClient(Boolean(prompt));
    } catch {
      return false;
    }
  }

  async checkAccessibilityPermissions() {
    const now = Date.now();
    if (now < this.accessibilityCache.expiresAt && this.accessibilityCache.value !== null) {
      return this.accessibilityCache.value;
    }

    const allowed = this.isAccessibilityTrusted(false);
    this.accessibilityCache = {
      value: allowed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    if (allowed) {
      // Permission granted: allow the guidance dialog again if it is ever revoked.
      this.accessibilityDialogShown = false;
    } else {
      void this.showAccessibilityDialog();
    }
    return allowed;
  }

  async showAccessibilityDialog() {
    if (this.accessibilityDialogShown) {
      return;
    }
    this.accessibilityDialogShown = true;

    // Prompting via the system API registers OpenWhispr in the Accessibility
    // list, so the user only has to flip the toggle instead of hunting for
    // the app with the "+" button.
    this.isAccessibilityTrusted(true);

    try {
      const { response } = await dialog.showMessageBox({
        type: "info",
        buttons: ["Open System Settings", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Enable automatic pasting",
        message: "Allow OpenWhispr to paste text for you",
        detail:
          "Your dictated text was copied to the clipboard — press Cmd+V to paste it manually this time.\n\nTo paste automatically, enable OpenWhispr in System Settings → Privacy & Security → Accessibility, then dictate again.\n\nIf you reinstalled OpenWhispr, remove any old OpenWhispr/Electron entries from that list first.",
      });
      if (response === 0) {
        this.openSystemSettings();
      }
    } catch (error) {
      this.safeLog("Accessibility dialog failed", error.message);
    }
  }

  openSystemSettings() {
    const settingsCommands = [
      ["open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"]],
      ["open", ["-b", "com.apple.systempreferences"]],
      ["open", ["/System/Library/PreferencePanes/Security.prefPane"]],
    ];

    let commandIndex = 0;
    const tryNextCommand = () => {
      if (commandIndex < settingsCommands.length) {
        const [cmd, args] = settingsCommands[commandIndex];
        const settingsProcess = spawn(cmd, args);

        settingsProcess.on("error", () => {
          commandIndex++;
          tryNextCommand();
        });

        settingsProcess.on("close", (settingsCode) => {
          if (settingsCode !== 0) {
            commandIndex++;
            tryNextCommand();
          }
        });
      } else {
        spawn("open", ["-a", "System Preferences"]).on("error", () => {
          spawn("open", ["-a", "System Settings"]).on("error", () => {});
        });
      }
    };

    tryNextCommand();
  }

  async readClipboard() {
    return clipboard.readText();
  }

  async writeClipboard(text) {
    clipboard.writeText(text);
    return { success: true };
  }

  checkPasteTools() {
    return {
      platform: "darwin",
      available: true,
      method: "applescript",
      requiresPermission: true,
      tools: [],
    };
  }
}

module.exports = ClipboardManager;
