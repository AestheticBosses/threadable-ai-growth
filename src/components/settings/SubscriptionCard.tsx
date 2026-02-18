import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Loader2, ExternalLink, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PaywallModal } from "@/components/PaywallModal";

interface SubscriptionCardProps {
  plan: string;
  status: string;
  aiPostsUsed: number;
  aiPostsLimit: number;
  isPaid: boolean;
  onRefetch: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  consistency: "Consistency",
  inbound: "Inbound",
  operator: "Operator",
  agency: "Agency",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-500 border-green-500/30",
  past_due: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  canceled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function SubscriptionCard({ plan, status, aiPostsUsed, aiPostsLimit, isPaid, onRefetch }: SubscriptionCardProps) {
  const [isManaging, setIsManaging] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const usagePct = aiPostsLimit > 0 ? Math.min(100, (aiPostsUsed / aiPostsLimit) * 100) : 0;

  const handleManageSubscription = async () => {
    setIsManaging(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await resp.json();

      if (!resp.ok || data.error) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast({
        title: "Could not open billing portal",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsManaging(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Subscription
          </CardTitle>
          <CardDescription>Your current plan and AI usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan + Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {PLAN_LABELS[plan] ?? plan} Plan
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[status] ?? STATUS_COLORS.active}`}
              >
                {status}
              </span>
            </div>
            {isPaid ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleManageSubscription}
                disabled={isManaging}
              >
                {isManaging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                Manage Subscription
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setPaywallOpen(true)}
              >
                <Zap className="h-3.5 w-3.5" />
                Upgrade
              </Button>
            )}
          </div>

          {/* AI Posts usage */}
          {isPaid ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>AI posts used this period</span>
                <span>
                  {aiPostsUsed.toLocaleString()} / {aiPostsLimit === 999999 ? "∞" : aiPostsLimit.toLocaleString()}
                </span>
              </div>
              {aiPostsLimit < 999999 && (
                <Progress value={usagePct} className="h-1.5" />
              )}
              {aiPostsLimit === 999999 && (
                <div className="text-xs text-muted-foreground">Unlimited AI posts included</div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-accent/40 p-4">
              <p className="text-sm text-muted-foreground">
                You're on the <span className="font-medium text-foreground">Free plan</span>. Upgrade to generate AI posts, draft ideas, and publish content directly to Threads.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  );
}
