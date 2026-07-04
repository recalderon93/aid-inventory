import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md";
  showText?: boolean;
  className?: string;
}

const sizes = { sm: 28, md: 36 };

function LogoIcon({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className="shrink-0 text-foreground"
    >
      <rect x="4" y="12" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <path d="M4 20h40" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M16 12V8a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M24 26c-2.5 0-4.5 1.5-4.5 3.5 0 2.5 4.5 6 4.5 6s4.5-3.5 4.5-6c0-2-2-3.5-4.5-3.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const px = sizes[size];
  return (
    <div className={cn("flex items-center gap-2.5 text-foreground", className)}>
      <LogoIcon size={px} />
      {showText && (
        <span className={cn("font-semibold tracking-tight", size === "sm" ? "text-base" : "text-lg")}>
          Inventario Caritas
        </span>
      )}
    </div>
  );
}
