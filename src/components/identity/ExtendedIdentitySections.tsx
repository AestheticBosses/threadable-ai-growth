import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Eye, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function useIdentityExtended() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-identity-full", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_identity" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any as { id: string; about_you: string | null; desired_perception: string | null; main_goal: string | null } | null;
    },
    enabled: !!user?.id,
  });

  const mutation = useMutation({
    mutationFn: async (fields: { desired_perception?: string; main_goal?: string }) => {
      const { data: existing } = await supabase
        .from("user_identity" as any)
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_identity" as any)
          .update(fields as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_identity" as any)
          .insert({ user_id: user!.id, ...fields } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-identity-full", user?.id] }),
  });

  return { data: query.data, isLoading: query.isLoading, save: mutation.mutateAsync, isSaving: mutation.isPending };
}

export function DesiredPerceptionSection() {
  const { data, isLoading, save, isSaving } = useIdentityExtended();
  const [text, setText] = useState("");

  useEffect(() => {
    if (data !== undefined) {
      setText(data?.desired_perception || "");
    }
  }, [data]);

  const handleSave = async () => {
    await save({ desired_perception: text });
    toast({ title: "Perception saved ✅" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-primary" /> How do you want to be perceived online?
        </CardTitle>
        <p className="text-xs text-muted-foreground">The impression you want to leave on your audience.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="e.g. I want to be seen as a trusted authority in my niche who delivers actionable advice..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}

export function MainGoalSection() {
  const { data, isLoading, save, isSaving } = useIdentityExtended();
  const [text, setText] = useState("");

  useEffect(() => {
    if (data !== undefined) {
      setText(data?.main_goal || "");
    }
  }, [data]);

  const handleSave = async () => {
    await save({ main_goal: text });
    toast({ title: "Goal saved ✅" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> Main current goal
        </CardTitle>
        <p className="text-xs text-muted-foreground">Your primary business or content goal right now.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="e.g. Grow to 10K followers and launch my course by Q3..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}
