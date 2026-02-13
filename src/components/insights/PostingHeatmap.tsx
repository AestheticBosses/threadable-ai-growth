import { useMemo } from "react";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_SLOTS = [
  { label: "6 AM", hour: 6 },
  { label: "9 AM", hour: 9 },
  { label: "12 PM", hour: 12 },
  { label: "3 PM", hour: 15 },
  { label: "6 PM", hour: 18 },
  { label: "9 PM", hour: 21 },
];

const DAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

function getSlotIndex(hour: number): number {
  if (hour < 7.5) return 0;
  if (hour < 10.5) return 1;
  if (hour < 13.5) return 2;
  if (hour < 16.5) return 3;
  if (hour < 19.5) return 4;
  return 5;
}

export function PostingHeatmap() {
  const { data: posts } = usePostsAnalyzed();

  const { grid, maxVal, top3 } = useMemo(() => {
    const g: { total: number; count: number }[][] = Array.from({ length: 6 }, () =>
      Array.from({ length: 7 }, () => ({ total: 0, count: 0 }))
    );

    if (!posts) return { grid: g, maxVal: 0, top3: [] as [number, number][] };

    for (const p of posts) {
      const hour = p.hour_posted;
      const dow = p.day_of_week?.toLowerCase();
      if (hour == null || !dow || DAY_MAP[dow] == null) continue;
      const dayIdx = DAY_MAP[dow];
      const slotIdx = getSlotIndex(hour);
      const er = (p.engagement_rate ?? 0) * 100;
      g[slotIdx][dayIdx].total += er;
      g[slotIdx][dayIdx].count += 1;
    }

    let max = 0;
    const cells: { val: number; s: number; d: number }[] = [];
    for (let s = 0; s < 6; s++) {
      for (let d = 0; d < 7; d++) {
        const avg = g[s][d].count > 0 ? g[s][d].total / g[s][d].count : 0;
        cells.push({ val: avg, s, d });
        if (avg > max) max = avg;
      }
    }

    cells.sort((a, b) => b.val - a.val);
    const top = cells.filter((c) => c.val > 0).slice(0, 3).map((c) => [c.s, c.d] as [number, number]);

    return { grid: g, maxVal: max, top3: top };
  }, [posts]);

  const totalPosts = posts?.length ?? 0;
  if (totalPosts < 30) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Post more to unlock your best posting times heatmap</p>
        <p className="text-xs text-muted-foreground mt-1">{totalPosts}/30 posts needed</p>
      </div>
    );
  }

  const isTop3 = (s: number, d: number) => top3.some(([ts, td]) => ts === s && td === d);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h4 className="text-sm font-bold text-foreground">Best Posting Times</h4>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
          {/* Header row */}
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-[10px] text-muted-foreground text-center font-medium py-1">{d}</div>
          ))}
          {/* Grid */}
          {TIME_SLOTS.map((slot, si) => (
            <>
              <div key={slot.label} className="text-[10px] text-muted-foreground text-right pr-2 flex items-center justify-end">{slot.label}</div>
              {DAYS.map((_, di) => {
                const cell = grid[si][di];
                const avg = cell.count > 0 ? cell.total / cell.count : 0;
                const intensity = maxVal > 0 ? avg / maxVal : 0;
                const top = isTop3(si, di);
                return (
                  <div
                    key={`${si}-${di}`}
                    className={`h-8 w-full min-w-[36px] rounded-sm flex items-center justify-center text-[9px] font-mono ${top ? "ring-1 ring-primary" : ""}`}
                    style={{
                      backgroundColor: intensity > 0
                        ? `hsl(270, 70%, ${85 - intensity * 55}%)`
                        : "hsl(var(--muted))",
                    }}
                    title={`${DAYS[di]} ${slot.label}: ${avg.toFixed(1)}% ER (${cell.count} posts)`}
                  >
                    {top && cell.count > 0 && <span className="text-[8px]">🔥</span>}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
