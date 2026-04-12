import React from "react";
import { Cloud, Lock } from "lucide-react";

interface ProcessingModeSelectorProps {
  useLocalWhisper: boolean;
  setUseLocalWhisper: (value: boolean) => void;
  className?: string;
}

export default function ProcessingModeSelector({
  useLocalWhisper,
  setUseLocalWhisper,
  className = "",
}: ProcessingModeSelectorProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`}>
      <button
        onClick={() => setUseLocalWhisper(false)}
        className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
          !useLocalWhisper
            ? "border-accent bg-accent/10"
            : "border-neutral-200 bg-card hover:border-neutral-300"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Cloud className="w-6 h-6 text-accent" />
            <h4 className="font-medium text-neutral-900">Cloud Processing</h4>
          </div>
          <span className="text-xs text-success bg-success/10 px-2 py-1 rounded-full">
            Fastest
          </span>
        </div>
        <p className="text-sm text-neutral-600">
          Audio sent to OpenAI servers. Faster processing, requires API key.
        </p>
      </button>

      <button
        onClick={() => setUseLocalWhisper(true)}
        className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
          useLocalWhisper
            ? "border-accent bg-accent/10"
            : "border-neutral-200 bg-card hover:border-neutral-300"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-accent" />
            <h4 className="font-medium text-neutral-900">Local Processing</h4>
          </div>
          <span className="text-xs text-accent bg-accent/10 px-2 py-1 rounded-full">Private</span>
        </div>
        <p className="text-sm text-neutral-600">
          Audio stays on your device. Complete privacy, works offline.
        </p>
      </button>
    </div>
  );
}
