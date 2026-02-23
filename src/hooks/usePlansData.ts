import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type PlanType = "content_plan" | "branding_plan" | "funnel_strategy";

function usePlanQuery(planType: PlanType) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-plan", user?.id, planType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_plans")
        .select("plan_data, updated_at")
        .eq("user_id", user!.id)
        .eq("plan_type", planType)
        .maybeSingle();
      if (error) throw error;
      return data as { plan_data: any; updated_at: string } | null;
    },
    enabled: !!user?.id,
  });
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
