import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface KnowledgeItem {
  id: string;
  user_id: string;
  title: string;
  type: "text" | "url" | "document" | "video";
  content: string | null;
  file_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  raw_content: string | null;
  processed: boolean;
  processing_error: string | null;
  summary: string | null;
}

export function useKnowledgeBase() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["knowledge-base", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as KnowledgeItem[];
    },
    enabled: !!user?.id,
  });

  const addMutation = useMutation({
    mutationFn: async (item: Pick<KnowledgeItem, "title" | "type" | "content" | "file_path" | "tags">) => {
      const { data, error } = await supabase
        .from("knowledge_base" as any)
        .insert({ ...item, user_id: user!.id } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<Pick<KnowledgeItem, "title" | "content" | "tags">>) => {
      const { error } = await supabase
        .from("knowledge_base" as any)
        .update(fields as any)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: KnowledgeItem) => {
      // Delete file from storage if document type
      if (item.type === "document" && item.file_path) {
        await supabase.storage.from("knowledge-docs").remove([item.file_path]);
      }
      const { error } = await supabase
        .from("knowledge_base" as any)
        .delete()
        .eq("id", item.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const uploadFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("knowledge-docs").upload(path, file);
    if (error) throw error;
    return path;
  };

  const processItem = async (knowledgeId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await supabase.functions.invoke("process-knowledge", {
        body: { knowledge_id: knowledgeId, user_id: user!.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (e) {
      console.error("Processing error:", e);
    }
    qc.invalidateQueries({ queryKey });
  };

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    uploadFile,
    processItem,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: query.refetch,
  };
}
