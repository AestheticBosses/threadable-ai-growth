import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUp, ArrowDown, Eye, FileText, Zap, TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, startOfDay, subWeeks } from "date-fns";

export function WeeklyPerformance() {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const prevWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

  const { data } = useQuery({
    queryKey: ["weekly-performance", user?.id, weekStart.toISOString()],
    queryFn: async () => {
      if (!user?.id) return null;

      const [thisWeekRes, prevWeekRes, bestPostRes] = await Promise.all([
        supabase
          .from("posts_analyzed")
          .select("views, engagement_rate, text_content, posted_at")
          .eq("user_id", user.id)
          .gte("posted_at", weekStart.toISOString())
          .lte("posted_at", weekEnd.toISOString()),
        supabase
          .from("posts_analyzed")
          .select("engagement_rate")
          .eq("user_id", user.id)
          .gte("posted_at", prevWeekStart.toISOString())
          .lte("posted_at", prevWeekEnd.toISOString()),
        supabase
          .from("posts_analyzed")
          .select("text_content, views")
          .eq("user_id", user.id)
          .gte("posted_at", weekStart.toISOString())
          .lte("posted_at", weekEnd.toISOString())
          .order("views", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const thisWeekPosts = thisWeekRes.data ?? [];
      const prevWeekPosts = prevWeekRes.data ?? [];

      const totalViews = thisWeekPosts.reduce((s, p) => s + (p.views ?? 0), 0);
      const postsPublished = thisWeekPosts.length;
      const avgEng = postsPublished > 0
        ? thisWeekPosts.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsPublished
        : 0;
      const prevAvgEng = prevWeekPosts.length > 0
        ? prevWeekPosts.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / prevWeekPosts.length
        : 0;
      const engChange = prevAvgEng === 0 ? 0 : ((avgEng - prevAvgEng) / prevAvgEng) * 100;

      return { totalViews, postsPublished, avgEng, engChange, bestPost: bestPostRes.data };
    },
    enabled: !!user?.id,
  });

  const engUp = (data?.engChange ?? 0) >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">This Week's Performance</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Posts this week */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Posts this week</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{data?.postsPublished ?? 0}</p>
        </div>

        {/* Total views */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Total views</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">
            {(data?.totalViews ?? 0).toLocaleString()}
          </p>
        </div>

        {/* Avg engagement */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Avg engagement</span>
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
            <p className="text-[10px] text-muted-foreground mt-1">vs last week</p>
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
    </div>
  );
}
