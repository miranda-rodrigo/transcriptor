const { app, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

function getMacAppBundlePath() {
  if (process.platform !== "darwin") {
    return null;
  }
  let current = path.dirname(process.execPath);
  while (current !== path.dirname(current)) {
    if (current.endsWith(".app")) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function getInstallLocationInfo() {
  const bundlePath = getMacAppBundlePath();
  const execPath = process.execPath || "";
  const runningFromDmg = typeof bundlePath === "string" && bundlePath.startsWith("/Volumes/");
  const translocated = execPath.includes("/AppTranslocation/") ||
    (typeof bundlePath === "string" && bundlePath.includes("/AppTranslocation/"));

  return {
    bundlePath,
    runningFromDmg,
    translocated,
    shouldRelocate: runningFromDmg || translocated,
  };
}

function isAppInstallWritable() {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  try {
    if (!app.isPackaged) {
      return true;
    }
  } catch {
    return true;
  }
  if (process.platform !== "darwin") {
    return true;
  }
  const { bundlePath, shouldRelocate } = getInstallLocationInfo();
  if (shouldRelocate) {
    return false;
  }
  if (!bundlePath) {
    return true;
  }
  try {
    fs.accessSync(bundlePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Packaged DMG users must copy the .app off the disk image.
 * Running from /Volumes or a Gatekeeper translocation path binds TCC
 * (mic/accessibility) to a throwaway location and breaks paste + updates.
 */
async function warnIfRunningFromInstaller() {
  if (process.platform !== "darwin" || process.env.NODE_ENV === "development") {
    return false;
  }
  try {
    if (!app.isPackaged) {
      return false;
    }
  } catch {
    return false;
  }

  const { shouldRelocate, runningFromDmg } = getInstallLocationInfo();
  if (!shouldRelocate) {
    return false;
  }

  const homeApps = path.join(os.homedir(), "Applications");
  const detail = runningFromDmg
    ? "You opened OpenWhispr from the installer disk image. Drag OpenWhispr.app to the Applications folder (or ~/Applications if you do not have admin rights), then launch it from there.\n\nRunning from the DMG breaks microphone/accessibility permissions and automatic updates."
    : "macOS launched OpenWhispr from a temporary location (Gatekeeper). Drag OpenWhispr.app from the DMG into Applications, then open it from there so permissions and updates work.";

  const { response } = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Open Applications Folder", "Quit"],
    defaultId: 0,
    cancelId: 1,
    title: "Install OpenWhispr",
    message: "Move OpenWhispr to Applications first",
    detail,
  });

  if (response === 0) {
    try {
      if (!fs.existsSync(homeApps)) {
        fs.mkdirSync(homeApps, { recursive: true });
      }
    } catch {
      // ignore — /Applications is still the primary target
    }
    await shell.openPath("/Applications");
    if (fs.existsSync(homeApps)) {
      await shell.openPath(homeApps);
    }
  }

  return true;
}

module.exports = {
  getMacAppBundlePath,
  getInstallLocationInfo,
  isAppInstallWritable,
  warnIfRunningFromInstaller,
};
