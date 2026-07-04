"use client";

import { useTheme } from "@/components/providers";
import { es } from "@/locales/es";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";

export function ThemeSection() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const useSystem = theme === "system";
  const manualTheme = useSystem ? resolvedTheme : theme;
  const isDark = manualTheme === "dark";

  const StatusIcon = useSystem ? Monitor : isDark ? Moon : Sun;
  const statusLabel = useSystem
    ? es.menu.themeSystem
    : isDark
      ? es.menu.themeDark
      : es.menu.themeLight;

  function handleToggle() {
    setTheme(isDark ? "light" : "dark");
  }

  function handleSystemChange(checked: boolean) {
    setTheme(checked ? "system" : resolvedTheme);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusIcon className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span className="text-sm font-medium">
            {es.menu.theme} · {statusLabel}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={`${es.menu.theme}: ${statusLabel}`}
          disabled={useSystem}
          onClick={handleToggle}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed",
            isDark ? "bg-foreground" : "bg-border",
            useSystem && "opacity-50"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-background shadow-sm transition-transform",
              isDark && "translate-x-5"
            )}
          />
        </button>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={useSystem}
          onChange={(e) => handleSystemChange(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-foreground"
        />
        <span>{es.menu.themeMatchSystem}</span>
      </label>
    </section>
  );
}
