import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProfileCardProps {
  niche: string;
  dreamClient: string;
  endGoal: string;
  onSaved: () => void;
}

export function ProfileCard({ niche, dreamClient, endGoal, onSaved }: ProfileCardProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({ niche, dreamClient, endGoal });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          niche: form.niche,
          dream_client: form.dreamClient,
          end_goal: form.endGoal,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          Profile
        </CardTitle>
        <CardDescription>Your niche and growth goals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="niche">Niche</Label>
          <Input
            id="niche"
            placeholder="e.g. SaaS Marketing"
            value={form.niche}
            onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dreamClient">Dream Client</Label>
          <Input
            id="dreamClient"
            placeholder="e.g. Series A startup founders"
            value={form.dreamClient}
            onChange={(e) => setForm((f) => ({ ...f, dreamClient: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endGoal">End Goal</Label>
          <Textarea
            id="endGoal"
            placeholder="e.g. Build authority and drive inbound leads"
            value={form.endGoal}
            onChange={(e) => setForm((f) => ({ ...f, endGoal: e.target.value }))}
            className="min-h-[80px]"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
