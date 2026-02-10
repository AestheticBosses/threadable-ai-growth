import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import type { DateRange as RangeType } from "@/hooks/useDashboardData";

interface DateRangeSelectorProps {
  range: RangeType;
  onRangeChange: (r: RangeType) => void;
  customFrom?: Date;
  customTo?: Date;
  onCustomChange: (from: Date, to: Date) => void;
}

const presets: { label: string; value: RangeType }[] = [
  { label: "All time", value: "all" },
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

export function DateRangeSelector({ range, onRangeChange, customFrom, customTo, onCustomChange }: DateRangeSelectorProps) {
  const [calOpen, setCalOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(customFrom);
  const [tempTo, setTempTo] = useState<Date | undefined>(customTo);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={range === p.value ? "default" : "outline"}
          onClick={() => onRangeChange(p.value)}
          className="h-8 text-xs"
        >
          {p.label}
        </Button>
      ))}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={range === "custom" ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {range === "custom" && customFrom && customTo
              ? `${format(customFrom, "MMM d")} – ${format(customTo, "MMM d")}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground font-medium">Select start date</p>
            <Calendar
              mode="single"
              selected={tempFrom}
              onSelect={(d) => {
                setTempFrom(d);
                if (d && tempTo && d <= tempTo) {
                  onCustomChange(d, tempTo);
                  onRangeChange("custom");
                }
              }}
            />
            <p className="text-xs text-muted-foreground font-medium">Select end date</p>
            <Calendar
              mode="single"
              selected={tempTo}
              onSelect={(d) => {
                setTempTo(d);
                if (d && tempFrom && d >= tempFrom) {
                  onCustomChange(tempFrom, d);
                  onRangeChange("custom");
                  setCalOpen(false);
                }
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
