import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "../lib/utils";
import { useTheme } from "../../hooks/useTheme";
import type { ThemeSource } from "../../types/electron";

const OPTIONS: { value: ThemeSource; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { themeSource, setThemeSource } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = themeSource === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} appearance`}
            title={label}
            onClick={() => setThemeSource(value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
