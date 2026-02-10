import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface NumberEntry {
  label: string;
  value: string;
  context: string;
}

export interface StoryEntry {
  title: string;
  story: string;
  lesson: string;
  tags: string[];
}

export interface OfferEntry {
  offer_name: string;
  price: string;
  description: string;
  target_audience: string;
  cta_phrase: string;
  link: string;
}

export interface AudienceData {
  description: string;
  pain_points: string[];
  desires: string[];
  language_they_use: string[];
}

type SectionType = "numbers" | "stories" | "offers" | "audience";

function useVaultSection<T>(section: SectionType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["story-vault", section, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_story_vault" as any)
        .select("id, data")
        .eq("user_id", user!.id)
        .eq("section", section)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.data as T | null;
    },
    enabled: !!user?.id,
  });

  const mutation = useMutation({
    mutationFn: async (newData: T) => {
      const { data: existing } = await supabase
        .from("user_story_vault" as any)
        .select("id")
        .eq("user_id", user!.id)
        .eq("section", section)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_story_vault" as any)
          .update({ data: newData as any })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_story_vault" as any)
          .insert({ user_id: user!.id, section, data: newData as any } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-vault", section, user?.id] });
    },
  });

  return { data: query.data ?? null, isLoading: query.isLoading, save: mutation.mutateAsync, isSaving: mutation.isPending };
}

export function useNumbers() {
  return useVaultSection<NumberEntry[]>("numbers");
}

export function useStories() {
  return useVaultSection<StoryEntry[]>("stories");
}

export function useOffers() {
  return useVaultSection<OfferEntry[]>("offers");
}

export function useAudience() {
  return useVaultSection<AudienceData>("audience");
}
