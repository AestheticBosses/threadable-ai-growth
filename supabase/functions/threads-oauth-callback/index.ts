import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Supabase user ID
    const error = url.searchParams.get("error");

    const APP_URL = Deno.env.get("APP_URL")!;
    const THREADS_APP_ID = Deno.env.get("THREADS_APP_ID")!;
    const THREADS_APP_SECRET = Deno.env.get("THREADS_APP_SECRET")!;
    const THREADS_REDIRECT_URI = Deno.env.get("THREADS_REDIRECT_URI")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (error) {
      console.error("OAuth error from Threads:", error);
      return Response.redirect(`${APP_URL}/onboarding?threads_error=${error}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${APP_URL}/onboarding?threads_error=missing_params`, 302);
    }

    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: THREADS_APP_ID,
        client_secret: THREADS_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: THREADS_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Short-lived token exchange failed:", errBody);
      return Response.redirect(`${APP_URL}/onboarding?threads_error=token_exchange_failed`, 302);
    }

    const { access_token: shortToken } = await tokenRes.json();

    // Step 2: Exchange for long-lived token (60 days)
    const longTokenUrl = new URL("https://graph.threads.net/access_token");
    longTokenUrl.searchParams.set("grant_type", "th_exchange_token");
    longTokenUrl.searchParams.set("client_secret", THREADS_APP_SECRET);
    longTokenUrl.searchParams.set("access_token", shortToken);

    const longTokenRes = await fetch(longTokenUrl.toString());

    if (!longTokenRes.ok) {
      const errBody = await longTokenRes.text();
      console.error("Long-lived token exchange failed:", errBody);
      return Response.redirect(`${APP_URL}/onboarding?threads_error=long_token_failed`, 302);
    }

    const { access_token: longToken } = await longTokenRes.json();

    // Step 3: Get Threads user profile
    const profileUrl = new URL("https://graph.threads.net/v1.0/me");
    profileUrl.searchParams.set("fields", "id,username,name");
    profileUrl.searchParams.set("access_token", longToken);

    const profileRes = await fetch(profileUrl.toString());

    if (!profileRes.ok) {
      const errBody = await profileRes.text();
      console.error("Threads profile fetch failed:", errBody);
      return Response.redirect(`${APP_URL}/onboarding?threads_error=profile_fetch_failed`, 302);
    }

    const threadsProfile = await profileRes.json();

    // Step 4: Update Supabase profile
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        threads_user_id: threadsProfile.id,
        threads_username: threadsProfile.username,
        threads_access_token: longToken,
        threads_token_expires_at: expiresAt.toISOString(),
      })
      .eq("id", state);

    if (updateError) {
      console.error("Profile update failed:", updateError);
      return Response.redirect(`${APP_URL}/onboarding?threads_error=profile_update_failed`, 302);
    }

    // Step 5: Redirect back to app
    return Response.redirect(`${APP_URL}/onboarding?threads_connected=true&username=${encodeURIComponent(threadsProfile.username)}`, 302);
  } catch (e) {
    console.error("Unexpected error:", e);
    const APP_URL = Deno.env.get("APP_URL") || "";
    return Response.redirect(`${APP_URL}/onboarding?threads_error=unexpected`, 302);
  }
});
