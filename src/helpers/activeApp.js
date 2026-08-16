const { execFile } = require("child_process");

const CACHE_TTL_MS = 2000;
const IGNORED_APP_PATTERN = /openwhispr|^electron$|^helper$/i;

class ActiveAppManager {
  constructor() {
    this.cache = { name: null, expiresAt: 0 };
  }

  async getActiveApp() {
    const now = Date.now();
    if (now < this.cache.expiresAt) {
      return this.cache.name;
    }

    const name = await this.detectActiveApp();
    this.cache = { name, expiresAt: now + CACHE_TTL_MS };
    return name;
  }

  detectActiveApp() {
    if (process.platform !== "darwin") {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      execFile(
        "osascript",
        [
          "-e",
          'tell application "System Events" to get name of first application process whose frontmost is true',
        ],
        { timeout: 1500 },
        (error, stdout) => {
          if (error) {
            resolve(null);
            return;
          }

          const name = String(stdout || "").trim();
          if (!name || IGNORED_APP_PATTERN.test(name)) {
            resolve(null);
            return;
          }

          resolve(name);
        }
      );
    });
  }
}

module.exports = ActiveAppManager;
