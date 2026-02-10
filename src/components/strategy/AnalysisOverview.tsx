import { useState, useMemo } from "react";
import { getMockThreads, getOverviewKPIs, getArchetypeStats, getDistributionInsight } from "@/lib/mockAnalysisData";
import type { MockThread } from "@/lib/mockAnalysisData";
import { ArrowUp, ArrowDown } from "lucide-react";

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

type SortKey = keyof MockThread;

export function AnalysisOverview() {
  const kpis = getOverviewKPIs();
  const archetypeStats = getArchetypeStats();
  const dist = getDistributionInsight();
  const threads = getMockThreads();

  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...threads].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });
  }, [threads, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortKey) return null;
    return sortAsc ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />;
  };

  const kpiCards = [
    { label: "Total Posts", value: kpis.totalPosts, sub: "Analyzed" },
    { label: "Avg Views", value: kpis.avgViews.toLocaleString(), sub: "per thread" },
    { label: "Median Views", value: kpis.medianViews.toLocaleString(), sub: "more accurate center" },
    { label: "Total Follows", value: kpis.totalFollows.toLocaleString(), sub: `${kpis.followRate}% rate` },
    { label: "Total Reposts", value: kpis.totalReposts.toLocaleString(), sub: `${kpis.repostRate}% rate` },
    { label: "Top Eng Rate", value: `${kpis.topEngRate}%`, sub: kpis.topEngPost },
  ];

  const columns: { key: SortKey; label: string }[] = [
    { key: "id", label: "#" },
    { key: "title", label: "Thread Title" },
    { key: "views", label: "Views" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "reposts", label: "Reposts" },
    { key: "follows", label: "Follows" },
    { key: "engRate", label: "Eng%" },
    { key: "followRate", label: "Follow%" },
  ];

  return (
    <div className="space-y-8">
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

      {/* Archetype Performance Comparison */}
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)] mb-4">Archetype Performance Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {archetypeStats.map((a) => (
            <div key={a.archetype} className={`rounded-lg border-2 ${ARCHETYPE_COLORS[a.archetype]} bg-[hsl(260,15%,8%)] p-4`}>
              <h4 className={`text-sm font-bold ${ARCHETYPE_LABEL_COLORS[a.archetype]} mb-3`}>{a.archetype}</h4>
              <div className="space-y-1.5 text-xs">
                {[
                  ["Threads", a.count],
                  ["Avg Views", a.avgViews.toLocaleString()],
                  ["Avg Likes", a.avgLikes.toLocaleString()],
                  ["Avg Follows", a.avgFollows],
                  ["Avg Reposts", a.avgReposts],
                  ["Median Views", a.medianViews.toLocaleString()],
                  ["Follow Rate", `${a.followRate}%`],
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
                <tr key={t.id} className={`border-b border-[hsl(260,20%,14%)] ${i % 2 === 0 ? "bg-[hsl(260,15%,7%)]" : "bg-[hsl(260,15%,9%)]"} hover:bg-[hsl(260,20%,15%)] transition-colors`}>
                  <td className="px-3 py-2 font-mono text-[hsl(260,10%,45%)]">{t.id}</td>
                  <td className="px-3 py-2 text-[hsl(0,0%,88%)] max-w-[300px] truncate">{t.title}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.views.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.likes.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.comments}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.reposts}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(0,0%,90%)]">{t.follows}</td>
                  <td className="px-3 py-2 font-mono text-[hsl(142,71%,60%)]">{t.engRate}%</td>
                  <td className="px-3 py-2 font-mono text-[hsl(260,80%,70%)]">{t.followRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Insight */}
      <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-5">
        <h4 className="text-sm font-bold text-emerald-400 mb-2">📊 Distribution Insight — Power Law</h4>
        <p className="text-sm text-[hsl(0,0%,80%)] leading-relaxed">
          Your top 3 threads account for <span className="font-bold font-mono text-emerald-400">{dist.top3Pct}%</span> of all views.
          Your median is <span className="font-bold font-mono text-emerald-400">{dist.median.toLocaleString()}</span> views.
          This is <strong>NORMAL</strong>. The strategy is to post enough that your breakout threads carry the weight.
        </p>
      </div>
    </div>
  );
}
