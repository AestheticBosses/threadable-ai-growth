import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { startOfWeek, addDays, format, differenceInCalendarDays } from "date-fns";

interface Props {
  streak: number;
  publishedDates: string[];
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function PostingStreakCard({ streak, publishedDates }: Props) {
  const navigate = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const publishedSet = new Set(publishedDates.map((d) => new Date(d).toDateString()));

  const todayIdx = differenceInCalendarDays(today, weekStart);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          {streak > 0 ? (
            <>
              <Flame className="h-5 w-5 text-orange-400" />
              <span className="text-sm font-semibold text-foreground">
                {streak}-day posting streak!
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              No active streak — post today to start one!
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {DAY_LABELS.map((label, i) => {
            const dayDate = addDays(weekStart, i);
            const posted = publishedSet.has(dayDate.toDateString());
            const isToday = i === todayIdx;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                <div
                  className={`h-3.5 w-3.5 rounded-full transition-colors ${
                    posted
                      ? "bg-primary"
                      : "bg-muted border border-border"
                  } ${isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}
                />
              </div>
            );
          })}
        </div>
        {streak === 0 && (
          <button
            onClick={() => navigate("/queue")}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Go to Content Queue →
          </button>
        )}
      </CardContent>
    </Card>
  );
}
