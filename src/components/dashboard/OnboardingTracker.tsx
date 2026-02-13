import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";

export function OnboardingTracker() {
  const { data: steps, isLoading } = useOnboardingProgress();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !steps) return null;

  const completed = steps.filter((s) => s.complete).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  if (allDone && dismissed) return null;

  const nextStep = steps.find((s) => !s.complete);

  return (
    <div className="mx-2 mb-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 space-y-2">
      {allDone ? (
        <button
          onClick={() => setDismissed(true)}
          className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>🎉 Setup complete!</span>
          <span className="ml-auto text-xs text-muted-foreground">dismiss</span>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Getting Started</span>
            <span className="text-xs font-semibold text-muted-foreground">{completed}/{total}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          {nextStep && (
            <button
              onClick={() => navigate(nextStep.navigateTo)}
              className="text-xs text-primary hover:underline truncate block w-full text-left"
            >
              Next: {nextStep.label} →
            </button>
          )}
        </>
      )}
    </div>
  );
}
