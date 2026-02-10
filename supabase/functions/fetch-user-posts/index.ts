import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log("=== FETCH USER POSTS CALLED ===")
  console.log("Method:", req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    console.log("Auth header exists:", !!authHeader)

    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify JWT using anon client with getClaims (Lovable Cloud pattern)
    const token = authHeader.replace('Bearer ', '')
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)

    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError?.message || "No claims")
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = claimsData.claims.sub as string
    console.log("User:", userId)

    // Use service role for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('threads_user_id, threads_access_token')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.threads_access_token) {
      console.error("Profile error:", profileError?.message)
      return new Response(JSON.stringify({ error: 'Threads not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log("Threads user:", profile.threads_user_id)

    const threadsUrl = `https://graph.threads.net/v1.0/${profile.threads_user_id}/threads?fields=id,text,timestamp,media_type&access_token=${profile.threads_access_token}&limit=30`
    const threadsRes = await fetch(threadsUrl)
    const threadsJson = await threadsRes.json()

    console.log("Threads status:", threadsRes.status)

    if (threadsJson.error) {
      console.error("Threads error:", JSON.stringify(threadsJson.error))
      return new Response(JSON.stringify({ error: threadsJson.error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const posts = threadsJson.data || []
    console.log("Posts found:", posts.length)

    let saved = 0
    for (const post of posts) {
      try {
        const insightsUrl = `https://graph.threads.net/v1.0/${post.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${profile.threads_access_token}`
        const insRes = await fetch(insightsUrl)
        const insJson = await insRes.json()

        let views = 0, likes = 0, replies = 0, reposts = 0, quotes = 0
        if (insJson.data) {
          for (const m of insJson.data) {
            if (m.name === 'views') views = m.values?.[0]?.value || 0
            if (m.name === 'likes') likes = m.values?.[0]?.value || 0
            if (m.name === 'replies') replies = m.values?.[0]?.value || 0
            if (m.name === 'reposts') reposts = m.values?.[0]?.value || 0
            if (m.name === 'quotes') quotes = m.values?.[0]?.value || 0
          }
        }

        const text = post.text || ''
        const engRate = views > 0 ? ((likes + replies + reposts + quotes) / views) * 100 : 0

        const { error: upsertErr } = await adminClient.from('posts_analyzed').upsert({
          user_id: userId,
          threads_media_id: post.id,
          text_content: text,
          posted_at: post.timestamp,
          views,
          likes,
          replies,
          reposts,
          quotes,
          engagement_rate: parseFloat(engRate.toFixed(2)),
          word_count: text.split(/\s+/).filter(Boolean).length,
          char_count: text.length,
        }, { onConflict: 'threads_media_id' })

        if (upsertErr) {
          console.error("Upsert err:", post.id, upsertErr.message)
        } else {
          saved++
        }
      } catch (e) {
        console.error("Post error:", post.id, e.message)
      }
    }

    console.log("=== DONE. Saved:", saved, "===")
    return new Response(JSON.stringify({ success: true, total_posts: saved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error("Fatal:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
