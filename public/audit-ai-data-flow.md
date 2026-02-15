# Audit: AI Data Flow — What Data Does Each AI Call Receive?

---

## 1. `chat-with-threadable`

**Provider:** Lovable AI Gateway (`google/gemini-2.5-flash`)  
**API Key:** `LOVABLE_API_KEY`

### Full System Prompt:
```
You are Threadable AI — a Threads content strategist and writing assistant. You help creators write high-performing Threads posts, brainstorm ideas, and build their personal brand.

You have deep knowledge of this specific user. Here is everything you know about them:

${userContext}

=== RULES ===
- Always write in the user's voice based on their style preferences and top posts
- Never make up facts — only reference information from their Identity and Knowledge Base
- When generating post ideas, tag each with an archetype and funnel stage (TOF/MOF/BOF)
- When writing draft posts, follow their content preferences exactly
- Keep Threads posts under 500 characters unless the user asks for longer
- Format posts for mobile readability — short paragraphs, line breaks between thoughts
- If the user asks about something you don't have context for, ask them to add it to their Knowledge Base or Identity
- Be direct, strategic, and actionable — not generic or fluffy
- When suggesting hooks, use patterns from their top-performing posts
```

### Data Flow:
- **Calls getUserContext():** YES
- **getUserContext output included in system prompt:** YES — entire formatted string interpolated
- **Includes conversation history:** YES — last 20 messages from `message_history`
- **User message:** Raw user input passed directly

### Tables queried by getUserContext():
| Table | Fields Selected |
|---|---|
| `user_identity` | about_you, desired_perception, main_goal |
| `user_story_vault` | section, data |
| `user_offers` | name, description |
| `user_audiences` | name |
| `user_personal_info` | content |
| `user_writing_style` | selected_style, custom_style_description |
| `content_preferences` | content |
| `knowledge_base` | title, type, content, summary (limit 30, processed only) |
| `posts_analyzed` | text_content, likes, views, replies, reposts, engagement_rate, archetype, posted_at (top 10 by views, own only) |
| `user_plans` | plan_type, plan_data |
| `content_strategies` | strategy_data (archetype_discovery) |
| `content_strategies` | regression_insights (weekly, latest) |
| `profiles` | niche, dream_client, end_goal, voice_profile |
| `user_sales_funnel` | step_number, step_name, what, url, price, goal |
| `content_templates` | archetype, template_text |

---

## 2. `generate-plans`

**Provider:** Anthropic (`claude-sonnet-4-20250514`)  
**API Key:** `ANTHROPIC_API_KEY`

### Full System Prompts (3 variants):

**content_plan:**
```
You are a Threads content strategist. Based on the user's identity, archetypes, and top-performing content, create a 7-day content plan.

Respond ONLY with valid JSON in this format:
{
  "posts_per_day": number,
  "best_times": ["time1", "time2"],
  "primary_archetypes": [{"name": "...", "percentage": number}],
  "daily_plan": [
    {
      "day": "Monday",
      "posts": [
        {
          "archetype": "archetype name",
          "funnel_stage": "TOF" | "MOF" | "BOF",
          "topic": "brief description of the post angle",
          "hook_idea": "suggested opening line"
        }
      ]
    }
  ],
  "weekly_themes": [
    {
      "theme": "theme name",
      "angles": ["angle 1", "angle 2", "angle 3"]
    }
  ]
}
```

**branding_plan:**
```
You are a personal branding strategist for Threads. Based on the user's identity, story, and audience, create a personal branding plan.

Respond ONLY with valid JSON in this format:
{
  "positioning_statement": "one sentence positioning",
  "brand_pillars": [
    {
      "name": "pillar name",
      "description": "2-3 sentences",
      "post_angles": ["angle 1", "angle 2"],
      "related_archetype": "archetype name"
    }
  ],
  "voice_summary": {
    "tone_descriptors": ["word1", "word2", "word3"],
    "do_list": ["rule 1", "rule 2"],
    "dont_list": ["rule 1", "rule 2"]
  },
  "authority_signals": ["proof point 1", "proof point 2"]
}
```

**funnel_strategy:**
```
You are a content funnel strategist. Based on the user's main goal, identity, and archetypes, create a TOF/MOF/BOF funnel strategy for Threads.

Respond ONLY with valid JSON in this format:
{
  "main_goal": "user's goal",
  "tof": {
    "purpose": "...",
    "content_percentage": 50,
    "post_ideas": [{"idea": "...", "archetype": "...", "hook": "..."}],
    "metrics": ["metric1", "metric2"]
  },
  "mof": { ... },
  "bof": { ... },
  "conversion_path": "description of how stages connect"
}
```

