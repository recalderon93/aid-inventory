import Link from "next/link";
import { cn } from "@/lib/utils";
import { es } from "@/locales/es";
import type { SlotStatus } from "@/types/database";

const cardClassName =
  "relative flex flex-col items-center justify-center rounded-xl border border-border bg-surface-1 p-3 pt-4 transition-all hover:border-foreground/50 hover:bg-surface-2 hover:shadow-sm active:scale-[0.97] sm:p-4 sm:pt-5";

interface SlotCardProps {
  number: string;
  status?: SlotStatus;
  className?: string;
}

function SlotCardContent({ number, status }: SlotCardProps) {
  return (
    <>
      {status && (
        <span
          className={cn(
            "absolute right-2 top-2 h-2.5 w-2.5 rounded-full",
            status === "active" ? "bg-green-500" : "bg-neutral-400 dark:bg-neutral-500"
          )}
          title={es.slots.statuses[status]}
          aria-label={es.slots.statuses[status]}
        />
      )}
      <span className="text-xl font-bold sm:text-2xl">{number}</span>
    </>
  );
}

export function SlotCardLink({ number, status, href, className }: SlotCardProps & { href: string }) {
  return (
    <Link href={href} className={cn(cardClassName, className)}>
      <SlotCardContent number={number} status={status} />
    </Link>
  );
}

export function SlotCardButton({
  number,
  status,
  className,
  onClick,
}: SlotCardProps & { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(cardClassName, "w-full", className)}>
      <SlotCardContent number={number} status={status} />
    </button>
  );
}
