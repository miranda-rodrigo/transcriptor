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

// Every picker shares one token-based look; the ColorScheme parameter is kept so
// call sites don't need to change.
const TOKEN_STYLES: ModelPickerStyles = {
  container: "rounded-xl overflow-hidden border border-border bg-card",
  progress: "border-b border-border bg-secondary/70",
  progressText: "text-foreground",
  progressBar: "bg-secondary",
  progressFill: "bg-accent",
  header: "font-medium text-foreground",
  modelCard: {
    selected: "border-accent bg-accent/5",
    default: "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/30",
  },
  badges: {
    selected: "text-xs text-accent bg-accent/10 px-2 py-1 rounded-full font-medium",
    downloaded: "text-xs text-accent bg-accent/10 px-2 py-0.5 rounded",
    recommended: "text-xs text-foreground bg-secondary px-2 py-0.5 rounded",
  },
  buttons: {
    download: "bg-primary text-primary-foreground hover:bg-primary/90",
    select: "border-border bg-secondary text-foreground hover:bg-secondary/80",
    delete:
      "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
    refresh: "border-border bg-secondary text-foreground hover:bg-secondary/80",
  },
};

export const MODEL_PICKER_COLORS: Record<ColorScheme, ModelPickerStyles> = {
  purple: TOKEN_STYLES,
  indigo: TOKEN_STYLES,
  blue: TOKEN_STYLES,
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
