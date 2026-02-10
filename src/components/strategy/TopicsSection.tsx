import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TopicsByArchetype = {
  archetype: string;
  emoji: string;
  badgeClass: string;
  topics: string[];
};

const ARCHETYPE_META: Record<string, { emoji: string; badgeClass: string }> = {
  "Vault Drop": { emoji: "🎓", badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  "Truth Bomb": { emoji: "🔥", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  "Hot Take": { emoji: "💣", badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  Window: { emoji: "🪟", badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

interface Props {
  topics?: string[] | null;
}

export function TopicsSection({ topics }: Props) {
  // Distribute topics across archetypes in order: VD, TB, HT, W repeating
  const archetypeKeys = ["Vault Drop", "Truth Bomb", "Hot Take", "Window"];
  const grouped: TopicsByArchetype[] = archetypeKeys.map((name) => ({
    archetype: name,
    ...ARCHETYPE_META[name],
    topics: [],
  }));

  (topics ?? []).forEach((t, i) => {
    grouped[i % archetypeKeys.length].topics.push(t);
  });

  // Filter out empty groups
  const filledGroups = grouped.filter((g) => g.topics.length > 0);

  if (filledGroups.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Topics for This Week</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {filledGroups.map((g) => (
          <Card key={g.archetype}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{g.emoji}</span>
                <p className="text-sm font-semibold text-foreground">{g.archetype}</p>
                <Badge variant="outline" className={`text-[10px] ml-auto ${g.badgeClass}`}>
                  {g.topics.length} topics
                </Badge>
              </div>
              <div className="space-y-1.5">
                {g.topics.map((topic, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-border p-2">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-foreground">{topic}</p>
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
