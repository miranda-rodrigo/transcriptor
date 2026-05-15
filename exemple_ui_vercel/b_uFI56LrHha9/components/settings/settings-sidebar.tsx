"use client"

import { cn } from "@/lib/utils"
import { Settings, Mic, Brain, Bot, Sparkles } from "lucide-react"
import type { SettingsSection } from "@/app/page"

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

const navItems: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "transcription", label: "Transcription Mode", icon: Mic },
  { id: "ai-models", label: "AI Models", icon: Brain },
  { id: "agent", label: "Agent Configuration", icon: Bot },
  { id: "prompts", label: "AI Prompts", icon: Sparkles },
]

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">OpenWhispr</h2>
            <p className="text-xs text-muted-foreground">v1.2.13</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-secondary/50 p-4">
          <p className="text-xs text-muted-foreground mb-2">Update Available</p>
          <p className="text-sm font-medium text-foreground mb-3">v1.6.7</p>
          <button className="w-full rounded-md bg-accent text-accent-foreground py-2 text-sm font-medium hover:bg-accent/90 transition-colors">
            Download Update
          </button>
        </div>
      </div>
    </aside>
  )
}
