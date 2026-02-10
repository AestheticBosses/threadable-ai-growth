import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AnalyzedPost {
  id: string;
  text_content: string | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  engagement_rate: number | null;
  posted_at: string | null;
  day_of_week: string | null;
  hour_posted: number | null;
  content_category: string | null;
  word_count: number | null;
  char_count: number | null;
  has_question: boolean | null;
  has_credibility_marker: boolean | null;
  has_emoji: boolean | null;
  has_hashtag: boolean | null;
  has_url: boolean | null;
  starts_with_number: boolean | null;
  sentiment_score: number | null;
  source: string | null;
}

export type Archetype = "Vault Drop" | "Truth Bomb" | "Hot Take" | "Window";

export function classifyArchetype(text: string | null): Archetype {
  if (!text) return "Truth Bomb";
  const lower = text.toLowerCase();
  if (/\d+[\.\)]\s|here'?s|framework|steps|breakdown/i.test(lower)) return "Vault Drop";
  if (/opinion|controversial|unpopular|hot take/i.test(lower)) return "Hot Take";
  if (/behind the scenes|real talk|just .*(lost|quit|failed|sitting|recording)/i.test(lower)) return "Window";
  if ((text.split(/\s+/).filter(Boolean).length ?? 0) < 30) return "Truth Bomb";
  return "Truth Bomb";
}

export function usePostsAnalyzed() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["posts-analyzed-own", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("posts_analyzed")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "own")
        .not("text_content", "is", null)
        .order("views", { ascending: false });
      if (error) throw error;
      // Extra client-side filter: remove empty/mock entries
      return ((data ?? []) as AnalyzedPost[]).filter(
        (p) => p.text_content && p.text_content.trim() !== "" && !p.text_content.startsWith("Mock post")
      );
    },
    enabled: !!userId,
  });
}
