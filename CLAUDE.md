# Threadable AI Growth — Architecture Reference

## What This App Does

Threadable is a Threads growth platform. It syncs a creator's posts from the Threads API, runs statistical and AI-powered analysis on their content performance, then generates data-driven content plans and draft posts in the creator's voice. The entire pipeline is multi-tenant — every query, every prompt, every piece of context is scoped to the authenticated user.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, TailwindCSS, shadcn/ui, React Query
- **Backend:** Supabase (Postgres DB, Auth, Edge Functions on Deno)
- **AI:** Anthropic Claude API (Opus 4.6 for generation, Sonnet 4 for analysis, Haiku 4.5 for scoring)
- **External API:** Threads Graph API (OAuth, post sync, publishing)
- **Payments:** Stripe (checkout, webhooks, billing portal)

## Critical Rule: Multi-Tenant Isolation

**Every edge function, every DB query, every AI prompt must be scoped to the authenticated user.** Never hardcode user-specific content (story titles, vault themes, niche references, example posts) into prompts or constants. All content in AI prompts must be dynamically fetched from the user's own DB rows. The only acceptable hardcoded content is generic concept mappings (e.g., SEMANTIC_EXPANSIONS: baby→infant, fired→laid off).

---

## Core Data Flow Pipeline

```
Threads API
    │
    ▼
[1] fetch-user-posts ──────► posts_analyzed (text + metrics + features)
    │                              │
    ▼                              ▼
[2] run-regression ────────► content_strategies (strategy_type='regression')
    │                              │
    ▼                              ▼
[3] run-analysis ──────────► content_strategies (strategy_type='regression_insights' + 'playbook')
    │                              │
    ▼                              ▼
[4] getUserContext() ──────► Assembles ALL user data into a single context string
    │                              │
    ▼                              ▼
[5] generate-plans ────────► user_plans (7-day content plan with hooks, archetypes, timing)
    │                              │
    ▼                              ▼
[6] generate-draft-posts ──► scheduled_posts (individual post drafts with quality scoring)
    │
    ▼
[7] generate-content ─────► scheduled_posts (batch of 21+ posts with dedup + scoring)
    │
    ▼
[8] publish-post ──────────► Threads API (publishes, then re-syncs metrics)
```

---

## Edge Function Reference

### Stage 1: Data Sync

#### `fetch-user-posts`
- **Owns:** Syncing posts from Threads API → `posts_analyzed` table
- **Does:** Paginates ALL root posts + replies, fetches per-post insights (views, likes, replies, reposts, quotes), computes text features via `computeTextFeatures()`, upserts to DB
- **Text features computed:** word_count, char_count, has_question, has_emoji, has_url, has_hashtag, has_credibility_marker, has_namedrop, has_dollar_amount, has_vulnerability, has_controversy, has_relatability, has_profanity, has_visual, is_short_form, has_steps, emotion_count, archetype (truth/vault_drop/hot_take/window), day_of_week, hour_posted
- **Also does:** Updates profile (username, picture, follower count), saves follower snapshot
- **Does NOT:** Run any analysis. Just syncs raw data.
- **Tables written:** `posts_analyzed`, `profiles`, `follower_snapshots`

#### `fetch-competitor-posts`
- **Owns:** Fetching competitor posts via Threads search API
- **Tables written:** `posts_analyzed` (source='competitor', source_username set)

#### `refresh-profile`
- **Owns:** Refreshing Threads profile data and follower snapshots
- **Tables written:** `profiles`, `follower_snapshots`

#### `snapshot-followers`
- **Owns:** Batch follower count recording for all users
- **Tables written:** `follower_snapshots`

### Stage 2: Analysis

#### `run-regression`
- **Owns:** Statistical regression (Pearson correlation) on text features vs. metrics
- **Features analyzed:** has_question, has_credibility_marker, has_emoji, has_hashtag, has_url, starts_with_number, word_count, char_count, line_count, hour_posted, day_of_week
- **Does NOT analyze:** archetype performance, hook patterns, emotional triggers, post content/text. It only sees boolean/numeric features.
- **Output:** Correlations, boolean feature lifts, optimal word count range, best day/hour
- **Tables written:** `content_strategies` (strategy_type='regression')

