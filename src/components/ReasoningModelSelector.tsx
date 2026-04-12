import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Cloud, Lock } from "lucide-react";
import ApiKeyInput from "./ui/ApiKeyInput";
import ModelCardList from "./ui/ModelCardList";
import LocalModelPicker, { type LocalProvider } from "./LocalModelPicker";
import { ProviderTabs } from "./ui/ProviderTabs";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";
import { REASONING_PROVIDERS, getAllMlxModels } from "../models/ModelRegistry";
import { modelRegistry } from "../models/ModelRegistry";
import { getProviderIcon } from "../utils/providerIcons";

type CloudModelOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  ownedBy?: string;
};

const OWNED_BY_ICON_RULES: Array<{ match: RegExp; provider: string }> = [
  { match: /(openai|system|default|gpt|davinci)/, provider: "openai" },
  { match: /(azure)/, provider: "openai" },
  { match: /(anthropic|claude)/, provider: "anthropic" },
  { match: /(google|gemini)/, provider: "gemini" },
  { match: /(meta|llama)/, provider: "llama" },
  { match: /(mistral)/, provider: "mistral" },
  { match: /(qwen|ali|tongyi)/, provider: "qwen" },
  { match: /(openrouter|oss)/, provider: "openai-oss" },
];

const resolveOwnedByIcon = (ownedBy?: string): string | undefined => {
  if (!ownedBy) return undefined;
  const normalized = ownedBy.toLowerCase();
  const rule = OWNED_BY_ICON_RULES.find(({ match }) => match.test(normalized));
  if (rule) {
    return getProviderIcon(rule.provider);
  }
  return undefined;
};

