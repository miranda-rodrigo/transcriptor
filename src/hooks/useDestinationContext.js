import { useCallback, useEffect, useState } from "react";
import * as flowEngine from "../utils/flowEngine";

const engine = flowEngine;

function readStyleSettings() {
  const style = localStorage.getItem("writingStyle") || "auto";
  let appStyles = {};
  try {
    const raw = localStorage.getItem("appWritingStyles");
    appStyles = raw ? JSON.parse(raw) : {};
  } catch {
    appStyles = {};
  }
  return { style, appStyles };
}

export function useDestinationContext({ isRecording, isProcessing }) {
  const [activeApp, setActiveApp] = useState(null);
  const [style, setStyle] = useState("auto");
  const [appStyles, setAppStyles] = useState({});

  const refresh = useCallback(async () => {
    const settings = readStyleSettings();
    setStyle(settings.style);
    setAppStyles(settings.appStyles);

    try {
      const name = (await window.electronAPI?.getActiveApp?.()) || null;
      setActiveApp(name);
    } catch {
      setActiveApp(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (isRecording || isProcessing) {
      void refresh();
    }
  }, [isRecording, isProcessing, refresh]);

  useEffect(() => {
    const onStorage = () => {
      const settings = readStyleSettings();
      setStyle(settings.style);
      setAppStyles(settings.appStyles);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("openwhispr-localstorage-updated", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("openwhispr-localstorage-updated", onStorage);
    };
  }, []);

  const theme = engine.getDestinationTheme(activeApp);
  const resolvedStyle = engine.resolveWritingStyle(style, activeApp, appStyles);

  return {
    activeApp,
    category: theme.category,
    accent: theme.accent,
    destinationLabel: activeApp || theme.label,
    resolvedStyle,
    refresh,
  };
}
