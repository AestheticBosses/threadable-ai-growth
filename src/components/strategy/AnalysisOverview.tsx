import { useState, useMemo } from "react";
import { usePostsAnalyzed, type AnalyzedPost, type Archetype } from "@/hooks/usePostsAnalyzed";
import { getMockThreads, getOverviewKPIs, getArchetypeStats, getDistributionInsight } from "@/lib/mockAnalysisData";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ARCHETYPE_DB_TO_DISPLAY: Record<string, Archetype> = {
  vault_drop: "Vault Drop",
  truth: "Truth Bomb",
  hot_take: "Hot Take",
  window: "Window",
};

const ARCHETYPE_COLORS: Record<string, string> = {
  "Vault Drop": "border-violet-500/50",
  "Truth Bomb": "border-emerald-500/50",
  "Hot Take": "border-yellow-500/50",
  "Window": "border-blue-500/50",
};

const ARCHETYPE_LABEL_COLORS: Record<string, string> = {
  "Vault Drop": "text-violet-400",
  "Truth Bomb": "text-emerald-400",
  "Hot Take": "text-yellow-400",
  "Window": "text-blue-400",
};

type SortKey = "index" | "title" | "views" | "likes" | "follows" | "replies" | "reposts" | "engRate";

interface EnrichedPost {
  index: number;
  title: string;
  views: number;
  likes: number;
  follows: number;
  replies: number;
  reposts: number;
  engRate: number;
  archetype: Archetype;
}

function enrichPosts(posts: AnalyzedPost[]): EnrichedPost[] {
  return posts.map((p, i) => ({
    index: i + 1,
    title: (p.text_content ?? "").slice(0, 80) || "(no text)",
    views: p.views ?? 0,
    likes: p.likes ?? 0,
    follows: (p as any).follows ?? 0,
    replies: p.replies ?? 0,
    reposts: p.reposts ?? 0,
    engRate: p.engagement_rate ?? 0,
    archetype: ARCHETYPE_DB_TO_DISPLAY[(p as any).archetype ?? "truth"] ?? "Truth Bomb",
  }));
}

function computeKPIs(posts: EnrichedPost[]) {
  const n = posts.length;
  if (n === 0) return null;
  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const totalFollows = posts.reduce((s, p) => s + p.follows, 0);
  const totalReposts = posts.reduce((s, p) => s + p.reposts, 0);
  const sortedViews = [...posts].sort((a, b) => a.views - b.views);
  const medianViews = n % 2 === 0
    ? Math.round((sortedViews[n / 2 - 1].views + sortedViews[n / 2].views) / 2)
    : sortedViews[Math.floor(n / 2)].views;
  const topPost = [...posts].sort((a, b) => b.engRate - a.engRate)[0];

  return {
    totalPosts: n,
    avgViews: Math.round(totalViews / n),
    medianViews,
    totalFollows,
    followRate: totalViews > 0 ? parseFloat(((totalFollows / totalViews) * 100).toFixed(2)) : 0,
    totalReposts,
    repostRate: totalViews > 0 ? parseFloat(((totalReposts / totalViews) * 100).toFixed(2)) : 0,
    topEngRate: topPost.engRate,
    topEngPost: topPost.title.slice(0, 40) + "...",
  };
}

function computeArchetypeStats(posts: EnrichedPost[]) {
  const archetypes: Archetype[] = ["Vault Drop", "Truth Bomb", "Hot Take", "Window"];
  return archetypes.map((archetype) => {
    const group = posts.filter((p) => p.archetype === archetype);
    const n = group.length;
    if (n === 0) return { archetype, count: 0, avgViews: 0, avgLikes: 0, avgFollows: 0, avgReposts: 0, medianViews: 0, followRate: 0 };
    const sorted = [...group].sort((a, b) => a.views - b.views);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1].views + sorted[n / 2].views) / 2 : sorted[Math.floor(n / 2)].views;
    const totalViews = group.reduce((s, p) => s + p.views, 0);
    const totalFollows = group.reduce((s, p) => s + p.follows, 0);
    return {
      archetype,
      count: n,
      avgViews: Math.round(totalViews / n),
      avgLikes: Math.round(group.reduce((s, p) => s + p.likes, 0) / n),
      avgFollows: Math.round(totalFollows / n),
      avgReposts: Math.round(group.reduce((s, p) => s + p.reposts, 0) / n),
      medianViews: Math.round(median),
      followRate: totalViews > 0 ? parseFloat(((totalFollows / totalViews) * 100).toFixed(2)) : 0,
    };
  });
}