interface ReasoningModelSelectorProps {
  useReasoningModel: boolean;
  setUseReasoningModel: (value: boolean) => void;
  reasoningModel: string;
  setReasoningModel: (model: string) => void;
  localReasoningProvider: string;
  setLocalReasoningProvider: (provider: string) => void;
  cloudReasoningBaseUrl: string;
  setCloudReasoningBaseUrl: (value: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  showAlertDialog: (dialog: { title: string; description: string }) => void;
}

export default function ReasoningModelSelector({
  useReasoningModel,
  setUseReasoningModel,
  reasoningModel,
  setReasoningModel,
  localReasoningProvider,
  setLocalReasoningProvider,
  cloudReasoningBaseUrl,
  setCloudReasoningBaseUrl,
  openaiApiKey,
  setOpenaiApiKey,
  anthropicApiKey,
  setAnthropicApiKey,
  geminiApiKey,
  setGeminiApiKey,
  groqApiKey,
  setGroqApiKey,
}: ReasoningModelSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<"cloud" | "local">("cloud");
  const [selectedCloudProvider, setSelectedCloudProvider] = useState("openai");
  const [selectedLocalProvider, setSelectedLocalProvider] = useState("mlx");
  const [customModelOptions, setCustomModelOptions] = useState<CloudModelOption[]>([]);
  const [customModelsLoading, setCustomModelsLoading] = useState(false);
  const [customModelsError, setCustomModelsError] = useState<string | null>(null);
  const [customBaseInput, setCustomBaseInput] = useState(cloudReasoningBaseUrl);
  const lastLoadedBaseRef = useRef<string | null>(null);
  const pendingBaseRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCustomBaseInput(cloudReasoningBaseUrl);
  }, [cloudReasoningBaseUrl]);

  const defaultOpenAIBase = useMemo(() => normalizeBaseUrl(API_ENDPOINTS.OPENAI_BASE), []);
  const normalizedCustomReasoningBase = useMemo(
    () => normalizeBaseUrl(cloudReasoningBaseUrl),
    [cloudReasoningBaseUrl]
  );
  const latestReasoningBaseRef = useRef(normalizedCustomReasoningBase);

  useEffect(() => {
    latestReasoningBaseRef.current = normalizedCustomReasoningBase;
  }, [normalizedCustomReasoningBase]);

  const hasCustomBase = normalizedCustomReasoningBase !== "";
  const effectiveReasoningBase = hasCustomBase ? normalizedCustomReasoningBase : defaultOpenAIBase;

  const loadRemoteModels = useCallback(
    async (baseOverride?: string, force = false) => {
      const rawBase = (baseOverride ?? cloudReasoningBaseUrl) || "";
      const normalizedBase = normalizeBaseUrl(rawBase);

      if (!normalizedBase) {
        if (isMountedRef.current) {
          setCustomModelsLoading(false);
          setCustomModelsError(null);
          setCustomModelOptions([]);
        }
        return;
      }

      if (!force && lastLoadedBaseRef.current === normalizedBase) return;
      if (!force && pendingBaseRef.current === normalizedBase) return;

      if (baseOverride !== undefined) {
        latestReasoningBaseRef.current = normalizedBase;
      }

      pendingBaseRef.current = normalizedBase;

      if (isMountedRef.current) {
        setCustomModelsLoading(true);
        setCustomModelsError(null);
        setCustomModelOptions([]);
      }

      let apiKey: string | undefined;

      try {
        const keyFromState = openaiApiKey?.trim();
        apiKey =
          keyFromState && keyFromState.length > 0
            ? keyFromState
            : await window.electronAPI?.getOpenAIKey?.();

        if (!normalizedBase.includes("://")) {
          if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
            setCustomModelsError(
              "Enter a full base URL including protocol (e.g. https://server/v1)."
            );
            setCustomModelsLoading(false);
          }
          return;
        }

        const isLocalhost =
          normalizedBase.includes("://localhost") || normalizedBase.includes("://127.0.0.1");
        if (!normalizedBase.startsWith("https://") && !isLocalhost) {
          if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
            setCustomModelsError(
              "Only HTTPS endpoints are allowed (except localhost for testing)."
            );
            setCustomModelsLoading(false);
          }
          return;
        }

        const headers: Record<string, string> = {};
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }

        const modelsUrl = buildApiUrl(normalizedBase, "/models");
        const response = await fetch(modelsUrl, { method: "GET", headers });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const summary = errorText
            ? `${response.status} ${errorText.slice(0, 200)}`
            : `${response.status} ${response.statusText}`;
          throw new Error(summary.trim());
        }

        const payload = await response.json().catch(() => ({}));
        const rawModels = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : [];

        const mappedModels = (rawModels as Array<Record<string, unknown>>)
          .map((item) => {
            const value = (item?.id || item?.name) as string | undefined;
            if (!value) return null;
            const ownedBy = typeof item?.owned_by === "string" ? item.owned_by : undefined;
            const icon = resolveOwnedByIcon(ownedBy);
            return {
              value,
              label: (item?.id || item?.name || value) as string,
              description:
                (item?.description as string) || (ownedBy ? `Owner: ${ownedBy}` : undefined),
              icon,
              ownedBy,
            } as CloudModelOption;
          })
          .filter(Boolean) as CloudModelOption[];

        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          setCustomModelOptions(mappedModels);
          if (
            reasoningModel &&
            mappedModels.length > 0 &&
            !mappedModels.some((model) => model.value === reasoningModel)
          ) {
            setReasoningModel("");
          }
          setCustomModelsError(null);
          lastLoadedBaseRef.current = normalizedBase;
        }
      } catch (error) {
        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          const message = (error as Error).message || "Unable to load models from endpoint.";
          const unauthorized = /\b(401|403)\b/.test(message);
          if (unauthorized && !apiKey) {
            setCustomModelsError(
              "Endpoint rejected the request (401/403). Add an API key or adjust server auth settings."
            );
          } else {
            setCustomModelsError(message);
          }
          setCustomModelOptions([]);
        }
      } finally {
        if (pendingBaseRef.current === normalizedBase) {
          pendingBaseRef.current = null;
        }
        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          setCustomModelsLoading(false);
        }
      }
    },
    [cloudReasoningBaseUrl, openaiApiKey, reasoningModel, setReasoningModel]
  );

  const trimmedCustomBase = customBaseInput.trim();
  const hasSavedCustomBase = Boolean((cloudReasoningBaseUrl || "").trim());
  const isCustomBaseDirty = trimmedCustomBase !== (cloudReasoningBaseUrl || "").trim();

  const displayedCustomModels = useMemo<CloudModelOption[]>(() => {
    if (isCustomBaseDirty) return [];
    return customModelOptions;
  }, [isCustomBaseDirty, customModelOptions]);

  const cloudProviderIds = ["openai", "anthropic", "gemini", "groq", "custom"];
  const cloudProviders = cloudProviderIds.map((id) => ({
    id,
    name:
      id === "custom"
        ? "Custom"
        : REASONING_PROVIDERS[id as keyof typeof REASONING_PROVIDERS]?.name || id,
  }));

  const localProviders = useMemo<LocalProvider[]>(() => {
    let mlxModels: any[];
    try {
      mlxModels = getAllMlxModels();
    } catch (err: any) {
      mlxModels = [];
    }
    if (mlxModels.length > 0) {
      return [{
        id: "mlx",
        name: "MLX (Apple Silicon)",
        models: mlxModels.map((m) => ({
          id: m.id,
          name: m.name,
          size: m.size,
          description: m.description,
          recommended: m.recommended,
          hfId: m.hfId,
        })),
      }];
    }
    return modelRegistry.getAllProviders().map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: provider.models.map((model) => ({
        id: model.id,
        name: model.name,
        size: model.size,
        sizeBytes: model.sizeBytes,
        description: model.description,
        recommended: model.recommended,
      })),
    }));
  }, []);

  const openaiModelOptions = useMemo<CloudModelOption[]>(() => {
    const iconUrl = getProviderIcon("openai");
    return REASONING_PROVIDERS.openai.models.map((model) => ({
      ...model,
      icon: iconUrl,
    }));
  }, []);

  const selectedCloudModels = useMemo<CloudModelOption[]>(() => {
    if (selectedCloudProvider === "openai") return openaiModelOptions;
    if (selectedCloudProvider === "custom") return displayedCustomModels;

    const provider = REASONING_PROVIDERS[selectedCloudProvider as keyof typeof REASONING_PROVIDERS];
    if (!provider?.models) return [];

    const iconUrl = getProviderIcon(selectedCloudProvider);
    return provider.models.map((model) => ({
      ...model,
      icon: iconUrl,
    }));
  }, [selectedCloudProvider, openaiModelOptions, displayedCustomModels]);

  const handleApplyCustomBase = useCallback(() => {
    const trimmedBase = customBaseInput.trim();
    setCustomBaseInput(trimmedBase);
    setCloudReasoningBaseUrl(trimmedBase);
    lastLoadedBaseRef.current = null;
    loadRemoteModels(trimmedBase, true);
  }, [customBaseInput, setCloudReasoningBaseUrl, loadRemoteModels]);

  const handleResetCustomBase = useCallback(() => {
    const defaultBase = API_ENDPOINTS.OPENAI_BASE;
    setCustomBaseInput(defaultBase);
    setCloudReasoningBaseUrl(defaultBase);
    lastLoadedBaseRef.current = null;
    loadRemoteModels(defaultBase, true);
  }, [setCloudReasoningBaseUrl, loadRemoteModels]);

  const handleRefreshCustomModels = useCallback(() => {
    if (isCustomBaseDirty) {
      handleApplyCustomBase();
      return;
    }
    if (!trimmedCustomBase) return;
    loadRemoteModels(undefined, true);
  }, [handleApplyCustomBase, isCustomBaseDirty, trimmedCustomBase, loadRemoteModels]);

  useEffect(() => {
    const localProviderIds = localProviders.map((p) => p.id);
    if (localProviderIds.includes(localReasoningProvider)) {
      setSelectedMode("local");
      setSelectedLocalProvider(localReasoningProvider);
    } else if (cloudProviderIds.includes(localReasoningProvider)) {
      setSelectedMode("cloud");
      setSelectedCloudProvider(localReasoningProvider);
    } else if (localProviderIds.length > 0) {
      setSelectedLocalProvider(localProviderIds[0]);
    }
  }, [localProviders, localReasoningProvider]);

  useEffect(() => {
    if (selectedCloudProvider !== "custom") return;
    if (!hasCustomBase) {
      setCustomModelsError(null);
      setCustomModelOptions([]);
      setCustomModelsLoading(false);
      lastLoadedBaseRef.current = null;
      return;
    }

    const normalizedBase = normalizedCustomReasoningBase;
    if (!normalizedBase) return;
    if (pendingBaseRef.current === normalizedBase || lastLoadedBaseRef.current === normalizedBase)
      return;

    loadRemoteModels();
  }, [selectedCloudProvider, hasCustomBase, normalizedCustomReasoningBase, loadRemoteModels]);

  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());

  const loadDownloadedModels = useCallback(async () => {
    try {
      const result = await window.electronAPI?.modelGetAll?.();
      if (result && Array.isArray(result)) {
        const downloaded = new Set(
          result
            .filter((m: { isDownloaded?: boolean }) => m.isDownloaded)
            .map((m: { id: string }) => m.id)
        );
        setDownloadedModels(downloaded);
        return downloaded;
      }
    } catch (error) {
      console.error("Failed to load downloaded models:", error);
    }
    return new Set<string>();
  }, []);

  useEffect(() => {
    loadDownloadedModels();
  }, [loadDownloadedModels]);

  const handleModeChange = async (newMode: "cloud" | "local") => {
    setSelectedMode(newMode);

    if (newMode === "cloud") {
      setLocalReasoningProvider(selectedCloudProvider);

      if (selectedCloudProvider === "custom") {
        setCustomBaseInput(cloudReasoningBaseUrl);
        lastLoadedBaseRef.current = null;
        pendingBaseRef.current = null;

        if (customModelOptions.length > 0) {
          setReasoningModel(customModelOptions[0].value);
        } else if (hasCustomBase) {
          loadRemoteModels();
        }
        return;
      }

      const provider =
        REASONING_PROVIDERS[selectedCloudProvider as keyof typeof REASONING_PROVIDERS];
      if (provider?.models?.length > 0) {
        setReasoningModel(provider.models[0].value);
      }
    } else {
      setLocalReasoningProvider(selectedLocalProvider);
      const downloaded = await loadDownloadedModels();
      const provider = localProviders.find((p) => p.id === selectedLocalProvider);
      const models = provider?.models ?? [];
      if (models.length > 0) {
        const firstDownloaded = models.find((m) => downloaded.has(m.id));
        if (firstDownloaded) {
          setReasoningModel(firstDownloaded.id);
        } else {
          setReasoningModel("");
        }
      }
    }
  };

  const handleCloudProviderChange = (provider: string) => {
    setSelectedCloudProvider(provider);
    setLocalReasoningProvider(provider);

    if (provider === "custom") {
      setCustomBaseInput(cloudReasoningBaseUrl);
      lastLoadedBaseRef.current = null;
      pendingBaseRef.current = null;

      if (customModelOptions.length > 0) {
        setReasoningModel(customModelOptions[0].value);
      } else if (hasCustomBase) {
        loadRemoteModels();
      }
      return;
    }

    const providerData = REASONING_PROVIDERS[provider as keyof typeof REASONING_PROVIDERS];
    if (providerData?.models?.length > 0) {
      setReasoningModel(providerData.models[0].value);
    }
  };

  const handleLocalProviderChange = async (providerId: string) => {
    setSelectedLocalProvider(providerId);
    setLocalReasoningProvider(providerId);
    const downloaded = await loadDownloadedModels();
    const provider = localProviders.find((p) => p.id === providerId);
    const models = provider?.models ?? [];
    if (models.length > 0) {
      const firstDownloaded = models.find((m) => downloaded.has(m.id));
      if (firstDownloaded) {
        setReasoningModel(firstDownloaded.id);
      } else {
        setReasoningModel("");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
        <div>
          <label className="text-sm font-medium text-foreground">Enable AI Text Enhancement</label>
          <p className="text-xs text-muted-foreground">
            Use AI to automatically improve transcription quality
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={useReasoningModel}
            onChange={(e) => setUseReasoningModel(e.target.checked)}
          />
          <div
            className={`w-11 h-6 rounded-full transition-colors duration-200 ${
              useReasoningModel ? "bg-accent" : "bg-secondary"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 bg-foreground border border-border rounded-full h-5 w-5 transition-transform duration-200 ${
                useReasoningModel ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        </label>
      </div>

      {useReasoningModel && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => handleModeChange("cloud")}
              className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                selectedMode === "cloud"
                  ? "border-accent bg-accent/5"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Cloud className="w-6 h-6 text-accent" />
                  <h4 className="font-medium text-foreground">Cloud AI</h4>
                </div>
                <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                  Powerful
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Advanced models via API. Fast and capable, requires internet.
              </p>
            </button>

            <button
              onClick={() => handleModeChange("local")}
              className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                selectedMode === "local"
                  ? "border-accent bg-accent/5"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Lock className="w-6 h-6 text-accent" />
                  <h4 className="font-medium text-foreground">Local AI</h4>
                </div>
                <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                  Private
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Runs on your device. Complete privacy, works offline.
              </p>
            </button>
          </div>

          {selectedMode === "cloud" ? (
            <div className="space-y-4">
              <div className="border border-border rounded-xl overflow-hidden">
                <ProviderTabs
                  providers={cloudProviders}
                  selectedId={selectedCloudProvider}
                  onSelect={handleCloudProviderChange}
                  colorScheme="indigo"
                />

                <div className="p-4">
                  {selectedCloudProvider === "custom" ? (
                    <>
                      <div className="space-y-3">
                        <h4 className="font-medium text-foreground">Endpoint Settings</h4>
                        <Input
                          value={customBaseInput}
                          onChange={(event) => setCustomBaseInput(event.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleResetCustomBase}
                          >
                            Reset to Default
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleRefreshCustomModels}
                            disabled={
                              customModelsLoading || (!trimmedCustomBase && !hasSavedCustomBase)
                            }
                          >
                            {customModelsLoading
                              ? "Loading models..."
                              : isCustomBaseDirty
                                ? "Apply & Refresh"
                                : "Refresh Models"}
                          </Button>
                        </div>
                        {isCustomBaseDirty && (
                          <p className="text-xs text-amber-600">
                            Apply the new base URL to refresh models.
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          We'll query{" "}
                          <code>
                            {hasCustomBase
                              ? `${effectiveReasoningBase}/models`
                              : `${defaultOpenAIBase}/models`}
                          </code>{" "}
                          for available models.
                        </p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-border">
                        <h4 className="font-medium text-foreground">Authentication</h4>
                        <ApiKeyInput
                          apiKey={openaiApiKey}
                          setApiKey={setOpenaiApiKey}
                          helpText="Optional. Added as a Bearer token for your custom endpoint."
                        />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-border">
                        <h4 className="text-sm font-medium text-muted-foreground">Available Models</h4>
                        {!hasCustomBase && (
                          <p className="text-xs text-amber-600">Enter a base URL to load models.</p>
                        )}
                        {hasCustomBase && (
                          <>
                            {customModelsLoading && (
                              <p className="text-xs text-blue-600">Fetching model list...</p>
                            )}
                            {customModelsError && (
                              <p className="text-xs text-red-600">{customModelsError}</p>
                            )}
                            {!customModelsLoading &&
                              !customModelsError &&
                              customModelOptions.length === 0 && (
                                <p className="text-xs text-amber-600">
                                  No models returned by this endpoint.
                                </p>
                              )}
                          </>
                        )}
                        <ModelCardList
                          models={selectedCloudModels}
                          selectedModel={reasoningModel}
                          onModelSelect={setReasoningModel}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Select Model</h4>
                        <ModelCardList
                          models={selectedCloudModels}
                          selectedModel={reasoningModel}
                          onModelSelect={setReasoningModel}
                        />
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        {selectedCloudProvider === "openai" && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">API Configuration</h4>
                            <ApiKeyInput
                              apiKey={openaiApiKey}
                              setApiKey={setOpenaiApiKey}
                              helpText={
                                <>
                                  Need an API key?{" "}
                                  <a
                                    href="https://platform.openai.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent underline"
                                  >
                                    platform.openai.com
                                  </a>
                                </>
                              }
                            />
                          </div>
                        )}

                        {selectedCloudProvider === "anthropic" && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">API Configuration</h4>
                            <ApiKeyInput
                              apiKey={anthropicApiKey}
                              setApiKey={setAnthropicApiKey}
                              placeholder="sk-ant-..."
                              helpText={
                                <>
                                  Need an API key?{" "}
                                  <a
                                    href="https://console.anthropic.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent underline"
                                  >
                                    console.anthropic.com
                                  </a>
                                </>
                              }
                            />
                          </div>
                        )}

                        {selectedCloudProvider === "gemini" && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">API Configuration</h4>
                            <ApiKeyInput
                              apiKey={geminiApiKey}
                              setApiKey={setGeminiApiKey}
                              placeholder="AIza..."
                              helpText={
                                <>
                                  Need an API key?{" "}
                                  <a
                                    href="https://makersuite.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent underline"
                                  >
                                    makersuite.google.com
                                  </a>
                                </>
                              }
                            />
                          </div>
                        )}

                        {selectedCloudProvider === "groq" && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-foreground">API Configuration</h4>
                            <ApiKeyInput
                              apiKey={groqApiKey}
                              setApiKey={setGroqApiKey}
                              placeholder="gsk_..."
                              helpText={
                                <>
                                  Need an API key?{" "}
                                  <a
                                    href="https://console.groq.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent underline"
                                  >
                                    console.groq.com
                                  </a>
                                </>
                              }
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <LocalModelPicker
              providers={localProviders}
              selectedModel={reasoningModel}
              selectedProvider={selectedLocalProvider}
              onModelSelect={setReasoningModel}
              onProviderSelect={handleLocalProviderChange}
              modelType="llm"
              colorScheme="purple"
              onDownloadComplete={loadDownloadedModels}
            />
          )}
        </>
      )}
    </div>
  );
}
