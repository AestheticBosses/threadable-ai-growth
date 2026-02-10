import { useMemo } from "react";
import { usePostsAnalyzed, type AnalyzedPost } from "@/hooks/usePostsAnalyzed";
import { computeCorrelations as computeMockCorrelations } from "@/lib/mockAnalysisData";
import type { CorrelationRow } from "@/lib/mockAnalysisData";
import { Skeleton } from "@/components/ui/skeleton";

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
    { key: "has_question", label: "Has Question", extract: (p) => p.has_question ? 1 : 0 },
    { key: "has_credibility_marker", label: "Authority Name-Drop", extract: (p) => p.has_credibility_marker ? 1 : 0 },
    { key: "has_emoji", label: "Has Emoji", extract: (p) => p.has_emoji ? 1 : 0 },
    { key: "has_hashtag", label: "Has Hashtag", extract: (p) => p.has_hashtag ? 1 : 0 },
    { key: "has_url", label: "Has URL", extract: (p) => p.has_url ? 1 : 0 },
    { key: "starts_with_number", label: "Starts With Number", extract: (p) => p.starts_with_number ? 1 : 0 },
    { key: "word_count", label: "Word Count", extract: (p) => p.word_count ?? 0 },
    { key: "char_count", label: "Char Count", extract: (p) => p.char_count ?? 0 },
  ];

  const views = posts.map((p) => p.views ?? 0);
  const likes = posts.map((p) => p.likes ?? 0);
  const reposts = posts.map((p) => p.reposts ?? 0);
  const likeRate = posts.map((p) => (p.likes ?? 0) / Math.max(p.views ?? 1, 1));
  const repostRate = posts.map((p) => (p.reposts ?? 0) / Math.max(p.views ?? 1, 1));

  return variables.map((v) => {
    const xs = posts.map(v.extract);
    const count = xs.filter((x) => x > 0).length;
    return {
      variable: v.label,
      rViews: pearson(xs, views),
      rLikes: pearson(xs, likes),
      rReposts: pearson(xs, reposts),
      rFollows: 0, // no follows column in posts_analyzed
      rLikeRate: pearson(xs, likeRate),
      rRepostRate: pearson(xs, repostRate),
      rFollowRate: 0,
      count,
    };
  });
}

function corrColor(r: number): string {
  if (r >= 0.5) return "text-emerald-400 bg-emerald-500/15";
  if (r >= 0.3) return "text-emerald-300 bg-emerald-500/8";
  if (r >= 0.1) return "text-yellow-400 bg-yellow-500/8";
  if (r > -0.1) return "text-[hsl(260,10%,50%)]";
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

export function RegressionAnalysis() {
  const { data: posts, isLoading } = usePostsAnalyzed();
  const useReal = (posts?.length ?? 0) > 0;

  const correlations = useMemo(() => {
    if (useReal && posts) return computeRealCorrelations(posts);
    return computeMockCorrelations();
  }, [posts, useReal]);

  const topPositive = useMemo(() => {
    const all: { variable: string; metric: string; value: number }[] = [];
    correlations.forEach((c) => {
      all.push({ variable: c.variable, metric: "Views", value: c.rViews });
      all.push({ variable: c.variable, metric: "Likes", value: c.rLikes });
      all.push({ variable: c.variable, metric: "Reposts", value: c.rReposts });
    });
    return all.sort((a, b) => b.value - a.value).slice(0, 4);
  }, [correlations]);

  const negatives = useMemo(() => {
    const all: { variable: string; metric: string; value: number }[] = [];
    correlations.forEach((c) => {
      all.push({ variable: c.variable, metric: "Views", value: c.rViews });
      all.push({ variable: c.variable, metric: "Likes", value: c.rLikes });
    });
    return all.sort((a, b) => a.value - b.value).slice(0, 4);
  }, [correlations]);

  const cols: { key: keyof CorrelationRow; label: string }[] = [
    { key: "rViews", label: "r(Views)" },
    { key: "rLikes", label: "r(Likes)" },
    { key: "rReposts", label: "r(Reposts)" },
    { key: "rLikeRate", label: "r(Like%)" },
    { key: "rRepostRate", label: "r(Repost%)" },
  ];

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)]">Pearson Correlation Coefficients</h3>
        <p className="text-sm text-[hsl(260,10%,50%)] mt-1">
          {useReal
            ? `Real correlations computed from ${posts!.length} posts. Values range from -1 (inverse) to +1 (strong positive).`
            : "Mock correlations. Fetch your real posts to see actual data."}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[hsl(260,20%,18%)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[hsl(260,15%,12%)] border-b border-[hsl(260,20%,18%)]">
              <th className="px-3 py-2.5 text-left font-semibold text-[hsl(260,10%,55%)] uppercase tracking-wider">Variable</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-center font-semibold text-[hsl(260,10%,55%)] uppercase tracking-wider whitespace-nowrap">{c.label}</th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold text-[hsl(260,10%,55%)] uppercase tracking-wider">Count</th>
            </tr>
          </thead>
          <tbody>
            {correlations.map((row, i) => (
              <tr key={row.variable} className={`border-b border-[hsl(260,20%,14%)] ${i % 2 === 0 ? "bg-[hsl(260,15%,7%)]" : "bg-[hsl(260,15%,9%)]"}`}>
                <td className="px-3 py-2 text-[hsl(0,0%,88%)] font-medium whitespace-nowrap">{row.variable}</td>
                {cols.map((c) => (
                  <CorrCell key={c.key} value={row[c.key] as number} />
                ))}
                <td className="px-3 py-2 font-mono text-center text-[hsl(260,10%,55%)]">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-5">
          <h4 className="text-sm font-bold text-emerald-400 mb-3">✅ Strongest Positive Drivers</h4>
          <ul className="space-y-2">
            {topPositive.map((t, i) => (
              <li key={i} className="text-sm text-[hsl(0,0%,80%)]">
                <span className="font-medium text-[hsl(0,0%,92%)]">{t.variable}</span>
                <span className="text-[hsl(260,10%,50%)]"> → </span>
                <span className="font-mono text-emerald-400">r={t.value > 0 ? "+" : ""}{t.value.toFixed(2)}</span>
                <span className="text-[hsl(260,10%,50%)]"> on {t.metric}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border-2 border-red-500/40 bg-red-500/5 p-5">
          <h4 className="text-sm font-bold text-red-400 mb-3">⚠️ Surprising Non-Factors & Negatives</h4>
          <ul className="space-y-2">
            {negatives.map((t, i) => (
              <li key={i} className="text-sm text-[hsl(0,0%,80%)]">
                <span className="font-medium text-[hsl(0,0%,92%)]">{t.variable}</span>
                <span className="text-[hsl(260,10%,50%)]"> → </span>
                <span className={`font-mono ${t.value < -0.1 ? "text-red-400" : "text-[hsl(260,10%,45%)]"}`}>
                  r={t.value > 0 ? "+" : ""}{t.value.toFixed(2)}
                </span>
                <span className="text-[hsl(260,10%,50%)]"> on {t.metric}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
