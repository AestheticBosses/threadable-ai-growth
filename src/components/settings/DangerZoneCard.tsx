import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, UserX, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function DangerZoneCard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [deletingContent, setDeletingContent] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [resettingOnboarding, setResettingOnboarding] = useState(false);

  const handleResetOnboarding = async () => {
    if (!user) return;
    setResettingOnboarding(true);
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_complete: false, niche: null, dream_client: null, end_goal: null })
        .eq("id", user.id);

      // Keep posts_analyzed & follower_snapshots — real Threads data, not generated content
      await Promise.all([
        supabase.from("content_strategies").delete().eq("user_id", user.id),
        supabase.from("scheduled_posts").delete().eq("user_id", user.id),
        supabase.from("user_plans").delete().eq("user_id", user.id),
        supabase.from("user_writing_style").delete().eq("user_id", user.id),
        supabase.from("user_identity").delete().eq("user_id", user.id),
        supabase.from("user_story_vault").delete().eq("user_id", user.id),
        supabase.from("user_offers").delete().eq("user_id", user.id),
        supabase.from("user_audiences").delete().eq("user_id", user.id),
        supabase.from("user_personal_info").delete().eq("user_id", user.id),
        supabase.from("user_sales_funnel").delete().eq("user_id", user.id),
        supabase.from("competitor_accounts").delete().eq("user_id", user.id),
        supabase.from("voice_samples").delete().eq("user_id", user.id),
        supabase.from("knowledge_base").delete().eq("user_id", user.id),
        supabase.from("content_templates").delete().eq("user_id", user.id),
        supabase.from("content_preferences").delete().eq("user_id", user.id),
        supabase.from("weekly_reports").delete().eq("user_id", user.id),
        supabase.from("chat_messages").delete().eq("user_id", user.id),
        supabase.from("chat_sessions").delete().eq("user_id", user.id),
      ]);

      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success("Onboarding reset — redirecting…");
      navigate("/onboarding");
    } catch {
      toast.error("Failed to reset onboarding");
      setResettingOnboarding(false);
    }
  };

  const handleDeleteContent = async () => {
    if (!user) return;
    setDeletingContent(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("All generated content deleted");
    } catch {
      toast.error("Failed to delete content");
    } finally {
      setDeletingContent(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      // Delete user data from all tables
      await Promise.all([
        supabase.from("scheduled_posts").delete().eq("user_id", user.id),
        supabase.from("content_strategies").delete().eq("user_id", user.id),
        supabase.from("posts_analyzed").delete().eq("user_id", user.id),
        supabase.from("weekly_reports").delete().eq("user_id", user.id),
        supabase.from("voice_samples").delete().eq("user_id", user.id),
        supabase.from("competitor_accounts").delete().eq("user_id", user.id),
        supabase.from("follower_snapshots").delete().eq("user_id", user.id),
      ]);

      // Delete profile
      await supabase.from("profiles").delete().eq("id", user.id);

      // Sign out
      await signOut();
      toast.success("Account deleted");
      navigate("/login");
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <>
      {resettingOnboarding && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-4">
          <div className="animate-spin w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full" />
          <p className="text-white text-xl font-semibold">Resetting your account...</p>
          <p className="text-gray-400 text-sm">This will just take a moment</p>
        </div>
      )}
      <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible actions — proceed with caution</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reset onboarding */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Reset Onboarding</p>
            <p className="text-xs text-muted-foreground">Start fresh without disconnecting Threads</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset onboarding?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all your content, strategies, identity, and analysis data. Your Threads connection will remain intact. You'll be redirected to start onboarding again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetOnboarding}
                  disabled={resettingOnboarding}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {resettingOnboarding ? "Resetting…" : "Yes, Reset Everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Delete generated content */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete All Generated Content</p>
            <p className="text-xs text-muted-foreground">Removes all scheduled and draft posts</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all generated content?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your scheduled posts, drafts, and generated content. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteContent}
                  disabled={deletingContent}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingContent ? "Deleting…" : "Delete All Content"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Delete account */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete My Account</p>
            <p className="text-xs text-muted-foreground">Permanently remove all data and sign out</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <UserX className="h-4 w-4 mr-1.5" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, all posts, strategies, analytics data, and voice profile. This action is irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingAccount ? "Deleting…" : "Yes, Delete My Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      </Card>
    </>
  );
}
