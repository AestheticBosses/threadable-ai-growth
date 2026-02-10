import { useMemo } from "react";
import { getMockThreads } from "@/lib/mockAnalysisData";

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

export function GrowthSignals() {
  const threads = getMockThreads();

  const topFollowRate = useMemo(() => {
    return [...threads].sort((a, b) => b.followRate - a.followRate).slice(0, 10);
  }, [threads]);

  const topViralCoeff = useMemo(() => {
    return [...threads]
      .map((t) => ({ ...t, viralCoeff: ((t.reposts + (t.comments * 0.3)) / t.views) * 100 }))
      .sort((a, b) => b.viralCoeff - a.viralCoeff)
      .slice(0, 10);
  }, [threads]);

  const anomaly = useMemo(() => {
    const medianViews = [...threads].sort((a, b) => a.views - b.views)[Math.floor(threads.length / 2)].views;
    return threads
      .filter((t) => t.views < medianViews && t.followRate > 3)
      .sort((a, b) => b.followRate - a.followRate)[0] ?? null;
  }, [threads]);

  const maxFollowRate = topFollowRate[0]?.followRate ?? 1;
  const maxViralCoeff = topViralCoeff[0]?.viralCoeff ?? 1;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)]">Growth Signal Rankings</h3>
        <p className="text-sm text-[hsl(260,10%,50%)] mt-1">
          Follows = your audience. Reposts = other people's audiences.
        </p>
      </div>

      {/* Follow Conversion Rate */}
      <div>
        <h4 className="text-sm font-bold text-violet-400 mb-4">Follow Conversion Rate — Top 10</h4>
        <div className="space-y-2">
          {topFollowRate.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="font-mono text-xs text-[hsl(260,10%,45%)] w-5 shrink-0">{i + 1}.</span>
              <span className="text-xs text-[hsl(0,0%,82%)] w-48 truncate shrink-0" title={t.title}>{t.title}</span>
              <BarChart value={t.followRate} max={maxFollowRate} color="bg-violet-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Viral Coefficient */}
      <div>
        <h4 className="text-sm font-bold text-emerald-400 mb-4">Viral Coefficient (Reposts+Quotes ÷ Views) — Top 10</h4>
        <div className="space-y-2">
          {topViralCoeff.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="font-mono text-xs text-[hsl(260,10%,45%)] w-5 shrink-0">{i + 1}.</span>
              <span className="text-xs text-[hsl(0,0%,82%)] w-48 truncate shrink-0" title={t.title}>{t.title}</span>
              <BarChart value={t.viralCoeff} max={maxViralCoeff} color="bg-emerald-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Anomaly Callout */}
      {anomaly && (
        <div className="rounded-lg border-2 border-yellow-500/40 bg-yellow-500/5 p-5">
          <h4 className="text-sm font-bold text-yellow-400 mb-2">🔍 Anomaly Callout</h4>
          <p className="text-sm text-[hsl(0,0%,80%)] leading-relaxed">
            "<span className="font-medium text-[hsl(0,0%,92%)]">{anomaly.title}</span>" had only{" "}
            <span className="font-mono text-yellow-400">{anomaly.views.toLocaleString()}</span> views but a{" "}
            <span className="font-mono text-yellow-400">{anomaly.followRate}%</span> follow rate.
            This confirms that <strong>niche-specific content converts followers better</strong> even with lower reach.
            Your strategy should optimize for follow rate, not just views.
          </p>
        </div>
      )}
    </div>
  );
}
