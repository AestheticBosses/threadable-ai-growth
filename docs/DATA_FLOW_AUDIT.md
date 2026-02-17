# Threadable Data Flow Audit

> Last updated: 2026-02-16

Reference document for the entire Threadable pipeline — every edge function, hook, and data dependency mapped.

---

## 1. Data Flow Map

### Edge Functions — AI-Powered

#### `extract-identity`
| | Details |
|---|---|
| **Reads** | `profiles` (threads_username, niche, display_name, full_name, end_goal, dream_client), `posts_analyzed` (top 75 by views, source="own") |
| **Writes** | `user_identity` (about_you, desired_perception, main_goal), `user_story_vault` (section="stories"), `user_offers`, `user_audiences`, `user_personal_info` |
| **Caller params** | None (auth only) |
| **AI context** | **With posts:** Profile bio + niche + goal + dream client + top 75 posts with engagement data. **Without posts (starter):** Niche + dream client + end goal only. |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ data: parsed, post_count }` (with posts) or `{ data: parsed, post_count: 0, is_starter: true }` (starter) |
| **Notes** | Two paths: (1) With posts — full extraction of stories, offers, audiences, personal_info from post analysis. (2) Without posts (starter) — generates about_you, audiences, personal_info from profile niche/dream_client/end_goal; stories and offers are empty. Uses check-then-insert/update pattern. Auth uses `getClaims()`. |

#### `analyze-voice`
| | Details |
|---|---|
| **Reads** | `profiles` (niche, dream_client, end_goal), `posts_analyzed` (top 20 by engagement_rate, source="own"), `voice_samples` |
| **Writes** | `profiles.voice_profile` (JSON blob) |
| **Caller params** | None (auth only) |
| **AI context** | Creator context (niche/dream_client/end_goal) + top 20 post texts + voice samples. Niche context helps identify industry-specific language patterns. |
| **AI model** | claude-sonnet-4-20250514 (tool_use pattern) |
| **Returns** | `{ success, voice_profile }` |
| **Notes** | Uses tool_use API pattern with structured output schema. Voice profile includes tone, vocabulary, sentence_patterns, personality_traits, etc. Profile, posts, and samples fetched in parallel. |

#### `discover-archetypes`
| | Details |
|---|---|
| **Reads** | `profiles` (niche, dream_client, end_goal), `posts_analyzed` (top 50 by views) |
| **Writes** | `content_strategies` (strategy_type="archetype_discovery") |
| **Caller params** | `new_account` (boolean), `niche`, `goals` |
| **AI context** | Two paths: **New account** — niche + goals only. **Seasoned** — niche + dream_client + end_goal + top 50 posts with full engagement data |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, analysis: { archetypes, weekly_schedule, rules } }` |
| **Notes** | DB profile query used as fallback when caller params missing. |

#### `run-analysis`
| | Details |
|---|---|
| **Reads** | `profiles` (niche, dream_client, end_goal), `posts_analyzed` (ALL posts, top 75 sent to AI) |
| **Writes** | `content_strategies` × 2: regression_insights, playbook (includes analysis_archetypes for reference) |
| **Caller params** | None (auth only) |
| **AI context** | Creator context (niche/dream_client/end_goal) + account summary stats + top 75 posts with full text and engagement |
| **AI model** | claude-sonnet-4-20250514 (max_tokens: 8000) |
| **Returns** | `{ success, analysis }` |
| **Notes** | Single comprehensive AI call. Does NOT write archetype_discovery (owned exclusively by discover-archetypes). Regression-informed archetypes are stored in the playbook data as `analysis_archetypes`. |

#### `run-regression`
| | Details |
|---|---|
| **Reads** | `posts_analyzed` (ALL posts) |
| **Writes** | `content_strategies` (strategy_type="regression_insights") |
| **Caller params** | None (auth only) |
| **AI context** | None — pure statistical analysis |
| **AI model** | None (no AI) |
| **Returns** | `{ success, insights }` |
| **Notes** | Pearson correlation + lift analysis on post features (word_count, has_question, has_number, etc.). No AI involved. |

