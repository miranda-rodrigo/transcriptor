import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  Eye,
  Edit3,
  Play,
  Save,
  RotateCcw,
  Copy,
  Sparkles,
  Zap,
  TestTube,
} from "lucide-react";
import { AlertDialog } from "./dialog";
import { useDialogs } from "../../hooks/useDialogs";
import { useAgentName } from "../../utils/agentName";
import ReasoningService, { DEFAULT_PROMPTS } from "../../services/ReasoningService";
import {
  getModelProvider,
  REASONING_PROVIDERS,
} from "../../models/ModelRegistry";

interface PromptStudioProps {
  className?: string;
}

type ProviderConfig = {
  label: string;
  apiKeyStorageKey?: string;
  baseStorageKey?: string;
};

const DEFAULT_TEST_TEXT = `o, uh... okay, so these LLMs, right? They’re like... honestly, they're a huge jump for AI, like, totally changing how we deal with tech and, you know, how we find stuff out.

Basically, these—uh—sophisticated neural networks, they’re just... they're trained on these massive piles of data, like billions of words, I think? And it helps them kind of soak up how humans talk, our logic, and even, like, the creative side of things.

Gulp. But the crazy part is... okay, so at the core, they’re really just guessing. Like, they're just predicting the next word—or "token," whatever—based on math and stats. But even though it sounds like a simple machine thing, it ends up looking like actual thinking. Like it's actually solving problems and... uh... reasoning through stuff. It’s wild.`;

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  openai: { label: "OpenAI", apiKeyStorageKey: "openaiApiKey" },
  anthropic: { label: "Anthropic", apiKeyStorageKey: "anthropicApiKey" },
  gemini: { label: "Gemini", apiKeyStorageKey: "geminiApiKey" },
  custom: {
    label: "Custom endpoint",
    apiKeyStorageKey: "openaiApiKey",
    baseStorageKey: "cloudReasoningBaseUrl",
  },
  local: { label: "Local" },
};

