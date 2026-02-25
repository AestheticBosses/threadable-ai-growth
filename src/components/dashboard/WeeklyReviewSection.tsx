import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, Eye, TrendingUp, Lightbulb, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { subDays } from "date-fns";

export function WeeklyReviewSection() {
  const { user } = useAuth();
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-review-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [analyzedRes, strategyRes] = await Promise.all([
        supabase
          .from("posts_analyzed")
          .select("views, likes, replies, reposts, engagement_rate")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", sevenDaysAgo),
        supabase
          .from("content_strategies")
          .select("strategy_data")
          .eq("user_id", user.id)
          .eq("strategy_type", "weekly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const posts = analyzedRes.data ?? [];
      if (posts.length === 0) return null;

      const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
      const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
      const totalReplies = posts.reduce((s, p) => s + (p.replies ?? 0), 0);
      const totalReposts = posts.reduce((s, p) => s + (p.reposts ?? 0), 0);
      const avgER = totalViews > 0
        ? ((totalLikes + totalReplies + totalReposts) / totalViews) * 100
        : 0;

      // Pull adjustments from latest strategy
      const strategyData = strategyRes.data?.strategy_data as Record<string, unknown> | null;
      const adjustments: string[] = [];
      if (strategyData) {
        const adj = (strategyData as any)?.strategy_adjustments ?? (strategyData as any)?.recommendations ?? [];
        if (Array.isArray(adj)) {
          for (const a of adj) {
            if (typeof a === "string") adjustments.push(a);
            else if (a?.recommendation) adjustments.push(a.recommendation);
            else if (a?.text) adjustments.push(a.text);
          }
        }
      }

      return { postCount: posts.length, totalViews, avgER, adjustments };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Weekly Review</h2>
        <div className="rounded-xl border border-border bg-card/50 p-6 animate-pulse">
          <div className="h-5 w-40 bg-muted rounded mb-3" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">Weekly Review</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Posts Published</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{data.postCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Total Views</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{data.totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Avg Engagement Rate</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{data.avgER.toFixed(1)}%</p>
        </div>
      </div>

      {/* What to Adjust */}
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">What to Adjust</h3>
          {data.adjustments.length > 0 ? (
            <ul className="space-y-3">
              {data.adjustments.slice(0, 3).map((rec, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Lightbulb className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{rec}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <p className="text-sm text-foreground font-medium">Strong week. Keep the current mix.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
