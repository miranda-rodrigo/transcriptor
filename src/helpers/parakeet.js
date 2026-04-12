const { spawn } = require("child_process");
const { app } = require("electron");
const fs = require("fs");
const fsPromises = require("fs").promises;
const https = require("https");
const net = require("net");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const debugLogger = require("./debugLogger");

const PARAEKEET_START_PORT = 6006;
const PARAEKEET_END_PORT = 6029;
const STARTUP_TIMEOUT_MS = 60000;
const TRANSCRIPTION_TIMEOUT_MS = 300000;
const SAMPLE_RATE = 16000;

const modelRegistryData = require("../models/modelRegistryData.json");
const PARAKEET_MODELS = modelRegistryData.parakeetModels || {};

class ParakeetManager {
  constructor() {
    this.currentDownloadProcess = null;
    this.cachedBinaryPath = null;
    this.cachedFFmpegPath = null;
    this.serverProcess = null;
    this.serverPort = null;
    this.serverReady = false;
    this.currentServerModel = null;
    this.startupPromise = null;
  }

  getModelsDir() {
    const homeDir = app?.getPath?.("home") || os.homedir();
    return path.join(homeDir, ".cache", "openwhispr", "parakeet-models");
  }

  validateModelName(modelName) {
    const validModels = Object.keys(PARAKEET_MODELS);
    if (!validModels.includes(modelName)) {
      throw new Error(
        `Invalid Parakeet model: ${modelName}. Valid models: ${validModels.join(", ")}`
      );
    }
    return true;
  }

  getModelPath(modelName) {
    this.validateModelName(modelName);
    return path.join(this.getModelsDir(), modelName);
  }