#### `run-analysis`
- **Owns:** AI-powered qualitative analysis using Claude Sonnet
- **Does:** Sends top 75 posts with full text + metrics + statistical regression output to Claude. Asks for regression insights, content archetypes, and playbook.
- **Output:** Three sections — regression_insights (hook types, emotional triggers, specificity, language patterns), custom archetypes (3-5 data-driven archetypes), playbook (weekly schedule, checklist, rules, generation_guidelines including hooks_that_work and vocabulary)
- **Tables written:** `content_strategies` (strategy_type='regression_insights'), `content_strategies` (strategy_type='playbook')
- **Does NOT:** Generate content or plans. Only analyzes.

#### `discover-archetypes`
- **Owns:** Discovering 3-5 content archetypes from post data
- **Tables written:** `content_strategies` (strategy_type='archetype_discovery')

#### `weekly-assessment`
- **Owns:** Weekly performance reports comparing this week vs last
- **Tables written:** `weekly_reports`, `content_strategies`

### Stage 3: Context Assembly

#### `_shared/getUserContext.ts`
- **Owns:** Assembling the complete user context string for ALL AI-calling functions
- **Does:** 32 parallel DB queries, assembles ~30 sections into a single string
- **Key sections:** Identity, profile, story vault (shuffled), guardrails, playbook guidelines, regression data, top posts (full text for top 5, 500-char for 6-10), archetype performance stats, regression findings, content plan, sales funnel, knowledge base, competitor patterns, content buckets/pillars, recent hooks (for dedup)
- **Does NOT:** Write to any DB table. Read-only.
- **Used by:** generate-plans, generate-content, generate-draft-posts, generate-week-posts, chat-with-threadable, fix-post, generate-strategy, generate-playbook, generate-content-buckets, generate-content-pillars, generate-templates, weekly-assessment

#### `_shared/contentRules.ts`
- **Owns:** Single source of truth for content quality rules (prompt injection)
- **Used by:** generate-content, generate-draft-posts, chat-with-threadable, fix-post, generate-templates, generate-week-posts

#### `_shared/journeyStage.ts`
- **Owns:** Journey stage definitions and funnel mix percentages
- **Stages:** getting_started (70/20/10 TOF/MOF/BOF), growing (30/50/20), monetizing (20/30/50)
- **Used by:** getUserContext, generate-strategy, generate-playbook, generate-plans

#### `_shared/safeParseJSON.ts`
- **Owns:** Robust JSON parsing for Claude's output (handles markdown blocks, unquoted keys, truncation)

### Stage 4: Plan Generation

#### `generate-plans`
- **Owns:** Creating 7-day content plans with per-post hook ideas, archetypes, funnel stages, timing
- **Plan types:** content_plan, branding_plan, funnel_strategy
- **Key features:**
  - Story rotation block: Analyzes last 50 posts for theme frequency, classifies vault themes as banned (10+ uses), overused (2-9 uses), or fresh (0 uses)
  - Vault dedup: Cross-references generated hooks against vault themes using SEMANTIC_EXPANSIONS to flag duplicates within the week
  - Hook competition: Each post slot gets a unique hook idea that competes for attention
  - Archetype distribution: Weighted by actual performance data (best archetype gets ~40%, worst gets least)
  - Time slots: Derived from regression best_posting_hour data
  - Background mode: Supports `background: true` param for async generation via EdgeRuntime.waitUntil()
- **Tables read:** profiles, content_strategies (regression), posts_analyzed (archetype perf + recent posts), user_story_vault, user_plans (sibling plans)
- **Tables written:** `user_plans` (upsert by plan_type), `content_plan_items`, `profiles` (plan_generation_status)
- **Does NOT:** Generate actual post text. Only creates the plan structure with hook ideas.

### Stage 5: Content Generation

#### `generate-draft-posts`
- **Owns:** Generating individual post drafts from content plan items
- **Key features:**
  - Emotional trigger system: EMOTIONAL_TRIGGER_MAP with 15 triggers (5 TOF, 5 MOF, 5 BOF) with per-trigger writing instructions
  - Structure skeletons: MICRO (<80 chars), SHORT (80-250 chars), STANDARD (250-500 chars)
  - Quality gate: scoreDraft() using Claude Haiku with 5-criterion rubric (hook_strength, emotional_delivery, one_thing_rule, specificity, close_strength). Retries once if score < 7/10.
  - Character ceiling: 500 char hard limit with smart truncation
  - ONE THING RULE: Each post must communicate exactly one idea
