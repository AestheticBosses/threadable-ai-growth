import { getPlaybookThreads } from "@/lib/mockAnalysisData";
import { Badge } from "@/components/ui/badge";

const ARCHETYPE_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  "Vault Drop": { border: "border-violet-500/40", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30", label: "text-violet-400" },
  "Truth Bomb": { border: "border-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "text-emerald-400" },
  "Hot Take": { border: "border-yellow-500/40", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", label: "text-yellow-400" },
  "Window": { border: "border-blue-500/40", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "text-blue-400" },
};

const POSTING_ORDER = [
  { day: "Monday", threads: [0, 1], note: "Vault Drop + Truth Bomb" },
  { day: "Tuesday", threads: [2], note: "Hot Take" },
  { day: "Wednesday", threads: [3, 4], note: "Window + Vault Drop" },
  { day: "Thursday", threads: [5], note: "Truth Bomb" },
  { day: "Friday", threads: [6, 7], note: "Hot Take + Window" },
  { day: "Saturday", threads: [8], note: "Vault Drop" },
  { day: "Sunday", threads: [9], note: "Truth Bomb" },
];

export function PlaybookTab() {
  const threads = getPlaybookThreads();

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)]">Ready-to-Post Playbook</h3>
        <p className="text-sm text-[hsl(260,10%,50%)] mt-1">10 threads scored, categorized, and explained.</p>
      </div>

      <div className="space-y-4">
        {threads.map((t, i) => {
          const style = ARCHETYPE_STYLES[t.archetype];
          return (
            <div key={i} className={`rounded-lg border-2 ${style.border} bg-[hsl(260,15%,8%)] p-5`}>
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge className={`text-xs ${style.badge}`}>{t.archetype}</Badge>
                <Badge variant="outline" className="text-xs text-[hsl(260,80%,70%)] border-[hsl(260,30%,30%)]">
                  Score: {t.score}/6
                </Badge>
                <span className="text-xs text-[hsl(260,10%,50%)]">Goal: {t.goal}</span>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 mb-3 text-xs text-[hsl(260,10%,45%)]">
                <span>Hook: <span className="text-[hsl(0,0%,80%)]">{t.hookType}</span></span>
                <span>Triggers: <span className="text-[hsl(0,0%,80%)]">{t.emotionalTriggers.join(", ")}</span></span>
              </div>

              {/* Post Text */}
              <div className="rounded-lg bg-[hsl(260,15%,12%)] p-4 mb-3">
                <pre className="text-sm text-[hsl(0,0%,88%)] whitespace-pre-wrap font-sans leading-relaxed">{t.text}</pre>
              </div>

              {/* Why it works */}
              <div className="text-xs text-[hsl(260,10%,50%)]">
                <span className="font-bold text-emerald-400">Why it works:</span>{" "}
                <span className="text-[hsl(0,0%,75%)]">{t.whyItWorks}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggested Posting Order */}
      <div>
        <h4 className="text-sm font-bold text-[hsl(260,80%,70%)] mb-4 uppercase tracking-wider">Suggested Posting Order</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {POSTING_ORDER.map((d) => (
            <div key={d.day} className="rounded-lg border border-[hsl(260,20%,18%)] bg-[hsl(260,15%,10%)] p-4">
              <p className="text-xs font-bold text-[hsl(0,0%,95%)] mb-1">{d.day}</p>
              <p className="text-xs text-[hsl(260,10%,50%)]">{d.note}</p>
              <div className="mt-2 space-y-1">
                {d.threads.map((idx) => (
                  <p key={idx} className="text-xs text-[hsl(0,0%,75%)] truncate">
                    #{idx + 1}: {threads[idx]?.text.split("\n")[0].slice(0, 50)}...
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
