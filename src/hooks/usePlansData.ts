import { useState, useEffect } from "react";
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

async function pollForCompletion(
  userId: string,
  planType: PlanType,
  onElapsedUpdate?: (seconds: number) => void,
): Promise<any> {
  const maxWaitMs = 360_000; // 6 minutes
  const pollIntervalMs = 5_000; // 5 seconds
  const startTime = Date.now();

  const checkStatus = async () => {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("plan_generation_status")
      .eq("id", userId)
      .maybeSingle();
    return data?.plan_generation_status;
  };

  const fetchPlan = async () => {
    await (supabase as any).from("profiles").update({ plan_generation_status: "idle" }).eq("id", userId);
    const { data: plan } = await (supabase as any)
      .from("user_plans")
      .select("plan_data")
      .eq("user_id", userId)
      .eq("plan_type", planType)
      .maybeSingle();
    return plan;
  };

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    onElapsedUpdate?.(Math.floor((Date.now() - startTime) / 1000));

    const status = await checkStatus();
    if (status === "complete") return await fetchPlan();
    if (status === "error") {
      await (supabase as any).from("profiles").update({ plan_generation_status: "idle" }).eq("id", userId);
      throw new Error("Plan generation failed. Try again.");
    }
  }

  // Silent retry: wait 60s and check one more time before giving up
  onElapsedUpdate?.(Math.floor((Date.now() - startTime) / 1000));
  await new Promise(r => setTimeout(r, 60_000));
  onElapsedUpdate?.(Math.floor((Date.now() - startTime) / 1000));

  const finalStatus = await checkStatus();
  if (finalStatus === "complete") return await fetchPlan();

  const err = new Error("Your plan is still generating") as any;
  err.isTimeout = true;
  throw err;
}

function useGeneratePlan(planType: PlanType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generationElapsed, setGenerationElapsed] = useState(0);

  const mutation = useMutation({
    mutationFn: async () => {
      setGenerationElapsed(0);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      // Get timezone from profile, fall back to browser detection
      let clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.timezone) clientTimezone = prof.timezone;
      }

      const now = new Date();
      const res = await supabase.functions.invoke("generate-plans", {
        body: {
          plan_type: planType,
          background: true,
          client_now_minutes: now.getHours() * 60 + now.getMinutes(),
          client_day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()],
          client_timezone: clientTimezone,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message || "Generation failed");

      // Background mode: poll for completion
      if (res.data?.status === "generating") {
        return await pollForCompletion(user!.id, planType, setGenerationElapsed);
      }
      return res.data;
    },
    onSuccess: (data) => {
      setGenerationElapsed(0);
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
      setGenerationElapsed(0);
      // Don't show destructive toast for soft timeouts — handled inline by UI
      if ((e as any).isTimeout) return;
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return { mutation, generationElapsed };
}

export function useContentPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const planQuery = usePlanQuery("content_plan");
  const { mutation, generationElapsed } = useGeneratePlan("content_plan");

  // Check if a background generation completed while user was away
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("plan_generation_status")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.plan_generation_status === "complete") {
        await (supabase as any).from("profiles").update({ plan_generation_status: "idle" }).eq("id", user.id);
        queryClient.invalidateQueries({ queryKey: ["user-plan", user.id, "content_plan"] });
      }
    })();
  }, [user?.id]);

  return { query: planQuery, generate: mutation, generationElapsed };
}

export function useBrandingPlan() {
  const { mutation, generationElapsed } = useGeneratePlan("branding_plan");
  return { query: usePlanQuery("branding_plan"), generate: mutation, generationElapsed };
}

export function useFunnelStrategy() {
  const { mutation, generationElapsed } = useGeneratePlan("funnel_strategy");
  return { query: usePlanQuery("funnel_strategy"), generate: mutation, generationElapsed };
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
