import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { RegressionAnalysis } from "@/components/strategy/RegressionAnalysis";
import { GrowthSignals } from "@/components/strategy/GrowthSignals";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { ArchetypeCards } from "@/components/dashboard/ArchetypeCards";
import { cn } from "@/lib/utils";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { useArchetypeDiscovery, usePlaybookData } from "@/hooks/useStrategyData";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Brain } from "lucide-react";

const TABS = [
  { id: "regression", label: "Regression Insights" },
  { id: "growth", label: "Top Performers" },
  { id: "charts", label: "Performance Charts" },
  { id: "archetypes", label: "Content Archetypes" },
] as const;

type TabId = typeof TABS[number]["id"];

const Insights = () => {
  usePageTitle("Insights", "Data-driven analysis of your content performance");
  const [activeTab, setActiveTab] = useState<TabId>("regression");
  const { user } = useAuth();
  const { data: allPosts } = usePostsAnalyzed();
  const { data: discoveredArchetypes } = useArchetypeDiscovery();
  const { data: playbookData } = usePlaybookData();

  const followerQuery = useQuery({
    queryKey: ["insights-follower-snapshots", user?.id],
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

  const followerSnapshots = followerQuery.data ?? [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Insights</h1>
          <p className="mt-1 text-muted-foreground text-sm">Data-driven analysis of your content performance.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "regression" && <RegressionAnalysis />}
        {activeTab === "growth" && <GrowthSignals />}

        {activeTab === "charts" && (
          <div className="space-y-8">
            {/* Performance Trends */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Performance Trends</h2>
                <p className="text-sm text-muted-foreground">Follower growth, views, and engagement over time.</p>
              </div>
              {(allPosts?.length ?? 0) > 0 ? (
                <DashboardCharts posts={allPosts as any} followerSnapshots={followerSnapshots} />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                  No post data yet. Fetch your posts from the Dashboard to see charts.
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "archetypes" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Content Archetypes</h2>
              <p className="text-sm text-muted-foreground">Your AI-discovered content patterns and their performance.</p>
            </div>
            {discoveredArchetypes?.archetypes ? (
              <ArchetypeCards
                archetypes={discoveredArchetypes.archetypes}
                posts={allPosts ?? []}
                playbook={playbookData}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center">
                <Brain className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-foreground">Run Analysis to discover your content archetypes</p>
                <p className="text-xs text-muted-foreground mt-1">Go to Dashboard → Run Analysis to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Insights;
