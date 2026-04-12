import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Download, Trash2, Check, Cloud, Lock, X } from "lucide-react";
import { ProviderIcon } from "./ui/ProviderIcon";
import { ProviderTabs } from "./ui/ProviderTabs";
import ModelCardList from "./ui/ModelCardList";
import { DownloadProgressBar } from "./ui/DownloadProgressBar";
import ApiKeyInput from "./ui/ApiKeyInput";
import { ConfirmDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useModelDownload } from "../hooks/useModelDownload";
import {
  getTranscriptionProviders,
  PARAKEET_MODEL_INFO,
  TranscriptionProviderData,
  WHISPER_MODEL_INFO,
} from "../models/ModelRegistry";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";
import { getProviderIcon } from "../utils/providerIcons";
import { cn } from "./lib/utils";

interface LocalModel {
  model: string;
  size_mb?: number;
  downloaded?: boolean;
}

interface TranscriptionModelPickerProps {
  selectedCloudProvider: string;
  onCloudProviderSelect: (providerId: string) => void;
  selectedCloudModel: string;
  onCloudModelSelect: (modelId: string) => void;
  selectedLocalModel: string;
  onLocalModelSelect: (modelId: string) => void;
  selectedLocalProvider?: string;
  onLocalProviderSelect?: (providerId: string) => void;
  useLocalWhisper: boolean;
  onModeChange: (useLocal: boolean) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  className?: string;
  variant?: "onboarding" | "settings";
}

const CLOUD_PROVIDER_TABS = [
  { id: "openai", name: "OpenAI" },
  { id: "groq", name: "Groq" },
];

const VALID_CLOUD_PROVIDER_IDS = CLOUD_PROVIDER_TABS.map((p) => p.id);

const LOCAL_PROVIDER_TABS = [
  { id: "whisper", name: "OpenAI Whisper", badge: undefined },
  { id: "nvidia", name: "NVIDIA Parakeet", badge: undefined },
];

