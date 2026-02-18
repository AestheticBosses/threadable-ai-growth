import { useState } from "react";
import { X, Loader2, Check, Zap, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: "consistency",
    name: "Consistency",
    price: "$49",
    description: "Build a reliable posting habit",
    features: [
      "1 account",
      "150 AI-generated posts/mo",
      "Basic scheduling",
      "Performance analytics",
    ],
  },
  {
    id: "inbound",
    name: "Inbound",
    price: "$99",
    description: "Grow your audience with strategy",
    features: [
      "3 accounts",
      "500 AI-generated posts/mo",
      "Full content strategy",
      "Advanced scheduling",
      "Competitor analysis",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  {
    id: "operator",
    name: "Operator",
    price: "$249",
    description: "Scale your content operation",
    features: [
      "10 accounts",
      "1,000 AI-generated posts/mo",
      "Pillar balancing",
      "Analytics export",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: "$349",
    description: "Unlimited power for teams",
    features: [
      "Unlimited accounts",
      "Unlimited AI posts",
      "Client workspaces",
      "White-label reports",
      "Dedicated support",
    ],
  },
];

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ plan: planId }),
        }
      );

      const data = await resp.json();

      if (!resp.ok || data.error) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast({
        title: "Checkout failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[900px] w-full bg-card border border-border p-0 overflow-hidden">
        <DialogTitle className="sr-only">Upgrade your plan</DialogTitle>

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center border-b border-border">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Upgrade required</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Unlock AI content generation</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Choose a plan to start generating posts, drafting ideas, and publishing to Threads — all powered by your strategy.
          </p>
        </div>

        {/* Plans grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-xl border p-5 flex flex-col gap-4 transition-colors",
                plan.highlighted
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <h3 className="font-bold text-foreground text-base">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>

              <ul className="flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", plan.highlighted ? "text-primary" : "text-muted-foreground")} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  "w-full text-sm",
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
                disabled={!!loadingPlan}
                onClick={() => handleSubscribe(plan.id)}
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Subscribe"
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-muted-foreground">
            Secure checkout powered by Stripe. Cancel anytime. No hidden fees.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