#### `discover-niche-accounts`
| | Details |
|---|---|
| **Reads** | `profiles` (niche, dream_client, end_goal) |
| **Writes** | `competitor_accounts`, `content_strategies` (strategy_type="niche_discovery") |
| **Caller params** | `niche`, `dream_client` |
| **AI context** | Niche + dream client + end goal. Prompt prioritizes mid-tier creators (5K-100K followers) with high engagement aligned to user's goals |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, data: { accounts, niche_patterns } }` |
| **Notes** | DB profile used as fallback when caller params missing. Saves each account to competitor_accounts with default niche_relevance_score=80. |

#### `generate-playbook`
| | Details |
|---|---|
| **Reads** | `content_strategies` (archetype_discovery, regression_insights), `posts_analyzed` (top 10 by views), `profiles` (voice_profile, niche, dream_client, end_goal) |
| **Writes** | `content_strategies` (strategy_type="playbook") |
| **Caller params** | None (auth only) |
| **AI context** | Archetypes + regression insights + voice profile + niche/dream_client/end_goal + top 10 post texts |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, playbook }` |
| **Notes** | Generates weekly_schedule, checklist (scoring criteria), rules, and templates. |

#### `generate-templates`
| | Details |
|---|---|
| **Reads** | `content_strategies` (archetype_discovery), `profiles` (niche, end_goal, dream_client, voice_profile), `user_identity` (about_you), `user_story_vault` (stories), `user_personal_info` |
| **Writes** | `content_templates` |
| **Caller params** | None (auth only) |
| **AI context** | Archetype names/descriptions + niche + dream_client + end_goal + about_you + voice profile (tone, sentence style, vocabulary, common phrases, quirks) + stories (title, body, lesson) + personal facts |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, templates }` |
| **Notes** | Generates 5 fill-in-the-blank templates per archetype. Deletes existing templates before inserting. |

#### `generate-strategy`
| | Details |
|---|---|
| **Reads** | via `getUserContext()` (everything), `content_strategies` (latest with regression_insights) |
| **Writes** | `content_strategies.strategy_json` |
| **Caller params** | None (auth only) |
| **AI context** | Full getUserContext output + latest strategy + regression insights |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, strategy }` |

#### `generate-plans`
| | Details |
|---|---|
| **Reads** | via `getUserContext()` (everything) |
| **Writes** | `user_plans` |
| **Caller params** | `plan_type` (content_plan, branding_plan, funnel_strategy) |
| **AI context** | Full getUserContext output |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, plan }` |

#### `generate-content`
| | Details |
|---|---|
| **Reads** | via `getUserContext()` (everything) |
| **Writes** | `scheduled_posts` |
| **Caller params** | `posts[]` array (each with archetype, funnel_stage, topic, hook_idea) |
| **AI context** | Full getUserContext output + per-post archetype/topic instructions |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, posts }` |
| **Notes** | Generates posts concurrently (3 at a time via Promise batching). |

#### `generate-draft-posts`
| | Details |
|---|---|
| **Reads** | via `getUserContext()` (everything) |
| **Writes** | `scheduled_posts` |
| **Caller params** | `posts[]` array (each with archetype, funnel_stage, topic, hook_idea) |
| **AI context** | Full getUserContext output + per-post archetype/topic/hook instructions |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ total, failed, posts, errors }` |
| **Notes** | Generates posts concurrently (3 at a time via Promise batching). Uses getUserContext for full identity/voice/stories/archetypes context. |

#### `chat-with-threadable`
| | Details |
|---|---|
| **Reads** | via `getUserContext()` (everything) |
| **Writes** | Nothing (streams response) |
| **Caller params** | `messages[]`, `session_id` |
| **AI context** | Full getUserContext output as system prompt |
| **AI model** | claude-sonnet-4-20250514 (streaming) |
| **Returns** | Streaming text response |
| **Notes** | Chat messages saved client-side via useChatData hook. |

