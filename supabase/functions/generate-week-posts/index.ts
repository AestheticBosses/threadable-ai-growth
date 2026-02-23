import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { CONTENT_GENERATION_RULES } from "../_shared/contentRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mountain Time targets: 10:00, 12:00, 17:00, 20:00 → stored as UTC
const TIME_SLOTS_UTC = ["17:00", "19:00", "00:00", "03:00"];

function funnelInstruction(
  stage: string,
  trafficUrl: string,
  dmKeyword: string,
  dmOffer: string
): string {
  switch (stage) {
    case "TOF":
      return "This is a TOP OF FUNNEL post. Goal = maximum reach and new eyeballs. Write a viral hook, shareable observation, or contrarian take. Keep it short and punchy. Do NOT mention your offer, CTA, or link. Just make people stop scrolling.";
    case "MOF":
      return "This is a MIDDLE OF FUNNEL post. Goal = build trust and start conversations. Share a personal story, teaching moment, or vulnerable take. End with a question or conversation starter. You can mention what you do but don't hard-sell.";
    case "BOF": {
      let bof = `This is a BOTTOM OF FUNNEL post. Goal = convert followers into leads or customers. Mention your offer, include a CTA, reference your traffic URL: ${trafficUrl || "Not set"}. Use proof, case studies, or urgency.`;
      if (dmKeyword && dmOffer) {
        bof += ` DM trigger: tell readers to DM you the word "${dmKeyword}" to get "${dmOffer}".`;
      } else if (dmKeyword) {
        bof += ` DM trigger: tell readers to DM you the word "${dmKeyword}".`;
      }
      bof += " This post should make someone DM you or click your link.";
      return bof;
    }
    default:
      return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(jwt);

    // Parse body early so we can use body.user_id as fallback for service-role calls
    const body = await req.json().catch(() => ({}));

    // Allow service-role callers (e.g. stripe-webhook) to pass user_id in the body
    const userId = user?.id || body.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("generate-week-posts for user:", userId);

    // 1. Fetch next 7 content_plan_items where post_id IS NULL, scheduled_date >= today
    const today = new Date().toISOString().split("T")[0];
    const { data: planItems, error: planError } = await adminClient
      .from("content_plan_items")
      .select("id, scheduled_date, archetype, funnel_stage, pillar_id, topic_id")
      .eq("user_id", userId)
      .is("post_id", null)
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .limit(7);

    if (planError) {
      console.error("Failed to fetch plan items:", planError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch plan items", details: planError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!planItems || planItems.length === 0) {
      console.log("No undrafted plan items found");
      return new Response(
        JSON.stringify({ success: true, total: 0, message: "No plan items to draft" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${planItems.length} plan items to draft`);

    // 2. Fetch pillar names and topic names for lookup
    const pillarIds = [...new Set(planItems.map((i) => i.pillar_id).filter(Boolean))];
    const topicIds = [...new Set(planItems.map((i) => i.topic_id).filter(Boolean))];

    const pillarNameMap: Record<string, string> = {};
    const topicNameMap: Record<string, string> = {};

    if (pillarIds.length > 0) {
      const { data: pillars } = await adminClient
        .from("content_pillars")
        .select("id, name")
        .in("id", pillarIds);
      for (const p of pillars || []) pillarNameMap[p.id] = p.name;
    }

    if (topicIds.length > 0) {
      const { data: topics } = await adminClient
        .from("connected_topics")
        .select("id, name")
        .in("id", topicIds);
      for (const t of topics || []) topicNameMap[t.id] = t.name;
    }

    // 3. Fetch user context and profile for funnel instructions
    const [userContext, profileRes] = await Promise.all([
      getUserContext(adminClient, userId),
      adminClient
        .from("profiles")
        .select("traffic_url, dm_keyword, dm_offer")
        .eq("id", userId)
        .single(),
    ]);

    const trafficUrl = profileRes.data?.traffic_url || "";
    const dmKeyword = profileRes.data?.dm_keyword || "";
    const dmOffer = profileRes.data?.dm_offer || "";

    // 4. Delete existing drafts to avoid duplicates on re-run
    const { error: deleteErr } = await adminClient
      .from("scheduled_posts")
      .delete()
      .eq("user_id", userId)
      .eq("status", "draft");

    if (deleteErr) {
      console.error("Failed to delete old drafts:", deleteErr);
    } else {
      console.log("Cleared existing draft posts");
    }

    // 5. Generate each post sequentially to avoid rate limits
    const results: any[] = [];

    for (let i = 0; i < planItems.length; i++) {
      const item = planItems[i];
      const pillarName = item.pillar_id ? pillarNameMap[item.pillar_id] || "General" : "General";
      const topicName = item.topic_id ? topicNameMap[item.topic_id] || "" : "";
      const archetype = item.archetype || "General";
      const funnel = item.funnel_stage || "TOF";
      const funnelInstr = funnelInstruction(funnel, trafficUrl, dmKeyword, dmOffer);

      const systemPrompt = `${CONTENT_GENERATION_RULES}

You are Threadable — a data-driven Threads content writer. You write posts backed by regression analysis of this user's actual performance data.

CRITICAL: Every post MUST be under 480 characters total. Count every character including spaces and line breaks. Do not exceed 480 characters.

Here is everything you know about this user:

${userContext}`;

      const userPrompt = `Write a single Threads post with these specifications:

- Pillar: ${pillarName}
- Archetype: ${archetype}
${topicName ? `- Topic: "${topicName}"` : ""}
- Funnel Stage: ${funnel}

${funnelInstr}

Write the post in this user's authentic voice. Use their real stories, numbers, and experiences from the context above. Start with a scroll-stopping hook. Keep under 500 characters unless the format demands more.

Respond with ONLY the post text. No explanations, no labels, no quotes around it.`;

      try {
        console.log(`Generating post ${i + 1}/${planItems.length}: ${archetype} (${funnel})`);

        const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });

        if (!aiResp.ok) {
          const errBody = await aiResp.text();
          console.error(`Anthropic API error for item ${item.id}:`, aiResp.status, errBody);
          results.push({ error: "AI generation failed", itemId: item.id });
          continue;
        }

        const aiData = await aiResp.json();
        let text = (aiData.content?.[0]?.text || "").trim();

        if (!text) {
          console.error(`Empty response for item ${item.id}`);
          results.push({ error: "Empty response", itemId: item.id });
          continue;
        }

        // Safety trim: cut to last complete sentence under 500 chars
        if (text.length > 500) {
          const trimmed = text.slice(0, 500);
          const lastSentenceEnd = Math.max(
            trimmed.lastIndexOf(". "),
            trimmed.lastIndexOf(".\n"),
            trimmed.lastIndexOf("!"),
            trimmed.lastIndexOf("?")
          );
          text = lastSentenceEnd > 0 ? trimmed.slice(0, lastSentenceEnd + 1) : trimmed;
          console.log(`Trimmed post from ${aiData.content[0].text.trim().length} to ${text.length} chars`);
        }

        // Insert into scheduled_posts
        const utcTime = TIME_SLOTS_UTC[i % TIME_SLOTS_UTC.length];
        // 00:00 and 03:00 UTC fall on the next calendar day
        const needsNextDay = utcTime === "00:00" || utcTime === "03:00";
        let dateForTimestamp = item.scheduled_date;
        if (needsNextDay) {
          const d = new Date(item.scheduled_date + "T00:00:00Z");
          d.setUTCDate(d.getUTCDate() + 1);
          dateForTimestamp = d.toISOString().split("T")[0];
        }
        const scheduledFor = `${dateForTimestamp}T${utcTime}:00Z`;

        const { data: inserted, error: insertErr } = await adminClient
          .from("scheduled_posts")
          .insert({
            user_id: userId,
            text_content: text,
            status: "draft",
            scheduled_for: scheduledFor,
            funnel_stage: funnel,
            content_category: archetype,
            source: "plan",
            ai_generated: true,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error(`Insert error for item ${item.id}:`, insertErr);
          results.push({ error: "Failed to save post", itemId: item.id });
          continue;
        }

        // 7. Update content_plan_items: link post_id and set status to "drafted"
        const { error: updateErr } = await adminClient
          .from("content_plan_items")
          .update({ post_id: inserted.id, status: "drafted" })
          .eq("id", item.id);

        if (updateErr) {
          console.error(`Update plan item error for ${item.id}:`, updateErr);
        }

        console.log(`Post ${i + 1} created: ${inserted.id}`);
        results.push({ success: true, id: inserted.id, itemId: item.id });
      } catch (e: any) {
        console.error(`Exception generating post for item ${item.id}:`, e.message);
        results.push({ error: e.message, itemId: item.id });
      }
    }

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => r.error);

    console.log(`=== WEEK POSTS DONE: ${successful.length} created, ${failed.length} failed ===`);

    return new Response(
      JSON.stringify({
        success: true,
        total: successful.length,
        failed: failed.length,
        posts: successful,
        errors: failed.length > 0 ? failed.map((f) => f.error) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
