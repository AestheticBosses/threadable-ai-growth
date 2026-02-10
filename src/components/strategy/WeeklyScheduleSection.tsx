import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

type ScheduleDay = {
  day: string;
  posts_count: number;
  content_types: string[];
  best_time: string;
};

const ARCHETYPE_BADGE_COLORS: Record<string, string> = {
  "Vault Drop": "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Truth Bomb": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Hot Take": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Window: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { day: "Monday", posts_count: 2, content_types: ["Vault Drop", "Truth Bomb"], best_time: "8:00 AM" },
  { day: "Tuesday", posts_count: 1, content_types: ["Hot Take"], best_time: "12:00 PM" },
  { day: "Wednesday", posts_count: 2, content_types: ["Vault Drop", "Window"], best_time: "8:00 AM" },
  { day: "Thursday", posts_count: 1, content_types: ["Truth Bomb"], best_time: "6:00 PM" },
  { day: "Friday", posts_count: 2, content_types: ["Hot Take", "Vault Drop"], best_time: "8:00 AM" },
  { day: "Saturday", posts_count: 1, content_types: ["Window"], best_time: "10:00 AM" },
  { day: "Sunday", posts_count: 1, content_types: ["Truth Bomb"], best_time: "9:00 AM" },
];

interface Props {
  schedule?: ScheduleDay[] | null;
}

export function WeeklyScheduleSection({ schedule }: Props) {
  const days = schedule?.length ? schedule : DEFAULT_SCHEDULE;
  const total = days.reduce((s, d) => s + d.posts_count, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Weekly Schedule
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{total} posts per week</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day, i) => (
          <Card key={i} className="text-center">
            <CardContent className="py-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">{day.day.slice(0, 3)}</p>
              <p className="text-2xl font-bold text-primary">{day.posts_count}</p>
              <p className="text-xs text-muted-foreground">
                post{day.posts_count !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {day.best_time}
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {day.content_types?.map((type, j) => (
                  <Badge
                    key={j}
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${ARCHETYPE_BADGE_COLORS[type] ?? ""}`}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