### Data Flow:
- **Calls getUserContext():** YES
- **getUserContext output included in prompt:** YES — passed as the `user` message content
- **Additional data:** `plan_type` from request body (determines which system prompt)

---

## 3. `generate-draft-posts`

**Provider:** Lovable AI Gateway (`google/gemini-2.5-flash`)  
**API Key:** `LOVABLE_API_KEY`

### Full System Prompt (per post):
```
You are Threadable AI — a Threads content writer. Write a single Threads post based on the specifications below.

${userContext}

=== POST SPECIFICATIONS ===
Archetype: ${post.archetype || "General"}
Funnel Stage: ${post.funnel_stage || "TOF"}
Topic: ${post.topic || ""}
Hook Idea: ${post.hook_idea || ""}

=== RULES ===
- Write ONE complete Threads post ready to publish
- Stay under 500 characters unless the content requires more (max 2200)
- Follow all content preferences exactly
- Use the specified archetype's writing pattern
- Match the funnel stage intent (TOF = reach/awareness, MOF = trust/credibility, BOF = conversion/action)
- Use REAL facts, numbers, and stories from the user's Identity — never make anything up
- Start with a strong hook based on the hook idea provided
- Format for mobile readability — short paragraphs, line breaks between thoughts
- Do NOT include hashtags unless the user's content preferences say to
- Sound like the user, not like AI

Respond with ONLY the post text. No explanations, no labels, no quotes around it.
```

### Data Flow:
- **Calls getUserContext():** YES
- **getUserContext output included in prompt:** YES
- **Specific post data passed:** archetype, funnel_stage, topic, hook_idea, scheduled_time from request body

---

## 4. `extract-identity`

**Provider:** Anthropic (`claude-sonnet-4-20250514`)  
**API Key:** `ANTHROPIC_API_KEY`

### Full System Prompt:
```
You are an AI that analyzes a user's social media posts to extract their professional identity. You will receive their Threads bio and their top-performing posts.

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
- Respond with ONLY the JSON, no markdown fences or extra text
```

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried directly:**
  - `profiles`: threads_username, niche, display_name, full_name, end_goal, dream_client
  - `posts_analyzed`: text_content, views, likes, replies, engagement_rate (top 75 by views, own only)

---

## 5. `process-knowledge`

**Provider:** Lovable AI Gateway (`google/gemini-2.5-flash`)  
**API Key:** `LOVABLE_API_KEY`

### Full System Prompt:
```
Summarize the following web page content into a concise knowledge entry. Extract:
1. Key facts and data points
2. Main arguments or insights
3. Relevant quotes or statistics
4. How this could be useful for creating social media content

Keep the summary under 2000 characters. Be specific and factual.

Content:
```

### Data Flow:
- **Calls getUserContext():** NO
- **Data passed:** Raw URL content (fetched HTML → stripped to text, truncated to 10,000 chars) OR raw .txt/.md file content from storage

---

## 6. `analyze-voice`

**Provider:** Lovable AI Gateway (`google/gemini-3-flash-preview`)  
**API Key:** `LOVABLE_API_KEY`

### System Prompt:
```
You are an expert writing style analyst. Analyze the writing samples provided and extract a detailed voice profile.
```

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `posts_analyzed`: text_content (top 20 by engagement_rate)
  - `voice_samples`: sample_text (all)

---

## 7. `fix-post`

**Provider:** Lovable AI Gateway (`google/gemini-3-flash-preview`)  
**API Key:** `LOVABLE_API_KEY`

### Full System Prompt:
```
You are a content editor. Rewrite the post incorporating the user's feedback while keeping the same archetype, funnel stage (${post.funnel_stage}), and emotional tone. Stay under 500 characters. Match the user's voice: ${voiceText}

${vaultContext}

Return ONLY the corrected post text, nothing else. No quotes, no explanation.
```

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `scheduled_posts`: text_content, content_category, funnel_stage (specific post by ID)
  - `profiles`: voice_profile
  - `user_story_vault`: numbers + stories sections only
- **Additional input:** user's feedback text

---

## 8. `generate-content` (630 lines)

