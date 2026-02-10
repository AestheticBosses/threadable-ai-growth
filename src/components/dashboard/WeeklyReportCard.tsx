import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface Report {
  total_views: number | null;
  avg_engagement_rate: number | null;
  follower_growth: number | null;
  insights: any;
}

interface WeeklyReportCardProps {
  latest: Report | null;
  previous: Report | null;
}

function Delta({ current, previous, suffix = "" }: { current: number | null; previous: number | null; suffix?: string }) {
  if (current === null || previous === null || previous === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 0.5;
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
  const color = isFlat ? "text-muted-foreground" : isUp ? "text-success" : "text-destructive";

  return (
    <div className="flex items-center gap-1">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-sm font-medium ${color}`}>{Math.abs(pct).toFixed(1)}%{suffix}</span>
    </div>
  );
}

export function WeeklyReportCard({ latest, previous }: WeeklyReportCardProps) {
  if (!latest) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No weekly reports available yet. Reports are generated after your first full week of data.
        </CardContent>
      </Card>
    );
  }

  const insights = latest.insights;
  const insightText = typeof insights === "string"
    ? insights
    : Array.isArray(insights)
      ? insights.join(" ")
      : insights && typeof insights === "object" && "summary" in insights
        ? (insights as any).summary
        : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">This Week vs Last Week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Views</p>
            <p className="text-lg font-bold">{(latest.total_views ?? 0).toLocaleString()}</p>
            <Delta current={latest.total_views} previous={previous?.total_views ?? null} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Engagement</p>
            <p className="text-lg font-bold">{(latest.avg_engagement_rate ?? 0).toFixed(2)}%</p>
            <Delta current={latest.avg_engagement_rate} previous={previous?.avg_engagement_rate ?? null} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Follower Growth</p>
            <p className="text-lg font-bold">{latest.follower_growth !== null ? `+${latest.follower_growth}` : "—"}</p>
          </div>
        </div>

        {insightText && (
          <blockquote className="border-l-4 border-primary/40 pl-4 py-2 text-sm text-muted-foreground italic bg-muted/30 rounded-r-md">
            {insightText}
          </blockquote>
        )}
      </CardContent>
    </Card>
  );
}
