import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export function useExtractVaultEntries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);

  const extract = async () => {
    if (!user || isExtracting) return;
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-vault-entries");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { stories = 0, numbers = 0, knowledge_base = 0, untapped_angles = 0 } = data;
      toast({
        title: `Extracted ${stories} stories, ${numbers} numbers, ${knowledge_base} knowledge entries, ${untapped_angles} new angles`,
      });

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["story-vault"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      queryClient.invalidateQueries({ queryKey: ["content-strategies"] });
    } catch (e: any) {
      toast({ title: "Extraction failed", description: e.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  return { extract, isExtracting };
}
