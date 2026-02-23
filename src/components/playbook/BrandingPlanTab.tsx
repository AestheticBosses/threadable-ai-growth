import { useNavigate } from "react-router-dom";
import { useBrandingPlan, useHasIdentity } from "@/hooks/usePlansData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, RefreshCw, ArrowRight, Check, X } from "lucide-react";

const PILLAR_COLORS = [
  "border-violet-500/40",
  "border-emerald-500/40",
  "border-yellow-500/40",
  "border-blue-500/40",
  "border-rose-500/40",
];

export function BrandingPlanTab() {
  const navigate = useNavigate();
  const { query, generate } = useBrandingPlan();
  const { data: hasIdentity } = useHasIdentity();
  const plan = query.data?.plan_data;
  const isGenerating = generate.isPending;

  if (!hasIdentity) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <Sparkles className="h-10 w-10 text-primary" />
        <p className="text-foreground font-medium">Fill out your Identity first</p>
        <p className="text-sm text-muted-foreground max-w-md">
          We need your identity data to create a personalized branding plan.
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
          <h3 className="text-lg font-semibold text-foreground">Personal Branding Plan</h3>
          <p className="text-sm text-muted-foreground mt-1">
            How to position yourself as an authority based on your identity, story, and audience.
          </p>
        </div>
      </div>

      {isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Generating your branding plan...</span>
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isGenerating && plan && (
        <>
          {/* Positioning Statement */}
          <Card className="border-2 border-primary/30">
            <CardContent className="p-6">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Your Positioning</h4>
              <p className="text-lg font-semibold text-foreground leading-relaxed">{plan.positioning_statement}</p>
            </CardContent>
          </Card>

          {/* Brand Pillars */}
          {plan.brand_pillars?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Brand Pillars</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plan.brand_pillars.map((pillar: any, i: number) => (
                  <Card key={i} className={`border-2 ${PILLAR_COLORS[i % PILLAR_COLORS.length]}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-foreground">{pillar.name}</p>
                        {pillar.related_archetype && (
                          <Badge variant="outline" className="text-[10px]">{pillar.related_archetype}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{pillar.description}</p>
                      {pillar.post_angles?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Post Angles</p>
                          {pillar.post_angles.map((angle: string, j: number) => (
                            <p key={j} className="text-xs text-foreground/80 flex gap-2">
                              <span className="text-primary">→</span> {angle}
                            </p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Voice Summary */}
          {plan.voice_summary && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Content Voice</h4>
                {plan.voice_summary.tone_descriptors?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Tone</p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.voice_summary.tone_descriptors.map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {plan.voice_summary.do_list?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-400 mb-2">✅ Do</p>
                      <ul className="space-y-1">
                        {plan.voice_summary.do_list.map((item: string, i: number) => (
                          <li key={i} className="text-xs text-foreground/80 flex gap-2">
                            <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {plan.voice_summary.dont_list?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-destructive mb-2">❌ Don't</p>
                      <ul className="space-y-1">
                        {plan.voice_summary.dont_list.map((item: string, i: number) => (
                          <li key={i} className="text-xs text-foreground/80 flex gap-2">
                            <X className="h-3 w-3 text-destructive shrink-0 mt-0.5" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Authority Signals */}
          {plan.authority_signals?.length > 0 && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Authority Signals</h4>
                <p className="text-xs text-muted-foreground">Proof points to weave into your content regularly.</p>
                <ul className="space-y-2">
                  {plan.authority_signals.map((signal: string, i: number) => (
                    <li key={i} className="text-sm text-foreground flex gap-3">
                      <span className="text-primary font-bold shrink-0">⚡</span> {signal}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!isGenerating && !plan && !query.isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <p className="text-foreground font-medium">No branding plan yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Generate a personal branding plan to position yourself as an authority.
          </p>
        </div>
      )}
    </div>
  );
}
