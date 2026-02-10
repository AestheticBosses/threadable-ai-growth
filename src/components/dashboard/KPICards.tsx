import { Card, CardContent } from "@/components/ui/card";
import { Eye, BarChart3, Users, FileText } from "lucide-react";

interface KPICardsProps {
  totalFollowers: number | null;
  followerGrowth: number | null;
  avgEngagement: number;
  totalViews: number;
  postsPublished: number;
}

function GrowthIndicator({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
      {isPositive ? "+" : ""}{value}
    </span>
  );
}

export function KPICards({ totalFollowers, followerGrowth, avgEngagement, totalViews, postsPublished }: KPICardsProps) {
  const cards = [
    {
      label: "Total Followers",
      value: totalFollowers !== null ? totalFollowers.toLocaleString() : "—",
      icon: Users,
      extra: <GrowthIndicator value={followerGrowth} />,
    },
    {
      label: "Avg Engagement Rate",
      value: `${avgEngagement.toFixed(2)}%`,
      icon: BarChart3,
    },
    {
      label: "Total Views",
      value: totalViews.toLocaleString(),
      icon: Eye,
    },
    {
      label: "Posts Published",
      value: postsPublished.toString(),
      icon: FileText,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{c.value}</span>
              {c.extra}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
