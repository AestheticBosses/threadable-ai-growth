import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, RefreshCw, Check, ArrowRight } from "lucide-react";
import { usePlaybookData, useArchetypeDiscovery } from "@/hooks/useStrategyData";
import { useQueryClient } from "@tanstack/react-query";
import { useHasIdentity } from "@/hooks/usePlansData";
import { DailyPostingPlan } from "@/components/playbook/DailyPostingPlan";
import { ContentPlanTab } from "@/components/playbook/ContentPlanTab";
import { BrandingPlanTab } from "@/components/playbook/BrandingPlanTab";
import { FunnelStrategyTab } from "@/components/playbook/FunnelStrategyTab";

const ARCHETYPE_BORDER_COLORS = [
  "border-violet-500/40",
  "border-emerald-500/40",
  "border-yellow-500/40",
  "border-blue-500/40",
  "border-rose-500/40",
];
const ARCHETYPE_BADGE_COLORS = [
  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "bg-rose-500/15 text-rose-400 border-rose-500/30",
];

const FUNNEL_GOALS: Record<string, { label: string; tof: number; mof: number; bof: number }> = {
  grow: { label: "Grow followers fast", tof: 70, mof: 20, bof: 10 },
  authority: { label: "Build authority & trust", tof: 40, mof: 40, bof: 20 },
  sales: { label: "Drive sales & leads", tof: 30, mof: 30, bof: 40 },
  custom: { label: "Custom", tof: 50, mof: 30, bof: 20 },
};

