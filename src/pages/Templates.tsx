import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  archetype: string;
  template_text: string;
  example_text: string | null;
  is_default: boolean;
  sort_order: number;
}

const Templates = () => {
  usePageTitle("Templates", "Create and manage post templates for each archetype");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterArchetype, setFilterArchetype] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [formArchetype, setFormArchetype] = useState("");
  const [formText, setFormText] = useState("");
  const [formExample, setFormExample] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["content_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_templates")
        .select("*")
        .order("archetype")
        .order("sort_order");
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!user,
  });

  // Get unique archetypes
  const archetypes = [...new Set(templates.map((t) => t.archetype))];

  const filtered = filterArchetype === "all" ? templates : templates.filter((t) => t.archetype === filterArchetype);

  // Group by archetype
  const grouped = filtered.reduce<Record<string, Template[]>>((acc, t) => {
    (acc[t.archetype] = acc[t.archetype] || []).push(t);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!formArchetype.trim() || !formText.trim()) throw new Error("Archetype and template text are required");

      if (editingTemplate) {
        const { error } = await supabase
          .from("content_templates")
          .update({ archetype: formArchetype, template_text: formText, example_text: formExample || null })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_templates").insert({
          user_id: user.id,
          archetype: formArchetype,
          template_text: formText,
          example_text: formExample || null,
          sort_order: templates.filter((t) => t.archetype === formArchetype).length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content_templates"] });
      setModalOpen(false);
      resetForm();
      toast.success(editingTemplate ? "Template updated" : "Template created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content_templates"] });
      setDeleteTarget(null);
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setEditingTemplate(null);
    setFormArchetype("");
    setFormText("");
    setFormExample("");
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setFormArchetype(t.archetype);
    setFormText(t.template_text);
    setFormExample(t.example_text || "");
    setModalOpen(true);
  };

  const openNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleDraft = (t: Template) => {
    navigate(`/chat?prefill=${encodeURIComponent(`Write a post using this template:\n\n${t.template_text}`)}`);
  };

  const canDelete = (t: Template) => {
    const sameArchetype = templates.filter((x) => x.archetype === t.archetype);
    return sameArchetype.length > 1;
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Templates</h1>
            <p className="mt-1 text-muted-foreground text-sm">Create and manage post templates for each archetype.</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterArchetype} onValueChange={setFilterArchetype}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter archetypes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Archetypes</SelectItem>
                {archetypes.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <Sparkles className="h-10 w-10 text-primary" />
            <p className="text-foreground font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Templates are auto-created when you generate your playbook, or you can create them manually.
            </p>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Your First Template
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([archetype, items]) => (
              <Card key={archetype}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">{archetype}</h3>
                      <Badge variant="secondary" className="text-[10px]">{items.length} template{items.length > 1 ? "s" : ""}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => { setFormArchetype(archetype); openNew(); }}>
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((t, i) => (
                      <div key={t.id} className="px-5 py-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Template {i + 1}{t.is_default ? " (Default)" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive"
                              disabled={!canDelete(t)}
                              onClick={() => setDeleteTarget(t)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed bg-muted/50 rounded-lg p-3 border border-border">
                          {t.template_text}
                        </pre>
                        {t.example_text && (
                          <p className="text-xs text-muted-foreground italic">Example: {t.example_text}</p>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => handleDraft(t)}>
                          <FileText className="h-3 w-3" /> Draft Post
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetForm(); } else setModalOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Archetype</label>
              <Input
                value={formArchetype}
                onChange={(e) => setFormArchetype(e.target.value)}
                placeholder="e.g. Authority Insider Drop"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Template Text</label>
              <Textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Use [brackets] for fill-in-the-blank sections..."
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Example (optional)</label>
              <Textarea
                value={formExample}
                onChange={(e) => setFormExample(e.target.value)}
                placeholder="A concrete example of this template filled in..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Templates;
