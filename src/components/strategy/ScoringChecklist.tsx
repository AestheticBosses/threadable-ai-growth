import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScoreItem {
  id: string;
  label: string;
  passed: boolean;
  reason: string;
}

interface ScoringChecklistProps {
  postText: string;
}

export function ScoringChecklist({ postText }: ScoringChecklistProps) {
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasScored, setHasScored] = useState(false);

  const runScore = useCallback(async () => {
    if (!postText?.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-post`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text: postText }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Scoring failed" }));
        throw new Error(err.error || "Scoring failed");
      }

      const data = await res.json();
      setScores(data.scores || []);
      setTotal(data.total ?? 0);
      setHasScored(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to score post");
    } finally {
      setLoading(false);
    }
  }, [postText]);

  useEffect(() => {
    if (postText?.trim()) {
      runScore();
    }
  }, []); // Run on mount only

  const scoreColor = total >= 4 ? "text-emerald-500" : "text-yellow-500";
  const progressColor = total >= 4 ? "bg-emerald-500" : "bg-yellow-500";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Post Scorer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-evaluated against your performance data.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runScore}
          disabled={loading || !postText?.trim()}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? "Scoring..." : "Re-score"}
        </Button>
      </div>

      <Card>
        <CardContent className="py-5 space-y-4">
          {loading && !hasScored && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Analyzing post against your data...</span>
            </div>
          )}

          {hasScored && (
            <>
              {/* Score bar */}
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${scoreColor}`}>{total}/6</span>
                <div className="flex-1">
                  <Progress
                    value={(total / 6) * 100}
                    className="h-2.5"
                  />
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    total >= 4
                      ? "text-emerald-500 border-emerald-500/30"
                      : "text-yellow-500 border-yellow-500/30"
                  }`}
                >
                  {total >= 4 ? "Ready to publish" : "Below threshold"}
                </Badge>
              </div>

              {/* Criteria rows */}
              <div className="space-y-2">
                {scores.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    {item.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !hasScored && postText?.trim() && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Click "Re-score" to evaluate this post.</p>
            </div>
          )}

          {!postText?.trim() && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No post text to score.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
