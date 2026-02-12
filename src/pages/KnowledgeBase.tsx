import { useState, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Search, FileText, Pencil, Trash2, Globe, Video, File } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useKnowledgeBase, type KnowledgeItem } from "@/hooks/useKnowledgeBase";
import { AddKnowledgeModal } from "@/components/knowledge/AddKnowledgeModal";
import { cn } from "@/lib/utils";

const typeBadgeStyles: Record<string, string> = {
  text: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  url: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  document: "bg-green-500/15 text-green-400 border-green-500/30",
  video: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const typeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-3.5 w-3.5" />,
  url: <Globe className="h-3.5 w-3.5" />,
  document: <File className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
};

const KnowledgeBase = () => {
  usePageTitle("Knowledge Base", "Upload content for the AI to learn from");
  const { data, isLoading, remove, isDeleting } = useKnowledgeBase();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<KnowledgeItem | null>(null);

  const filtered = useMemo(() => {
    let items = [...data];
    if (search.length >= 3) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") {
      items = items.filter((i) => i.type === typeFilter);
    }
    items.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return items;
  }, [data, search, typeFilter, sort]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await remove(deleteItem);
      toast({ title: "Knowledge item deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setDeleteItem(null);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Knowledge base</h1>
            <p className="mt-1 text-muted-foreground">
              Upload content for the AI to learn from and reference when creating your posts.
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" />Add knowledge
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title (min. 3 characters)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="w-[120px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-foreground">No knowledge items yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Add Knowledge" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <Badge variant="outline" className={cn("text-[10px] gap-1 capitalize", typeBadgeStyles[item.type])}>
                            {typeIcons[item.type]} {item.type}
                          </Badge>
                        </div>
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {item.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {item.content && (
                          <p className={cn("text-xs text-muted-foreground", !isExpanded && "line-clamp-2")}>
                            {item.content}
                          </p>
                        )}
                        {item.type === "document" && item.file_path && !item.content && (
                          <p className="text-xs text-muted-foreground italic">Document uploaded</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteItem(item); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AddKnowledgeModal open={modalOpen} onOpenChange={setModalOpen} />

      <AlertDialog open={!!deleteItem} onOpenChange={(v) => !v && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete knowledge item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteItem?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default KnowledgeBase;
