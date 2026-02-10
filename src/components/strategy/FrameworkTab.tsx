import { ScoringChecklist } from "./ScoringChecklist";

const TEMPLATES = [
  {
    archetype: "Vault Drop",
    color: "border-violet-500/50",
    labelColor: "text-violet-400",
    template: `I [tracked/studied/analyzed] [specific thing] for [time period].

Here's the exact [framework/breakdown/system]:

1. [Specific actionable step]
2. [Specific actionable step]
3. [Specific actionable step]
4. [Specific actionable step]
5. [Specific actionable step]

The takeaway: [Contrarian insight that reframes the topic].`,
  },
  {
    archetype: "Truth Bomb",
    color: "border-emerald-500/50",
    labelColor: "text-emerald-400",
    template: `[Universal truth in under 15 words that makes the reader feel SEEN.]

Examples:
• "Your best content comes from your worst experiences."
• "The best marketing strategy is being so good people screenshot your posts."`,
  },
  {
    archetype: "Niche Hot Take",
    color: "border-yellow-500/50",
    labelColor: "text-yellow-400",
    template: `Unpopular opinion: [Common practice] is actually [contrarian view].

Here's what nobody tells you:

→ [Evidence point 1]
→ [Evidence point 2]
→ [Evidence point 3]

[One-line summary that reframes the debate].`,
  },
  {
    archetype: "Window",
    color: "border-blue-500/50",
    labelColor: "text-blue-400",
    template: `Just [real-time action in present tense]. [Time/location detail].

[Old way vs. New way comparison]

[Emotional admission: fear, excitement, uncertainty]

Will report back in [timeframe].`,
  },
];

const TEN_RULES = [
  "Accept the power law. 10% of posts = 60%+ of results.",
  "2+ emotional triggers per post or don't post.",
  "Vivid visual > abstract truth.",
  "Name-drop authority in LINE ONE for Vault Drops.",
  "NICHE hot takes only. Generic contrarian = worst performing.",
  "Post 2 Vault Drops/week. They drive 72% of follows.",
  "Truth Bombs need specificity.",
  "Window posts must be REAL-TIME. Present tense.",
  "Profanity is a spice, not a strategy.",
  "Score 4+ on checklist or rewrite.",
];

export function FrameworkTab() {
  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)]">Your Proven Framework</h3>
        <p className="text-sm text-[hsl(260,10%,50%)] mt-1">Rules extracted from your data.</p>
      </div>

      {/* Scoring Checklist — using the existing themed component but wrapped in dark context */}
      <div className="[&_section]:text-[hsl(0,0%,95%)] [&_h2]:text-[hsl(0,0%,95%)]">
        <ScoringChecklist />
      </div>

      {/* Validated Templates */}
      <div>
        <h4 className="text-sm font-bold text-[hsl(260,80%,70%)] mb-4 uppercase tracking-wider">Validated Templates by Archetype</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((t) => (
            <div key={t.archetype} className={`rounded-lg border-2 ${t.color} bg-[hsl(260,15%,8%)] p-5`}>
              <h5 className={`text-sm font-bold ${t.labelColor} mb-3`}>{t.archetype} Template</h5>
              <pre className="text-xs text-[hsl(0,0%,75%)] whitespace-pre-wrap font-mono leading-relaxed">{t.template}</pre>
            </div>
          ))}
        </div>
      </div>

      {/* 10 Rules */}
      <div className="rounded-lg border-2 border-red-500/40 bg-red-500/5 p-6">
        <h4 className="text-sm font-bold text-red-400 mb-4">🔟 10 Rules — Validated by Data</h4>
        <ol className="space-y-2">
          {TEN_RULES.map((rule, i) => (
            <li key={i} className="text-sm text-[hsl(0,0%,80%)] flex gap-3">
              <span className="font-mono font-bold text-red-400 shrink-0">{i + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
