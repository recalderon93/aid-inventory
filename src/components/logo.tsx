import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md";
  showText?: boolean;
  className?: string;
}

const sizes = { sm: 28, md: 36 };

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const px = sizes[size];
  return (
    <div className={cn("flex items-center gap-2.5 text-foreground", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" width={px} height={px} className="shrink-0" />
      {showText && (
        <span className={cn("font-semibold tracking-tight", size === "sm" ? "text-base" : "text-lg")}>
          Inventario Caritas
        </span>
      )}
    </div>
  );
}
