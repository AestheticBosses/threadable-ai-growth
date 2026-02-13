import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";

const STEPS = [
  "Analyzing your story...",
  "Referencing your voice profile...",
  "Defining your angle...",
  "Crafting your hook...",
  "Writing your post...",
];

const STEP_DELAY = 1500;

export function DraftingProgress() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(setTimeout(() => setCurrentStep(i), STEP_DELAY * i));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-[600px] mx-auto px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Drafting your post...</h3>
        <div className="space-y-3">
          {STEPS.map((step, i) => (
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
    </div>
  );
}
