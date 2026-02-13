import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStep {
  key: string;
  label: string;
  complete: boolean;
  navigateTo: string;
}

export function useOnboardingProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["onboarding-progress", user?.id],
    queryFn: async (): Promise<OnboardingStep[]> => {
      if (!user?.id) return [];

      const [profileRes, postsRes, identityRes, writingStyleRes, plansRes, queueRes, publishedRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("threads_access_token, threads_token_expires_at")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("posts_analyzed")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("source", "own"),
          supabase
            .from("user_identity" as any)
            .select("about_you")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("user_writing_style")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("user_plans")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("scheduled_posts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("scheduled_posts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "published"),
        ]);

      const profile = profileRes.data;
      const hasToken = !!profile?.threads_access_token;
      const tokenExpired = profile?.threads_token_expires_at
        ? new Date(profile.threads_token_expires_at) < new Date()
        : false;

      const steps: OnboardingStep[] = [
        { key: "account", label: "Create account", complete: true, navigateTo: "/" },
        { key: "threads", label: "Connect Threads", complete: hasToken && !tokenExpired, navigateTo: "/settings" },
        { key: "fetch", label: "Fetch posts", complete: (postsRes.count ?? 0) > 0, navigateTo: "/dashboard" },
        { key: "identity", label: "Fill Identity", complete: !!(identityRes.data as any)?.about_you, navigateTo: "/my-story" },
        { key: "voice", label: "Train Voice", complete: (writingStyleRes.count ?? 0) > 0, navigateTo: "/voice" },
        { key: "plans", label: "Generate Plans", complete: (plansRes.count ?? 0) > 0, navigateTo: "/playbook" },
        { key: "create_post", label: "Create first post", complete: (queueRes.count ?? 0) > 0, navigateTo: "/queue" },
        { key: "publish", label: "Publish first post", complete: (publishedRes.count ?? 0) > 0, navigateTo: "/queue" },
      ];

      return steps;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
