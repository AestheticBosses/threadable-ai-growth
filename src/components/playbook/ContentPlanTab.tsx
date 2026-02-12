import { useNavigate } from "react-router-dom";
import { useContentPlan, useHasIdentity } from "@/hooks/usePlansData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, RefreshCw, ArrowRight } from "lucide-react";

const FUNNEL_BADGE: Record<string, string> = {
  TOF: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  MOF: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  BOF: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function ContentPlanTab() {
  const navigate = useNavigate();
  const { query, generate } = useContentPlan();
  const { data: hasIdentity } = useHasIdentity();
  const plan = query.data?.plan_data;
  const isGenerating = generate.isPending;

  if (!hasIdentity) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <Sparkles className="h-10 w-10 text-primary" />
        <p className="text-foreground font-medium">Fill out your Identity first</p>
        <p className="text-sm text-muted-foreground max-w-md">
          We need your identity data to create a personalized content plan.
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
          <h3 className="text-lg font-semibold text-foreground">Content Plan</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your data-backed content strategy based on your archetypes, identity, and audience.
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
              ✨ Generate Plan
            </Button>
          )}
        </div>
      </div>

      {isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Generating your content plan...</span>
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isGenerating && plan && (
        <>
          {/* Weekly Overview */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Weekly Overview</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Posts per day</p>
                  <p className="text-lg font-bold font-mono text-foreground">{plan.posts_per_day}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Best posting times</p>
                  <p className="text-sm text-foreground">{plan.best_times?.join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Primary archetypes</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {plan.primary_archetypes?.map((a: any) => (
                      <Badge key={a.name} variant="outline" className="text-xs">
                        {a.name} ({a.percentage}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Plan */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Daily Plan</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {plan.daily_plan?.map((day: any) => (
                <Card key={day.day}>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-bold text-foreground">{day.day}</p>
                    <div className="space-y-2">
                      {day.posts?.map((post: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">{post.archetype}</Badge>
                            <Badge className={`text-[10px] ${FUNNEL_BADGE[post.funnel_stage] || FUNNEL_BADGE.TOF}`}>
                              {post.funnel_stage}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{post.topic}</p>
                          {post.hook_idea && (
                            <p className="text-xs text-foreground/70 italic">"{post.hook_idea}"</p>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-primary p-0"
                            onClick={() =>
                              navigate(`/chat?prefill=${encodeURIComponent(`Write a ${post.archetype} post about ${post.topic} for ${post.funnel_stage}. Hook idea: ${post.hook_idea || ""}`)}`)
                            }
                          >
                            Draft this post →
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Themes */}
          {plan.weekly_themes?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-primary uppercase tracking-wider">This Week's Themes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plan.weekly_themes.map((theme: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm font-bold text-foreground">{theme.theme}</p>
                      <ul className="space-y-1">
                        {theme.angles?.map((angle: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-primary">•</span> {angle}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!isGenerating && !plan && !query.isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <p className="text-foreground font-medium">No content plan yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Generate a personalized 7-day content plan based on your identity and top posts.
          </p>
        </div>
      )}
    </div>
  );
}
