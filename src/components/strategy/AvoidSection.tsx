import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  items: string[];
}

export function AvoidSection({ items }: Props) {
  if (!items?.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Things to Avoid
      </h2>
      <Card className="border-destructive/20">
        <CardContent className="py-4">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-destructive mt-0.5">✕</span>
                <p className="text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
