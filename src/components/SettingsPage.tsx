import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { RefreshCw, Download, Command, Mic, Shield, FolderOpen, Activity, XCircle } from "lucide-react";
import MarkdownRenderer from "./ui/MarkdownRenderer";
import MicPermissionWarning from "./ui/MicPermissionWarning";
import MicrophoneSettings from "./ui/MicrophoneSettings";
import TranscriptionModelPicker from "./TranscriptionModelPicker";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useAgentName } from "../utils/agentName";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useUpdater } from "../hooks/useUpdater";
import { getTranscriptionProviders } from "../models/ModelRegistry";
import { formatHotkeyLabel } from "../utils/hotkeys";
import PromptStudio from "./ui/PromptStudio";
import ReasoningModelSelector from "./ReasoningModelSelector";
import type { UpdateInfoResult } from "../types/electron";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";

export type SettingsSectionType =
  | "general"
  | "transcription"
  | "aiModels"
  | "agentConfig"
  | "prompts";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
}

export default function SettingsPage({ activeSection = "general" }: SettingsPageProps) {
  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const {
    useLocalWhisper,
    localTranscriptionProvider,
    whisperModel,
    parakeetModel,
    allowOpenAIFallback,
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    groqApiKey,
    dictationKey,
    activationMode,
    setActivationMode,
    preferBuiltInMic,
    selectedMicDeviceId,
    setPreferBuiltInMic,
    setSelectedMicDeviceId,
    setUseLocalWhisper,
    setLocalTranscriptionProvider,
    setWhisperModel,
    setParakeetModel,
    setAllowOpenAIFallback,
    setCloudTranscriptionProvider,
    setCloudTranscriptionModel,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider,
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setGroqApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
  } = useSettings();

  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\openwhispr\\whisper-models"
      : "~/.cache/openwhispr/whisper-models";

  // Use centralized updater hook to prevent EventEmitter memory leaks
  const {
    status: updateStatus,
    info: updateInfo,
    downloadProgress: updateDownloadProgress,
    isChecking: checkingForUpdates,
    isDownloading: downloadingUpdate,
    isInstalling: installInitiated,
    checkForUpdates,
    downloadUpdate,
    installUpdate: installUpdateAction,
    getAppVersion,
    error: updateError,
  } = useUpdater();

  const isUpdateAvailable =
    !updateStatus.isDevelopment && (updateStatus.updateAvailable || updateStatus.updateDownloaded);

  const whisperHook = useWhisper(showAlertDialog);
  const permissionsHook = usePermissions(showAlertDialog);
  useClipboard(showAlertDialog);
  const { agentName, setAgentName } = useAgentName();
  const installTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared hotkey registration hook
  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const [localReasoningProvider, setLocalReasoningProvider] = useState(() => {
    return localStorage.getItem("reasoningProvider") || reasoningProvider;
  });

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(async () => {
      if (!mounted) return;

      const version = await getAppVersion();
      if (version && mounted) setCurrentVersion(version);

      if (mounted) {
        whisperHook.checkWhisperInstallation();
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [whisperHook, getAppVersion]);

  // Show alert dialog on update errors
  useEffect(() => {
    if (updateError) {
      showAlertDialog({
        title: "Update Error",
        description:
          updateError.message ||
          "The updater encountered a problem. Please try again or download the latest release manually.",
      });
    }
  }, [updateError, showAlertDialog]);

  useEffect(() => {
    if (installInitiated) {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
      }
      installTimeoutRef.current = setTimeout(() => {
        showAlertDialog({
          title: "Still Running",
          description:
            "OpenWhispr didn't restart automatically. Please quit the app manually to finish installing the update.",
        });
      }, 10000);
    } else if (installTimeoutRef.current) {
      clearTimeout(installTimeoutRef.current);
      installTimeoutRef.current = null;
    }

    return () => {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
        installTimeoutRef.current = null;
      }
    };
  }, [installInitiated, showAlertDialog]);

  const resetAccessibilityPermissions = () => {
    const message = `🔄 RESET ACCESSIBILITY PERMISSIONS\n\nIf you've rebuilt or reinstalled OpenWhispr and automatic inscription isn't functioning, you may have obsolete permissions from the previous version.\n\n📋 STEP-BY-STEP RESTORATION:\n\n1️⃣ Open System Settings (or System Preferences)\n   • macOS Ventura+: Apple Menu → System Settings\n   • Older macOS: Apple Menu → System Preferences\n\n2️⃣ Navigate to Privacy & Security → Accessibility\n\n3️⃣ Look for obsolete OpenWhispr entries:\n   • Any entries named "OpenWhispr"\n   • Any entries named "Electron"\n   • Any entries with unclear or generic names\n   • Entries pointing to old application locations\n\n4️⃣ Remove ALL obsolete entries:\n   • Select each old entry\n   • Click the minus (-) button\n   • Enter your password if prompted\n\n5️⃣ Add the current OpenWhispr:\n   • Click the plus (+) button\n   • Navigate to and select the CURRENT OpenWhispr app\n   • Ensure the checkbox is ENABLED\n\n6️⃣ Restart OpenWhispr completely\n\n💡 This is very common during development when rebuilding applications!\n\nClick OK when you're ready to open System Settings.`;

    showConfirmDialog({
      title: "Reset Accessibility Permissions",
      description: message,
      onConfirm: () => {
        showAlertDialog({
          title: "Opening System Settings",
          description:
            "Opening System Settings... Look for the Accessibility section under Privacy & Security.",
        });

        permissionsHook.openAccessibilitySettings();
      },
    });
  };

  const handleRemoveModels = useCallback(() => {
    if (isRemovingModels) return;

    showConfirmDialog({
      title: "Remove downloaded models?",
      description: `This deletes all locally cached Whisper models (${cachePathHint}) and frees disk space. You can download them again from the model picker.`,
      confirmText: "Delete Models",
      variant: "destructive",
      onConfirm: () => {
        setIsRemovingModels(true);
        window.electronAPI
          ?.deleteAllWhisperModels?.()
          .then((result) => {
            if (!result?.success) {
              showAlertDialog({
                title: "Unable to Remove Models",
                description:
                  result?.error || "Something went wrong while deleting the cached models.",
              });
              return;
            }

            window.dispatchEvent(new Event("openwhispr-models-cleared"));

            showAlertDialog({
              title: "Models Removed",
              description:
                "All downloaded Whisper models were deleted. You can re-download any model from the picker when needed.",
            });
          })
          .catch((error) => {
            showAlertDialog({
              title: "Unable to Remove Models",
              description: error?.message || "An unknown error occurred.",
            });
          })
          .finally(() => {
            setIsRemovingModels(false);
          });
      },
    });
  }, [isRemovingModels, cachePathHint, showConfirmDialog, showAlertDialog]);

  // Process status state
  const [processStatus, setProcessStatus] = useState<{
    whisper: { available: boolean; running: boolean; port: number | null; modelName: string | null };
    llama: { running: boolean; modelId?: string; pid?: number; runningForMs?: number };
  } | null>(null);
  const [isKillingLlama, setIsKillingLlama] = useState(false);

  const fetchProcessStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.getProcessStatus();
      setProcessStatus(status);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeSection !== "general") return;
    fetchProcessStatus();
    const interval = setInterval(fetchProcessStatus, 5000);
    return () => clearInterval(interval);
  }, [activeSection, fetchProcessStatus]);

  const handleKillLlama = useCallback(async () => {
    setIsKillingLlama(true);
    try {
      await window.electronAPI.killLlamaProcess();
      await fetchProcessStatus();
    } catch {}
    setIsKillingLlama(false);
  }, [fetchProcessStatus]);

  const formatUptime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  const renderProcessStatus = () => {
    if (!processStatus) return null;
    const { whisper, llama, mlx } = processStatus;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Process Status
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Live status of background processes running on your system.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Whisper Server */}
          <div className={`p-4 rounded-xl border transition-all ${whisper.running ? "border-success/50 bg-success/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Whisper Server</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${whisper.running ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${whisper.running ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                {whisper.running ? "Running" : "Stopped"}
              </span>
            </div>
            {whisper.running && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {whisper.modelName && <p>Model: <span className="text-foreground">{whisper.modelName}</span></p>}
                {whisper.port && <p>Port: <span className="font-mono text-foreground">{whisper.port}</span></p>}
              </div>
            )}
            {!whisper.running && (
              <p className="text-xs text-muted-foreground">No active transcription server.</p>
            )}
          </div>

          {/* Llama Inference */}
          <div className={`p-4 rounded-xl border transition-all ${llama.running ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Llama (GGUF)</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${llama.running ? "bg-warning/10 text-warning border-warning/20" : "bg-muted text-muted-foreground border-border"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${llama.running ? "bg-warning animate-pulse" : "bg-muted-foreground"}`} />
                {llama.running ? "Processing" : "Idle"}
              </span>
            </div>
            {llama.running && (
              <>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {llama.modelId && <p>Model: <span className="text-foreground">{llama.modelId}</span></p>}
                  {llama.pid && <p>PID: <span className="font-mono text-foreground">{llama.pid}</span></p>}
                  {llama.runningForMs != null && <p>Uptime: <span className="text-foreground">{formatUptime(llama.runningForMs)}</span></p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleKillLlama}
                  disabled={isKillingLlama}
                  className="mt-3 w-full text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  {isKillingLlama ? "Killing..." : "Kill Process"}
                </Button>
              </>
            )}
            {!llama.running && (
              <p className="text-xs text-muted-foreground">No active inference process.</p>
            )}
          </div>

          {/* MLX Server */}
          <div className={`p-4 rounded-xl border transition-all ${mlx?.running ? "border-chart-4/50 bg-chart-4/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">MLX Server</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${mlx?.running ? "bg-chart-4/10 text-chart-4 border-chart-4/20" : mlx?.available ? "bg-muted text-muted-foreground border-border" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mlx?.running ? "bg-chart-4 animate-pulse" : mlx?.available ? "bg-muted-foreground" : "bg-destructive"}`} />
                {mlx?.running ? "Running" : mlx?.available ? "Ready" : "Unavailable"}
              </span>
            </div>
            {mlx?.running && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {mlx.modelId && <p>Model: <span className="text-foreground">{mlx.modelId.split("/").pop()}</span></p>}
                {mlx.port && <p>Port: <span className="font-mono text-foreground">{mlx.port}</span></p>}
              </div>
            )}
            {!mlx?.running && mlx?.available && (
              <p className="text-xs text-muted-foreground">Starts automatically when you use an MLX model.</p>
            )}
            {!mlx?.available && (
              <p className="text-xs text-destructive">Python + mlx-lm not found.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-8">
            {renderProcessStatus()}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">App Updates</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Keep OpenWhispr up to date with the latest features and improvements.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Version</p>
                    <p className="text-lg font-semibold text-foreground">{currentVersion || "Loading..."}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {updateStatus.isDevelopment ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning px-3 py-1 text-xs font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        Development Mode
                      </span>
                    ) : updateStatus.updateAvailable ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success px-3 py-1 text-xs font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        Update Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        Up to Date
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    try {
                      const result = await checkForUpdates();
                      if (result?.updateAvailable) {
                        showAlertDialog({
                          title: "Update Available",
                          description: `Update available: v${result.version || "new version"}`,
                        });
                      } else {
                        showAlertDialog({
                          title: "No Updates",
                          description: result?.message || "No updates available",
                        });
                      }
                    } catch (error: any) {
                      showAlertDialog({
                        title: "Update Check Failed",
                        description: `Error checking for updates: ${error.message}`,
                      });
                    }
                  }}
                  disabled={checkingForUpdates || updateStatus.isDevelopment}
                  className="w-full"
                >
                  {checkingForUpdates ? (
                    <>
                      <RefreshCw size={16} className="animate-spin mr-2" />
                      Checking for Updates...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} className="mr-2" />
                      Check for Updates
                    </>
                  )}
                </Button>

                {isUpdateAvailable && !updateStatus.updateDownloaded && (
                  <div className="space-y-2">
                    <Button
                      onClick={async () => {
                        try {
                          await downloadUpdate();
                        } catch (error: any) {
                          showAlertDialog({
                            title: "Download Failed",
                            description: `Failed to download update: ${error.message}`,
                          });
                        }
                      }}
                      disabled={downloadingUpdate}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {downloadingUpdate ? (
                        <>
                          <Download size={16} className="animate-pulse mr-2" />
                          Downloading... {Math.round(updateDownloadProgress)}%
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-2" />
                          Download Update{updateInfo?.version ? ` v${updateInfo.version}` : ""}
                        </>
                      )}
                    </Button>

                    {downloadingUpdate && (
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-accent transition-all duration-200"
                            style={{
                              width: `${Math.min(100, Math.max(0, updateDownloadProgress))}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-right">
                          {Math.round(updateDownloadProgress)}% downloaded
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {updateStatus.updateDownloaded && (
                  <Button
                    onClick={() => {
                      showConfirmDialog({
                        title: "Install Update",
                        description: `Ready to install update${updateInfo?.version ? ` v${updateInfo.version}` : ""}. The app will restart to complete installation.`,
                        confirmText: "Install & Restart",
                        onConfirm: async () => {
                          try {
                            await installUpdateAction();
                            showAlertDialog({
                              title: "Installing Update",
                              description:
                                "OpenWhispr will restart automatically to finish installing the newest version.",
                            });
                          } catch (error: any) {
                            showAlertDialog({
                              title: "Install Failed",
                              description: `Failed to install update: ${error.message}`,
                            });
                          }
                        },
                      });
                    }}
                    disabled={installInitiated}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {installInitiated ? (
                      <>
                        <RefreshCw size={16} className="animate-spin mr-2" />
                        Restarting to Finish Update...
                      </>
                    ) : (
                      <>
                        <span className="mr-2">🚀</span>
                        Quit & Install Update
                      </>
                    )}
                  </Button>
                )}

                {updateInfo?.version && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="border-b border-border px-4 py-3">
                      <h4 className="font-medium text-foreground">Update v{updateInfo.version}</h4>
                      {updateInfo.releaseDate && (
                        <p className="text-xs text-muted-foreground">
                          Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {updateInfo.releaseNotes && (
                      <div className="p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-2">What's New:</p>
                        <MarkdownRenderer content={updateInfo.releaseNotes} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Dictation Hotkey</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure the key or key combination you press to start and stop voice dictation.
                </p>
              </div>
              <HotkeyInput
                value={dictationKey}
                onChange={async (newHotkey) => {
                  await registerHotkey(newHotkey);
                }}
                disabled={isHotkeyRegistering}
              />

              <div className="mt-6">
                <label className="block text-sm font-medium text-muted-foreground mb-3">
                  Activation Mode
                </label>
                <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
              </div>
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Permissions</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Test and manage app permissions for microphone and accessibility.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={permissionsHook.requestMicPermission}
                  variant="outline"
                  className="w-full"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Test Microphone Permission
                </Button>
                <Button
                  onClick={permissionsHook.testAccessibilityPermission}
                  variant="outline"
                  className="w-full"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Test Accessibility Permission
                </Button>
                <Button
                  onClick={resetAccessibilityPermissions}
                  variant="secondary"
                  className="w-full"
                >
                  <span className="mr-2">⚙️</span>
                  Fix Permission Issues
                </Button>
                {!permissionsHook.micPermissionGranted && (
                  <MicPermissionWarning
                    error={permissionsHook.micPermissionError}
                    onOpenSoundSettings={permissionsHook.openSoundInputSettings}
                    onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
                  />
                )}
              </div>
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Microphone Input</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose which microphone to use for dictation. Enable "Prefer Built-in" to prevent
                  audio interruptions when using Bluetooth headphones.
                </p>
              </div>
              <MicrophoneSettings
                preferBuiltInMic={preferBuiltInMic}
                selectedMicDeviceId={selectedMicDeviceId}
                onPreferBuiltInChange={setPreferBuiltInMic}
                onDeviceSelect={setSelectedMicDeviceId}
              />
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">About OpenWhispr</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  OpenWhispr converts your speech to text using AI. Press your hotkey, speak, and
                  we'll type what you said wherever your cursor is.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
                <div className="text-center p-4 border border-border rounded-xl bg-card">
                  <div className="w-8 h-8 mx-auto mb-2 bg-secondary rounded-lg flex items-center justify-center">
                    <Command className="w-4 h-4 text-foreground" />
                  </div>
                  <p className="font-medium text-foreground mb-1">Default Hotkey</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {formatHotkeyLabel(dictationKey)}
                  </p>
                </div>
                <div className="text-center p-4 border border-border rounded-xl bg-card">
                  <div className="w-8 h-8 mx-auto mb-2 bg-secondary rounded-lg flex items-center justify-center">
                    <span className="text-foreground text-sm">🏷️</span>
                  </div>
                  <p className="font-medium text-foreground mb-1">Version</p>
                  <p className="text-muted-foreground text-xs">{currentVersion || "0.1.0"}</p>
                </div>
                <div className="text-center p-4 border border-border rounded-xl bg-card">
                  <div className="w-8 h-8 mx-auto mb-2 bg-success/10 rounded-lg flex items-center justify-center">
                    <span className="text-success text-sm">✓</span>
                  </div>
                  <p className="font-medium text-foreground mb-1">Status</p>
                  <p className="text-success text-xs font-medium">Active</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    showConfirmDialog({
                      title: "⚠️ DANGER: Cleanup App Data",
                      description:
                        "This will permanently delete ALL OpenWhispr data including:\n\n• Database and transcriptions\n• Local storage settings\n• Downloaded Whisper models\n• Environment files\n\nYou will need to manually remove app permissions in System Settings.\n\nThis action cannot be undone. Are you sure?",
                      onConfirm: () => {
                        window.electronAPI
                          ?.cleanupApp()
                          .then(() => {
                            showAlertDialog({
                              title: "Cleanup Completed",
                              description: "✅ Cleanup completed! All app data has been removed.",
                            });
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          })
                          .catch((error) => {
                            showAlertDialog({
                              title: "Cleanup Failed",
                              description: `❌ Cleanup failed: ${error.message}`,
                            });
                          });
                      },
                      variant: "destructive",
                    });
                  }}
                  variant="outline"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <span className="mr-2">🗑️</span>
                  Clean Up All App Data
                </Button>
              </div>

              <div className="space-y-3 mt-6 p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                <h4 className="font-medium text-foreground">Local Model Storage</h4>
                <p className="text-sm text-muted-foreground">
                  Remove all downloaded Whisper models from your cache directory to reclaim disk
                  space. You can re-download any model later.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.electronAPI?.openWhisperModelsFolder?.()}
                    className="flex-1"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Open Models Folder
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRemoveModels}
                    disabled={isRemovingModels}
                    className="flex-1"
                  >
                    {isRemovingModels ? "Removing..." : "Remove All"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current cache location: <code>{cachePathHint}</code>
                </p>
              </div>
            </div>
          </div>
        );

      case "transcription":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Speech to Text Processing
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a cloud provider for fast transcription or use local Whisper models for
                complete privacy.
              </p>
            </div>

            <TranscriptionModelPicker
              selectedCloudProvider={cloudTranscriptionProvider}
              onCloudProviderSelect={(providerId) => {
                setCloudTranscriptionProvider(providerId);
                const provider = getTranscriptionProviders().find((p) => p.id === providerId);
                if (provider) {
                  setCloudTranscriptionBaseUrl(provider.baseUrl);
                }
              }}
              selectedCloudModel={cloudTranscriptionModel}
              onCloudModelSelect={setCloudTranscriptionModel}
              selectedLocalModel={
                localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel
              }
              onLocalModelSelect={(modelId) => {
                if (modelId.startsWith("parakeet-")) {
                  setParakeetModel(modelId);
                } else {
                  setWhisperModel(modelId);
                }
              }}
              selectedLocalProvider={localTranscriptionProvider}
              onLocalProviderSelect={(providerId) => {
                setLocalTranscriptionProvider(providerId);
                updateTranscriptionSettings({ localTranscriptionProvider: providerId });
              }}
              useLocalWhisper={useLocalWhisper}
              onModeChange={(isLocal) => {
                setUseLocalWhisper(isLocal);
                updateTranscriptionSettings({ useLocalWhisper: isLocal });
              }}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              variant="settings"
            />
          </div>
        );

      case "aiModels":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI Text Enhancement</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Configure how AI models clean up and format your transcriptions. This handles
                commands like "scratch that", creates proper lists, and fixes obvious errors while
                preserving your natural tone.
              </p>
            </div>

            <ReasoningModelSelector
              useReasoningModel={useReasoningModel}
              setUseReasoningModel={(value) => {
                setUseReasoningModel(value);
                updateReasoningSettings({ useReasoningModel: value });
              }}
              setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
              cloudReasoningBaseUrl={cloudReasoningBaseUrl}
              reasoningModel={reasoningModel}
              setReasoningModel={setReasoningModel}
              localReasoningProvider={localReasoningProvider}
              setLocalReasoningProvider={setLocalReasoningProvider}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              anthropicApiKey={anthropicApiKey}
              setAnthropicApiKey={setAnthropicApiKey}
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              showAlertDialog={showAlertDialog}
            />
          </div>
        );

      case "agentConfig":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Agent Configuration</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Customize your AI assistant's name and behavior to make interactions more personal
                and effective.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-accent/5 border border-accent/20 rounded-xl">
              <h4 className="font-medium text-foreground mb-3">💡 How to use agent names:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Say "Hey {agentName}, write a formal email" for specific instructions</li>
                <li>
                  • Use "Hey {agentName}, format this as a list" for text enhancement commands
                </li>
                <li>
                  • The agent will recognize when you're addressing it directly vs. dictating
                  content
                </li>
                <li>
                  • Makes conversations feel more natural and helps distinguish commands from
                  dictation
                </li>
              </ul>
            </div>

            <div className="space-y-4 p-4 bg-card border border-border rounded-xl">
              <h4 className="font-medium text-foreground">Current Agent Name</h4>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g., Assistant, Jarvis, Alex..."
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="flex-1 text-center text-lg font-mono"
                />
                <Button
                  onClick={() => {
                    setAgentName(agentName.trim());
                    showAlertDialog({
                      title: "Agent Name Updated",
                      description: `Your agent is now named "${agentName.trim()}". You can address it by saying "Hey ${agentName.trim()}" followed by your instructions.`,
                    });
                  }}
                  disabled={!agentName.trim()}
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Choose a name that feels natural to say and remember
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="font-medium text-foreground mb-2">🎯 Example Usage:</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• "Hey {agentName}, write an email to my team about the meeting"</p>
                <p>• "Hey {agentName}, make this more professional" (after dictating text)</p>
                <p>• "Hey {agentName}, convert this to bullet points"</p>
                <p>• Regular dictation: "This is just normal text" (no agent name needed)</p>
              </div>
            </div>
          </div>
        );

      case "prompts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI Prompt Management</h3>
              <p className="text-sm text-muted-foreground mb-6">
                View and customize the prompts that power OpenWhispr's AI text processing. Adjust
                these to change how your transcriptions are formatted and enhanced.
              </p>
            </div>

            <PromptStudio />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {renderSectionContent()}
    </>
  );
}
