export type ColorScheme = "purple" | "indigo" | "blue";

export interface ModelPickerStyles {
  container: string;
  progress: string;
  progressText: string;
  progressBar: string;
  progressFill: string;
  header: string;
  modelCard: { selected: string; default: string };
  badges: { selected: string; downloaded: string; recommended: string };
  buttons: { download: string; select: string; delete: string; refresh: string };
}

export const MODEL_PICKER_COLORS: Record<ColorScheme, ModelPickerStyles> = {
  purple: {
    container: "rounded-xl overflow-hidden border border-border bg-card",
    progress: "border-b border-border bg-secondary/70",
    progressText: "text-foreground",
    progressBar: "bg-secondary",
    progressFill: "bg-gradient-to-r from-accent to-emerald-400",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-accent bg-accent/10",
      default: "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/30",
    },
    badges: {
      selected: "text-xs text-accent bg-accent/10 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-accent bg-accent/10 px-2 py-0.5 rounded",
      recommended: "text-xs text-foreground bg-secondary px-2 py-0.5 rounded",
    },
    buttons: {
      download: "bg-accent text-accent-foreground hover:bg-accent/90",
      select: "border-border bg-secondary text-foreground hover:bg-secondary/80",
      delete:
        "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
      refresh: "border-border bg-secondary text-foreground hover:bg-secondary/80",
    },
  },
  indigo: {
    container: "rounded-xl overflow-hidden border border-border bg-card",
    progress: "border-b border-border bg-secondary/70",
    progressText: "text-foreground",
    progressBar: "bg-secondary",
    progressFill: "bg-gradient-to-r from-accent to-emerald-400",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-accent bg-accent/10",
      default: "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/30",
    },
    badges: {
      selected: "text-xs text-accent bg-accent/10 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-accent bg-accent/10 px-2 py-0.5 rounded",
      recommended: "text-xs text-foreground bg-secondary px-2 py-0.5 rounded",
    },
    buttons: {
      download: "bg-accent text-accent-foreground hover:bg-accent/90",
      select: "border-border bg-secondary text-foreground hover:bg-secondary/80",
      delete:
        "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
      refresh: "border-border bg-secondary text-foreground hover:bg-secondary/80",
    },
  },
  blue: {
    container: "rounded-xl overflow-hidden border border-border bg-card",
    progress: "border-b border-border bg-secondary/70",
    progressText: "text-foreground",
    progressBar: "bg-secondary",
    progressFill: "bg-gradient-to-r from-accent to-emerald-400",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-accent bg-accent/10",
      default: "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/30",
    },
    badges: {
      selected: "text-xs text-accent bg-accent/10 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-accent bg-accent/10 px-2 py-1 rounded",
      recommended: "text-xs bg-secondary text-foreground px-2 py-1 rounded",
    },
    buttons: {
      download: "bg-accent text-accent-foreground hover:bg-accent/90",
      select: "border-border bg-secondary text-foreground hover:bg-secondary/80",
      delete:
        "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
      refresh: "border-border bg-secondary text-foreground hover:bg-secondary/80",
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