const Playbook = () => {
  usePageTitle("Playbook", "Your validated content strategy playbook");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(5);
  const { data: playbook, isLoading } = usePlaybookData();
  const { data: discoveredArchetypes } = useArchetypeDiscovery();
  const { data: hasIdentity } = useHasIdentity();

  // Generate All Plans state
  const [activeTab, setActiveTab] = useState("archetypes");
  const [showGenerateAllConfirm, setShowGenerateAllConfirm] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [allPlansProgress, setAllPlansProgress] = useState<Record<string, "pending" | "generating" | "done" | "error">>({});

  // Check if plans already exist
  const [existingPlans, setExistingPlans] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("user_plans")
      .select("plan_type")
      .eq("user_id", user.id)
      .then(({ data }: any) => {
        if (data) setExistingPlans(new Set(data.map((d: any) => d.plan_type)));
      });
  }, [user]);
  const [funnelGoal, setFunnelGoal] = useState("grow");
  const [tofPct, setTofPct] = useState(70);
  const [mofPct, setMofPct] = useState(20);
  const [bofPct, setBofPct] = useState(10);
  const [savingFunnel, setSavingFunnel] = useState(false);

  // Load profile funnel settings
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("funnel_goal, funnel_tof_pct, funnel_mof_pct, funnel_bof_pct")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFunnelGoal((data as any).funnel_goal || "grow");
          setTofPct((data as any).funnel_tof_pct ?? 70);
          setMofPct((data as any).funnel_mof_pct ?? 20);
          setBofPct((data as any).funnel_bof_pct ?? 10);
        }
      });
  }, [user]);

  const handleGoalChange = (goal: string) => {
    setFunnelGoal(goal);
    if (goal !== "custom") {
      const preset = FUNNEL_GOALS[goal];
      setTofPct(preset.tof);
      setMofPct(preset.mof);
      setBofPct(preset.bof);
    }
  };

  const handleCustomSlider = (stage: "tof" | "mof" | "bof", value: number) => {
    if (stage === "tof") {
      const remaining = 100 - value;
      const mofRatio = mofPct / (mofPct + bofPct || 1);
      setTofPct(value);
      setMofPct(Math.round(remaining * mofRatio));
      setBofPct(remaining - Math.round(remaining * mofRatio));
    } else if (stage === "mof") {
      const remaining = 100 - value;
      const tofRatio = tofPct / (tofPct + bofPct || 1);
      setMofPct(value);
      setTofPct(Math.round(remaining * tofRatio));
      setBofPct(remaining - Math.round(remaining * tofRatio));
    } else {
      const remaining = 100 - value;
      const tofRatio = tofPct / (tofPct + mofPct || 1);
      setBofPct(value);
      setTofPct(Math.round(remaining * tofRatio));
      setMofPct(remaining - Math.round(remaining * tofRatio));
    }
  };

  const saveFunnel = async () => {
    if (!user) return;
    setSavingFunnel(true);
    await supabase
      .from("profiles")
      .update({
        funnel_goal: funnelGoal,
        funnel_tof_pct: tofPct,
        funnel_mof_pct: mofPct,
        funnel_bof_pct: bofPct,
      } as any)
      .eq("id", user.id);
    setSavingFunnel(false);
    toast({ title: "Funnel mix saved ✅" });
  };

  const handleGenerateAllPlans = async () => {
    setShowGenerateAllConfirm(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Not logged in", variant: "destructive" }); return; }

    setGeneratingAll(true);
    const planTypes = ["content_plan", "branding_plan", "funnel_strategy"] as const;
    const labels: Record<string, string> = {
      content_plan: "Content Plan",
      branding_plan: "Branding Plan",
      funnel_strategy: "Funnel Strategy",
    };

    setAllPlansProgress({
      content_plan: "pending",
      branding_plan: "pending",
      funnel_strategy: "pending",
    });

    const results: Record<string, boolean> = {};

    for (const planType of planTypes) {
      setAllPlansProgress((prev) => ({ ...prev, [planType]: "generating" }));
      try {
        const res = await supabase.functions.invoke("generate-plans", {
          body: { plan_type: planType },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.error) throw new Error(res.error.message);
        setAllPlansProgress((prev) => ({ ...prev, [planType]: "done" }));
        queryClient.invalidateQueries({ queryKey: ["user-plan", user?.id, planType] });
        results[planType] = true;
      } catch (e: any) {
        setAllPlansProgress((prev) => ({ ...prev, [planType]: "error" }));
        results[planType] = false;
      }
    }

    setGeneratingAll(false);
    setExistingPlans(new Set(Object.keys(results).filter((k) => results[k])));

    const succeeded = Object.values(results).filter(Boolean).length;
    const failed = Object.values(results).filter((v) => !v).length;

    if (failed === 0) {
      toast({ title: "All plans generated! 🎉" });
      setActiveTab("content_plan");
    } else {
      const failedNames = Object.entries(results)
        .filter(([, v]) => !v)
        .map(([k]) => labels[k])
        .join(", ");
      toast({
        title: `${succeeded} of 3 plans generated`,
        description: `Failed: ${failedNames}. You can retry individually.`,
        variant: "destructive",
      });
    }
  };

  const handleGeneratePlaybook = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Not logged in", variant: "destructive" }); return; }
      const { error } = await supabase.functions.invoke("run-analysis", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw new Error(error.message || "Failed to run analysis");
      toast({ title: "Analysis complete!", description: "Your playbook, archetypes, and insights are ready." });
      queryClient.invalidateQueries({ queryKey: ["playbook-data"] });
      queryClient.invalidateQueries({ queryKey: ["discovered-archetypes"] });
      queryClient.invalidateQueries({ queryKey: ["regression-insights"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!user) return;
    setGeneratingContent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ posts_count: postsPerDay * 7 }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      const data = await res.json();
      toast({ title: `${data.total} posts generated!`, description: "Head to Content Queue to review." });
      navigate("/queue");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingContent(false);
    }
  };

  const allPlansExist = existingPlans.has("content_plan") && existingPlans.has("branding_plan") && existingPlans.has("funnel_strategy");

  const planLabels: Record<string, string> = {
    content_plan: "Content Plan",
    branding_plan: "Branding Plan",
    funnel_strategy: "Funnel Strategy",
  };

  const renderGenerateAllButton = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {hasIdentity === false ? (
          <Button variant="outline" onClick={() => navigate("/my-story")} className="gap-2">
            Fill out your Identity first <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setShowGenerateAllConfirm(true)}
            disabled={generatingAll}
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {allPlansExist ? "🔄 Regenerate All Plans" : "✨ Generate All Plans"}
          </Button>
        )}
      </div>

      {/* Progress UI */}
      {generatingAll && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {(["content_plan", "branding_plan", "funnel_strategy"] as const).map((planType) => {
              const status = allPlansProgress[planType];
              return (
                <div key={planType} className="flex items-center gap-3 text-sm">
                  {status === "generating" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                  {status === "done" && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                  {status === "error" && <span className="h-4 w-4 text-destructive shrink-0">✗</span>}
                  {status === "pending" && <span className="h-4 w-4 rounded-full border border-border shrink-0" />}
                  <span className={status === "done" ? "text-foreground" : status === "error" ? "text-destructive" : "text-muted-foreground"}>
                    {status === "generating" ? `Generating ${planLabels[planType]}...` : planLabels[planType]}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!playbook) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <Sparkles className="h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Your Personalized Playbook</h1>
            <p className="text-muted-foreground max-w-md">
              Generate a data-driven content playbook based on your discovered archetypes and performance data.
            </p>
            <Button size="lg" onClick={handleGeneratePlaybook} disabled={generating} className="gap-2 px-8">
              {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {generating ? "Claude is running full analysis…" : "🧠 Run Full Analysis"}
            </Button>
          </div>

          {/* Generate All Plans button + progress */}
          {renderGenerateAllButton()}

          {/* Still show plan tabs even without playbook data */}
          <div className="mt-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="content_plan">Content Plan</TabsTrigger>
                <TabsTrigger value="branding_plan">Branding Plan</TabsTrigger>
                <TabsTrigger value="funnel_strategy">Funnel Strategy</TabsTrigger>
              </TabsList>
              <TabsContent value="content_plan"><ContentPlanTab /></TabsContent>
              <TabsContent value="branding_plan"><BrandingPlanTab /></TabsContent>
              <TabsContent value="funnel_strategy"><FunnelStrategyTab /></TabsContent>
            </Tabs>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Your Content Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">Personalized strategy built from your data.</p>
          </div>
          {renderGenerateAllButton()}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start flex-wrap gap-1">
            <TabsTrigger value="archetypes">Archetypes & Rules</TabsTrigger>
            <TabsTrigger value="content_plan">Content Plan</TabsTrigger>
            <TabsTrigger value="branding_plan">Branding Plan</TabsTrigger>
            <TabsTrigger value="funnel_strategy">Funnel Strategy</TabsTrigger>
          </TabsList>

          {/* Tab 1: Archetypes & Rules (existing content) */}
          <TabsContent value="archetypes">
            <div className="space-y-10 mt-4">
              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleGeneratePlaybook} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {generating ? "Regenerating…" : "🔄 Regenerate"}
                </Button>
                <Button onClick={handleGenerateContent} disabled={generatingContent} className="gap-2">
                  {generatingContent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generatingContent ? "Generating…" : `✨ Generate ${postsPerDay * 7} Posts`}
                </Button>
              </div>

              {/* SECTION: Funnel Goal */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Funnel Strategy</h2>
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Goal:</span>
                        <Select value={funnelGoal} onValueChange={handleGoalChange}>
                          <SelectTrigger className="w-52 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(FUNNEL_GOALS).map(([key, { label }]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" onClick={saveFunnel} disabled={savingFunnel} className="gap-1">
                        {savingFunnel ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Save Mix
                      </Button>
                    </div>

                    {funnelGoal === "custom" && (
                      <div className="space-y-3">
                        {(["tof", "mof", "bof"] as const).map((stage) => {
                          const val = stage === "tof" ? tofPct : stage === "mof" ? mofPct : bofPct;
                          const label = stage === "tof" ? "TOF (Reach)" : stage === "mof" ? "MOF (Trust)" : "BOF (Convert)";
                          const color = stage === "tof" ? "text-violet-400" : stage === "mof" ? "text-blue-400" : "text-emerald-400";
                          return (
                            <div key={stage} className="flex items-center gap-3">
                              <span className={`text-sm font-medium w-28 ${color}`}>{label}</span>
                              <Slider
                                value={[val]}
                                min={0}
                                max={100}
                                step={5}
                                onValueChange={([v]) => handleCustomSlider(stage, v)}
                                className="flex-1"
                              />
                              <span className="text-sm font-mono w-10 text-right">{val}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><span className="text-violet-400 font-medium">TOF</span> — Go viral, get new eyeballs, grow followers. No CTA.</p>
                      <p><span className="text-blue-400 font-medium">MOF</span> — Build credibility, show expertise. Soft CTA.</p>
                      <p><span className="text-emerald-400 font-medium">BOF</span> — Drive DMs, applications, sales. Direct CTA.</p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* SECTION: Daily Posting Plan */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Daily Posting Plan</h2>
                <DailyPostingPlan
                  playbook={playbook}
                  archetypes={discoveredArchetypes?.archetypes}
                  postsPerDay={postsPerDay}
                  onPostsPerDayChange={setPostsPerDay}
                  tofPct={tofPct}
                  mofPct={mofPct}
                  bofPct={bofPct}
                />
              </section>

              {/* SECTION: Pre-Post Checklist */}
              {playbook.checklist && (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Pre-Post Checklist (Score 4+ Before Posting)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {playbook.checklist.map((c, i) => (
                      <Card key={i}>
                        <CardContent className="p-4 flex gap-4 items-start">
                          <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/10">
                            <span className="text-sm font-bold font-mono text-emerald-400">+{c.points}</span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{c.question}</p>
                            <p className="text-xs text-muted-foreground">{c.data_backing}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm text-foreground font-medium text-center">
                      <span className="text-destructive font-bold">Score 0-2 = Don't post.</span>{" "}
                      <span className="text-yellow-400 font-bold">Score 3 = Rework it.</span>{" "}
                      <span className="text-emerald-400 font-bold">Score 4+ = Ship it.</span>
                    </p>
                  </div>
                </section>
              )}

              {/* SECTION: Templates */}
              {playbook.templates && (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Templates by Archetype</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playbook.templates.map((t, i) => (
                      <Card key={t.archetype} className={`border-2 ${ARCHETYPE_BORDER_COLORS[i % ARCHETYPE_BORDER_COLORS.length]}`}>
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{t.emoji}</span>
                            <Badge className={`text-xs ${ARCHETYPE_BADGE_COLORS[i % ARCHETYPE_BADGE_COLORS.length]}`}>{t.archetype}</Badge>
                          </div>
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed rounded-lg p-4 border border-border" style={{ background: "rgba(0,0,0,0.3)" }}>
                            {t.template}
                          </pre>
                          {t.example && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-bold text-emerald-400">Example: </span>
                              <span className="text-foreground/70">{t.example}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION: Rules */}
              {playbook.rules && (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Rules — Validated by Your Data</h2>
                  <div className="rounded-lg border-2 border-destructive/40 p-5 space-y-3" style={{ background: "rgba(239,68,68,0.06)" }}>
                    <ol className="space-y-3">
                      {playbook.rules.map((r, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="shrink-0 font-mono font-bold text-destructive">{i + 1}.</span>
                          <div>
                            <span className="text-foreground">{r.rule}</span>
                            <p className="text-xs text-muted-foreground mt-0.5 italic">{r.evidence}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              )}

              {/* SECTION: Generation Guidelines */}
              {playbook.generation_guidelines && (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Content Generation Guidelines</h2>
                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tone</p>
                          <p className="text-sm text-foreground">{playbook.generation_guidelines.tone || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Avg Length</p>
                          <p className="text-sm text-foreground">{playbook.generation_guidelines.avg_length || "—"}</p>
                        </div>
                      </div>
                      {playbook.generation_guidelines.vocabulary?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vocabulary</p>
                          <div className="flex flex-wrap gap-1.5">
                            {playbook.generation_guidelines.vocabulary.map((v) => (
                              <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {playbook.generation_guidelines.hooks_that_work && playbook.generation_guidelines.hooks_that_work.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Hooks That Work</p>
                          <div className="flex flex-wrap gap-1.5">
                            {playbook.generation_guidelines.hooks_that_work.map((h) => (
                              <Badge key={h} variant="outline" className="text-xs text-primary border-primary/30">{h}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {playbook.generation_guidelines.avoid?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Avoid</p>
                          <div className="flex flex-wrap gap-1.5">
                            {playbook.generation_guidelines.avoid.map((a) => (
                              <Badge key={a} variant="outline" className="text-xs text-destructive border-destructive/30">{a}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Content Plan */}
          <TabsContent value="content_plan">
            <div className="mt-4">
              <ContentPlanTab />
            </div>
          </TabsContent>

          {/* Tab 3: Branding Plan */}
          <TabsContent value="branding_plan">
            <div className="mt-4">
              <BrandingPlanTab />
            </div>
          </TabsContent>

          {/* Tab 4: Funnel Strategy */}
          <TabsContent value="funnel_strategy">
            <div className="mt-4">
              <FunnelStrategyTab />
            </div>
          </TabsContent>
        </Tabs>

        {/* Confirm Generate All Dialog */}
        <AlertDialog open={showGenerateAllConfirm} onOpenChange={setShowGenerateAllConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{allPlansExist ? "Regenerate All Plans?" : "Generate All Plans?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {allPlansExist
                  ? "This will regenerate your Content Plan, Branding Plan, and Funnel Strategy. Existing plans will be replaced."
                  : "Generate all three plans (Content Plan, Branding Plan, and Funnel Strategy) using your Identity, Voice, and Archetypes data."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleGenerateAllPlans}>
                {allPlansExist ? "Regenerate All" : "Generate All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Playbook;
