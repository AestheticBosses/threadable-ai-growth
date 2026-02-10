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

    // Get top 50 posts by views
    const { data: posts, error: postsError } = await adminClient
      .from('posts_analyzed')
      .select('text_content, views, likes, replies, reposts, quotes, engagement_rate, word_count, posted_at')
      .eq('user_id', user.id)
      .order('views', { ascending: false })
      .limit(50)

    if (postsError || !posts?.length) {
      console.error("Posts error:", postsError)
      return new Response(JSON.stringify({ error: 'No posts found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log("Posts loaded:", posts.length)

    // Format posts for Claude
    const postsForAnalysis = posts.map((p: any, i: number) => 
      `Post ${i+1} (${p.views} views, ${p.likes} likes, ${p.replies} replies, ${p.reposts} reposts, ${p.quotes} quotes, ${p.engagement_rate}% eng):
${p.text_content}`
    ).join('\n\n---\n\n')

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
          content: `You are a viral content strategist analyzing a creator's Threads posts to discover their unique content archetypes.

Here are their top 50 posts ranked by views with engagement data:

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

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("Fatal:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
