import { useState, useCallback, useEffect } from "react";
import type { PasteToolsResult } from "../types/electron";

export interface UsePermissionsReturn {
  // State
  micPermissionGranted: boolean;
  accessibilityPermissionGranted: boolean;
  micPermissionError: string | null;
  pasteToolsInfo: PasteToolsResult | null;
  isCheckingPasteTools: boolean;

  requestMicPermission: () => Promise<void>;
  testAccessibilityPermission: () => Promise<void>;
  checkPasteToolsAvailability: () => Promise<PasteToolsResult | null>;
  openMicPrivacySettings: () => Promise<void>;
  openSoundInputSettings: () => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  setMicPermissionGranted: (granted: boolean) => void;
  setAccessibilityPermissionGranted: (granted: boolean) => void;
}

export interface UsePermissionsProps {
  showAlertDialog: (dialog: { title: string; description?: string }) => void;
}

const stopTracks = (stream?: MediaStream) => {
  try {
    stream?.getTracks?.().forEach((track) => track.stop());
  } catch {
    // ignore track cleanup errors
  }
};

const getPlatformSettingsPath = (): string => "System Settings → Sound → Input";

const getPlatformPrivacyPath = (): string =>
  "System Settings → Privacy & Security → Microphone";

const describeMicError = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return "Microphone access failed. Please try again.";
  }

  const err = error as { name?: string; message?: string };
  const name = err.name || "";
  const message = (err.message || "").toLowerCase();
  const settingsPath = getPlatformSettingsPath();
  const privacyPath = getPlatformPrivacyPath();

  if (name === "NotFoundError") {
    return `No microphones were detected. Connect or select a microphone in ${settingsPath}.`;
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return `Permission was denied. Open ${privacyPath} and allow OpenWhispr.`;
  }

  if (name === "NotReadableError" || name === "AbortError") {
    return `Could not start the selected microphone. Choose an input device in ${settingsPath}, then rerun the test.`;
  }

  if (message.includes("no audio input") || message.includes("not available")) {
    return `No active audio input was found. Pick a microphone in ${settingsPath}.`;
  }

  return `Microphone access failed: ${err.message || "Unknown error"}. Select a different input device and try again.`;
};

