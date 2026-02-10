import { usePlaybookData } from "@/hooks/useStrategyData";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ARCHETYPE_BORDER_COLORS = [
  "border-violet-500/50", "border-emerald-500/50", "border-yellow-500/50",
  "border-blue-500/50", "border-rose-500/50",
];
const ARCHETYPE_LABEL_COLORS = [
  "text-violet-400", "text-emerald-400", "text-yellow-400",
  "text-blue-400", "text-rose-400",
];

export function FrameworkTab() {
  const { data: playbook, isLoading } = usePlaybookData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <Sparkles className="h-10 w-10 text-primary" />
        <p className="text-foreground font-medium">No playbook data yet</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Head to the Playbook page and generate your personalized playbook to see your framework, templates, and rules here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Your Data-Driven Framework</h3>
        <p className="text-sm text-muted-foreground mt-1">Rules and templates extracted from your performance data.</p>
      </div>

      {/* Checklist */}
      {playbook.checklist && (
        <section className="space-y-4">
          <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Pre-Post Scoring Checklist</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playbook.checklist.map((c, i) => (
              <div key={i} className="flex gap-3 items-start rounded-lg border border-border p-3">
                <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded bg-emerald-500/10">
                  <span className="text-xs font-bold font-mono text-emerald-400">+{c.points}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{c.question}</p>
                  <p className="text-xs text-muted-foreground">{c.data_backing}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Templates */}
      {playbook.templates && (
        <div>
          <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Templates by Archetype</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playbook.templates.map((t, i) => (
              <div key={t.archetype} className={`rounded-lg border-2 ${ARCHETYPE_BORDER_COLORS[i % ARCHETYPE_BORDER_COLORS.length]} bg-card p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  <span>{t.emoji}</span>
                  <h5 className={`text-sm font-bold ${ARCHETYPE_LABEL_COLORS[i % ARCHETYPE_LABEL_COLORS.length]}`}>
                    {t.archetype}
                  </h5>
                </div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{t.template}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {playbook.rules && (
        <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-6">
          <h4 className="text-sm font-bold text-destructive mb-4">Rules — Validated by Your Data</h4>
          <ol className="space-y-2">
            {playbook.rules.map((r, i) => (
              <li key={i} className="text-sm text-foreground flex gap-3">
                <span className="font-mono font-bold text-destructive shrink-0">{i + 1}.</span>
                <div>
                  <span>{r.rule}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 italic">{r.evidence}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
