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

    // Paginate through ALL posts
    let allPosts: any[] = []
    let nextUrl: string | null = `https://graph.threads.net/v1.0/${profile.threads_user_id}/threads?fields=id,text,timestamp,media_type&access_token=${profile.threads_access_token}&limit=100`

    while (nextUrl) {
      const threadsRes = await fetch(nextUrl)
      const threadsJson = await threadsRes.json()

      if (threadsJson.error) {
        console.error("Threads error:", JSON.stringify(threadsJson.error))
        if (allPosts.length === 0) {
          return new Response(JSON.stringify({ error: threadsJson.error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        break
      }

      if (threadsJson.data) {
        allPosts = allPosts.concat(threadsJson.data)
      }

      nextUrl = threadsJson.paging?.next || null
      console.log("Fetched page, total posts so far:", allPosts.length)
    }

    const posts = allPosts
    console.log("Total posts fetched:", posts.length)

    // Cleanup: delete mock/placeholder posts for this user
    const { error: cleanupErr } = await adminClient
      .from('posts_analyzed')
      .delete()
      .eq('user_id', userId)
      .like('text_content', 'Mock post%')
    if (cleanupErr) console.error("Cleanup error:", cleanupErr.message)
    else console.log("Cleaned up mock posts")

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
        const lower = text.toLowerCase()
        const words = text.split(/\s+/).filter(Boolean)
        const wordCount = words.length
        const engRate = views > 0 ? ((likes + replies + reposts + quotes) / views) * 100 : 0
        const follows = 0 // Threads API doesn't expose per-post follows
        const followRate = views > 0 ? (follows / views) * 100 : 0

        // Boolean content features
        const has_namedrop = /alex hormozi|grant cardone|gary vee|russell brunson|dan kennedy|frank kern|tony robbins|sam ovens|tai lopez|cardone|hormozi/i.test(text)
        const has_dollar_amount = /\$\d/.test(text)
        const has_vulnerability = /(honest|truth|real talk|admit|scared|afraid|lost|struggle|fail|broke|crying|tears|hard|quit|almost gave up|confession|nobody tells)/i.test(lower)
        const has_controversy = /(unpopular opinion|hot take|controversial|nobody wants to hear|stop|overrated|dead|bs|bullshit|scam|fraud|fake)/i.test(lower)
        const has_relatability = /(we all|everyone|you know that|we've all|same|felt this|been there|who else|relate)/i.test(lower)
        const has_profanity = /(fuck|shit|damn|ass|hell|crap|bitch|motherf)/i.test(lower)
        const has_visual = /(picture|imagine|sitting|standing|walking|driving|looking at|staring|garage|office|desk|car|coffee|morning|night|3am|11pm|midnight)/i.test(lower)
        const is_short_form = wordCount < 30
        const has_steps = /(\d\.\s|\d\)\s|step \d|here's the|here's what|breakdown|framework|the exact)/i.test(lower)
        const has_question = text.includes('?')
        const has_emoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text)
        const has_hashtag = /#\w/.test(text)
        const has_url = /https?:\/\//.test(text)
        const starts_with_number = /^\d/.test(text.trim())
        const has_credibility_marker = has_namedrop

        // Count emotional triggers
        let emotion_count = 0
        if (/(fomo|missing out|don't miss|before it's gone|limited)/i.test(lower)) emotion_count++
        if (/(aspir|dream|goal|success|wealth|freedom|scale)/i.test(lower)) emotion_count++
        if (/(recogni|seen|felt that|you know|relate|been there)/i.test(lower)) emotion_count++
        if (/(curios|wonder|how|what if|secret|hidden|reveal)/i.test(lower)) emotion_count++
        if (/(defian|rebel|refuse|won't|never|stop telling me)/i.test(lower)) emotion_count++
        if (/(vulner|honest|scary|afraid|real talk|admit)/i.test(lower)) emotion_count++
        if (/(humor|funny|lol|😂|haha|joke)/i.test(lower)) emotion_count++
        if (/(belong|community|tribe|together|us|we)/i.test(lower)) emotion_count++

        // Archetype classification
        let archetype = 'truth'
        if (has_steps || has_namedrop || /tracked|studied|analyzed|framework|breakdown|here's the exact/i.test(lower)) {
          archetype = 'vault_drop'
        } else if (has_controversy || /unpopular|hot take|controversial|stop|overrated/i.test(lower)) {
          archetype = 'hot_take'
        } else if (has_visual && has_vulnerability && /(right now|today|tonight|this morning|just|sitting|about to)/i.test(lower)) {
          archetype = 'window'
        } else if (is_short_form && !has_steps) {
          archetype = 'truth'
        }

        // Compute day/hour from timestamp
        const postedDate = post.timestamp ? new Date(post.timestamp) : null
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const day_of_week = postedDate ? dayNames[postedDate.getUTCDay()] : null
        const hour_posted = postedDate ? postedDate.getUTCHours() : null

        const { error: upsertErr } = await adminClient.from('posts_analyzed').upsert({
          user_id: userId,
          threads_media_id: post.id,
          text_content: text,
          source: 'own',
          posted_at: post.timestamp,
          views,
          likes,
          replies,
          reposts,
          quotes,
          follows,
          follow_rate: parseFloat(followRate.toFixed(2)),
          engagement_rate: parseFloat(engRate.toFixed(2)),
          word_count: wordCount,
          char_count: text.length,
          has_question,
          has_credibility_marker,
          has_emoji,
          has_hashtag,
          has_url,
          starts_with_number,
          has_namedrop,
          has_dollar_amount,
          has_vulnerability,
          has_controversy,
          has_relatability,
          has_profanity,
          has_visual,
          is_short_form,
          has_steps,
          emotion_count,
          archetype,
          day_of_week,
          hour_posted,
          media_type: post.media_type || 'TEXT',
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
