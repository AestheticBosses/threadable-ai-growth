import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

const KB_TYPES = [
  { value: "story", label: "Story" },
  { value: "offer", label: "Offer" },
  { value: "proof", label: "Proof" },
  { value: "fact", label: "Fact" },
  { value: "belief", label: "Belief" },
];

export function KnowledgeBaseTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("story");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["knowledge-base", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("knowledge_base")
        .select("id, title, type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleAdd = async () => {
    if (!user || !title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    await supabase.from("knowledge_base").insert({
      user_id: user.id,
      title: title.trim(),
      type,
      raw_content: content.trim(),
      processed: false,
    });
    toast.success("Entry added");
    setTitle("");
    setType("story");
    setContent("");
    setShowForm(false);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["knowledge-base", user.id] });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    await supabase.from("knowledge_base").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Entry deleted");
    setDeletingId(null);
    queryClient.invalidateQueries({ queryKey: ["knowledge-base", user.id] });
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Knowledge Base</CardTitle>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Entry
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="e.g. My origin story" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                placeholder="Paste the full content here…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Entry
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : entries && entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="text-xs shrink-0 capitalize">
                    {entry.type}
                  </Badge>
                  <span className="text-sm font-medium text-foreground truncate">{entry.title}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                >
                  {deletingId === entry.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No entries yet. Add stories, offers, and beliefs to shape your AI-generated content.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
