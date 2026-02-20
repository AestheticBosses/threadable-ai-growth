import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Eye, TrendingUp, Sparkles, Loader2, ArrowRight, Lightbulb, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { subDays } from "date-fns";

const FUNNEL_COLORS: Record<string, string> = {
  TOF: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  MOF: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  BOF: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const Insights = () => {
  usePageTitle("Weekly Review", "What worked this week and what to adjust next week");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const sevenDaysAgo = subDays(new Date(), 7).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-review", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: posts } = await supabase
        .from("scheduled_posts")
        .select("id, text_content, funnel_stage, content_category, status, published_at, score_breakdown")
        .eq("user_id", user.id)
        .eq("status", "published")
        .gte("published_at", sevenDaysAgo)
        .order("published_at", { ascending: false });

      if (!posts || posts.length === 0) return { posts: [], empty: true };

      // We need metrics from posts_analyzed for published posts
      // Match by checking posts_analyzed posted_at within the same window
      const { data: analyzed } = await supabase
        .from("posts_analyzed")
        .select("id, text_content, views, likes, replies, reposts, engagement_rate, archetype, content_category")
        .eq("user_id", user.id)
        .eq("source", "own")
        .gte("posted_at", sevenDaysAgo)
        .order("views", { ascending: false });

      const analyzedPosts = analyzed ?? [];

      // Stats
      const totalViews = analyzedPosts.reduce((s, p) => s + (p.views ?? 0), 0);
      const totalLikes = analyzedPosts.reduce((s, p) => s + (p.likes ?? 0), 0);
      const totalReplies = analyzedPosts.reduce((s, p) => s + (p.replies ?? 0), 0);
      const totalReposts = analyzedPosts.reduce((s, p) => s + (p.reposts ?? 0), 0);
      const avgER = totalViews > 0
        ? ((totalLikes + totalReplies + totalReposts) / totalViews) * 100
        : 0;

      // Top 3 by views
      const top3 = analyzedPosts
        .filter((p) => (p.views ?? 0) > 0)
        .slice(0, 3);

      // Funnel stage analysis for recommendations
      const stageMap: Record<string, { views: number; count: number }> = {};
      for (const p of analyzedPosts) {
        // Try to find funnel_stage from scheduled_posts match or use content_category
        const stage = posts.find((sp) =>
          sp.text_content && p.text_content &&
          sp.text_content.slice(0, 50) === p.text_content.slice(0, 50)
        )?.funnel_stage ?? null;
        if (stage) {
          if (!stageMap[stage]) stageMap[stage] = { views: 0, count: 0 };
          stageMap[stage].views += p.views ?? 0;
          stageMap[stage].count += 1;
        }
      }

      const avgViews = (stage: string) => {
        const s = stageMap[stage];
        return s && s.count > 0 ? s.views / s.count : null;
      };

      const recommendations: string[] = [];
      const tofAvg = avgViews("TOF");
      const mofAvg = avgViews("MOF");
      const bofAvg = avgViews("BOF");

      if (tofAvg !== null && mofAvg !== null && tofAvg > mofAvg) {
        recommendations.push("TOF is carrying reach. Add one more TOF post next week to widen top-of-funnel.");
      }
      if (bofAvg !== null && mofAvg !== null && bofAvg < mofAvg) {
        recommendations.push("BOF is underperforming. Lead with outcome first, then CTA.");
      }
      if (avgER < 1) {
        recommendations.push("Engagement is soft. End 2 posts with a question to invite replies.");
      }

      return {
        empty: false,
        postCount: analyzedPosts.length,
        totalViews,
        avgER,
        top3,
        recommendations,
        scheduledCount: posts.length,
      };
    },
    enabled: !!user?.id,
  });

  const handleGenerateWeek = async () => {
    if (!user) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not logged in"); return; }
      const { error } = await supabase.functions.invoke("generate-week-posts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success("Next week generated. Review in Queue →");
      navigate("/queue");
    } catch {
      setGenError("Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Weekly Review</h1>
          <p className="mt-1 text-muted-foreground text-sm">What worked this week and what to adjust next week.</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card/50 p-6 animate-pulse">
                <div className="h-5 w-40 bg-muted rounded mb-3" />
                <div className="h-4 w-64 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
        ) : data?.empty ? (
          /* Empty state */
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No published posts yet. Your first review will appear after your first week of publishing.
            </p>
            <Button variant="outline" onClick={() => navigate("/queue")} className="gap-1.5">
              Go to Queue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Section 1 — This Week's Numbers */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">This Week's Numbers</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground font-mono">{data.postCount}</p>
                      <p className="text-xs text-muted-foreground">Posts Published</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Eye className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground font-mono">{data.totalViews.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Views</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground font-mono">{data.avgER.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Engagement Rate</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Section 2 — What Worked */}
            {data.top3.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">What Worked</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.top3.map((post, i) => {
                    const er = (post.views ?? 0) > 0
                      ? (((post.likes ?? 0) + (post.replies ?? 0) + (post.reposts ?? 0)) / (post.views ?? 1)) * 100
                      : null;
                    const stage = post.content_category?.toUpperCase();
                    const funnelClass = stage && FUNNEL_COLORS[stage] ? FUNNEL_COLORS[stage] : null;

                    return (
                      <Card key={post.id} className="border-border">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary font-mono">#{i + 1}</span>
                            {funnelClass && (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${funnelClass}`}>
                                {stage}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                              {post.archetype ?? "—"}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                            {post.text_content?.slice(0, 100) ?? "—"}
                            {(post.text_content?.length ?? 0) > 100 ? "…" : ""}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {(post.views ?? 0).toLocaleString()}
                            </span>
                            <span>
                              ER: {er !== null ? `${er.toFixed(1)}%` : "—"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section 3 — What to Adjust */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">What to Adjust</h2>
              <Card className="border-border">
                <CardContent className="p-5">
                  {data.recommendations.length > 0 ? (
                    <ul className="space-y-3">
                      {data.recommendations.slice(0, 3).map((rec, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Lightbulb className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-foreground">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                      <p className="text-sm text-foreground font-medium">Strong week. Keep the current mix.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Section 4 — Next Week CTA */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Next Week</h2>
              <Card className="border-border">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p className="text-sm text-muted-foreground">Ready to plan next week based on what worked?</p>
                  <div className="flex items-center gap-3">
                    {genError && <p className="text-xs text-destructive">{genError}</p>}
                    <Button
                      onClick={handleGenerateWeek}
                      disabled={generating}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {generating ? "Generating…" : "Generate Next Week →"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
};

export default Insights;
