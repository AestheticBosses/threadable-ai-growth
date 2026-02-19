import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { EmptyState } from "@/components/EmptyState";
import { TodayStatusCard } from "@/components/dashboard/TodayStatusCard";
import { PostingStreakCard } from "@/components/dashboard/PostingStreakCard";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { GrowthSummaryCard } from "@/components/dashboard/GrowthSummaryCard";
import { TopInsightCard } from "@/components/dashboard/TopInsightCard";
import { RecentPostsCard } from "@/components/dashboard/RecentPostsCard";
import { type DateRange } from "@/hooks/useDashboardData";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { usePageTitle } from "@/hooks/usePageTitle";
import { BarChart3, RefreshCw, ArrowUp, ArrowDown, User, Eye, Heart, MessageCircle, Repeat2, Quote, FileText, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { subDays, startOfDay, differenceInCalendarDays } from "date-fns";


function PctChange({ value, hide }: { value: number; hide?: boolean }) {
  if (hide) return null;
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const isUp = value > 0;
  const Icon = isUp ? ArrowUp : ArrowDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function getRangeDates(range: DateRange, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  if (range === "all") return { start: null, end: null };
  if (range === "custom" && customFrom) return { start: customFrom, end: customTo ?? now };
  const days = parseInt(range, 10);
  return { start: startOfDay(subDays(now, days)), end: now };
}

function filterPostsByRange<T extends { posted_at: string | null }>(posts: T[], range: DateRange, customFrom?: Date, customTo?: Date): T[] {
  const { start, end } = getRangeDates(range, customFrom, customTo);
  if (!start) return posts;
  return posts.filter((p) => {
    if (!p.posted_at) return false;
    const d = new Date(p.posted_at);
    return d >= start && (!end || d <= end);
  });
}

function sumField<T>(arr: T[], field: keyof T): number {
  return arr.reduce((sum, p) => sum + (Number((p as any)[field]) || 0), 0);
}

const Dashboard = () => {
  usePageTitle("Dashboard", "Your Threads analytics and performance overview");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [profileRefreshed, setProfileRefreshed] = useState(false);

  const { data: allPosts, isLoading: postsLoading } = usePostsAnalyzed();



  const profileQuery = useQuery({
    queryKey: ["dashboard-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("threads_username, full_name, display_name, threads_profile_picture_url, follower_count")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const followerQuery = useQuery({
    queryKey: ["dashboard-follower-snapshots", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("follower_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Streak data
  const streakQuery = useQuery({
    queryKey: ["dashboard-streak", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("scheduled_posts")
        .select("published_at")
        .eq("user_id", user.id)
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const profile = profileQuery.data;
  const followerSnapshots = followerQuery.data ?? [];
  const latestFollowers = followerSnapshots.length > 0 ? followerSnapshots[followerSnapshots.length - 1].follower_count : null;
  const earliestFollowers = followerSnapshots.length > 0 ? followerSnapshots[0].follower_count : null;
  const followerChange = latestFollowers !== null && earliestFollowers !== null ? latestFollowers - earliestFollowers : null;

  // Calculate streak
  const publishedPosts = streakQuery.data ?? [];
  const publishedDates = publishedPosts.map((p) => p.published_at!);
  const streak = useMemo(() => {
    if (publishedPosts.length === 0) return 0;
    const uniqueDays = new Set(publishedPosts.map((p) => new Date(p.published_at!).toDateString()));
    const sortedDays = Array.from(uniqueDays).map((d) => new Date(d)).sort((a, b) => b.getTime() - a.getTime());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (sortedDays.length === 0) return 0;
    const diff = differenceInCalendarDays(today, sortedDays[0]);
    if (diff > 1) return 0;
    let s = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      if (differenceInCalendarDays(sortedDays[i - 1], sortedDays[i]) === 1) s++;
      else break;
    }
    return s;
  }, [publishedPosts]);

  // Auto-refresh profile from Threads API on mount
  useEffect(() => {
    if (!user || profileRefreshed) return;
    const refreshProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase.functions.invoke("refresh-profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (data?.success) {
          queryClient.invalidateQueries({ queryKey: ["dashboard-profile"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-follower-snapshots"] });
        }
      } catch {
        // Silently fall back to cached data
      } finally {
        setProfileRefreshed(true);
      }
    };
    refreshProfile();
  }, [user, profileRefreshed]);

  // Determine if we should hide % change badges
  const isAllTime = range === "all";

  const posts = useMemo(() => allPosts ? filterPostsByRange(allPosts, range, customFrom, customTo) : [], [allPosts, range, customFrom, customTo]);

  const prevPosts = useMemo(() => {
    if (!allPosts || range === "all") return [];
    const { start, end } = getRangeDates(range, customFrom, customTo);
    if (!start || !end) return [];
    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    return allPosts.filter((p) => {
      if (!p.posted_at) return false;
      const d = new Date(p.posted_at);
      return d >= prevStart && d < start;
    });
  }, [allPosts, range, customFrom, customTo]);

  const hidePctChange = isAllTime || prevPosts.length === 0;

  const periodStats = {
    views: sumField(posts, "views"),
    likes: sumField(posts, "likes"),
    replies: sumField(posts, "replies"),
    reposts: sumField(posts, "reposts"),
    quotes: sumField(posts, "quotes"),
    posts: posts.length,
  };

  const prevStats = {
    views: sumField(prevPosts, "views"),
    likes: sumField(prevPosts, "likes"),
    replies: sumField(prevPosts, "replies"),
    reposts: sumField(prevPosts, "reposts"),
    quotes: sumField(prevPosts, "quotes"),
    posts: prevPosts.length,
  };

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  };

  const periodChanges = {
    views: pctChange(periodStats.views, prevStats.views),
    likes: pctChange(periodStats.likes, prevStats.likes),
    replies: pctChange(periodStats.replies, prevStats.replies),
    reposts: pctChange(periodStats.reposts, prevStats.reposts),
    quotes: pctChange(periodStats.quotes, prevStats.quotes),
    posts: pctChange(periodStats.posts, prevStats.posts),
  };

  const handleFetchPosts = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not logged in"); return; }
      const { data, error } = await supabase.functions.invoke("fetch-user-posts", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) { toast.error(error.message || "Failed to fetch posts"); return; }
      toast.success(`Fetched ${data?.total_posts || 0} posts from Threads!`);
      queryClient.invalidateQueries({ queryKey: ["posts-analyzed-own"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-follower-snapshots"] });
      try {
        const { data: identity } = await supabase
          .from("user_identity")
          .select("about_you")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!identity || !identity.about_you) {
          navigate("/my-story?autofill=true");
        }
      } catch { /* silently skip auto-fill check */ }
    } catch {
      toast.error("Failed to fetch posts from Threads");
    } finally {
      setFetching(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!user) return;
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not logged in"); return; }
      const { data, error } = await supabase.functions.invoke("run-analysis", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) { toast.error(error.message || "Analysis failed"); return; }
      const archetypeCount = data?.analysis?.archetypes?.length ?? 0;
      const insightCount = data?.analysis?.regression_insights?.length ?? 0;
      toast.success(`Analysis complete! ${archetypeCount} archetypes, ${insightCount} insights, and playbook built.`);
      queryClient.invalidateQueries({ queryKey: ["discovered-archetypes"] });
      queryClient.invalidateQueries({ queryKey: ["regression-insights"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-data"] });
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const statCards = [
    { label: "Views", value: periodStats.views, change: periodChanges.views, icon: Eye },
    { label: "Likes", value: periodStats.likes, change: periodChanges.likes, icon: Heart },
    { label: "Replies", value: periodStats.replies, change: periodChanges.replies, icon: MessageCircle },
    { label: "Reposts", value: periodStats.reposts, change: periodChanges.reposts, icon: Repeat2 },
    { label: "Quotes", value: periodStats.quotes, change: periodChanges.quotes, icon: Quote },
    { label: "Posts", value: periodStats.posts, change: periodChanges.posts, icon: FileText },
  ];

  const hasAnyData = (allPosts?.length ?? 0) > 0;
  const isLoading = postsLoading && !allPosts;

  // Best performing post
  const bestPost = useMemo(() => {
    if (!allPosts || allPosts.length === 0) return null;
    const sorted = [...allPosts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    const top = sorted[0];
    return top ? { text: top.text_content ?? "", views: top.views ?? 0 } : null;
  }, [allPosts]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">Your daily command center.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleFetchPosts} disabled={fetching} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching…" : "Fetch My Posts"}
            </Button>
            <Button onClick={handleRunAnalysis} disabled={analyzing || !hasAnyData} variant="outline">
              {analyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Brain className="h-4 w-4 mr-1.5" />}
              {analyzing ? "Analyzing…" : "Run Analysis"}
            </Button>
            <DateRangeSelector
              range={range}
              onRangeChange={setRange}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
            />
          </div>
        </div>

        {/* Analysis loading */}
        {analyzing && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Analyzing your content… This takes about 30 seconds.</span>
          </div>
        )}

        {!hasAnyData && !isLoading ? (
          <EmptyState
            icon={<BarChart3 className="h-7 w-7 text-muted-foreground" />}
            title="No data yet!"
            description="Connect your Threads account and click 'Fetch My Posts' to pull in your real analytics data."
            action={
              <div className="flex gap-3 mt-2">
                <Button onClick={() => navigate("/onboarding")} variant="outline">Connect Threads</Button>
                <Button onClick={handleFetchPosts} disabled={fetching} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
                  {fetching ? "Fetching…" : "Fetch My Posts"}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Account Header */}
            <div className="rounded-xl border border-border bg-card/50 px-4 py-2.5 flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={profile?.threads_profile_picture_url ?? undefined} />
                <AvatarFallback className="bg-muted"><User className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "Your Account"}
                </span>
                {profile?.threads_username && (
                  <span className="text-sm text-muted-foreground">@{profile.threads_username}</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Followers</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {latestFollowers !== null ? latestFollowers.toLocaleString() : (profile?.follower_count?.toLocaleString() ?? "—")}
                </span>
                {followerChange !== null && followerChange !== 0 && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${followerChange > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {followerChange > 0 ? "+" : ""}{followerChange}
                  </span>
                )}
              </div>
            </div>

            {/* Period Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground font-mono">{s.value.toLocaleString()}</p>
                  <PctChange value={s.change} hide={hidePctChange} />
                </div>
              ))}
            </div>

          </>
        )}

        {/* ===== NEW COMMAND CENTER WIDGETS ===== */}
        {hasAnyData && (
          <div className="space-y-5">
            {/* Today's Status + Posting Streak side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TodayStatusCard />
              <PostingStreakCard streak={streak} publishedDates={publishedDates} />
            </div>

            {/* Quick Actions */}
            <QuickActionsCard />

            {/* Growth Summary */}
            <GrowthSummaryCard
              followerCount={latestFollowers ?? profile?.follower_count ?? null}
              followerChange={followerChange}
              bestPost={bestPost}
            />

            {/* Top Insight */}
            <TopInsightCard />

            {/* Recent Posts Performance */}
            <RecentPostsCard posts={allPosts ?? []} />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
