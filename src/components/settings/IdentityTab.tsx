import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function IdentityTab() {
  const { user } = useAuth();
  const [aboutYou, setAboutYou] = useState("");
  const [desiredPerception, setDesiredPerception] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_identity")
        .select("about_you, desired_perception, main_goal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setAboutYou(data.about_you ?? "");
        setDesiredPerception(data.desired_perception ?? "");
        setMainGoal(data.main_goal ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { about_you: aboutYou, desired_perception: desiredPerception, main_goal: mainGoal };

    const { data: existing } = await supabase
      .from("user_identity")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("user_identity").update(payload).eq("user_id", user.id);
    } else {
      await supabase.from("user_identity").insert({ ...payload, user_id: user.id });
    }
    toast.success("Identity saved");
    setSaving(false);
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg">Your Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="about_you">About You</Label>
          <Textarea
            id="about_you"
            placeholder="Who are you? What do you do? What's your story?"
            value={aboutYou}
            onChange={(e) => setAboutYou(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desired_perception">Desired Perception</Label>
          <Input
            id="desired_perception"
            placeholder="How do you want people to see you?"
            value={desiredPerception}
            onChange={(e) => setDesiredPerception(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="main_goal">Main Goal</Label>
          <Input
            id="main_goal"
            placeholder="What's the #1 thing you want from your content?"
            value={mainGoal}
            onChange={(e) => setMainGoal(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Identity
        </Button>
      </CardContent>
    </Card>
  );
}
