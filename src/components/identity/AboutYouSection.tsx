import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAboutYou } from "@/hooks/useIdentityData";

export function AboutYouSection() {
  const { data, isLoading, save, isSaving } = useAboutYou();
  const [text, setText] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && data !== undefined) {
      setText(data || "");
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSave = async () => {
    await save(text);
    toast({ title: "About you saved ✅" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> About you
        </CardTitle>
        <p className="text-xs text-muted-foreground">Your professional background and what makes you unique.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Write a 2-4 sentence professional summary about yourself..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="text-sm resize-none"
        />
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}
