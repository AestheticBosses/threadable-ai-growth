import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Writing Style
export function useWritingStyle() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["writing-style", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_writing_style" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.selected_style as string | null;
    },
    enabled: !!user?.id,
  });

  const save = useMutation({
    mutationFn: async (style: string) => {
      const { data: existing } = await supabase
        .from("user_writing_style" as any)
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_writing_style" as any)
          .update({ selected_style: style } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_writing_style" as any)
          .insert({ user_id: user!.id, selected_style: style } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    selectedStyle: query.data ?? "threadable",
    isLoading: query.isLoading,
    saveStyle: save.mutateAsync,
    isSaving: save.isPending,
  };
}

// Content Preferences
export interface ContentPref {
  id: string;
  content: string;
  is_default: boolean;
  sort_order: number;
}

const DEFAULT_PREFERENCES = [
  "Write skimmably: Keep paragraphs 1-3 lines max. Add line breaks between every paragraph.",
  "Be conversational: Use contractions (don't, can't), direct 'you' language, and natural tone.",
  "Balance depth and brevity: Cut fluff. Every line should add value.",
  "Don't use emojis: Exclude all emojis from posts, even at the end.",
  "Don't write walls of text: Never write more than 3 consecutive lines without a break.",
  "Use provocative, attention-grabbing hooks that challenge conventional thinking.",
  "Employ short, punchy sentences and frequent line breaks for easy scanning and emphasis.",
  "Leverage storytelling through personal examples and case studies to build credibility.",
  "Be specific and unique: Avoid vague advice and generic statements.",
];

export function useContentPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["content-preferences", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_preferences" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const items = (data as any[]) as ContentPref[];

      // Seed defaults if none exist
      if (items.length === 0) {
        const inserts = DEFAULT_PREFERENCES.map((content, i) => ({
          user_id: user!.id,
          content,
          is_default: true,
          sort_order: i,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from("content_preferences" as any)
          .insert(inserts as any)
          .select();
        if (seedErr) throw seedErr;
        return (seeded as any[]) as ContentPref[];
      }

      return items;
    },
    enabled: !!user?.id,
  });

  const addPref = useMutation({
    mutationFn: async (content: string) => {
      const maxOrder = Math.max(0, ...(query.data ?? []).map((p) => p.sort_order));
      const { error } = await supabase
        .from("content_preferences" as any)
        .insert({ user_id: user!.id, content, sort_order: maxOrder + 1 } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updatePref = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("content_preferences" as any)
        .update({ content } as any)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deletePref = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("content_preferences" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    preferences: query.data ?? [],
    isLoading: query.isLoading,
    addPref: addPref.mutateAsync,
    updatePref: updatePref.mutateAsync,
    deletePref: deletePref.mutateAsync,
    isAdding: addPref.isPending,
  };
}
