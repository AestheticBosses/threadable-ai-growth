import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Trash2, Plus, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ExtractedIdentity {
  about_you: string;
  stories: { title: string; body: string; key_lesson: string }[];
  offers: { name: string; description: string }[];
  target_audiences: string[];
  personal_info: string[];
  desired_perception: string;
  main_goal: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ExtractedIdentity;
  onSave: (data: ExtractedIdentity) => Promise<void>;
  onReanalyze: () => void;
  isSaving: boolean;
}

export function IdentityReviewModal({ open, onClose, data, onSave, onReanalyze, isSaving }: Props) {
  const [form, setForm] = useState<ExtractedIdentity>(data);
  const [newAudience, setNewAudience] = useState("");
  const [newInfo, setNewInfo] = useState("");

  const updateField = <K extends keyof ExtractedIdentity>(key: K, value: ExtractedIdentity[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const removeStory = (i: number) => updateField("stories", form.stories.filter((_, j) => j !== i));
  const removeOffer = (i: number) => updateField("offers", form.offers.filter((_, j) => j !== i));
  const removeAudience = (i: number) => updateField("target_audiences", form.target_audiences.filter((_, j) => j !== i));
  const removeInfo = (i: number) => updateField("personal_info", form.personal_info.filter((_, j) => j !== i));

  const addAudience = () => {
    if (!newAudience.trim()) return;
    updateField("target_audiences", [...form.target_audiences, newAudience.trim()]);
    setNewAudience("");
  };

  const addInfo = () => {
    if (!newInfo.trim()) return;
    updateField("personal_info", [...form.personal_info, newInfo.trim()]);
    setNewInfo("");
  };

  const updateStory = (i: number, field: string, value: string) => {
    const updated = [...form.stories];
    updated[i] = { ...updated[i], [field]: value };
    updateField("stories", updated);
  };

  const updateOffer = (i: number, field: string, value: string) => {
    const updated = [...form.offers];
    updated[i] = { ...updated[i], [field]: value };
    updateField("offers", updated);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            We analyzed your posts and found this about you
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review and edit anything before saving to your Identity.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="px-6 py-4 space-y-6">
            {/* About You */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">About You</h3>
              <Textarea
                value={form.about_you}
                onChange={(e) => updateField("about_you", e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Stories */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Stories ({form.stories.length})</h3>
              {form.stories.map((s, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={s.title}
                      onChange={(e) => updateStory(i, "title", e.target.value)}
                      placeholder="Title"
                      className="text-sm"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeStory(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={s.body}
                    onChange={(e) => updateStory(i, "body", e.target.value)}
                    rows={2}
                    placeholder="Story"
                    className="text-sm resize-none"
                  />
                  <Input
                    value={s.key_lesson}
                    onChange={(e) => updateStory(i, "key_lesson", e.target.value)}
                    placeholder="Key lesson"
                    className="text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Offers */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Offers ({form.offers.length})</h3>
              {form.offers.map((o, i) => (
                <div key={i} className="flex gap-2 items-start rounded-lg border border-border p-3">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={o.name}
                      onChange={(e) => updateOffer(i, "name", e.target.value)}
                      placeholder="Name"
                      className="text-sm"
                    />
                    <Textarea
                      value={o.description}
                      onChange={(e) => updateOffer(i, "description", e.target.value)}
                      rows={2}
                      placeholder="Description"
                      className="text-sm resize-none"
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeOffer(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Target Audiences */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Target Audiences</h3>
              <div className="flex flex-wrap gap-2">
                {form.target_audiences.map((a, i) => (
                  <Badge key={i} variant="outline" className="text-xs gap-1 cursor-pointer py-1 px-2" onClick={() => removeAudience(i)}>
                    {a} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newAudience}
                  onChange={(e) => setNewAudience(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAudience())}
                  placeholder="Add audience..."
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={addAudience} className="shrink-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Personal Information ({form.personal_info.length})</h3>
              {form.personal_info.map((info, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <Input
                    value={info}
                    onChange={(e) => {
                      const updated = [...form.personal_info];
                      updated[i] = e.target.value;
                      updateField("personal_info", updated);
                    }}
                    className="text-sm border-0 p-0 h-auto focus-visible:ring-0"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeInfo(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newInfo}
                  onChange={(e) => setNewInfo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInfo())}
                  placeholder="Add info..."
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={addInfo} className="shrink-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Desired Perception */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">How you want to be perceived</h3>
              <Textarea
                value={form.desired_perception}
                onChange={(e) => updateField("desired_perception", e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Main Goal */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Main current goal</h3>
              <Textarea
                value={form.main_goal}
                onChange={(e) => updateField("main_goal", e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={onReanalyze}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Re-analyze
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Skip for now</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={isSaving}
              className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Save All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
