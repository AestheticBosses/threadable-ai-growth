import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, ArrowLeft, ArrowRight, AtSign, Sparkles, TrendingUp, Loader2 } from "lucide-react";

const STEPS = [
  "Connect Threads",
  "Experience",
  "Your Niche",
  "Dream Client",
  "End Goal",
];

type AccountType = "seasoned" | "new";

interface PipelineStepDef {
  id: string;
  label: string;
  status: "waiting" | "active" | "done" | "error";
}

const SEASONED_STEPS: PipelineStepDef[] = [
  { id: "fetch", label: "Fetching your Threads posts", status: "waiting" },
  { id: "analysis", label: "Running regression analysis", status: "waiting" },
  { id: "archetypes", label: "Discovering your content archetypes", status: "waiting" },
  { id: "identity", label: "Extracting your identity", status: "waiting" },
  { id: "voice", label: "Analyzing your writing voice", status: "waiting" },
  { id: "playbook", label: "Generating your playbook", status: "waiting" },
  { id: "plans", label: "Creating content, branding & funnel plans", status: "waiting" },
  { id: "templates", label: "Building content templates", status: "waiting" },
];

const NEW_STEPS: PipelineStepDef[] = [
  { id: "fetch", label: "Checking your Threads account", status: "waiting" },
  { id: "competitors", label: "Finding top accounts in your niche", status: "waiting" },
  { id: "archetypes", label: "Identifying winning content patterns", status: "waiting" },
  { id: "identity", label: "Building your starter identity", status: "waiting" },
  { id: "playbook", label: "Generating your playbook", status: "waiting" },
  { id: "plans", label: "Creating your content strategy", status: "waiting" },
  { id: "templates", label: "Building starter templates", status: "waiting" },
];