export default function PromptStudio({ className = "" }: PromptStudioProps) {
  const [activeTab, setActiveTab] = useState<"current" | "edit" | "test">("current");
  const [editedAgentPrompt, setEditedAgentPrompt] = useState(DEFAULT_PROMPTS.agent);
  const [editedRegularPrompt, setEditedRegularPrompt] = useState(DEFAULT_PROMPTS.regular);
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  const [testResult, setTestResult] = useState("");
  const [testExecutionTimeMs, setTestExecutionTimeMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem("reasoningModel") || ""
  );

  const { alertDialog, showAlertDialog, hideAlertDialog } = useDialogs();
  const { agentName } = useAgentName();

  // Load saved custom prompts from localStorage
  useEffect(() => {
    const savedPrompts = localStorage.getItem("customPrompts");
    if (savedPrompts) {
      try {
        const parsed = JSON.parse(savedPrompts);
        setEditedAgentPrompt(parsed.agent || DEFAULT_PROMPTS.agent);
        setEditedRegularPrompt(parsed.regular || DEFAULT_PROMPTS.regular);
      } catch (error) {
        console.error("Failed to load custom prompts:", error);
      }
    }
  }, []);

  const savePrompts = () => {
    const customPrompts = {
      agent: editedAgentPrompt,
      regular: editedRegularPrompt,
    };

    localStorage.setItem("customPrompts", JSON.stringify(customPrompts));
    showAlertDialog({
      title: "Prompts Saved!",
      description:
        "Your custom prompts have been saved and will be used for all future AI processing.",
    });
  };

  const resetToDefaults = () => {
    setEditedAgentPrompt(DEFAULT_PROMPTS.agent);
    setEditedRegularPrompt(DEFAULT_PROMPTS.regular);
    localStorage.removeItem("customPrompts");
    showAlertDialog({
      title: "Reset Complete",
      description: "Prompts have been reset to default values.",
    });
  };

  const testPrompt = async () => {
    if (!testText.trim() || !selectedModel) return;

    setIsLoading(true);
    setTestResult("");
    setTestExecutionTimeMs(null);

    const reasoningProvider = getModelProvider(selectedModel);
    const customPrompts = {
      agent: editedAgentPrompt,
      regular: editedRegularPrompt,
    };

    try {
      const startTime = performance.now();

      if (reasoningProvider === "local") {
        const result = await window.electronAPI.processLocalReasoning(
          testText,
          selectedModel,
          agentName,
          { customPrompts }
        );

        setTestExecutionTimeMs(Math.round(performance.now() - startTime));

        if (result.success) {
          setTestResult(result.text);
        } else {
          setTestResult(`❌ Local model error: ${result.error}`);
        }
      } else {
        const result = await ReasoningService.processText(
          testText,
          selectedModel,
          agentName,
          { customPrompts }
        );
        setTestExecutionTimeMs(Math.round(performance.now() - startTime));
        setTestResult(result);
      }
    } catch (error) {
      console.error("Test failed:", error);
      setTestResult(`❌ Test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    showAlertDialog({
      title: "Copied!",
      description: "Prompt copied to clipboard.",
    });
  };

  const renderCurrentPrompts = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-accent" />
          Current AI Prompts
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          These are the exact prompts currently being sent to your AI models. Understanding these
          helps you see how OpenWhispr thinks!
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-accent" />
            Agent Mode Prompt (when you say "Hey {agentName}")
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-secondary border border-border rounded-lg p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap">
              {editedAgentPrompt.replace(/\{\{agentName\}\}/g, agentName)}
            </pre>
          </div>
          <Button
            onClick={() => copyPrompt(editedAgentPrompt)}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Prompt
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-success" />
            Regular Mode Prompt (for automatic cleanup)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-secondary border border-border rounded-lg p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{editedRegularPrompt}</pre>
          </div>
          <Button
            onClick={() => copyPrompt(editedRegularPrompt)}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Prompt
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderEditPrompts = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-accent" />
          Customize Your AI Prompts
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Edit these prompts to change how your AI behaves. Use <code>{"{{agentName}}"}</code> and{" "}
          <code>{"{{text}}"}</code> as placeholders.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Mode Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editedAgentPrompt}
            onChange={(e) => setEditedAgentPrompt(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Enter your custom agent prompt..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regular Mode Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editedRegularPrompt}
            onChange={(e) => setEditedRegularPrompt(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Enter your custom regular prompt..."
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={savePrompts} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save Custom Prompts
        </Button>
        <Button onClick={resetToDefaults} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );

  const renderTestPlayground = () => {
    const provider = selectedModel ? getModelProvider(selectedModel) : "";
    const providerConfig = provider
      ? PROVIDER_CONFIG[provider] || {
          label: provider.charAt(0).toUpperCase() + provider.slice(1),
        }
      : null;
    const canRunTest = !!testText.trim() && !!selectedModel && !isLoading;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TestTube className="w-5 h-5 text-accent" />
            Test Your Prompts
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Select a model and test your custom prompts to see real results.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select a model...</option>
                {Object.entries(REASONING_PROVIDERS).map(([providerId, providerData]) => (
                  <optgroup key={providerId} label={providerData.name}>
                    {providerData.models.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {providerConfig && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Provider: {providerConfig.label}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Test Input</label>
              <Textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={12}
                placeholder="Enter text to test with your custom prompts..."
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Try including "{agentName}" in your text to test agent mode prompts
                </p>
                {testText && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      testText.toLowerCase().includes(agentName.toLowerCase())
                        ? "bg-accent/10 text-accent"
                        : "bg-success/10 text-success"
                    }`}
                  >
                    {testText.toLowerCase().includes(agentName.toLowerCase())
                      ? "Agent Mode"
                      : "Regular Mode"}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={testPrompt}
              disabled={!canRunTest}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              {isLoading ? "Processing with AI..." : "Test Prompt with AI"}
            </Button>

            {testResult && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Test Result</label>
                  <Button onClick={() => copyPrompt(testResult)} variant="ghost" size="sm">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {testExecutionTimeMs !== null && (
                  <div className="mb-2 text-sm text-muted-foreground">
                    Execution time: {(testExecutionTimeMs / 1000).toFixed(2)}s
                  </div>
                )}
                <div
                  className={`border rounded-lg p-4 text-sm max-h-60 overflow-y-auto ${
                    testResult.startsWith("\u26A0\uFE0F") || testResult.startsWith("\u274C")
                      ? "bg-warning/10 border-warning/30 text-warning"
                      : "bg-secondary border-border"
                  }`}
                >
                  <pre className="whitespace-pre-wrap">{testResult}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className={className}>
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: "current", label: "Current Prompts", icon: Eye },
          { id: "edit", label: "Customize", icon: Edit3 },
          { id: "test", label: "Test", icon: TestTube },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "current" && renderCurrentPrompts()}
      {activeTab === "edit" && renderEditPrompts()}
      {activeTab === "test" && renderTestPlayground()}
    </div>
  );
}
