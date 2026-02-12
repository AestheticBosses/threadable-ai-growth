import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// About You (user_identity)
export function useAboutYou() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-identity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_identity" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.about_you as string | null;
    },
    enabled: !!user?.id,
  });

  const mutation = useMutation({
    mutationFn: async (aboutYou: string) => {
      const { data: existing } = await supabase
        .from("user_identity" as any)
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_identity" as any)
          .update({ about_you: aboutYou } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_identity" as any)
          .insert({ user_id: user!.id, about_you: aboutYou } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-identity", user?.id] }),
  });

  return { data: query.data ?? "", isLoading: query.isLoading, save: mutation.mutateAsync, isSaving: mutation.isPending };
}

// Generic CRUD hook for simple tables (offers, audiences, personal_info)
interface SimpleRow {
  id: string;
  [key: string]: any;
}

function useSimpleCrud<T extends SimpleRow>(table: string, queryKey: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [queryKey, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[] | null) as T[] | null;
    },
    enabled: !!user?.id,
  });

  const addMutation = useMutation({
    mutationFn: async (item: Omit<T, "id" | "user_id" | "created_at">) => {
      const { error } = await supabase
        .from(table as any)
        .insert({ ...item, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey, user?.id] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<T>) => {
      const { error } = await supabase
        .from(table as any)
        .update(fields as any)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey, user?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey, user?.id] }),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export interface Offer { id: string; name: string; description: string; }
export interface Audience { id: string; name: string; }
export interface PersonalInfo { id: string; content: string; }

export function useOffers() {
  return useSimpleCrud<Offer>("user_offers", "user-offers");
}

export function useAudiences() {
  return useSimpleCrud<Audience>("user_audiences", "user-audiences");
}

export function usePersonalInfo() {
  return useSimpleCrud<PersonalInfo>("user_personal_info", "user-personal-info");
}
