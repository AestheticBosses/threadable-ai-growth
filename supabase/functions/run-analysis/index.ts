import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  console.log("=== RUN ANALYSIS CALLED ===")
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

    // Get user profile for niche/goal context
    const { data: profile } = await adminClient
      .from("profiles")
      .select("niche, dream_client, end_goal")
      .eq("id", user.id)
      .single()

    // Get ALL posts sorted by views
    const { data: posts, error: postsError } = await adminClient
      .from('posts_analyzed')
      .select('*')
      .eq('user_id', user.id)
      .order('views', { ascending: false })

    if (postsError || !posts?.length) {
      console.error("Posts error:", postsError)
      return new Response(JSON.stringify({ error: 'No posts found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log("Total posts:", posts.length)

    // Prepare post data for Claude — send top 75 with full detail
    const topPosts = posts.slice(0, 75).map((p: any, i: number) =>
      `#${i+1} | Views: ${p.views} | Likes: ${p.likes} | Replies: ${p.replies} | Reposts: ${p.reposts} | Quotes: ${p.quotes || 0} | Eng%: ${p.engagement_rate}%\n"${p.text_content}"`
    ).join('\n\n')

    const totalViews = posts.reduce((s: number, p: any) => s + (p.views || 0), 0)
    const totalLikes = posts.reduce((s: number, p: any) => s + (p.likes || 0), 0)
    const totalReposts = posts.reduce((s: number, p: any) => s + (p.reposts || 0), 0)
    const totalReplies = posts.reduce((s: number, p: any) => s + (p.replies || 0), 0)
    const avgViews = Math.round(totalViews / posts.length)
    const sortedViews = posts.map((p: any) => p.views || 0).sort((a: number, b: number) => a - b)
    const medianViews = sortedViews[Math.floor(posts.length / 2)]

    const summary = `Total posts: ${posts.length} | Total views: ${totalViews.toLocaleString()} | Avg views: ${avgViews} | Median views: ${medianViews} | Total likes: ${totalLikes} | Total reposts: ${totalReposts} | Total replies: ${totalReplies}`

    // One comprehensive Claude call
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `You are an expert Threads growth strategist doing a deep analysis of a creator's content performance to help them grow faster.

CREATOR CONTEXT:
- Niche: ${profile?.niche || "Not specified"}
- Dream Client: ${profile?.dream_client || "Not specified"}
- End Goal: ${profile?.end_goal || "Not specified"}

Keep this context in mind throughout your analysis. Weight content patterns that would resonate with their dream client and serve their end goal, not just what got the most raw views. A post that drives high engagement from their target audience is more valuable than one that went viral with a general audience.

ACCOUNT SUMMARY:
${summary}

Here are their posts ranked by views (top 75 shown with full text):

${topPosts}

Perform a COMPREHENSIVE analysis and return results in three sections:

SECTION 1 — REGRESSION INSIGHTS
Analyze what content characteristics actually drive performance. Don't just look at simple boolean features — analyze:
- Hook types (what kind of first line works: authority claim, contrarian statement, universal truth, personal story, question, number/data)
- Content structure (one-liner vs multi-line vs numbered list vs story arc)
- Emotional triggers (which specific emotions correlate with which metrics)
- Specificity level (vague advice vs specific data/names/dollar amounts)
- Length patterns (optimal word count ranges for views vs engagement)
- Topic categories (business advice, personal life, industry hot takes, behind-the-scenes)
- Language patterns (profanity impact, first person vs second person, present tense vs past tense)

For each finding, provide:
- The insight (what you found)
- The evidence (specific posts that prove it)
- The metric it impacts (views, likes, reposts, replies)
- The strength (strong/moderate/weak correlation)

SECTION 2 — CONTENT ARCHETYPES
Based on the regression insights, identify 3-5 distinct content archetypes this creator naturally uses. These should emerge from the DATA, not be generic categories.

For each archetype:
- A memorable, specific name (not generic like "educational post")
- What makes it work (the pattern)
- Which metric it drives most
- Key ingredients that must be present
- A fill-in-the-blank template based on their actual top posts
- Recommended percentage of total content
- 2-3 example posts from their data

SECTION 3 — PLAYBOOK
Based on the archetypes and regression insights, create an actionable playbook:

- 7-day weekly rotation with specific archetype assignments and reasoning
- Pre-post scoring checklist (6 criteria, each worth 1-2 points, must score 4+ to post) — criteria should be SPECIFIC to this creator's data, not generic
- 5-7 data-validated rules with specific evidence from their posts
- Content generation guidelines (tone, vocabulary, length, what to include, what to avoid)

Respond ONLY in this exact JSON format:
{
  "regression_insights": [
    {
      "category": "Hook Type",
      "insight": "What you found",
      "evidence": "Post #X with Y views did this, while Post #Z with W views didn't",
      "metric_impacted": "views",
      "strength": "strong",
      "recommendation": "Do more of X"
    }
  ],
  "archetypes": [
    {
      "name": "Archetype Name",
      "emoji": "🔥",
      "description": "What this type is and why it works for this creator",
      "drives": "views",
      "key_ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
      "template": "Fill-in template based on their posts",
      "recommended_percentage": 25,
      "example_posts": ["post text snippet 1", "post text snippet 2"]
    }
  ],
  "weekly_schedule": [
    { "day": "Monday", "archetype": "Name", "emoji": "🔥", "notes": "Why this day" }
  ],
  "checklist": [
    { "points": 2, "question": "Scoring question?", "data_backing": "Specific stat from their data" }
  ],
  "rules": [
    { "rule": "Rule text", "evidence": "Specific data point" }
  ],
  "generation_guidelines": {
    "tone": "Description of their writing tone",
    "avg_length": "Optimal word count range",
    "vocabulary": ["words/phrases they use often"],
    "hooks_that_work": ["hook patterns that drive views"],
    "avoid": ["things that don't work for them"]
  }
}`
        }]
      })
    })

    const claudeData = await claudeResponse.json()
    console.log("Claude status:", claudeResponse.status)

    if (!claudeResponse.ok) {
      console.error("Claude error:", JSON.stringify(claudeData))
      return new Response(JSON.stringify({ error: 'Claude API error', details: claudeData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const analysisText = claudeData.content[0].text
    console.log("Claude analysis length:", analysisText.length)

    let analysis: any
    try {
      const cleanJson = analysisText.replace(/```json\n?|```\n?/g, '').trim()
      analysis = JSON.parse(cleanJson)
    } catch (e: any) {
      console.error("Parse error:", e.message)
      console.log("Raw response:", analysisText.substring(0, 500))
      return new Response(JSON.stringify({ error: 'Parse failed', raw: analysisText.substring(0, 1000) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Save all three sections in parallel
    const saves = [
      adminClient.from('content_strategies').upsert({
        user_id: user.id,
        strategy_type: 'regression_insights',
        strategy_data: { insights: analysis.regression_insights },
      }, { onConflict: 'user_id,strategy_type' }),

      adminClient.from('content_strategies').upsert({
        user_id: user.id,
        strategy_type: 'archetype_discovery',
        strategy_data: { archetypes: analysis.archetypes },
      }, { onConflict: 'user_id,strategy_type' }),

      adminClient.from('content_strategies').upsert({
        user_id: user.id,
        strategy_type: 'playbook',
        strategy_data: {
          weekly_schedule: analysis.weekly_schedule,
          checklist: analysis.checklist,
          rules: analysis.rules,
          templates: analysis.archetypes.map((a: any) => ({ archetype: a.name, emoji: a.emoji, template: a.template, example: a.example_posts?.[0] })),
          generation_guidelines: analysis.generation_guidelines
        },
      }, { onConflict: 'user_id,strategy_type' })
    ]

    await Promise.all(saves)
    console.log("=== ALL ANALYSIS SAVED ===")

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("Fatal:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
