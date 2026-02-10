import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlaybookData } from "@/hooks/useStrategyData";
import type { DiscoveredArchetype } from "@/hooks/useStrategyData";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIME_WINDOWS = [
  { label: "6:00 AM", hour: 6 },
  { label: "7:00 AM", hour: 7 },
  { label: "9:00 AM", hour: 9 },
  { label: "10:00 AM", hour: 10 },
  { label: "12:00 PM", hour: 12 },
  { label: "1:00 PM", hour: 13 },
  { label: "3:00 PM", hour: 15 },
  { label: "4:00 PM", hour: 16 },
  { label: "6:00 PM", hour: 18 },
  { label: "7:00 PM", hour: 19 },
  { label: "9:00 PM", hour: 21 },
  { label: "10:00 PM", hour: 22 },
];

const POSTS_PER_DAY_OPTIONS = [3, 5, 7, 10, 15, 20, 30];

const BADGE_COLORS = [
  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "bg-rose-500/15 text-rose-400 border-rose-500/30",
];

const FUNNEL_BADGE: Record<string, string> = {
  TOF: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  MOF: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  BOF: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const FUNNEL_BAR_COLORS: Record<string, string> = {
  TOF: "bg-violet-500",
  MOF: "bg-blue-500",
  BOF: "bg-emerald-500",
};

interface ArchetypeInfo {
  name: string;
  emoji: string;
  percentage: number;
  colorIdx: number;
}

function getTimeSlots(count: number): string[] {
  if (count <= TIME_WINDOWS.length) {
    const step = TIME_WINDOWS.length / count;
    return Array.from({ length: count }, (_, i) => TIME_WINDOWS[Math.min(Math.floor(i * step), TIME_WINDOWS.length - 1)].label);
  }
  return Array.from({ length: count }, (_, i) => TIME_WINDOWS[i % TIME_WINDOWS.length].label);
}

function distributeArchetypes(archetypes: ArchetypeInfo[], postsPerDay: number, dayIndex: number): ArchetypeInfo[] {
  const totalPct = archetypes.reduce((s, a) => s + a.percentage, 0) || 100;
  const rawCounts = archetypes.map((a) => ({
    ...a,
    raw: (a.percentage / totalPct) * postsPerDay,
  }));

  let floored = rawCounts.map((a) => ({ ...a, count: Math.floor(a.raw) }));
  let remaining = postsPerDay - floored.reduce((s, a) => s + a.count, 0);

  const byFraction = [...floored]
    .map((a, i) => ({ ...a, frac: a.raw - a.count, origIdx: i }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remaining; i++) {
    const idx = (i + dayIndex) % byFraction.length;
    byFraction[idx].count++;
  }

  byFraction.forEach((b) => {
    floored[b.origIdx].count = b.count;
  });

  const archetypeQueue: ArchetypeInfo[] = [];
  floored.forEach((a) => {
    for (let j = 0; j < a.count; j++) {
      archetypeQueue.push(a);
    }
  });

  const rotateBy = dayIndex % (archetypeQueue.length || 1);
  return [...archetypeQueue.slice(rotateBy), ...archetypeQueue.slice(0, rotateBy)];
}

function assignFunnelStages(count: number, tofPct: number, mofPct: number, bofPct: number, dayIndex: number): string[] {
  const tofCount = Math.round((tofPct / 100) * count);
  const bofCount = Math.round((bofPct / 100) * count);
  const mofCount = count - tofCount - bofCount;

  const stages: string[] = [];
  for (let i = 0; i < tofCount; i++) stages.push("TOF");
  for (let i = 0; i < mofCount; i++) stages.push("MOF");
  for (let i = 0; i < bofCount; i++) stages.push("BOF");

  // Rotate by day for variety
  const rotateBy = dayIndex % (stages.length || 1);
  return [...stages.slice(rotateBy), ...stages.slice(0, rotateBy)];
}

interface DailyPostingPlanProps {
  playbook: PlaybookData;
  archetypes: DiscoveredArchetype[] | undefined;
  postsPerDay: number;
  onPostsPerDayChange: (n: number) => void;
  tofPct: number;
  mofPct: number;
  bofPct: number;
}

export function DailyPostingPlan({ playbook, archetypes, postsPerDay, onPostsPerDayChange, tofPct, mofPct, bofPct }: DailyPostingPlanProps) {
  const archetypeInfos: ArchetypeInfo[] = useMemo(() => {
    if (archetypes?.length) {
      return archetypes.map((a, i) => ({
        name: a.name,
        emoji: a.emoji,
        percentage: a.recommended_percentage,
        colorIdx: i,
      }));
    }
    if (playbook.templates?.length) {
      const pct = Math.round(100 / playbook.templates.length);
      return playbook.templates.map((t, i) => ({
        name: t.archetype,
        emoji: t.emoji || "📝",
        percentage: pct,
        colorIdx: i,
      }));
    }
    return [];
  }, [archetypes, playbook.templates]);

  const weeklyPlan = useMemo(() => {
    const timeSlots = getTimeSlots(postsPerDay);
    return DAYS.map((day, dayIdx) => {
      const assigned = distributeArchetypes(archetypeInfos, postsPerDay, dayIdx);
      const funnelStages = assignFunnelStages(postsPerDay, tofPct, mofPct, bofPct, dayIdx);
      return {
        day,
        slots: assigned.map((arch, slotIdx) => ({
          time: timeSlots[slotIdx],
          archetype: arch,
          funnel: funnelStages[slotIdx] || "TOF",
        })),
      };
    });
  }, [archetypeInfos, postsPerDay, tofPct, mofPct, bofPct]);

  const weeklyTotals = useMemo(() => {
    const counts: Record<string, { emoji: string; count: number }> = {};
    weeklyPlan.forEach((d) =>
      d.slots.forEach((s) => {
        if (!counts[s.archetype.name]) counts[s.archetype.name] = { emoji: s.archetype.emoji, count: 0 };
        counts[s.archetype.name].count++;
      })
    );
    return counts;
  }, [weeklyPlan]);

  const totalWeeklyPosts = postsPerDay * 7;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Posts per day:</span>
          <Select value={String(postsPerDay)} onValueChange={(v) => onPostsPerDayChange(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSTS_PER_DAY_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Funnel mix bar */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Funnel Mix</p>
        <div className="flex h-6 rounded-md overflow-hidden border border-border">
          {tofPct > 0 && (
            <div className={`${FUNNEL_BAR_COLORS.TOF} flex items-center justify-center text-[10px] font-bold text-white`} style={{ width: `${tofPct}%` }}>
              TOF {tofPct}%
            </div>
          )}
          {mofPct > 0 && (
            <div className={`${FUNNEL_BAR_COLORS.MOF} flex items-center justify-center text-[10px] font-bold text-white`} style={{ width: `${mofPct}%` }}>
              MOF {mofPct}%
            </div>
          )}
          {bofPct > 0 && (
            <div className={`${FUNNEL_BAR_COLORS.BOF} flex items-center justify-center text-[10px] font-bold text-white`} style={{ width: `${bofPct}%` }}>
              BOF {bofPct}%
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="rounded-lg border border-border bg-card/50 px-4 py-3">
        <p className="text-sm text-foreground">
          <span className="font-bold font-mono">{postsPerDay}</span>
          <span className="text-muted-foreground"> posts/day × 7 days = </span>
          <span className="font-bold font-mono">{totalWeeklyPosts}</span>
          <span className="text-muted-foreground"> posts/week</span>
          {Object.entries(weeklyTotals).length > 0 && (
            <span className="text-muted-foreground">
              {" | "}
              {Object.entries(weeklyTotals).map(([name, { emoji, count }], i) => (
                <span key={name}>
                  {i > 0 && " · "}
                  {emoji} {name}: <span className="font-mono font-bold text-foreground">{count}</span>
                </span>
              ))}
            </span>
          )}
        </p>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-7 gap-2 overflow-x-auto">
        {weeklyPlan.map((day) => (
          <div key={day.day} className="min-w-[120px]">
            <div className="text-xs font-bold font-mono text-muted-foreground mb-2 text-center">
              {day.day.slice(0, 3).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              {day.slots.map((slot, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card/50 px-2 py-1.5"
                >
                  <div className="text-[10px] font-mono text-muted-foreground">{slot.time}</div>
                  <Badge
                    className={`text-[10px] mt-0.5 ${BADGE_COLORS[slot.archetype.colorIdx % BADGE_COLORS.length]}`}
                  >
                    {slot.archetype.emoji} {slot.archetype.name}
                  </Badge>
                  <Badge className={`text-[9px] mt-0.5 ml-1 ${FUNNEL_BADGE[slot.funnel]}`}>
                    {slot.funnel}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