**Provider:** Lovable AI Gateway (`google/gemini-3-flash-preview`)  
**API Key:** `LOVABLE_API_KEY`

### System Prompt Summary:
Very large prompt including: voice profile, niche/dream_client/end_goal, vault context (numbers with story cross-references, stories with role attribution rules, offers with CTAs, audience), funnel mix instructions, regression insights, strategy JSON, playbook context (weekly schedule, templates, rules, generation guidelines, quality checklist), style reference (top 5 posts), and 13 hard rules including 500-char limit, variety checklist, and attribution rules.

### Data Flow:
- **Calls getUserContext():** NO — builds its own context
- **Tables queried directly:**
  - `profiles`: niche, dream_client, end_goal, voice_profile, funnel_goal, funnel_tof_pct, funnel_mof_pct, funnel_bof_pct
  - `content_strategies`: weekly (strategy_json + regression_insights)
  - `posts_analyzed`: top 5 by engagement_rate
  - `content_strategies`: playbook (strategy_data)
  - `user_story_vault`: all sections (numbers, stories, offers, audience)
- **Also calls:** `score-post` edge function for each generated post (with retry loop up to 2x)

---

## 9. `generate-strategy`

**Provider:** Lovable AI Gateway (`google/gemini-3-flash-preview`)  
**API Key:** `LOVABLE_API_KEY`

### Full System Prompt:
```
You are an expert Threads content strategist. Based on the user's niche, dream client, end goal, and data-driven insights from their post performance, create a weekly content strategy.

USER CONTEXT:
Niche: ${profile.niche || "Not specified"}
Dream Client: ${profile.dream_client || "Not specified"}
End Goal: ${profile.end_goal || "Not specified"}

DATA INSIGHTS:
- ${insightsText || "No insights available"}
- Best posting day: ${insights.best_posting_day?.day || "N/A"} (avg ${insights.best_posting_day?.avg_views || 0} views)
- Best posting hour: ${insights.best_posting_hour?.hour || "N/A"}:00 (avg ${insights.best_posting_hour?.avg_views || 0} views)
- Optimal word count: ${insights.optimal_word_count_range?.min || 0}-${insights.optimal_word_count_range?.max || 0} words
- Credibility marker lift: ${insights.credibility_marker_lift || 0}%
- Question lift: ${insights.question_lift || 0}%

TOP PERFORMING POSTS:
${topPostsText || "No posts analyzed yet"}
```

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `profiles`: niche, dream_client, end_goal, voice_profile
  - `content_strategies`: latest (regression_insights)
  - `posts_analyzed`: top 10 by engagement_rate

---

## 10. `weekly-assessment`

**Provider:** Lovable AI Gateway (`google/gemini-3-flash-preview`)  
**API Key:** `LOVABLE_API_KEY`

### System Prompt:
```
You are a Threads growth analyst. Return ONLY the requested JSON.
```

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `posts_analyzed`: all columns (this week + last week date ranges)
  - `profiles`: threads_access_token, threads_user_id, threads_username
  - `follower_snapshots`: previous follower_count
  - `content_strategies`: active strategy (strategy_json)
- **Also:** Re-runs regression analysis locally on all posts, fetches live follower count from Threads API

---

## 11. `discover-archetypes`

**Provider:** Anthropic (`claude-sonnet-4-20250514`)  
**API Key:** `ANTHROPIC_API_KEY`

### Full System Prompt (established account):
```
You are a viral content strategist analyzing a creator's Threads posts to discover their unique content archetypes.

Here are their top ${posts.length} posts ranked by views with engagement data:

${postsForAnalysis}

Analyze these posts and discover 3-5 distinct CONTENT ARCHETYPES...

Respond ONLY in this exact JSON format:
{
  "archetypes": [...],
  "weekly_schedule": [...],
  "rules": [...]
}
```

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `posts_analyzed`: text_content, views, likes, replies, reposts, quotes, engagement_rate, word_count, posted_at (top 50 by views)
- **For new accounts:** Only niche + goals from request body

---

## 12. `generate-playbook`

**Provider:** Anthropic (`claude-sonnet-4-20250514`)  
**API Key:** `ANTHROPIC_API_KEY`

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `content_strategies`: archetype_discovery (strategy_data)
  - `content_strategies`: weekly (regression_insights, latest)
  - `posts_analyzed`: top 10 by views (text_content, views, likes, replies, reposts, quotes, engagement_rate)
  - `profiles`: voice_profile, niche, dream_client, end_goal

