import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { X } from "lucide-react";
import { useToast } from "./components/ui/Toast";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { useDestinationContext } from "./hooks/useDestinationContext";
import { isBuiltInMicrophone } from "./utils/audioDeviceUtils";

function Waveform({ active, accent, levels = [] }) {
  const bars = levels.length === 5 ? levels : [0.18, 0.32, 0.5, 0.32, 0.18];
  return (
    <div className="flex h-3.5 items-end justify-center gap-[2px]">
      {bars.map((level, index) => (
        <span
          key={index}
          className="w-[2px] rounded-full"
          style={{
            backgroundColor: accent,
            height: active ? Math.max(3, Math.round(4 + level * 10)) : 4,
            opacity: active ? 0.5 + level * 0.5 : 0.4,
            transition: "height 80ms linear, opacity 80ms linear",
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const { toast } = useToast();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } = useWindowDrag();
  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const setWindowInteractivity = React.useCallback((shouldCapture) => {
    window.electronAPI?.setMainWindowInteractivity?.(shouldCapture);
  }, []);

  useEffect(() => {
    setWindowInteractivity(false);
    return () => setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  useEffect(() => {
    const unsubscribeFallback = window.electronAPI?.onHotkeyFallbackUsed?.((data) => {
      toast({
        title: "Hotkey Changed",
        description: data.message,
        duration: 8000,
      });
    });

    const unsubscribeFailed = window.electronAPI?.onHotkeyRegistrationFailed?.((data) => {
      toast({
        title: "Hotkey Unavailable",
        description: `Could not register hotkey. Please set a different hotkey in Settings.`,
        duration: 10000,
      });
    });

    return () => {
      unsubscribeFallback?.();
      unsubscribeFailed?.();
    };
  }, [toast]);

  useEffect(() => {
    const syncTrayMicSettings = () => {
      const preferBuiltInMic = localStorage.getItem("preferBuiltInMic") !== "false";
      const selectedMicDeviceId = localStorage.getItem("selectedMicDeviceId") || "";
      window.electronAPI?.trayUpdateMicSettings?.({
        preferBuiltInMic,
        selectedMicDeviceId,
      });
    };

    const syncTrayAudioDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter((d) => d.kind === "audioinput")
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${index + 1}`,
            isBuiltIn: isBuiltInMicrophone(d.label || ""),
          }));
        window.electronAPI?.trayUpdateAudioDevices?.(audioInputs);
      } catch {}
    };

    const handleDeviceChange = () => {
      void syncTrayAudioDevices();
    };

    const handleLocalStorageUpdate = () => {
      syncTrayMicSettings();
    };

    syncTrayMicSettings();
    void syncTrayAudioDevices();

    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
    window.addEventListener("storage", handleLocalStorageUpdate);
    window.addEventListener("openwhispr-localstorage-updated", handleLocalStorageUpdate);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      window.removeEventListener("storage", handleLocalStorageUpdate);
      window.removeEventListener("openwhispr-localstorage-updated", handleLocalStorageUpdate);
    };
  }, []);

  useEffect(() => {
    if (isCommandMenuOpen) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, setWindowInteractivity]);

  const handleDictationToggle = React.useCallback(() => {
    setIsCommandMenuOpen(false);
    setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  const {
    isRecording,
    isProcessing,
    transcript,
    levels,
    suggestions,
    rewritten,
    toggleListening,
    cancelRecording,
    dismissSuggestions,
  } = useAudioRecording(toast, {
    onToggle: handleDictationToggle,
  });

  const { accent } = useDestinationContext({
    isRecording,
    isProcessing,
  });

  const correction = suggestions[0] || null;

  useEffect(() => {
    if (correction) {
      setWindowInteractivity(true);
    }
  }, [correction, setWindowInteractivity]);

  useEffect(() => {
    if (!transcript || isRecording || isProcessing) {
      return undefined;
    }
    setShowResult(true);
    const timer = setTimeout(() => setShowResult(false), correction ? 8000 : 2200);
    return () => clearTimeout(timer);
  }, [transcript, isRecording, isProcessing, correction]);

  const needsPopover = isCommandMenuOpen || Boolean(correction);
  useEffect(() => {
    window.electronAPI?.setOverlayLayout?.(needsPopover ? "popover" : "bar");
  }, [needsPopover]);

  const handleLearnSpelling = async (event) => {
    event.stopPropagation();
    if (!correction) return;
    await window.electronAPI.saveDictionaryEntry?.({
      word: correction.word,
      replacement: correction.replacement,
      starred: true,
    });
    dismissSuggestions();
    setShowResult(false);
  };

  const handleDismissCorrection = (event) => {
    event.stopPropagation();
    dismissSuggestions();
  };

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  useEffect(() => {
    if (!isCommandMenuOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCommandMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCommandMenuOpen]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (isCommandMenuOpen) {
          setIsCommandMenuOpen(false);
        } else if (correction) {
          dismissSuggestions();
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isCommandMenuOpen, correction, dismissSuggestions]);

  const active = isHovered || isRecording || isProcessing || isCommandMenuOpen || showResult;
  const statusLabel = isRecording
    ? "Listening"
    : isProcessing
      ? "Shaping"
      : rewritten && showResult
        ? "Rewrote"
        : showResult
          ? "Pasted"
          : hotkey
            ? hotkey
            : "Ready";

  return (
    <div className="relative flex h-screen w-screen items-end justify-end p-1">
      <div
        className="relative flex items-end justify-end"
        onMouseEnter={() => {
          setIsHovered(true);
          setWindowInteractivity(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isCommandMenuOpen && !correction) {
            setWindowInteractivity(false);
          }
        }}
      >
        {correction && !isRecording && !isProcessing && (
          <div className="absolute bottom-9 right-0 mb-1 w-[248px] rounded-xl border border-white/12 bg-black/80 p-2.5 text-white shadow-xl backdrop-blur-xl">
            <p className="truncate text-[11px]">
              <span className="text-white/50">{correction.word}</span>
              <span className="mx-1 text-white/30">→</span>
              <span className="font-medium">{correction.replacement}</span>
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-black"
                onClick={handleLearnSpelling}
              >
                Save
              </button>
              <button
                className="rounded-full px-2.5 py-0.5 text-[10px] text-white/60 hover:text-white"
                onClick={handleDismissCorrection}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {isCommandMenuOpen && (
          <div
            ref={commandMenuRef}
            className="absolute bottom-9 right-0 mb-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-black/80 text-white shadow-xl backdrop-blur-xl"
          >
            <button
              className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-white/8"
              onClick={() => toggleListening()}
            >
              {isRecording ? "Stop listening" : "Start listening"}
            </button>
            <div className="h-px bg-white/10" />
            <button
              className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/8"
              onClick={() => {
                setIsCommandMenuOpen(false);
                setWindowInteractivity(false);
                handleClose();
              }}
            >
              Hide
            </button>
          </div>
        )}

        <div className="flex items-center">
          <button
            ref={buttonRef}
            aria-label={statusLabel}
            onMouseDown={(e) => {
              setIsCommandMenuOpen(false);
              setDragStartPos({ x: e.clientX, y: e.clientY });
              setHasDragged(false);
              handleMouseDown(e);
            }}
            onMouseMove={(e) => {
              if (dragStartPos && !hasDragged) {
                const distance = Math.sqrt(
                  Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2)
                );
                if (distance > 5) {
                  setHasDragged(true);
                }
              }
            }}
            onMouseUp={(e) => {
              handleMouseUp(e);
              setDragStartPos(null);
            }}
            onClick={(e) => {
              if (!hasDragged && !isProcessing) {
                setIsCommandMenuOpen(false);
                toggleListening();
              }
              e.preventDefault();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!hasDragged) {
                setWindowInteractivity(true);
                setIsCommandMenuOpen((prev) => !prev);
              }
            }}
            className="group relative flex h-7 items-center overflow-hidden rounded-full border border-white/10 text-left backdrop-blur-xl"
            style={{
              width: isRecording ? 176 : active ? 152 : 72,
              paddingLeft: 7,
              paddingRight: isRecording ? 4 : 8,
              justifyContent: "flex-start",
              background: "rgba(8, 8, 8, 0.42)",
              boxShadow: active
                ? `0 8px 24px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.05), 0 0 14px ${accent}22`
                : "0 6px 16px rgba(0,0,0,0.18)",
              opacity: active ? 0.96 : 0.38,
              cursor: isProcessing ? "wait" : isDragging ? "grabbing" : "pointer",
              transition:
                "width 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <div
              className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}22` }}
            >
              <Waveform active={isRecording || isProcessing} accent={accent} levels={levels} />
            </div>

            <span
              className="relative ml-1.5 min-w-0 truncate text-[10px] font-medium tracking-tight text-white/85"
              style={{
                opacity: active ? 1 : 0,
                maxWidth: active ? 96 : 0,
                transition: "opacity 0.18s ease, max-width 0.22s ease",
              }}
            >
              {showResult && transcript ? transcript : statusLabel}
            </span>
            {isRecording && (
              <span
                role="button"
                aria-label="Cancel recording"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelRecording();
                }}
                className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/55 hover:bg-red-500 hover:text-white"
              >
                <X size={9} strokeWidth={2.5} />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
