import { useState, useMemo } from "react";
import { usePostsAnalyzed, type AnalyzedPost, type Archetype } from "@/hooks/usePostsAnalyzed";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { DateRange } from "@/hooks/useDashboardData";

const ARCHETYPE_DB_TO_DISPLAY: Record<string, Archetype> = {
  vault_drop: "Vault Drop",
  truth: "Truth Bomb",
  hot_take: "Hot Take",
  window: "Window",
};



type SortKey = "index" | "title" | "views" | "likes" | "replies" | "reposts" | "engRate";

interface EnrichedPost {
  index: number;
  title: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  engRate: number;
  archetype: Archetype;
  postedAt: string | null;
}

interface AnalysisOverviewProps {
  range?: DateRange;
  customFrom?: Date;
  customTo?: Date;
}

function enrichPosts(posts: AnalyzedPost[]): EnrichedPost[] {
  return posts.map((p, i) => ({
    index: i + 1,
    title: (p.text_content ?? "").slice(0, 80) || "(no text)",
    views: p.views ?? 0,
    likes: p.likes ?? 0,
    replies: p.replies ?? 0,
    reposts: p.reposts ?? 0,
    engRate: p.engagement_rate ?? 0,
    archetype: ARCHETYPE_DB_TO_DISPLAY[(p as any).archetype ?? "truth"] ?? "Truth Bomb",
    postedAt: p.posted_at,
  }));
}

function filterByRange(posts: EnrichedPost[], range?: DateRange, customFrom?: Date, customTo?: Date): EnrichedPost[] {
  if (!range || range === "all") return posts;
  const now = new Date();
  let start: Date;
  if (range === "custom" && customFrom) {
    start = customFrom;
    const end = customTo ?? now;
    return posts.filter((p) => {
      if (!p.postedAt) return false;
      const d = new Date(p.postedAt);
      return d >= start && d <= end;
    });
  }
  const days = parseInt(range, 10);
  start = new Date(now.getTime() - days * 86400000);
  return posts.filter((p) => {
    if (!p.postedAt) return false;
    return new Date(p.postedAt) >= start;
  });
}


export function AnalysisOverview({ range, customFrom, customTo }: AnalysisOverviewProps) {
  const { data: rawPosts, isLoading } = usePostsAnalyzed();

  const enriched = useMemo(() => rawPosts && rawPosts.length > 0 ? enrichPosts(rawPosts) : [], [rawPosts]);
  const filtered = useMemo(() => filterByRange(enriched, range, customFrom, customTo), [enriched, range, customFrom, customTo]);
  

  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filtered, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortKey) return null;
    return sortAsc ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', height: '80px' }} />
        ))}
      </div>
    );
  }

  if (enriched.length === 0) return null;

  const columns: { key: SortKey; label: string }[] = [
    { key: "index", label: "#" },
    { key: "title", label: "Post" },
    { key: "views", label: "Views" },
    { key: "likes", label: "Likes" },
    { key: "replies", label: "Replies" },
    { key: "reposts", label: "Reposts" },
    { key: "engRate", label: "Eng%" },
  ];

  return (
    <div className="space-y-6">
      {/* All Analyzed Posts Table */}
      <div>
        <h3 style={{ color: '#e8e4de', fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          All Analyzed Posts
          <span style={{ color: '#8a8680', fontSize: '12px', fontWeight: 400, marginLeft: '8px' }}>
            {filtered.length} post{filtered.length !== 1 ? "s" : ""}
          </span>
        </h3>
        <div className="overflow-x-auto" style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className="px-3 py-2.5 text-left cursor-pointer hover:text-purple-400 transition-colors whitespace-nowrap"
                    style={{ color: '#8a8680', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}
                  >
                    {c.label} <SortIcon col={c.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr
                  key={t.index + "-" + i}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  <td className="px-3 py-2" style={{ color: '#8a8680', fontFamily: "'Space Mono', monospace" }}>{t.index}</td>
                  <td className="px-3 py-2 max-w-[300px] truncate" style={{ color: '#e8e4de' }}>{t.title}</td>
                  <td className="px-3 py-2" style={{ color: '#e8e4de', fontFamily: "'Space Mono', monospace" }}>{t.views.toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ color: '#e8e4de', fontFamily: "'Space Mono', monospace" }}>{t.likes.toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ color: '#e8e4de', fontFamily: "'Space Mono', monospace" }}>{t.replies}</td>
                  <td className="px-3 py-2" style={{ color: '#e8e4de', fontFamily: "'Space Mono', monospace" }}>{t.reposts}</td>
                  <td className="px-3 py-2" style={{ color: '#34d399', fontFamily: "'Space Mono', monospace" }}>{t.engRate}%</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center" style={{ color: '#8a8680' }}>
                    No posts in this date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Insight */}
      {filtered.length >= 3 && (() => {
        const sortedByViews = [...filtered].sort((a, b) => b.views - a.views);
        const totalViews = filtered.reduce((s, p) => s + p.views, 0);
        const top3Views = sortedByViews.slice(0, 3).reduce((s, p) => s + p.views, 0);
        const top3Pct = totalViews > 0 ? Math.round((top3Views / totalViews) * 100) : 0;
        const sortedAsc = [...filtered].sort((a, b) => a.views - b.views);
        const n = sortedAsc.length;
        const median = n % 2 === 0 ? Math.round((sortedAsc[n / 2 - 1].views + sortedAsc[n / 2].views) / 2) : sortedAsc[Math.floor(n / 2)].views;
        return (
          <div style={{ border: '2px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.05)', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>📊 Distribution Insight — Power Law</h4>
            <p style={{ fontSize: '13px', color: '#c4c0ba', lineHeight: 1.6 }}>
              Your top 3 posts account for <span style={{ fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#34d399' }}>{top3Pct}%</span> of all views.
              Your median is <span style={{ fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#34d399' }}>{median.toLocaleString()}</span> views.
              This is <strong>NORMAL</strong>. The strategy is to post enough that your breakout posts carry the weight.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
