import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { PlanHealthHero } from "@/components/dashboard/PlanHealthHero";
import { WeeklyPipeline } from "@/components/dashboard/WeeklyPipeline";
import { WeeklyPerformance } from "@/components/dashboard/WeeklyPerformance";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { usePageTitle } from "@/hooks/usePageTitle";
import { BarChart3, RefreshCw, Brain, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Dashboard = () => {
  usePageTitle("Dashboard", "Your weekly accountability hub");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  const profile = profileQuery.data;
  const followerSnapshots = followerQuery.data ?? [];
  const latestFollowers = followerSnapshots.length > 0
    ? followerSnapshots[followerSnapshots.length - 1].follower_count
    : null;

  // Auto-refresh profile on mount
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
        // silently fall back
      } finally {
        setProfileRefreshed(true);
      }
    };
    refreshProfile();
  }, [user, profileRefreshed]);

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
      } catch { /* silently skip */ }
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
      toast.success(`Analysis complete! ${archetypeCount} archetypes, ${insightCount} insights.`);
      queryClient.invalidateQueries({ queryKey: ["discovered-archetypes"] });
      queryClient.invalidateQueries({ queryKey: ["regression-insights"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-data"] });
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const hasAnyData = (allPosts?.length ?? 0) > 0;
  const isLoading = postsLoading && !allPosts;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">Your weekly command center.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleFetchPosts} disabled={fetching} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching…" : "Fetch Posts"}
            </Button>
            <Button onClick={handleRunAnalysis} disabled={analyzing || !hasAnyData} variant="outline">
              {analyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Brain className="h-4 w-4 mr-1.5" />}
              {analyzing ? "Analyzing…" : "Run Analysis"}
            </Button>
          </div>
        </div>

        {/* Analysis loading banner */}
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
            description="Connect your Threads account and click 'Fetch Posts' to pull in your real analytics data."
            action={
              <div className="flex gap-3 mt-2">
                <Button onClick={() => navigate("/onboarding")} variant="outline">Connect Threads</Button>
                <Button onClick={handleFetchPosts} disabled={fetching} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
                  {fetching ? "Fetching…" : "Fetch Posts"}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Account strip */}
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
                  {latestFollowers !== null
                    ? latestFollowers.toLocaleString()
                    : (profile?.follower_count?.toLocaleString() ?? "—")}
                </span>
              </div>
            </div>

            {/* ── Section 1: Plan Health Hero ── */}
            <PlanHealthHero />

            {/* ── Section 2: This Week's Pipeline ── */}
            <WeeklyPipeline />

            {/* ── Section 3: This Week's Performance ── */}
            <WeeklyPerformance />

            {/* Quick Actions */}
            <QuickActionsCard />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