- **Model:** Claude Opus 4.6 for generation, Claude Haiku 4.5 for scoring
- **Tables written:** `scheduled_posts` (status='draft')
- **Does NOT:** Handle batch generation, deduplication across posts, or hook assignment. That's generate-content's job.

#### `generate-content`
- **Owns:** Batch generation of 21+ posts with dedup, scoring, and retry
- **Key features:**
  - Hook assignment: `buildHookAssignments()` with 12 hook styles, weighted 3x for hooks matching playbook's hooks_that_work
  - Dedup pass: Second AI call to find and rewrite duplicate/similar posts
  - Score-and-retry: Each post scored via `score-post` function, retried up to 2x if score < 4/6
  - Vault context: Stories, numbers, offers, audience, sales funnel injected with attribution rules
  - Playbook integration: Weekly schedule, templates, rules, checklist, generation guidelines all injected into prompt
- **Model:** Claude Opus 4.6
- **Tables written:** `scheduled_posts`
- **Calls:** `score-post` edge function for each generated post

#### `generate-week-posts`
- **Owns:** Generating posts from content_plan_items and linking them back
- **Tables written:** `scheduled_posts`, `content_plan_items` (updates post_id, status='drafted')

#### `fix-post`
- **Owns:** Rewriting a scheduled post based on user feedback
- **Calls:** score-post for the rewritten post
- **Tables written:** `scheduled_posts` (update text_content, score)

#### `score-post`
- **Owns:** Scoring a post against 7 criteria using regression data + user context
- **Criteria:** hook, credibility, suppressors, voice, niche, goal, length
- **Tables written:** None (read-only scoring)

### Stage 6: Publishing

#### `publish-post`
- **Owns:** Publishing scheduled posts to Threads API
- **Does:** Creates thread container, publishes, updates status, schedules async metric refresh via fetch-user-posts
- **Tables written:** `scheduled_posts` (status='published', threads_media_id, published_at)

### Orchestrators

#### `run-weekly-cmo-loop`
- **Owns:** Weekly strategy refresh pipeline
- **Calls (sequentially):** run-analysis → run-regression → discover-archetypes → generate-plans (3x: branding, funnel, content) → generate-cmo-summary
- **Uses EdgeRuntime.waitUntil()** for background execution
- **Tables written:** `profiles` (last_weekly_refresh_at)

#### `weekly-optimization`
- **Owns:** Automated weekly optimization with conditional cascade
- **Logic:** Compares new vs old regression. If 2+ significant pattern shifts → full cascade. If 1 shift → content_plan only. If 0 → skip.
- **Calls:** fetch-user-posts → run-regression → (conditionally) discover-archetypes → generate-content-buckets → generate-content-pillars → generate-plans (3x)
- **Also does:** Backfills missing post_results with estimated medians

### Identity & Setup

#### `extract-identity`
- **Owns:** Extracting professional identity from posts
- **Tables written:** `user_identity`, `user_audiences`, `user_personal_info`, `user_offers`, `user_story_vault`

#### `extract-vault-entries`
- **Owns:** Mining stories, numbers, knowledge base entries from post history
- **Tables written:** `user_story_vault`, `knowledge_base`, `content_strategies` (untapped_angles)

#### `analyze-voice`
- **Owns:** Extracting voice profile from posts + voice samples
- **Tables written:** `profiles` (voice_profile), `user_writing_style`

#### `generate-playbook`
- **Owns:** Creating content playbook with weekly schedule, checklist, templates, rules, guidelines
- **Tables written:** `content_strategies` (strategy_type='playbook')

### Content Strategy

#### `generate-content-buckets`
- **Owns:** Identifying 2-3 audience segments
- **Tables written:** `content_buckets`

#### `generate-content-pillars`
- **Owns:** Creating 3-5 content pillars with topics, mapped to buckets
- **Tables written:** `content_pillars`, `connected_topics`

