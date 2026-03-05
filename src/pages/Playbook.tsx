import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, RefreshCw, Check, ArrowRight, Target, Layers, Calendar, Brain, Users, Lightbulb, FileText, Palette, GitBranch, Shield, Info, Lock } from "lucide-react";
import {
  usePlaybookData, useArchetypeDiscovery,
  useProfileStrategy, useContentBuckets, useContentPillars,
  useConnectedTopics, useJourneyStage,
} from "@/hooks/useStrategyData";
import { useQueryClient } from "@tanstack/react-query";
import { useHasIdentity, useStrategyStale } from "@/hooks/usePlansData";
import { AlertTriangle } from "lucide-react";

import { ContentPlanTab } from "@/components/playbook/ContentPlanTab";
import { BrandingPlanTab } from "@/components/playbook/BrandingPlanTab";
import { FunnelStrategyTab } from "@/components/playbook/FunnelStrategyTab";
import { GuardrailsTab } from "@/components/playbook/GuardrailsTab";

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

const PILLAR_COLORS = [
  { border: "border-violet-500/40", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30", bg: "bg-violet-500/5" },
  { border: "border-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bg: "bg-emerald-500/5" },
  { border: "border-yellow-500/40", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", bg: "bg-yellow-500/5" },
  { border: "border-blue-500/40", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30", bg: "bg-blue-500/5" },
  { border: "border-rose-500/40", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30", bg: "bg-rose-500/5" },
];

const PURPOSE_ICONS: Record<string, string> = {
  inspire: "✨",
  educate: "📚",
  motivate: "🔥",
  entertain: "😄",
};

const CADENCE_LABELS: Record<string, string> = {
  "7x_week": "7 days/week",
  "5x_week": "5 days/week",
  "3x_week": "3 days/week",
  "2x_week": "2 days/week",
};

const Playbook = () => {
  usePageTitle("Playbook", "Your validated content strategy playbook");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Existing playbook/archetype data
  const { data: playbook, isLoading: playbookLoading } = usePlaybookData();
  const { data: archetypeDiscovery } = useArchetypeDiscovery();
  const { data: hasIdentity } = useHasIdentity();
  const { isStale: isStrategyStale } = useStrategyStale();

  // V2 strategy data
  const { data: profileStrategy, isLoading: profileLoading } = useProfileStrategy();
  const { data: buckets, isLoading: bucketsLoading } = useContentBuckets();
  const { data: pillars, isLoading: pillarsLoading } = useContentPillars();
  const { data: topics } = useConnectedTopics();
  const { data: journeyStage } = useJourneyStage();

  // State
  const [activeTab, setActiveTab] = useState("strategy");
  const [generating, setGenerating] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [strategyProgress, setStrategyProgress] = useState<Record<string, "pending" | "generating" | "done" | "error">>({});
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [analyzingOptimizing, setAnalyzingOptimizing] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<"success" | "timeout" | null>(null);
  const pipelineStartedAt = useRef<number | null>(null);
  const pipelineTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPipelineTimers = useCallback(() => {
    pipelineTimers.current.forEach(clearTimeout);
    pipelineTimers.current = [];
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  useEffect(() => () => clearPipelineTimers(), [clearPipelineTimers]);

  const isLoading = playbookLoading || profileLoading || bucketsLoading || pillarsLoading;
  const hasV2Strategy = (buckets && buckets.length > 0) || (pillars && pillars.length > 0);

  // Group topics by pillar
  const topicsByPillar: Record<string, typeof topics> = {};
  if (topics) {
    for (const t of topics) {
      (topicsByPillar[t.pillar_id] = topicsByPillar[t.pillar_id] || []).push(t);
    }
  }

  // ── Generate Strategy (buckets → pillars → AI plans) ──
  const handleGenerateStrategy = async () => {
    console.log("[Playbook] handleGenerateStrategy called");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { console.log("[Playbook] no session, aborting"); toast({ title: "Not logged in", variant: "destructive" }); return; }
    console.log("[Playbook] session OK, starting pipeline");

    setGeneratingStrategy(true);
    setStrategyProgress({ archetypes: "pending", buckets: "pending", pillars: "pending", branding: "pending", funnel: "pending", contentPlan: "pending" });

    try {
      // Step 1: Archetypes
      console.log("[Playbook] step: archetypes");
      setStrategyProgress(p => ({ ...p, archetypes: "generating" }));
      const archetypesRes = await supabase.functions.invoke("discover-archetypes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log("[Playbook] archetypes result:", { data: archetypesRes.data, error: archetypesRes.error });
      if (archetypesRes.error) throw new Error("Archetypes: " + archetypesRes.error.message);
      setStrategyProgress(p => ({ ...p, archetypes: "done" }));
      queryClient.invalidateQueries({ queryKey: ["archetype-discovery"] });

      // Step 2: Buckets
      console.log("[Playbook] step: buckets");
      setStrategyProgress(p => ({ ...p, buckets: "generating" }));
      const bucketsRes = await supabase.functions.invoke("generate-content-buckets", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log("[Playbook] buckets result:", { data: bucketsRes.data, error: bucketsRes.error });
      if (bucketsRes.error) throw new Error("Buckets: " + bucketsRes.error.message);
      setStrategyProgress(p => ({ ...p, buckets: "done" }));
      queryClient.invalidateQueries({ queryKey: ["content-buckets"] });

      // Step 3: Pillars
      console.log("[Playbook] step: pillars");
      setStrategyProgress(p => ({ ...p, pillars: "generating" }));
      const pillarsRes = await supabase.functions.invoke("generate-content-pillars", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log("[Playbook] pillars result:", { data: pillarsRes.data, error: pillarsRes.error });
      if (pillarsRes.error) throw new Error("Pillars: " + pillarsRes.error.message);
      setStrategyProgress(p => ({ ...p, pillars: "done" }));
      queryClient.invalidateQueries({ queryKey: ["content-pillars"] });
      queryClient.invalidateQueries({ queryKey: ["connected-topics"] });

      // Build timezone-aware plan body
      const now = new Date();
      const planBodyBase = {
        client_now_minutes: now.getHours() * 60 + now.getMinutes(),
        client_day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()],
        client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      // Step 4: Branding Plan
      console.log("[Playbook] step: branding_plan");
      setStrategyProgress(p => ({ ...p, branding: "generating" }));
      const brandingPlanRes = await supabase.functions.invoke("generate-plans", {
        body: { ...planBodyBase, plan_type: "branding_plan" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log("[Playbook] branding_plan result:", { data: brandingPlanRes.data, error: brandingPlanRes.error });
      if (brandingPlanRes.error) throw new Error("Branding Plan: " + brandingPlanRes.error.message);
      setStrategyProgress(p => ({ ...p, branding: "done" }));

      // Step 5: Funnel Strategy
      console.log("[Playbook] step: funnel_strategy");
      setStrategyProgress(p => ({ ...p, funnel: "generating" }));
      const funnelRes = await supabase.functions.invoke("generate-plans", {
        body: { ...planBodyBase, plan_type: "funnel_strategy" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log("[Playbook] funnel_strategy result:", { data: funnelRes.data, error: funnelRes.error });
      if (funnelRes.error) throw new Error("Funnel Strategy: " + funnelRes.error.message);
      setStrategyProgress(p => ({ ...p, funnel: "done" }));

      // Step 6: Content Plan (uses branding + funnel as input)
      console.log("[Playbook] step: content_plan (with branding + funnel context)");
      setStrategyProgress(p => ({ ...p, contentPlan: "generating" }));
      const contentPlanRes = await supabase.functions.invoke("generate-plans", {
        body: { ...planBodyBase, plan_type: "content_plan", include_plans: ["branding_plan", "funnel_strategy"] },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log("[Playbook] content_plan result:", { data: contentPlanRes.data, error: contentPlanRes.error });
      if (contentPlanRes.error) throw new Error("Content Plan: " + contentPlanRes.error.message);
      setStrategyProgress(p => ({ ...p, contentPlan: "done" }));
      queryClient.invalidateQueries({ queryKey: ["user-plan"] });

      console.log("[Playbook] pipeline complete, all steps done");
      toast({ title: "Content strategy generated!" });
    } catch (e: any) {
      console.error("[Playbook] pipeline error at step:", e.message, e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setStrategyProgress(p => {
        const updated = { ...p };
        for (const k of Object.keys(updated)) {
          if (updated[k] === "generating" || updated[k] === "pending") updated[k] = "error";
        }
        return updated;
      });
    } finally {
      setGeneratingStrategy(false);
    }
  };

  // ── Generate Playbook (existing run-analysis) ──
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

  // ── Analyze & Optimize (CMO loop + summary) ──
  const PIPELINE_STAGES = [
    { delay: 0, label: "Analyzing your post performance..." },
    { delay: 15_000, label: "Running statistical regression..." },
    { delay: 30_000, label: "Discovering content archetypes..." },
    { delay: 45_000, label: "Optimizing brand strategy..." },
    { delay: 60_000, label: "Building content plan..." },
    { delay: 75_000, label: "Generating CMO summary..." },
    { delay: 90_000, label: "Finalizing your updated strategy..." },
  ];

  const handleAnalyzeOptimize = async () => {
    if (!user) return;
    setAnalyzingOptimizing(true);
    setPipelineResult(null);
    clearPipelineTimers();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Not logged in", variant: "destructive" }); return; }

      // Fire the pipeline — returns immediately, runs in background via waitUntil
      const { error } = await supabase.functions.invoke("run-weekly-cmo-loop", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw new Error(error.message || "Failed to trigger analysis");

      const startedAt = Date.now();
      pipelineStartedAt.current = startedAt;

      // Cycle through stage messages
      for (const stage of PIPELINE_STAGES) {
        pipelineTimers.current.push(
          setTimeout(() => setPipelineStage(stage.label), stage.delay)
        );
      }

      // Poll for completion every 15s
      pollTimer.current = setInterval(async () => {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("weekly_refresh_summary, last_weekly_refresh_at")
            .eq("id", user.id)
            .maybeSingle();
          if (data?.weekly_refresh_summary && data?.last_weekly_refresh_at) {
            const refreshTime = new Date(data.last_weekly_refresh_at).getTime();
            if (refreshTime >= startedAt - 5000) {
              clearPipelineTimers();
              setPipelineStage(null);
              setPipelineResult("success");
              setAnalyzingOptimizing(false);
              queryClient.invalidateQueries();
            }
          }
        } catch { /* ignore poll errors */ }
      }, 15_000);

      // Timeout fallback at 5 minutes
      pipelineTimers.current.push(
        setTimeout(() => {
          clearPipelineTimers();
          setPipelineStage(null);
          setPipelineResult("timeout");
          setAnalyzingOptimizing(false);
          queryClient.invalidateQueries();
        }, 300_000)
      );
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setAnalyzingOptimizing(false);
      setPipelineStage(null);
      clearPipelineTimers();
    }
  };

  // ── Generate Content ──
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
          body: JSON.stringify({ posts_count: 35 }),
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

  // ── Loading ──
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // ── Strategy generation progress ──
  const renderStrategyProgress = () => {
    if (!generatingStrategy) return null;
    const steps = [
      { key: "archetypes", label: "Archetypes" },
      { key: "buckets", label: "Audience Segments" },
      { key: "pillars", label: "Content Pillars" },
      { key: "branding", label: "Branding Plan" },
      { key: "funnel", label: "Funnel Strategy" },
      { key: "contentPlan", label: "Content Plan" },
    ];
    return (
      <Card className="mt-4">
        <CardContent className="p-4 space-y-2">
          {steps.map(({ key, label }) => {
            const status = strategyProgress[key];
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                {status === "generating" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                {status === "done" && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                {status === "error" && <span className="h-4 w-4 text-destructive shrink-0">✗</span>}
                {status === "pending" && <span className="h-4 w-4 rounded-full border border-border shrink-0" />}
                <span className={status === "done" ? "text-foreground" : status === "error" ? "text-destructive" : "text-muted-foreground"}>
                  {status === "generating" ? `Generating ${label}...` : label}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  // ── Empty state (no V2 strategy and no playbook) ──
  if (!hasV2Strategy && !playbook) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <Target className="h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Your Content Strategy</h1>
            <p className="text-muted-foreground max-w-md">
              Generate a personalized content strategy with audience segments, content pillars, and posting plans.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {hasIdentity === false ? (
                <Button variant="outline" onClick={() => navigate("/my-story")} className="gap-2">
                  Fill out your Identity first <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={handleGenerateStrategy}
                    disabled={generatingStrategy}
                    className="gap-2 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  >
                    {generatingStrategy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    Generate Content Strategy
                  </Button>
                  <Button size="lg" variant="outline" onClick={handleGeneratePlaybook} disabled={generating} className="gap-2">
                    {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Brain className="h-5 w-5" />}
                    Run Data Analysis
                  </Button>
                </>
              )}
            </div>
            {renderStrategyProgress()}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ── Journey Stage Banner ── */}
        {journeyStage && (() => {
          const stageMap = {
            getting_started: {
              emoji: "🌱",
              label: "Building Your Audience",
              desc: "Plan optimized for reach (70% TOF, 20% MOF, 10% BOF)",
            },
            growing: {
              emoji: "📈",
              label: "Growing & Engaging",
              desc: "Plan optimized for engagement (30% TOF, 50% MOF, 20% BOF)",
            },
            monetizing: {
              emoji: "🚀",
              label: "Ready to Monetize",
              desc: "Plan optimized for conversions (20% TOF, 30% MOF, 50% BOF)",
            },
          };
          const s = stageMap[journeyStage];
          return (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 flex items-center gap-3">
              <span className="text-xl">{s.emoji}</span>
              <div>
                <span className="text-sm font-semibold text-foreground">Stage: {s.label}</span>
                <span className="text-xs text-muted-foreground ml-2">— {s.desc}</span>
              </div>
              <button
                onClick={() => navigate("/onboarding")}
                className="ml-auto text-xs text-primary hover:underline shrink-0"
              >
                Change stage
              </button>
            </div>
          );
        })()}

        {/* ── Stale Strategy Banner ── */}
        {isStrategyStale && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Your profile settings have changed.</p>
              <p className="text-xs text-muted-foreground">Regenerate your strategy to reflect your current goal.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowRegenConfirm(true)}
              disabled={generatingStrategy}
              className="shrink-0 gap-1.5"
            >
              {generatingStrategy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate Now
            </Button>
          </div>
        )}

        {/* ── Mission Banner ── */}
        {profileStrategy?.mission && (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Your Mission</p>
                <p className="text-sm text-foreground leading-relaxed">{profileStrategy.mission}</p>
                {(profileStrategy.posting_cadence || profileStrategy.max_posts_per_day) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {profileStrategy.max_posts_per_day && profileStrategy.max_posts_per_day > 1
                      ? `${profileStrategy.max_posts_per_day} posts/day`
                      : profileStrategy.max_posts_per_day === 1 ? "1 post/day" : ""}
                    {profileStrategy.posting_cadence && profileStrategy.max_posts_per_day ? " · " : ""}
                    {profileStrategy.posting_cadence ? (CADENCE_LABELS[profileStrategy.posting_cadence] || profileStrategy.posting_cadence) : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Strategy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your personalized content engine.</p>
          </div>
        </div>

        {renderStrategyProgress()}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start flex-wrap gap-1">
            <TabsTrigger value="strategy" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Strategy
            </TabsTrigger>
            <TabsTrigger value="archetypes" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Archetypes
            </TabsTrigger>
            <TabsTrigger value="branding_plan" className="gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Branding Plan
            </TabsTrigger>
            <TabsTrigger value="funnel_strategy" className="gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Funnel Strategy
            </TabsTrigger>
            <TabsTrigger value="content_plan" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Content Plan
            </TabsTrigger>
            <TabsTrigger value="guardrails" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Brand Guardrails
            </TabsTrigger>
          </TabsList>

          {/* ═══ Tab: Strategy ═══ */}
          <TabsContent value="strategy">
            <div className="space-y-10 mt-4">
              {/* ── Audience Segments (Buckets) ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Audience Segments</h2>
                </div>
                <p className="text-sm text-muted-foreground">The distinct groups of people your content speaks to.</p>

                {buckets && buckets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {buckets.map((bucket, i) => (
                      <Card key={bucket.id} className={`border-2 ${PILLAR_COLORS[i % PILLAR_COLORS.length].border}`}>
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground">{bucket.name}</h3>
                            {bucket.priority && (
                              <Badge variant="outline" className="text-[10px]">Priority {bucket.priority}</Badge>
                            )}
                          </div>
                          {bucket.description && (
                            <p className="text-xs text-foreground/80">{bucket.description}</p>
                          )}
                          {bucket.audience_persona && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Who they are</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{bucket.audience_persona}</p>
                            </div>
                          )}
                          {bucket.business_connection && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Business connection</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{bucket.business_connection}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No audience segments yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenConfirm(true)}
                        disabled={generatingStrategy}
                      >
                        Generate Strategy
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* ── Content Pillars ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Content Pillars</h2>
                </div>
                <p className="text-sm text-muted-foreground">The repeatable themes you post about, with specific topic angles.</p>

                {pillars && pillars.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pillars.map((pillar, i) => {
                      const color = PILLAR_COLORS[i % PILLAR_COLORS.length];
                      const pillarTopics = topicsByPillar[pillar.id] || [];
                      return (
                        <Card key={pillar.id} className={`border-2 ${color.border}`}>
                          <CardContent className="p-5 space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                {pillar.purpose && <span className="text-lg">{PURPOSE_ICONS[pillar.purpose] || "📝"}</span>}
                                <h3 className="text-sm font-bold text-foreground">{pillar.name}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${color.badge}`}>
                                  {pillar.percentage}%
                                </Badge>
                                {pillar.purpose && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {pillar.purpose}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Description */}
                            {pillar.description && (
                              <p className="text-xs text-foreground/80 leading-relaxed">{pillar.description}</p>
                            )}

                            {/* Topic chips */}
                            {pillarTopics.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                  Topic Angles ({pillarTopics.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {pillarTopics.map((topic) => (
                                    <span
                                      key={topic.id}
                                      className={`text-[10px] px-2 py-1 rounded-full border ${color.badge} cursor-default`}
                                      title={topic.hook_angle || undefined}
                                    >
                                      {topic.name.length > 50 ? topic.name.slice(0, 50) + "…" : topic.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                      <Layers className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No content pillars yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenConfirm(true)}
                        disabled={generatingStrategy}
                      >
                        Generate Strategy
                      </Button>
                    </CardContent>
                  </Card>
               )}
              </section>

              {/* ── Action buttons ── */}
              <div className="pt-4 border-t border-border flex flex-wrap items-start gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      onClick={handleAnalyzeOptimize}
                      disabled={analyzingOptimizing}
                      className="gap-2"
                    >
                      {analyzingOptimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {analyzingOptimizing ? "Analyzing…" : "Analyze & Optimize"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center max-w-[220px]">Updates your strategy based on what's actually performing</p>
                  </div>

                  {/* Pipeline progress indicator */}
                  {analyzingOptimizing && pipelineStage && (
                    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-3 space-y-1.5 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
                        </span>
                        <p className="text-sm font-medium text-foreground">{pipelineStage}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-5">This takes about 2-3 minutes. You can leave this page — it runs in the background.</p>
                    </div>
                  )}

                  {/* Success message */}
                  {pipelineResult === "success" && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-2.5 animate-in fade-in duration-300">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <p className="text-sm text-foreground">Strategy updated! Check your Command Center for the full summary.</p>
                    </div>
                  )}

                  {/* Timeout message */}
                  {pipelineResult === "timeout" && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-center gap-2.5 animate-in fade-in duration-300">
                      <Loader2 className="h-4 w-4 text-yellow-400 shrink-0" />
                      <p className="text-sm text-foreground">Taking longer than expected. Check your Command Center in a few minutes.</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="outline"
                    onClick={() => setShowRegenConfirm(true)}
                    disabled={generatingStrategy}
                    className="gap-2"
                  >
                    {generatingStrategy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {generatingStrategy ? "Regenerating…" : "Regenerate Strategy"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center max-w-[220px]">Rebuilds your entire strategy from scratch</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══ Tab: Archetypes ═══ */}
          <TabsContent value="archetypes">
            <div className="space-y-10 mt-4">
              {/* Archetype Cards */}
              {archetypeDiscovery?.archetypes && archetypeDiscovery.archetypes.length > 0 ? (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Your Content Archetypes</h2>
                  <p className="text-sm text-muted-foreground">Each archetype is a proven content pattern discovered from your top-performing posts.</p>
                  <div className="grid grid-cols-1 gap-4">
                    {archetypeDiscovery.archetypes.map((a, i) => {
                      const scheduleDays = archetypeDiscovery.weekly_schedule
                        ?.filter((s) => s.archetype === a.name)
                        .map((s) => s.day) || [];
                      return (
                        <Card key={a.name} className={`border-2 ${ARCHETYPE_BORDER_COLORS[i % ARCHETYPE_BORDER_COLORS.length]}`}>
                          <CardContent className="p-5 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{a.emoji}</span>
                                <h3 className="text-base font-bold text-foreground">{a.name}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${ARCHETYPE_BADGE_COLORS[i % ARCHETYPE_BADGE_COLORS.length]}`}>
                                  {a.recommended_percentage}% of content
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Drives {a.drives}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-foreground/80">{a.description}</p>
                            {a.key_ingredients?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Ingredients</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {a.key_ingredients.map((ing) => (
                                    <Badge key={ing} variant="outline" className="text-xs">{ing}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {scheduleDays.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">When to Use</p>
                                <p className="text-sm text-foreground/70">Scheduled for: {scheduleDays.join(", ")}</p>
                              </div>
                            )}
                            {a.example_posts?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Example Hooks</p>
                                <div className="space-y-1.5">
                                  {a.example_posts.slice(0, 3).map((ex, j) => {
                                    const hook = ex.length > 120 ? ex.substring(0, 120) + "…" : ex;
                                    return (
                                      <p key={j} className="text-xs text-foreground/60 italic pl-3 border-l-2 border-border">
                                        "{hook}"
                                      </p>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                    <Brain className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No archetypes discovered yet. Run data analysis to discover your content patterns.</p>
                    <Button variant="outline" size="sm" onClick={handleGeneratePlaybook} disabled={generating} className="gap-2">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Run Analysis
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Checklist */}
              {playbook?.checklist && (
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

              {/* Rules */}
              {playbook?.rules && (
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

              {/* Generation Guidelines */}
              {playbook?.generation_guidelines && (
                <section className="space-y-4">
                  {/* Info banner */}
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      These guidelines are auto-generated from your actual post performance data. To add your own rules, use Brand Guardrails.{" "}
                      <button
                        type="button"
                        className="inline text-primary hover:underline font-medium"
                        onClick={() => setActiveTab("guardrails")}
                      >
                        Go to Brand Guardrails →
                      </button>
                    </p>
                  </div>

                  {/* Read-only container */}
                  <div className="rounded-lg bg-muted/20 p-4 opacity-80 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      Content Generation Guidelines
                    </h2>
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
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          {/* ═══ Tab: Content Plan ═══ */}
          <TabsContent value="content_plan">
            <ContentPlanTab />
          </TabsContent>

          {/* ═══ Tab: Branding Plan ═══ */}
          <TabsContent value="branding_plan">
            <BrandingPlanTab />
          </TabsContent>

          {/* ═══ Tab: Funnel Strategy ═══ */}
          <TabsContent value="funnel_strategy">
            <FunnelStrategyTab />
          </TabsContent>

          {/* ═══ Tab: Brand Guardrails ═══ */}
          <TabsContent value="guardrails">
            <GuardrailsTab />
          </TabsContent>
        </Tabs>

        {/* ── Confirm Regenerate Dialog ── */}
        <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{hasV2Strategy ? "Regenerate Content Strategy?" : "Generate Content Strategy?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {hasV2Strategy
                  ? "This will regenerate your audience segments, content pillars, and plans. Existing strategy data will be replaced."
                  : "Generate audience segments, content pillars with topic angles, and posting plans based on your profile and content data."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={() => {
                  setShowRegenConfirm(false);
                  handleGenerateStrategy();
                }}
              >
                {hasV2Strategy ? "Regenerate" : "Generate"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Playbook;
