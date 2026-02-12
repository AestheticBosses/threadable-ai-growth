import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Pencil, Users, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAudiences } from "@/hooks/useIdentityData";

export function AudiencesSection() {
  const { data, isLoading, add, update, remove, isAdding } = useAudiences();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await add({ name: newName.trim() } as any);
    setNewName(""); setAdding(false);
    toast({ title: "Audience added ✅" });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await update({ id: editingId, name: editName.trim() });
    setEditingId(null);
    toast({ title: "Audience updated ✅" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Target audience
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">The specific groups of people you create content for.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1 shrink-0">
            <Plus className="h-3 w-3" />Add audience
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <div className="flex gap-2 items-center">
            <Input placeholder="e.g. Med Spa Owners" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="text-sm" />
            <Button size="sm" onClick={handleAdd} disabled={isAdding}><Check className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3 w-3" /></Button>
          </div>
        )}
        {data.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            {editingId === a.id ? (
              <div className="flex flex-1 gap-2 items-center">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUpdate()} className="text-sm" />
                <Button size="sm" onClick={handleUpdate}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <>
                <p className="flex-1 text-sm text-foreground">{a.name}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(a.id); setEditName(a.name); }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => { await remove(a.id); toast({ title: "Audience deleted" }); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </>
            )}
          </div>
        ))}
        {data.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-4">No audiences yet. Add your first target audience above.</p>
        )}
      </CardContent>
    </Card>
  );
}
