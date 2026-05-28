const { app } = require("electron");
const fs = require("fs");
const path = require("path");

function getFilePath() {
  return path.join(app.getPath("userData"), "training-data.jsonl");
}

function append(rawText, refinedText, source) {
  const raw = rawText?.trim();
  const refined = refinedText?.trim();
  if (!raw || !refined || raw === refined) return;
  const entry = JSON.stringify({
    prompt: raw,
    completion: refined,
    source: source || "unknown",
    timestamp: new Date().toISOString(),
  });
  fs.appendFileSync(getFilePath(), entry + "\n", "utf8");
}

function getCount() {
  try {
    const content = fs.readFileSync(getFilePath(), "utf8");
    return content.split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

module.exports = { append, getCount, getFilePath };
