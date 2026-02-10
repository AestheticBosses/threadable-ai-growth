import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { KPICards } from "@/components/dashboard/KPICards";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { WeeklyReportCard } from "@/components/dashboard/WeeklyReportCard";
import { StreakBanner } from "@/components/dashboard/StreakBanner";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisOverview } from "@/components/strategy/AnalysisOverview";
import { useDashboardData, type DateRange } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
    streak,
    isLoading,
  } = useDashboardData({ range, customFrom, customTo });

  const handleFetchPosts = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-user-posts");
      console.log("Fetch response:", { data, error });
      if (error) {
        console.error("Fetch posts error:", error);
        toast.error(error.message || "Failed to fetch posts");
        return;
      }
      toast.success(`Fetched ${data.total_posts} posts from Threads!`);
      queryClient.invalidateQueries({ queryKey: ["dashboard-posts"] });
    } catch (err) {
      console.error("Fetch posts error:", err);
      toast.error("Failed to fetch posts from Threads");
    } finally {
      setFetching(false);
    }
  };

  const latestFollowers = followerSnapshots.length > 0
    ? followerSnapshots[followerSnapshots.length - 1].follower_count
    : null;
  const followerGrowth = latestReport?.follower_growth ?? null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">Your Threads analytics at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFetchPosts}
              disabled={fetching}
              className="bg-[hsl(270,60%,60%)] hover:bg-[hsl(270,60%,50%)] text-white"
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-lg" />)}
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
                <Button onClick={handleFetchPosts} disabled={fetching} className="bg-[hsl(270,60%,60%)] hover:bg-[hsl(270,60%,50%)] text-white">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
                  {fetching ? "Fetching…" : "Fetch My Posts"}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <StreakBanner streak={streak} />

            <KPICards
              totalFollowers={latestFollowers}
              followerGrowth={followerGrowth}
              avgEngagement={avgEngagement}
              totalViews={totalViews}
              postsPublished={postsPublished}
            />

            <DashboardCharts posts={posts} followerSnapshots={followerSnapshots} />

            <WeeklyReportCard latest={latestReport} previous={previousReport} />
          </>
        )}

        {/* Analysis Overview — mock data section */}
        <div className="pt-4">
          <AnalysisOverview />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;