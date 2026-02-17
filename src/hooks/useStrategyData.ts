import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DiscoveredArchetype {
  name: string;
  emoji: string;
  description: string;
  drives: string;
  avg_views: number;
  avg_engagement: number;
  key_ingredients: string[];
  template: string;
  recommended_percentage: number;
  example_posts: string[];
}

export interface ArchetypeDiscovery {
  archetypes: DiscoveredArchetype[];
  weekly_schedule: { day: string; archetype: string; notes: string }[];
  rules: string[];
}

export interface RegressionInsight {
  category: string;
  insight: string;
  evidence: string;
  metric_impacted: string;
  strength: string;
  recommendation: string;
}

export interface RegressionInsightsData {
  insights: RegressionInsight[];
}

export interface PlaybookData {
  weekly_schedule: { day: string; archetype: string; emoji: string; notes: string }[];
  checklist: { points: number; question: string; data_backing: string }[];
  templates: { archetype: string; emoji: string; template: string; example: string }[];
  rules: { rule: string; evidence: string }[];
  generation_guidelines: { tone: string; avg_length: string; vocabulary: string[]; hooks_that_work?: string[]; avoid: string[] };
}

async function fetchStrategyData<T>(userId: string, strategyType: string): Promise<T | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/content_strategies?user_id=eq.${userId}&strategy_type=eq.${strategyType}&select=strategy_data&limit=1`,
    {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const rows = await res.json();
  return (rows?.[0]?.strategy_data as T) ?? null;
}

export function useArchetypeDiscovery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["discovered-archetypes", user?.id],
    queryFn: () => fetchStrategyData<ArchetypeDiscovery>(user!.id, "archetype_discovery"),
    enabled: !!user?.id,
  });
}

export function useRegressionInsights() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["regression-insights", user?.id],
    queryFn: () => fetchStrategyData<RegressionInsightsData>(user!.id, "regression_insights"),
    enabled: !!user?.id,
  });
}

export function usePlaybookData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["playbook-data", user?.id],
    queryFn: () => fetchStrategyData<PlaybookData>(user!.id, "playbook"),
    enabled: !!user?.id,
  });
}

// ── Content Strategy V2 types ──

export interface ContentBucket {
  id: string;
  name: string;
  description: string | null;
  audience_persona: string | null;
  business_connection: string | null;
  priority: number | null;
}

export interface ConnectedTopic {
  id: string;
  pillar_id: string;
  name: string;
  hook_angle: string | null;
}

export interface ContentPillar {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  percentage: number;
  bucket_id: string | null;
}

export interface ContentPlanItem {
  id: string;
  plan_week: number;
  plan_day: number;
  scheduled_date: string;
  pillar_id: string | null;
  topic_id: string | null;
  archetype: string | null;
  funnel_stage: string | null;
  is_test_slot: boolean;
  status: string;
}

export interface ProfileStrategy {
  mission: string | null;
  posting_cadence: string | null;
  traffic_url: string | null;
}

// ── Content Strategy V2 hooks ──

export function useProfileStrategy() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile-strategy", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("mission, posting_cadence, traffic_url")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as ProfileStrategy;
    },
    enabled: !!user?.id,
  });
}

export function useContentBuckets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["content-buckets", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_buckets")
        .select("id, name, description, audience_persona, business_connection, priority")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("priority");
      if (error) throw error;
      return (data || []) as ContentBucket[];
    },
    enabled: !!user?.id,
  });
}

export function useContentPillars() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["content-pillars", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_pillars")
        .select("id, name, description, purpose, percentage, bucket_id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("percentage", { ascending: false });
      if (error) throw error;
      return (data || []) as ContentPillar[];
    },
    enabled: !!user?.id,
  });
}

export function useConnectedTopics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["connected-topics", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("connected_topics")
        .select("id, pillar_id, name, hook_angle")
        .eq("user_id", user!.id)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as ConnectedTopic[];
    },
    enabled: !!user?.id,
  });
}

export function useContentPlanItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["content-plan-items", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_plan_items")
        .select("id, plan_week, plan_day, scheduled_date, pillar_id, topic_id, archetype, funnel_stage, is_test_slot, status")
        .eq("user_id", user!.id)
        .order("scheduled_date");
      if (error) throw error;
      return (data || []) as ContentPlanItem[];
    },
    enabled: !!user?.id,
  });
}
