import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUp, ArrowDown, Eye, FileText, Zap, TrendingUp, Lightbulb, CheckCircle2 } from "lucide-react";
import { subDays, startOfDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

export function WeeklyPerformance() {
  const { user } = useAuth();
  const now = new Date();
  const sevenDaysAgo = startOfDay(subDays(now, 7));

  const { data } = useQuery({
    queryKey: ["weekly-performance", user?.id, sevenDaysAgo.toISOString()],
    queryFn: async () => {
      if (!user?.id) return null;

      const [thisWeekRes, prevWeekRes, bestPostRes, strategyRes] = await Promise.all([
        supabase
          .from("posts_analyzed")
          .select("views, likes, replies, reposts, text_content, posted_at")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", sevenDaysAgo.toISOString()),
        supabase
          .from("posts_analyzed")
          .select("views, likes, replies, reposts")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", startOfDay(subDays(now, 14)).toISOString())
          .lt("posted_at", sevenDaysAgo.toISOString()),
        supabase
          .from("posts_analyzed")
          .select("text_content, views")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", sevenDaysAgo.toISOString())
          .order("views", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("content_strategies")
          .select("strategy_data")
          .eq("user_id", user.id)
          .eq("strategy_type", "weekly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const thisWeekPosts = thisWeekRes.data ?? [];
      const prevWeekPosts = prevWeekRes.data ?? [];

      const totalViews = thisWeekPosts.reduce((s, p) => s + (p.views ?? 0), 0);
      const totalLikes = thisWeekPosts.reduce((s, p) => s + (p.likes ?? 0), 0);
      const totalReplies = thisWeekPosts.reduce((s, p) => s + (p.replies ?? 0), 0);
      const totalReposts = thisWeekPosts.reduce((s, p) => s + (p.reposts ?? 0), 0);
      const postsPublished = thisWeekPosts.length;
      const avgEng = totalViews > 0
        ? ((totalLikes + totalReplies + totalReposts) / totalViews) * 100
        : 0;

      const prevViews = prevWeekPosts.reduce((s, p) => s + (p.views ?? 0), 0);
      const prevLikes = prevWeekPosts.reduce((s, p) => s + (p.likes ?? 0), 0);
      const prevReplies = prevWeekPosts.reduce((s, p) => s + (p.replies ?? 0), 0);
      const prevReposts = prevWeekPosts.reduce((s, p) => s + (p.reposts ?? 0), 0);
      const prevAvgEng = prevViews > 0
        ? ((prevLikes + prevReplies + prevReposts) / prevViews) * 100
        : 0;
      const engChange = prevAvgEng === 0 ? 0 : ((avgEng - prevAvgEng) / prevAvgEng) * 100;

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

      return { totalViews, postsPublished, avgEng, engChange, bestPost: bestPostRes.data, adjustments };
    },
    enabled: !!user?.id,
  });

  const engUp = (data?.engChange ?? 0) >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Last 7 Days Performance</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Posts */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Posts Published</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{data?.postsPublished ?? 0}</p>
        </div>

        {/* Views */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Total Views</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">
            {(data?.totalViews ?? 0).toLocaleString()}
          </p>
        </div>

        {/* Engagement */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Avg Engagement</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold font-mono text-foreground">
              {(data?.avgEng ?? 0).toFixed(2)}%
            </p>
            {(data?.engChange ?? 0) !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold pb-0.5 ${engUp ? "text-emerald-400" : "text-red-400"}`}>
                {engUp ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                {Math.abs(data?.engChange ?? 0).toFixed(1)}%
              </span>
            )}
          </div>
          {(data?.engChange ?? 0) !== 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">vs previous 7 days</p>
          )}
        </div>
      </div>

      {/* Best post */}
      {data?.bestPost && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            🏆 Best Post This Week
          </p>
          <p className="text-sm text-foreground leading-relaxed line-clamp-2">
            {data.bestPost.text_content?.slice(0, 160)}{(data.bestPost.text_content?.length ?? 0) > 160 ? "…" : ""}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">
              {(data.bestPost.views ?? 0).toLocaleString()} views
            </span>
          </div>
        </div>
      )}

      {/* What to Adjust */}
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">What to Adjust</h3>
          {(data?.adjustments?.length ?? 0) > 0 ? (
            <ul className="space-y-3">
              {data!.adjustments.slice(0, 3).map((rec, i) => (
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
