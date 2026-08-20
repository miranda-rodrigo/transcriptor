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

function isInApplicationsFolder() {
  const bundlePath = getMacAppBundlePath();
  if (!bundlePath) {
    return true;
  }
  const homeApps = path.join(os.homedir(), "Applications") + path.sep;
  return bundlePath.startsWith("/Applications/") || bundlePath.startsWith(homeApps);
}

/**
 * First-boot install: if the packaged app is running from Downloads, Desktop,
 * etc., offer to move it into /Applications using Electron's native
 * app.moveToApplicationsFolder(). On success the app relaunches itself from
 * the new location, so callers must stop startup when this returns true.
 *
 * DMG and Gatekeeper-translocated launches are NOT handled here (moving a
 * translocated/readonly bundle is unreliable); those flow into
 * warnIfRunningFromInstaller() below.
 */
async function offerMoveToApplications() {
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

  const { shouldRelocate } = getInstallLocationInfo();
  if (shouldRelocate || isInApplicationsFolder()) {
    return false;
  }

  const { response } = await dialog.showMessageBox({
    type: "question",
    buttons: ["Move to Applications", "Not Now"],
    defaultId: 0,
    cancelId: 1,
    title: "Install OpenWhispr",
    message: "Move OpenWhispr to the Applications folder?",
    detail:
      "OpenWhispr works best from Applications: microphone and accessibility permissions stay attached to the app and automatic updates keep working.\n\nOpenWhispr will move itself and reopen automatically.",
  });

  if (response !== 0) {
    return false;
  }

  try {
    const moved = app.moveToApplicationsFolder({
      conflictHandler: (conflictType) => {
        // Another copy is already in /Applications and running: don't fight it.
        return conflictType !== "existsAndRunning";
      },
    });
    return Boolean(moved);
  } catch (error) {
    await dialog.showMessageBox({
      type: "warning",
      buttons: ["OK"],
      title: "Could not move OpenWhispr",
      message: "OpenWhispr could not move itself to Applications.",
      detail: `${error?.message || "Unknown error"}\n\nQuit OpenWhispr, then drag OpenWhispr.app into Applications (or ~/Applications if you do not have admin rights) and open it from there.`,
    });
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
  isInApplicationsFolder,
  offerMoveToApplications,
  warnIfRunningFromInstaller,
};
