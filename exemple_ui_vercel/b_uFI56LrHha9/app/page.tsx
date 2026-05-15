"use client"

import { useState } from "react"
import { SettingsSidebar } from "@/components/settings/settings-sidebar"
import { GeneralSettings } from "@/components/settings/general-settings"
import { TranscriptionSettings } from "@/components/settings/transcription-settings"
import { AIModelsSettings } from "@/components/settings/ai-models-settings"
import { AgentSettings } from "@/components/settings/agent-settings"
import { PromptsSettings } from "@/components/settings/prompts-settings"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export type SettingsSection = "general" | "transcription" | "ai-models" | "agent" | "prompts"

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />
      case "transcription":
        return <TranscriptionSettings />
      case "ai-models":
        return <AIModelsSettings />
      case "agent":
        return <AgentSettings />
      case "prompts":
        return <PromptsSettings />
      default:
        return <GeneralSettings />
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-8 py-4">
          <h1 className="text-lg font-medium text-foreground">Settings</h1>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="px-8 py-6 max-w-4xl">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
