import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUp, ArrowDown, Eye, FileText, Zap, TrendingUp, Lightbulb, CheckCircle2 } from "lucide-react";
import { subDays, startOfDay } from "date-fns";

export function WeeklyPerformance() {
  const { user } = useAuth();
  const now = new Date();
  const sevenDaysAgo = startOfDay(subDays(now, 7));

  const { data } = useQuery({
    queryKey: ["weekly-performance", user?.id, sevenDaysAgo.toISOString()],
    queryFn: async () => {
      if (!user?.id) return null;

      const [thisWeekRes, prevWeekRes, bestPostRes, strategyRes, regressionRes] = await Promise.all([
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
        // BUG FIX: Also fetch regression insights from strategy_type="regression"
        supabase
          .from("content_strategies")
          .select("strategy_data, regression_insights")
          .eq("user_id", user.id)
          .eq("strategy_type", "regression")
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

      // Pull adjustments from latest weekly strategy
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

      // Build regression-based recommendations
      const regressionRecs: string[] = [];
      const regData = regressionRes.data?.strategy_data as any ?? regressionRes.data?.regression_insights as any;
      if (regData) {
        // Try to extract top positive/negative predictors
        const viewsInsights = regData?.views_insights ?? regData?.insights?.find?.((i: any) => i.category === "Reach") ?? regData;
        const topPos = viewsInsights?.top_positive_predictors ?? viewsInsights?.top_positive ?? [];
        const topNeg = viewsInsights?.top_negative_predictors ?? viewsInsights?.top_negative ?? [];

        if (Array.isArray(topPos) && topPos.length > 0) {
          const pred = topPos[0];
          const featureName = (pred?.feature ?? pred?.name ?? "").replace(/^has_/, "").replace(/_/g, " ");
          const corr = pred?.correlation ? `${(Math.abs(pred.correlation) * 100).toFixed(0)}%` : null;
          if (featureName) {
            regressionRecs.push(
              corr
                ? `Posts with ${featureName} get ${corr} more views — use it in today's hook`
                : `Posts with ${featureName} perform better — lean into it`
            );
          }
        }
        if (Array.isArray(topNeg) && topNeg.length > 0) {
          const pred = topNeg[0];
          const featureName = (pred?.feature ?? pred?.name ?? "").replace(/^has_/, "").replace(/_/g, " ");
          const corr = pred?.correlation ? `${(Math.abs(pred.correlation) * 100).toFixed(0)}%` : null;
          if (featureName) {
            regressionRecs.push(
              corr
                ? `Avoid ${featureName} — it reduces your reach by ${corr}`
                : `${featureName} hurts your performance — consider removing it`
            );
          }
        }

        // Archetype performance comparison
        const archetypePerf = regData?.archetype_performance ?? regData?.archetypes ?? [];
        if (Array.isArray(archetypePerf) && archetypePerf.length >= 2) {
          const sorted = [...archetypePerf].sort((a: any, b: any) => (b.avg_views ?? 0) - (a.avg_views ?? 0));
          const best = sorted[0];
          const worst = sorted[sorted.length - 1];
          if (best?.name && worst?.name && best.name !== worst.name) {
            regressionRecs.push(
              `Your ${best.name} posts outperform ${worst.name} — lean into it`
            );
          }
        }
      }

      // Merge regression recs first (data-driven), then strategy adjustments
      const finalRecs = regressionRecs.length > 0 ? regressionRecs : adjustments;

      return {
        totalViews,
        postsPublished,
        avgEng,
        engChange,
        bestPost: bestPostRes.data,
        recommendations: finalRecs,
        hasRegressionData: regressionRecs.length > 0,
        totalPosts: thisWeekPosts.length,
      };
    },
    enabled: !!user?.id,
  });

  const engUp = (data?.engChange ?? 0) >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Last 7 Days</h2>
      </div>

      {/* Compact stat bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card/50 px-3 py-2.5 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-bold font-mono text-foreground leading-none">{data?.postsPublished ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Posts</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/50 px-3 py-2.5 flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-bold font-mono text-foreground leading-none">
              {(data?.totalViews ?? 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Views</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/50 px-3 py-2.5 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-lg font-bold font-mono text-foreground leading-none">
                {(data?.avgEng ?? 0).toFixed(2)}%
              </p>
              {(data?.engChange ?? 0) !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${engUp ? "text-emerald-400" : "text-red-400"}`}>
                  {engUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                  {Math.abs(data?.engChange ?? 0).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Eng. Rate</p>
          </div>
        </div>
      </div>

      {/* Best post (compact) */}
      {data?.bestPost && (
        <div className="rounded-lg border border-border bg-card/50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">🏆</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground leading-relaxed line-clamp-1">
                {data.bestPost.text_content?.slice(0, 120)}{(data.bestPost.text_content?.length ?? 0) > 120 ? "…" : ""}
              </p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {(data.bestPost.views ?? 0).toLocaleString()} views
              </span>
            </div>
          </div>
        </div>
      )}

      {/* What to Adjust — data-driven */}
      <div className="rounded-lg border border-border bg-card/50 px-3 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">What to Adjust</h3>
        {(data?.totalPosts ?? 0) < 10 && !data?.hasRegressionData ? (
          <p className="text-xs text-muted-foreground">Post 10+ times to unlock performance insights</p>
        ) : (data?.recommendations?.length ?? 0) > 0 ? (
          <ul className="space-y-2">
            {data!.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">{rec}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-foreground font-medium">Strong week. Keep the current mix.</p>
          </div>
        )}
      </div>
    </div>
  );
}
