import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Save, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ContentPreferencesCardProps {
  maxPostsPerDay: number;
  includeCredibilityMarkers: boolean;
  autoApproveAiPosts: boolean;
  generateWeekendPosts: boolean;
  onSaved: () => void;
}

export function ContentPreferencesCard({
  maxPostsPerDay,
  includeCredibilityMarkers,
  autoApproveAiPosts,
  generateWeekendPosts,
  onSaved,
}: ContentPreferencesCardProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    maxPostsPerDay,
    includeCredibilityMarkers,
    autoApproveAiPosts,
    generateWeekendPosts,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          max_posts_per_day: form.maxPostsPerDay,
          include_credibility_markers: form.includeCredibilityMarkers,
          auto_approve_ai_posts: form.autoApproveAiPosts,
          generate_weekend_posts: form.generateWeekendPosts,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Preferences saved");
      onSaved();
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          Content Preferences
        </CardTitle>
        <CardDescription>Control how content is generated and scheduled</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max posts per day */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Max posts per day</Label>
            <span className="text-sm font-mono font-medium text-primary">{form.maxPostsPerDay}</span>
          </div>
           <Slider
            value={[form.maxPostsPerDay]}
            onValueChange={([v]) => setForm((f) => ({ ...f, maxPostsPerDay: v }))}
            min={1}
            max={15}
            step={1}
          />
          <p className="text-xs text-muted-foreground">Between 1 and 15 posts per day</p>
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include credibility markers</Label>
              <p className="text-xs text-muted-foreground">Add stats, quotes, or proof points to posts</p>
            </div>
            <Switch
              checked={form.includeCredibilityMarkers}
              onCheckedChange={(v) => setForm((f) => ({ ...f, includeCredibilityMarkers: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-approve AI posts</Label>
              <p className="text-xs text-muted-foreground">Skip draft status, go straight to approved</p>
            </div>
            <Switch
              checked={form.autoApproveAiPosts}
              onCheckedChange={(v) => setForm((f) => ({ ...f, autoApproveAiPosts: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Generate weekend posts</Label>
              <p className="text-xs text-muted-foreground">Include Saturday and Sunday in content plans</p>
            </div>
            <Switch
              checked={form.generateWeekendPosts}
              onCheckedChange={(v) => setForm((f) => ({ ...f, generateWeekendPosts: v }))}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
