import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type MilestoneHit,
  type UserStats,
  checkMilestones,
  getEarnedMilestones,
  getMilestoneLabel,
  milestoneKey,
} from "@/lib/milestones";
import { MilestoneShareModal } from "@/components/share/MilestoneShareModal";
import { subDays, startOfDay } from "date-fns";
import { differenceInCalendarDays } from "date-fns";

/** Priority order for sorting milestones (most impressive first) */
const TYPE_PRIORITY: Record<MilestoneHit["type"], number> = {
  viral: 0,
  growth: 1,
  views: 2,
  streak: 3,
  posts: 4,
};

export function YourWins() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalMilestone, setModalMilestone] = useState<MilestoneHit | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [dismissedNew, setDismissedNew] = useState(false);

  // Fetch all stats needed for milestone detection
  const { data } = useQuery({
    queryKey: ["your-wins-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const now = new Date();
      const thirtyDaysAgo = startOfDay(subDays(now, 30));

      const [postsRes, prevPostsRes, publishedRes, profileRes, allPostsCountRes] = await Promise.all([
        // Current period posts (30 days)
        supabase
          .from("posts_analyzed")
          .select("views, engagement_rate")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", thirtyDaysAgo.toISOString()),
        // Previous period posts (30-60 days ago)
        supabase
          .from("posts_analyzed")
          .select("views")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", startOfDay(subDays(now, 60)).toISOString())
          .lt("posted_at", thirtyDaysAgo.toISOString()),
        // Published posts for streak
        supabase
          .from("scheduled_posts")
          .select("published_at")
          .eq("user_id", user.id)
          .eq("status", "published")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false }),
        // Profile for shown_milestones
        supabase
          .from("profiles")
          .select("threads_username, full_name, display_name, threads_profile_picture_url")
          .eq("id", user.id)
          .maybeSingle(),
        // Total published posts count
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "published"),
      ]);

      const posts = postsRes.data ?? [];
      const prevPosts = prevPostsRes.data ?? [];
      const published = publishedRes.data ?? [];

      // Total views (all time from current period for simplicity — milestones use rolling 30d)
      const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);

      // Streak calculation (same as useDashboardData)
      let streak = 0;
      if (published.length > 0) {
        const uniqueDays = new Set(published.map((p) => new Date(p.published_at!).toDateString()));
        const sortedDays = Array.from(uniqueDays)
          .map((d) => new Date(d))
          .sort((a, b) => b.getTime() - a.getTime());
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (sortedDays.length > 0) {
          const diff = differenceInCalendarDays(today, sortedDays[0]);
          if (diff <= 1) {
            streak = 1;
            for (let i = 1; i < sortedDays.length; i++) {
              const gap = differenceInCalendarDays(sortedDays[i - 1], sortedDays[i]);
              if (gap === 1) streak++;
              else break;
            }
          }
        }
      }

      // Top post percentile (compare best engagement to median)
      let topPostPercentile: number | null = null;
      if (posts.length >= 5) {
        const sorted = [...posts].sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));
        const bestEngagement = sorted[0]?.engagement_rate ?? 0;
        const medianIdx = Math.floor(sorted.length / 2);
        const medianEngagement = sorted[medianIdx]?.engagement_rate ?? 0;
        if (medianEngagement > 0 && bestEngagement > 0) {
          const ratio = bestEngagement / medianEngagement;
          // Rough percentile: 2x median = top 10%, 3x = top 5%, 5x+ = top 1%
          if (ratio >= 5) topPostPercentile = 1;
          else if (ratio >= 3) topPostPercentile = 5;
          else if (ratio >= 2) topPostPercentile = 10;
        }
      }

      // Growth percentage
      const prevViews = prevPosts.reduce((s, p) => s + ((p as any).views ?? 0), 0);
      const growthPct = prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 100) : null;

      const postsPublished = allPostsCountRes.count ?? 0;

      const currentStats: UserStats = {
        streak,
        totalViews,
        topPostPercentile,
        growthPct,
        postsPublished,
      };

      const shownMilestones: string[] = Array.isArray((profileRes.data as any)?.shown_milestones)
        ? (profileRes.data as any).shown_milestones
        : [];

      const newMilestones = checkMilestones(currentStats, shownMilestones);
      const earned = getEarnedMilestones(currentStats);

      return {
        currentStats,
        shownMilestones,
        newMilestones,
        earned,
        profile: profileRes.data,
        postsPublished,
      };
    },
    enabled: !!user?.id,
  });

  const userDisplay = {
    name: data?.profile?.display_name || data?.profile?.full_name || "Creator",
    handle: data?.profile?.threads_username || "threads",
    avatarUrl: data?.profile?.threads_profile_picture_url ?? undefined,
  };

  // Auto-trigger modal for first new milestone
  useEffect(() => {
    if (autoTriggered || !data?.newMilestones?.length) return;
    // Pick the most impressive new milestone
    const sorted = [...data.newMilestones].sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);
    setModalMilestone(sorted[0]);
    setAutoTriggered(true);
  }, [data?.newMilestones, autoTriggered]);

  const handleMarkShown = useCallback(async (key: string) => {
    if (!user?.id || !data) return;
    const updated = [...new Set([...(data.shownMilestones || []), key])];
    await supabase
      .from("profiles")
      .update({ shown_milestones: updated } as any)
      .eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["your-wins-stats"] });
    setDismissedNew(true);
  }, [user?.id, data, queryClient]);

  const hasNewMilestone = (data?.newMilestones?.length ?? 0) > 0 && !dismissedNew;

  // Sort earned: most impressive first, then by highest value within type
  const sortedEarned = [...(data?.earned ?? [])]
    .sort((a, b) => {
      const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
      if (typeDiff !== 0) return typeDiff;
      return b.value - a.value;
    })
    // Deduplicate: only keep the highest value per type
    .filter((m, i, arr) => i === arr.findIndex((a) => a.type === m.type))
    .slice(0, 5);

  if (!data || sortedEarned.length === 0) {
    // Empty state
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Your Wins</h2>
        </div>
        <div className="rounded-lg border border-border bg-card/50 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">Hit your first milestone to unlock share cards</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Your Wins</h2>
          {hasNewMilestone && (
            <button
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              onClick={() => {
                if (data.newMilestones.length > 0) {
                  const sorted = [...data.newMilestones].sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);
                  setModalMilestone(sorted[0]);
                }
              }}
            >
              <Flame className="h-3 w-3" />
              New milestone
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {sortedEarned.map((m) => {
            const { emoji, label, subtext } = getMilestoneLabel(m.type, m.value);
            return (
              <div
                key={milestoneKey(m.type, m.value)}
                className="rounded-lg border border-border bg-card/50 px-3 py-2.5 flex items-center gap-2.5"
              >
                <span className="text-base shrink-0">{emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{subtext}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary h-auto py-1 px-2 shrink-0"
                  onClick={() => setModalMilestone({ ...m, isNew: false })}
                >
                  Share <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Share modal */}
      {modalMilestone && (
        <MilestoneShareModal
          milestone={modalMilestone}
          user={userDisplay}
          meta={{ posts: data.postsPublished }}
          onClose={() => setModalMilestone(null)}
          onMarkShown={handleMarkShown}
        />
      )}
    </>
  );
}
