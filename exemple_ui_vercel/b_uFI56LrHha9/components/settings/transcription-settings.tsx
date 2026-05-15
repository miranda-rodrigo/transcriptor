"use client"

import { useState } from "react"
import { Cloud, HardDrive, Download, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

type ProcessingMode = "cloud" | "local"
type Provider = "openai" | "nvidia"

interface WhisperModel {
  name: string
  size: string
  description: string
  downloaded?: boolean
  selected?: boolean
  recommended?: boolean
}

const whisperModels: WhisperModel[] = [
  { name: "Tiny", size: "39MB", description: "Fastest, lower quality" },
  { name: "Base", size: "74MB", description: "Good balance", recommended: true },
  { name: "Small", size: "244MB", description: "Better quality, slower" },
  { name: "Medium", size: "1463MB", description: "High quality", downloaded: true, selected: true },
  { name: "Large", size: "2.9GB", description: "Best quality, slowest" },
]

export function TranscriptionSettings() {
  const [mode, setMode] = useState<ProcessingMode>("local")
  const [provider, setProvider] = useState<Provider>("openai")

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Speech to Text Processing</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose a cloud provider for fast transcription or use local Whisper models for complete privacy.
        </p>

        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <ModeCard
            icon={Cloud}
            title="Cloud"
            badge="Fast"
            description="Transcription via API. Fast and accurate, requires internet."
            selected={mode === "cloud"}
            onClick={() => setMode("cloud")}
          />
          <ModeCard
            icon={HardDrive}
            title="Local"
            badge="Private"
            description="Runs on your device. Complete privacy, works offline."
            selected={mode === "local"}
            onClick={() => setMode("local")}
          />
        </div>

        {mode === "cloud" ? (
          <CloudSettings provider={provider} onProviderChange={setProvider} />
        ) : (
          <LocalSettings />
        )}
      </section>
    </div>
  )
}

function ModeCard({
  icon: Icon,
  title,
  badge,
  description,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  badge: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-card hover:border-muted-foreground/50"
      )}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-foreground" />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          selected ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
        )}>
          {badge}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  )
}

function CloudSettings({
  provider,
  onProviderChange,
}: {
  provider: Provider
  onProviderChange: (provider: Provider) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Tabs value={provider} onValueChange={(v) => onProviderChange(v as Provider)}>
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="openai"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-6 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-secondary flex items-center justify-center text-xs font-bold text-foreground">O</div>
              OpenAI Whisper
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="nvidia"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-6 py-3"
            disabled
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-secondary flex items-center justify-center text-xs font-bold text-foreground">N</div>
              Nvidia
              <span className="text-xs text-muted-foreground">Coming Soon</span>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="openai" className="p-4 mt-0">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Your API key is stored locally and never sent to our servers.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LocalSettings() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium text-foreground">Available Models</h3>
      </div>
      <div className="p-4 space-y-3">
        {whisperModels.map((model) => (
          <div
            key={model.name}
            className={cn(
              "flex items-center justify-between rounded-lg border p-4 transition-all",
              model.selected
                ? "border-accent/50 bg-accent/5"
                : "border-border bg-card hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">W</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{model.name}</span>
                  {model.recommended && (
                    <span className="rounded-full bg-accent/10 text-accent px-2 py-0.5 text-xs font-medium">
                      Recommended
                    </span>
                  )}
                  {model.selected && (
                    <span className="rounded-full bg-success/10 text-success px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {model.description} · {model.size}
                  {model.downloaded && (
                    <span className="text-success ml-2">
                      <Check className="h-3 w-3 inline mr-1" />
                      Downloaded
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div>
              {model.downloaded ? (
                <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              ) : (
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
