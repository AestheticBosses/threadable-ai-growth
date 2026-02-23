import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("=== DISCOVER ARCHETYPES CALLED ===")
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt)
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    console.log("User:", user.id)

    const body = await req.json().catch(() => ({}))
    const isNewAccount = body.new_account === true

    // Read profile from DB so context is always available regardless of caller
    const { data: profile } = await adminClient
      .from("profiles")
      .select("niche, dream_client, end_goal")
      .eq("id", user.id)
      .single()

    const nicheHint = body.niche || profile?.niche || ""
    const goalsHint = body.goals || profile?.end_goal || ""
    const dreamClientHint = profile?.dream_client || ""

    let postsForAnalysis = ""
    let promptContent = ""

    if (isNewAccount) {
      // New account — no posts, generate starter archetypes based on niche
      console.log("New account mode — niche:", nicheHint)
      promptContent = `You are a viral content strategist. A NEW creator is starting on Threads in the "${nicheHint}" niche. Their goals: "${goalsHint}".

They have NO existing posts yet. Based on what works for successful Threads creators in this niche, suggest 3-5 content archetypes they should use.

For each archetype, determine:
1. A memorable name (2-3 words, specific to their niche)
2. What makes this type work (the pattern)
3. Typical engagement pattern (what metric it drives most: views, likes, reposts, replies)
4. Key ingredients (what elements should always be present)
5. A template/formula for writing this type
6. What percentage of their content should be this type

Also provide:
- A recommended weekly posting schedule (7 days) using these archetypes
- 3 rules for new creators in this niche

Respond ONLY in this exact JSON format with no other text:
{
  "archetypes": [
    {
      "name": "Archetype Name",
      "emoji": "🔥",
      "description": "What this content type is and why it works",
      "drives": "primary metric it drives (views/likes/reposts/replies)",
      "avg_views": 0,
      "avg_engagement": 0,
      "key_ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
      "template": "Fill-in-the-blank template for writing this type",
      "recommended_percentage": 30,
      "example_posts": ["example post idea 1", "example post idea 2"]
    }
  ],
  "weekly_schedule": [
    { "day": "Monday", "archetype": "Archetype Name", "notes": "why this day" }
  ],
  "rules": [
    "Rule 1 for new creators",
    "Rule 2 for new creators",
    "Rule 3 for new creators"
  ]
}`
    } else {
      // Established account — analyze existing posts
      const { data: posts, error: postsError } = await adminClient
        .from('posts_analyzed')
        .select('text_content, views, likes, replies, reposts, quotes, engagement_rate, word_count, posted_at')
        .eq('user_id', user.id)
        .order('views', { ascending: false })
        .limit(50)

      if (postsError || !posts?.length) {
        console.error("Posts error:", postsError)
        return new Response(JSON.stringify({ error: 'No posts found. Fetch your posts first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      console.log("Posts loaded:", posts.length)

      postsForAnalysis = posts.map((p: any, i: number) => 
        `Post ${i+1} (${p.views} views, ${p.likes} likes, ${p.replies} replies, ${p.reposts} reposts, ${p.quotes} quotes, ${p.engagement_rate}% eng):
${p.text_content}`
      ).join('\n\n---\n\n')

      promptContent = `You are a viral content strategist analyzing a creator's Threads posts to discover their unique content archetypes.

CREATOR CONTEXT:
- Niche: ${nicheHint || "Not specified"}
- Dream Client: ${dreamClientHint || "Not specified"}
- End Goal: ${goalsHint || "Not specified"}

Use this context to shape the archetypes. The archetypes should not just reflect past posting patterns — they should reflect what this creator needs to build toward their goal and resonate with their dream client. If their posts show patterns that serve their dream client well, weight those higher.

Here are their top ${posts.length} posts ranked by views with engagement data:

${postsForAnalysis}

Analyze these posts and discover 3-5 distinct CONTENT ARCHETYPES (content types/patterns) that this creator naturally uses. Don't use generic names — create names that reflect THIS creator's specific style.

For each archetype, determine:
1. A memorable name (2-3 words, specific to their style)
2. What makes this type work (the pattern)
3. Typical engagement pattern (what metric it drives most: views, likes, reposts, replies)
4. Key ingredients (what elements are always present)
5. A template/formula for writing more of this type
6. What percentage of their content should be this type based on performance

Also provide:
- A recommended weekly posting schedule (7 days) using these archetypes
- 3 rules validated by their data

Respond ONLY in this exact JSON format with no other text:
{
  "archetypes": [
    {
      "name": "Archetype Name",
      "emoji": "🔥",
      "description": "What this content type is and why it works",
      "drives": "primary metric it drives (views/likes/reposts/replies)",
      "avg_views": 0,
      "avg_engagement": 0,
      "key_ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
      "template": "Fill-in-the-blank template for writing this type",
      "recommended_percentage": 30,
      "example_posts": ["title of example post 1", "title of example post 2"]
    }
  ],
  "weekly_schedule": [
    { "day": "Monday", "archetype": "Archetype Name", "notes": "why this day" }
  ],
  "rules": [
    "Rule 1 validated by the data",
    "Rule 2 validated by the data",
    "Rule 3 validated by the data"
  ]
}`
    }

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: promptContent
        }]
      })
    })

    const claudeData = await claudeResponse.json()
    console.log("Claude response status:", claudeResponse.status)

    if (!claudeResponse.ok) {
      console.error("Claude error:", JSON.stringify(claudeData))
      return new Response(JSON.stringify({ error: 'Claude API error', details: claudeData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const analysisText = claudeData.content[0].text
    console.log("Claude analysis length:", analysisText.length)

    // Parse JSON from Claude response
    let analysis: any
    try {
      const cleanJson = analysisText.replace(/```json\n?|```\n?/g, '').trim()
      analysis = JSON.parse(cleanJson)
    } catch (e: any) {
      console.error("JSON parse error:", e.message)
      return new Response(JSON.stringify({ error: 'Failed to parse Claude response', raw: analysisText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Save to content_strategies table
    const { error: upsertError } = await adminClient
      .from('content_strategies')
      .upsert({
        user_id: user.id,
        strategy_type: 'archetype_discovery',
        strategy_data: analysis,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,strategy_type' })

    if (upsertError) {
      console.error("Upsert error:", upsertError)
    }

    console.log("=== ARCHETYPES DISCOVERED ===", analysis.archetypes?.length)

    // Seed knowledge_base with archetypes
    const archetypes = analysis.archetypes || [];
    if (archetypes.length > 0) {
      const kbEntries = archetypes.map((a: any) => ({
        user_id: user.id, type: "framework", title: a.name,
        content: a.description || `${a.name}: ${a.drives || "engagement"}`,
        processed: true, tags: [],
      }));
      await adminClient.from("knowledge_base").upsert(kbEntries, {
        onConflict: "user_id,title",
      }).then(({ error }) => {
        if (error) console.error("KB archetype seed error:", error);
        else console.log(`KB seeded: ${kbEntries.length} archetypes`);
      });
    }

    // Seed knowledge_base with regression insights (if available)
    const { data: regressionRow } = await adminClient
      .from("content_strategies")
      .select("regression_insights")
      .eq("user_id", user.id)
      .not("regression_insights", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const humanInsights = (regressionRow?.regression_insights as any)?.human_readable_insights;
    if (Array.isArray(humanInsights) && humanInsights.length > 0) {
      const insightEntries = humanInsights.map((text: string) => ({
        user_id: user.id, type: "proof", title: text.slice(0, 60),
        content: text, processed: true, tags: [],
      }));
      await adminClient.from("knowledge_base").upsert(insightEntries, {
        onConflict: "user_id,title",
      }).then(({ error }) => {
        if (error) console.error("KB insight seed error:", error);
        else console.log(`KB seeded: ${insightEntries.length} insights`);
      });
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("Fatal:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