#### `fix-post`
| | Details |
|---|---|
| **Reads** | `scheduled_posts` (by post_id), via `getUserContext()` (everything) |
| **Writes** | `scheduled_posts` (updated text_content + new score) |
| **Caller params** | `post_id`, `feedback` |
| **AI context** | Full getUserContext output + original post text + user feedback |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, post }` |
| **Notes** | After AI rewrites, calls score-post internally to update score. |

#### `score-post`
| | Details |
|---|---|
| **Reads** | `content_strategies` (strategy_type="playbook", checklist field) |
| **Writes** | Nothing |
| **Caller params** | `text` |
| **AI context** | None — regex pattern matching |
| **AI model** | None (no AI) |
| **Returns** | `{ score, max_score, breakdown[] }` |
| **Notes** | Matches post text against playbook checklist criteria using regex. Default 6-criteria checklist if no playbook exists. |

#### `categorize-posts`
| | Details |
|---|---|
| **Reads** | `content_strategies` (archetype_discovery), `posts_analyzed` (uncategorized posts) |
| **Writes** | `posts_analyzed.content_category` |
| **Caller params** | None (auth only) |
| **AI context** | Archetype names/descriptions + batches of 50 post texts |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, categorized_count }` |

#### `process-knowledge`
| | Details |
|---|---|
| **Reads** | `knowledge_base` (by id) |
| **Writes** | `knowledge_base` (raw_content, summary, processed=true) |
| **Caller params** | `id` |
| **AI context** | Raw content from URL/document |
| **AI model** | claude-sonnet-4-20250514 |
| **Returns** | `{ success, summary }` |

#### `weekly-assessment`
| | Details |
|---|---|
| **Reads** | `posts_analyzed` (this/last week), `profiles`, `follower_snapshots`, `content_strategies`, via `getUserContext()` |
| **Writes** | `weekly_reports`, `content_strategies` (new active + complete old), `follower_snapshots` |
| **Caller params** | None (auth only) |
| **AI context** | Full getUserContext + this week's posts + last week's comparison + follower growth |
| **AI model** | claude-sonnet-4-20250514 (tool_use pattern) |
| **Returns** | `{ success, report }` |

### Edge Functions — No AI (API / CRUD)

#### `fetch-user-posts`
| | Details |
|---|---|
| **Reads** | `profiles` (threads_user_id, threads_access_token) |
| **Writes** | `posts_analyzed` (source="own", with computed features: word_count, has_question, archetype, etc.), `profiles` (threads_username, full_name, is_established), `follower_snapshots` |
| **API** | Threads Media API (paginated) |
| **Notes** | Computes post features client-side (word_count, has_question, has_number, has_cta, has_list). Sets `is_established` on profile if 20+ posts. |

#### `fetch-competitor-posts`
| | Details |
|---|---|
| **Reads** | `profiles` (threads_access_token for API auth) |
| **Writes** | `posts_analyzed` (source="competitor") |
| **Caller params** | `usernames[]` |
| **API** | Threads User Search + Media API |

#### `publish-post`
| | Details |
|---|---|
| **Reads** | `scheduled_posts` (by id), `profiles` (threads_access_token, threads_user_id) |
| **Writes** | `scheduled_posts` (status="published", threads_media_id, published_at) |
| **API** | Threads Publishing API (create container → publish) |

#### `refresh-profile`
| | Details |
|---|---|
| **Reads** | `profiles` (threads_access_token) |
| **Writes** | `profiles` (threads_username, full_name, profile_pic_url, follower_count), `follower_snapshots` |
| **API** | Threads User Profile API |

