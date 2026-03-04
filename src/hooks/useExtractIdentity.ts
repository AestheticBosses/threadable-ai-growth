import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { ExtractedIdentity } from "@/components/identity/IdentityReviewModal";

type ExtractionPhase = "idle" | "identity" | "vault" | "done";

export function useExtractIdentity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedIdentity | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [phase, setPhase] = useState<ExtractionPhase>("idle");

  const extract = async () => {
    if (!user) return;
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-identity", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      if (data?.error === "no_posts") {
        toast({ title: "No posts found", description: "Fetch your posts first so we can analyze your content.", variant: "destructive" });
        return;
      }
      if (data?.error) throw new Error(data.error);
      setExtractedData(data.data);
      setPostCount(data.post_count);
      setShowReview(true);
    } catch (e: any) {
      console.error("extract-identity error:", e);
      toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const saveAll = async (data: ExtractedIdentity) => {
    if (!user) return;
    setIsSaving(true);
    try {
      // 1. Upsert about_you, desired_perception, main_goal into user_identity
      const { data: existing } = await supabase
        .from("user_identity" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if ((existing as any)?.id) {
        await supabase
          .from("user_identity" as any)
          .update({
            about_you: data.about_you,
            desired_perception: data.desired_perception,
            main_goal: data.main_goal,
          } as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("user_identity" as any)
          .insert({
            user_id: user.id,
            about_you: data.about_you,
            desired_perception: data.desired_perception,
            main_goal: data.main_goal,
          } as any);
      }

      // 2. Save stories to user_story_vault
      if (data.stories.length > 0) {
        const storyEntries = data.stories.map((s) => ({
          title: s.title,
          story: s.body,
          lesson: s.key_lesson,
          tags: [],
        }));

        const { data: existingVault } = await supabase
          .from("user_story_vault" as any)
          .select("id")
          .eq("user_id", user.id)
          .eq("section", "stories")
          .maybeSingle();

        if ((existingVault as any)?.id) {
          await supabase
            .from("user_story_vault" as any)
            .update({ data: storyEntries as any })
            .eq("id", (existingVault as any).id);
        } else {
          await supabase
            .from("user_story_vault" as any)
            .insert({ user_id: user.id, section: "stories", data: storyEntries as any } as any);
        }
      }

      // 3. Delete existing data to prevent duplicates on re-runs
      await Promise.all([
        supabase.from("user_offers").delete().eq("user_id", user.id),
        supabase.from("user_audiences").delete().eq("user_id", user.id),
        supabase.from("user_personal_info").delete().eq("user_id", user.id),
      ]);

      // 4. Insert offers into user_offers
      if (data.offers.length > 0) {
        const offerInserts = data.offers.map((o) => ({
          user_id: user.id,
          name: o.name,
          description: o.description,
        }));
        await supabase.from("user_offers").insert(offerInserts);
      }

      // 5. Insert audiences into user_audiences
      if (data.target_audiences.length > 0) {
        const audienceInserts = data.target_audiences.map((name) => ({
          user_id: user.id,
          name,
        }));
        await supabase.from("user_audiences").insert(audienceInserts);
      }

      // 6. Insert personal info into user_personal_info
      if (data.personal_info.length > 0) {
        const infoInserts = data.personal_info.map((content) => ({
          user_id: user.id,
          content,
        }));
        await supabase.from("user_personal_info").insert(infoInserts);
      }

      // Invalidate all identity queries (keys must include user.id to match consuming hooks)
      qc.invalidateQueries({ queryKey: ["user-identity", user.id] });
      qc.invalidateQueries({ queryKey: ["user-identity-full", user.id] });
      qc.invalidateQueries({ queryKey: ["story-vault"] });
      qc.invalidateQueries({ queryKey: ["user-offers", user.id] });
      qc.invalidateQueries({ queryKey: ["user-audiences", user.id] });
      qc.invalidateQueries({ queryKey: ["user-personal-info", user.id] });

      setShowReview(false);
      setExtractedData(null);

      // Step 2: Run vault extraction (KB, numbers, untapped angles)
      setPhase("vault");
      try {
        const { data: vaultData, error: vaultError } = await supabase.functions.invoke("extract-vault-entries");
        if (vaultError) throw vaultError;
        if (vaultData?.error) throw new Error(vaultData.error);
        const { stories = 0, numbers = 0, knowledge_base = 0, untapped_angles = 0 } = vaultData;
        qc.invalidateQueries({ queryKey: ["story-vault"] });
        qc.invalidateQueries({ queryKey: ["knowledge-base"] });
        qc.invalidateQueries({ queryKey: ["content-strategies"] });
        toast({
          title: "Full extraction complete! ✅",
          description: `Identity saved + ${knowledge_base} knowledge entries, ${numbers} numbers, ${untapped_angles} angles extracted.`,
        });
      } catch (vaultErr: any) {
        console.error("vault extraction error:", vaultErr);
        toast({ title: "Identity saved, but vault extraction failed", description: "You can run 'Extract from Posts' on the Knowledge Base page.", variant: "destructive" });
      }
      setPhase("done");
    } catch (e: any) {
      console.error("save identity error:", e);
      toast({ title: "Save failed", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setPhase("idle");
    }
  };

  return {
    extract,
    isExtracting,
    saveAll,
    isSaving,
    extractedData,
    postCount,
    showReview,
    setShowReview,
  };
}
