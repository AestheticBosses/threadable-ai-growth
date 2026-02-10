import { useMemo } from "react";
import { usePostsAnalyzed, type AnalyzedPost } from "@/hooks/usePostsAnalyzed";
import { getMockThreads } from "@/lib/mockAnalysisData";
import { Skeleton } from "@/components/ui/skeleton";

function BarChart({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max((value / max) * 100, 2);
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-5 bg-[hsl(260,15%,12%)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-[hsl(0,0%,90%)] w-14 text-right">{value.toFixed(2)}%</span>
    </div>
  );
}

interface PostRow {
  id: string | number;
  title: string;
  views: number;
  follows: number;
  reposts: number;
  replies: number;
  followRate: number;
}

function mapRealPosts(posts: AnalyzedPost[]): PostRow[] {
  return posts.map((p) => {
    const views = p.views ?? 0;
    const follows = (p as any).follows ?? 0;
    return {
      id: p.id,
      title: (p.text_content ?? "").slice(0, 60) || "(no text)",
      views,
      follows,
      reposts: p.reposts ?? 0,
      replies: p.replies ?? 0,
      followRate: views > 0 ? (follows / views) * 100 : 0,
    };
  });
}

function mapMockPosts(): PostRow[] {
  return getMockThreads().map((t) => ({
    id: t.id,
    title: t.title,
    views: t.views,
    follows: t.follows,
    reposts: t.reposts,
    replies: t.comments,
    followRate: t.followRate,
  }));
}

export function GrowthSignals() {
  const { data: rawPosts, isLoading } = usePostsAnalyzed();
  const useReal = (rawPosts?.length ?? 0) > 0;

  const rows = useMemo(() => useReal ? mapRealPosts(rawPosts!) : mapMockPosts(), [rawPosts, useReal]);

  // Filter out posts with < 100 views for rankings
  const qualifiedRows = useMemo(() => rows.filter((r) => r.views >= 100), [rows]);

  const topFollowRate = useMemo(() => {
    return [...qualifiedRows].sort((a, b) => b.followRate - a.followRate).slice(0, 10);
  }, [qualifiedRows]);

  const topViralCoeff = useMemo(() => {
    return qualifiedRows
      .map((t) => ({ ...t, viralCoeff: t.views > 0 ? ((t.reposts + (t.replies * 0.3)) / t.views) * 100 : 0 }))
      .sort((a, b) => b.viralCoeff - a.viralCoeff)
      .slice(0, 10);
  }, [qualifiedRows]);

  const anomaly = useMemo(() => {
    if (rows.length < 3) return null;
    const sorted = [...rows].sort((a, b) => a.views - b.views);
    const medianViews = sorted[Math.floor(rows.length / 2)].views;
    return rows
      .filter((t) => t.views < medianViews && t.followRate > 1)
      .sort((a, b) => b.followRate - a.followRate)[0] ?? null;
  }, [rows]);

  const maxFollowRate = topFollowRate[0]?.followRate ?? 1;
  const maxViralCoeff = topViralCoeff[0]?.viralCoeff ?? 1;

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)]">Growth Signal Rankings</h3>
        <p className="text-sm text-[hsl(260,10%,50%)] mt-1">
          {useReal
            ? `Computed from ${rows.length} real posts (min 100 views for rankings). Follow conversion and viral coefficient.`
            : "Showing mock data. Fetch your real posts to see actual rankings."}
        </p>
      </div>

      {/* Follow Conversion Rate — Top 10 */}
      <div>
        <h4 className="text-sm font-bold text-violet-400 mb-4">Follow Conversion Rate (Follows ÷ Views) — Top 10</h4>
        {topFollowRate.length === 0 ? (
          <p className="text-xs text-[hsl(260,10%,45%)]">No posts with 100+ views found.</p>
        ) : (
          <div className="space-y-2">
            {topFollowRate.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-[hsl(260,10%,45%)] w-5 shrink-0">{i + 1}.</span>
                <span className="text-xs text-[hsl(0,0%,82%)] w-48 truncate shrink-0" title={t.title}>{t.title}</span>
                <BarChart value={t.followRate} max={maxFollowRate} color="bg-violet-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viral Coefficient */}
      <div>
        <h4 className="text-sm font-bold text-emerald-400 mb-4">Viral Coefficient (Reposts+Replies ÷ Views) — Top 10</h4>
        {topViralCoeff.length === 0 ? (
          <p className="text-xs text-[hsl(260,10%,45%)]">No posts with 100+ views found.</p>
        ) : (
          <div className="space-y-2">
            {topViralCoeff.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-[hsl(260,10%,45%)] w-5 shrink-0">{i + 1}.</span>
                <span className="text-xs text-[hsl(0,0%,82%)] w-48 truncate shrink-0" title={t.title}>{t.title}</span>
                <BarChart value={t.viralCoeff} max={maxViralCoeff} color="bg-emerald-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anomaly Callout */}
      {anomaly && (
        <div className="rounded-lg border-2 border-yellow-500/40 bg-yellow-500/5 p-5">
          <h4 className="text-sm font-bold text-yellow-400 mb-2">🔍 Anomaly Callout</h4>
          <p className="text-sm text-[hsl(0,0%,80%)] leading-relaxed">
            "<span className="font-medium text-[hsl(0,0%,92%)]">{anomaly.title}</span>" had only{" "}
            <span className="font-mono text-yellow-400">{anomaly.views.toLocaleString()}</span> views but a{" "}
            <span className="font-mono text-yellow-400">{anomaly.followRate.toFixed(2)}%</span> follow conversion rate.
            This confirms that <strong>niche-specific content converts better</strong> even with lower reach.
          </p>
        </div>
      )}
    </div>
  );
}
