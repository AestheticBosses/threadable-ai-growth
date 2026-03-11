import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Eye, Heart, MessageCircle, Repeat2, TrendingUp, Users, BarChart3,
  Loader2, Brain, ArrowUp, ArrowDown, Clock, ChevronUp, ChevronDown, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { subDays, subMonths, format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

type RangeType = "7d" | "14d" | "30d" | "90d" | "custom";
type SortKey = "posted_at" | "views" | "likes" | "replies" | "reposts" | "engagement_rate";
type SortDir = "asc" | "desc";

const Insights = () => {
  usePageTitle("Insights", "Your performance analytics dashboard");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeType>("7d");
  const [analyzing, setAnalyzing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("posted_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [syncing, setSyncing] = useState(false);
  const [fetchingCompetitors, setFetchingCompetitors] = useState(false);
  const autoFetchRan = useRef(false);

  const rangeDays: Record<RangeType, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90, custom: 30 };

  // ─── Auto-sync Threads data on mount (30-min cooldown) ───
  useEffect(() => {
    if (!user?.id || autoFetchRan.current) return;
    autoFetchRan.current = true;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("last_fetched_at, threads_access_token")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.threads_access_token) return;

        const lastFetched = profile?.last_fetched_at ? new Date(profile.last_fetched_at) : null;
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

        if (lastFetched && lastFetched > thirtyMinAgo) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setSyncing(true);

        await supabase.functions.invoke("fetch-user-posts", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        await supabase
          .from("profiles")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", user.id);

        queryClient.invalidateQueries({ queryKey: ["insights-performance"] });
        queryClient.invalidateQueries({ queryKey: ["insights-regression"] });
        queryClient.invalidateQueries({ queryKey: ["insights-growth"] });
      } catch {
        // Silent fail — don't interrupt user
      } finally {
        setSyncing(false);
      }
    })();
  }, [user?.id, queryClient]);

  // ─── Performance data ───
  const { data: perfData, isLoading: perfLoading } = useQuery({
    queryKey: ["insights-performance", user?.id, range],
    queryFn: async () => {
      if (!user?.id) return null;
      const [postsRes, profileRes] = await Promise.all([
        supabase
          .from("posts_analyzed")
          .select("id, text_content, views, likes, replies, reposts, engagement_rate, posted_at, fetched_at, archetype")
          .eq("user_id", user.id)
          .eq("source", "own")
          .order("posted_at", { ascending: false, nullsFirst: false })
          .limit(2000),
        supabase
          .from("profiles")
          .select("follower_count")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const allPosts = postsRes.data ?? [];
      const cutoff = subDays(new Date(), rangeDays[range] + 1);
      const posts = allPosts.filter((p) => {
        const dateStr = p.posted_at ?? p.fetched_at;
        if (!dateStr) return true;
        return new Date(dateStr) >= cutoff;
      });
      const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
      const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
      const totalReplies = posts.reduce((s, p) => s + (p.replies ?? 0), 0);
      const totalReposts = posts.reduce((s, p) => s + (p.reposts ?? 0), 0);
      const avgER = totalViews > 0
        ? ((totalLikes + totalReplies + totalReposts) / totalViews) * 100
        : 0;
      const followerCount = profileRes.data?.follower_count ?? 0;

      // Best post
      const bestPost = posts.length > 0
        ? posts.reduce((best, p) => (p.views ?? 0) > (best.views ?? 0) ? p : best, posts[0])
        : null;

      // Chart data — group by day
      const dayMap: Record<string, { views: number; engagement: number; count: number }> = {};
      for (const p of posts) {
        if (!p.posted_at) continue;
        const day = format(parseISO(p.posted_at), "MMM d");
        if (!dayMap[day]) dayMap[day] = { views: 0, engagement: 0, count: 0 };
        dayMap[day].views += p.views ?? 0;
        dayMap[day].engagement += p.engagement_rate ?? 0;
        dayMap[day].count += 1;
      }
      const chartData = Object.entries(dayMap)
        .map(([date, d]) => ({
          date,
          views: d.views,
          engagement: d.count > 0 ? +(d.engagement / d.count).toFixed(2) : 0,
        }))
        .reverse();

      return { posts, totalViews, totalLikes, totalReplies, totalReposts, avgER, followerCount, bestPost, chartData, postCount: posts.length };
    },
    enabled: !!user?.id,
  });

  // ─── Regression data ───
  const { data: regressionData, isLoading: regLoading } = useQuery({
    queryKey: ["insights-regression", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("content_strategies")
        .select("strategy_data, regression_insights, created_at")
        .eq("user_id", user.id)
        .eq("strategy_type", "regression_insights")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return data;
    },
    enabled: !!user?.id,
  });

  const handleRefreshCompetitors = async () => {
    if (!user?.id || fetchingCompetitors) return;
    try {
      setFetchingCompetitors(true);
      const { data: accounts } = await supabase
        .from("competitor_accounts")
        .select("threads_username")
        .eq("user_id", user.id);
      const usernames = (accounts ?? []).map((a: any) => a.threads_username).filter(Boolean).slice(0, 5);
      if (usernames.length === 0) {
        toast.error("No competitor accounts to fetch. Add accounts on the Analyze page first.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("fetch-competitor-posts", {
        body: { usernames },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      const count = res.data?.total_saved ?? 0;
      toast.success(`Fetched ${count} competitor posts`);
      queryClient.invalidateQueries({ queryKey: ["insights-competitors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch competitor posts");
    } finally {
      setFetchingCompetitors(false);
    }
  };

  // ─── Competitors data ───
  const { data: competitorData, isLoading: compLoading } = useQuery({
    queryKey: ["insights-competitors", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const [accountsRes, postsRes] = await Promise.all([
        supabase
          .from("competitor_accounts")
          .select("threads_username, follower_count")
          .eq("user_id", user.id)
          .order("added_at", { ascending: false }),
        supabase
          .from("posts_analyzed")
          .select("text_content, views, likes, replies, reposts, source_username, posted_at")
          .eq("user_id", user.id)
          .eq("source", "competitor")
          .order("views", { ascending: false })
          .limit(100),
      ]);
      const accounts = accountsRes.data ?? [];
      const posts = postsRes.data ?? [];
      // Group posts by source_username, take top 10 per account
      const byAccount: Record<string, typeof posts> = {};
      for (const p of posts) {
        const handle = p.source_username || "unknown";
        if (!byAccount[handle]) byAccount[handle] = [];
        if (byAccount[handle].length < 10) byAccount[handle].push(p);
      }
      return { accounts, posts, byAccount };
    },
    enabled: !!user?.id,
  });

  // ─── Growth data ───
  const { data: growthData, isLoading: growthLoading } = useQuery({
    queryKey: ["insights-growth", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const [snapshotsRes, postsThisMonthRes, postsLastMonthRes] = await Promise.all([
        supabase
          .from("follower_snapshots")
          .select("follower_count, recorded_at")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: true }),
        supabase
          .from("posts_analyzed")
          .select("views, likes, replies, reposts")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", startOfMonth(new Date()).toISOString())
          .lte("posted_at", endOfMonth(new Date()).toISOString()),
        supabase
          .from("posts_analyzed")
          .select("views, likes, replies, reposts")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", startOfMonth(subMonths(new Date(), 1)).toISOString())
          .lte("posted_at", endOfMonth(subMonths(new Date(), 1)).toISOString()),
      ]);

      const snapshots = (snapshotsRes.data ?? []).map((s) => ({
        date: format(parseISO(s.recorded_at), "MMM d"),
        followers: s.follower_count,
      }));

      const thisMonth = postsThisMonthRes.data ?? [];
      const lastMonth = postsLastMonthRes.data ?? [];
      const sum = (arr: typeof thisMonth) => ({
        views: arr.reduce((s, p) => s + (p.views ?? 0), 0),
        engagement: arr.reduce((s, p) => s + (p.likes ?? 0) + (p.replies ?? 0) + (p.reposts ?? 0), 0),
      });

      return { snapshots, thisMonth: sum(thisMonth), lastMonth: sum(lastMonth) };
    },
    enabled: !!user?.id,
  });

  // Sorted posts for table
  const sortedPosts = useMemo(() => {
    if (!perfData?.posts) return [];
    return [...perfData.posts].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [perfData?.posts, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleRunAnalysis = async () => {
    if (!user) return;
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not logged in"); return; }
      const { error } = await supabase.functions.invoke("run-analysis", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success("Analysis complete!");
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
  };

  const rangeButtons: { label: string; value: RangeType }[] = [
    { label: "7 Days", value: "7d" },
    { label: "14 Days", value: "14d" },
    { label: "30 Days", value: "30d" },
    { label: "90 Days", value: "90d" },
  ];

  const regressionInsights = useMemo(() => {
    if (!regressionData) return { insights: [], humanReadable: [] };
    const sd = regressionData.strategy_data as any;
    // Data lives at strategy_data.insights (not strategy_data.regression_insights)
    const insights = sd?.insights ?? [];
    const humanReadable = sd?.human_readable_insights ?? (
      insights.length > 0 ? insights.map((i: any) => i.insight).filter(Boolean) : []
    );
    return { insights, humanReadable };
  }, [regressionData]);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Insights</h1>
            {syncing && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-sm">Your performance analytics dashboard.</p>
        </div>

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="performance" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Performance</TabsTrigger>
            <TabsTrigger value="regression" className="gap-1.5"><Brain className="h-3.5 w-3.5" /> Regression</TabsTrigger>
            <TabsTrigger value="growth" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Growth</TabsTrigger>
            <TabsTrigger value="competitors" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Competitors</TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: PERFORMANCE ═══════ */}
          <TabsContent value="performance" className="space-y-6">
            {/* Range picker */}
            <div className="flex gap-2 flex-wrap">
              {rangeButtons.map((b) => (
                <Button
                  key={b.value}
                  size="sm"
                  variant={range === b.value ? "default" : "outline"}
                  onClick={() => setRange(b.value)}
                  className="text-xs"
                >
                  {b.label}
                </Button>
              ))}
            </div>

            {perfLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card/50 p-4 animate-pulse">
                    <div className="h-4 w-16 bg-muted rounded mb-2" />
                    <div className="h-6 w-20 bg-muted/60 rounded" />
                  </div>
                ))}
              </div>
            ) : perfData ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { icon: Eye, label: "Total Views", value: perfData.totalViews.toLocaleString() },
                    { icon: Heart, label: "Total Likes", value: perfData.totalLikes.toLocaleString() },
                    { icon: MessageCircle, label: "Total Replies", value: perfData.totalReplies.toLocaleString() },
                    { icon: Repeat2, label: "Total Reposts", value: perfData.totalReposts.toLocaleString() },
                    { icon: Users, label: "Followers", value: perfData.followerCount.toLocaleString() },
                    { icon: TrendingUp, label: "Avg ER", value: `${perfData.avgER.toFixed(1)}%` },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border bg-card/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                      </div>
                      <p className="text-xl font-bold font-mono text-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on {perfData.postCount.toLocaleString()} posts in the last {rangeDays[range]} days
                </p>

                {/* Chart */}
                {perfData.chartData.length > 1 && (
                  <Card className="border-border">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Views & Engagement Over Time</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={perfData.chartData}>
                            <defs>
                              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(270, 91%, 65%)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(270, 91%, 65%)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                            <XAxis dataKey="date" tick={{ fill: "hsl(20, 5%, 55%)", fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fill: "hsl(20, 5%, 55%)", fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(20, 5%, 55%)", fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(240, 15%, 8%)",
                                border: "1px solid hsl(0 0% 100% / 0.1)",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="views"
                              stroke="hsl(270, 91%, 65%)"
                              fill="url(#viewsGrad)"
                              strokeWidth={2}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="engagement"
                              stroke="hsl(142, 71%, 45%)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary" /> Views
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-success" /> Engagement %
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Best post */}
                {perfData.bestPost && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">🏆 Best Performing Post</p>
                      <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                        {perfData.bestPost.text_content?.slice(0, 200)}
                        {(perfData.bestPost.text_content?.length ?? 0) > 200 ? "…" : ""}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span><Eye className="h-3 w-3 inline mr-1" />{(perfData.bestPost.views ?? 0).toLocaleString()} views</span>
                        <span><Heart className="h-3 w-3 inline mr-1" />{(perfData.bestPost.likes ?? 0).toLocaleString()}</span>
                        <span><MessageCircle className="h-3 w-3 inline mr-1" />{(perfData.bestPost.replies ?? 0).toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Post table */}
                {sortedPosts.length > 0 && (
                  <Card className="border-border overflow-hidden">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("posted_at")}>
                                Date <SortIcon col="posted_at" />
                              </TableHead>
                              <TableHead>Hook Preview</TableHead>
                              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("views")}>
                                Views <SortIcon col="views" />
                              </TableHead>
                              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("likes")}>
                                Likes <SortIcon col="likes" />
                              </TableHead>
                              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("replies")}>
                                Replies <SortIcon col="replies" />
                              </TableHead>
                              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("reposts")}>
                                Reposts <SortIcon col="reposts" />
                              </TableHead>
                              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("engagement_rate")}>
                                ER <SortIcon col="engagement_rate" />
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedPosts.slice(0, 50).map((post) => (
                              <TableRow key={post.id}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {post.posted_at ? format(parseISO(post.posted_at), "MMM d") : "—"}
                                </TableCell>
                              <TableCell className="text-sm max-w-[280px]">
                                  <span className="block truncate">
                                    {(() => {
                                      const firstLine = post.text_content?.split("\n")[0] ?? "";
                                      return firstLine.length > 120 ? firstLine.slice(0, 120) + "…" : firstLine || "—";
                                    })()}
                                  </span>
                                  {post.archetype && (
                                    <Badge variant="outline" className="text-[10px] mt-0.5">{post.archetype}</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">{(post.views ?? 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{(post.likes ?? 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{(post.replies ?? 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{(post.reposts ?? 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{(post.engagement_rate ?? 0).toFixed(1)}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {perfData.posts.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No posts in this period. Fetch your posts from the Command Center.</p>
                  </div>
                )}
              </>
            ) : null}
          </TabsContent>

          {/* ═══════ TAB 2: REGRESSION ANALYSIS ═══════ */}
          <TabsContent value="regression" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Regression Analysis</h2>
                {regressionData?.created_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    Last run: {format(parseISO(regressionData.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
              <Button onClick={handleRunAnalysis} disabled={analyzing} size="sm" className="gap-1.5">
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                {analyzing ? "Running…" : "Run Analysis"}
              </Button>
            </div>

            {regLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-border bg-card/50 p-5 animate-pulse">
                    <div className="h-4 w-32 bg-muted rounded mb-3" />
                    <div className="h-3 w-48 bg-muted/60 rounded" />
                  </div>
                ))}
              </div>
            ) : regressionInsights.insights.length > 0 || regressionInsights.humanReadable.length > 0 ? (
              <>
                {/* Insight cards */}
                {regressionInsights.insights.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {regressionInsights.insights.map((insight: any, i: number) => {
                      const strengthClass = insight.strength === "strong"
                        ? "border-l-emerald-500 bg-emerald-500/5"
                        : insight.strength === "moderate"
                        ? "border-l-yellow-500 bg-yellow-500/5"
                        : "border-l-muted-foreground bg-muted/20";
                      const strengthBadge = insight.strength === "strong"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : insight.strength === "moderate"
                        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                        : "bg-muted text-muted-foreground border-border";
                      const metricIcon = { views: Eye, likes: Heart, reposts: Repeat2, engagement_rate: TrendingUp }[insight.metric_impacted as string] ?? BarChart3;
                      const MetricIc = metricIcon;
                      return (
                        <Card key={i} className={`border-border border-l-4 ${strengthClass}`}>
                          <CardContent className="p-5 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{insight.category}</span>
                              <div className="flex gap-1.5">
                                <Badge variant="outline" className={`text-[10px] gap-1 ${strengthBadge}`}>
                                  {insight.strength}
                                </Badge>
                                {insight.metric_impacted && (
                                  <Badge variant="outline" className="text-[10px] gap-1">
                                    <MetricIc className="h-2.5 w-2.5" /> {insight.metric_impacted}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm font-medium text-foreground">{insight.insight}</p>
                            {insight.evidence && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{insight.evidence}</p>
                            )}
                            {insight.recommendation && (
                              <p className="text-xs text-primary font-medium">→ {insight.recommendation}</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Human readable insights */}
                {regressionInsights.humanReadable.length > 0 && (
                  <Card className="border-border">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Key Takeaways</h3>
                      <ul className="space-y-2">
                        {regressionInsights.humanReadable.map((item: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-primary mt-0.5">•</span>
                            {typeof item === "string" ? item : item.text ?? item.insight ?? JSON.stringify(item)}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No regression analysis yet. Click "Run Analysis" to discover what drives your content performance.</p>
              </div>
            )}
          </TabsContent>

          {/* ═══════ TAB 3: GROWTH ═══════ */}
          <TabsContent value="growth" className="space-y-6">
            {growthLoading ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card/50 p-6 animate-pulse h-64" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card/50 p-5 animate-pulse h-24" />
                  <div className="rounded-xl border border-border bg-card/50 p-5 animate-pulse h-24" />
                </div>
              </div>
            ) : growthData ? (
              <>
                {/* Follower chart */}
                {growthData.snapshots.length > 1 ? (
                  <Card className="border-border">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Follower Growth</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={growthData.snapshots}>
                            <defs>
                              <linearGradient id="followersGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                            <XAxis dataKey="date" tick={{ fill: "hsl(20, 5%, 55%)", fontSize: 11 }} />
                            <YAxis tick={{ fill: "hsl(20, 5%, 55%)", fontSize: 11 }} domain={["dataMin - 10", "dataMax + 10"]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(240, 15%, 8%)",
                                border: "1px solid hsl(0 0% 100% / 0.1)",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="followers"
                              stroke="hsl(142, 71%, 45%)"
                              fill="url(#followersGrad)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Follower tracking will appear after a few days of data collection.</p>
                  </div>
                )}

                {/* Month comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Views", curr: growthData.thisMonth.views, prev: growthData.lastMonth.views },
                    { label: "Engagement", curr: growthData.thisMonth.engagement, prev: growthData.lastMonth.engagement },
                  ].map((item) => {
                    const change = pctChange(item.curr, item.prev);
                    const up = change >= 0;
                    return (
                      <Card key={item.label} className="border-border">
                        <CardContent className="p-5">
                          <p className="text-xs text-muted-foreground font-medium mb-1">{item.label} — This Month vs Last</p>
                          <div className="flex items-end gap-3">
                            <p className="text-2xl font-bold font-mono text-foreground">{item.curr.toLocaleString()}</p>
                            <span className={`flex items-center gap-0.5 text-xs font-semibold pb-0.5 ${up ? "text-success" : "text-destructive"}`}>
                              {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                              {Math.abs(change).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Last month: {item.prev.toLocaleString()}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : null}
          </TabsContent>
          {/* ═══════ TAB 4: COMPETITORS ═══════ */}
          <TabsContent value="competitors" className="space-y-6">
            {compLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !competitorData || competitorData.accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No competitor accounts tracked yet.</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Go to Analyze to discover and add competitor accounts, then come back here to view their posts.</p>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/analyze")}>Go to Analyze</Button>
              </div>
            ) : (
              <>
                {/* Tracked accounts + refresh */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2 flex-wrap">
                    {competitorData.accounts.map((a) => (
                      <Badge key={a.threads_username} variant="secondary" className="text-xs gap-1">
                        @{a.threads_username}
                        {a.follower_count ? <span className="text-muted-foreground">({a.follower_count.toLocaleString()})</span> : null}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleRefreshCompetitors} disabled={fetchingCompetitors}>
                    {fetchingCompetitors ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {fetchingCompetitors ? "Fetching..." : "Refresh Posts"}
                  </Button>
                </div>

                {/* Posts table */}
                {competitorData.posts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <p className="text-sm text-muted-foreground">No competitor posts fetched yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Click "Refresh Posts" above to pull their latest content.</p>
                  </div>
                ) : (
                  <Card className="border-border">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Account</TableHead>
                            <TableHead>Post</TableHead>
                            <TableHead className="text-right w-[80px]"><Eye className="h-3.5 w-3.5 inline" /> Views</TableHead>
                            <TableHead className="text-right w-[70px]"><Heart className="h-3.5 w-3.5 inline" /> Likes</TableHead>
                            <TableHead className="text-right w-[70px]"><MessageCircle className="h-3.5 w-3.5 inline" /> Replies</TableHead>
                            <TableHead className="text-right w-[70px]"><Repeat2 className="h-3.5 w-3.5 inline" /> Reposts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {competitorData.posts.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-medium text-muted-foreground">@{p.source_username}</TableCell>
                              <TableCell className="text-xs max-w-[300px] truncate">{(p.text_content || "").substring(0, 120)}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{(p.views ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{(p.likes ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{(p.replies ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{(p.reposts ?? 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Insights;
