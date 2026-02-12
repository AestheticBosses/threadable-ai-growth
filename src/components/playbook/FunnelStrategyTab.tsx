import { useNavigate } from "react-router-dom";
import { useFunnelStrategy, useHasIdentity } from "@/hooks/usePlansData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, RefreshCw, ArrowRight } from "lucide-react";

const STAGE_CONFIG: Record<string, { color: string; badge: string; icon: string }> = {
  tof: { color: "border-violet-500/40", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30", icon: "🌐" },
  mof: { color: "border-blue-500/40", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: "🤝" },
  bof: { color: "border-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: "🎯" },
};

const STAGE_LABELS: Record<string, { name: string; subtitle: string }> = {
  tof: { name: "TOF · Reach", subtitle: "Attract new followers and build awareness" },
  mof: { name: "MOF · Trust", subtitle: "Build credibility and deepen connection" },
  bof: { name: "BOF · Convert", subtitle: "Drive action toward your goal" },
};

export function FunnelStrategyTab() {
  const navigate = useNavigate();
  const { query, generate } = useFunnelStrategy();
  const { data: hasIdentity } = useHasIdentity();
  const plan = query.data?.plan_data;
  const isGenerating = generate.isPending;

  if (!hasIdentity) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <Sparkles className="h-10 w-10 text-primary" />
        <p className="text-foreground font-medium">Fill out your Identity first</p>
        <p className="text-sm text-muted-foreground max-w-md">
          We need your identity data to create a personalized funnel strategy.
        </p>
        <Button onClick={() => navigate("/my-story")} className="gap-2">
          Go to Identity <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Funnel Strategy</h3>
          <p className="text-sm text-muted-foreground mt-1">
            A TOF → MOF → BOF content plan to achieve your main goal.
          </p>
        </div>
        <div className="flex gap-2">
          {plan && (
            <Button variant="outline" onClick={() => generate.mutate()} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              🔄 Regenerate
            </Button>
          )}
          {!plan && (
            <Button onClick={() => generate.mutate()} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              ✨ Generate Strategy
            </Button>
          )}
        </div>
      </div>

      {isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Generating your funnel strategy...</span>
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!isGenerating && plan && (
        <>
          {/* Goal */}
          {plan.main_goal && (
            <Card className="border-2 border-primary/30">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Your Goal</p>
                  <p className="text-sm font-semibold text-foreground">{plan.main_goal}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-story")} className="text-xs text-primary">
                  Edit
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Three columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["tof", "mof", "bof"] as const).map((stage) => {
              const data = plan[stage];
              if (!data) return null;
              const config = STAGE_CONFIG[stage];
              const labels = STAGE_LABELS[stage];
              return (
                <Card key={stage} className={`border-2 ${config.color}`}>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <Badge className={`text-xs ${config.badge}`}>{config.icon} {labels.name}</Badge>
                      <p className="text-xs text-muted-foreground mt-2">{data.purpose || labels.subtitle}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Content share</p>
                      <p className="text-lg font-bold font-mono text-foreground">~{data.content_percentage}%</p>
                    </div>
                    {data.post_ideas?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Post Ideas</p>
                        {data.post_ideas.map((idea: any, i: number) => (
                          <div key={i} className="rounded border border-border p-2 space-y-1">
                            <p className="text-xs text-foreground">{idea.idea}</p>
                            {idea.archetype && (
                              <Badge variant="outline" className="text-[9px]">{idea.archetype}</Badge>
                            )}
                            {idea.hook && (
                              <p className="text-[10px] text-foreground/60 italic">"{idea.hook}"</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {data.metrics?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Track</p>
                        <p className="text-xs text-muted-foreground">{data.metrics.join(", ")}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Conversion Path */}
          {plan.conversion_path && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Conversion Path</h4>
                <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  {["Awareness post", "Engagement post", "Story post", "Offer post", "CTA"].map((step, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      <Badge variant="outline" className="text-xs">{step}</Badge>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{plan.conversion_path}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!isGenerating && !plan && !query.isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <p className="text-foreground font-medium">No funnel strategy yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Generate a TOF/MOF/BOF strategy aligned with your main goal.
          </p>
        </div>
      )}
    </div>
  );
}
