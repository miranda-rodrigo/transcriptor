const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const debugLogger = require("./debugLogger");
const { killProcess } = require("../utils/process");

const DEFAULT_PORT = 8179;
const PORT_RANGE_END = 8199;
const STARTUP_TIMEOUT_MS = 120_000;
const HEALTH_CHECK_INTERVAL_MS = 10_000;
const HEALTH_CHECK_TIMEOUT_MS = 3000;
const INFERENCE_TIMEOUT_MS = 60_000;

function findPython() {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const os = require("os");
  const home = os.homedir();

  const absoluteCandidates = [
    path.join(home, ".pyenv/shims/python3"),
    path.join(home, ".pyenv/shims/python"),
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python3",
  ];

  for (const abs of absoluteCandidates) {
    try {
      if (!fs.existsSync(abs)) continue;
      const real = execSync(`"${abs}" -c "import sys; print(sys.executable)"`, {
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, PATH: `${path.dirname(abs)}:${process.env.PATH || "/usr/bin:/bin"}` },
      }).trim();
      if (real && fs.existsSync(real)) return real;
    } catch {}
  }

  const pathCandidates = ["python3", "python"];
  for (const cmd of pathCandidates) {
    try {
      const real = execSync(`${cmd} -c "import sys; print(sys.executable)"`, {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      if (real) return real;
    } catch {}
  }
  return null;
}

class MlxServerManager {
  constructor() {
    this.process = null;
    this.port = null;
    this.ready = false;
    this.modelId = null;
    this.startupPromise = null;
    this.healthCheckInterval = null;
    this.pythonPath = null;
    this._availableCache = null;
    this._checkingAvailability = false;
    this._checkAvailabilityAsync();
  }

  async ensurePython() {
    if (this.pythonPath) return this.pythonPath;
    this.pythonPath = findPython();
    if (!this.pythonPath) {
      throw new Error("Python 3.11+ not found. Install Python to use MLX models.");
    }
    return this.pythonPath;
  }

  _checkAvailabilityAsync() {
    if (this._availableCache !== null || this._checkingAvailability) return;
    this._checkingAvailability = true;
    const { execFile } = require("child_process");
    const python = findPython();
    if (!python) {
      this._availableCache = false;
      this._checkingAvailability = false;
      return;
    }
    const pythonDir = path.dirname(python);
    execFile(python, ["-c", "import mlx_lm"], {
      timeout: 15000,
      env: { ...process.env, PATH: `${pythonDir}:${process.env.PATH || "/usr/bin:/bin"}` },
    }, (err) => {
      this._availableCache = !err;
      this._checkingAvailability = false;
      debugLogger.debug("MLX availability check complete", { available: this._availableCache });
    });
  }

  isAvailable() {
    if (this._availableCache !== null) return this._availableCache;
    if (!this._checkingAvailability) this._checkAvailabilityAsync();
    return false;
  }

  async findAvailablePort() {
    for (let port = DEFAULT_PORT; port <= PORT_RANGE_END; port++) {
      if (await this.isPortAvailable(port)) return port;
    }
    throw new Error(`No available ports in range ${DEFAULT_PORT}-${PORT_RANGE_END}`);
  }

  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port, "127.0.0.1");
    });
  }

  async start(modelId, options = {}) {
    if (this.startupPromise) return this.startupPromise;
    if (this.ready && this.modelId === modelId) return;
    if (this.process) {
      await this.stop();
    }

    this.startupPromise = this._doStart(modelId, options);
    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = null;
    }
  }

  async _doStart(modelId, options = {}) {
    const python = await this.ensurePython();
    this.port = await this.findAvailablePort();
    this.modelId = modelId;

    const args = [
      "-m",
      "mlx_lm",
      "server",
      "--model",
      modelId,
      "--host",
      "127.0.0.1",
      "--port",
      String(this.port),
      "--log-level",
      "WARNING",
    ];

    if (options.maxTokens) args.push("--max-tokens", String(options.maxTokens));

    debugLogger.info("Starting MLX server", { python, port: this.port, modelId, args });

    const pythonDir = path.dirname(python);
    const spawnEnv = {
      ...process.env,
      PATH: `${pythonDir}:${process.env.PATH || "/usr/bin:/bin:/usr/local/bin"}`,
    };

    this.process = spawn(python, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: spawnEnv,
    });

    let stderrBuffer = "";
    let exitCode = null;

    this.process.stdout.on("data", (data) => {
      debugLogger.debug("mlx-server stdout", { data: data.toString().trim() });
    });

    this.process.stderr.on("data", (data) => {
      stderrBuffer += data.toString();
      const line = data.toString().trim();
      if (line) debugLogger.debug("mlx-server stderr", { data: line });
    });

    this.process.on("error", (error) => {
      debugLogger.error("mlx-server process error", { error: error.message });
      this.ready = false;
    });

    this.process.on("close", (code) => {
      exitCode = code;
      debugLogger.debug("mlx-server process exited", { code });
      this.ready = false;
      this.process = null;
      this.stopHealthCheck();
    });

    await this.waitForReady(() => ({ stderr: stderrBuffer, exitCode }));
    this.startHealthCheck();

    debugLogger.info("MLX server started successfully", {
      port: this.port,
      model: modelId,
    });
  }

  async waitForReady(getProcessInfo) {
    const startTime = Date.now();
    const POLL_MS = 500;

    while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
      if (!this.process || this.process.killed) {
        const info = getProcessInfo ? getProcessInfo() : {};
        const stderr = info.stderr ? info.stderr.trim().slice(-300) : "";
        const details = stderr || (info.exitCode != null ? `exit code: ${info.exitCode}` : "");
        throw new Error(
          `MLX server died during startup${details ? `: ${details}` : ""}`
        );
      }

      if (await this.checkHealth()) {
        this.ready = true;
        debugLogger.debug("mlx-server ready", { startupTimeMs: Date.now() - startTime });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    await this.stop();
    throw new Error(`MLX server failed to start within ${STARTUP_TIMEOUT_MS / 1000}s`);
  }

  checkHealth() {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: this.port,
          path: "/v1/models",
          method: "GET",
          timeout: HEALTH_CHECK_TIMEOUT_MS,
        },
        (res) => {
          resolve(res.statusCode === 200);
          res.resume();
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      if (!this.process) {
        this.stopHealthCheck();
        return;
      }
      if (!(await this.checkHealth())) {
        debugLogger.warn("mlx-server health check failed");
        this.ready = false;
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async chatCompletion(messages, options = {}) {
    if (!this.ready || !this.process) {
      throw new Error("MLX server is not running");
    }

    const body = JSON.stringify({
      model: this.modelId,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 512,
    });

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          req.destroy();
          reject(new Error(`MLX inference timed out after ${INFERENCE_TIMEOUT_MS / 1000}s`));
        }
      }, INFERENCE_TIMEOUT_MS);

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: this.port,
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: INFERENCE_TIMEOUT_MS,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);

            debugLogger.debug("mlx-server inference completed", {
              statusCode: res.statusCode,
              elapsed: Date.now() - startTime,
            });

            if (res.statusCode !== 200) {
              reject(new Error(`MLX server returned ${res.statusCode}: ${data}`));
              return;
            }

            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.message?.content?.trim();
              if (!text) {
                reject(new Error("MLX server returned empty response"));
                return;
              }
              resolve(text);
            } catch (e) {
              reject(new Error(`Failed to parse MLX response: ${e.message}`));
            }
          });
        }
      );

      req.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`MLX request failed: ${error.message}`));
      });

      req.write(body);
      req.end();
    });
  }

  async stop() {
    this.stopHealthCheck();

    if (!this.process) {
      this.ready = false;
      return;
    }

    debugLogger.debug("Stopping MLX server");

    try {
      killProcess(this.process, "SIGTERM");

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            killProcess(this.process, "SIGKILL");
          }
          resolve();
        }, 5000);

        if (this.process) {
          this.process.once("close", () => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
    } catch (error) {
      debugLogger.error("Error stopping MLX server", { error: error.message });
    }

    this.process = null;
    this.ready = false;
    this.port = null;
    this.modelId = null;
  }

  isModelCached(hfId) {
    const os = require("os");
    const fs = require("fs");
    const cacheDir = path.join(os.homedir(), ".cache", "huggingface", "hub");
    const folderName = `models--${hfId.replace(/\//g, "--")}`;
    const modelDir = path.join(cacheDir, folderName);
    try {
      return fs.existsSync(modelDir);
    } catch {
      return false;
    }
  }

  async downloadModel(hfId, onProgress) {
    const python = await this.ensurePython();
    const pythonDir = path.dirname(python);

    return new Promise((resolve, reject) => {
      const args = [
        "-c",
        `from huggingface_hub import snapshot_download; snapshot_download("${hfId}")`,
      ];

      const proc = spawn(python, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PATH: `${pythonDir}:${process.env.PATH || "/usr/bin:/bin"}`,
        },
      });

      let stderr = "";

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
        const line = data.toString().trim();
        if (line && onProgress) {
          const match = line.match(/(\d+)%/);
          if (match) onProgress(parseInt(match[1], 10));
        }
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Download failed: ${stderr.slice(-200)}`));
        }
      });

      proc.on("error", (err) => reject(err));
    });
  }

  getStatus() {
    return {
      available: this.isAvailable(),
      running: this.ready && this.process !== null,
      port: this.port,
      modelId: this.modelId,
      pid: this.process?.pid || null,
    };
  }
}

module.exports = MlxServerManager;
