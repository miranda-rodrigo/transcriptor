"use client"

import { useState } from "react"
import { Cloud, HardDrive, Zap } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

type AIMode = "cloud" | "local"
type CloudProvider = "openai" | "anthropic" | "gemini" | "groq" | "custom"

interface AIModel {
  id: string
  name: string
  description: string
  provider: CloudProvider
}

const groqModels: AIModel[] = [
  { id: "qwen3-32b", name: "Qwen3 32B", description: "Powerful reasoning model, 131K context", provider: "groq" },
  { id: "gpt-oss-120b", name: "GPT-OSS 120B", description: "OpenAI's open-source flagship, 500 T/sec", provider: "groq" },
  { id: "gpt-oss-20b", name: "GPT-OSS 20B", description: "Fast open-source model, 1000 T/sec", provider: "groq" },
  { id: "llama-3.1-70b", name: "Llama 3.1 70B", description: "Meta's flagship model, versatile", provider: "groq" },
]

export function AIModelsSettings() {
  const [enhanced, setEnhanced] = useState(true)
  const [mode, setMode] = useState<AIMode>("cloud")
  const [provider, setProvider] = useState<CloudProvider>("groq")
  const [selectedModel, setSelectedModel] = useState("qwen3-32b")

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">AI Text Enhancement</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configure how AI models clean up and format your transcriptions. This handles commands like
          &quot;scratch that&quot;, creates proper lists, and fixes obvious errors while preserving your natural tone.
        </p>

        {/* Enable Toggle */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable AI Text Enhancement</p>
              <p className="text-sm text-muted-foreground">
                Use AI to automatically improve transcription quality
              </p>
            </div>
            <Switch checked={enhanced} onCheckedChange={setEnhanced} />
          </div>
        </div>

        {enhanced && (
          <>
            {/* Mode Selection */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <ModeCard
                icon={Cloud}
                title="Cloud AI"
                badge="Powerful"
                description="Advanced models via API. Fast and capable, requires internet."
                selected={mode === "cloud"}
                onClick={() => setMode("cloud")}
              />
              <ModeCard
                icon={HardDrive}
                title="Local AI"
                badge="Private"
                description="Runs on your device. Complete privacy, works offline."
                selected={mode === "local"}
                onClick={() => setMode("local")}
              />
            </div>

            {mode === "cloud" && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Tabs value={provider} onValueChange={(v) => setProvider(v as CloudProvider)}>
                  <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto flex-wrap">
                    <ProviderTab value="openai" label="OpenAI" icon="O" />
                    <ProviderTab value="anthropic" label="Anthropic" icon="A" />
                    <ProviderTab value="gemini" label="Google Gemini" icon="G" />
                    <ProviderTab value="groq" label="Groq" icon="G" active />
                    <ProviderTab value="custom" label="Custom" icon="C" />
                  </TabsList>

                  <TabsContent value="groq" className="p-4 mt-0">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Select Model</label>
                        <div className="space-y-3">
                          {groqModels.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => setSelectedModel(model.id)}
                              className={cn(
                                "flex items-center gap-3 w-full rounded-lg border p-4 text-left transition-all",
                                selectedModel === model.id
                                  ? "border-accent bg-accent/5"
                                  : "border-border bg-card hover:border-muted-foreground/30"
                              )}
                            >
                              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                <Zap className="h-4 w-4 text-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{model.name}</p>
                                <p className="text-sm text-muted-foreground">{model.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {["openai", "anthropic", "gemini", "custom"].map((p) => (
                    <TabsContent key={p} value={p} className="p-4 mt-0">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">API Key</label>
                          <input
                            type="password"
                            placeholder="Enter your API key..."
                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Your API key is stored locally and never sent to our servers.
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            {mode === "local" && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
                    <HardDrive className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">Local AI Models</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Download and run AI models locally for complete privacy. Supports GGUF format models via llama.cpp.
                  </p>
                </div>
              </div>
            )}
          </>
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

function ProviderTab({
  value,
  label,
  icon,
  active = false,
}: {
  value: string
  label: string
  icon: string
  active?: boolean
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-4 py-3",
        active && "data-[state=active]:text-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
          {icon}
        </div>
        <span>{label}</span>
      </div>
    </TabsTrigger>
  )
}
