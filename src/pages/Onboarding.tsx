import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Check, ArrowLeft, AtSign, Loader2 } from "lucide-react";
import PlanPreview from "@/components/onboarding/PlanPreview";

// ── Types ──────────────────────────────────────────────────────────────────────
type GoalType = "dm_leads" | "grow_audience" | "drive_traffic";

interface PipelineStepDef {
  id: string;
  label: string;
  status: "waiting" | "active" | "done" | "error";
  insight?: string;
}

const GOAL_OPTIONS: { value: GoalType; emoji: string; title: string; subtitle: string }[] = [
  { value: "dm_leads", emoji: "💬", title: "Get Comments & Leads", subtitle: "Use comment keywords to start conversations" },
  { value: "grow_audience", emoji: "👥", title: "Grow My Audience", subtitle: "Get more followers, views, and reach" },
  { value: "drive_traffic", emoji: "🔗", title: "Drive Traffic", subtitle: "Send people to your link or landing page" },
];

const POSTS_PER_DAY_NOTES: Record<string, string> = {
  "1-2": "Sustainable and focused",
  "3-5": "Growth mode — most common",
  "6-7": "Aggressive growth",
};

function getPostsNote(v: number): string {
  if (v <= 2) return POSTS_PER_DAY_NOTES["1-2"];
  if (v <= 5) return POSTS_PER_DAY_NOTES["3-5"];
  return POSTS_PER_DAY_NOTES["6-7"];
}

// ── Pipeline Steps ─────────────────────────────────────────────────────────────
const SEASONED_PIPELINE: PipelineStepDef[] = [
  { id: "fetch", label: "Fetching your posts…", status: "waiting" },
  { id: "analysis", label: "Analyzing what works…", status: "waiting" },
  { id: "regression", label: "Running regression analysis…", status: "waiting" },
  { id: "archetypes", label: "Discovering your content archetypes…", status: "waiting" },
  { id: "identity", label: "Extracting your identity…", status: "waiting" },
  { id: "voice", label: "Analyzing your writing voice…", status: "waiting" },
  { id: "playbook", label: "Generating your playbook…", status: "waiting" },
  { id: "buckets", label: "Creating content buckets…", status: "waiting" },
  { id: "pillars", label: "Building content pillars…", status: "waiting" },
  { id: "plan30", label: "Generating your growth map…", status: "waiting" },
  { id: "weekposts", label: "Generating your first week of posts…", status: "waiting" },
  { id: "plans", label: "Creating content, branding & funnel plans…", status: "waiting" },
  { id: "templates", label: "Building content templates…", status: "waiting" },
];

const NEW_PIPELINE: PipelineStepDef[] = [
  { id: "fetch", label: "Checking your Threads account…", status: "waiting" },
  { id: "archetypes", label: "Identifying winning content patterns…", status: "waiting" },
  { id: "identity", label: "Building your starter identity…", status: "waiting" },
  { id: "voice", label: "Analyzing your writing voice…", status: "waiting" },
  { id: "playbook", label: "Generating your playbook…", status: "waiting" },
  { id: "buckets", label: "Creating content buckets…", status: "waiting" },
  { id: "pillars", label: "Building content pillars…", status: "waiting" },
  { id: "plan30", label: "Generating your growth map…", status: "waiting" },
  { id: "weekposts", label: "Generating your first week of posts…", status: "waiting" },
  { id: "plans", label: "Creating your content strategy…", status: "waiting" },
  { id: "templates", label: "Building starter templates…", status: "waiting" },
];

// ── Progress Step UI ───────────────────────────────────────────────────────────
function PipelineProgressStep({ label, status, insight, onRetry }: { label: string; status: string; insight?: string; onRetry?: () => void }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3">
        {status === "waiting" && <div className="w-5 h-5 rounded-full border border-muted-foreground/30 shrink-0" />}
        {status === "active" && <div className="w-5 h-5 animate-spin border-2 border-primary border-t-transparent rounded-full shrink-0" />}
        {status === "done" && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
        {status === "error" && (
          <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0">
            <span className="text-destructive-foreground text-[10px] font-bold">!</span>
          </div>
        )}
        <span className={
          status === "done" ? "text-muted-foreground text-sm" :
          status === "active" ? "text-foreground font-medium text-sm" :
          status === "error" ? "text-destructive text-sm" :
          "text-muted-foreground/40 text-sm"
        }>
          {label}
        </span>
        {status === "error" && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors ml-auto"
          >
            Retry
          </button>
        )}
      </div>
      {insight && status === "done" && (
        <p className="text-xs text-primary/80 ml-8">{insight}</p>
      )}
    </div>
  );
}

