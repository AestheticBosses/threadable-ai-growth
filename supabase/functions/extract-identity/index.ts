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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Fetch user profile for bio context
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("threads_username, niche, display_name, full_name, end_goal, dream_client")
      .eq("id", userId)
      .single();

    // Fetch top 75 posts by views
    const { data: posts, error: postsError } = await adminClient
      .from("posts_analyzed")
      .select("text_content, views, likes, replies, engagement_rate")
      .eq("user_id", userId)
      .eq("source", "own")
      .not("text_content", "is", null)
      .order("views", { ascending: false })
      .limit(75);

    if (postsError) throw postsError;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!posts || posts.length === 0) {
      // No posts — generate a starter identity from profile data if available
      if (!profile?.niche) {
        return new Response(
          JSON.stringify({ error: "no_posts", message: "No posts found and no niche set. Complete onboarding first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("No posts found — generating starter identity from profile for user:", userId);

      const starterPrompt = `You are an AI that creates a starter professional identity for a new content creator. They haven't posted yet, so create a strong starting identity based on their inputs that they can refine later.

Creator inputs:
- Niche: ${profile.niche}
- Dream Client: ${profile.dream_client || "Not specified"}
- End Goal: ${profile.end_goal || "Not specified"}
- Name: ${profile.display_name || profile.full_name || "Not specified"}

Generate a professional identity in this exact JSON format:
{
  "about_you": "A 2-4 sentence professional summary written in first person (I am...). Position them as an emerging authority in their niche. Make it specific to their niche, not generic.",
  "stories": [],
  "offers": [],
  "target_audiences": ["Audience segment 1", "Audience segment 2", "Audience segment 3"],
  "personal_info": ["Their primary role/expertise area", "Their target market focus"],
  "desired_perception": "How this person should be perceived online to attract their dream client — be specific to their niche",
  "main_goal": "Their end goal restated clearly and specifically"
}

Rules:
- Write about_you in first person as if the creator wrote it themselves
- Make everything specific to their niche — no generic "passionate professional" language
- target_audiences: 2-3 specific segments derived from their dream client description
- personal_info: 2-3 facts about their professional focus (inferred from niche + dream client)
- stories and offers are empty arrays (no posts to extract from)
- Respond with ONLY the JSON, no markdown fences or extra text`;

      const starterRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: starterPrompt }],
        }),
      });

      if (!starterRes.ok) {
        console.error("Starter identity AI error:", starterRes.status);
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const starterData = await starterRes.json();
      const starterText = starterData.content?.[0]?.text || "";

      let starterParsed;
      try {
        const cleanJson = starterText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
        starterParsed = JSON.parse(cleanJson);
      } catch {
        console.error("Starter identity JSON parse failed:", starterText);
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save starter identity to DB
      try {
        const { data: existingIdentity } = await adminClient
          .from("user_identity")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingIdentity?.id) {
          await adminClient.from("user_identity").update({
            about_you: starterParsed.about_you || null,
            desired_perception: starterParsed.desired_perception || null,
            main_goal: starterParsed.main_goal || null,
          }).eq("id", existingIdentity.id);
        } else {
          await adminClient.from("user_identity").insert({
            user_id: userId,
            about_you: starterParsed.about_you || null,
            desired_perception: starterParsed.desired_perception || null,
            main_goal: starterParsed.main_goal || null,
          });
        }

        // Clear and insert audiences
        await adminClient.from("user_audiences").delete().eq("user_id", userId);
        if (starterParsed.target_audiences?.length > 0) {
          await adminClient.from("user_audiences").insert(
            starterParsed.target_audiences.map((name: string) => ({ user_id: userId, name }))
          );
        }

        // Clear and insert personal info
        await adminClient.from("user_personal_info").delete().eq("user_id", userId);
        if (starterParsed.personal_info?.length > 0) {
          await adminClient.from("user_personal_info").insert(
            starterParsed.personal_info.map((content: string) => ({ user_id: userId, content }))
          );
        }

        console.log("Starter identity saved for user:", userId);
      } catch (saveErr) {
        console.error("Failed to save starter identity:", saveErr);
      }

      return new Response(
        JSON.stringify({ data: starterParsed, post_count: 0, is_starter: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the user message for Claude
    const bioSection = profile
      ? `User profile:\n- Username: @${profile.threads_username || "unknown"}\n- Name: ${profile.display_name || profile.full_name || "unknown"}\n- Niche: ${profile.niche || "unknown"}\n- Goal: ${profile.end_goal || "unknown"}\n- Dream client: ${profile.dream_client || "unknown"}\n`
      : "";

    const postsText = posts
      .map((p: any, i: number) => `Post ${i + 1} (${p.views ?? 0} views, ${p.likes ?? 0} likes):\n${p.text_content}`)
      .join("\n\n---\n\n");

    const userMessage = `${bioSection}\nHere are their top ${posts.length} posts:\n\n${postsText}`;

    const systemPrompt = `You are an AI that analyzes a user's social media posts to extract their professional identity. You will receive their Threads bio and their top-performing posts.

Extract the following structured data. ONLY extract facts that are explicitly stated or strongly implied in their posts. Do NOT make up or infer information that isn't clearly present.

Respond in this exact JSON format:
{
  "about_you": "A 2-4 sentence professional summary of who this person is, what they do, and what they're known for. Write in first person (I am...).",
  "stories": [
    {
      "title": "Short descriptive title for this story/experience",
      "body": "The full narrative or experience as described across their posts",
      "key_lesson": "The core takeaway or lesson from this story"
    }
  ],
  "offers": [
    {
      "name": "Name of product, service, or program",
      "description": "What it does and who it's for"
    }
  ],
  "target_audiences": ["Audience segment 1", "Audience segment 2"],
  "personal_info": [
    "Fact 1 about the person (role, company, etc.)",
    "Fact 2 (location, background, etc.)",
    "Fact 3 (achievements, credentials, etc.)"
  ],
  "desired_perception": "How this person seems to want to be perceived online based on their content themes and tone",
  "main_goal": "What appears to be their primary current business/content goal based on recent posts"
}

Rules:
- Extract 3-8 stories maximum, focusing on the most referenced personal/professional narratives
- Extract all offers/products/services mentioned
- Extract 2-5 target audience segments
- Extract 8-15 personal information facts
- For "about_you", write it as if the person wrote it themselves
- Be specific with numbers, names, and details found in posts
- If something is unclear, skip it rather than guess
- Respond with ONLY the JSON, no markdown fences or extra text`;

    // ANTHROPIC_API_KEY already validated above

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: userMessage }],
        system: systemPrompt,
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text || "";

    // Parse JSON - strip markdown fences if present
    let parsed;
    try {
      const cleanJson = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("JSON parse failed, raw:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist extracted identity to DB so onboarding pipeline doesn't discard it
    try {
      // 1. Save user_identity (check-then-insert/update to avoid onConflict constraint issues)
      console.log("Saving identity for user:", userId, "about_you length:", (parsed.about_you || "").length);

      const { data: existingIdentity } = await adminClient
        .from("user_identity")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingIdentity?.id) {
        const { error: updateErr } = await adminClient
          .from("user_identity")
          .update({
            about_you: parsed.about_you || null,
            desired_perception: parsed.desired_perception || null,
            main_goal: parsed.main_goal || null,
          })
          .eq("id", existingIdentity.id);
        if (updateErr) console.error("user_identity UPDATE failed:", updateErr);
        else console.log("user_identity updated for existing row:", existingIdentity.id);
      } else {
        const { error: insertErr } = await adminClient
          .from("user_identity")
          .insert({
            user_id: userId,
            about_you: parsed.about_you || null,
            desired_perception: parsed.desired_perception || null,
            main_goal: parsed.main_goal || null,
          });
        if (insertErr) console.error("user_identity INSERT failed:", insertErr);
        else console.log("user_identity inserted new row for user:", userId);
      }

      // 2. Clear existing data to prevent duplicates on re-runs
      await Promise.all([
        adminClient.from("user_offers").delete().eq("user_id", userId),
        adminClient.from("user_audiences").delete().eq("user_id", userId),
        adminClient.from("user_personal_info").delete().eq("user_id", userId),
        adminClient.from("user_story_vault").delete().eq("user_id", userId).eq("section", "stories"),
      ]);

      // 3. Insert stories into user_story_vault
      if (parsed.stories?.length > 0) {
        const storyEntries = parsed.stories.map((s: any) => ({
          title: s.title,
          story: s.body,
          lesson: s.key_lesson,
          tags: [],
        }));
        await adminClient.from("user_story_vault").insert({
          user_id: userId,
          section: "stories",
          data: storyEntries,
        });
      }

      // 4. Insert offers
      if (parsed.offers?.length > 0) {
        await adminClient.from("user_offers").insert(
          parsed.offers.map((o: any) => ({
            user_id: userId,
            name: o.name,
            description: o.description || null,
          }))
        );
      }

      // 5. Insert audiences
      if (parsed.target_audiences?.length > 0) {
        await adminClient.from("user_audiences").insert(
          parsed.target_audiences.map((name: string) => ({
            user_id: userId,
            name,
          }))
        );
      }

      // 6. Insert personal info
      if (parsed.personal_info?.length > 0) {
        await adminClient.from("user_personal_info").insert(
          parsed.personal_info.map((content: string) => ({
            user_id: userId,
            content,
          }))
        );
      }

      console.log("Identity data persisted for user:", userId);
    } catch (saveErr) {
      // Log but don't fail the request — data is still returned for review modal
      console.error("Failed to persist identity data:", saveErr);
    }

    return new Response(JSON.stringify({ data: parsed, post_count: posts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-identity error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