#### `refresh-tokens`
| | Details |
|---|---|
| **Reads** | `profiles` (tokens expiring within 10 days) |
| **Writes** | `profiles` (threads_access_token, token_expires_at) |
| **API** | Threads Token Refresh API |
| **Notes** | Designed to run as a cron job. |

#### `snapshot-followers`
| | Details |
|---|---|
| **Reads** | All `profiles` with valid tokens |
| **Writes** | `follower_snapshots` |
| **API** | Threads User Profile API |
| **Notes** | Cron job — iterates all users. |

### Shared Utility: `getUserContext()`

Located at `supabase/functions/_shared/getUserContext.ts`. Fires **19 parallel queries** and assembles a single context string.

**Queries:**
1. `profiles` — niche, dream_client, end_goal, voice_profile, threads_username, display_name, full_name, follower_count
2. `user_identity` — about_you, desired_perception, main_goal
3. `user_story_vault` — all sections
4. `user_offers` — all offers
5. `user_audiences` — all audiences
6. `user_personal_info` — all facts
7. `user_writing_style` — tone, sentence_length, vocabulary_level, etc.
8. `content_preferences` — post_length, emoji_usage, hashtag_style, etc.
9. `voice_samples` — all samples
10. `content_strategies` (archetype_discovery) — archetypes
11. `content_strategies` (playbook) — templates, rules, checklist
12. `content_strategies` (regression_insights) — insights
13. `content_templates` — all templates
14. `user_sales_funnel` — funnel stages
15. `knowledge_base` — summaries (processed only)
16. `posts_analyzed` (top 10 by views) — best performing posts
17. `posts_analyzed` (top 10 by engagement_rate) — most engaging posts
18. `competitor_accounts` — tracked competitors
19. `posts_analyzed` (source="competitor", top 10 by views) — competitor posts

**Used by:** `chat-with-threadable`, `generate-content`, `generate-plans`, `generate-strategy`, `fix-post`, `weekly-assessment`

**NOT used by:** `generate-playbook`, `generate-templates`, `run-analysis`, `discover-archetypes`, `discover-niche-accounts`, `extract-identity`, `analyze-voice`

---

## 2. Onboarding Pipeline Sequence

### Path A: Seasoned Account (20+ posts with viral content)

```
Step 1: Connect Threads
  └─► OAuth flow → profiles.threads_access_token, threads_user_id

Step 2: fetch-user-posts
  └─► Threads API → posts_analyzed (source="own")
  └─► profiles.is_established = true (if 20+ posts)
  └─► profiles.threads_username, full_name
  └─► follower_snapshots

Step 3: Set Niche / Dream Client / End Goal
  └─► profiles.niche, profiles.dream_client, profiles.end_goal

Step 4 (parallel):
  ├─► extract-identity
  │     └─► user_identity (about_you, desired_perception, main_goal)
  │     └─► user_story_vault (stories)
  │     └─► user_offers
  │     └─► user_audiences
  │     └─► user_personal_info
  │
  ├─► analyze-voice
  │     └─► profiles.voice_profile
  │
  └─► run-analysis
        └─► content_strategies (regression_insights)
        └─► content_strategies (archetype_discovery)
        └─► content_strategies (playbook)

Step 5: discover-niche-accounts
  └─► competitor_accounts
  └─► content_strategies (niche_discovery)

Step 6: Redirect to /my-story (Identity page)
```

### Path B: New Account (< 20 posts)

