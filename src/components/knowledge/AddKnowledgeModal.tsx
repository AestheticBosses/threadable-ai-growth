import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import { cn } from "@/lib/utils";

const TABS = ["Text", "URL", "Document", "Video"] as const;
type TabType = "text" | "url" | "document" | "video";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddKnowledgeModal({ open, onOpenChange }: Props) {
  const { add, uploadFile, isAdding } = useKnowledgeBase();
  const [tab, setTab] = useState<TabType>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(""); setContent(""); setUrl(""); setTags([]); setTagInput(""); setFile(null); setTab("text");
  };

  const addTag = () => {
    const t = tagInput.trim().slice(0, 40);
    if (!t || tags.length >= 5 || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }

    try {
      let filePath: string | null = null;

      if (tab === "text" && !content.trim()) {
        toast({ title: "Content is required", variant: "destructive" }); return;
      }
      if (tab === "url" && !url.trim()) {
        toast({ title: "URL is required", variant: "destructive" }); return;
      }
      if (tab === "video" && !url.trim()) {
        toast({ title: "Video URL is required", variant: "destructive" }); return;
      }
      if (tab === "document") {
        if (!file) { toast({ title: "Please select a file", variant: "destructive" }); return; }
        filePath = await uploadFile(file);
      }

      await add({
        title: title.trim(),
        type: tab,
        content: tab === "text" ? content : (tab === "url" || tab === "video") ? url : null,
        file_path: filePath,
        tags,
      });

      toast({ title: "Added to Knowledge Base ✅" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t.toLowerCase() as TabType)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.toLowerCase() ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A descriptive title helps you find this content later ({title.length}/100)
            </p>
          </div>

          {/* Tab-specific content */}
          {tab === "text" && (
            <div>
              <Textarea
                placeholder="Enter your text content here (minimum 100 words)..."
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 50000))}
                rows={8}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">{content.length}/50,000 characters</p>
            </div>
          )}

          {tab === "url" && (
            <Input
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-sm"
            />
          )}

          {tab === "video" && (
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-sm"
            />
          )}

          {tab === "document" && (
            <div>
              <input
                type="file"
                ref={fileRef}
                accept=".pdf,.txt,.md,.docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">.pdf, .txt, .md, .docx</p>
              </button>
            </div>
          )}

          {/* Tags */}
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => setTags(tags.filter((_, j) => j !== i))}>
                  {tag} <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <Input
                  placeholder="Add tags..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  className="text-sm h-8"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={addTag}>
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isAdding} className="gap-1">
            {isAdding && <Loader2 className="h-3 w-3 animate-spin" />}
            Add to Knowledge Base
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
