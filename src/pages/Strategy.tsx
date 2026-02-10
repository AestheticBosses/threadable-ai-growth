import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ArrowRight,
  Target,
  Sparkles,
} from "lucide-react";

import { ContentArchetypes } from "@/components/strategy/ContentArchetypes";
import { ScoringChecklist } from "@/components/strategy/ScoringChecklist";
import { WeeklyScheduleSection } from "@/components/strategy/WeeklyScheduleSection";
import { HookFormulas } from "@/components/strategy/HookFormulas";
import { TopicsSection } from "@/components/strategy/TopicsSection";
import { AvoidSection } from "@/components/strategy/AvoidSection";

type StrategyJson = {
  content_pillars?: { name: string; description: string; percentage_of_content: number; example_topics: string[] }[];
  weekly_schedule?: { day: string; posts_count: number; content_types: string[]; best_time: string }[];
  content_ratios?: { authority: number; engagement: number; storytelling: number; cta: number };
  hooks_to_use?: string[];
  topics_for_this_week?: string[];
  avoid?: string[];
};

const Strategy = () => {
  usePageTitle("Content Strategy", "Your data-driven weekly content plan");
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasInsights, setHasInsights] = useState(false);
  const [strategy, setStrategy] = useState<StrategyJson | null>(null);

  const loadStrategy = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("content_strategies")
      .select("strategy_json, regression_insights")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!data || !data.regression_insights) {
      setHasInsights(false);
      setLoading(false);
      return;
    }

    setHasInsights(true);

    if (data.strategy_json) {
      setStrategy(data.strategy_json as unknown as StrategyJson);
      setLoading(false);
    } else {
      setLoading(false);
      generateStrategy();
    }
  }, [user]);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  const generateStrategy = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate strategy");
      }

      const data = await res.json();
      setStrategy(data);
      toast({ title: "Strategy generated!", description: "Your weekly content plan is ready." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasInsights) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-6">
          <Target className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Analysis Data Yet</h2>
          <p className="text-muted-foreground text-center max-w-md">
            We need to analyze your posts before generating a strategy. Run the analysis first.
          </p>
          <Button size="lg" onClick={() => navigate("/analyze")} className="gap-2">
            Run Analysis First
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (generating) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-6 px-6">
          <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-foreground">Generating Your Strategy</h2>
            <p className="text-muted-foreground">AI is crafting a personalized content plan based on your data...</p>
          </div>
          <Progress value={65} className="h-2 w-64" />
        </div>
      </AppLayout>
    );
  }

  if (!strategy) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-6">
          <Sparkles className="h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Ready to Generate</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Your analysis data is ready. Let's create a data-driven content strategy.
          </p>
          <Button size="lg" onClick={generateStrategy} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Strategy
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Strategy</h1>
            <p className="mt-1 text-muted-foreground">Your archetype-driven weekly content plan.</p>
          </div>
          <Button variant="outline" onClick={generateStrategy} disabled={generating} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Regenerate
          </Button>
        </div>

        {/* Section 1: Content Archetypes */}
        <ContentArchetypes />

        {/* Section 2: Scoring Checklist */}
        <ScoringChecklist />

        {/* Section 3: Weekly Schedule */}
        <WeeklyScheduleSection schedule={strategy.weekly_schedule} />

        {/* Section 4: Hook Formulas */}
        <HookFormulas hooks={strategy.hooks_to_use} />

        {/* Section 5: Topics */}
        <TopicsSection topics={strategy.topics_for_this_week} />

        {/* Section 6: Avoid */}
        <AvoidSection items={strategy.avoid ?? []} />

        {/* Section 7: CTA */}
        <div className="pt-4">
          <Button size="lg" onClick={() => navigate("/queue")} className="gap-2">
            Generate This Week's Content
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Strategy;