```
Step 1: Connect Threads
  └─► OAuth flow → profiles.threads_access_token, threads_user_id

Step 2: fetch-user-posts
  └─► posts_analyzed (may be empty or sparse)
  └─► profiles.is_established = false

Step 3: Set Niche / Dream Client / End Goal
  └─► profiles.niche, profiles.dream_client, profiles.end_goal

Step 4: discover-niche-accounts
  └─► competitor_accounts
  └─► content_strategies (niche_discovery)

Step 5: discover-archetypes (new_account=true)
  └─► content_strategies (archetype_discovery) — niche-based, no posts needed

Step 6: extract-identity (starter mode — no posts)
  └─► user_identity (about_you, desired_perception, main_goal) — AI-generated from niche/dream_client/end_goal
  └─► user_audiences — AI-generated from dream_client
  └─► user_personal_info — AI-generated from niche

Step 7: generate-playbook
Step 8: generate-plans (content, branding, funnel)
Step 9: generate-templates

Step 10: Redirect to /my-story (Identity page with "Starter Identity" banner)

Note: analyze-voice and run-analysis are SKIPPED (require posts).
      Identity page prompts user to run Auto-Fill once they have posts.
```

### Post-Onboarding Functions (triggered by user actions)

| Trigger | Function | Depends On |
|---|---|---|
| User clicks "Generate Templates" | `generate-templates` | archetype_discovery, profiles, user_identity |
| User clicks "Generate Playbook" | `generate-playbook` | archetype_discovery, regression_insights, profiles |
| User clicks "Generate Posts" | `generate-draft-posts` | profiles, playbook, archetypes, stories, sales funnel |
| User clicks "Generate Content" | `generate-content` | getUserContext (everything) |
| User chats | `chat-with-threadable` | getUserContext (everything) |
| User clicks "Create Plan" | `generate-plans` | getUserContext (everything) |
| User clicks "Fix Post" | `fix-post` | getUserContext + scheduled_post |
| Weekly cron | `weekly-assessment` | getUserContext + posts this/last week |
| User adds knowledge URL | `process-knowledge` | knowledge_base entry |
| User clicks "Categorize" | `categorize-posts` | archetype_discovery, posts_analyzed |
| User clicks "Run Regression" | `run-regression` | posts_analyzed (all) |

---

## 3. Identity Data Completeness

### Write Sources → Read Consumers

| Data | Written By | Read By |
|---|---|---|
| `profiles.niche` | Onboarding UI | extract-identity, discover-archetypes, discover-niche-accounts, run-analysis, generate-playbook, generate-templates, generate-draft-posts, getUserContext |
| `profiles.dream_client` | Onboarding UI | extract-identity, discover-archetypes, discover-niche-accounts, run-analysis, generate-playbook, generate-templates, generate-draft-posts, getUserContext |
| `profiles.end_goal` | Onboarding UI | extract-identity, discover-archetypes, discover-niche-accounts, run-analysis, generate-playbook, generate-templates, generate-draft-posts, getUserContext |
| `profiles.voice_profile` | analyze-voice | generate-playbook, generate-draft-posts, getUserContext |
| `profiles.threads_access_token` | OAuth flow | fetch-user-posts, fetch-competitor-posts, publish-post, refresh-profile, snapshot-followers |
| `profiles.follower_count` | refresh-profile, fetch-user-posts | getUserContext, useDashboardData |
| `profiles.is_established` | fetch-user-posts | Onboarding UI (determines path) |
| `user_identity.about_you` | extract-identity, AboutYouSection UI | generate-templates, getUserContext |
| `user_identity.desired_perception` | extract-identity, UI | getUserContext |
| `user_identity.main_goal` | extract-identity, UI | getUserContext |
| `user_story_vault` | extract-identity, StoryVault UI | generate-draft-posts, getUserContext |
| `user_offers` | extract-identity, UI | getUserContext |
| `user_audiences` | extract-identity, UI | getUserContext |
| `user_personal_info` | extract-identity, UI | getUserContext |
| `user_writing_style` | UI (VoiceSettings) | getUserContext |
| `content_preferences` | UI (auto-seeded on first read) | getUserContext |
| `voice_samples` | UI | analyze-voice, getUserContext |
| `content_strategies.archetype_discovery` | discover-archetypes | generate-playbook, generate-templates, categorize-posts, getUserContext |
| `content_strategies.regression_insights` | run-regression, run-analysis | generate-playbook, generate-strategy, getUserContext |
| `content_strategies.playbook` | generate-playbook, run-analysis | score-post, getUserContext |
| `content_strategies.niche_discovery` | discover-niche-accounts | getUserContext |
| `content_templates` | generate-templates | getUserContext |
| `competitor_accounts` | discover-niche-accounts | getUserContext |
| `posts_analyzed` (own) | fetch-user-posts | extract-identity, analyze-voice, discover-archetypes, run-analysis, run-regression, categorize-posts, generate-draft-posts, generate-playbook, getUserContext, weekly-assessment |
| `posts_analyzed` (competitor) | fetch-competitor-posts | getUserContext |
| `scheduled_posts` | generate-content, generate-draft-posts | fix-post, publish-post, useDashboardData |
| `knowledge_base` | UI + process-knowledge | getUserContext |
| `user_sales_funnel` | UI | generate-draft-posts, getUserContext |
| `user_plans` | generate-plans | usePlansData |
| `weekly_reports` | weekly-assessment | useDashboardData |
| `follower_snapshots` | snapshot-followers, fetch-user-posts, refresh-profile, weekly-assessment | useDashboardData, weekly-assessment |

