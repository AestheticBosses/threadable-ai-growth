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
