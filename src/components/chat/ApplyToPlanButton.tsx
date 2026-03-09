import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Loader2, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ApplyToPlanButtonProps {
  analysisText: string;
  onApplied: () => void;
}

function extractRecommendations(text: string): string {
  const lines: string[] = [];

  // Extract numbered list items (1. 2. 3. etc)
  const numbered = text.match(/(?:^|\n)\s*\d+[\.\)]\s+.+/g);
  if (numbered) {
    for (const line of numbered) {
      lines.push(line.replace(/^\s*\d+[\.\)]\s+/, "").replace(/\*\*/g, "").trim());
    }
  }

  // Extract bolded recommendations
  const bolded = [...text.matchAll(/\*\*([^*]{10,})\*\*/g)];
  for (const match of bolded) {
    const clean = match[1].trim();
    // Skip if it's already captured or looks like a header
    if (lines.some(l => l.includes(clean) || clean.includes(l))) continue;
    if (clean.length < 15) continue;
    lines.push(clean);
  }

  // Take first 5, deduplicate
  const unique = [...new Set(lines)].slice(0, 5);
  return unique.map(l => `- ${l}`).join("\n");
}

export function ApplyToPlanButton({ analysisText, onApplied }: ApplyToPlanButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [timeGate, setTimeGate] = useState<{ blocked: boolean; daysSince: number; daysLeft: number } | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("last_plan_applied_at")
        .eq("id", user.id)
        .maybeSingle();

      const lastApplied = (data as any)?.last_plan_applied_at;
      if (!lastApplied) {
        setTimeGate({ blocked: false, daysSince: 0, daysLeft: 0 });
        return;
      }

      const daysSince = Math.floor((Date.now() - new Date(lastApplied).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 7) {
        setTimeGate({ blocked: false, daysSince, daysLeft: 0 });
      } else {
        setTimeGate({ blocked: true, daysSince, daysLeft: 7 - daysSince });
      }
    })();
  }, [user?.id]);

  const handleApply = async () => {
    if (!user?.id || state !== "idle" || applied) return;
    setState("loading");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const recommendations = extractRecommendations(analysisText);
      if (!recommendations) throw new Error("Could not extract recommendations");

      // Get timezone
      let clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data: prof } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.timezone) clientTimezone = prof.timezone;

      const now = new Date();
      const res = await supabase.functions.invoke("generate-plans", {
        body: {
          plan_type: "content_plan",
          background: true,
          cmo_override: recommendations,
          trigger: "cmo_chat",
          client_now_minutes: now.getHours() * 60 + now.getMinutes(),
          client_day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()],
          client_timezone: clientTimezone,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message || "Plan generation failed");

      // Poll for completion
      const maxWaitMs = 360_000;
      const pollIntervalMs = 5_000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        const { data } = await (supabase as any)
          .from("profiles")
          .select("plan_generation_status")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.plan_generation_status === "complete") {
          await (supabase as any).from("profiles").update({ plan_generation_status: "idle" }).eq("id", user.id);
          break;
        }
        if (data?.plan_generation_status === "error") {
          await (supabase as any).from("profiles").update({ plan_generation_status: "idle" }).eq("id", user.id);
          throw new Error("Plan generation failed");
        }
      }

      // Update last_plan_applied_at
      await (supabase as any)
        .from("profiles")
        .update({ last_plan_applied_at: new Date().toISOString() })
        .eq("id", user.id);

      setState("done");
      setApplied(true);
      onApplied();
    } catch (e) {
      setState("idle");
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update plan",
        variant: "destructive",
      });
    }
  };

  if (!timeGate) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-card/50 p-3 space-y-2">
      {timeGate.blocked ? (
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Plan updated {timeGate.daysSince} day{timeGate.daysSince !== 1 ? "s" : ""} ago — come back in {timeGate.daysLeft} day{timeGate.daysLeft !== 1 ? "s" : ""} for fresh data
          </p>
        </div>
      ) : state === "done" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-foreground">Plan updated</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your plan has been updated based on this analysis. Head to the Playbook to see this week's posts.
          </p>
          <button
            onClick={() => navigate("/playbook")}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Go to Playbook <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5"
            onClick={handleApply}
            disabled={state === "loading" || applied}
          >
            {state === "loading" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating your plan...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Apply to my plan
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Regenerate this week's content plan using these recommendations
          </p>
        </>
      )}
    </div>
  );
}
