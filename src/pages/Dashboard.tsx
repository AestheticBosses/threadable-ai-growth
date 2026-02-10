import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { WeeklyReportCard } from "@/components/dashboard/WeeklyReportCard";
import { StreakBanner } from "@/components/dashboard/StreakBanner";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisOverview } from "@/components/strategy/AnalysisOverview";
import { useDashboardData, type DateRange } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, RefreshCw, ArrowUp, ArrowDown, User, Flame, Eye, Heart, MessageCircle, Repeat2, Quote, FileText } from "lucide-react";
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
  const [range, setRange] = useState<DateRange>("30");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [fetching, setFetching] = useState(false);

  const {
    posts,
    totalViews,
    avgEngagement,
    postsPublished,
    latestReport,
    previousReport,
    followerSnapshots,
    latestFollowers,
    followerChange,
    profile,
    streak,
    periodStats,
    periodChanges,
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

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
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

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2].map(i => <Skeleton key={i} className="h-64 rounded-lg" />)}
            </div>
          </div>
        ) : posts.length === 0 ? (
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
            {/* Account Overview Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={(profile as any)?.threads_profile_picture_url ?? undefined} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {profile?.full_name ?? "Your Account"}
                  </p>
                  {profile?.threads_username && (
                    <p className="text-xs text-muted-foreground">@{profile.threads_username}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6 ml-0 sm:ml-auto">
                {latestFollowers !== null && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Followers: </span>
                    <span className="font-bold text-foreground">{latestFollowers.toLocaleString()}</span>
                    {followerChange !== null && followerChange !== 0 && (
                      <span className={`ml-1.5 text-xs font-medium ${followerChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {followerChange > 0 ? "+" : ""}{followerChange}
                      </span>
                    )}
                  </div>
                )}
                {streak >= 2 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Flame className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">{streak} day streak</span>
                  </div>
                )}
              </div>
            </div>

            {/* Period Stats — 6 Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
                    <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-foreground">{s.value.toLocaleString()}</p>
                  <PctChange value={s.change} />
                </div>
              ))}
            </div>

            {/* Charts */}
            <DashboardCharts posts={posts} followerSnapshots={followerSnapshots} />

            {/* Weekly Report */}
            <WeeklyReportCard latest={latestReport} previous={previousReport} />
          </>
        )}

        {/* Analysis Overview — archetype cards + posts table */}
        <div className="pt-4">
          <AnalysisOverview />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
