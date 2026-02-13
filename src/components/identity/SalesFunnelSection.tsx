import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Target, Loader2 } from "lucide-react";

interface FunnelStep {
  id?: string;
  step_number: number;
  step_name: string;
  what: string;
  url: string;
  price: string;
  goal: string;
}

const DEFAULT_STEP: Omit<FunnelStep, "step_number"> = {
  step_name: "",
  what: "",
  url: "",
  price: "",
  goal: "",
};

const AWARENESS_STEP: FunnelStep = {
  step_number: 1,
  step_name: "Awareness",
  what: "Free Threads content — organic posts",
  url: "",
  price: "Free",
  goal: "Get followers, build awareness",
};

export function SalesFunnelSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedSteps, isLoading } = useQuery({
    queryKey: ["sales-funnel", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_sales_funnel" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("step_number");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (savedSteps && savedSteps.length > 0) {
      setSteps(
        savedSteps.map((s: any) => ({
          id: s.id,
          step_number: s.step_number,
          step_name: s.step_name,
          what: s.what || "",
          url: s.url || "",
          price: s.price || "",
          goal: s.goal || "",
        }))
      );
    } else if (savedSteps && savedSteps.length === 0) {
      setSteps([{ ...AWARENESS_STEP }]);
    }
  }, [savedSteps]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      // Delete all existing steps
      await supabase
        .from("user_sales_funnel" as any)
        .delete()
        .eq("user_id", user.id);

      // Insert all current steps
      if (steps.length > 0) {
        const rows = steps.map((s, i) => ({
          user_id: user.id,
          step_number: i + 1,
          step_name: s.step_name,
          what: s.what,
          url: s.url || null,
          price: s.price || null,
          goal: s.goal || null,
        }));
        const { error } = await supabase
          .from("user_sales_funnel" as any)
          .insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-funnel"] });
      queryClient.invalidateQueries({ queryKey: ["identity-completeness"] });
      setHasChanges(false);
      toast.success("Sales funnel saved!");
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to save funnel");
    },
  });

  const updateStep = (index: number, field: keyof FunnelStep, value: string) => {
    setSteps((prev) => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
    setHasChanges(true);
  };

  const addStep = () => {
    if (steps.length >= 8) return;
    setSteps((prev) => [...prev, { ...DEFAULT_STEP, step_number: prev.length + 1 }]);
    setHasChanges(true);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
    setHasChanges(true);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    setSteps((prev) => {
      const updated = [...prev];
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      return updated.map((s, i) => ({ ...s, step_number: i + 1 }));
    });
    setHasChanges(true);
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Your Sales Funnel</h3>
              <p className="text-xs text-muted-foreground">
                Map your customer journey so the AI writes posts that drive each step.
              </p>
            </div>
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-1.5"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Funnel
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-card/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Step {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => moveStep(index, "up")}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, "down")}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Step Name</Label>
                  <Input
                    value={step.step_name}
                    onChange={(e) => updateStep(index, "step_name", e.target.value)}
                    placeholder="e.g. Lead Magnet"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">What is it?</Label>
                  <Input
                    value={step.what}
                    onChange={(e) => updateStep(index, "what", e.target.value)}
                    placeholder="e.g. Free case study PDF"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">URL (optional)</Label>
                  <Input
                    value={step.url}
                    onChange={(e) => updateStep(index, "url", e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Price</Label>
                  <Input
                    value={step.price}
                    onChange={(e) => updateStep(index, "price", e.target.value)}
                    placeholder="e.g. Free, $27, $5,000"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Goal</Label>
                <Input
                  value={step.goal}
                  onChange={(e) => updateStep(index, "goal", e.target.value)}
                  placeholder="e.g. Capture email, convert to buyer"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {steps.length < 8 && (
          <Button variant="outline" size="sm" onClick={addStep} className="gap-1.5 w-full">
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
