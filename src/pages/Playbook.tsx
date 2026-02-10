import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { usePlaybookData } from "@/hooks/useStrategyData";
import { useQueryClient } from "@tanstack/react-query";

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
const ARCHETYPE_LABEL_COLORS = [
  "text-violet-400",
  "text-emerald-400",
  "text-yellow-400",
  "text-blue-400",
  "text-rose-400",
];

const Playbook = () => {
  usePageTitle("Playbook", "Your validated content strategy playbook");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const { data: playbook, isLoading } = usePlaybookData();

  const handleGeneratePlaybook = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Not logged in", variant: "destructive" }); return; }
      const { data, error } = await supabase.functions.invoke("run-analysis", {
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
          body: JSON.stringify({ posts_count: 10 }),
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // No playbook yet — show generate prompt
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
            <Button
              size="lg"
              onClick={handleGeneratePlaybook}
              disabled={generating}
              className="gap-2 px-8"
            >
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {generating ? "Claude is running full analysis…" : "🧠 Run Full Analysis"}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Your Content Playbook
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Personalized strategy built from your data.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleGeneratePlaybook}
              disabled={generating}
              className="gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {generating ? "Regenerating…" : "🔄 Regenerate"}
            </Button>
            <Button
              onClick={handleGenerateContent}
              disabled={generatingContent}
              className="gap-2"
            >
              {generatingContent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generatingContent ? "Generating…" : "✨ Generate This Week's Content"}
            </Button>
          </div>
        </div>

        {/* SECTION 1: Weekly Rotation */}
        {playbook.weekly_schedule && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              7-Day Rotation
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {playbook.weekly_schedule.map((s, i) => (
                <Card key={s.day} className={`border-2 ${ARCHETYPE_BORDER_COLORS[i % ARCHETYPE_BORDER_COLORS.length]}`}>
                  <CardContent className="p-4 space-y-2">
                    <p className={`text-xs font-bold font-mono ${ARCHETYPE_LABEL_COLORS[i % ARCHETYPE_LABEL_COLORS.length]}`}>
                      {s.day.slice(0, 3).toUpperCase()}
                    </p>
                    <p className="text-lg">{s.emoji}</p>
                    <p className="text-sm font-semibold text-foreground">{s.archetype}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.notes}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 2: Pre-Post Checklist */}
        {playbook.checklist && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Pre-Post Checklist (Score 4+ Before Posting)
            </h2>
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

        {/* SECTION 3: Templates */}
        {playbook.templates && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Templates by Archetype</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playbook.templates.map((t, i) => (
                <Card key={t.archetype} className={`border-2 ${ARCHETYPE_BORDER_COLORS[i % ARCHETYPE_BORDER_COLORS.length]}`}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{t.emoji}</span>
                      <Badge className={`text-xs ${ARCHETYPE_BADGE_COLORS[i % ARCHETYPE_BADGE_COLORS.length]}`}>
                        {t.archetype}
                      </Badge>
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

        {/* SECTION 4: Rules */}
        {playbook.rules && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Rules — Validated by Your Data
            </h2>
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

        {/* SECTION 5: Generation Guidelines */}
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
    </AppLayout>
  );
};

export default Playbook;
