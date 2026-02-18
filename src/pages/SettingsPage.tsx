import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ThreadsConnectionCard } from "@/components/settings/ThreadsConnectionCard";
import { ContentPreferencesCard } from "@/components/settings/ContentPreferencesCard";
import { ApiKeysCard } from "@/components/settings/ApiKeysCard";
import { DangerZoneCard } from "@/components/settings/DangerZoneCard";
import { SubscriptionCard } from "@/components/settings/SubscriptionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";

interface ProfileData {
  threads_username: string | null;
  threads_token_expires_at: string | null;
  niche: string | null;
  dream_client: string | null;
  end_goal: string | null;
  max_posts_per_day: number;
  include_credibility_markers: boolean;
  auto_approve_ai_posts: boolean;
  generate_weekend_posts: boolean;
}

const SettingsPage = () => {
  usePageTitle("Settings", "Manage your account, integrations, and preferences");
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { plan, status, aiPostsUsed, aiPostsLimit, isPaid, refetch: refetchSubscription } = useSubscription();

  // Handle Stripe redirect
  useEffect(() => {
    const subscriptionParam = searchParams.get("subscription");
    if (subscriptionParam === "success") {
      toast({
        title: "Subscription activated! 🎉",
        description: "You can now generate content with AI.",
      });
      refetchSubscription();
    }
  }, [searchParams]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("threads_username, threads_token_expires_at, niche, dream_client, end_goal, max_posts_per_day, include_credibility_markers, auto_approve_ai_posts, generate_weekend_posts")
      .eq("id", user.id)
      .single();

    setProfile(data as ProfileData | null);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account, integrations, and preferences.</p>
        </div>

        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : profile ? (
          <>
            <SubscriptionCard
              plan={plan}
              status={status}
              aiPostsUsed={aiPostsUsed}
              aiPostsLimit={aiPostsLimit}
              isPaid={isPaid}
              onRefetch={refetchSubscription}
            />

            <ThreadsConnectionCard
              threadsUsername={profile.threads_username}
              tokenExpiresAt={profile.threads_token_expires_at}
              onDisconnect={fetchProfile}
            />

            <ContentPreferencesCard
              maxPostsPerDay={profile.max_posts_per_day}
              includeCredibilityMarkers={profile.include_credibility_markers}
              autoApproveAiPosts={profile.auto_approve_ai_posts}
              generateWeekendPosts={profile.generate_weekend_posts}
              onSaved={fetchProfile}
            />

            <ApiKeysCard />

            <DangerZoneCard />
          </>
        ) : (
          <p className="text-muted-foreground">Unable to load profile data.</p>
        )}
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
