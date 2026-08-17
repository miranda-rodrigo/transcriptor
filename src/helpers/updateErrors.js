/**
 * Classify auto-update failures so "no GitHub release" is not treated as a user-facing error.
 * electron-updater throws when latest-mac.yml / releases.atom is missing, which is normal
 * until a production GitHub release exists.
 */
function getUpdateErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.stack === "string" && error.stack.trim()) return error.stack.split("\n")[0];
  try {
    return String(error);
  } catch {
    return "";
  }
}

function isSilentUpdateMiss(error) {
  const msg = getUpdateErrorMessage(error).toLowerCase();
  if (!msg) return false;

  return (
    msg.includes("unable to find latest version") ||
    msg.includes("cannot find channel") ||
    msg.includes("latest-mac.yml") ||
    msg.includes("latest-mac.yaml") ||
    msg.includes("latest.yml") ||
    msg.includes("no published versions") ||
    msg.includes("please ensure a production release exists") ||
    msg.includes("releases.atom") ||
    /http(?:s)?:\/\/github\.com\/.+\/releases/.test(msg) ||
    (msg.includes("404") && (msg.includes("github") || msg.includes("latest") || msg.includes("yml")))
  );
}

function serializeUpdateError(error) {
  return {
    message: getUpdateErrorMessage(error) || "Update check failed",
  };
}

module.exports = {
  getUpdateErrorMessage,
  isSilentUpdateMiss,
  serializeUpdateError,
};
