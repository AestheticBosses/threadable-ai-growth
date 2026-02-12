import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function useChatSessions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["chat-sessions", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as ChatSession[];
    },
    enabled: !!user?.id,
  });

  const createSession = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions" as any)
        .insert({ user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as any as ChatSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateTitle = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("chat_sessions" as any)
        .update({ title } as any)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chat_sessions" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    createSession: createSession.mutateAsync,
    updateTitle: updateTitle.mutateAsync,
    deleteSession: deleteSession.mutateAsync,
  };
}

export function useChatMessages(sessionId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["chat-messages", sessionId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages" as any)
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as ChatMessage[];
    },
    enabled: !!sessionId && !!user?.id,
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, role }: { content: string; role: "user" | "assistant" }) => {
      const { data, error } = await supabase
        .from("chat_messages" as any)
        .insert({ session_id: sessionId, user_id: user!.id, role, content } as any)
        .select()
        .single();
      if (error) throw error;
      return data as any as ChatMessage;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    sendMessage: sendMessage.mutateAsync,
    refetch: query.refetch,
  };
}
