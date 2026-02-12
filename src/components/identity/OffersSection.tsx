import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Pencil, ShoppingBag, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useOffers, type Offer } from "@/hooks/useIdentityData";

export function OffersSection() {
  const { data, isLoading, add, update, remove, isAdding } = useOffers();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await add({ name: newName.trim(), description: newDesc.trim() } as any);
    setNewName(""); setNewDesc(""); setAdding(false);
    toast({ title: "Offer added ✅" });
  };

  const startEdit = (o: Offer) => {
    setEditingId(o.id); setEditName(o.name); setEditDesc(o.description);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await update({ id: editingId, name: editName.trim(), description: editDesc.trim() });
    setEditingId(null);
    toast({ title: "Offer updated ✅" });
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    toast({ title: "Offer deleted" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4 text-primary" /> Your offers
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">The products or services you provide to your audience.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1 shrink-0">
            <Plus className="h-3 w-3" />Add offer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Input placeholder="Offer name" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-sm" />
            <Textarea placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} className="text-sm resize-none" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={isAdding} className="gap-1">
                {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        )}
        {data.map((o) => (
          <div key={o.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            {editingId === o.id ? (
              <div className="flex-1 space-y-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm" />
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="text-sm resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdate} className="gap-1"><Check className="h-3 w-3" />Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.name}</p>
                  {o.description && <p className="text-xs text-muted-foreground mt-1">{o.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(o)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(o.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </>
            )}
          </div>
        ))}
        {data.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-4">No offers yet. Add your first offer above.</p>
        )}
      </CardContent>
    </Card>
  );
}
