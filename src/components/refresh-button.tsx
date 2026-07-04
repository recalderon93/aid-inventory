"use client";

import { Button } from "@/components/ui/button";
import { es } from "@/locales/es";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onClick: () => void;
  refreshing?: boolean;
  className?: string;
}

export function RefreshButton({ onClick, refreshing, className }: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={onClick}
      disabled={refreshing}
      aria-label={es.app.refresh}
    >
      <RefreshCw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} />
    </Button>
  );
}
