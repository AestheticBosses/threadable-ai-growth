import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, CalendarDays, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActionsCard() {
  const navigate = useNavigate();

  const actions = [
    { label: "Generate Posts", icon: Sparkles, path: "/queue", accent: true },
    { label: "Ask Threadable", icon: MessageSquare, path: "/chat" },
    { label: "Content Plan", icon: CalendarDays, path: "/playbook" },
    { label: "View Insights", icon: BarChart3, path: "/insights" },
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          ⚡ Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant={a.accent ? "default" : "outline"}
              className={`h-auto py-3 flex flex-col gap-1.5 ${
                a.accent ? "bg-primary hover:bg-primary/90" : ""
              }`}
              onClick={() => navigate(a.path)}
            >
              <a.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{a.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
