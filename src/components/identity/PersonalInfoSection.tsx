import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Pencil, Info, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePersonalInfo } from "@/hooks/useIdentityData";

export function PersonalInfoSection() {
  const { data, isLoading, add, update, remove, isAdding } = usePersonalInfo();
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await add({ content: newContent.trim() } as any);
    setNewContent(""); setAdding(false);
    toast({ title: "Info added ✅" });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await update({ id: editingId, content: editContent.trim() });
    setEditingId(null);
    toast({ title: "Info updated ✅" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" /> Personal information
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Key facts about yourself that help personalize your content. Threadable learns about you as you use it and will automatically add information here over time.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1 shrink-0">
            <Plus className="h-3 w-3" />Add info
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <div className="flex gap-2 items-center">
            <Input placeholder="e.g. Currently serves as CMO of a seven-figure med spa" value={newContent} onChange={(e) => setNewContent(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="text-sm" />
            <Button size="sm" onClick={handleAdd} disabled={isAdding}><Check className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3 w-3" /></Button>
          </div>
        )}
        {data.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            {editingId === item.id ? (
              <div className="flex flex-1 gap-2 items-center">
                <Input value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUpdate()} className="text-sm" />
                <Button size="sm" onClick={handleUpdate}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <>
                <p className="flex-1 text-sm text-foreground">{item.content}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(item.id); setEditContent(item.content); }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => { await remove(item.id); toast({ title: "Info deleted" }); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </>
            )}
          </div>
        ))}
        {data.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-4">No personal info yet. Add facts about yourself above.</p>
        )}
      </CardContent>
    </Card>
  );
}
