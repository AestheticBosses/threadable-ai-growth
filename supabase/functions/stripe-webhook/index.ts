import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const PLAN_LIMITS: Record<string, number> = {
  consistency: 150,
  inbound: 500,
  operator: 1000,
  agency: 999999,
  free: 0,
};

const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get("STRIPE_PRICE_CONSISTENCY") || ""]: "consistency",
  [Deno.env.get("STRIPE_PRICE_INBOUND") || ""]: "inbound",
  [Deno.env.get("STRIPE_PRICE_OPERATOR") || ""]: "operator",
  [Deno.env.get("STRIPE_PRICE_AGENCY") || ""]: "agency",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body);
    console.log("[stripe-webhook] Event type:", event.type);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        if (!userId || !plan) break;

        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
          headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
        });
        const stripeSub = await subResp.json();

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan,
          status: "active",
          ai_posts_limit: PLAN_LIMITS[plan] || 0,
          ai_posts_used: 0,
          current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        console.log(`[stripe-webhook] Activated ${plan} for user ${userId}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || "free";

        const { data } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (data) {
          await supabase.from("subscriptions").update({
            plan,
            status: sub.status === "active" ? "active" : sub.status,
            ai_posts_limit: PLAN_LIMITS[plan] || 0,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("user_id", data.user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const { data } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (data) {
          await supabase.from("subscriptions").update({
            plan: "free",
            status: "canceled",
            ai_posts_limit: 0,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          }).eq("user_id", data.user_id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const { data } = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (data) {
            await supabase.from("subscriptions").update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            }).eq("user_id", data.user_id);
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stripe-webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
