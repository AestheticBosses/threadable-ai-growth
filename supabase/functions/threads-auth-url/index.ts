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
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const THREADS_APP_ID = Deno.env.get("THREADS_APP_ID")!;
    const THREADS_REDIRECT_URI = Deno.env.get("THREADS_REDIRECT_URI")!;

    const params = new URLSearchParams({
      client_id: THREADS_APP_ID,
      redirect_uri: THREADS_REDIRECT_URI,
      scope: "threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies",
      response_type: "code",
      state: userId,
    });

    const authUrl = `https://threads.net/oauth/authorize?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
