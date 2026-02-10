import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, Hash, BookOpen, ShoppingBag, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useNumbers, useStories, useOffers, useAudience,
  type NumberEntry, type StoryEntry, type OfferEntry, type AudienceData,
} from "@/hooks/useStoryVault";

function NumbersSection() {
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

function StoriesSection() {
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

function OffersSection() {
  const { data, isLoading, save, isSaving } = useOffers();
  const [items, setItems] = useState<OfferEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && data) { setItems(data); setInitialized(true); }
  if (!initialized && !isLoading && !data) { setItems([{ offer_name: "", price: "", description: "", target_audience: "", cta_phrase: "", link: "" }]); setInitialized(true); }

  const handleSave = async () => {
    const valid = items.filter((i) => i.offer_name.trim());
    await save(valid);
    toast({ title: "Offers saved ✅" });
  };

  const update = (i: number, field: keyof OfferEntry, val: string) => {
    const n = [...items]; n[i] = { ...n[i], [field]: val }; setItems(n);
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-4 w-4 text-primary" /> My Offers
        </CardTitle>
        <p className="text-xs text-muted-foreground">What you're selling. Used for BOF (bottom-of-funnel) posts.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex gap-2">
              <Input placeholder="Offer name" value={item.offer_name} onChange={(e) => update(i, "offer_name", e.target.value)} className="text-sm" />
              <Input placeholder="Price" value={item.price} onChange={(e) => update(i, "price", e.target.value)} className="text-sm w-28" />
              <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Textarea placeholder="Description" value={item.description} onChange={(e) => update(i, "description", e.target.value)} rows={2} className="text-sm resize-none" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Target audience" value={item.target_audience} onChange={(e) => update(i, "target_audience", e.target.value)} className="text-sm" />
              <Input placeholder="CTA phrase (e.g. DM me SCALE)" value={item.cta_phrase} onChange={(e) => update(i, "cta_phrase", e.target.value)} className="text-sm" />
              <Input placeholder="Link" value={item.link} onChange={(e) => update(i, "link", e.target.value)} className="text-sm" />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { offer_name: "", price: "", description: "", target_audience: "", cta_phrase: "", link: "" }])} className="gap-1"><Plus className="h-3 w-3" />Add Offer</Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">{isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AudienceSection() {
  const { data, isLoading, save, isSaving } = useAudience();
  const [form, setForm] = useState<AudienceData>({ description: "", pain_points: [], desires: [], language_they_use: [] });
  const [initialized, setInitialized] = useState(false);
  const [inputs, setInputs] = useState({ pain: "", desire: "", lang: "" });

  if (!initialized && data) { setForm(data); setInitialized(true); }
  if (!initialized && !isLoading && !data) { setInitialized(true); }

  const handleSave = async () => {
    await save(form);
    toast({ title: "Audience saved ✅" });
  };

  const addItem = (field: "pain_points" | "desires" | "language_they_use", inputKey: "pain" | "desire" | "lang") => {
    const val = inputs[inputKey].trim();
    if (!val) return;
    setForm({ ...form, [field]: [...form[field], val] });
    setInputs({ ...inputs, [inputKey]: "" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" /> My Audience
        </CardTitle>
        <p className="text-xs text-muted-foreground">Who you're talking to. Shapes tone and content.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea placeholder="Describe your ideal audience..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-sm resize-none" />

        {(["pain_points", "desires", "language_they_use"] as const).map((field) => {
          const inputKey = field === "pain_points" ? "pain" : field === "desires" ? "desire" : "lang";
          const label = field === "pain_points" ? "Pain Points" : field === "desires" ? "Desires" : "Language They Use";
          return (
            <div key={field}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form[field].map((item, i) => (
                  <Badge key={i} variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => setForm({ ...form, [field]: form[field].filter((_, j) => j !== i) })}>
                    {item} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder={`Add ${label.toLowerCase()}...`} value={inputs[inputKey]} onChange={(e) => setInputs({ ...inputs, [inputKey]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(field, inputKey))} className="text-sm h-8" />
                <Button size="sm" variant="outline" className="h-8" onClick={() => addItem(field, inputKey)}>Add</Button>
              </div>
            </div>
          );
        })}

        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}

const MyStory = () => {
  usePageTitle("My Story", "Your real data vault for AI content generation");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Story</h1>
          <p className="mt-1 text-muted-foreground">
            Your real data vault. The AI uses ONLY these facts — never makes anything up.
          </p>
        </div>

        <NumbersSection />
        <StoriesSection />
        <OffersSection />
        <AudienceSection />
      </div>
    </AppLayout>
  );
};

export default MyStory;