### Frontend Hooks → Tables

| Hook | Table(s) | Query Key |
|---|---|---|
| `useAboutYou` | user_identity | `["user-identity", userId]` |
| `useOffers` (useIdentityData) | user_offers | `["user-offers", userId]` |
| `useAudiences` | user_audiences | `["user-audiences", userId]` |
| `usePersonalInfo` | user_personal_info | `["user-personal-info", userId]` |
| `useArchetypeDiscovery` | content_strategies | `["archetype-discovery", userId]` |
| `useRegressionInsights` | content_strategies | `["regression-insights", userId]` |
| `usePlaybookData` | content_strategies | `["playbook-data", userId]` |
| `useNumbers` | user_story_vault (section="numbers") | `["story-vault", "numbers", userId]` |
| `useStories` | user_story_vault (section="stories") | `["story-vault", "stories", userId]` |
| `useOffers` (useStoryVault) | user_story_vault (section="offers") | `["story-vault", "offers", userId]` |
| `useAudience` (useStoryVault) | user_story_vault (section="audience") | `["story-vault", "audience", userId]` |
| `usePostsAnalyzed` | posts_analyzed (source="own") | `["posts-analyzed", userId]` |
| `useKnowledgeBase` | knowledge_base | `["knowledge-base", userId]` |
| `useWritingStyle` | user_writing_style | `["writing-style", userId]` |
| `useContentPreferences` | content_preferences | `["content-preferences", userId]` |
| `useContentPlan` | user_plans (type="content_plan") | `["content-plan", userId]` |
| `useBrandingPlan` | user_plans (type="branding_plan") | `["branding-plan", userId]` |
| `useFunnelStrategy` | user_plans (type="funnel_strategy") | `["funnel-strategy", userId]` |
| `useHasIdentity` | user_identity (about_you) | `["has-identity", userId]` |
| `useChatSessions` | chat_sessions | `["chat-sessions", userId]` |
| `useChatMessages` | chat_messages | `["chat-messages", sessionId]` |
| `useChatContextData` | user_story_vault, user_offers, knowledge_base, posts_analyzed | `["chat-context", userId]` |
| `useDashboardData` | posts_analyzed, weekly_reports, follower_snapshots, profiles, scheduled_posts | `["dashboard-data", userId]` |
| `useExtractIdentity` | Calls extract-identity edge function, then writes to user_identity, user_story_vault, user_offers, user_audiences, user_personal_info | Invalidates: user-identity, story-vault, user-offers, user-audiences, user-personal-info |

---

## 4. Known Gaps & Risks

### Data Gaps

