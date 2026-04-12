import { useState, useCallback, useEffect } from "react";

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
) {
  const serialize = options?.serialize || JSON.stringify;
  const deserialize = options?.deserialize || JSON.parse;

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return deserialize(item);
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prevState: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(state) : value;
        setState(valueToStore);
        const serializedValue = serialize(valueToStore);
        localStorage.setItem(key, serializedValue);
        window.dispatchEvent(
          new CustomEvent("openwhispr-localstorage-updated", {
            detail: { key, value: serializedValue },
          })
        );
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serialize]
  );

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setState(defaultValue);
      window.dispatchEvent(
        new CustomEvent("openwhispr-localstorage-updated", {
          detail: { key, value: null },
        })
      );
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      try {
        if (event.newValue === null) {
          setState(defaultValue);
          return;
        }
        setState(deserialize(event.newValue));
      } catch {}
    };

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string; value?: string | null }>;
      if (customEvent.detail?.key !== key) return;
      try {
        if (customEvent.detail?.value == null) {
          setState(defaultValue);
          return;
        }
        setState(deserialize(customEvent.detail.value));
      } catch {}
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("openwhispr-localstorage-updated", handleCustomUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "openwhispr-localstorage-updated",
        handleCustomUpdate as EventListener
      );
    };
  }, [key, defaultValue, deserialize]);

  return [state, setValue, remove] as const;
}
