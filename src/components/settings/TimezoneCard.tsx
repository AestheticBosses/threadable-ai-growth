import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TIMEZONES = [
  // US
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Adak",
  "Pacific/Honolulu",
  // Canada
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
  // Latin America
  "America/Mexico_City",
  "America/Bogota",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Lima",
  "America/Santiago",
  // Europe
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Zurich",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Moscow",
  "Europe/Istanbul",
  // Middle East / Africa
  "Asia/Dubai",
  "Asia/Riyadh",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  // Asia
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Manila",
  "Asia/Jakarta",
  // Oceania
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Brisbane",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

function formatTzLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find((p) => p.type === "timeZoneName")?.value || "";
    const city = tz.split("/").pop()?.replace(/_/g, " ") || tz;
    return `${city} (${offset})`;
  } catch {
    return tz;
  }
}

interface TimezoneCardProps {
  currentTimezone: string | null;
  onSaved: () => void;
}

export function TimezoneCard({ currentTimezone, onSaved }: TimezoneCardProps) {
  const { user } = useAuth();
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(currentTimezone || detected);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ timezone })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Timezone updated");
      onSaved();
    } catch {
      toast.error("Failed to update timezone");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-primary" />
          Timezone
        </CardTitle>
        <CardDescription>
          Used to schedule posts at the right local time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {formatTzLabel(tz)}
                {tz === detected && " • detected"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save Timezone"}
        </Button>
      </CardContent>
    </Card>
  );
}
