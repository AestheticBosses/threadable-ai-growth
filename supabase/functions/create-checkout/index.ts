import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_PRICES: Record<string, string> = {
  consistency: Deno.env.get("STRIPE_PRICE_CONSISTENCY") || "",
  inbound: Deno.env.get("STRIPE_PRICE_INBOUND") || "",
  operator: Deno.env.get("STRIPE_PRICE_OPERATOR") || "",
  agency: Deno.env.get("STRIPE_PRICE_AGENCY") || "",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

async function stripeRequest(endpoint: string, body: Record<string, string>) {
  const resp = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { plan } = await req.json();
    const priceId = PLAN_PRICES[plan];
    if (!priceId) throw new Error(`Invalid plan: ${plan}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripeRequest("/customers", {
        email: user.email || "",
        "metadata[supabase_user_id]": user.id,
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const session = await stripeRequest("/checkout/sessions", {
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/settings?subscription=success`,
      cancel_url: `${req.headers.get("origin")}/settings?subscription=canceled`,
      "subscription_data[trial_period_days]": "7",
      "metadata[plan]": plan,
      "metadata[user_id]": user.id,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
