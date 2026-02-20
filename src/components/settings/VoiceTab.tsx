import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STYLE_OPTIONS = [
  { value: "conversational", label: "Conversational" },
  { value: "direct", label: "Direct" },
  { value: "storytelling", label: "Storytelling" },
  { value: "educational", label: "Educational" },
  { value: "provocative", label: "Provocative" },
];

export function VoiceTab() {
  const { user } = useAuth();
  const [selectedStyle, setSelectedStyle] = useState("conversational");
  const [customDesc, setCustomDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_writing_style")
        .select("selected_style, custom_style_description")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSelectedStyle(data.selected_style ?? "conversational");
        setCustomDesc(data.custom_style_description ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { selected_style: selectedStyle, custom_style_description: customDesc };

    const { data: existing } = await supabase
      .from("user_writing_style")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("user_writing_style").update(payload).eq("user_id", user.id);
    } else {
      await supabase.from("user_writing_style").insert({ ...payload, user_id: user.id });
    }
    toast.success("Voice saved");
    setSaving(false);
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Your Voice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Writing Style</Label>
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="custom_voice">Describe your voice in your own words</Label>
          <Textarea
            id="custom_voice"
            placeholder="e.g. I write like I'm texting a smart friend — casual but sharp, no fluff."
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            rows={4}
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Voice
        </Button>
      </CardContent>
    </Card>
  );
}
