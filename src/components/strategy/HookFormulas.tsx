import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

type HookGroup = {
  archetype: string;
  emoji: string;
  color: string;
  hooks: string[];
};

const DEFAULT_HOOKS: HookGroup[] = [
  {
    archetype: "Vault Drop",
    emoji: "🎓",
    color: "border-violet-500/30",
    hooks: [
      "I [did X] and here's exactly what happened:",
      "I tracked [X] for [time period] and found [surprising result]:",
      "[Number] lessons from [specific experience]:",
      "The framework I use to [achieve outcome]:",
    ],
  },
  {
    archetype: "Truth Bomb",
    emoji: "🔥",
    color: "border-emerald-500/30",
    hooks: [
      "Short universal truths under 15 words.",
      "Nobody talks about this but [uncomfortable truth].",
      "The hardest part of [topic] is [unexpected angle].",
      "[Common belief] is a lie.",
    ],
  },
  {
    archetype: "Hot Take",
    emoji: "💣",
    color: "border-yellow-500/30",
    hooks: [
      "Unpopular opinion:",
      "[Common practice] is actually [contrarian view].",
      "Stop [popular advice]. Here's why:",
      "Everyone says [X]. They're wrong.",
    ],
  },
  {
    archetype: "Window",
    emoji: "🪟",
    color: "border-blue-500/30",
    hooks: [
      "Just [real-time action]. Here's what happened:",
      "Behind the scenes of [process]:",
      "I almost [quit/failed/gave up] today. Here's why:",
      "What my [morning/week/month] actually looks like:",
    ],
  },
];

interface Props {
  hooks?: string[] | null;
}

export function HookFormulas({ hooks }: Props) {
  // If strategy provides flat hooks, use defaults grouped by archetype
  const groups = DEFAULT_HOOKS;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        Hook Formulas
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.archetype} className={`border ${g.color}`}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{g.emoji}</span>
                <p className="text-sm font-semibold text-foreground">{g.archetype}</p>
              </div>
              <div className="space-y-2">
                {g.hooks.map((hook, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border p-2"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground">{hook}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
