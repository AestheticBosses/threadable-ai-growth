import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInCalendarDays } from "date-fns";
import { subDays, startOfDay } from "date-fns";

export type DateRange = "7" | "30" | "90" | "custom";

interface DashboardFilters {
  range: DateRange;
  customFrom?: Date;
  customTo?: Date;
}

function getRangeStart(filters: DashboardFilters): Date {
  if (filters.range === "custom" && filters.customFrom) return filters.customFrom;
  const days = parseInt(filters.range, 10);
  return startOfDay(subDays(new Date(), days));
}

function getRangeEnd(filters: DashboardFilters): Date {
  if (filters.range === "custom" && filters.customTo) return filters.customTo;
  return new Date();
}

function getPreviousRangeStart(filters: DashboardFilters): Date {
  const rangeStart = getRangeStart(filters);
  const rangeEnd = getRangeEnd(filters);
  const durationMs = rangeEnd.getTime() - rangeStart.getTime();
  return new Date(rangeStart.getTime() - durationMs);
}

export function useDashboardData(filters: DashboardFilters) {
  const { user } = useAuth();
  const userId = user?.id;
  const rangeStart = getRangeStart(filters);
  const rangeEnd = getRangeEnd(filters);
  const prevRangeStart = getPreviousRangeStart(filters);

  const postsQuery = useQuery({
    queryKey: ["dashboard-posts", userId, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("posts_analyzed")
        .select("*")
        .eq("user_id", userId)
        .gte("posted_at", rangeStart.toISOString())
        .lte("posted_at", rangeEnd.toISOString())
        .order("posted_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const previousPostsQuery = useQuery({
    queryKey: ["dashboard-posts-prev", userId, prevRangeStart.toISOString(), rangeStart.toISOString()],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("posts_analyzed")
        .select("*")
        .eq("user_id", userId)
        .gte("posted_at", prevRangeStart.toISOString())
        .lt("posted_at", rangeStart.toISOString())
        .order("posted_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const weeklyReportsQuery = useQuery({
    queryKey: ["dashboard-weekly-reports", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(2);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const followerSnapshotsQuery = useQuery({
    queryKey: ["dashboard-follower-snapshots", userId, rangeStart.toISOString()],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("follower_snapshots")
        .select("*")
        .eq("user_id", userId)
        .gte("recorded_at", rangeStart.toISOString())
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const profileQuery = useQuery({
    queryKey: ["dashboard-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("threads_username, threads_access_token, threads_user_id, full_name, display_name, threads_profile_picture_url, follower_count")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  // Count all posts (regardless of date filter) to know if user has ANY data
  const allPostsCountQuery = useQuery({
    queryKey: ["dashboard-all-posts-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from("posts_analyzed")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
  });

  // Compute posting streak from published posts
  const publishedPostsQuery = useQuery({
    queryKey: ["dashboard-streak", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("published_at")
        .eq("user_id", userId)
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const posts = postsQuery.data ?? [];
  const previousPosts = previousPostsQuery.data ?? [];

  // Period stats
  const sumField = (arr: typeof posts, field: string) =>
    arr.reduce((sum, p) => sum + ((p as any)[field] ?? 0), 0);

  const periodStats = {
    views: sumField(posts, "views"),
    likes: sumField(posts, "likes"),
    replies: sumField(posts, "replies"),
    reposts: sumField(posts, "reposts"),
    quotes: sumField(posts, "quotes"),
    posts: posts.length,
  };

  const prevPeriodStats = {
    views: sumField(previousPosts, "views"),
    likes: sumField(previousPosts, "likes"),
    replies: sumField(previousPosts, "replies"),
    reposts: sumField(previousPosts, "reposts"),
    quotes: sumField(previousPosts, "quotes"),
    posts: previousPosts.length,
  };

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  };

  const periodChanges = {
    views: pctChange(periodStats.views, prevPeriodStats.views),
    likes: pctChange(periodStats.likes, prevPeriodStats.likes),
    replies: pctChange(periodStats.replies, prevPeriodStats.replies),
    reposts: pctChange(periodStats.reposts, prevPeriodStats.reposts),
    quotes: pctChange(periodStats.quotes, prevPeriodStats.quotes),
    posts: pctChange(periodStats.posts, prevPeriodStats.posts),
  };

  const totalViews = periodStats.views;
  const avgEngagement = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement_rate ?? 0), 0) / posts.length
    : 0;
  const postsPublished = posts.length;

  const latestReport = weeklyReportsQuery.data?.[0] ?? null;
  const previousReport = weeklyReportsQuery.data?.[1] ?? null;

  // Follower data
  const followerSnapshots = followerSnapshotsQuery.data ?? [];
  const latestFollowers = followerSnapshots.length > 0
    ? followerSnapshots[followerSnapshots.length - 1].follower_count
    : null;
  const earliestFollowersInRange = followerSnapshots.length > 0
    ? followerSnapshots[0].follower_count
    : null;
  const followerChange = latestFollowers !== null && earliestFollowersInRange !== null
    ? latestFollowers - earliestFollowersInRange
    : null;

  // Calculate streak
  const publishedPosts = publishedPostsQuery.data ?? [];
  let streak = 0;
  if (publishedPosts.length > 0) {
    const uniqueDays = new Set(
      publishedPosts.map((p) => new Date(p.published_at!).toDateString())
    );
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

  return {
    posts,
    previousPosts,
    totalViews,
    avgEngagement,
    postsPublished,
    latestReport,
    previousReport,
    followerSnapshots,
    latestFollowers,
    followerChange,
    profile: profileQuery.data,
    streak,
    periodStats,
    periodChanges,
    allPostsCount: allPostsCountQuery.data ?? 0,
    isLoading: postsQuery.isLoading || weeklyReportsQuery.isLoading || followerSnapshotsQuery.isLoading || profileQuery.isLoading || allPostsCountQuery.isLoading,
  };
}
