import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BulkScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postCount: number;
  onConfirm: (assignments: { id: string; scheduled_for: string }[]) => Promise<void>;
  postIds: string[];
}

export function BulkScheduleDialog({ open, onOpenChange, postCount, onConfirm, postIds }: BulkScheduleDialogProps) {
  const tomorrow = addDays(new Date(), 1);
  const [startDate, setStartDate] = useState<Date | undefined>(tomorrow);
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(tomorrow, Math.max(Math.ceil(postCount / 2) - 1, 1)));
  const [times, setTimes] = useState("09:00, 17:00");
  const [scheduling, setScheduling] = useState(false);

  const preview = useMemo(() => {
    if (!startDate || !endDate || !postIds.length) return [];
    const timeSlots = times.split(",").map((t) => t.trim()).filter(Boolean);
    if (timeSlots.length === 0) return [];

    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    const postsPerDay = Math.ceil(postIds.length / totalDays);
    const assignments: { id: string; date: Date; time: string; label: string }[] = [];
    let postIdx = 0;

    for (let d = 0; d < totalDays && postIdx < postIds.length; d++) {
      const day = addDays(startDate, d);
      for (let t = 0; t < Math.min(postsPerDay, timeSlots.length) && postIdx < postIds.length; t++) {
        assignments.push({
          id: postIds[postIdx],
          date: day,
          time: timeSlots[t % timeSlots.length],
          label: `Post ${postIdx + 1} (${timeSlots[t % timeSlots.length]})`,
        });
        postIdx++;
      }
    }
    return assignments;
  }, [startDate, endDate, postIds, times]);

  const previewByDay = useMemo(() => {
    const map = new Map<string, typeof preview>();
    for (const a of preview) {
      const key = format(a.date, "MMM d");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [preview]);

  const handleConfirm = async () => {
    setScheduling(true);
    try {
      const assignments = preview.map((a) => {
        const [h, m] = a.time.split(":").map(Number);
        const dt = new Date(a.date);
        dt.setHours(h || 9, m || 0, 0, 0);
        return { id: a.id, scheduled_for: dt.toISOString() };
      });
      await onConfirm(assignments);
      onOpenChange(false);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule {postCount} Posts</DialogTitle>
          <DialogDescription>Distribute posts across a date range.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                className="p-2 pointer-events-auto"
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                className="p-2 pointer-events-auto"
                disabled={(d) => d < (startDate || new Date())}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Posting times (comma-separated)</Label>
            <Input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="09:00, 17:00" />
          </div>

          {previewByDay.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Preview</Label>
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                {previewByDay.map(([day, items]) => (
                  <div key={day} className="text-xs text-foreground">
                    <span className="font-medium">{day}:</span>{" "}
                    {items.map((a) => a.label).join(", ")}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={scheduling || preview.length === 0} className="gap-1">
            {scheduling && <Loader2 className="h-3 w-3 animate-spin" />}
            Schedule All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
