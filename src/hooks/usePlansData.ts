import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type PlanType = "content_plan" | "branding_plan" | "funnel_strategy";

const SNAPSHOT_FIELDS = ["goal_type", "dm_keyword", "dm_offer", "max_posts_per_day", "niche", "traffic_url", "mission"] as const;

function usePlanQuery(planType: PlanType) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-plan", user?.id, planType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_plans")
        .select("plan_data, updated_at, profile_snapshot")
        .eq("user_id", user!.id)
        .eq("plan_type", planType)
        .maybeSingle();
      if (error) throw error;
      return data as { plan_data: any; updated_at: string; profile_snapshot: Record<string, any> | null } | null;
    },
    enabled: !!user?.id,
  });
}

export function useStrategyStale() {
  const { user } = useAuth();
  const contentPlan = usePlanQuery("content_plan");
  const funnelStrategy = usePlanQuery("funnel_strategy");

  const profileQuery = useQuery({
    queryKey: ["profile-snapshot-check", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("goal_type, dm_keyword, dm_offer, max_posts_per_day, niche, traffic_url, mission")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isStale = (() => {
    if (!profileQuery.data) return false;
    const profile = profileQuery.data;
    const plans = [contentPlan.data, funnelStrategy.data];
    for (const plan of plans) {
      if (!plan?.profile_snapshot) continue;
      const snap = plan.profile_snapshot;
      for (const field of SNAPSHOT_FIELDS) {
        const current = (profile as any)[field] ?? null;
        const saved = snap[field] ?? null;
        if (String(current) !== String(saved)) return true;
      }
    }
    // If plans exist but have no snapshot, they're from before this feature
    if (plans.some(p => p && !p.profile_snapshot)) return true;
    return false;
  })();

  return { isStale, isLoading: contentPlan.isLoading || funnelStrategy.isLoading || profileQuery.isLoading };
}

function useGeneratePlan(planType: PlanType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const res = await supabase.functions.invoke("generate-plans", {
        body: { plan_type: planType },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message || "Generation failed");
      return res.data;
    },
    onSuccess: (data) => {
      // Immediately update cache with returned plan data so UI never shows stale content
      if (data?.plan_data) {
        queryClient.setQueryData(
          ["user-plan", user?.id, planType],
          { plan_data: data.plan_data, updated_at: new Date().toISOString() }
        );
      }
      // Also invalidate to force a background refetch from DB
      queryClient.invalidateQueries({ queryKey: ["user-plan", user?.id, planType] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}

export function useContentPlan() {
  return { query: usePlanQuery("content_plan"), generate: useGeneratePlan("content_plan") };
}

export function useBrandingPlan() {
  return { query: usePlanQuery("branding_plan"), generate: useGeneratePlan("branding_plan") };
}

export function useFunnelStrategy() {
  return { query: usePlanQuery("funnel_strategy"), generate: useGeneratePlan("funnel_strategy") };
}

export function useHasIdentity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["has-identity", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_identity")
        .select("about_you")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data?.about_you;
    },
    enabled: !!user?.id,
  });
}
