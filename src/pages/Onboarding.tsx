import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, ArrowLeft, ArrowRight, AtSign } from "lucide-react";

const STEPS = [
  "Connect Threads",
  "Your Niche",
  "Dream Client",
  "End Goal",
];



const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const [threadsConnected, setThreadsConnected] = useState(false);
  const [threadsUsername, setThreadsUsername] = useState("");
  const [niche, setNiche] = useState("");
  const [dreamClient, setDreamClient] = useState("");
  const [endGoal, setEndGoal] = useState("");

  // On load: check if user already has threads connected
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

  // Handle OAuth callback params
  useEffect(() => {
    const connected = searchParams.get("threads_connected");
    const error = searchParams.get("threads_error");

    if (connected === "true") {
      // Refetch profile to get the username stored by the callback
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

  const isStepValid = () => {
    switch (step) {
      case 0:
        return true; // connect is optional for now
      case 1:
        return niche.trim().length > 0;
      case 2:
        return dreamClient.trim().length > 0;
      case 3:
        return endGoal.trim().length > 0;
      default:
        return false;
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
          onboarding_complete: true,
        })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
      navigate("/analyze", { replace: true });
    } catch (e: any) {
      toast({ title: "Error saving profile", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step === 3) {
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
                className={`text-xs font-medium transition-colors ${
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
              <div className="flex items-center justify-center gap-2 text-lg font-medium" style={{ color: "hsl(var(--success))" }}>
                <Check className="h-5 w-5" />
                Connected as @{threadsUsername} ✓
              </div>
            )}
          </div>
        )}

        {step === 1 && (
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

        {step === 2 && (
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

        {step === 3 && (
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
            {step === 3 ? (
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
    </div>
  );
};

export default Onboarding;
