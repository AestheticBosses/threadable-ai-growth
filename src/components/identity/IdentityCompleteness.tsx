import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Square, Sparkles, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
  scrollId: string;
}

export function IdentityCompleteness() {
  const { user } = useAuth();

  const { data: sections, isLoading } = useQuery({
    queryKey: ["identity-completeness", user?.id],
    queryFn: async (): Promise<Section[]> => {
      if (!user?.id) return [];

      const [identityRes, storiesRes, numbersRes, offersRes, audiencesRes, personalRes, funnelRes] =
        await Promise.all([
          supabase.from("user_identity" as any).select("about_you, desired_perception, main_goal").eq("user_id", user.id).maybeSingle(),
          supabase.from("user_story_vault").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("user_story_vault").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("section", "numbers"),
          supabase.from("user_offers" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("user_audiences" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("user_personal_info" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("user_sales_funnel" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);

      const id = identityRes.data as any;

      // Stories are stored with section = 'stories', numbers with section = 'numbers'
      // But storiesRes counts ALL story_vault rows. Let's query specifically.
      const { count: storyCount } = await supabase
        .from("user_story_vault")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("section", "stories");

      return [
        { key: "about", label: "About You", weight: 15, complete: !!id?.about_you, scrollId: "about-you" },
        { key: "stories", label: "Stories", weight: 15, complete: (storyCount ?? 0) > 0, scrollId: "stories" },
        { key: "numbers", label: "Numbers", weight: 10, complete: (numbersRes.count ?? 0) > 0, scrollId: "numbers" },
        { key: "offers", label: "Offers", weight: 15, complete: (offersRes.count ?? 0) > 0, scrollId: "offers" },
        { key: "audiences", label: "Audiences", weight: 10, complete: (audiencesRes.count ?? 0) > 0, scrollId: "audiences" },
        { key: "personal", label: "Personal Info", weight: 5, complete: (personalRes.count ?? 0) >= 3, scrollId: "personal-info" },
        { key: "perception", label: "Perception", weight: 10, complete: !!id?.desired_perception, scrollId: "perception" },
        { key: "goal", label: "Goal", weight: 10, complete: !!id?.main_goal, scrollId: "goal" },
        { key: "funnel", label: "Sales Funnel", weight: 10, complete: (funnelRes.count ?? 0) >= 2, scrollId: "funnel" },
      ];
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  if (isLoading || !sections) return null;

  const pct = sections.reduce((sum, s) => sum + (s.complete ? s.weight : 0), 0);
  const allComplete = pct === 100;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card className={cn(allComplete && "border-primary/30")}>
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Identity Completeness</span>
          <span className="text-sm font-bold text-foreground">{pct}%</span>
        </div>

        <Progress value={pct} className="h-2" />

        <div className="flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => !s.complete && scrollTo(s.scrollId)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                s.complete
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "border border-border bg-secondary text-foreground/60 hover:bg-secondary/80 cursor-pointer"
              )}
            >
              {s.complete ? <Check className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              {s.label}
            </button>
          ))}
        </div>

        {allComplete ? (
          <p className="text-xs text-primary flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Your Identity is complete! The AI has full context for your content.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            Complete your Identity for more personalized AI content
          </p>
        )}
      </CardContent>
    </Card>
  );
}
