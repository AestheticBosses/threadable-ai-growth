import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";

interface DraftingProgressProps {
  variant?: "ideas" | "analysis";
}

const IDEA_STEPS = [
  "Understanding your topic...",
  "Writing your posts...",
];

const ANALYSIS_STEPS = [
  "Analyzing this post...",
  "Preparing preview...",
];

const STEP_DELAY = 800;

export function DraftingProgress({ variant = "analysis" }: DraftingProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = variant === "ideas" ? IDEA_STEPS : ANALYSIS_STEPS;

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    for (let i = 1; i < steps.length; i++) {
      timers.push(setTimeout(() => setCurrentStep(i), STEP_DELAY * i));
    }
    return () => timers.forEach(clearTimeout);
  }, [steps.length]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {variant === "ideas" ? "Generating posts..." : "Preparing preview..."}
      </h3>
      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {i < currentStep ? (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            ) : i === currentStep ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            ) : (
              <div className="h-4 w-4 shrink-0" />
            )}
            <span className={i <= currentStep ? "text-foreground" : "text-muted-foreground/40"}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
