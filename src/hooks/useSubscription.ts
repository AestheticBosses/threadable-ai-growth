import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionData {
  plan: string;
  status: string;
  aiPostsUsed: number;
  aiPostsLimit: number;
  isLoading: boolean;
  canGenerate: boolean;
  isPaid: boolean;
  refetch: () => void;
}

export function useSubscription(): SubscriptionData {
  const { user } = useAuth();
  const [plan, setPlan] = useState("free");
  const [status, setStatus] = useState("active");
  const [aiPostsUsed, setAiPostsUsed] = useState(0);
  const [aiPostsLimit, setAiPostsLimit] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, status, ai_posts_used, ai_posts_limit")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setPlan(data.plan ?? "free");
        setStatus(data.status ?? "active");
        setAiPostsUsed(data.ai_posts_used ?? 0);
        setAiPostsLimit(data.ai_posts_limit ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Realtime subscription to changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`subscription-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            setPlan(row.plan ?? "free");
            setStatus(row.status ?? "active");
            setAiPostsUsed(row.ai_posts_used ?? 0);
            setAiPostsLimit(row.ai_posts_limit ?? 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const isPaid = plan !== "free" && status === "active";
  // Unlimited plans use 999999 as the limit sentinel
  const canGenerate =
    !isLoading &&
    plan !== "free" &&
    status === "active" &&
    (aiPostsLimit === 999999 || aiPostsUsed < aiPostsLimit);

  console.log("[useSubscription]", { plan, status, aiPostsUsed, aiPostsLimit, isLoading, canGenerate, isPaid });

  return {
    plan,
    status,
    aiPostsUsed,
    aiPostsLimit,
    isLoading,
    canGenerate,
    isPaid,
    refetch: fetchSubscription,
  };
}
