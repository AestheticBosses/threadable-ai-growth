import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PIPELINE_STAGES = [
  { delay: 0, label: "Analyzing your post performance..." },
  { delay: 15_000, label: "Running statistical regression..." },
  { delay: 30_000, label: "Discovering content archetypes..." },
  { delay: 45_000, label: "Optimizing brand strategy..." },
  { delay: 60_000, label: "Building content plan..." },
  { delay: 75_000, label: "Generating CMO summary..." },
  { delay: 90_000, label: "Finalizing your updated strategy..." },
];

export function WeeklyRefreshCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pipelineStage, setPipelineStage] = useState(PIPELINE_STAGES[0].label);
  const pipelineTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-refresh-summary", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("weekly_refresh_summary, last_weekly_refresh_at")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const summary = data?.weekly_refresh_summary as {
    headline?: string;
    changes?: (string | { type?: string; change?: string })[];
    top_insight?: string;
    recommendation?: string;
  } | null;

  const hasSummary = summary && (summary.headline || (summary.changes && summary.changes.length > 0));

  const lastRefresh = data?.last_weekly_refresh_at ? new Date(data.last_weekly_refresh_at) : null;
  const minutesSinceRefresh = lastRefresh ? (Date.now() - lastRefresh.getTime()) / (1000 * 60) : null;
  const isActivelyRefreshing = !hasSummary && minutesSinceRefresh !== null && minutesSinceRefresh <= 5;
  const isStale = !hasSummary && minutesSinceRefresh !== null && minutesSinceRefresh > 5;

  // Cycle through pipeline stage messages while actively refreshing
  useEffect(() => {
    if (!isActivelyRefreshing) {
      pipelineTimers.current.forEach(clearTimeout);
      pipelineTimers.current = [];
      return;
    }

    // Calculate how far along we already are based on elapsed time
    const elapsedMs = minutesSinceRefresh !== null ? minutesSinceRefresh * 60 * 1000 : 0;

    // Set the initial stage based on elapsed time
    let initialStage = PIPELINE_STAGES[0].label;
    for (const stage of PIPELINE_STAGES) {
      if (elapsedMs >= stage.delay) initialStage = stage.label;
    }
    setPipelineStage(initialStage);

    // Schedule future stages
    for (const stage of PIPELINE_STAGES) {
      const remaining = stage.delay - elapsedMs;
      if (remaining > 0) {
        pipelineTimers.current.push(
          setTimeout(() => setPipelineStage(stage.label), remaining)
        );
      }
    }

    return () => {
      pipelineTimers.current.forEach(clearTimeout);
      pipelineTimers.current = [];
    };
  }, [isActivelyRefreshing, minutesSinceRefresh]);

  if (isLoading || !data?.last_weekly_refresh_at) return null;

  const daysSince = lastRefresh ? (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24) : 999;
  if (daysSince > 7) return null;

  const formattedDate = lastRefresh!.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const handleApply = async () => {
    if (!user?.id) return;
    await supabase
      .from("profiles")
      .update({ weekly_refresh_summary: null })
      .eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["weekly-refresh-summary"] });
    toast({ title: "Strategy applied", description: "Your plan is up to date" });
  };

  const handleDiscuss = () => {
    if (!summary) return;
    const changesText = summary.changes?.map(c => typeof c === "string" ? c : `${c.type ? c.type + ": " : ""}${c.change}`).join(". ") || "";
    const message = `My CMO strategy was just updated. Here's the summary: ${summary.headline || "Weekly strategy refresh"}. ${changesText}. Can you help me review this and suggest any adjustments before I apply it?`;
    navigate("/chat", { state: { cmoSummaryMessage: message } });
  };

  // Actively refreshing — show pulsing dot with cycling stages
  if (isActivelyRefreshing) {
    return (
      <Card className="border-purple-500/30 bg-purple-500/5">
        <CardContent className="px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
            </span>
            <p className="text-sm font-medium text-foreground">{pipelineStage}</p>
          </div>
          <p className="text-[11px] text-muted-foreground pl-5">This takes about 2-3 minutes.</p>
        </CardContent>
      </Card>
    );
  }

  // Stale refresh with no summary — likely failed
  if (isStale) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Strategy refresh may have failed. Try running <span className="font-medium text-foreground">Analyze &amp; Optimize</span> again from Playbook.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No summary and not refreshing — nothing to show
  if (!hasSummary) return null;

  // Full summary card with action buttons
  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3 min-w-0">
            <RefreshCw className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-foreground">{summary!.headline || "Weekly strategy refresh"}</p>

              {summary!.changes && summary!.changes.length > 0 && (
                <ul className="space-y-1">
                  {summary!.changes.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-purple-400 shrink-0">-</span>
                      <span>{typeof c === "string" ? c : <>{c.type ? <strong className="text-foreground/80">{c.type}:</strong> : null} {c.change}</>}</span>
                    </li>
                  ))}
                </ul>
              )}

              {summary!.top_insight && (
                <p className="text-xs text-purple-300/90">
                  <strong>Insight:</strong> {summary!.top_insight}
                </p>
              )}

              {summary!.recommendation && (
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground/80">Next step:</strong> {summary!.recommendation}
                </p>
              )}

              <p className="text-[10px] text-muted-foreground/60">Updated {formattedDate}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5"
              onClick={handleApply}
            >
              <Check className="h-3.5 w-3.5" />
              Apply to My Plan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleDiscuss}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Discuss with CMO
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