// ── Funnel percentages by journey stage ────────────────────────────────────────
const STAGE_FUNNEL: Record<string, { tof: number; mof: number; bof: number }> = {
  getting_started: { tof: 70, mof: 20, bof: 10 },
  growing: { tof: 30, mof: 50, bof: 20 },
  monetizing: { tof: 20, mof: 30, bof: 50 },
};

const GOAL_LABELS: Record<GoalType, string> = {
  dm_leads: "DM leads",
  grow_audience: "audience growth",
  drive_traffic: "traffic",
};

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();

  // Step state (0–3)
  const [step, setStep] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // Step 0 — Connect Threads
  const [threadsConnected, setThreadsConnected] = useState(false);
  const [threadsUsername, setThreadsUsername] = useState("");

  // Step 1 — Goal
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [dmKeyword, setDmKeyword] = useState("");
  const [dmOffer, setDmOffer] = useState("");
  const [trafficUrl, setTrafficUrl] = useState("");

  // Step 2 — About You
  const [dreamClient, setDreamClient] = useState("");
  const [mission, setMission] = useState("");

  // Step 3 — Posts per day
  const [postsPerDay, setPostsPerDay] = useState(3);

  // Pipeline
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStepDef[]>([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineHasErrors, setPipelineHasErrors] = useState(false);

  // Completion screen
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionStats, setCompletionStats] = useState<{
    postsGenerated: number;
    journeyStage: string;
    goalType: GoalType;
  } | null>(null);

  // ── Load existing profile ──────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("threads_username, dream_client, mission, traffic_url, max_posts_per_day")
        .eq("id", user.id)
        .single();
      if (data?.threads_username) {
        setThreadsConnected(true);
        setThreadsUsername(data.threads_username);
        // Don't auto-advance — always show Step 0 so users can verify/reconnect
      }
      if (data?.dream_client) setDreamClient(data.dream_client);
      if (data?.mission) setMission(data.mission);
      if (data?.traffic_url) setTrafficUrl(data.traffic_url);
      if (data?.max_posts_per_day) setPostsPerDay(data.max_posts_per_day);
      setProfileLoading(false);
    };
    loadProfile();
  }, [user]);

  // ── Handle OAuth callback ──────────────────────────────────────────────────
  useEffect(() => {
    const connected = searchParams.get("threads_connected");
    const error = searchParams.get("threads_error");
    if (connected === "true") {
      const refetch = async () => {
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("threads_username")
          .eq("id", user.id)
          .single();
        if (data?.threads_username) {
          setThreadsConnected(true);
          setThreadsUsername(data.threads_username);
          toast({ title: "Threads connected!", description: `Connected as @${data.threads_username}` });
        }
        setSearchParams({}, { replace: true });
      };
      refetch();
    } else if (error) {
      toast({ title: "Connection failed", description: `Error: ${error}`, variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user]);

  // ── Connect Threads ────────────────────────────────────────────────────────
  const handleConnectThreads = () => {
    if (!user) return;
    const clientId = import.meta.env.VITE_THREADS_APP_ID || "921740210802274";
    const redirectUri = import.meta.env.VITE_THREADS_REDIRECT_URI || "https://iobnntqhmswxtubkdjon.supabase.co/functions/v1/threads-oauth-callback";
    const url = new URL("https://threads.net/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "threads_basic,threads_content_publish,threads_manage_insights,threads_keyword_search,threads_profile_discovery");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", user.id);
    window.location.href = url.toString();
  };

  const handleDisconnect = async () => {
    if (!user) return;
    const confirmed = window.confirm("Disconnect this Threads account? You can then connect a different one.");
    if (!confirmed) return;
    await supabase.from("profiles").update({
      threads_access_token: null, threads_user_id: null, threads_username: null,
      threads_profile_picture_url: null, display_name: null,
    }).eq("id", user.id);
    await supabase.from("posts_analyzed").delete().eq("user_id", user.id);
    setThreadsConnected(false);
    setThreadsUsername("");
  };

  // ── Pipeline helpers ───────────────────────────────────────────────────────
  const updateStep = (stepId: string, status: PipelineStepDef["status"], insight?: string) => {
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status, ...(insight ? { insight } : {}) } : s))
    );
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const invokeStep = async (stepId: string, fnName: string, body: any): Promise<boolean> => {
    updateStep(stepId, "active");
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke(fnName, { body, headers });
      if (error) {
        // Extract detailed error from edge function response
        let detail = error.message || "Unknown error";
        try {
          if (error.context && typeof error.context.json === "function") {
            const errBody = await error.context.json();
            detail = errBody?.error || errBody?.message || JSON.stringify(errBody);
          }
        } catch { /* context not readable */ }
        console.error(`[Pipeline] ${fnName} FAILED:`, detail, { error, data });
        updateStep(stepId, "error");
        return false;
      }
      // Some functions return 200 with { error: "..." } in the body
      if (data?.error) {
        console.error(`[Pipeline] ${fnName} returned error in body:`, data.error);
        updateStep(stepId, "error");
        return false;
      }
      updateStep(stepId, "done");
      return true;
    } catch (e) {
      console.error(`[Pipeline] ${fnName} EXCEPTION:`, e);
      updateStep(stepId, "error");
      return false;
    }
  };

  // ── Seasoned pipeline (has posts with views) ──────────────────────────────
  const runSeasonedPipeline = async () => {
    if (!user) return;

    const analysisOk = await invokeStep("analysis", "run-analysis", { user_id: user.id });
    const regressionOk = await invokeStep("regression", "run-regression", { user_id: user.id });

    let archetypesOk = false;
    if (analysisOk && regressionOk) {
      archetypesOk = await invokeStep("archetypes", "discover-archetypes", {
        user_id: user.id, niche: dreamClient.trim(), goals: mission.trim(),
      });
    } else {
      updateStep("archetypes", "error");
    }

    if (archetypesOk) {
      getAuthHeaders().then((h) => supabase.functions.invoke("categorize-posts", { headers: h }).catch(() => {}));
    }

    await invokeStep("identity", "extract-identity", { user_id: user.id });
    await invokeStep("voice", "analyze-voice", { user_id: user.id });

    if (archetypesOk) {
      await invokeStep("playbook", "generate-playbook", { user_id: user.id });
    } else {
      updateStep("playbook", "error");
    }

    const bucketsOk = await invokeStep("buckets", "generate-content-buckets", {});
    let pillarsOk = false;
    if (bucketsOk) {
      pillarsOk = await invokeStep("pillars", "generate-content-pillars", {});
    } else {
      updateStep("pillars", "error");
    }

    if (pillarsOk) {
      await invokeStep("plan30", "generate-30day-plan", {});
    } else {
      updateStep("plan30", "error");
    }

    if (pillarsOk) {
      await invokeStep("weekposts", "generate-week-posts", {});
    } else {
      updateStep("weekposts", "error");
    }

    updateStep("plans", "active");
    try {
      const headers = await getAuthHeaders();
      await supabase.functions.invoke("generate-plans", { body: { plan_type: "content_plan" }, headers });
      await supabase.functions.invoke("generate-plans", { body: { plan_type: "branding_plan" }, headers });
      await supabase.functions.invoke("generate-plans", { body: { plan_type: "funnel_strategy" }, headers });
      updateStep("plans", "done");
    } catch {
      updateStep("plans", "error");
    }

    if (archetypesOk) {
      await invokeStep("templates", "generate-templates", {});
    } else {
      updateStep("templates", "error");
    }
  };

  // ── New account pipeline ──────────────────────────────────────────────────
  const runNewPipeline = async () => {
    if (!user) return;

    await invokeStep("archetypes", "discover-archetypes", {
      user_id: user.id, new_account: true, niche: dreamClient.trim(), goals: mission.trim(),
    });

    getAuthHeaders().then((h) => supabase.functions.invoke("categorize-posts", { headers: h }).catch(() => {}));

    await invokeStep("identity", "extract-identity", {});
    await invokeStep("voice", "analyze-voice", { user_id: user.id });
    await invokeStep("playbook", "generate-playbook", { user_id: user.id });

    const bucketsOk = await invokeStep("buckets", "generate-content-buckets", {});
    let pillarsOk = false;
    if (bucketsOk) {
      pillarsOk = await invokeStep("pillars", "generate-content-pillars", {});
    } else {
      updateStep("pillars", "error");
    }

    if (pillarsOk) {
      await invokeStep("plan30", "generate-30day-plan", {});
    } else {
      updateStep("plan30", "error");
    }

    if (pillarsOk) {
      await invokeStep("weekposts", "generate-week-posts", {});
    } else {
      updateStep("weekposts", "error");
    }

    updateStep("plans", "active");
    try {
      const headers = await getAuthHeaders();
      await supabase.functions.invoke("generate-plans", { body: { plan_type: "content_plan" }, headers });
      await supabase.functions.invoke("generate-plans", { body: { plan_type: "branding_plan" }, headers });
      await supabase.functions.invoke("generate-plans", { body: { plan_type: "funnel_strategy" }, headers });
      updateStep("plans", "done");
    } catch {
      updateStep("plans", "error");
    }

    await invokeStep("templates", "generate-templates", {});
  };

  // ── Complete onboarding ────────────────────────────────────────────────────
  const handleBuildPlan = async () => {
    if (!user || !goalType) return;
    setPipelineRunning(true);
    setPipelineComplete(false);
    setPipelineHasErrors(false);

    try {
      // 1. Save profile fields
      await supabase.from("profiles").update({
        dream_client: dreamClient.trim(),
        mission: mission.trim() || null,
        max_posts_per_day: postsPerDay,
        traffic_url: trafficUrl.trim() || null,
        goal_type: goalType,
        dm_keyword: dmKeyword.trim() || null,
        dm_offer: dmOffer.trim() || null,
      } as any).eq("id", user.id);

      await refreshProfile();

      // 2. Start pipeline — first fetch posts
      setPipelineSteps(SEASONED_PIPELINE.map((s) => ({ ...s, status: "waiting" as const })));

      // Check if posts already fetched
      const { count } = await supabase
        .from("posts_analyzed")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("source", "own");

      if ((count ?? 0) === 0 && threadsConnected) {
        updateStep("fetch", "active");
        try {
          const headers = await getAuthHeaders();
          await supabase.functions.invoke("fetch-user-posts", { body: { user_id: user.id }, headers });
        } catch {}
        updateStep("fetch", "done");
      } else {
        updateStep("fetch", "done");
      }

      // 3. Auto-detect journey stage
      const { data: posts } = await supabase
        .from("posts_analyzed")
        .select("id, views, text_content")
        .eq("user_id", user.id)
        .eq("source", "own");

      const postCount = posts?.length || 0;
      const { data: profileData } = await supabase
        .from("profiles")
        .select("follower_count")
        .eq("id", user.id)
        .single();
      const followerCount = profileData?.follower_count || 0;

      let journeyStage = "getting_started";
      if (postCount === 0 || followerCount < 1000) {
        journeyStage = "getting_started";
      } else {
        // Check for monetization signals
        const ctaPosts = posts?.filter((p) => {
          const text = (p.text_content || "").toLowerCase();
          return text.includes("dm me") || text.includes("link in bio") || text.includes("book a call") || text.includes("grab") || text.includes("sign up");
        }) || [];
        const ctaRatio = ctaPosts.length / postCount;

        if (goalType === "dm_leads" && ctaRatio > 0.05) {
          journeyStage = "monetizing";
        } else if (ctaRatio > 0.1) {
          journeyStage = "monetizing";
        } else {
          journeyStage = "growing";
        }
      }

      await supabase.from("profiles").update({
        journey_stage: journeyStage,
        is_established: postCount >= 20 && (posts?.some((p) => (p.views ?? 0) >= 5000) || false),
      }).eq("id", user.id);

      // 4. Determine pipeline path
      const isSeasoned = postCount >= 20 && (posts?.some((p) => (p.views ?? 0) >= 5000) || false);

      if (isSeasoned) {
        setPipelineSteps(SEASONED_PIPELINE.map((s) => ({
          ...s, status: s.id === "fetch" ? "done" as const : "waiting" as const,
        })));
        await runSeasonedPipeline();
      } else {
        setPipelineSteps(NEW_PIPELINE.map((s) => ({
          ...s, status: s.id === "fetch" ? "done" as const : "waiting" as const,
        })));
        await runNewPipeline();
      }

      // 5. Check for errors
      setPipelineSteps((prev) => {
        const hasErrors = prev.some((s) => s.status === "error");
        setPipelineHasErrors(hasErrors);
        return prev;
      });

      // 6. Get completion stats (count actual draft posts generated)
      const { count: draftCount } = await supabase
        .from("scheduled_posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "draft");

      setCompletionStats({
        postsGenerated: draftCount || 0,
        journeyStage,
        goalType,
      });

      setPipelineComplete(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPipelineRunning(false);
    }
  };

  // ── Step validation ────────────────────────────────────────────────────────
  const isStepValid = () => {
    switch (step) {
      case 0: return true; // can proceed connected or not
      case 1: return goalType !== null;
      case 2: return dreamClient.trim().length > 0 && mission.trim().length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step === 0 && !threadsConnected) {
      // Allow advancing but warn
      setStep(1);
      return;
    }
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      handleBuildPlan();
    }
  };

  if (profileLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Completion Screen
  // ══════════════════════════════════════════════════════════════════════════════
  const handleCompletionNavigate = async (path: string) => {
    if (!user) return;
    // Mark onboarding complete only when user clicks through
    await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", user.id);
    await refreshProfile();
    navigate(path, { replace: true });
  };

  if (showCompletion && completionStats) {
    return (
      <PlanPreview
        journeyStage={completionStats.journeyStage}
        goalType={completionStats.goalType}
        onNavigate={handleCompletionNavigate}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Pipeline Progress Screen
  // ══════════════════════════════════════════════════════════════════════════════
  if (pipelineRunning) {
    const handleRetryStep = async (stepId: string) => {
      if (!user) return;
      const retryMap: Record<string, { fn: string; body: any }> = {
        fetch: { fn: "fetch-user-posts", body: { user_id: user.id } },
        analysis: { fn: "run-analysis", body: { user_id: user.id } },
        regression: { fn: "run-regression", body: { user_id: user.id } },
        archetypes: { fn: "discover-archetypes", body: { user_id: user.id, niche: dreamClient.trim(), goals: mission.trim() } },
        identity: { fn: "extract-identity", body: { user_id: user.id } },
        voice: { fn: "analyze-voice", body: { user_id: user.id } },
        playbook: { fn: "generate-playbook", body: { user_id: user.id } },
        buckets: { fn: "generate-content-buckets", body: {} },
        pillars: { fn: "generate-content-pillars", body: {} },
        plan30: { fn: "generate-30day-plan", body: {} },
        weekposts: { fn: "generate-week-posts", body: {} },
        templates: { fn: "generate-templates", body: {} },
      };
      const mapping = retryMap[stepId];
      if (mapping) {
        await invokeStep(stepId, mapping.fn, mapping.body);
      }
    };

    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-6">
        <div className="max-w-md w-full px-6">
          <div className="text-center mb-8">
            {!pipelineComplete && <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />}
            <h1 className="text-foreground text-2xl font-bold mb-2">
              {pipelineComplete ? "Plan built!" : "Building your growth plan..."}
            </h1>
            <p className="text-muted-foreground text-sm">
              {pipelineComplete
                ? pipelineHasErrors
                  ? "Mostly complete — you can retry failed steps or continue."
                  : "Your complete content system is ready."
                : "This takes a few minutes — we're building your complete content system."}
            </p>
          </div>
          <div className="space-y-3">
            {pipelineSteps.map((s) => (
              <PipelineProgressStep
                key={s.id}
                label={s.label}
                status={s.status}
                insight={s.insight}
                onRetry={s.status === "error" ? () => handleRetryStep(s.id) : undefined}
              />
            ))}
          </div>
          {pipelineComplete && (
            <div className="mt-8 text-center">
              <Button
                size="lg"
                className="h-14 px-10 text-base font-semibold"
                onClick={() => {
                  setPipelineRunning(false);
                  setShowCompletion(true);
                }}
              >
                {pipelineHasErrors ? "Continue Anyway →" : "Continue →"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Main 4-Step Flow
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Back link */}
      {step > 0 && (
        <button
          onClick={() => setStep((s) => s - 1)}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full">

          {/* ── Step 0: Connect Threads ── */}
          {step === 0 && (
            <div className="space-y-8 text-center">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                  Let's connect your Threads account
                </h1>
                <p className="text-muted-foreground text-lg">
                  We'll analyze your content to build a strategy that actually works.
                </p>
              </div>

              {!threadsConnected ? (
                <div className="space-y-4">
                  <Button
                    size="lg"
                    className="h-14 px-10 text-base font-semibold gap-3"
                    onClick={handleConnectThreads}
                  >
                    <AtSign className="h-5 w-5" /> Connect Threads →
                  </Button>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    We only analyze public posts. We never post without your approval.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-3 bg-card border border-border rounded-xl px-6 py-4 mx-auto">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">Connected as @{threadsUsername}</p>
                      <p className="text-xs text-muted-foreground">Your account is linked and ready</p>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleConnectThreads}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      Not the right account? Reconnect →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Your Goal ── */}
          {step === 1 && (
            <div className="space-y-6">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center">
                What do you want from Threads?
              </h1>

              <div className="space-y-3">
                {GOAL_OPTIONS.map((opt) => {
                  const selected = goalType === opt.value;
                  return (
                    <div key={opt.value}>
                      <button
                        type="button"
                        onClick={() => setGoalType(selected ? null : opt.value)}
                        className={`w-full text-left rounded-xl border p-5 transition-all duration-150 ${
                          selected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                            : "border-border bg-card hover:border-foreground/20"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{opt.emoji}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{opt.title}</p>
                            <p className="text-sm text-muted-foreground">{opt.subtitle}</p>
                          </div>
                          {selected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Expanded fields for DM Leads */}
                      {selected && opt.value === "dm_leads" && (
                        <div className="mt-3 ml-12 space-y-3 animate-in slide-in-from-top-2 duration-200">
                          <div>
                            <label className="text-sm text-muted-foreground block mb-1">What's your comment keyword?</label>
                            <Input
                              value={dmKeyword}
                              onChange={(e) => setDmKeyword(e.target.value)}
                              placeholder="e.g. SCALE, FREE, YES"
                              className="h-11 text-base"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground block mb-1">What do they get when they comment it?</label>
                            <Input
                              value={dmOffer}
                              onChange={(e) => setDmOffer(e.target.value)}
                              placeholder="e.g. My free scaling framework PDF"
                              className="h-11 text-base"
                            />
                          </div>
                        </div>
                      )}

                      {/* Expanded fields for Drive Traffic */}
                      {selected && opt.value === "drive_traffic" && (
                        <div className="mt-3 ml-12 animate-in slide-in-from-top-2 duration-200">
                          <label className="text-sm text-muted-foreground block mb-1">What's your link?</label>
                          <Input
                            value={trafficUrl}
                            onChange={(e) => setTrafficUrl(e.target.value)}
                            placeholder="https://..."
                            className="h-11 text-base"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 2: About You ── */}
          {step === 2 && (
            <div className="space-y-6">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center">
                Two quick things about you
              </h1>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Who do you want attention from?
                  </label>
                  <Textarea
                    value={dreamClient}
                    onChange={(e) => setDreamClient(e.target.value)}
                    placeholder="Consultants doing $20K/mo who want to scale without burnout"
                    rows={2}
                    className="text-base resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    This helps us write posts that attract the right people.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    What do you want to be known for?
                  </label>
                  <Input
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    placeholder="Helping online business owners get sales using Threads"
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    This shapes your positioning and voice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Posting Commitment ── */}
          {step === 3 && (
            <div className="space-y-8">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center">
                How aggressive do you want to grow?
              </h1>

              <div className="text-center">
                <span className="text-7xl font-bold text-primary tabular-nums">{postsPerDay}</span>
                <p className="text-muted-foreground mt-2 text-lg">posts per day</p>
              </div>

              <div className="px-4">
                <Slider
                  value={[postsPerDay]}
                  onValueChange={(v) => setPostsPerDay(v[0])}
                  min={1}
                  max={7}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>1</span>
                  <span>7</span>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">{getPostsNote(postsPerDay)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 pt-4 flex justify-center">
        <Button
          size="lg"
          className="h-14 px-10 text-base font-semibold min-w-[240px]"
          onClick={handleNext}
          disabled={!isStepValid()}
        >
          {step === 0
            ? "Continue →"
            : step === 3
            ? "Build My Plan →"
            : "Next →"
          }
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
