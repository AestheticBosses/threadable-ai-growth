import { useMemo } from "react";
import { addDays, startOfWeek, format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

type CalendarPost = {
  scheduled_for: string | null;
  status: string | null;
};

interface WeeklyCalendarProps {
  posts: CalendarPost[];
}

export function WeeklyCalendar({ posts }: WeeklyCalendarProps) {
  const days = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const dayPosts = posts.filter(
        (p) => p.scheduled_for && isSameDay(new Date(p.scheduled_for), date)
      );
      return { date, posts: dayPosts };
    });
  }, [posts]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ date, posts: dayPosts }) => {
        const isToday = isSameDay(date, new Date());
        const overloaded = dayPosts.length > 6;
        return (
          <div
            key={date.toISOString()}
            className={cn(
              "rounded-lg border p-2 text-center space-y-1 transition-colors",
              isToday ? "border-primary bg-primary/5" : "border-border",
              overloaded && "border-yellow-500 bg-yellow-500/5"
            )}
          >
            <p className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
              {format(date, "EEE")}
            </p>
            <p className={cn("text-lg font-bold", isToday ? "text-foreground" : "text-foreground/80")}>
              {format(date, "d")}
            </p>
            <div className="flex flex-wrap justify-center gap-0.5">
              {dayPosts.slice(0, 8).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    overloaded ? "bg-yellow-500" : "bg-primary"
                  )}
                />
              ))}
              {dayPosts.length > 8 && (
                <span className="text-[9px] text-muted-foreground">+{dayPosts.length - 8}</span>
              )}
            </div>
            <p className={cn(
              "text-[10px]",
              overloaded ? "text-yellow-600 font-medium" : "text-muted-foreground"
            )}>
              {dayPosts.length} post{dayPosts.length !== 1 ? "s" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
