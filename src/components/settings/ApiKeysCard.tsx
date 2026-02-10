import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Sparkles } from "lucide-react";

export function ApiKeysCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5 text-primary" />
          AI Configuration
        </CardTitle>
        <CardDescription>AI model access for content generation and analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Lovable AI is active</p>
            <p className="text-xs text-muted-foreground">
              This project uses Lovable AI for content generation, scoring, and strategy analysis. No external API keys are required — everything is handled automatically.
            </p>
            <Badge variant="secondary" className="mt-2 text-xs">No configuration needed</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
