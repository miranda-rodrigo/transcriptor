"use client"

import { useState } from "react"
import { Activity, RefreshCw, Download, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ProcessStatus {
  name: string
  status: "running" | "stopped" | "idle"
  description: string
  model?: string
  port?: number
}

const processes: ProcessStatus[] = [
  { name: "Whisper Server", status: "stopped", description: "No active transcription server." },
  { name: "Llama (GGUF)", status: "idle", description: "No active inference process." },
  { name: "MLX Server", status: "running", description: "Local inference active", model: "Llama-3.2-1B-Instruct-4bit", port: 8182 },
]

const releaseNotes = [
  {
    title: "AI Chat & Semantic Search",
    description: "Ask questions about your notes with the new embedded chat panel. Conversations sync to the cloud, and a local semantic search engine finds notes by meaning, not just keywords."
  },
  {
    title: "Meeting Improvements",
    description: "Calendar attendees automatically appear on meeting notes, auto-detection works for browser meetings, and echo cancellation cleans up mic input."
  },
  {
    title: "Save Notes as Files",
    description: "Export your notes to local Markdown files that mirror your folder structure."
  }
]

export function GeneralSettings() {
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckUpdates = () => {
    setIsChecking(true)
    setTimeout(() => setIsChecking(false), 2000)
  }

  return (
    <div className="space-y-8">
      {/* Process Status */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Process Status</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Live status of background processes running on your system.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {processes.map((process) => (
            <div
              key={process.name}
              className={cn(
                "rounded-xl border p-4 transition-all",
                process.status === "running"
                  ? "border-success/50 bg-success/5"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground text-sm">{process.name}</h3>
                <StatusBadge status={process.status} />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{process.description}</p>
              {process.model && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Model: <span className="text-foreground">{process.model}</span></p>
                  <p>Port: <span className="text-foreground">{process.port}</span></p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* App Updates */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">App Updates</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Keep OpenWhispr up to date with the latest features and improvements.
        </p>

        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Version</p>
              <p className="text-lg font-semibold text-foreground">1.2.13</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success px-3 py-1 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Update Available
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleCheckUpdates}
            disabled={isChecking}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isChecking && "animate-spin")} />
            Check for Updates
          </Button>
          <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
            <Download className="h-4 w-4 mr-2" />
            Download Update v1.6.7
          </Button>
        </div>

        {/* Release Notes */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Update v1.6.7</h3>
              <p className="text-xs text-muted-foreground">Released: April 2, 2026</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Full Changelog
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <h4 className="text-sm font-medium text-foreground">{"What's New:"}</h4>
            <div className="space-y-3">
              {releaseNotes.map((note, index) => (
                <div key={index} className="flex gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                    <p className="text-sm text-muted-foreground">{note.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: ProcessStatus["status"] }) {
  const config = {
    running: { label: "Running", className: "bg-success/10 text-success border-success/20" },
    stopped: { label: "Stopped", className: "bg-muted text-muted-foreground border-border" },
    idle: { label: "Idle", className: "bg-warning/10 text-warning border-warning/20" },
  }

  const { label, className } = config[status]

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border",
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "running" && "bg-success animate-pulse",
        status === "stopped" && "bg-muted-foreground",
        status === "idle" && "bg-warning"
      )} />
      {label}
    </span>
  )
}