| Gap | Severity | Details |
|---|---|---|
| ~~**New accounts have no identity data**~~ | ~~Medium~~ | **RESOLVED** — extract-identity now has a "starter" path: when no posts exist, it generates about_you, audiences, personal_info, desired_perception, and main_goal from the user's niche/dream_client/end_goal via AI. New account onboarding calls extract-identity instead of inline placeholders. Identity page shows a "Starter Identity" banner prompting users to re-run Auto-Fill once they have posts. Voice profile and regression insights still require posts. |
| ~~**generate-draft-posts doesn't use getUserContext**~~ | ~~Low~~ | **RESOLVED** — generate-draft-posts already uses `getUserContext()` which provides full identity context including about_you, personal_info, and audiences. |
| **Dual offer systems** | Medium | `user_offers` (from extract-identity / Identity UI) and `user_story_vault` section="offers" (from Story Vault UI) both store offers. getUserContext reads both. Could cause duplicates or confusion. |
| ~~**run-analysis overwrites archetype_discovery**~~ | ~~Medium~~ | **RESOLVED** — run-analysis no longer writes to archetype_discovery. It stores its regression-informed archetypes in the playbook data as `analysis_archetypes`. archetype_discovery is exclusively owned by discover-archetypes. |
| **score-post uses regex, not AI** | Low | Checklist criteria are matched via simple regex patterns. Complex criteria (e.g., "Does the hook create curiosity?") can't be reliably evaluated this way. |
| **categorize-posts server-side vs usePostsAnalyzed client-side** | Low | `categorize-posts` writes `content_category` to DB via AI. `usePostsAnalyzed` has its own `classifyArchetype()` function that classifies client-side. These may disagree. |

### Race Conditions

| Risk | Severity | Details |
|---|---|---|
| ~~**Onboarding Step 4 parallelism**~~ | ~~Medium~~ | **RESOLVED** — run-analysis no longer writes archetype_discovery. In the seasoned path, run-analysis runs first (writes regression_insights + playbook), then discover-archetypes runs and writes archetype_discovery without conflict. |
| **extract-identity re-run clears data** | Low | Re-running extract-identity deletes all existing user_offers, user_audiences, user_personal_info, user_story_vault stories before re-inserting. Any manual edits are lost. |

### Missing Data in AI Prompts

| Function | Missing | Impact |
|---|---|---|
| ~~**generate-draft-posts**~~ | ~~Does not include `user_identity.about_you`, `user_personal_info`, `user_audiences`~~ | **RESOLVED** — already uses `getUserContext()` which provides all identity data. |
| ~~**generate-templates**~~ | ~~Does not include `voice_profile`, `stories`, `personal_info`~~ | **RESOLVED** — now reads `voice_profile` from profiles, stories from `user_story_vault`, and facts from `user_personal_info`. All injected into the AI prompt. |
| **categorize-posts** | Does not include any profile context | Classification is purely based on archetype names + post text. Niche context might improve accuracy. |
| ~~**analyze-voice**~~ | ~~Does not include niche/dream_client/end_goal~~ | **RESOLVED** — now reads `profiles.niche/dream_client/end_goal` and injects creator context into the system prompt for niche-aware voice analysis. |

### Token / Auth Risks

| Risk | Severity | Details |
|---|---|---|
| **Token expiry** | Medium | `refresh-tokens` runs as a cron job refreshing tokens expiring within 10 days. If the cron fails, tokens expire and all Threads API functions break (fetch, publish, snapshot). |
| **extract-identity uses getClaims()** | Low | All other functions use `getUser()` for auth. extract-identity uses `getClaims()` which is a different auth path. Both work but the inconsistency could cause issues if Supabase changes auth behavior. |

### Database Constraints

| Risk | Severity | Details |
|---|---|---|
| **content_strategies upsert** | Low | All functions upsert on `(user_id, strategy_type)`. This requires a unique constraint on those columns. If the constraint is missing, upserts may create duplicates instead of updating. |
| **competitor_accounts upsert** | Low | discover-niche-accounts upserts on `(user_id, threads_username)`. Requires unique constraint. |