#### `generate-strategy`
- **Owns:** Weekly content strategy with pillars, schedule, ratios, hooks
- **Tables written:** `content_strategies` (strategy_json)

#### `generate-templates`
- **Owns:** Fill-in-the-blank templates per archetype
- **Tables written:** `content_templates`

### Other

#### `chat-with-threadable` — AI chatbot (CMO advisor + content writer mode)
#### `generate-cmo-summary` — Executive summary comparing strategy snapshots
#### `process-knowledge` — Processes URLs/documents into knowledge base
#### `create-checkout` / `manage-subscription` / `stripe-webhook` — Stripe billing
#### `threads-auth-url` / `threads-oauth-callback` — Threads OAuth flow
#### `refresh-tokens` — Refreshes expiring Threads tokens (batch)
#### `discover-niche-accounts` — Recommends competitor accounts to study

---

## Key Database Tables

| Table | Owner (writes) | Purpose |
|---|---|---|
| `profiles` | Multiple | User profile, Threads credentials, settings, voice_profile |
| `posts_analyzed` | fetch-user-posts, fetch-competitor-posts | All synced posts with metrics + text features |
| `content_strategies` | run-regression, run-analysis, discover-archetypes, generate-playbook, generate-strategy, extract-vault-entries | Strategy data by strategy_type |
| `user_plans` | generate-plans | Content/branding/funnel plans |
| `content_plan_items` | generate-plans | Individual plan slots with archetype/funnel/topic |
| `scheduled_posts` | generate-content, generate-draft-posts, generate-week-posts, fix-post, publish-post | Post drafts and published posts |
| `user_story_vault` | extract-identity, extract-vault-entries | Stories, numbers (by section) |
| `user_identity` | extract-identity | about_you, desired_perception, main_goal |
| `knowledge_base` | extract-vault-entries, process-knowledge | Processed content (URLs, docs) |
| `follower_snapshots` | fetch-user-posts, refresh-profile, snapshot-followers | Follower count history |
| `content_buckets` | generate-content-buckets | Audience segments |
| `content_pillars` | generate-content-pillars | Topic pillars mapped to buckets |
| `connected_topics` | generate-content-pillars | Topics within pillars |
| `content_templates` | generate-templates | Fill-in templates per archetype |
| `post_results` | weekly-optimization (backfill) | Link clicks, comments, DMs |
| `weekly_reports` | weekly-assessment | Weekly performance reports |
| `subscriptions` | stripe-webhook | Stripe subscription state |
| `user_content_guardrails` | Frontend | Never-say, never-reference, voice corrections |

### content_strategies strategy_type values

| strategy_type | Written by | Contains |
|---|---|---|
| `regression` | run-regression | Correlations, boolean lifts, optimal word count, best times |
| `regression_insights` | run-analysis | AI qualitative insights (hook types, emotional triggers, patterns) |
| `playbook` | run-analysis, generate-playbook | Weekly schedule, checklist, rules, generation_guidelines, templates |
| `archetype_discovery` | discover-archetypes | 3-5 discovered archetypes with percentages |
| `weekly` | generate-strategy | Strategy JSON with pillars, schedule, ratios |
| `untapped_angles` | extract-vault-entries | Content angles not yet explored |
| `niche_discovery` | discover-niche-accounts | Recommended competitor accounts |

---

## Frontend → Edge Function Map

| Page | Functions Called | Purpose |
|---|---|---|
| **Onboarding** | fetch-user-posts → run-analysis → run-regression → discover-archetypes → categorize-posts → discover-niche-accounts → fetch-competitor-posts → extract-identity → extract-vault-entries → analyze-voice → generate-playbook → generate-content-buckets → generate-content-pillars → generate-plans (3x) → generate-templates | Full pipeline setup |
| **Playbook** | discover-archetypes, generate-content-buckets, generate-content-pillars, generate-plans (3x), run-analysis, run-weekly-cmo-loop, generate-content | Strategy regeneration + content creation |
| **Insights** | fetch-user-posts (auto-sync, 30min cooldown), run-analysis | Data sync + analysis |
| **Queue** | publish-post, generate-content (single regen), score-post, fix-post | Content management |
| **Dashboard** | refresh-profile, fetch-user-posts, run-analysis | Home command center |
| **Analyze** | discover-niche-accounts, fetch-competitor-posts | Competitor research |
| **Chat** | chat-with-threadable | AI advisor |

