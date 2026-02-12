import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Save, Hash } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNumbers, type NumberEntry } from "@/hooks/useStoryVault";

export function NumbersSection() {
  const { data, isLoading, save, isSaving } = useNumbers();
  const [items, setItems] = useState<NumberEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && data) {
    setItems(data);
    setInitialized(true);
  }
  if (!initialized && !isLoading && !data) {
    setItems([{ label: "", value: "", context: "" }]);
    setInitialized(true);
  }

  const handleSave = async () => {
    const valid = items.filter((i) => i.label.trim() || i.value.trim());
    await save(valid);
    toast({ title: "Numbers saved ✅" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="h-4 w-4 text-primary" /> My Numbers
        </CardTitle>
        <p className="text-xs text-muted-foreground">Real metrics the AI can reference. Never made up.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
            <Input placeholder="Label (e.g. Monthly Revenue)" value={item.label} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], label: e.target.value }; setItems(n); }} className="text-sm" />
            <Input placeholder="Value (e.g. $350K/m)" value={item.value} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], value: e.target.value }; setItems(n); }} className="text-sm" />
            <Input placeholder="Context (e.g. Natura Med Spa)" value={item.context} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], context: e.target.value }; setItems(n); }} className="text-sm" />
            <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { label: "", value: "", context: "" }])} className="gap-1"><Plus className="h-3 w-3" />Add</Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">{isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
