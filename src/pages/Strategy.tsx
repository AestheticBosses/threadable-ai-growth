import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ArrowRight,
  Lightbulb,
  Calendar,
  Target,
  AlertTriangle,
  Sparkles,
  Clock,
} from "lucide-react";

type StrategyJson = {
  content_pillars: { name: string; description: string; percentage_of_content: number; example_topics: string[] }[];
  weekly_schedule: { day: string; posts_count: number; content_types: string[]; best_time: string }[];
  content_ratios: { authority: number; engagement: number; storytelling: number; cta: number };
  hooks_to_use: string[];
  topics_for_this_week: string[];
  avoid: string[];
};

const PILLAR_COLORS = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "bg-rose-500/10 text-rose-600 border-rose-500/20",
];

const Strategy = () => {
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
      // Auto-trigger generation
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
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Strategy</h1>
            <p className="mt-1 text-muted-foreground">Your data-driven weekly content plan.</p>
          </div>
          <Button variant="outline" onClick={generateStrategy} disabled={generating} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Regenerate
          </Button>
        </div>

        {/* Content Pillars */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Content Pillars
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {strategy.content_pillars?.map((pillar, i) => (
              <Card key={i} className={`border ${PILLAR_COLORS[i % PILLAR_COLORS.length].split(" ").pop()}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{pillar.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {pillar.percentage_of_content}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{pillar.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pillar.example_topics?.slice(0, 3).map((topic, j) => (
                      <Badge key={j} variant="outline" className="text-xs font-normal">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Content Ratios */}
        {strategy.content_ratios && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Content Mix</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(strategy.content_ratios).map(([key, val]) => (
                <Card key={key}>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-primary">{val}%</p>
                    <p className="text-sm text-muted-foreground capitalize">{key}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Weekly Calendar */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Weekly Schedule
          </h2>
          <div className="grid gap-3 md:grid-cols-7">
            {strategy.weekly_schedule?.map((day, i) => (
              <Card key={i} className="text-center">
                <CardContent className="py-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{day.day.slice(0, 3)}</p>
                  <p className="text-2xl font-bold text-primary">{day.posts_count}</p>
                  <p className="text-xs text-muted-foreground">post{day.posts_count !== 1 ? "s" : ""}</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {day.best_time}
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {day.content_types?.map((type, j) => (
                      <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Hooks */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Hook Formulas
          </h2>
          <Card>
            <CardContent className="py-4">
              <div className="grid gap-2 md:grid-cols-2">
                {strategy.hooks_to_use?.map((hook, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground">{hook}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Topics */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Topics for This Week</h2>
          <Card>
            <CardContent className="py-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {strategy.topics_for_this_week?.map((topic, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-foreground">{topic}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Avoid */}
        {strategy.avoid?.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Things to Avoid
            </h2>
            <Card className="border-destructive/20">
              <CardContent className="py-4">
                <div className="space-y-2">
                  {strategy.avoid.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-destructive mt-0.5">✕</span>
                      <p className="text-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* CTA */}
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
