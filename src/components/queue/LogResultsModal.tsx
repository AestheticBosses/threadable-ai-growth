import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface LogResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  userId: string;
  existingResult?: {
    id: string;
    comments_received: number | null;
    link_clicks: number | null;
    dm_replies: number | null;
    is_estimated: boolean;
  } | null;
  onSaved: () => void;
}

export function LogResultsModal({
  open,
  onOpenChange,
  postId,
  userId,
  existingResult,
  onSaved,
}: LogResultsModalProps) {
  const [comments, setComments] = useState(existingResult?.comments_received?.toString() || "");
  const [clicks, setClicks] = useState(existingResult?.link_clicks?.toString() || "");
  const [dmReplies, setDmReplies] = useState(existingResult?.dm_replies?.toString() || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        user_id: userId,
        post_id: postId,
        comments_received: comments ? parseInt(comments) : null,
        link_clicks: clicks ? parseInt(clicks) : null,
        dm_replies: dmReplies ? parseInt(dmReplies) : null,
        is_estimated: false,
      };

      if (existingResult?.id) {
        await supabase
          .from("post_results")
          .update(data)
          .eq("id", existingResult.id);
      } else {
        await supabase.from("post_results").insert(data);
      }

      toast({ title: "Results logged ✅" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Log Results
          </DialogTitle>
          <DialogDescription>
            Track how this post performed. All fields are optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comments">Comments received</Label>
            <Input
              id="comments"
              type="number"
              min="0"
              placeholder="0"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clicks">Link clicks</Label>
            <Input
              id="clicks"
              type="number"
              min="0"
              placeholder="0"
              value={clicks}
              onChange={(e) => setClicks(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dm-replies">DM replies received</Label>
            <Input
              id="dm-replies"
              type="number"
              min="0"
              placeholder="0"
              value={dmReplies}
              onChange={(e) => setDmReplies(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save Results
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
