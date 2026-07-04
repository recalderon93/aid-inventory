import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({ initials, size = "md", className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-foreground font-medium text-background",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallbackName?: string | null,
  role?: string | null
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`;
  if (first) return first.slice(0, 2);
  if (last) return last.slice(0, 2);
  if (fallbackName) {
    const parts = fallbackName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    const trimmed = fallbackName.trim();
    if (trimmed) return trimmed.slice(0, 2);
  }
  if (role) return role.slice(0, 2).toUpperCase();
  return "?";
}
