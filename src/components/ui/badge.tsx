import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        secondary: "border border-border bg-surface-2 text-foreground",
        success: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
        destructive: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