function PipelineProgressStep({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-3">
      {status === "waiting" && (
        <div className="w-6 h-6 rounded-full border border-muted-foreground/40 shrink-0" />
      )}
      {status === "active" && (
        <div className="w-6 h-6 animate-spin border-2 border-primary border-t-transparent rounded-full shrink-0" />
      )}
      {status === "done" && (
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center shrink-0">
          <span className="text-destructive-foreground text-xs font-bold">!</span>
        </div>
      )}
      <span
        className={
          status === "done"
            ? "text-muted-foreground text-sm"
            : status === "active"
            ? "text-foreground font-medium text-sm"
            : status === "error"
            ? "text-destructive text-sm"
            : "text-muted-foreground/50 text-sm"
        }
      >
        {label}
      </span>
    </div>
  );
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const [threadsConnected, setThreadsConnected] = useState(false);
  const [threadsUsername, setThreadsUsername] = useState("");
  const [isEstablished, setIsEstablished] = useState<boolean | null>(null);
  const [niche, setNiche] = useState("");
  const [dreamClient, setDreamClient] = useState("");
  const [endGoal, setEndGoal] = useState("");

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStepDef[]>([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineHasErrors, setPipelineHasErrors] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("new");

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("threads_username")
        .eq("id", user.id)
        .single();
      if (data?.threads_username) {
        setThreadsConnected(true);
        setThreadsUsername(data.threads_username);
        setStep(1);
      }
      setProfileLoading(false);
    };
    loadProfile();
  }, [user]);

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
      toast({ title: "Threads connection failed", description: `Error: ${error}`, variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user]);

  const updateStep = (stepId: string, status: "waiting" | "active" | "done" | "error") => {
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const invokeStep = async (stepId: string, fnName: string, body: any) => {
    updateStep(stepId, "active");
    try {
      const headers = await getAuthHeaders();
      const { error } = await supabase.functions.invoke(fnName, { body, headers });
      if (error) {
        console.error(`Pipeline step ${stepId} failed:`, error);
        updateStep(stepId, "error");
        return false;
      }
      updateStep(stepId, "done");
      return true;
    } catch (err) {
      console.error(`Pipeline step ${stepId} threw:`, err);
      updateStep(stepId, "error");
      return false;
    }
  };

  const runSeasonedPipeline = async () => {
    if (!user) return;

    // 1. Fetch posts (skip if already have some)
    const { count } = await supabase
      .from("posts_analyzed")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source", "own");

    if ((count ?? 0) === 0) {
      await invokeStep("fetch", "fetch-user-posts", { user_id: user.id });
    } else {
      updateStep("fetch", "done");
    }

    // After fetching, check actual account maturity
    const { data: posts } = await supabase
      .from("posts_analyzed")
      .select("views")
      .eq("user_id", user.id)
      .eq("source", "own")
      .order("views", { ascending: false });

    const totalPosts = posts?.length || 0;
    const hasViralPosts = posts?.some((p) => (p.views ?? 0) >= 5000);
    const actualSeasoned = totalPosts >= 20 && hasViralPosts;

    if (!actualSeasoned && totalPosts < 20) {
      // They said seasoned but they're actually new — switch to new pipeline
      console.log("User said seasoned but only has", totalPosts, "posts. Switching to new path.");
      // Continue with reduced pipeline but still use whatever posts they have
    }

    // 2. Run analysis
    await invokeStep("analysis", "run-analysis", { user_id: user.id });

    // 3. Discover archetypes
    await invokeStep("archetypes", "discover-archetypes", {
      user_id: user.id,
      niche: niche.trim(),
      goals: endGoal.trim(),
    });

    // 4. Extract identity
    await invokeStep("identity", "extract-identity", { user_id: user.id });

    // 5. Analyze voice
    await invokeStep("voice", "analyze-voice", { user_id: user.id });

    // 6. Generate playbook
    await invokeStep("playbook", "generate-playbook", { user_id: user.id });

    // 7. Generate all 3 plans
    updateStep("plans", "active");
    try {
      const headers = await getAuthHeaders();
      await supabase.functions.invoke("generate-plans", {
        body: { plan_type: "content_plan" },
        headers,
      });
      await supabase.functions.invoke("generate-plans", {
        body: { plan_type: "branding_plan" },
        headers,
      });
      await supabase.functions.invoke("generate-plans", {
        body: { plan_type: "funnel_strategy" },
        headers,
      });
      updateStep("plans", "done");
    } catch (err) {
      console.error("Plans step threw:", err);
      updateStep("plans", "error");
    }

    // 8. Generate templates from archetypes
    updateStep("templates", "active");
    try {
      const { data: strategies } = await supabase
        .from("content_strategies")
        .select("strategy_data")
        .eq("user_id", user.id)
        .eq("strategy_type", "archetype_discovery")
        .single();

      const archetypes = (strategies?.strategy_data as any)?.archetypes;
      if (archetypes && Array.isArray(archetypes)) {
        for (const archetype of archetypes) {
          await supabase.from("content_templates").insert({
            user_id: user.id,
            archetype: archetype.name || "General",
            template_text: archetype.template || "",
            example_text: archetype.example_posts?.[0] || null,
            is_default: true,
          });
        }
      }
      updateStep("templates", "done");
    } catch (err) {
      console.error("Templates step threw:", err);
      updateStep("templates", "error");
    }
  };

  const runNewAccountPipeline = async () => {
    if (!user) return;

    // 1. Fetch whatever posts they have
    updateStep("fetch", "active");
    try {
      const headers = await getAuthHeaders();
      await supabase.functions.invoke("fetch-user-posts", {
        body: { user_id: user.id },
        headers,
      });
    } catch {
      // OK if fails — they might have 0 posts
    }
    updateStep("fetch", "done");

    // 2. Find aspirational accounts
    await invokeStep("competitors", "discover-niche-accounts", {
      niche: niche.trim(),
      dream_client: dreamClient.trim(),
    });

    // 3. Discover archetypes (niche-based)
    await invokeStep("archetypes", "discover-archetypes", {
      user_id: user.id,
      new_account: true,
      niche: niche.trim(),
      goals: endGoal.trim(),
    });

    // 4. Build starter identity
    updateStep("identity", "active");
    try {
      await supabase.from("user_identity").upsert({
        user_id: user.id,
        about_you: niche.trim() + " professional helping " + dreamClient.trim(),
        desired_perception: "The go-to expert in " + niche.trim(),
        main_goal: endGoal.trim(),
      }, { onConflict: "user_id" });
      updateStep("identity", "done");
    } catch (err) {
      console.error("Identity step threw:", err);
      updateStep("identity", "error");
    }

    // 5. Generate playbook
    await invokeStep("playbook", "generate-playbook", { user_id: user.id });

    // 6. Generate plans
    updateStep("plans", "active");
    try {
      const headers = await getAuthHeaders();
      await supabase.functions.invoke("generate-plans", {
        body: { plan_type: "content_plan" },
        headers,
      });
      await supabase.functions.invoke("generate-plans", {
        body: { plan_type: "branding_plan" },
        headers,
      });
      await supabase.functions.invoke("generate-plans", {
        body: { plan_type: "funnel_strategy" },
        headers,
      });
      updateStep("plans", "done");
    } catch (err) {
      console.error("Plans step threw:", err);
      updateStep("plans", "error");
    }

    // 7. Generate starter templates
    updateStep("templates", "active");
    try {
      const { data: strategies } = await supabase
        .from("content_strategies")
        .select("strategy_data")
        .eq("user_id", user.id)
        .eq("strategy_type", "archetype_discovery")
        .single();

      const archetypes = (strategies?.strategy_data as any)?.archetypes;
      if (archetypes && Array.isArray(archetypes)) {
        for (const archetype of archetypes) {
          await supabase.from("content_templates").insert({
            user_id: user.id,
            archetype: archetype.name || "General",
            template_text: archetype.template || "",
            example_text: archetype.example_posts?.[0] || null,
            is_default: true,
          });
        }
      }
      updateStep("templates", "done");
    } catch (err) {
      console.error("Templates step threw:", err);
      updateStep("templates", "error");
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          niche: niche.trim(),
          dream_client: dreamClient.trim(),
          end_goal: endGoal.trim(),
          is_established: isEstablished,
          onboarding_complete: true,
        })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();

      // Determine account type and start pipeline
      const type: AccountType = isEstablished ? "seasoned" : "new";
      setAccountType(type);
      const steps = type === "seasoned" ? SEASONED_STEPS : NEW_STEPS;
      setPipelineSteps(steps.map((s) => ({ ...s, status: "waiting" as const })));
      setPipelineRunning(true);
      setPipelineComplete(false);
      setPipelineHasErrors(false);

      // Run the appropriate pipeline
      if (type === "seasoned") {
        await runSeasonedPipeline();
      } else {
        await runNewAccountPipeline();
      }

      // Check for errors
      setPipelineSteps((prev) => {
        const hasErrors = prev.some((s) => s.status === "error");
        setPipelineHasErrors(hasErrors);
        return prev;
      });

      await refreshProfile();
      setPipelineComplete(true);
    } catch (e: any) {
      toast({ title: "Error saving profile", description: e.message, variant: "destructive" });
      setPipelineRunning(false);
    } finally {
      setSaving(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard", { replace: true });
  };

  const isStepValid = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return isEstablished !== null;
      case 2:
        return niche.trim().length > 0;
      case 3:
        return dreamClient.trim().length > 0;
      case 4:
        return endGoal.trim().length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 4) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleConnectThreads = () => {
    if (!user) return;
    const clientId = import.meta.env.VITE_THREADS_APP_ID || "921740210802274";
    const redirectUri = import.meta.env.VITE_THREADS_REDIRECT_URI || "https://iobnntqhmswxtubkdjon.supabase.co/functions/v1/threads-oauth-callback";
    if (!clientId || !redirectUri) {
      toast({ title: "Configuration error", description: "Threads OAuth is not configured.", variant: "destructive" });
      return;
    }
    const url = new URL("https://threads.net/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "threads_basic,threads_content_publish,threads_manage_insights,threads_read_replies,threads_manage_replies");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", user.id);
    window.location.href = url.toString();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Pipeline progress overlay */}
      {pipelineRunning && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-6">
          <div className="max-w-md w-full px-6">
            <div className="text-center mb-8">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <h1 className="text-white text-2xl font-bold mb-2">
                Setting up your Threadable
              </h1>
              <p className="text-gray-400">
                {accountType === "seasoned"
                  ? "We're analyzing your content to build your personalized strategy."
                  : "We're building your starter strategy based on what works in your niche."}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                This takes about 60–90 seconds
              </p>
            </div>

            <div className="space-y-4">
              {pipelineSteps.map((s) => (
                <PipelineProgressStep key={s.id} label={s.label} status={s.status} />
              ))}
            </div>

            {pipelineComplete && (
              <div className="mt-8 text-center">
              <p className={pipelineHasErrors ? "text-amber-400 font-medium mb-4" : "text-primary font-medium mb-4"}>
                  {pipelineHasErrors
                    ? "Setup mostly complete — some steps had issues but you can retry them later."
                    : "Your account is ready! 🎉"}
                </p>
                <Button onClick={handleGoToDashboard} size="lg" className="px-8">
                  Go to Dashboard →
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="mx-auto w-full max-w-xl px-6 pt-12 pb-4">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                <div
                  className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-full transition-colors ${
                      i < step ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors text-center ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-32">
        {step === 0 && (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Connect Your Threads Account
            </h1>
            {!threadsConnected ? (
              <>
                <Button
                  size="lg"
                  className="mx-auto flex h-14 gap-3 rounded-xl px-8 text-base font-semibold"
                  onClick={handleConnectThreads}
                >
                  <AtSign className="h-5 w-5" />
                  Connect Threads
                </Button>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  We'll use this to analyze your posts and publish content on your behalf.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-lg font-medium text-primary">
                <Check className="h-5 w-5" />
                Connected as @{threadsUsername} ✓
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              How long have you been posting on Threads?
            </h1>
            <p className="text-muted-foreground">
              This helps us personalize your strategy.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => setIsEstablished(false)}
                className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                  isEstablished === false
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Sparkles className={`h-8 w-8 ${isEstablished === false ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-base font-semibold text-foreground">I'm brand new</p>
                  <p className="mt-1 text-sm text-muted-foreground">Less than 2 weeks on Threads</p>
                </div>
              </button>
              <button
                onClick={() => setIsEstablished(true)}
                className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                  isEstablished === true
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <TrendingUp className={`h-8 w-8 ${isEstablished === true ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-base font-semibold text-foreground">I've been posting for a while</p>
                  <p className="mt-1 text-sm text-muted-foreground">I have existing posts to analyze</p>
                </div>
              </button>
            </div>
            {isEstablished === true && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                Great! We'll analyze <strong>YOUR</strong> posts and auto-generate your entire strategy — playbook, plans, templates, and more.
              </div>
            )}
            {isEstablished === false && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                No worries! We'll study top accounts in your niche and build your starter strategy automatically.
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              What's Your Niche?
            </h1>
            <div className="space-y-2">
              <label htmlFor="niche" className="text-sm font-medium text-foreground">
                What's your niche?
              </label>
              <Input
                id="niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., Medical spa marketing, SaaS growth, fitness coaching"
                className="h-12 text-base"
              />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Be specific. "Marketing" is too broad. "Marketing for medical spas and aesthetic clinics" is perfect.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Who's Your Dream Client?
            </h1>
            <div className="space-y-2">
              <label htmlFor="dream-client" className="text-sm font-medium text-foreground">
                Describe your dream client
              </label>
              <Textarea
                id="dream-client"
                value={dreamClient}
                onChange={(e) => setDreamClient(e.target.value)}
                placeholder="e.g., Med spa owners doing $30K-$100K/mo who want to scale to $300K+ through content and authority building"
                rows={4}
                className="text-base resize-none"
              />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Think about who you want reaching out in your DMs after reading your threads.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              What's Your End Goal?
            </h1>
            <div className="space-y-2">
              <label htmlFor="end-goal" className="text-sm font-medium text-foreground">
                What's your end goal with Threads?
              </label>
              <Textarea
                id="end-goal"
                value={endGoal}
                onChange={(e) => setEndGoal(e.target.value)}
                placeholder="e.g., Build authority, drive DMs for my $5K program, grow to 50K followers in 6 months"
                rows={4}
                className="text-base resize-none"
              />
              <p className="text-sm text-muted-foreground leading-relaxed">
                This shapes what types of content we create and optimize for.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      {!pipelineRunning && (
        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-lg items-center justify-between px-6 py-4">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isStepValid() || saving}
              className="gap-2 px-6"
            >
              {step === 4 ? (
                saving ? "Saving…" : "Launch My Growth Engine →"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