---

## 13. `run-analysis`

**Provider:** Anthropic (`claude-sonnet-4-20250514`)  
**API Key:** `ANTHROPIC_API_KEY`

### Data Flow:
- **Calls getUserContext():** NO
- **Tables queried:**
  - `posts_analyzed`: all columns (top 75 by views, full text sent to AI)

---

## 14. `score-post`

- **NO AI call** — pure regex/pattern matching
- **Tables queried:** `content_strategies` (playbook checklist)

---

# Summary A: What Does the Chat AI Know?

| Data Category | Status | Notes |
|---|---|---|
| Identity (about_you, desired_perception, main_goal) | **YES** | From `user_identity` table |
| Stories (titles and full content) | **YES** | From `user_story_vault` |
| Numbers/proof points | **YES** | Via story vault |
| Offers (names, descriptions) | **YES** | No pricing — offers table has no price field |
| Target audiences | **YES** | From `user_audiences` |
| Personal information | **YES** | From `user_personal_info` |
| Sales funnel steps (with URLs, prices, goals) | **YES** | From `user_sales_funnel` |
| Writing style preferences | **YES** | From `user_writing_style` |
| Content rules (do's and don'ts) | **YES** | Via `content_preferences` |
| Knowledge base items (processed summaries) | **YES** | Up to 30 items, truncated to 300 chars each |
| Archetypes (names, descriptions, templates) | **YES** | From `content_strategies` (archetype_discovery) |
| Content templates | **YES** | From `content_templates` |
| Top performing posts (text and metrics) | **YES** | Top 10 by views |
| Regression insights (key findings) | **YES** | human_readable_insights array |
| Current content plan | **YES** | Truncated to 500 chars |
| Branding plan | **YES** | positioning_statement only |
| Funnel strategy | **YES** | Truncated to 500 chars |

---

# Summary B: Approximate System Prompt Size

With full data across all sections, the `getUserContext` output is approximately **8,000–15,000 characters** depending on content volume. Adding the chat system prompt rules (~600 chars), total system prompt is roughly **8,600–15,600 characters** (~2,500–4,500 tokens).

---

# Summary C: Tables NOT Queried by getUserContext

| Table | Used By | Notes |
|---|---|---|
| `voice_samples` | `analyze-voice` only | Raw writing samples, not included in chat context |
| `scheduled_posts` | `fix-post`, `generate-content` | Draft/scheduled posts not visible to chat AI |
| `weekly_reports` | `weekly-assessment` (write only) | Historical weekly reports not accessible |
| `competitor_accounts` | None (AI) | Competitor data not used by any AI function |
| `follower_snapshots` | `weekly-assessment` only | Historical follower data not in chat context |
| `chat_messages` / `chat_sessions` | None (AI) | Chat history not included in context (only current session history via message_history param) |
| `waitlist_signups` | None | Marketing data, not user-facing |

---

# AI Provider Summary

| Function | Provider | Model | API Key |
|---|---|---|---|
| `chat-with-threadable` | Lovable AI Gateway | `google/gemini-2.5-flash` | `LOVABLE_API_KEY` |
| `generate-draft-posts` | Lovable AI Gateway | `google/gemini-2.5-flash` | `LOVABLE_API_KEY` |
| `process-knowledge` | Lovable AI Gateway | `google/gemini-2.5-flash` | `LOVABLE_API_KEY` |
| `analyze-voice` | Lovable AI Gateway | `google/gemini-3-flash-preview` | `LOVABLE_API_KEY` |
| `fix-post` | Lovable AI Gateway | `google/gemini-3-flash-preview` | `LOVABLE_API_KEY` |
| `generate-content` | Lovable AI Gateway | `google/gemini-3-flash-preview` | `LOVABLE_API_KEY` |
| `generate-strategy` | Lovable AI Gateway | `google/gemini-3-flash-preview` | `LOVABLE_API_KEY` |
| `weekly-assessment` | Lovable AI Gateway | `google/gemini-3-flash-preview` | `LOVABLE_API_KEY` |
| `generate-plans` | Anthropic | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| `extract-identity` | Anthropic | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| `discover-archetypes` | Anthropic | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| `generate-playbook` | Anthropic | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| `run-analysis` | Anthropic | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| `score-post` | None (regex) | N/A | N/A |
