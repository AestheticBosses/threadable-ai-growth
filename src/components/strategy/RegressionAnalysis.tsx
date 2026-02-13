import { useState, useMemo } from "react";
import { useRegressionInsights, type RegressionInsight } from "@/hooks/useStrategyData";
import { usePostsAnalyzed, type AnalyzedPost } from "@/hooks/usePostsAnalyzed";
import { computeCorrelations as computeMockCorrelations } from "@/lib/mockAnalysisData";
import type { CorrelationRow } from "@/lib/mockAnalysisData";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Sparkles } from "lucide-react";

/* ── Metric color coding ── */
const METRIC_COLORS: Record<string, string> = {
  views: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  likes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  reposts: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  replies: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  moderate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  weak: "bg-muted text-muted-foreground border-border",
};

/* ── Parse comparison numbers from evidence text ── */
function parseComparison(evidence: string): { withVal: string; withoutVal: string; multiplier: string; metric: string } | null {
  // Pattern: "X,XXX views with ... Y,YYY without" or "avg X,XXX ... avg Y,YYY"
  const numPattern = /(\d[\d,]*\.?\d*)\s*(views|likes|reposts|replies|%|engagement)/gi;
  const matches = [...evidence.matchAll(numPattern)];
  if (matches.length >= 2) {
    const a = parseFloat(matches[0][1].replace(/,/g, ""));
    const b = parseFloat(matches[1][1].replace(/,/g, ""));
    if (a > 0 && b > 0) {
      const high = Math.max(a, b);
      const low = Math.min(a, b);
      const mult = low > 0 ? (high / low).toFixed(1) : "∞";
      return {
        withVal: high.toLocaleString(),
        withoutVal: low.toLocaleString(),
        multiplier: `${mult}x`,
        metric: matches[0][2].toLowerCase(),
      };
    }
  }
  return null;
}

/* ── AI Insight Card ── */
function InsightCard({ insight }: { insight: RegressionInsight }) {
  const comparison = parseComparison(insight.evidence);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{insight.category}</span>
        <div className="flex gap-1.5">
          <Badge variant="outline" className={`text-[10px] ${METRIC_COLORS[insight.metric_impacted] ?? "bg-muted text-muted-foreground border-border"}`}>
            {insight.metric_impacted}
          </Badge>
          <Badge variant="outline" className={`text-[10px] ${STRENGTH_COLORS[insight.strength] ?? STRENGTH_COLORS.weak}`}>
            {insight.strength}
          </Badge>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">{insight.insight}</p>

      {/* Comparison boxes */}
      {comparison && (
        <div className="flex items-center gap-3">
          <div className="flex gap-2 flex-1">
            <div className="flex-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-center">
              <p className="text-sm font-bold text-foreground">{comparison.withVal}</p>
              <p className="text-[10px] text-muted-foreground">{comparison.metric}</p>
              <p className="text-[10px] text-primary font-medium">w/ pattern</p>
            </div>
            <div className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-center">
              <p className="text-sm font-bold text-foreground">{comparison.withoutVal}</p>
              <p className="text-[10px] text-muted-foreground">{comparison.metric}</p>
              <p className="text-[10px] text-muted-foreground">without</p>
            </div>
          </div>
          <span className="text-sm font-bold text-emerald-400">{comparison.multiplier} better</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">{insight.evidence}</p>
      {insight.recommendation && (
        <p className="text-xs text-primary font-medium">→ {insight.recommendation}</p>
      )}
    </div>
  );
}

/* ── Raw Pearson table (collapsible) ── */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : parseFloat((num / den).toFixed(3));
}

