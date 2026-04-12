import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Settings,
  Mic,
  Brain,
  User,
  Sparkles,
  FileText,
  Trash2,
  Download,
  RefreshCw,
  Loader2,
  Power,
  Copy,
} from "lucide-react";
import SupportDropdown from "./ui/SupportDropdown";
import TranscriptionItem from "./ui/TranscriptionItem";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useToast } from "./ui/Toast";
import { useUpdater } from "../hooks/useUpdater";
import SettingsPage from "./SettingsPage";
import WindowControls from "./WindowControls";
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  clearTranscriptions as clearStoreTranscriptions,
} from "../stores/transcriptionStore";

import type { SettingsSectionType } from "./SettingsPage";

type SectionType = SettingsSectionType | "history";

interface NavItem {
  id: SectionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "transcription", label: "Transcription Mode", icon: Mic },
  { id: "aiModels", label: "AI Models", icon: Brain },
  { id: "agentConfig", label: "Agent Configuration", icon: User },
  { id: "prompts", label: "AI Prompts", icon: Sparkles },
  { id: "history", label: "Recent Transcriptions", icon: FileText },
];

const SECTION_TITLES: Record<SectionType, string> = {
  general: "General",
  transcription: "Transcription Mode",
  aiModels: "AI Models",
  agentConfig: "Agent Configuration",
  prompts: "AI Prompts",
  history: "Recent Transcriptions",
};

export default function ControlPanel() {
  const history = useTranscriptions();
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionType>("general");
  const { toast } = useToast();

  const {
    status: updateStatus,
    downloadProgress,
    isDownloading,
    isInstalling,
    downloadUpdate,
    installUpdate,
    error: updateError,
  } = useUpdater();

  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const platform =
    typeof window !== "undefined" && window.electronAPI?.getPlatform
      ? window.electronAPI.getPlatform()
      : "darwin";

  useEffect(() => {
    loadTranscriptions();
  }, []);

  useEffect(() => {
    if (updateStatus.updateDownloaded && !isDownloading) {
      toast({
        title: "Update Ready",
        description: "Click 'Install Update' to restart and apply the update.",
        variant: "success",
      });
    }
  }, [updateStatus.updateDownloaded, isDownloading, toast]);

  useEffect(() => {
    if (updateError) {
      toast({
        title: "Update Error",
        description: "Failed to update. Please try again later.",
        variant: "destructive",
      });
    }
  }, [updateError, toast]);

  const loadTranscriptions = async () => {
    try {
      setIsLoading(true);
      await initializeTranscriptions();
    } catch {
      showAlertDialog({
        title: "Unable to load history",
        description: "Please try again in a moment.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Text copied to your clipboard",
        variant: "success",
        duration: 2000,
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const clearHistory = async () => {
    showConfirmDialog({
      title: "Clear History",
      description:
        "Are you certain you wish to clear all transcriptions? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.clearTranscriptions();
          clearStoreTranscriptions();
          showAlertDialog({
            title: "History Cleared",
            description: `Successfully cleared ${result.cleared} transcriptions.`,
          });
        } catch {
          showAlertDialog({
            title: "Error",
            description: "Failed to clear history. Please try again.",
          });
        }
      },
      variant: "destructive",
    });
  };

  const deleteTranscription = async (id: number) => {
    showConfirmDialog({
      title: "Delete Transcription",
      description: "Are you certain you wish to remove this transcription?",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.deleteTranscription(id);
          if (result.success) {
            removeFromStore(id);
          } else {
            showAlertDialog({
              title: "Delete Failed",
              description: "Failed to delete transcription. It may have already been removed.",
            });
          }
        } catch {
          showAlertDialog({
            title: "Delete Failed",
            description: "Failed to delete transcription. Please try again.",
          });
        }
      },
      variant: "destructive",
    });
  };

  const handleUpdateClick = async () => {
    if (updateStatus.updateDownloaded) {
      showConfirmDialog({
        title: "Install Update",
        description:
          "The update will be installed and the app will restart. Make sure you've saved any work.",
        onConfirm: async () => {
          try {
            await installUpdate();
          } catch {
            toast({
              title: "Install Failed",
              description: "Failed to install update. Please try again.",
              variant: "destructive",
            });
          }
        },
      });
    } else if (updateStatus.updateAvailable && !isDownloading) {
      try {
        await downloadUpdate();
      } catch {
        toast({
          title: "Download Failed",
          description: "Failed to download update. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleQuit = async () => {
    try {
      await window.electronAPI?.appQuit?.();
    } catch {
      // silently handle
    }
  };

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const renderHistorySection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Transcription History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your recent speech-to-text transcriptions.
          </p>
        </div>
        {history.length > 0 && (
          <Button
            onClick={clearHistory}
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/20 hover:bg-destructive/10"
          >
            <Trash2 size={14} className="mr-1.5" />
            Clear All
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Loading transcriptions...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
            <Mic className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground mb-2">No transcriptions yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Press your hotkey to start recording and create your first transcription.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item, index) => (
            <TranscriptionItem
              key={item.id}
              item={item}
              index={index}
              total={history.length}
              onCopy={copyToClipboard}
              onDelete={deleteTranscription}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (activeSection === "history") {
      return renderHistorySection();
    }
    return <SettingsPage activeSection={activeSection as SettingsSectionType} />;
  };

  const showUpdateCard =
    !updateStatus.isDevelopment &&
    (updateStatus.updateAvailable || updateStatus.updateDownloaded || isDownloading || isInstalling);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={hideConfirmDialog}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={hideAlertDialog}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />
      <ConfirmDialog
        open={showQuitConfirm}
        onOpenChange={setShowQuitConfirm}
        title="Quit OpenWhispr?"
        description="This will close OpenWhispr and stop background processes."
        confirmText="Quit"
        cancelText="Cancel"
        onConfirm={handleQuit}
        variant="destructive"
      />

      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-6 border-b border-border" style={{ WebkitAppRegion: "drag" }}>
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: "no-drag" }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">OpenWhispr</h2>
              <p className="text-xs text-muted-foreground">v1.2.13</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Update card in sidebar footer */}
        {showUpdateCard && (
          <div className="p-4 border-t border-border">
            <div className="rounded-lg bg-secondary/50 p-4">
              {updateStatus.updateDownloaded ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Update Ready</p>
                  <button
                    onClick={handleUpdateClick}
                    disabled={isInstalling}
                    className="w-full rounded-md bg-accent text-accent-foreground py-2 text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {isInstalling ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Installing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={14} />
                        Install Update
                      </span>
                    )}
                  </button>
                </>
              ) : isDownloading ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Downloading...</p>
                  <div className="w-full bg-secondary rounded-full h-2 mb-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-foreground text-center">{downloadProgress}%</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Update Available</p>
                  <button
                    onClick={handleUpdateClick}
                    className="w-full rounded-md bg-accent text-accent-foreground py-2 text-sm font-medium hover:bg-accent/90 transition-colors"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Download size={14} />
                      Download Update
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sidebar footer with support and quit */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <SupportDropdown />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQuitConfirm(true)}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Quit OpenWhispr"
          >
            <Power size={16} />
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-8 py-4"
          style={{ WebkitAppRegion: "drag" }}
        >
          <h1
            className="text-lg font-medium text-foreground"
            style={{ WebkitAppRegion: "no-drag" }}
          >
            {SECTION_TITLES[activeSection]}
          </h1>
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
            {platform !== "darwin" && <WindowControls />}
          </div>
        </div>

        <div className="px-8 py-6 max-w-4xl">{renderContent()}</div>
      </main>
    </div>
  );
}