  getBundledBinaryPath() {
    const platformArch = `${process.platform}-${process.arch}`;
    const binaryName =
      process.platform === "win32"
        ? `sherpa-onnx-ws-${platformArch}.exe`
        : `sherpa-onnx-ws-${platformArch}`;

    const candidates = [];

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "bin", binaryName));
    }

    candidates.push(path.join(__dirname, "..", "..", "resources", "bin", binaryName));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  getBinaryPath() {
    if (this.cachedBinaryPath && fs.existsSync(this.cachedBinaryPath)) {
      return this.cachedBinaryPath;
    }

    const binaryPath = this.getBundledBinaryPath();
    this.cachedBinaryPath = binaryPath;
    return binaryPath;
  }

  isAvailable() {
    return !!this.getBinaryPath();
  }

  async initializeAtStartup() {
    await fsPromises.mkdir(this.getModelsDir(), { recursive: true });
    debugLogger.info("Parakeet initialization complete", {
      binaryAvailable: this.isAvailable(),
      modelsDir: this.getModelsDir(),
    });
  }

  async checkInstallation() {
    const binaryPath = this.getBinaryPath();
    if (!binaryPath) {
      return { installed: false, working: false };
    }

    return {
      installed: true,
      working: true,
      path: binaryPath,
    };
  }

  isModelDownloaded(modelName) {
    const modelDir = this.getModelPath(modelName);
    const requiredFiles = [
      "encoder.int8.onnx",
      "decoder.int8.onnx",
      "joiner.int8.onnx",
      "tokens.txt",
    ];

    return requiredFiles.every((file) => fs.existsSync(path.join(modelDir, file)));
  }

  async transcribeLocalParakeet(audioBlob, options = {}) {
    const binaryPath = this.getBinaryPath();
    if (!binaryPath) {
      throw new Error("sherpa-onnx binary not found. Please ensure the app is installed correctly.");
    }

    const model = options.model || "parakeet-tdt-0.6b-v3";
    if (!this.isModelDownloaded(model)) {
      throw new Error(`Parakeet model "${model}" not downloaded. Please download it from Settings.`);
    }

    const audioBuffer = this.normalizeAudioInput(audioBlob);
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Audio buffer is empty - no audio data received");
    }

    const float32Samples = await this.convertAudioToFloat32(audioBuffer);
    if (!float32Samples || float32Samples.length === 0) {
      return { success: false, message: "No audio detected" };
    }

    await this.ensureServer(model);
    const result = await this.transcribeViaWebSocket(float32Samples);
    return this.parseParakeetResult(result);
  }

  normalizeAudioInput(audioBlob) {
    if (Buffer.isBuffer(audioBlob)) return audioBlob;
    if (audioBlob instanceof ArrayBuffer) return Buffer.from(audioBlob);
    if (ArrayBuffer.isView(audioBlob)) {
      return Buffer.from(audioBlob.buffer, audioBlob.byteOffset, audioBlob.byteLength);
    }
    if (typeof audioBlob === "string") {
      return Buffer.from(audioBlob, "base64");
    }
    if (audioBlob && audioBlob.buffer) {
      return Buffer.from(audioBlob.buffer);
    }
    throw new Error(`Unsupported audio data type: ${typeof audioBlob}`);
  }

  async convertAudioToFloat32(audioBuffer) {
    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const inputPath = path.join(tempDir, `parakeet_input_${uniqueId}.bin`);
    const outputPath = path.join(tempDir, `parakeet_audio_${uniqueId}.f32le`);

    await fsPromises.writeFile(inputPath, audioBuffer);

    const ffmpegPath = await this.getFFmpegPath();
    if (!ffmpegPath) {
      await fsPromises.unlink(inputPath).catch(() => {});
      throw new Error("FFmpeg not found - required for audio format conversion");
    }

    try {
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(
          ffmpegPath,
          [
            "-i",
            inputPath,
            "-ar",
            String(SAMPLE_RATE),
            "-ac",
            "1",
            "-f",
            "f32le",
            "-acodec",
            "pcm_f32le",
            "-y",
            outputPath,
          ],
          {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          }
        );

        let stderr = "";
        const timeout = setTimeout(() => {
          ffmpegProcess.kill("SIGTERM");
          reject(new Error("FFmpeg conversion timed out"));
        }, 30000);

        ffmpegProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        ffmpegProcess.on("error", (error) => {
          clearTimeout(timeout);
          reject(new Error(`FFmpeg process error: ${error.message}`));
        });

        ffmpegProcess.on("close", (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg conversion failed (code ${code}): ${stderr}`));
          }
        });
      });

      return await fsPromises.readFile(outputPath);
    } finally {
      await fsPromises.unlink(inputPath).catch(() => {});
      await fsPromises.unlink(outputPath).catch(() => {});
    }
  }

  async ensureServer(modelName) {
    if (this.serverReady && this.serverProcess && this.currentServerModel === modelName) {
      return;
    }

    if (this.startupPromise) {
      await this.startupPromise;
      if (this.currentServerModel === modelName && this.serverReady) {
        return;
      }
    }

    this.startupPromise = this.startServer(modelName);
    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = null;
    }
  }

  async startServer(modelName) {
    const binaryPath = this.getBinaryPath();
    if (!binaryPath) {
      return { success: false, reason: "sherpa-onnx binary not found" };
    }
    if (!this.isModelDownloaded(modelName)) {
      return { success: false, reason: `Model "${modelName}" not downloaded` };
    }

    await this.stopServer();

    const modelDir = this.getModelPath(modelName);
    this.serverPort = await this.findAvailablePort();

    const args = [
      `--tokens=${path.join(modelDir, "tokens.txt")}`,
      `--encoder=${path.join(modelDir, "encoder.int8.onnx")}`,
      `--decoder=${path.join(modelDir, "decoder.int8.onnx")}`,
      `--joiner=${path.join(modelDir, "joiner.int8.onnx")}`,
      `--port=${this.serverPort}`,
      `--num-threads=${Math.max(1, Math.min(4, Math.floor(os.cpus().length * 0.75)))}`,
    ];
    const binaryDir = path.dirname(binaryPath);
    const env = {
      ...process.env,
      PATH: `${binaryDir}${path.delimiter}${process.env.PATH || ""}`,
      DYLD_LIBRARY_PATH: `${binaryDir}${path.delimiter}${process.env.DYLD_LIBRARY_PATH || ""}`,
      LD_LIBRARY_PATH: `${binaryDir}${path.delimiter}${process.env.LD_LIBRARY_PATH || ""}`,
    };

    debugLogger.info("Starting Parakeet server", {
      model: modelName,
      port: this.serverPort,
    });

    await new Promise((resolve, reject) => {
      const serverProcess = spawn(binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env,
      });

      this.serverProcess = serverProcess;
      this.serverReady = false;
      this.currentServerModel = modelName;

      let stderr = "";
      let resolved = false;

      const finish = (fn, value) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        fn(value);
      };

      const timeout = setTimeout(() => {
        this.stopServer().catch(() => {});
        finish(reject, new Error(`Parakeet server failed to start within ${STARTUP_TIMEOUT_MS}ms`));
      }, STARTUP_TIMEOUT_MS);

      serverProcess.stdout.on("data", (data) => {
        debugLogger.debug("Parakeet stdout", { data: data.toString().trim() }, "parakeet");
      });

      serverProcess.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        debugLogger.debug("Parakeet stderr", { data: output.trim() }, "parakeet");
        if (output.includes("Listening on:")) {
          this.serverReady = true;
          finish(resolve, { success: true, port: this.serverPort });
        }
      });

      serverProcess.on("error", (error) => {
        this.serverReady = false;
        finish(reject, new Error(`Failed to start Parakeet server: ${error.message}`));
      });

      serverProcess.on("close", (code) => {
        this.serverReady = false;
        this.serverProcess = null;
        if (!resolved) {
          finish(
            reject,
            new Error(`Parakeet server exited during startup (code ${code}): ${stderr.slice(0, 400)}`)
          );
        }
      });
    });

    return { success: true, port: this.serverPort };
  }

  async transcribeViaWebSocket(float32Samples) {
    const WebSocketClient = globalThis.WebSocket;
    if (!WebSocketClient) {
      throw new Error("WebSocket client not available in this runtime");
    }
    if (!this.serverReady || !this.serverPort) {
      throw new Error("Parakeet server is not running");
    }

    return await new Promise((resolve, reject) => {
      const ws = new WebSocketClient(`ws://127.0.0.1:${this.serverPort}`);
      let result = "";

      const timeout = setTimeout(() => {
        try {
          ws.close();
        } catch {
          // Ignore close errors on timeout.
        }
        reject(new Error("Parakeet transcription timed out"));
      }, TRANSCRIPTION_TIMEOUT_MS);

      ws.onerror = (event) => {
        clearTimeout(timeout);
        const message =
          event?.error?.message || event?.message || "Unknown websocket transcription error";
        reject(new Error(`Parakeet transcription failed: ${message}`));
      };

      ws.onopen = () => {
        const message = Buffer.alloc(8 + float32Samples.length);
        message.writeInt32LE(SAMPLE_RATE, 0);
        message.writeInt32LE(float32Samples.length, 4);
        float32Samples.copy(message, 8);
        ws.send(new Uint8Array(message));
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === "string") {
          result += event.data;
        } else if (event.data instanceof ArrayBuffer) {
          result += Buffer.from(event.data).toString("utf8");
        } else if (typeof event.data?.arrayBuffer === "function") {
          const arrayBuffer = await event.data.arrayBuffer();
          result += Buffer.from(arrayBuffer).toString("utf8");
        } else {
          result += String(event.data ?? "");
        }

        try {
          ws.send("Done");
        } catch {
          // Ignore, the server may already be closing.
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        resolve(result);
      };
    });
  }

  parseParakeetResult(output) {
    const text = String(output || "").trim();
    if (!text) {
      return { success: false, message: "No audio detected" };
    }

    try {
      const parsed = JSON.parse(text);
      const parsedText = String(parsed.text || "").trim();
      return parsedText ? { success: true, text: parsedText } : { success: false, message: "No audio detected" };
    } catch {
      return { success: true, text };
    }
  }

  async stopServer() {
    if (!this.serverProcess) {
      this.serverReady = false;
      return { success: true };
    }

    const processToStop = this.serverProcess;
    this.serverProcess = null;
    this.serverReady = false;
    this.currentServerModel = null;

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        processToStop.kill("SIGKILL");
        resolve();
      }, 5000);

      processToStop.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });

      processToStop.kill("SIGTERM");
    });

    return { success: true };
  }

  getServerStatus() {
    return {
      available: this.isAvailable(),
      running: this.serverReady && this.serverProcess !== null,
      port: this.serverPort,
      modelName: this.currentServerModel,
    };
  }

  async downloadParakeetModel(modelName, progressCallback = null) {
    this.validateModelName(modelName);
    const modelConfig = PARAKEET_MODELS[modelName];
    const modelPath = this.getModelPath(modelName);
    const modelsDir = this.getModelsDir();

    await fsPromises.mkdir(modelsDir, { recursive: true });

    if (this.isModelDownloaded(modelName)) {
      return { model: modelName, downloaded: true, path: modelPath, success: true };
    }

    const archivePath = path.join(modelsDir, `${modelName}.tar.bz2`);
    let activeRequest = null;
    let activeFile = null;
    let isCancelled = false;

    const cleanup = () => {
      if (activeRequest) {
        activeRequest.destroy();
        activeRequest = null;
      }
      if (activeFile) {
        activeFile.close();
        activeFile = null;
      }
      fs.unlink(archivePath, () => {});
    };

    this.currentDownloadProcess = {
      abort: () => {
        isCancelled = true;
        cleanup();
      },
    };

    await new Promise((resolve, reject) => {
      const downloadWithRedirect = (url, redirectCount = 0) => {
        if (redirectCount > 5) {
          cleanup();
          reject(new Error("Too many redirects"));
          return;
        }

        activeRequest = https.get(url, (response) => {
          if (isCancelled) {
            cleanup();
            reject(new Error("Download cancelled by user"));
            return;
          }

          if (response.statusCode === 301 || response.statusCode === 302) {
            if (!response.headers.location) {
              cleanup();
              reject(new Error("Redirect without location header"));
              return;
            }
            downloadWithRedirect(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            cleanup();
            reject(new Error(`Failed to download model: HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = Number.parseInt(response.headers["content-length"], 10) || 0;
          let downloadedBytes = 0;
          activeFile = fs.createWriteStream(archivePath);

          response.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (progressCallback) {
              progressCallback({
                type: "progress",
                model: modelName,
                downloaded_bytes: downloadedBytes,
                total_bytes: totalSize,
                percentage: totalSize ? Math.round((downloadedBytes / totalSize) * 100) : 0,
              });
            }
          });

          response.pipe(activeFile);

          activeFile.on("finish", () => {
            activeFile.close();
            activeFile = null;
            resolve();
          });

          activeFile.on("error", (error) => {
            cleanup();
            reject(error);
          });
        });

        activeRequest.on("error", (error) => {
          cleanup();
          reject(error);
        });

        activeRequest.setTimeout(600000, () => {
          cleanup();
          reject(new Error("Download request timed out"));
        });
      };

      downloadWithRedirect(modelConfig.downloadUrl);
    });

    try {
      if (progressCallback) {
        progressCallback({
          type: "installing",
          model: modelName,
          percentage: 100,
        });
      }

      await this.extractModelArchive(archivePath, modelName, modelConfig.extractDir);
      await fsPromises.unlink(archivePath).catch(() => {});

      if (progressCallback) {
        progressCallback({
          type: "complete",
          model: modelName,
          percentage: 100,
        });
      }

      return { model: modelName, downloaded: true, path: modelPath, success: true };
    } finally {
      this.currentDownloadProcess = null;
    }
  }

  async extractModelArchive(archivePath, modelName, extractDirName) {
    const modelsDir = this.getModelsDir();
    const tempDir = path.join(modelsDir, `temp-extract-${modelName}`);
    const targetDir = this.getModelPath(modelName);

    await fsPromises.mkdir(tempDir, { recursive: true });

    try {
      await new Promise((resolve, reject) => {
        const tarProcess = spawn("tar", ["-xjf", archivePath, "-C", tempDir], {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });

        let stderr = "";

        tarProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        tarProcess.on("error", (error) => {
          reject(new Error(`Failed to start tar process: ${error.message}`));
        });

        tarProcess.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`tar extraction failed with code ${code}: ${stderr}`));
          }
        });
      });

      const extractedDir = path.join(tempDir, extractDirName);
      if (!fs.existsSync(extractedDir)) {
        throw new Error(`Extracted Parakeet model directory not found: ${extractDirName}`);
      }

      await fsPromises.rm(targetDir, { recursive: true, force: true }).catch(() => {});
      await fsPromises.rename(extractedDir, targetDir);

      const requiredFiles = [
        "encoder.int8.onnx",
        "decoder.int8.onnx",
        "joiner.int8.onnx",
        "tokens.txt",
      ];
      const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(targetDir, file)));
      if (missingFiles.length > 0) {
        throw new Error(`Extracted model is missing required files: ${missingFiles.join(", ")}`);
      }
    } finally {
      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async cancelDownload() {
    if (this.currentDownloadProcess) {
      this.currentDownloadProcess.abort();
      this.currentDownloadProcess = null;
      return { success: true, message: "Download cancelled" };
    }

    return { success: false, error: "No active download to cancel" };
  }

  async checkModelStatus(modelName) {
    if (!this.isModelDownloaded(modelName)) {
      return { model: modelName, downloaded: false, success: true };
    }

    const modelPath = this.getModelPath(modelName);
    const encoderPath = path.join(modelPath, "encoder.int8.onnx");
    const stats = await fsPromises.stat(encoderPath);

    return {
      model: modelName,
      downloaded: true,
      path: modelPath,
      size_bytes: stats.size,
      size_mb: Math.round(stats.size / (1024 * 1024)),
      success: true,
    };
  }

  async listParakeetModels() {
    const models = [];
    for (const modelName of Object.keys(PARAKEET_MODELS)) {
      models.push(await this.checkModelStatus(modelName));
    }

    return {
      models,
      cache_dir: this.getModelsDir(),
      success: true,
    };
  }

  async deleteParakeetModel(modelName) {
    const modelPath = this.getModelPath(modelName);
    if (!fs.existsSync(modelPath)) {
      return { model: modelName, deleted: false, error: "Model not found", success: false };
    }

    await fsPromises.rm(modelPath, { recursive: true, force: true });
    if (this.currentServerModel === modelName) {
      await this.stopServer();
    }

    return {
      model: modelName,
      deleted: true,
      success: true,
    };
  }

  async deleteAllParakeetModels() {
    const modelsDir = this.getModelsDir();
    if (!fs.existsSync(modelsDir)) {
      return { success: true, deleted_count: 0, freed_bytes: 0, freed_mb: 0 };
    }

    let deletedCount = 0;
    const entries = await fsPromises.readdir(modelsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await fsPromises.rm(path.join(modelsDir, entry.name), { recursive: true, force: true });
      deletedCount += 1;
    }

    await this.stopServer();

    return {
      success: true,
      deleted_count: deletedCount,
      freed_bytes: 0,
      freed_mb: 0,
    };
  }

  async getDiagnostics() {
    const models = [];
    for (const modelName of Object.keys(PARAKEET_MODELS)) {
      if (this.isModelDownloaded(modelName)) {
        models.push(modelName);
      }
    }

    return {
      platform: process.platform,
      arch: process.arch,
      resourcesPath: process.resourcesPath || null,
      sherpaOnnx: {
        available: this.isAvailable(),
        path: this.getBinaryPath(),
      },
      modelsDir: this.getModelsDir(),
      models,
    };
  }

  async getFFmpegPath() {
    if (this.cachedFFmpegPath && fs.existsSync(this.cachedFFmpegPath)) {
      return this.cachedFFmpegPath;
    }

    try {
      let ffmpegPath = require("ffmpeg-static");
      ffmpegPath = path.normalize(ffmpegPath);
      if (process.platform === "win32" && !ffmpegPath.endsWith(".exe")) {
        ffmpegPath += ".exe";
      }

      const unpackedPath = ffmpegPath.includes("app.asar")
        ? ffmpegPath.replace(/app\.asar([/\\])/, "app.asar.unpacked$1")
        : null;

      if (unpackedPath && fs.existsSync(unpackedPath)) {
        this.cachedFFmpegPath = unpackedPath;
        return unpackedPath;
      }

      if (fs.existsSync(ffmpegPath)) {
        this.cachedFFmpegPath = ffmpegPath;
        return ffmpegPath;
      }
    } catch {
      // Fall back to system ffmpeg lookup below.
    }

    const candidates =
      process.platform === "darwin"
        ? ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
        : process.platform === "win32"
          ? ["ffmpeg", "C:\\ffmpeg\\bin\\ffmpeg.exe"]
          : ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"];

    for (const candidate of candidates) {
      try {
        await new Promise((resolve, reject) => {
          const proc = spawn(candidate, ["-version"], { windowsHide: true });
          proc.on("error", reject);
          proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg not available"))));
        });
        this.cachedFFmpegPath = candidate;
        return candidate;
      } catch {
        // Try next candidate.
      }
    }

    return null;
  }

  async findAvailablePort() {
    for (let port = PARAEKEET_START_PORT; port <= PARAEKEET_END_PORT; port += 1) {
      const isFree = await new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
          server.close(() => resolve(true));
        });
        server.listen(port, "127.0.0.1");
      });

      if (isFree) {
        return port;
      }
    }

    throw new Error("No free port available for the Parakeet server");
  }
}

module.exports = ParakeetManager;
