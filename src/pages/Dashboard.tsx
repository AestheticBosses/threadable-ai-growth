import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { KPICards } from "@/components/dashboard/KPICards";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { WeeklyReportCard } from "@/components/dashboard/WeeklyReportCard";
import { StreakBanner } from "@/components/dashboard/StreakBanner";
import { EmptyState } from "@/components/EmptyState";
import { useDashboardData, type DateRange } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  usePageTitle("Dashboard", "Your Threads analytics and performance overview");
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>("30");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

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
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">Your Threads analytics at a glance.</p>
          </div>
          <DateRangeSelector
            range={range}
            onRangeChange={setRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
          />
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
            title="No Posts Analyzed Yet"
            description="Run an analysis to start seeing your performance metrics here."
            action={
              <Button onClick={() => navigate("/analyze")} className="mt-2">
                Run Analysis
              </Button>
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
      </div>
    </AppLayout>
  );
};

export default Dashboard;
