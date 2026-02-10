import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ARCHETYPES = [
  {
    emoji: "🎓",
    name: "Vault Drop",
    percentage: 30,
    goal: "Follows + Saves",
    description:
      "Educational posts with numbered frameworks and steps. These are your \"follow machines\" — they're 10% of posts but drive 72% of follows.",
    color: "border-violet-500/30 bg-violet-500/5",
    badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  {
    emoji: "🔥",
    name: "Truth Bomb",
    percentage: 30,
    goal: "Reposts + Reach",
    description:
      "Short emotional one-liners under 25 words. These spread THROUGH other people's audiences — maximum viral potential.",
    color: "border-emerald-500/30 bg-emerald-500/5",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    emoji: "💣",
    name: "Niche Hot Take",
    percentage: 20,
    goal: "Comments + Targeted Follows",
    description:
      "Industry-specific contrarian opinions. Highest follow RATE per view — but only if niche-specific and polarizing.",
    color: "border-yellow-500/30 bg-yellow-500/5",
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  {
    emoji: "🪟",
    name: "Window",
    percentage: 20,
    goal: "Trust + DMs + Warm Leads",
    description:
      "Behind-the-scenes, real-time, vulnerable posts. Lowest views but warmest leads — converts followers into customers.",
    color: "border-blue-500/30 bg-blue-500/5",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
];

export function ContentArchetypes() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Your Content Archetypes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The four post types that drive growth — each optimized for a different outcome.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ARCHETYPES.map((a) => (
          <Card key={a.name} className={`border ${a.color}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-xl">{a.emoji}</span>
                  {a.name}
                </CardTitle>
                <Badge className={`text-xs font-bold ${a.badgeClass}`}>{a.percentage}%</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Goal: {a.goal}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export const ARCHETYPE_NAMES = ARCHETYPES.map((a) => a.name);
