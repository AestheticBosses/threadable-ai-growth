import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  pinned: boolean;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageMetadata {
  type: "drafted_post";
  post_text: string;
  analysis: {
    angle: string;
    hook: string;
    content: string;
    ending: string;
    improvements: string[];
  } | null;
  status: "draft" | "queued" | "scheduled" | "published";
  queue_id: string | null;
  published_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: ChatMessageMetadata | null;
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

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("chat_sessions" as any)
        .update({
          pinned,
          pinned_at: pinned ? new Date().toISOString() : null,
        } as any)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      // Delete messages first
      await supabase
        .from("chat_messages" as any)
        .delete()
        .eq("session_id", id);
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
    togglePin: togglePin.mutateAsync,
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
    mutationFn: async ({
      content,
      role,
      metadata,
    }: {
      content: string;
      role: "user" | "assistant";
      metadata?: ChatMessageMetadata | null;
    }) => {
      const insertData: any = {
        session_id: sessionId,
        user_id: user!.id,
        role,
        content,
      };
      if (metadata) insertData.metadata = metadata;
      const { data, error } = await supabase
        .from("chat_messages" as any)
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data as any as ChatMessage;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMessageMetadata = useMutation({
    mutationFn: async ({
      messageId,
      metadata,
    }: {
      messageId: string;
      metadata: Partial<ChatMessageMetadata>;
    }) => {
      // Fetch current metadata first
      const { data: current } = await supabase
        .from("chat_messages" as any)
        .select("metadata")
        .eq("id", messageId)
        .single();
      const existing = (current as any)?.metadata || {};
      const { error } = await supabase
        .from("chat_messages" as any)
        .update({ metadata: { ...existing, ...metadata } } as any)
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    sendMessage: sendMessage.mutateAsync,
    updateMessageMetadata: updateMessageMetadata.mutateAsync,
    refetch: query.refetch,
  };
}
