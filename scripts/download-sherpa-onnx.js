#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SHERPA_ONNX_VERSION = "1.12.23";
const GITHUB_RELEASE_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${SHERPA_ONNX_VERSION}`;
const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

const BINARIES = {
  "darwin-arm64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-osx-universal2-shared.tar.bz2`,
    binaryName: "sherpa-onnx-offline-websocket-server",
    outputName: "sherpa-onnx-ws-darwin-arm64",
    libraryPattern: /\.dylib$/,
  },
  "darwin-x64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-osx-universal2-shared.tar.bz2`,
    binaryName: "sherpa-onnx-offline-websocket-server",
    outputName: "sherpa-onnx-ws-darwin-x64",
    libraryPattern: /\.dylib$/,
  },
  "win32-x64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-win-x64-shared.tar.bz2`,
    binaryName: "sherpa-onnx-offline-websocket-server.exe",
    outputName: "sherpa-onnx-ws-win32-x64.exe",
    libraryPattern: /\.dll$/,
  },
  "linux-x64": {
    archiveName: `sherpa-onnx-v${SHERPA_ONNX_VERSION}-linux-x64-shared.tar.bz2`,
    binaryName: "sherpa-onnx-offline-websocket-server",
    outputName: "sherpa-onnx-ws-linux-x64",
    libraryPattern: /\.so(\.\d+)*$/,
  },
};

function getDownloadUrl(archiveName) {
  return `${GITHUB_RELEASE_URL}/${archiveName}`;
}

function parseArgs() {
  const currentPlatform = `${process.platform}-${process.arch}`;
  return {
    isCurrent: process.argv.includes("--current"),
    isForce: process.argv.includes("--force"),
    platformArch: currentPlatform,
  };
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (!response.headers.location) {
          reject(new Error("Redirect without location header"));
          return;
        }
        file.close();
        fs.unlinkSync(destination);
        downloadFile(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });

    request.on("error", (error) => {
      file.close();
      fs.unlink(destination, () => reject(error));
    });
  });
}

function extractArchive(archivePath, extractDir) {
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("tar", ["-xjf", archivePath, "-C", extractDir], { stdio: "inherit" });
}

function findFileRecursive(targetDir, predicate) {
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFileRecursive(entryPath, predicate);
      if (nested.length > 0) return nested;
      continue;
    }

    if (predicate(entry.name)) {
      return [entryPath];
    }
  }

  return [];
}

function collectFilesRecursive(targetDir, predicate, result = []) {
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(entryPath, predicate, result);
    } else if (predicate(entry.name)) {
      result.push(entryPath);
    }
  }
  return result;
}

async function downloadBinary(platformArch, config, isForce) {
  const outputPath = path.join(BIN_DIR, config.outputName);
  if (fs.existsSync(outputPath) && !isForce) {
    console.log(`  ${platformArch}: already exists`);
    return true;
  }

  const archivePath = path.join(BIN_DIR, config.archiveName);
  const extractDir = path.join(BIN_DIR, `temp-sherpa-${platformArch}`);

  try {
    console.log(`  ${platformArch}: downloading ${config.archiveName}`);
    await downloadFile(getDownloadUrl(config.archiveName), archivePath);
    extractArchive(archivePath, extractDir);

    const [binaryPath] = findFileRecursive(extractDir, (name) => name === config.binaryName);
    if (!binaryPath) {
      throw new Error(`Binary ${config.binaryName} not found in archive`);
    }

    fs.copyFileSync(binaryPath, outputPath);
    if (process.platform !== "win32") {
      fs.chmodSync(outputPath, 0o755);
    }

    const libraries = collectFilesRecursive(extractDir, (name) => config.libraryPattern.test(name));
    for (const libraryPath of libraries) {
      const destination = path.join(BIN_DIR, path.basename(libraryPath));
      if (!fs.existsSync(destination) || isForce) {
        fs.copyFileSync(libraryPath, destination);
        if (process.platform !== "win32") {
          fs.chmodSync(destination, 0o755);
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`  ${platformArch}: ${error.message}`);
    return false;
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
  }
}

async function main() {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const args = parseArgs();
  const targets = args.isCurrent ? [args.platformArch] : Object.keys(BINARIES);

  console.log(`Downloading sherpa-onnx binaries (v${SHERPA_ONNX_VERSION})`);

  let hasFailure = false;
  for (const target of targets) {
    const ok = await downloadBinary(target, BINARIES[target], args.isForce);
    hasFailure = hasFailure || !ok;
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
