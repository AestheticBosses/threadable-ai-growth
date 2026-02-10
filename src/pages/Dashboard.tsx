import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisOverview } from "@/components/strategy/AnalysisOverview";
import { useDashboardData, type DateRange } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { BarChart3, RefreshCw, ArrowUp, ArrowDown, User, Eye, Heart, MessageCircle, Repeat2, Quote, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const Dashboard = () => {
  usePageTitle("Dashboard", "Your Threads analytics and performance overview");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [fetching, setFetching] = useState(false);

  const {
    posts,
    followerSnapshots,
    latestFollowers,
    followerChange,
    profile,
    periodStats,
    periodChanges,
    allPostsCount,
    isLoading,
  } = useDashboardData({ range, customFrom, customTo });

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-posts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-posts-prev"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-follower-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-profile"] });
      queryClient.invalidateQueries({ queryKey: ["posts-analyzed-own"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-all-posts-count"] });
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

  const hasAnyData = allPostsCount > 0;

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
            {/* Section 1: Account Header — compact single row */}
            <div
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 16px' }}
              className="flex items-center gap-3"
            >
              <Avatar className="h-9 w-9 border border-[hsl(0,0%,100%,0.1)]">
                <AvatarImage src={(profile as any)?.threads_profile_picture_url ?? undefined} />
                <AvatarFallback style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <User className="h-4 w-4" style={{ color: '#8a8680' }} />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#e8e4de', fontWeight: 600, fontSize: '14px' }}>
                  {(profile as any)?.display_name || profile?.full_name || user?.email?.split("@")[0] || "Your Account"}
                </span>
                {profile?.threads_username && (
                  <span style={{ color: '#8a8680', fontSize: '13px' }}>@{profile.threads_username}</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span style={{ color: '#8a8680', fontSize: '13px' }}>Followers</span>
                <span style={{ color: '#e8e4de', fontWeight: 700, fontSize: '18px', fontFamily: "'Space Mono', monospace" }}>
                  {latestFollowers !== null ? latestFollowers.toLocaleString() : ((profile as any)?.follower_count?.toLocaleString() ?? "—")}
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
              <DashboardCharts posts={posts} followerSnapshots={followerSnapshots} />
            )}
          </>
        )}

        {/* Section 3 & 4: Archetype Performance + All Analyzed Posts (filtered by date range) */}
        {hasAnyData && (
          <AnalysisOverview range={range} customFrom={customFrom} customTo={customTo} />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