---

## Integration Points (Where Data Crosses Function Boundaries)

### 1. Regression → Content Generation
- `run-regression` writes statistical insights to `content_strategies` (strategy_type='regression')
- `getUserContext()` reads this and formats as RAW REGRESSION DATA section
- `generate-plans` also directly queries this for best posting times and regression length block
- `generate-content` reads strategy_json + regression_insights from `content_strategies`

### 2. Analysis → Playbook → Content Generation
- `run-analysis` produces `regression_insights` (qualitative) AND `playbook` (generation_guidelines)
- `getUserContext()` reads both: formats regression_insights as REGRESSION FINDINGS section, formats playbook as PLAYBOOK GENERATION GUIDELINES
- `generate-content` reads playbook for weekly schedule, templates, rules, checklist, and hooks_that_work
- `generate-content` uses hooks_that_work to weight hook assignments (3x weight for proven hooks)

### 3. Archetype System (Two Parallel Systems)
- **System archetypes** (truth, vault_drop, hot_take, window): Assigned by `fetch-user-posts` via `computeTextFeatures()`. Used for archetype performance stats in `getUserContext()`.
- **Analysis archetypes** (custom names): Created by `run-analysis` and `discover-archetypes`. Used in playbook weekly schedule and content generation.
- `getUserContext()` computes per-archetype stats from system archetypes and surfaces as ARCHETYPE PERFORMANCE section
- `generate-plans` uses system archetype stats for distribution weighting (best gets ~40%)

### 4. Story Vault → Content Generation
- `extract-identity` and `extract-vault-entries` populate `user_story_vault`
- `getUserContext()` reads and shuffles vault entries (150-char story snippets + 80-char lessons)
- `generate-plans` reads vault for story rotation (banned/overused/fresh theme classification) and story-day hints
- `generate-content` reads vault for attribution rules (role-aware story references)
- `generate-draft-posts` receives hook ideas from the plan but generates fresh text using vault context

### 5. Plan → Draft Pipeline
- `generate-plans` creates `content_plan_items` with archetype, funnel_stage, hook_idea, emotional_trigger, topic
- `generate-draft-posts` consumes these items and generates actual post text
- `generate-content` is an alternative batch path that generates 21+ posts directly (not from plan items)
- Both paths write to `scheduled_posts`

### 6. Scoring Loop
- `score-post` reads regression data + user context to score against 7 criteria
- `generate-content` calls `score-post` for each generated post, retries if score < 4/6
- `generate-draft-posts` has its own inline scoring via `scoreDraft()` using Haiku (different rubric: 5 criteria, score 0-10)
- `fix-post` calls `score-post` after rewriting

---

## Common Pitfalls

1. **getUserContext is shared** — Changes to its output format affect ALL AI-calling functions. Test broadly.
2. **Two archetype systems exist** — System archetypes (truth/vault_drop/hot_take/window) are for analytics. Analysis archetypes (custom names) are for content strategy. Don't conflate them.
3. **generate-content vs generate-draft-posts** — generate-content is batch (21+ posts with dedup). generate-draft-posts is per-plan-item (individual posts with emotional triggers). Both write to scheduled_posts but serve different flows.
4. **Background mode in generate-plans** — When `background: true` is passed, the function returns immediately and uses EdgeRuntime.waitUntil(). Frontend polls `profiles.plan_generation_status` for completion.
5. **Story rotation depends on vault themes** — The storyRotationBlock in generate-plans dynamically analyzes theme frequency in the user's last 50 posts. No hardcoded themes.
6. **Token budget in getUserContext** — The context string can get large. The debug audit at the end logs per-section sizes. Full post text (Fix 1) is the biggest addition — top 5 get full text, 6-10 get 500-char truncation.
7. **Hooks are weighted, not random** — buildHookAssignments() in generate-content weights proven hooks (from playbook's hooks_that_work) at 3x. Don't revert to random shuffle.
8. **contentRules.ts is the single source of truth** for content quality rules. Don't duplicate these rules in individual function prompts.
