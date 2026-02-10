import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date) => void;
  defaultDate?: Date;
}

export function ScheduleDialog({ open, onOpenChange, onConfirm, defaultDate }: ScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate || new Date());
  const [time, setTime] = useState("09:00");

  const handleConfirm = () => {
    if (!selectedDate) return;
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(selectedDate);
    combined.setHours(hours || 9, minutes || 0, 0, 0);
    onConfirm(combined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Post</DialogTitle>
          <DialogDescription>Pick a date and time to publish this post.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="p-3 pointer-events-auto mx-auto"
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
          <div className="space-y-2">
            <Label htmlFor="schedule-time">Time</Label>
            <Input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          {selectedDate && (
            <p className="text-sm text-muted-foreground text-center">
              <CalendarIcon className="inline h-3 w-3 mr-1" />
              {format(selectedDate, "EEEE, MMMM d")} at {time}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selectedDate}>Confirm & Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
