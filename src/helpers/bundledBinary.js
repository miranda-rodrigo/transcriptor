const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const debugLogger = require("./debugLogger");

function copyToUserDataAndChmod(sourcePath) {
  const destDir = path.join(app.getPath("userData"), "bin");
  const destPath = path.join(destDir, path.basename(sourcePath));
  fs.mkdirSync(destDir, { recursive: true });

  const sourceStat = fs.statSync(sourcePath);
  let needsCopy = true;
  if (fs.existsSync(destPath)) {
    const destStat = fs.statSync(destPath);
    needsCopy = destStat.size !== sourceStat.size || destStat.mtimeMs < sourceStat.mtimeMs;
  }

  if (needsCopy) {
    fs.copyFileSync(sourcePath, destPath);
  }

  try {
    fs.chmodSync(destPath, 0o755);
  } catch (chmodErr) {
    debugLogger.warn("Failed to chmod userData binary copy", {
      destPath,
      error: chmodErr.message,
    });
  }

  return destPath;
}

/**
 * Return a usable path to a bundled executable without chmod'ing the .app bundle.
 * Managed /Applications installs are often root-owned; chmod there fails and
 * breaks local transcription. Copy to userData and chmod the copy instead.
 */
function resolveExecutablePath(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  if (process.platform === "win32") {
    return filePath;
  }

  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return filePath;
  } catch {
    try {
      debugLogger.debug("Bundled binary is not executable; copying to userData", { filePath });
      return copyToUserDataAndChmod(filePath);
    } catch (copyErr) {
      debugLogger.warn("Failed to copy bundled binary to userData", {
        filePath,
        error: copyErr.message,
      });
      return null;
    }
  }
}

module.exports = { resolveExecutablePath };