export function AnalysisOverview() {
  const { data: rawPosts, isLoading } = usePostsAnalyzed();
  const useReal = (rawPosts?.length ?? 0) > 0;

  const enriched = useMemo(() => useReal ? enrichPosts(rawPosts!) : null, [rawPosts, useReal]);
  const kpis = useMemo(() => useReal && enriched ? computeKPIs(enriched) : null, [enriched, useReal]);
  const archetypeStats = useMemo(() => useReal && enriched ? computeArchetypeStats(enriched) : null, [enriched, useReal]);

  // Mock fallbacks
  const mockKpis = useMemo(() => useReal ? null : getOverviewKPIs(), [useReal]);
  const mockArchetypeStats = useMemo(() => useReal ? null : getArchetypeStats(), [useReal]);
  const mockDist = useMemo(() => useReal ? null : getDistributionInsight(), [useReal]);
  const mockThreads = useMemo(() => useReal ? null : getMockThreads(), [useReal]);

  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const items = useReal ? enriched! : (mockThreads ?? []).map((t, i) => ({
      index: t.id,
      title: t.title,
      views: t.views,
      likes: t.likes,
      follows: t.follows,
      replies: t.comments,
      reposts: t.reposts,
      engRate: t.engRate,
      archetype: t.archetype as Archetype,
    }));
    return [...items].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? (av as string).localeCompare(bv as unknown as string) : (bv as unknown as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [enriched, mockThreads, sortKey, sortAsc, useReal]);

  // Compute distribution insight from real data
  const distInsight = useMemo(() => {
    if (!useReal || !enriched || enriched.length < 3) return mockDist;
    const sortedByViews = [...enriched].sort((a, b) => b.views - a.views);
    const totalViews = enriched.reduce((s, p) => s + p.views, 0);
    const top3Views = sortedByViews.slice(0, 3).reduce((s, p) => s + p.views, 0);
    const top3Pct = totalViews > 0 ? Math.round((top3Views / totalViews) * 100) : 0;
    const sortedAsc = [...enriched].sort((a, b) => a.views - b.views);
    const n = sortedAsc.length;
    const median = n % 2 === 0 ? Math.round((sortedAsc[n / 2 - 1].views + sortedAsc[n / 2].views) / 2) : sortedAsc[Math.floor(n / 2)].views;
    return { top3Pct, median };
  }, [useReal, enriched, mockDist]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortKey) return null;
    return sortAsc ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />;
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
  }

  const displayKpis = useReal ? kpis! : mockKpis!;
  const displayArchetypes = useReal ? archetypeStats! : mockArchetypeStats!;

  const kpiCards = [
    { label: "Total Posts", value: displayKpis.totalPosts, sub: "Analyzed" },
    { label: "Avg Views", value: (displayKpis as any).avgViews?.toLocaleString(), sub: "per post" },
    { label: "Median Views", value: (displayKpis as any).medianViews?.toLocaleString(), sub: "center value" },
    { label: "Total Follows", value: ((displayKpis as any).totalFollows ?? 0).toLocaleString(), sub: `${(displayKpis as any).followRate ?? 0}% rate` },
    { label: "Total Reposts", value: ((displayKpis as any).totalReposts ?? 0).toLocaleString(), sub: `${(displayKpis as any).repostRate ?? 0}% rate` },
    { label: "Top Eng Rate", value: `${(displayKpis as any).topEngRate}%`, sub: (displayKpis as any).topEngPost },
  ];

  const columns: { key: SortKey; label: string }[] = [
    { key: "index", label: "#" },
    { key: "title", label: "Post" },
    { key: "views", label: "Views" },
    { key: "likes", label: "Likes" },
    { key: "follows", label: "Follows" },
    { key: "replies", label: "Replies" },
    { key: "reposts", label: "Reposts" },
    { key: "engRate", label: "Eng%" },
  ];

  return (
    <div className="space-y-8">
      {useReal && (
        <p className="text-xs text-emerald-400 font-medium">✅ Showing real data from your Threads account</p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-lg border border-[hsl(260,20%,20%)] bg-[hsl(260,15%,10%)] p-4">
            <p className="text-xs text-[hsl(260,10%,55%)] font-medium uppercase tracking-wider">{k.label}</p>
            <p className="text-2xl font-bold font-mono text-[hsl(0,0%,95%)] mt-1">{k.value}</p>
            <p className="text-xs text-[hsl(260,10%,45%)] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Archetype Performance */}
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)] mb-4">Archetype Performance Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayArchetypes.map((a: any) => (
            <div key={a.archetype} className={`rounded-lg border-2 ${ARCHETYPE_COLORS[a.archetype]} bg-[hsl(260,15%,8%)] p-4`}>
              <h4 className={`text-sm font-bold ${ARCHETYPE_LABEL_COLORS[a.archetype]} mb-3`}>{a.archetype}</h4>
              <div className="space-y-1.5 text-xs">
                {[
                  ["Posts", a.count],
                  ["Avg Views", (a.avgViews ?? 0).toLocaleString()],
                  ["Avg Likes", (a.avgLikes ?? 0).toLocaleString()],
                  ["Avg Follows", (a.avgFollows ?? 0).toLocaleString()],
                  ["Avg Reposts", (a.avgReposts ?? 0)],
                  ["Median Views", (a.medianViews ?? 0).toLocaleString()],
                  ["Follow Rate", `${a.followRate ?? 0}%`],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-[hsl(260,10%,50%)]">{label}</span>
                    <span className="font-mono font-bold text-[hsl(0,0%,90%)]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sortable Table */}
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)] mb-4">All Analyzed Posts</h3>
        <div className="overflow-x-auto rounded-lg border border-[hsl(260,20%,18%)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[hsl(260,15%,12%)] border-b border-[hsl(260,20%,18%)]">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className="px-3 py-2.5 text-left font-semibold text-[hsl(260,10%,55%)] uppercase tracking-wider cursor-pointer hover:text-[hsl(260,80%,70%)] transition-colors whitespace-nowrap"
                  >
                    {c.label} <SortIcon col={c.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.index + "-" + i} className={`border-b border-[hsl(260,20%,14%)] ${i % 2 === 0 ? "bg-[hsl(260,15%,7%)]" : "bg-[hsl(260,15%,9%)]"} hover:bg-[hsl(260,20%,15%)] transition-colors`}>
                  <td className="px-3 py-2 font-mono text-[hsl(260,10%,45%)]">{t.index}</td>
                  <td className="px-3 py-2 text-[hsl(0,0%,88%)] max-w-[300px] truncate">{t.title}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.views.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.likes.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.follows.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.replies}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.reposts}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(142,71%,60%)]">{t.engRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Insight */}
      {distInsight && (
        <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-5">
          <h4 className="text-sm font-bold text-emerald-400 mb-2">📊 Distribution Insight — Power Law</h4>
          <p className="text-sm text-[hsl(0,0%,80%)] leading-relaxed">
            Your top 3 posts account for <span className="font-bold font-mono text-emerald-400">{distInsight.top3Pct}%</span> of all views.
            Your median is <span className="font-bold font-mono text-emerald-400">{distInsight.median.toLocaleString()}</span> views.
            This is <strong>NORMAL</strong>. The strategy is to post enough that your breakout posts carry the weight.
          </p>
        </div>
      )}
    </div>
  );
}