export const usePermissions = (
  showAlertDialog?: UsePermissionsProps["showAlertDialog"]
): UsePermissionsReturn => {
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [accessibilityPermissionGranted, setAccessibilityPermissionGranted] = useState(false);
  const [pasteToolsInfo, setPasteToolsInfo] = useState<PasteToolsResult | null>(null);
  const [isCheckingPasteTools, setIsCheckingPasteTools] = useState(false);

  const openSystemSettings = useCallback(
    async (
      settingType: "microphone" | "sound" | "accessibility",
      apiMethod: () => Promise<{ success: boolean; error?: string } | undefined> | undefined
    ) => {
      const titles = {
        microphone: "Microphone Settings",
        sound: "Sound Settings",
        accessibility: "Accessibility Settings",
      };
      try {
        const result = await apiMethod?.();
        if (result && !result.success && result.error) {
          showAlertDialog?.({ title: titles[settingType], description: result.error });
        }
      } catch (error) {
        console.error(`Failed to open ${settingType} settings:`, error);
        showAlertDialog?.({
          title: titles[settingType],
          description: `Unable to open ${settingType} settings. Please open your system settings manually.`,
        });
      }
    },
    [showAlertDialog]
  );

  const openMicPrivacySettings = useCallback(
    () => openSystemSettings("microphone", window.electronAPI?.openMicrophoneSettings),
    [openSystemSettings]
  );

  const openSoundInputSettings = useCallback(
    () => openSystemSettings("sound", window.electronAPI?.openSoundInputSettings),
    [openSystemSettings]
  );

  const openAccessibilitySettings = useCallback(
    () => openSystemSettings("accessibility", window.electronAPI?.openAccessibilitySettings),
    [openSystemSettings]
  );

  const requestMicPermission = useCallback(async () => {
    if (!navigator?.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      const message =
        "Microphone APIs are unavailable in this environment. Please restart the app.";
      setMicPermissionError(message);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Microphone Unavailable",
          description: message,
        });
      } else {
        alert(message);
      }
      return;
    }

    setMicPermissionError(null);

    try {
      if (window.electronAPI?.requestMediaAccess) {
        const result = await window.electronAPI.requestMediaAccess("microphone");
        if (result && result.granted === false && result.status !== "unknown") {
          const privacyPath = getPlatformPrivacyPath();
          const message = `Permission was denied. Open ${privacyPath} and allow OpenWhispr.`;
          setMicPermissionError(message);
          if (showAlertDialog) {
            showAlertDialog({
              title: "Microphone Permission Required",
              description: message,
            });
          } else {
            alert(message);
          }
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stopTracks(stream);
      setMicPermissionGranted(true);
      setMicPermissionError(null);
    } catch (err) {
      console.error("Microphone permission denied:", err);
      const message = describeMicError(err);
      setMicPermissionError(message);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Microphone Permission Required",
          description: message,
        });
      } else {
        alert(message);
      }
    }
  }, [showAlertDialog]);

  const checkPasteToolsAvailability = useCallback(async (): Promise<PasteToolsResult | null> => {
    setIsCheckingPasteTools(true);
    try {
      if (window.electronAPI?.checkPasteTools) {
        const result = await window.electronAPI.checkPasteTools();
        setPasteToolsInfo(result);

        return result;
      }
      return null;
    } catch (error) {
      console.error("Failed to check paste tools:", error);
      return null;
    } finally {
      setIsCheckingPasteTools(false);
    }
  }, []);

  // Check paste tools and native permission status on mount
  useEffect(() => {
    checkPasteToolsAvailability();

    const hydrateNativePermissions = async () => {
      try {
        if (window.electronAPI?.getMediaAccessStatus) {
          const media = await window.electronAPI.getMediaAccessStatus("microphone");
          if (media?.status === "granted") {
            setMicPermissionGranted(true);
          }
        }
        if (window.electronAPI?.checkAccessibilityTrusted) {
          const accessibility = await window.electronAPI.checkAccessibilityTrusted(false);
          if (accessibility?.trusted) {
            setAccessibilityPermissionGranted(true);
          }
        }
      } catch (error) {
        console.error("Failed to hydrate native permissions:", error);
      }
    };

    void hydrateNativePermissions();
  }, [checkPasteToolsAvailability]);

  const testAccessibilityPermission = useCallback(async () => {
    try {
      const result = await window.electronAPI?.checkAccessibilityTrusted?.(true);
      if (result?.trusted) {
        setAccessibilityPermissionGranted(true);
        return;
      }
      if (showAlertDialog) {
        showAlertDialog({
          title: "Accessibility Permissions Needed",
          description:
            "Please grant accessibility permissions in System Settings to enable automatic text pasting.",
        });
      } else {
        alert("Accessibility permissions needed! Please grant them in System Settings.");
      }
      await openAccessibilitySettings();
    } catch (err) {
      console.error("Accessibility permission test failed:", err);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Accessibility Permissions Needed",
          description:
            "Please grant accessibility permissions in System Settings to enable automatic text pasting.",
        });
      } else {
        alert("Accessibility permissions needed! Please grant them in System Settings.");
      }
    }
  }, [showAlertDialog, openAccessibilitySettings]);

  return {
    micPermissionGranted,
    accessibilityPermissionGranted,
    micPermissionError,
    pasteToolsInfo,
    isCheckingPasteTools,
    requestMicPermission,
    testAccessibilityPermission,
    checkPasteToolsAvailability,
    openMicPrivacySettings,
    openSoundInputSettings,
    openAccessibilitySettings,
    setMicPermissionGranted,
    setAccessibilityPermissionGranted,
  };
};
