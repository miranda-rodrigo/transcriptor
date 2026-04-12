import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Download, Trash2, Check, X } from "lucide-react";
import { ProviderIcon } from "./ui/ProviderIcon";
import { ProviderTabs } from "./ui/ProviderTabs";
import { DownloadProgressBar } from "./ui/DownloadProgressBar";
import { ConfirmDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useModelDownload, type ModelType } from "../hooks/useModelDownload";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";

export interface LocalModel {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  description: string;
  isDownloaded?: boolean;
  downloaded?: boolean;
  recommended?: boolean;
  hfId?: string;
}

export interface LocalProvider {
  id: string;
  name: string;
  models: LocalModel[];
}

interface LocalModelPickerProps {
  providers: LocalProvider[];
  selectedModel: string;
  selectedProvider: string;
  onModelSelect: (modelId: string) => void;
  onProviderSelect: (providerId: string) => void;
  modelType: ModelType;
  colorScheme?: Exclude<ColorScheme, "blue">;
  className?: string;
  onDownloadComplete?: () => void;
}

export default function LocalModelPicker({
  providers,
  selectedModel,
  selectedProvider,
  onModelSelect,
  onProviderSelect,
  modelType,
  colorScheme = "purple",
  className = "",
  onDownloadComplete,
}: LocalModelPickerProps) {
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);

  const isMlxProvider = selectedProvider === "mlx";
  const [mlxDownloading, setMlxDownloading] = useState<string | null>(null);
  const [mlxProgress, setMlxProgress] = useState(0);

  const loadDownloadedModels = useCallback(async () => {
    try {
      let downloaded = new Set<string>();
      if (isMlxProvider) {
        const allModels = providers.flatMap((p) => p.models);
        const hfIds = allModels.filter((m) => m.hfId).map((m) => m.hfId!);
        if (hfIds.length > 0) {
          const cached = await window.electronAPI?.mlxModelCheckAll?.(hfIds);
          if (cached) {
            for (const model of allModels) {
              if (model.hfId && cached[model.hfId]) {
                downloaded.add(model.id);
              }
            }
          }
        }
      } else if (modelType === "whisper") {
        const result = await window.electronAPI?.listWhisperModels();
        if (result?.success) {
          downloaded = new Set(
            result.models
              .filter((m: { downloaded?: boolean }) => m.downloaded)
              .map((m: { model: string }) => m.model)
          );
        }
      } else {
        const result = await window.electronAPI?.modelGetAll?.();
        if (result && Array.isArray(result)) {
          downloaded = new Set(
            result
              .filter((m: { isDownloaded?: boolean }) => m.isDownloaded)
              .map((m: { id: string }) => m.id)
          );
        }
      }
      setDownloadedModels(downloaded);
      return downloaded;
    } catch (error) {
      console.error("Failed to load downloaded models:", error);
      return new Set<string>();
    }
  }, [modelType, isMlxProvider, providers]);

  useEffect(() => {
    const initAndValidate = async () => {
      const downloaded = await loadDownloadedModels();
      const willClear = selectedModel && !downloaded.has(selectedModel);
      if (willClear) {
        onModelSelect("");
      }
    };
    initAndValidate();
  }, [loadDownloadedModels, selectedModel, onModelSelect]);

  const handleDownloadComplete = useCallback(() => {
    loadDownloadedModels();
    onDownloadComplete?.();
  }, [loadDownloadedModels, onDownloadComplete]);

  const {
    downloadingModel,
    downloadProgress,
    downloadModel,
    deleteModel,
    isDownloadingModel,
    cancelDownload,
    isCancelling,
  } = useModelDownload({
    modelType,
    onDownloadComplete: handleDownloadComplete,
    onModelsCleared: loadDownloadedModels,
  });

  useEffect(() => {
    if (!isMlxProvider) return;
    const unsub = window.electronAPI?.onMlxDownloadProgress?.((_, data) => {
      if (data?.percentage != null) setMlxProgress(data.percentage);
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [isMlxProvider]);

  const handleMlxDownload = useCallback(async (model: LocalModel) => {
    if (!model.hfId) return;
    setMlxDownloading(model.id);
    setMlxProgress(0);
    try {
      const result = await window.electronAPI.mlxModelDownload(model.hfId);
      if (result.success) {
        await loadDownloadedModels();
        onModelSelect(model.id);
        onDownloadComplete?.();
      }
    } catch (e) {
      console.error("MLX download error:", e);
    } finally {
      setMlxDownloading(null);
      setMlxProgress(0);
    }
  }, [loadDownloadedModels, onModelSelect, onDownloadComplete]);

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const models = currentProvider?.models || [];

  const handleDownload = useCallback(
    (modelId: string) => {
      if (isMlxProvider) {
        const model = models.find((m) => m.id === modelId);
        if (model) handleMlxDownload(model);
        return;
      }
      downloadModel(modelId, onModelSelect);
    },
    [downloadModel, onModelSelect, isMlxProvider, models, handleMlxDownload]
  );

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: () => deleteModel(modelId, loadDownloadedModels),
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, loadDownloadedModels]
  );

  const progressDisplay = useMemo(() => {
    if (mlxDownloading) {
      const modelName = models.find((m) => m.id === mlxDownloading)?.name || mlxDownloading;
      return (
        <DownloadProgressBar
          modelName={modelName}
          progress={{
            percentage: Number.isFinite(mlxProgress) ? mlxProgress : 0,
            downloadedBytes: 0,
            totalBytes: 0,
          }}
          styles={styles}
        />
      );
    }
    if (!downloadingModel) return null;
    const modelName = models.find((m) => m.id === downloadingModel)?.name || downloadingModel;
    return (
      <DownloadProgressBar modelName={modelName} progress={downloadProgress} styles={styles} />
    );
  }, [downloadingModel, downloadProgress, models, styles, mlxDownloading, mlxProgress]);

  return (
    <div className={`${styles.container} ${className}`}>
      <ProviderTabs
        providers={providers}
        selectedId={selectedProvider}
        onSelect={onProviderSelect}
        colorScheme={colorScheme}
        scrollable
      />

      {progressDisplay}

      <div className="p-4">
        <h5 className={`${styles.header} mb-3`}>Available Models</h5>

        <div className="space-y-2">
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models available for this provider</p>
          ) : (
            models.map((model) => {
              const isSelected = model.id === selectedModel;
              const isDownloading = isMlxProvider ? mlxDownloading === model.id : isDownloadingModel(model.id);
              const isDownloaded =
                downloadedModels.has(model.id) || model.isDownloaded || model.downloaded;

              return (
                <div
                  key={model.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isSelected ? styles.modelCard.selected : styles.modelCard.default
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ProviderIcon provider={selectedProvider} className="w-4 h-4" />
                        <span className="font-medium text-foreground">{model.name}</span>
                        {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                        {model.recommended && (
                          <span className={styles.badges.recommended}>Recommended</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{model.description}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Size: {model.size}</span>
                        {isDownloaded && (
                          <span className={styles.badges.downloaded}>
                            <Check className="inline w-3 h-3 mr-1" />
                            {isMlxProvider ? "Ready" : "Downloaded"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isDownloaded ? (
                        <>
                          {!isSelected && (
                            <Button
                              onClick={() => onModelSelect(model.id)}
                              size="sm"
                              variant="outline"
                              className={styles.buttons.select}
                            >
                              Select
                            </Button>
                          )}
                          {!isMlxProvider && (
                            <Button
                              onClick={() => handleDelete(model.id)}
                              size="sm"
                              variant="outline"
                              className={styles.buttons.delete}
                            >
                              <Trash2 size={14} />
                              <span className="ml-1">Delete</span>
                            </Button>
                          )}
                        </>
                      ) : isDownloading ? (
                        <Button
                          onClick={cancelDownload}
                          disabled={isCancelling}
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <X size={14} />
                          <span className="ml-1">{isCancelling ? "..." : "Cancel"}</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleDownload(model.id)}
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
            })
          )}
        </div>
      </div>

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
