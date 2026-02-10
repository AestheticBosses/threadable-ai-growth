import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisOverview } from "@/components/strategy/AnalysisOverview";
import { type DateRange } from "@/hooks/useDashboardData";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { usePageTitle } from "@/hooks/usePageTitle";
import { BarChart3, RefreshCw, ArrowUp, ArrowDown, User, Eye, Heart, MessageCircle, Repeat2, Quote, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { subDays, startOfDay } from "date-fns";

function PctChange({ value }: { value: number }) {
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
  if (!start) return posts; // "all" — no filter
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

  // Single data source — the same query that powers Archetype cards & posts table
  const { data: allPosts, isLoading: postsLoading } = usePostsAnalyzed();

  // Profile data (independent query)
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

  // Follower snapshots
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

  const profile = profileQuery.data;
  const followerSnapshots = followerQuery.data ?? [];
  const latestFollowers = followerSnapshots.length > 0 ? followerSnapshots[followerSnapshots.length - 1].follower_count : null;
  const earliestFollowers = followerSnapshots.length > 0 ? followerSnapshots[0].follower_count : null;
  const followerChange = latestFollowers !== null && earliestFollowers !== null ? latestFollowers - earliestFollowers : null;

  // Filter posts by date range — single source of truth
  const posts = useMemo(() => allPosts ? filterPostsByRange(allPosts, range, customFrom, customTo) : [], [allPosts, range, customFrom, customTo]);

  // Previous period for % change
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
    } catch (err) {
      toast.error("Failed to fetch posts from Threads");
    } finally {
      setFetching(false);
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

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header with date selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">Your Threads analytics at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFetchPosts}
              disabled={fetching}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching…" : "Fetch My Posts"}
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

        {!hasAnyData && !isLoading ? (
          <EmptyState
            icon={<BarChart3 className="h-7 w-7 text-muted-foreground" />}
            title="No data yet!"
            description="Connect your Threads account and click 'Fetch My Posts' to pull in your real analytics data."
            action={
              <div className="flex gap-3 mt-2">
                <Button onClick={() => navigate("/onboarding")} variant="outline">
                  Connect Threads
                </Button>
                <Button onClick={handleFetchPosts} disabled={fetching} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
                  {fetching ? "Fetching…" : "Fetch My Posts"}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Section 1: Account Header */}
            <div
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 16px' }}
              className="flex items-center gap-3"
            >
              <Avatar className="h-9 w-9 border border-[hsl(0,0%,100%,0.1)]">
                <AvatarImage src={profile?.threads_profile_picture_url ?? undefined} />
                <AvatarFallback style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <User className="h-4 w-4" style={{ color: '#8a8680' }} />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#e8e4de', fontWeight: 600, fontSize: '14px' }}>
                  {profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "Your Account"}
                </span>
                {profile?.threads_username && (
                  <span style={{ color: '#8a8680', fontSize: '13px' }}>@{profile.threads_username}</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span style={{ color: '#8a8680', fontSize: '13px' }}>Followers</span>
                <span style={{ color: '#e8e4de', fontWeight: 700, fontSize: '18px', fontFamily: "'Space Mono', monospace" }}>
                  {latestFollowers !== null ? latestFollowers.toLocaleString() : (profile?.follower_count?.toLocaleString() ?? "—")}
                </span>
                {followerChange !== null && followerChange !== 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: followerChange > 0 ? '#34d399' : '#f87171',
                      background: followerChange > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {followerChange > 0 ? "+" : ""}{followerChange}
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Period Stats — 6 Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map((s) => (
                <div
                  key={s.label}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: '#8a8680', fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                    <s.icon className="h-3.5 w-3.5" style={{ color: '#8a8680' }} />
                  </div>
                  <p style={{ color: '#e8e4de', fontSize: '24px', fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{s.value.toLocaleString()}</p>
                  <PctChange value={s.change} />
                </div>
              ))}
            </div>

            {/* Charts */}
            {posts.length > 0 && (
              <DashboardCharts posts={posts as any} followerSnapshots={followerSnapshots} />
            )}
          </>
        )}

        {/* Section 3 & 4: Archetype Performance + All Analyzed Posts */}
        {hasAnyData && (
          <AnalysisOverview range={range} customFrom={customFrom} customTo={customTo} />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
