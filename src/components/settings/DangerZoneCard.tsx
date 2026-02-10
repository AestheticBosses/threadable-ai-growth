import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, UserX } from "lucide-react";
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
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible actions — proceed with caution</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
  );
}
