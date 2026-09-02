import { useCallback, useEffect, useState } from "react";
import type { ThemeSource } from "../types/electron";

const THEME_SOURCES: ThemeSource[] = ["light", "dark", "system"];

function isThemeSource(value: unknown): value is ThemeSource {
  return typeof value === "string" && (THEME_SOURCES as string[]).includes(value);
}

/**
 * The main process owns the theme (nativeTheme.themeSource); this hook mirrors
 * it so the UI can show the current choice and request a change.
 */
export function useTheme() {
  const [themeSource, setThemeSourceState] = useState<ThemeSource>("system");

  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      ?.getThemeSource?.()
      .then((source) => {
        if (!cancelled && isThemeSource(source)) {
          setThemeSourceState(source);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeSource = useCallback(
    async (source: ThemeSource) => {
      const previous = themeSource;
      setThemeSourceState(source);
      try {
        const result = await window.electronAPI?.setThemeSource?.(source);
        if (result && result.success === false) {
          setThemeSourceState(previous);
        }
      } catch {
        setThemeSourceState(previous);
      }
    },
    [themeSource]
  );

  return { themeSource, setThemeSource };
}
