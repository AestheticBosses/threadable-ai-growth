import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useStories, type StoryEntry } from "@/hooks/useStoryVault";

export function StoriesSection() {
  const { data, isLoading, save, isSaving } = useStories();
  const [items, setItems] = useState<StoryEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [tagInput, setTagInput] = useState<Record<number, string>>({});

  if (!initialized && data) { setItems(data); setInitialized(true); }
  if (!initialized && !isLoading && !data) { setItems([{ title: "", story: "", lesson: "", tags: [] }]); setInitialized(true); }

  const handleSave = async () => {
    const valid = items.filter((i) => i.title.trim() || i.story.trim());
    await save(valid);
    toast({ title: "Stories saved ✅" });
  };

  const addTag = (idx: number) => {
    const tag = (tagInput[idx] || "").trim();
    if (!tag) return;
    const n = [...items];
    n[idx] = { ...n[idx], tags: [...(n[idx].tags || []), tag] };
    setItems(n);
    setTagInput({ ...tagInput, [idx]: "" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" /> My Stories
        </CardTitle>
        <p className="text-xs text-muted-foreground">Real experiences the AI can reference in posts.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex gap-2">
              <Input placeholder="Title" value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; setItems(n); }} className="text-sm" />
              <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Textarea placeholder="The full story..." value={item.story} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], story: e.target.value }; setItems(n); }} rows={3} className="text-sm resize-none" />
            <Input placeholder="Lesson learned" value={item.lesson} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], lesson: e.target.value }; setItems(n); }} className="text-sm" />
            <div className="flex flex-wrap gap-1.5 items-center">
              {(item.tags || []).map((tag, ti) => (
                <Badge key={ti} variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => { const n = [...items]; n[i] = { ...n[i], tags: n[i].tags.filter((_, j) => j !== ti) }; setItems(n); }}>
                  {tag} ×
                </Badge>
              ))}
              <Input placeholder="Add tag..." value={tagInput[i] || ""} onChange={(e) => setTagInput({ ...tagInput, [i]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(i))} className="text-xs h-7 w-24" />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { title: "", story: "", lesson: "", tags: [] }])} className="gap-1"><Plus className="h-3 w-3" />Add Story</Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">{isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
