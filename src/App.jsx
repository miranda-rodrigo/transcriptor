import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { X } from "lucide-react";
import { useToast } from "./components/ui/Toast";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { useDestinationContext } from "./hooks/useDestinationContext";
import { isBuiltInMicrophone } from "./utils/audioDeviceUtils";

const STYLE_LABELS = {
  auto: "auto",
  formal: "formal",
  casual: "casual",
  "very-casual": "casual+",
  code: "code",
};

function Waveform({ active, accent }) {
  return (
    <div className="flex h-5 items-end justify-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="w-[3px] rounded-full"
          style={{
            backgroundColor: accent,
            height: active ? undefined : 6,
            animation: active ? `ow-wave 0.9s ease-in-out ${index * 0.08}s infinite` : "none",
            opacity: active ? 1 : 0.45,
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

  const { isRecording, isProcessing, transcript, toggleListening, cancelRecording } =
    useAudioRecording(toast, {
      onToggle: handleDictationToggle,
    });

  const { activeApp, accent, destinationLabel, resolvedStyle } = useDestinationContext({
    isRecording,
    isProcessing,
  });

  useEffect(() => {
    if (!transcript || isRecording || isProcessing) {
      return undefined;
    }
    setShowResult(true);
    const timer = setTimeout(() => setShowResult(false), 2800);
    return () => clearTimeout(timer);
  }, [transcript, isRecording, isProcessing]);

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
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isCommandMenuOpen]);

  const expanded = isHovered || isRecording || isProcessing || isCommandMenuOpen || showResult;
  const statusLabel = isRecording
    ? "Listening"
    : isProcessing
      ? "Shaping"
      : showResult
        ? "Pasted"
        : `Hold [${hotkey}]`;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div
        className="relative flex items-end justify-end"
        onMouseEnter={() => {
          setIsHovered(true);
          setWindowInteractivity(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isCommandMenuOpen) {
            setWindowInteractivity(false);
          }
        }}
      >
        {isRecording && (
          <button
            aria-label="Cancel recording"
            onClick={(e) => {
              e.stopPropagation();
              cancelRecording();
            }}
            className="absolute -left-9 bottom-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 backdrop-blur-md transition hover:border-red-400 hover:bg-red-500 hover:text-white"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}

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
          className="group relative flex items-center overflow-hidden rounded-full border border-white/15 text-left shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
          style={{
            width: expanded ? 308 : 52,
            height: 52,
            paddingLeft: expanded ? 14 : 0,
            paddingRight: expanded ? 8 : 0,
            justifyContent: expanded ? "flex-start" : "center",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(8,8,8,0.55) 40%, rgba(0,0,0,0.72))",
            boxShadow: `0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06), 0 0 28px ${accent}33`,
            cursor: isProcessing ? "wait" : isDragging ? "grabbing" : "pointer",
            transition:
              "width 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, background 0.2s ease",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 20% 0%, ${accent}33, transparent 55%)`,
              opacity: isRecording || isProcessing ? 1 : 0.55,
            }}
          />

          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${accent}22`,
              boxShadow: isRecording ? `0 0 0 1px ${accent}88 inset` : "none",
            }}
          >
            <Waveform active={isRecording || isProcessing} accent={accent} />
          </div>

          <div
            className="relative ml-3 min-w-0 flex-1 pr-2"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(8px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium tracking-tight text-white">{statusLabel}</span>
              <span
                className="rounded-full px-1.5 py-px text-[10px] uppercase tracking-[0.14em]"
                style={{ color: accent, backgroundColor: `${accent}22` }}
              >
                {STYLE_LABELS[resolvedStyle] || resolvedStyle}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-white/55">
              {showResult && transcript
                ? transcript
                : activeApp
                  ? `into ${destinationLabel}`
                  : "Any text field"}
            </p>
          </div>
        </button>

        {isCommandMenuOpen && (
          <div
            ref={commandMenuRef}
            className="absolute bottom-full right-0 mb-3 w-52 overflow-hidden rounded-2xl border border-white/10 bg-black/70 text-white shadow-2xl backdrop-blur-xl"
          >
            <button
              className="w-full px-3.5 py-2.5 text-left text-sm font-medium hover:bg-white/8"
              onClick={() => toggleListening()}
            >
              {isRecording ? "Stop listening" : "Start listening"}
            </button>
            <div className="h-px bg-white/10" />
            <button
              className="w-full px-3.5 py-2.5 text-left text-sm text-white/70 hover:bg-white/8"
              onClick={() => {
                setIsCommandMenuOpen(false);
                setWindowInteractivity(false);
                handleClose();
              }}
            >
              Hide this for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
