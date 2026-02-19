import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Eye, FileText, Zap, TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, startOfDay, subWeeks } from "date-fns";

export function WeeklyStatsSidebar() {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const prevWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

  const { data } = useQuery({
    queryKey: ["weekly-stats-sidebar", user?.id, weekStart.toISOString()],
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

      return {
        totalViews,
        postsPublished,
        avgEng,
        engChange,
        bestPost: bestPostRes.data,
      };
    },
    enabled: !!user?.id,
  });

  const stats = [
    {
      label: "Posts this week",
      value: data?.postsPublished ?? 0,
      icon: FileText,
      mono: true,
    },
    {
      label: "Total views",
      value: (data?.totalViews ?? 0).toLocaleString(),
      icon: Eye,
      mono: true,
    },
  ];

  const engUp = (data?.engChange ?? 0) >= 0;

  return (
    <Card className="border-border h-full">
      <CardContent className="p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          This Week
        </h3>

        {/* Quick stats */}
        <div className="space-y-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <span className={`text-sm font-bold text-foreground ${s.mono ? "font-mono" : ""}`}>
                {s.value}
              </span>
            </div>
          ))}

          {/* Avg engagement with delta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Avg engagement</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold font-mono text-foreground">
                {(data?.avgEng ?? 0).toFixed(2)}%
              </span>
              {(data?.engChange ?? 0) !== 0 && (
                <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${engUp ? "text-emerald-400" : "text-red-400"}`}>
                  {engUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(data?.engChange ?? 0).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Best post */}
        {data?.bestPost && (
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Best Post This Week</p>
            <p className="text-xs text-foreground leading-relaxed line-clamp-3">
              {data.bestPost.text_content?.slice(0, 100)}…
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-mono text-muted-foreground">
                {(data.bestPost.views ?? 0).toLocaleString()} views
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
