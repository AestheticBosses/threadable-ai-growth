import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function WeeklyRefreshCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  if (isLoading || !data?.last_weekly_refresh_at) return null;

  const lastRefresh = new Date(data.last_weekly_refresh_at);
  const daysSince = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 7) return null;

  const formattedDate = lastRefresh.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const summary = data.weekly_refresh_summary as {
    headline?: string;
    changes?: (string | { type?: string; change?: string })[];
    top_insight?: string;
    recommendation?: string;
  } | null;

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

  // Summary not yet generated — show simple date line
  if (!summary) {
    return (
      <Card className="border-purple-500/30 bg-purple-500/5">
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="h-4 w-4 text-purple-400 shrink-0 animate-spin" />
            <p className="text-sm text-muted-foreground">
              Strategy refreshing… started <span className="font-medium text-foreground">{formattedDate}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full summary card with action buttons
  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3 min-w-0">
            <RefreshCw className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-foreground">{summary.headline || "Weekly strategy refresh"}</p>

              {summary.changes && summary.changes.length > 0 && (
                <ul className="space-y-1">
                  {summary.changes.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-purple-400 shrink-0">-</span>
                      <span>{typeof c === "string" ? c : <>{c.type ? <strong className="text-foreground/80">{c.type}:</strong> : null} {c.change}</>}</span>
                    </li>
                  ))}
                </ul>
              )}

              {summary.top_insight && (
                <p className="text-xs text-purple-300/90">
                  <strong>Insight:</strong> {summary.top_insight}
                </p>
              )}

              {summary.recommendation && (
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground/80">Next step:</strong> {summary.recommendation}
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