export default function TranscriptionModelPicker({
  selectedCloudProvider,
  onCloudProviderSelect,
  selectedCloudModel,
  onCloudModelSelect,
  selectedLocalModel,
  onLocalModelSelect,
  selectedLocalProvider = "whisper",
  onLocalProviderSelect,
  useLocalWhisper,
  onModeChange,
  openaiApiKey,
  setOpenaiApiKey,
  groqApiKey,
  setGroqApiKey,
  className = "",
  variant = "settings",
}: TranscriptionModelPickerProps) {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [parakeetModels, setParakeetModels] = useState<LocalModel[]>([]);
  const [internalLocalProvider, setInternalLocalProvider] = useState(selectedLocalProvider);
  const hasLoadedRef = useRef(false);
  const hasLoadedParakeetRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isLoadingParakeetRef = useRef(false);
  const loadLocalModelsRef = useRef<(() => Promise<void>) | null>(null);
  const loadParakeetModelsRef = useRef<(() => Promise<void>) | null>(null);
  const ensureValidCloudSelectionRef = useRef<(() => void) | null>(null);
  const selectedLocalModelRef = useRef(selectedLocalModel);
  const onLocalModelSelectRef = useRef(onLocalModelSelect);

  useEffect(() => {
    if (selectedLocalProvider !== internalLocalProvider) {
      setInternalLocalProvider(selectedLocalProvider);
    }
  }, [selectedLocalProvider, internalLocalProvider]);

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const colorScheme: ColorScheme = variant === "settings" ? "purple" : "blue";
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);
  const cloudProviders = useMemo(() => getTranscriptionProviders(), []);

  useEffect(() => {
    selectedLocalModelRef.current = selectedLocalModel;
  }, [selectedLocalModel]);
  useEffect(() => {
    onLocalModelSelectRef.current = onLocalModelSelect;
  }, [onLocalModelSelect]);

  const validateAndSelectModel = useCallback((loadedModels: LocalModel[]) => {
    const current = selectedLocalModelRef.current;

    const downloaded = loadedModels.filter((m) => m.downloaded);
    const isCurrentDownloaded = loadedModels.find((m) => m.model === current)?.downloaded;

    if ((!current || !isCurrentDownloaded) && downloaded.length > 0) {
      onLocalModelSelectRef.current(downloaded[0].model);
    }
  }, []);

  const loadLocalModels = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const result = await window.electronAPI?.listWhisperModels();
      if (result?.success) {
        setLocalModels(result.models);
        validateAndSelectModel(result.models);
      }
    } catch (error) {
      console.error("[TranscriptionModelPicker] Failed to load models:", error);
      setLocalModels([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [validateAndSelectModel]);

  const loadParakeetModels = useCallback(async () => {
    if (isLoadingParakeetRef.current) return;
    isLoadingParakeetRef.current = true;

    try {
      const result = await window.electronAPI?.listParakeetModels();
      if (result?.success) {
        setParakeetModels(result.models);
        validateAndSelectModel(result.models);
      }
    } catch (error) {
      console.error("[TranscriptionModelPicker] Failed to load Parakeet models:", error);
      setParakeetModels([]);
    } finally {
      isLoadingParakeetRef.current = false;
    }
  }, [validateAndSelectModel]);

  const ensureValidCloudSelection = useCallback(() => {
    const isValidProvider = VALID_CLOUD_PROVIDER_IDS.includes(selectedCloudProvider);

    if (!isValidProvider) {
      const firstProvider = cloudProviders[0];
      if (firstProvider) {
        onCloudProviderSelect(firstProvider.id);
        if (firstProvider.models?.length) {
          onCloudModelSelect(firstProvider.models[0].id);
        }
      }
    } else if (!selectedCloudModel) {
      const provider = cloudProviders.find((p) => p.id === selectedCloudProvider);
      if (provider?.models?.length) {
        onCloudModelSelect(provider.models[0].id);
      }
    }
  }, [
    cloudProviders,
    selectedCloudProvider,
    selectedCloudModel,
    onCloudProviderSelect,
    onCloudModelSelect,
  ]);

  useEffect(() => {
    loadLocalModelsRef.current = loadLocalModels;
  }, [loadLocalModels]);
  useEffect(() => {
    loadParakeetModelsRef.current = loadParakeetModels;
  }, [loadParakeetModels]);
  useEffect(() => {
    ensureValidCloudSelectionRef.current = ensureValidCloudSelection;
  }, [ensureValidCloudSelection]);

  useEffect(() => {
    if (useLocalWhisper) {
      if (internalLocalProvider === "whisper" && !hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadLocalModelsRef.current?.();
      } else if (internalLocalProvider === "nvidia" && !hasLoadedParakeetRef.current) {
        hasLoadedParakeetRef.current = true;
        loadParakeetModelsRef.current?.();
      }
    } else {
      hasLoadedRef.current = false;
      hasLoadedParakeetRef.current = false;
      ensureValidCloudSelectionRef.current?.();
    }
  }, [useLocalWhisper, internalLocalProvider]);

  useEffect(() => {
    const handleModelsCleared = () => {
      loadLocalModels();
      loadParakeetModels();
    };
    window.addEventListener("openwhispr-models-cleared", handleModelsCleared);
    return () => window.removeEventListener("openwhispr-models-cleared", handleModelsCleared);
  }, [loadLocalModels, loadParakeetModels]);

  const {
    downloadingModel,
    downloadProgress,
    downloadModel,
    deleteModel,
    isDownloadingModel,
    cancelDownload,
    isCancelling,
  } = useModelDownload({
    modelType: internalLocalProvider === "nvidia" ? "parakeet" : "whisper",
    onDownloadComplete:
      internalLocalProvider === "nvidia" ? loadParakeetModels : loadLocalModels,
  });

  const handleModeChange = useCallback(
    (isLocal: boolean) => {
      onModeChange(isLocal);
      if (!isLocal) ensureValidCloudSelection();
    },
    [onModeChange, ensureValidCloudSelection]
  );

  const handleCloudProviderChange = useCallback(
    (providerId: string) => {
      onCloudProviderSelect(providerId);
      const provider = cloudProviders.find((p) => p.id === providerId);
      if (provider?.models?.length) {
        onCloudModelSelect(provider.models[0].id);
      }
    },
    [cloudProviders, onCloudProviderSelect, onCloudModelSelect]
  );

  const handleLocalProviderChange = useCallback(
    (providerId: string) => {
      setInternalLocalProvider(providerId);
      onLocalProviderSelect?.(providerId);

      if (providerId === "nvidia") {
        loadParakeetModelsRef.current?.();
      } else {
        loadLocalModelsRef.current?.();
      }
    },
    [onLocalProviderSelect]
  );

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: async () => {
          await deleteModel(modelId, async () => {
            const result =
              internalLocalProvider === "nvidia"
                ? await window.electronAPI?.listParakeetModels()
                : await window.electronAPI?.listWhisperModels();
            if (result?.success) {
              if (internalLocalProvider === "nvidia") {
                setParakeetModels(result.models);
              } else {
                setLocalModels(result.models);
              }
              validateAndSelectModel(result.models);
            }
          });
        },
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, validateAndSelectModel, internalLocalProvider]
  );

  const currentCloudProvider = useMemo<TranscriptionProviderData | undefined>(
    () => cloudProviders.find((p) => p.id === selectedCloudProvider),
    [cloudProviders, selectedCloudProvider]
  );

  const cloudModelOptions = useMemo(() => {
    if (!currentCloudProvider) return [];
    return currentCloudProvider.models.map((m) => ({
      value: m.id,
      label: m.name,
      description: m.description,
      icon: getProviderIcon(selectedCloudProvider),
    }));
  }, [currentCloudProvider, selectedCloudProvider]);

  const progressDisplay = useMemo(() => {
    if (!downloadingModel || !useLocalWhisper) return null;
    const modelInfo =
      internalLocalProvider === "nvidia"
        ? PARAKEET_MODEL_INFO[downloadingModel]
        : WHISPER_MODEL_INFO[downloadingModel];
    return (
      <DownloadProgressBar
        modelName={modelInfo?.name || downloadingModel}
        progress={downloadProgress}
        styles={styles}
      />
    );
  }, [downloadingModel, downloadProgress, internalLocalProvider, useLocalWhisper, styles]);

  const getModeCardClassName = (isSelected: boolean) =>
    cn(
      "cursor-pointer rounded-xl border-2 p-4 text-left transition-all",
      isSelected
        ? "border-accent bg-accent/10 shadow-sm"
        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/30"
    );

  const getLocalTabClassName = (isSelected: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 border-transparent px-4 py-3 font-medium transition-all",
      isSelected
        ? "border-accent bg-background text-foreground"
        : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
    );

  const renderModels = (models: LocalModel[], provider: "whisper" | "nvidia") => (
    <div className="space-y-2">
      {models.map((model) => {
        const modelId = model.model;
        const info =
          (provider === "nvidia" ? PARAKEET_MODEL_INFO : WHISPER_MODEL_INFO)[modelId] || {
            name: modelId,
            description: "Model",
            size: "Unknown",
          };
        const isSelected = modelId === selectedLocalModel;
        const isDownloading = isDownloadingModel(modelId);
        const isDownloaded = model.downloaded;

        return (
          <div
            key={modelId}
            className={`p-3 rounded-lg border-2 transition-all ${
              isSelected ? styles.modelCard.selected : styles.modelCard.default
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={provider} className="w-4 h-4" />
                  <span className="font-medium text-foreground">{info.name}</span>
                  {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                  {info.recommended && (
                    <span className={styles.badges.recommended}>Recommended</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                  <span className="text-xs text-muted-foreground">
                    • {model.size_mb ? `${model.size_mb}MB` : info.size}
                  </span>
                  {isDownloaded && (
                    <span className={styles.badges.downloaded}>
                      <Check className="inline w-3 h-3 mr-1" />
                      Downloaded
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isDownloaded ? (
                  <>
                    {!isSelected && (
                      <Button
                        onClick={() => onLocalModelSelect(modelId)}
                        size="sm"
                        variant="outline"
                        className={styles.buttons.select}
                      >
                        Select
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDelete(modelId)}
                      size="sm"
                      variant="outline"
                      className={styles.buttons.delete}
                    >
                      <Trash2 size={14} />
                      <span className="ml-1">Delete</span>
                    </Button>
                  </>
                ) : isDownloading ? (
                  <Button
                    onClick={cancelDownload}
                    disabled={isCancelling}
                    size="sm"
                    variant="outline"
                    className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                  >
                    <X size={14} />
                    <span className="ml-1">{isCancelling ? "..." : "Cancel"}</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => downloadModel(modelId, onLocalModelSelect)}
                    size="sm"
                    className={styles.buttons.download}
                  >
                    <Download size={14} />
                    <span className="ml-1">Download</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderLocalProviderTab = (
    provider: (typeof LOCAL_PROVIDER_TABS)[0],
    isSelected: boolean
  ) => {
    return (
      <button
        key={provider.id}
        onClick={() => handleLocalProviderChange(provider.id)}
        className={getLocalTabClassName(isSelected)}
      >
        <ProviderIcon provider={provider.id} className="w-5 h-5" />
        <span>{provider.name}</span>
        {provider.badge && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {provider.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => handleModeChange(false)}
          className={getModeCardClassName(!useLocalWhisper)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-accent" />
              <h4 className="font-medium text-foreground">Cloud</h4>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
              Fast
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Transcription via API. Fast and accurate, requires internet.
          </p>
        </button>

        <button
          onClick={() => handleModeChange(true)}
          className={getModeCardClassName(useLocalWhisper)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-accent" />
              <h4 className="font-medium text-foreground">Local</h4>
            </div>
            <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">Private</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Runs on your device. Complete privacy, works offline.
          </p>
        </button>
      </div>

      {!useLocalWhisper ? (
        <div className="space-y-4">
          <div className={styles.container}>
            <ProviderTabs
              providers={CLOUD_PROVIDER_TABS}
              selectedId={selectedCloudProvider}
              onSelect={handleCloudProviderChange}
              colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
              scrollable
            />

            <div className="p-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Select Model</h4>
                <ModelCardList
                  models={cloudModelOptions}
                  selectedModel={selectedCloudModel}
                  onModelSelect={onCloudModelSelect}
                  colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
                />
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">API Configuration</h4>
                  <ApiKeyInput
                    apiKey={selectedCloudProvider === "groq" ? groqApiKey : openaiApiKey}
                    setApiKey={selectedCloudProvider === "groq" ? setGroqApiKey : setOpenaiApiKey}
                    helpText={
                      selectedCloudProvider === "groq" ? (
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
                      ) : (
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
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.container}>
          <div className="flex border-b border-border bg-secondary/60">
            {LOCAL_PROVIDER_TABS.map((provider) =>
              renderLocalProviderTab(provider, internalLocalProvider === provider.id)
            )}
          </div>

          {progressDisplay}

          <div className="p-4">
            <h5 className={`${styles.header} mb-3`}>Available Models</h5>

            {internalLocalProvider === "whisper" && renderModels(localModels, "whisper")}
            {internalLocalProvider === "nvidia" && renderModels(parakeetModels, "nvidia")}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