function computeRealCorrelations(posts: AnalyzedPost[]): CorrelationRow[] {
  const variables: { key: string; label: string; extract: (p: AnalyzedPost) => number }[] = [
    { key: "has_namedrop", label: "Authority Name-Drop", extract: (p) => (p as any).has_namedrop ? 1 : 0 },
    { key: "has_steps", label: "Educational / Steps Format", extract: (p) => (p as any).has_steps ? 1 : 0 },
    { key: "has_dollar_amount", label: "Dollar Amount in Hook", extract: (p) => (p as any).has_dollar_amount ? 1 : 0 },
    { key: "has_vulnerability", label: "Vulnerability / Personal", extract: (p) => (p as any).has_vulnerability ? 1 : 0 },
    { key: "has_relatability", label: "Universal Relatability", extract: (p) => (p as any).has_relatability ? 1 : 0 },
    { key: "is_short_form", label: "Short One-Liner", extract: (p) => (p as any).is_short_form ? 1 : 0 },
    { key: "has_visual", label: "Vivid Visual / Scene", extract: (p) => (p as any).has_visual ? 1 : 0 },
    { key: "has_profanity", label: "Profanity", extract: (p) => (p as any).has_profanity ? 1 : 0 },
    { key: "has_controversy", label: "Controversy / Hot Take", extract: (p) => (p as any).has_controversy ? 1 : 0 },
    { key: "emotion_count", label: "2+ Emotional Triggers", extract: (p) => ((p as any).emotion_count ?? 0) >= 2 ? 1 : 0 },
  ];
  const views = posts.map((p) => p.views ?? 0);
  const likes = posts.map((p) => p.likes ?? 0);
  const reposts = posts.map((p) => p.reposts ?? 0);
  const likeRate = posts.map((p) => (p.likes ?? 0) / Math.max(p.views ?? 1, 1));
  const repostRate = posts.map((p) => (p.reposts ?? 0) / Math.max(p.views ?? 1, 1));
  const engRate = posts.map((p) => ((p.likes ?? 0) + (p.replies ?? 0) + (p.reposts ?? 0)) / Math.max(p.views ?? 1, 1));
  return variables.map((v) => {
    const xs = posts.map(v.extract);
    const count = xs.filter((x) => x > 0).length;
    return { variable: v.label, rViews: pearson(xs, views), rLikes: pearson(xs, likes), rReposts: pearson(xs, reposts), rLikeRate: pearson(xs, likeRate), rRepostRate: pearson(xs, repostRate), rEngRate: pearson(xs, engRate), count };
  });
}

function corrColor(r: number): string {
  if (r >= 0.5) return "text-emerald-400 bg-emerald-500/15";
  if (r >= 0.3) return "text-emerald-300 bg-emerald-500/8";
  if (r >= 0.1) return "text-yellow-400 bg-yellow-500/8";
  if (r > -0.1) return "text-muted-foreground";
  if (r > -0.3) return "text-orange-400 bg-orange-500/8";
  return "text-red-400 bg-red-500/10";
}

function CorrCell({ value }: { value: number }) {
  return (
    <td className={`px-3 py-2 font-mono text-xs text-center ${corrColor(value)}`}>
      {value > 0 ? "+" : ""}{value.toFixed(2)}
    </td>
  );
}

function RawCorrelationsTable() {
  const { data: posts, isLoading } = usePostsAnalyzed();
  const [open, setOpen] = useState(false);
  const useReal = (posts?.length ?? 0) > 0;

  const correlations = useMemo(() => {
    if (useReal && posts) return computeRealCorrelations(posts);
    return computeMockCorrelations();
  }, [posts, useReal]);

  const cols = [
    { key: "rViews", label: "r(Views)" },
    { key: "rLikes", label: "r(Likes)" },
    { key: "rReposts", label: "r(Reposts)" },
    { key: "rLikeRate", label: "r(Like%)" },
    { key: "rRepostRate", label: "r(Repost%)" },
    { key: "rEngRate", label: "r(Eng%)" },
  ];

  if (isLoading) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        Raw Pearson Correlations
        <span className="text-xs text-muted-foreground ml-1">
          ({useReal ? `${posts!.length} posts` : "mock data"})
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto rounded-lg border border-border mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Variable</th>
                {cols.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider">Count</th>
              </tr>
            </thead>
            <tbody>
              {correlations.map((row, i) => (
                <tr key={row.variable} className={`border-b border-border ${i % 2 === 0 ? "bg-card/50" : "bg-card"}`}>
                  <td className="px-3 py-2 text-foreground font-medium whitespace-nowrap">{row.variable}</td>
                  {cols.map((c) => (
                    <CorrCell key={c.key} value={(row as any)[c.key] as number ?? 0} />
                  ))}
                  <td className="px-3 py-2 font-mono text-center text-muted-foreground">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Main Component ── */
export function RegressionAnalysis() {
  const { data: regressionData, isLoading } = useRegressionInsights();
  const insights = regressionData?.insights;

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;

  return (
    <div className="space-y-8">
      {/* AI-Powered Insights */}
      {insights && insights.length > 0 ? (
        <>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI-Powered Regression Insights</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Deep analysis of what drives your content performance, powered by Claude.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <p className="text-foreground font-medium">No regression insights yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Click "🧠 Run Full Analysis" on the Dashboard to get AI-powered regression insights that go beyond simple correlations.
          </p>
        </div>
      )}

      {/* Raw Correlations (always available as collapsible) */}
      <RawCorrelationsTable />
    </div>
  );
}
