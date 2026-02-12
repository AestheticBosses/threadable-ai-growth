import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useContentPreferences } from "@/hooks/useVoiceSettings";

export function ContentPreferencesSection() {
  const { preferences, isLoading, addPref, updatePref, deletePref, isAdding } = useContentPreferences();
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await addPref(newContent.trim());
    setNewContent(""); setAdding(false);
    toast({ title: "Preference added ✅" });
  };

  const handleUpdate = async () => {
    if (!editingId || !editContent.trim()) return;
    await updatePref({ id: editingId, content: editContent.trim() });
    setEditingId(null);
    toast({ title: "Preference updated ✅" });
  };

  const handleDelete = async (id: string) => {
    await deletePref(id);
    toast({ title: "Preference deleted" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Content preferences</h2>
          <p className="text-sm text-muted-foreground">Your personalized writing rules that guide how AI generates your posts. Threadable learns your likes and dislikes as you use it and will automatically add preferences here over time.</p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-1 shrink-0">
          <Plus className="h-3 w-3" />Add preference
        </Button>
      </div>

      <div className="space-y-2">
        {adding && (
          <Card>
            <CardContent className="p-3">
              <div className="flex gap-2 items-start">
                <Input
                  placeholder="Type your writing preference..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={handleAdd} disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewContent(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {preferences.map((pref) => (
          <Card key={pref.id}>
            <CardContent className="p-3">
              {editingId === pref.id ? (
                <div className="flex gap-2 items-start">
                  <Input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    className="text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleUpdate}><Check className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-sm text-foreground">{pref.content}</p>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(pref.id); setEditContent(pref.content); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(pref.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {preferences.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-4">No preferences yet. Add your first writing preference above.</p>
        )}
      </div>
    </div>
  );
}
