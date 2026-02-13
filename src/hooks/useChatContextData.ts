import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ContextStory {
  title: string;
  story: string;
  lesson: string;
  tags: string[];
}

export interface ContextOffer {
  id: string;
  name: string;
  description: string;
}

export interface ContextKnowledgeItem {
  id: string;
  title: string;
  type: string;
  content: string | null;
}

export interface ContextPost {
  id: string;
  text_content: string;
  views: number;
  engagement_rate: number;
}

export interface ChatContextData {
  stories: ContextStory[];
  offers: ContextOffer[];
  knowledge: ContextKnowledgeItem[];
  topPosts: ContextPost[];
  isLoading: boolean;
}

export function useChatContextData(): ChatContextData {
  const { user } = useAuth();

  const storiesQuery = useQuery({
    queryKey: ["chat-context-stories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_story_vault" as any)
        .select("data")
        .eq("user_id", user!.id)
        .eq("section", "stories")
        .maybeSingle();
      if (error) throw error;
      const raw = (data as any)?.data;
      if (Array.isArray(raw)) return raw as ContextStory[];
      if (raw?.items && Array.isArray(raw.items)) return raw.items as ContextStory[];
      return [];
    },
    enabled: !!user?.id,
  });

  const offersQuery = useQuery({
    queryKey: ["chat-context-offers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_offers" as any)
        .select("id, name, description")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data as any[]) as ContextOffer[];
    },
    enabled: !!user?.id,
  });

  const knowledgeQuery = useQuery({
    queryKey: ["chat-context-knowledge", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base" as any)
        .select("id, title, type, content")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as ContextKnowledgeItem[];
    },
    enabled: !!user?.id,
  });

  const postsQuery = useQuery({
    queryKey: ["chat-context-posts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts_analyzed")
        .select("id, text_content, views, engagement_rate")
        .eq("user_id", user!.id)
        .eq("source", "own")
        .not("text_content", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(5);
      if (error) throw error;
      return ((data ?? []) as any[]).filter(
        (p) => p.text_content && p.text_content.trim() !== ""
      ) as ContextPost[];
    },
    enabled: !!user?.id,
  });

  return {
    stories: storiesQuery.data ?? [],
    offers: offersQuery.data ?? [],
    knowledge: knowledgeQuery.data ?? [],
    topPosts: postsQuery.data ?? [],
    isLoading: storiesQuery.isLoading || offersQuery.isLoading || knowledgeQuery.isLoading || postsQuery.isLoading,
  };
}
