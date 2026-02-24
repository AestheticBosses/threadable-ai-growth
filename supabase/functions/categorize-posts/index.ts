import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch discovered archetypes
    const { data: strategyRow } = await adminClient
      .from("content_strategies")
      .select("strategy_data")
      .eq("user_id", user.id)
      .eq("strategy_type", "archetype_discovery")
      .single();

    const archetypes = (strategyRow?.strategy_data as any)?.archetypes;
    if (!archetypes || !Array.isArray(archetypes) || archetypes.length === 0) {
      return new Response(JSON.stringify({ error: "No archetypes found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch all user posts that need categorization
    const { data: posts, error: postsError } = await adminClient
      .from("posts_analyzed")
      .select("id, text_content")
      .eq("user_id", user.id)
      .eq("source", "own")
      .not("text_content", "is", null)
      .order("views", { ascending: false });

    if (postsError || !posts || posts.length === 0) {
      return new Response(JSON.stringify({ error: "No posts to categorize" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Categorizing ${posts.length} posts into ${archetypes.length} archetypes`);

    // 3. Build archetype descriptions for the prompt
    const archetypeList = archetypes
      .map((a: any) => `- "${a.name}": ${a.description}. Key ingredients: ${(a.key_ingredients || []).join(", ")}`)
      .join("\n");

    const archetypeNames = archetypes.map((a: any) => a.name);

    // 4. Process posts in batches of 50 to stay within token limits
    const BATCH_SIZE = 50;
    let totalUpdated = 0;

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);

      const postsList = batch
        .map((p: any, idx: number) => `[${idx}] ${(p.text_content || "").slice(0, 300)}`)
        .join("\n\n");

      const prompt = `You are classifying social media posts into content archetypes.

Here are the archetypes:
${archetypeList}

Here are the posts to classify. For EACH post, assign the single best-matching archetype name from the list above.

${postsList}

Respond with ONLY a JSON array where each element is the archetype name for the corresponding post index. Example: ["Archetype A", "Archetype B", "Archetype A", ...]

The array MUST have exactly ${batch.length} elements, one for each post. Use the EXACT archetype names from the list above.`;

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!claudeResponse.ok) {
        console.error("Claude API error for batch", i, await claudeResponse.text());
        continue;
      }

      const claudeData = await claudeResponse.json();
      const rawText = claudeData.content?.[0]?.text || "";

      let classifications: string[];
      try {
        const cleanJson = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
        classifications = JSON.parse(cleanJson);
      } catch {
        console.error("Failed to parse classifications for batch", i, rawText.slice(0, 200));
        continue;
      }

      if (!Array.isArray(classifications)) continue;

      // 5. Update each post's content_category
      const updates = batch.map((post: any, idx: number) => {
        const category = classifications[idx];
        // Only update if classification is a valid archetype name
        if (category && archetypeNames.includes(category)) {
          return adminClient
            .from("posts_analyzed")
            .update({ content_category: category })
            .eq("id", post.id);
        }
        return null;
      }).filter(Boolean);

      await Promise.all(updates);
      totalUpdated += updates.length;
    }

    console.log(`Categorized ${totalUpdated} of ${posts.length} posts`);

    return new Response(JSON.stringify({ success: true, categorized: totalUpdated, total: posts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("categorize-posts error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
