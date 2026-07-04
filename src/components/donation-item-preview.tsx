import { cn, capitalizeWords } from "@/lib/utils";
import { es } from "@/locales/es";
import type { DonationItemStatus } from "@/types/database";

export interface DonationItemPreviewData {
  description: string;
  presentation?: string | null;
  unit_of_measurement?: string | null;
  subcategory?: string | null;
  category?: string | null;
  status?: DonationItemStatus;
  quantity?: number;
}

function joinParts(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" · ");
}

export function getAvailabilityIndicator(
  quantity?: number,
  status?: DonationItemStatus
): { colorClass: string; label: string } {
  if (status === "out_of_stock" || quantity === 0) {
    return { colorClass: "bg-red-500", label: es.inventory.outOfStock };
  }
  if (status === "needed") {
    return { colorClass: "bg-amber-500", label: es.inventory.needed };
  }
  if (quantity !== undefined && quantity <= 5) {
    return { colorClass: "bg-amber-400", label: es.inventory.lowStock };
  }
  if (status === "archived") {
    return { colorClass: "bg-neutral-400", label: es.inventory.archived };
  }
  return { colorClass: "bg-green-500", label: es.inventory.available };
}

interface DonationItemPreviewProps extends DonationItemPreviewData {
  className?: string;
  quantityLabel?: string;
  showQuantity?: boolean;
}

export function DonationItemPreview({
  description,
  presentation,
  unit_of_measurement,
  subcategory,
  category,
  status,
  quantity,
  className,
  quantityLabel,
  showQuantity = quantity !== undefined,
}: DonationItemPreviewProps) {
  const primary = joinParts([
    capitalizeWords(description),
    presentation ? capitalizeWords(presentation) : null,
    unit_of_measurement ? capitalizeWords(unit_of_measurement) : null,
  ]);
  const secondary = joinParts([
    subcategory ? capitalizeWords(subcategory) : null,
    category ? capitalizeWords(category) : null,
  ]);
  const indicator = getAvailabilityIndicator(quantity, status);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium leading-snug">{primary}</p>
        {showQuantity && quantity !== undefined && (
          <div className="shrink-0 text-right">
            <p className="font-bold tabular-nums">{quantity}</p>
            {quantityLabel && (
              <p className="text-xs text-muted">{quantityLabel}</p>
            )}
          </div>
        )}
      </div>
      {(secondary || status !== undefined || quantity !== undefined) && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <span
            className={cn("inline-block h-2 w-2 shrink-0 rounded-full", indicator.colorClass)}
            title={indicator.label}
            aria-label={indicator.label}
          />
          {secondary ? <span className="truncate">{secondary}</span> : null}
        </p>
      )}
    </div>
  );
}
