"use client"

import { useState } from "react"
import { Lightbulb, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AgentSettings() {
  const [agentName, setAgentName] = useState("Moses")

  const examples = [
    { command: `"Hey ${agentName}, write an email to my team about the meeting"`, context: "" },
    { command: `"Hey ${agentName}, make this more professional"`, context: "(after dictating text)" },
    { command: `"Hey ${agentName}, convert this to bullet points"`, context: "" },
    { command: `Regular dictation: "This is just normal text"`, context: "(no agent name needed)" },
  ]

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Agent Configuration</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Customize your AI assistant&apos;s name and behavior to make interactions more personal and effective.
        </p>

        {/* How to use */}
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-accent" />
            <h3 className="font-medium text-foreground">How to use agent names:</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-1">•</span>
              Say &quot;Hey {agentName}, write a formal email&quot; for specific instructions
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-1">•</span>
              Use &quot;Hey {agentName}, format this as a list&quot; for text enhancement commands
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-1">•</span>
              The agent will recognize when you&apos;re addressing it directly vs. dictating content
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-1">•</span>
              Makes conversations feel more natural and helps distinguish commands from dictation
            </li>
          </ul>
        </div>

        {/* Agent Name Input */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <label className="block text-sm font-medium text-foreground mb-3">Current Agent Name</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name..."
              className="flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-center text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-6">
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Choose a name that feels natural to say and remember
          </p>
        </div>

        {/* Example Usage */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent" />
            <h3 className="font-medium text-foreground">Example Usage:</h3>
          </div>
          <div className="p-5 space-y-3">
            {examples.map((example, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <span className="text-accent mt-0.5">•</span>
                <p className="text-muted-foreground">
                  {example.command}
                  {example.context && (
                    <span className="text-muted-foreground/60 ml-1">{example.context}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
