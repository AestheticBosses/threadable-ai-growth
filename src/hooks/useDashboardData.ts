import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

export function useDashboardData(filters: DashboardFilters) {
  const { user } = useAuth();
  const userId = user?.id;
  const rangeStart = getRangeStart(filters);
  const rangeEnd = getRangeEnd(filters);

  const postsQuery = useQuery({
    queryKey: ["dashboard-posts", userId, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("posts_analyzed")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "own")
        .gte("posted_at", rangeStart.toISOString())
        .lte("posted_at", rangeEnd.toISOString())
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
        .select("threads_username, threads_access_token, threads_user_id")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const posts = postsQuery.data ?? [];
  const totalViews = posts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const avgEngagement = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement_rate ?? 0), 0) / posts.length
    : 0;
  const postsPublished = posts.length;

  const latestReport = weeklyReportsQuery.data?.[0] ?? null;
  const previousReport = weeklyReportsQuery.data?.[1] ?? null;

  return {
    posts,
    totalViews,
    avgEngagement,
    postsPublished,
    latestReport,
    previousReport,
    followerSnapshots: followerSnapshotsQuery.data ?? [],
    profile: profileQuery.data,
    isLoading: postsQuery.isLoading || weeklyReportsQuery.isLoading || followerSnapshotsQuery.isLoading,
  };
}
