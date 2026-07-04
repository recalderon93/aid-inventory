import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  steps: { label: string }[];
  currentStep: number;
  stepLabel: string;
  className?: string;
}

export function StepProgress({ steps, currentStep, stepLabel, className }: StepProgressProps) {
  const progressPercent = (currentStep / steps.length) * 100;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted">{stepLabel}</span>
        <span className="font-medium text-foreground">{steps[currentStep - 1]?.label}</span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={steps.length}
      >
        <div
          className="h-full rounded-full bg-foreground transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-start">
        {steps.map((step, i) => {
          const n = i + 1;
          const isComplete = n < currentStep;
          const isCurrent = n === currentStep;

          return (
            <div key={step.label} className="flex min-w-0 flex-1 items-start">
              {i > 0 && (
                <div
                  className={cn(
                    "mt-3.5 h-0.5 flex-1 transition-colors",
                    n <= currentStep ? "bg-foreground" : "bg-border"
                  )}
                />
              )}
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    isComplete && "bg-foreground text-background",
                    isCurrent &&
                      "border-2 border-foreground bg-surface-1 text-foreground shadow-[0_0_0_3px] shadow-foreground/15",
                    !isComplete && !isCurrent && "border border-border bg-surface-1 text-muted"
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
                </div>
                <span
                  className={cn(
                    "max-w-[4.25rem] text-center text-[10px] leading-tight sm:max-w-none sm:text-xs",
                    isCurrent ? "font-semibold text-foreground" : "text-muted"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "mt-3.5 h-0.5 flex-1 transition-colors",
                    n < currentStep ? "bg-foreground" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
