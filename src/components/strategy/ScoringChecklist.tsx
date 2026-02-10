import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const RULE_BASED = [
  {
    id: "hook",
    label: "Hook Strength",
    detail: "First line <15 words, no filler, bold statement.",
  },
  {
    id: "emotion",
    label: "Emotional Triggers",
    detail: "Hits 2+ of: FOMO, Recognition, Aspiration, Curiosity, Defiance, Humor, Belonging.",
  },
  {
    id: "scene",
    label: "Vivid Scene",
    detail: "Contains concrete visuals the reader can picture in 1 second.",
  },
];

const AI_POWERED = [
  {
    id: "niche",
    label: "Niche Specificity",
    detail: "Speaks directly to your dream client.",
  },
  {
    id: "voice",
    label: "Voice Match",
    detail: "Sounds like you wrote it — matches your voice profile.",
  },
  {
    id: "data",
    label: "Data-Aligned",
    detail: "Follows regression insights from your top-performing posts.",
  },
];

export function ScoringChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const score = Object.values(checked).filter(Boolean).length;

  const renderItem = (item: (typeof RULE_BASED)[0]) => (
    <label
      key={item.id}
      className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
    >
      <Checkbox
        checked={!!checked[item.id]}
        onCheckedChange={() => toggle(item.id)}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.detail}</p>
      </div>
    </label>
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Pre-Post Scoring Checklist</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Every post is scored on 6 points before publishing.
        </p>
      </div>

      <Card>
        <CardContent className="py-5 space-y-5">
          {/* Score indicator */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 w-6 rounded-full transition-colors ${
                    i < score
                      ? score >= 4
                        ? "bg-emerald-500"
                        : "bg-yellow-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-bold text-foreground">{score}/6</span>
            {score > 0 && score < 4 && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs">
                Below threshold
              </Badge>
            )}
            {score >= 4 && (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">
                Ready to publish
              </Badge>
            )}
          </div>

          {/* Rule-based */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rule-Based — 3 points
            </p>
            {RULE_BASED.map(renderItem)}
          </div>

          {/* AI-powered */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI-Powered — 3 points
            </p>
            {AI_POWERED.map(renderItem)}
          </div>

          {/* Note */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Posts scoring below <strong>4/6</strong> are auto-regenerated before publishing.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
