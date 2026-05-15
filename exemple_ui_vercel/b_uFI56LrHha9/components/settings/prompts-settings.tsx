"use client"

import { useState } from "react"
import { Eye, Pencil, FlaskConical, Copy, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type Tab = "current" | "customize" | "test"

const defaultAgentPrompt = `You are Moses, a helpful AI assistant. Process and improve the following text, removing any reference to your name from the output:

{{text}}

Improved text:`

const defaultRegularPrompt = `Atue como um tradutor para o portugues editor de textos especializado em corrigir e formatar transcrições de áudio. Sua função é processar o texto transcrito...`

export function PromptsSettings() {
  const [tab, setTab] = useState<Tab>("current")
  const [agentPrompt, setAgentPrompt] = useState(defaultAgentPrompt)
  const [regularPrompt, setRegularPrompt] = useState(defaultRegularPrompt)
  const [testInput, setTestInput] = useState("Hey Moses, write an email to my team about tomorrow's meeting")
  const [testOutput, setTestOutput] = useState("")
  const [isRunning, setIsRunning] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleTest = () => {
    setIsRunning(true)
    setTimeout(() => {
      setTestOutput("Subject: Tomorrow's Meeting\n\nHi team,\n\nI wanted to send a quick reminder about our meeting scheduled for tomorrow. Please come prepared with your updates and any items you'd like to discuss.\n\nBest regards")
      setIsRunning(false)
    }, 1500)
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">AI Prompt Management</h2>
        <p className="text-sm text-muted-foreground mb-6">
          View and customize the prompts that power OpenWhispr&apos;s AI text processing. Adjust these to change
          how your transcriptions are formatted and enhanced.
        </p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto">
              <TabsTrigger
                value="current"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-6 py-3"
              >
                <Eye className="h-4 w-4 mr-2" />
                Current Prompts
              </TabsTrigger>
              <TabsTrigger
                value="customize"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-6 py-3"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Customize
              </TabsTrigger>
              <TabsTrigger
                value="test"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-6 py-3"
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Test
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="p-5 mt-0 space-y-6">
              <PromptCard
                title="Agent Mode Prompt"
                subtitle='(when you say "Hey Moses")'
                icon="✨"
                content={agentPrompt}
                onCopy={() => handleCopy(agentPrompt)}
              />
              <PromptCard
                title="Regular Mode Prompt"
                subtitle="(for automatic cleanup)"
                icon="⚡"
                content={regularPrompt}
                onCopy={() => handleCopy(regularPrompt)}
              />
            </TabsContent>

            <TabsContent value="customize" className="p-5 mt-0 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Agent Mode Prompt</label>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
                <textarea
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Regular Mode Prompt</label>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
                <textarea
                  value={regularPrompt}
                  onChange={(e) => setRegularPrompt(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>
              <div className="flex justify-end">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="test" className="p-5 mt-0 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Test Input</label>
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    testInput.toLowerCase().includes("hey moses")
                      ? "bg-accent/10 text-accent"
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {testInput.toLowerCase().includes("hey moses") ? "Agent Mode" : "Regular Mode"}
                  </span>
                </div>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={4}
                  placeholder="Enter text to test..."
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>

              <Button
                onClick={handleTest}
                disabled={isRunning || !testInput}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isRunning ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>

              {testOutput && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Output</label>
                  <div className="rounded-lg border border-border bg-secondary/50 p-4">
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                      {testOutput}
                    </pre>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  )
}

function PromptCard({
  title,
  subtitle,
  icon,
  content,
  onCopy,
}: {
  title: string
  subtitle: string
  icon: string
  content: string
  onCopy: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-4 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="rounded-lg bg-secondary/50 p-4 mb-3">
          <pre className="text-sm font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto">
            {content}
          </pre>
        </div>
        <Button variant="outline" size="sm" onClick={onCopy}>
          <Copy className="h-3 w-3 mr-1" />
          Copy Prompt
        </Button>
      </div>
    </div>
  )
}
