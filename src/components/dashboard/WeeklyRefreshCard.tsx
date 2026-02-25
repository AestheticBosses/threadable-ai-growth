import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function WeeklyRefreshCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  });

  if (isLoading || !data?.weekly_refresh_summary || !data?.last_weekly_refresh_at) return null;

  const lastRefresh = new Date(data.last_weekly_refresh_at);
  const daysSince = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 7) return null;

  const summary = data.weekly_refresh_summary as {
    headline?: string;
    changes?: { type?: string; change?: string }[];
    top_insight?: string;
    recommendation?: string;
  };

  const handleDismiss = async () => {
    if (!user?.id) return;
    await supabase
      .from("profiles")
      .update({ weekly_refresh_summary: null })
      .eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["weekly-refresh-summary"] });
  };

  const formattedDate = lastRefresh.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-xl mt-0.5 shrink-0">🧠</span>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-foreground">{summary.headline || "Weekly strategy refresh"}</p>

              {summary.changes && summary.changes.length > 0 && (
                <ul className="space-y-1">
                  {summary.changes.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-purple-400 shrink-0">-</span>
                      <span>{c.type ? <strong className="text-foreground/80">{c.type}:</strong> : null} {c.change}</span>
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

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
