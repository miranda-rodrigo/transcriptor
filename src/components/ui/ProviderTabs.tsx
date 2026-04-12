import { ReactNode } from "react";
import { ProviderIcon } from "./ProviderIcon";
import type { ColorScheme as BaseColorScheme } from "../../utils/modelPickerStyles";
import { cn } from "../lib/utils";

export interface ProviderTabItem {
  id: string;
  name: string;
}

type ColorScheme = Exclude<BaseColorScheme, "blue"> | "dynamic";

interface ProviderTabsProps {
  providers: ProviderTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderIcon?: (providerId: string) => ReactNode;
  colorScheme?: ColorScheme;
  /** Allow horizontal scrolling for many providers */
  scrollable?: boolean;
}

const COLOR_CONFIG: Record<
  Exclude<ColorScheme, "dynamic">,
  { selected: string; idle: string }
> = {
  indigo: {
    selected: "border-accent bg-background text-foreground",
    idle: "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
  },
  purple: {
    selected: "border-accent bg-background text-foreground",
    idle: "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
  },
};

export function ProviderTabs({
  providers,
  selectedId,
  onSelect,
  renderIcon,
  colorScheme = "indigo",
  scrollable = false,
}: ProviderTabsProps) {
  const colors = colorScheme !== "dynamic" ? COLOR_CONFIG[colorScheme] : null;
  const fallbackColors = {
    selected: "border-accent bg-background text-foreground",
    idle: "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
  };

  return (
    <div
      className={cn(
        "flex border-b border-border bg-secondary/60",
        scrollable && "overflow-x-auto"
      )}
    >
      {providers.map((provider) => {
        const isSelected = selectedId === provider.id;
        const palette = colors ?? fallbackColors;

        return (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={cn(
              "flex-1 border-b-2 border-transparent px-4 py-3 font-medium transition-all",
              "flex items-center justify-center gap-2",
              scrollable && "whitespace-nowrap",
              isSelected ? palette.selected : palette.idle
            )}
          >
            {renderIcon ? renderIcon(provider.id) : <ProviderIcon provider={provider.id} />}
            <span>{provider.name}</span>
          </button>
        );
      })}
    </div>
  );
}
