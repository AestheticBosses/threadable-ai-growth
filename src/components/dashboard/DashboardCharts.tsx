import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

const CHART_BLUE = "hsl(221, 83%, 53%)";
const CHART_PURPLE = "hsl(262, 60%, 55%)";

const lineConfig: ChartConfig = {
  value: { label: "Value", color: CHART_BLUE },
};
const barConfig: ChartConfig = {
  value: { label: "Avg Views", color: CHART_BLUE },
};
const engBarConfig: ChartConfig = {
  value: { label: "Avg Engagement %", color: CHART_PURPLE },
};

interface Post {
  posted_at: string | null;
  views: number | null;
  engagement_rate: number | null;
  day_of_week: string | null;
  hour_posted: number | null;
  content_category: string | null;
}

interface Snapshot {
  recorded_at: string;
  follower_count: number;
}

interface DashboardChartsProps {
  posts: Post[];
  followerSnapshots: Snapshot[];
}

function SmallLineChart({ data, dataKey, label, color }: { data: any[]; dataKey: string; label: string; color: string }) {
  const config: ChartConfig = { [dataKey]: { label, color } };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={config} className="h-[220px] w-full">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} width={40} className="text-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function SmallBarChart({ data, dataKey, label, color }: { data: any[]; dataKey: string; label: string; color: string }) {
  const config: ChartConfig = { [dataKey]: { label, color } };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ posts, followerSnapshots }: DashboardChartsProps) {
  // Follower Growth
  const followerData = followerSnapshots.map((s) => ({
    label: format(new Date(s.recorded_at), "MMM d"),
    value: s.follower_count,
  }));

  // Views Per Post
  const viewsData = posts.map((p) => ({
    label: p.posted_at ? format(new Date(p.posted_at), "MMM d") : "?",
    value: p.views ?? 0,
  }));

  // Engagement Rate Trend
  const engagementData = posts.map((p) => ({
    label: p.posted_at ? format(new Date(p.posted_at), "MMM d") : "?",
    value: Number((p.engagement_rate ?? 0).toFixed(2)),
  }));

  // Best Days
  const dayMap: Record<string, { total: number; count: number }> = {};
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  posts.forEach((p) => {
    const d = p.day_of_week ?? "Unknown";
    if (!dayMap[d]) dayMap[d] = { total: 0, count: 0 };
    dayMap[d].total += p.views ?? 0;
    dayMap[d].count += 1;
  });
  const bestDaysData = dayOrder
    .filter((d) => dayMap[d])
    .map((d) => ({ label: d.slice(0, 3), value: Math.round(dayMap[d].total / dayMap[d].count) }));

  // Best Hours
  const hourMap: Record<number, { total: number; count: number }> = {};
  posts.forEach((p) => {
    const h = p.hour_posted;
    if (h === null || h === undefined) return;
    if (!hourMap[h]) hourMap[h] = { total: 0, count: 0 };
    hourMap[h].total += p.views ?? 0;
    hourMap[h].count += 1;
  });
  const bestHoursData = Object.entries(hourMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([h, v]) => ({
      label: `${String(h).padStart(2, "0")}:00`,
      value: Math.round(v.total / v.count),
    }));

  // Content Category Performance
  const catMap: Record<string, { total: number; count: number }> = {};
  posts.forEach((p) => {
    const c = p.content_category ?? "Uncategorized";
    if (!catMap[c]) catMap[c] = { total: 0, count: 0 };
    catMap[c].total += p.engagement_rate ?? 0;
    catMap[c].count += 1;
  });
  const categoryData = Object.entries(catMap)
    .map(([label, v]) => ({ label, value: Number((v.total / v.count).toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SmallLineChart data={followerData} dataKey="value" label="Follower Growth" color={CHART_BLUE} />
      <SmallLineChart data={viewsData} dataKey="value" label="Views Per Post" color={CHART_BLUE} />
      <SmallLineChart data={engagementData} dataKey="value" label="Engagement Rate Trend" color={CHART_PURPLE} />
      <SmallBarChart data={bestDaysData} dataKey="value" label="Best Days (Avg Views)" color={CHART_BLUE} />
      <SmallBarChart data={bestHoursData} dataKey="value" label="Best Hours (Avg Views)" color={CHART_PURPLE} />
      <SmallBarChart data={categoryData} dataKey="value" label="Category Performance (Avg Engagement %)" color={CHART_BLUE} />
    </div>
  );
}
