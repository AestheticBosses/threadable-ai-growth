export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          pinned: boolean
          pinned_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pinned?: boolean
          pinned_at?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pinned?: boolean
          pinned_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      competitor_accounts: {
        Row: {
          added_at: string | null
          follower_count: number | null
          id: string
          niche_relevance_score: number | null
          threads_user_id: string | null
          threads_username: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          follower_count?: number | null
          id?: string
          niche_relevance_score?: number | null
          threads_user_id?: string | null
          threads_username?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          follower_count?: number | null
          id?: string
          niche_relevance_score?: number | null
          threads_user_id?: string | null
          threads_username?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_topics: {
        Row: {
          created_at: string | null
          hook_angle: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          pillar_id: string | null
          used_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hook_angle?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          pillar_id?: string | null
          used_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          hook_angle?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          pillar_id?: string | null
          used_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_topics_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      content_buckets: {
        Row: {
          audience_persona: string | null
          business_connection: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audience_persona?: string | null
          business_connection?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audience_persona?: string | null
          business_connection?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          percentage: number | null
          purpose: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          percentage?: number | null
          purpose?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          percentage?: number | null
          purpose?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_pillars_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "content_buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      content_plan_items: {
        Row: {
          archetype: string | null
          created_at: string | null
          funnel_stage: string | null
          id: string
          is_test_slot: boolean | null
          pillar_id: string | null
          plan_day: number
          plan_week: number
          post_id: string | null
          scheduled_date: string | null
          status: string | null
          topic_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archetype?: string | null
          created_at?: string | null
          funnel_stage?: string | null
          id?: string
          is_test_slot?: boolean | null
          pillar_id?: string | null
          plan_day: number
          plan_week: number
          post_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          topic_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archetype?: string | null
          created_at?: string | null
          funnel_stage?: string | null
          id?: string
          is_test_slot?: boolean | null
          pillar_id?: string | null
          plan_day?: number
          plan_week?: number
          post_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          topic_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plan_items_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_plan_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "connected_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_preferences: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_strategies: {
        Row: {
          created_at: string
          id: string
          journey_stage: string | null
          performance_vs_previous: Json | null
          regression_insights: Json | null
          status: string | null
          strategy_data: Json | null
          strategy_json: Json | null
          strategy_type: string | null
          user_id: string
          week_number: number | null
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          journey_stage?: string | null
          performance_vs_previous?: Json | null
          regression_insights?: Json | null
          status?: string | null
          strategy_data?: Json | null
          strategy_json?: Json | null
          strategy_type?: string | null
          user_id: string
          week_number?: number | null
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          journey_stage?: string | null
          performance_vs_previous?: Json | null
          regression_insights?: Json | null
          status?: string | null
          strategy_data?: Json | null
          strategy_json?: Json | null
          strategy_type?: string | null
          user_id?: string
          week_number?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_strategies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          archetype: string
          created_at: string | null
          example_text: string | null
          id: string
          is_default: boolean | null
          sort_order: number | null
          template_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archetype: string
          created_at?: string | null
          example_text?: string | null
          id?: string
          is_default?: boolean | null
          sort_order?: number | null
          template_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archetype?: string
          created_at?: string | null
          example_text?: string | null
          id?: string
          is_default?: boolean | null
          sort_order?: number | null
          template_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follower_snapshots: {
        Row: {
          follower_count: number
          id: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          follower_count?: number
          id?: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          follower_count?: number
          id?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          content: string | null
          created_at: string
          file_path: string | null
          id: string
          processed: boolean
          processing_error: string | null
          raw_content: string | null
          summary: string | null
          tags: Json
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          processed?: boolean
          processing_error?: string | null
          raw_content?: string | null
          summary?: string | null
          tags?: Json
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          processed?: boolean
          processing_error?: string | null
          raw_content?: string | null
          summary?: string | null
          tags?: Json
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_results: {
        Row: {
          comments_received: number | null
          dm_replies: number | null
          id: string
          is_estimated: boolean
          link_clicks: number | null
          logged_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          comments_received?: number | null
          dm_replies?: number | null
          id?: string
          is_estimated?: boolean
          link_clicks?: number | null
          logged_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          comments_received?: number | null
          dm_replies?: number | null
          id?: string
          is_estimated?: boolean
          link_clicks?: number | null
          logged_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_results_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts_analyzed: {
        Row: {
          archetype: string | null
          char_count: number | null
          clicks: number | null
          content_category: string | null
          day_of_week: string | null
          emotion_count: number | null
          engagement_rate: number | null
          fetched_at: string | null
          follow_rate: number | null
          follows: number | null
          has_controversy: boolean | null
          has_credibility_marker: boolean | null
          has_dollar_amount: boolean | null
          has_emoji: boolean | null
          has_hashtag: boolean | null
          has_namedrop: boolean | null
          has_profanity: boolean | null
          has_question: boolean | null
          has_relatability: boolean | null
          has_steps: boolean | null
          has_url: boolean | null
          has_visual: boolean | null
          has_vulnerability: boolean | null
          hour_posted: number | null
          id: string
          is_short_form: boolean | null
          likes: number | null
          line_count: number | null
          media_type: string | null
          posted_at: string | null
          quotes: number | null
          replies: number | null
          reposts: number | null
          sentiment_score: number | null
          shares: number | null
          source: string | null
          source_username: string | null
          starts_with_number: boolean | null
          text_content: string | null
          threads_media_id: string | null
          user_id: string
          views: number | null
          virality_score: number | null
          word_count: number | null
        }
        Insert: {
          archetype?: string | null
          char_count?: number | null
          clicks?: number | null
          content_category?: string | null
          day_of_week?: string | null
          emotion_count?: number | null
          engagement_rate?: number | null
          fetched_at?: string | null
          follow_rate?: number | null
          follows?: number | null
          has_controversy?: boolean | null
          has_credibility_marker?: boolean | null
          has_dollar_amount?: boolean | null
          has_emoji?: boolean | null
          has_hashtag?: boolean | null
          has_namedrop?: boolean | null
          has_profanity?: boolean | null
          has_question?: boolean | null
          has_relatability?: boolean | null
          has_steps?: boolean | null
          has_url?: boolean | null
          has_visual?: boolean | null
          has_vulnerability?: boolean | null
          hour_posted?: number | null
          id?: string
          is_short_form?: boolean | null
          likes?: number | null
          line_count?: number | null
          media_type?: string | null
          posted_at?: string | null
          quotes?: number | null
          replies?: number | null
          reposts?: number | null
          sentiment_score?: number | null
          shares?: number | null
          source?: string | null
          source_username?: string | null
          starts_with_number?: boolean | null
          text_content?: string | null
          threads_media_id?: string | null
          user_id: string
          views?: number | null
          virality_score?: number | null
          word_count?: number | null
        }
        Update: {
          archetype?: string | null
          char_count?: number | null
          clicks?: number | null
          content_category?: string | null
          day_of_week?: string | null
          emotion_count?: number | null
          engagement_rate?: number | null
          fetched_at?: string | null
          follow_rate?: number | null
          follows?: number | null
          has_controversy?: boolean | null
          has_credibility_marker?: boolean | null
          has_dollar_amount?: boolean | null
          has_emoji?: boolean | null
          has_hashtag?: boolean | null
          has_namedrop?: boolean | null
          has_profanity?: boolean | null
          has_question?: boolean | null
          has_relatability?: boolean | null
          has_steps?: boolean | null
          has_url?: boolean | null
          has_visual?: boolean | null
          has_vulnerability?: boolean | null
          hour_posted?: number | null
          id?: string
          is_short_form?: boolean | null
          likes?: number | null
          line_count?: number | null
          media_type?: string | null
          posted_at?: string | null
          quotes?: number | null
          replies?: number | null
          reposts?: number | null
          sentiment_score?: number | null
          shares?: number | null
          source?: string | null
          source_username?: string | null
          starts_with_number?: boolean | null
          text_content?: string | null
          threads_media_id?: string | null
          user_id?: string
          views?: number | null
          virality_score?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_analyzed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_approve_ai_posts: boolean
          biggest_challenge: string | null
          business_model: string | null
          created_at: string
          display_name: string | null
          dm_keyword: string | null
          dm_offer: string | null
          dream_client: string | null
          email: string | null
          end_goal: string | null
          follower_count: number | null
          full_name: string | null
          funnel_bof_pct: number | null
          funnel_goal: string | null
          funnel_mof_pct: number | null
          funnel_tof_pct: number | null
          generate_weekend_posts: boolean
          goal_type: string | null
          id: string
          include_credibility_markers: boolean
          is_established: boolean | null
          journey_stage: string | null
          last_fetched_at: string | null
          last_weekly_refresh_at: string | null
          max_posts_per_day: number
          mission: string | null
          niche: string | null
          onboarding_complete: boolean | null
          posting_cadence: string | null
          revenue_target: string | null
          success_metric: string | null
          threads_access_token: string | null
          threads_profile_picture_url: string | null
          threads_token_expires_at: string | null
          threads_user_id: string | null
          threads_username: string | null
          traffic_url: string | null
          updated_at: string
          voice_profile: Json | null
          weekly_refresh_summary: Json | null
        }
        Insert: {
          auto_approve_ai_posts?: boolean
          biggest_challenge?: string | null
          business_model?: string | null
          created_at?: string
          display_name?: string | null
          dm_keyword?: string | null
          dm_offer?: string | null
          dream_client?: string | null
          email?: string | null
          end_goal?: string | null
          follower_count?: number | null
          full_name?: string | null
          funnel_bof_pct?: number | null
          funnel_goal?: string | null
          funnel_mof_pct?: number | null
          funnel_tof_pct?: number | null
          generate_weekend_posts?: boolean
          goal_type?: string | null
          id: string
          include_credibility_markers?: boolean
          is_established?: boolean | null
          journey_stage?: string | null
          last_fetched_at?: string | null
          last_weekly_refresh_at?: string | null
          max_posts_per_day?: number
          mission?: string | null
          niche?: string | null
          onboarding_complete?: boolean | null
          posting_cadence?: string | null
          revenue_target?: string | null
          success_metric?: string | null
          threads_access_token?: string | null
          threads_profile_picture_url?: string | null
          threads_token_expires_at?: string | null
          threads_user_id?: string | null
          threads_username?: string | null
          traffic_url?: string | null
          updated_at?: string
          voice_profile?: Json | null
          weekly_refresh_summary?: Json | null
        }
        Update: {
          auto_approve_ai_posts?: boolean
          biggest_challenge?: string | null
          business_model?: string | null
          created_at?: string
          display_name?: string | null
          dm_keyword?: string | null
          dm_offer?: string | null
          dream_client?: string | null
          email?: string | null
          end_goal?: string | null
          follower_count?: number | null
          full_name?: string | null
          funnel_bof_pct?: number | null
          funnel_goal?: string | null
          funnel_mof_pct?: number | null
          funnel_tof_pct?: number | null
          generate_weekend_posts?: boolean
          goal_type?: string | null
          id?: string
          include_credibility_markers?: boolean
          is_established?: boolean | null
          journey_stage?: string | null
          last_fetched_at?: string | null
          last_weekly_refresh_at?: string | null
          max_posts_per_day?: number
          mission?: string | null
          niche?: string | null
          onboarding_complete?: boolean | null
          posting_cadence?: string | null
          revenue_target?: string | null
          success_metric?: string | null
          threads_access_token?: string | null
          threads_profile_picture_url?: string | null
          threads_token_expires_at?: string | null
          threads_user_id?: string | null
          threads_username?: string | null
          traffic_url?: string | null
          updated_at?: string
          voice_profile?: Json | null
          weekly_refresh_summary?: Json | null
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          ai_generated: boolean | null
          content_category: string | null
          created_at: string
          error_message: string | null
          funnel_stage: string | null
          id: string
          media_type: string | null
          media_url: string | null
          pre_post_score: number | null
          published_at: string | null
          scheduled_for: string | null
          score_breakdown: Json | null
          source: string | null
          status: string | null
          strategy_id: string | null
          text_content: string | null
          threads_media_id: string | null
          user_edited: boolean | null
          user_id: string
        }
        Insert: {
          ai_generated?: boolean | null
          content_category?: string | null
          created_at?: string
          error_message?: string | null
          funnel_stage?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          pre_post_score?: number | null
          published_at?: string | null
          scheduled_for?: string | null
          score_breakdown?: Json | null
          source?: string | null
          status?: string | null
          strategy_id?: string | null
          text_content?: string | null
          threads_media_id?: string | null
          user_edited?: boolean | null
          user_id: string
        }
        Update: {
          ai_generated?: boolean | null
          content_category?: string | null
          created_at?: string
          error_message?: string | null
          funnel_stage?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          pre_post_score?: number | null
          published_at?: string | null
          scheduled_for?: string | null
          score_breakdown?: Json | null
          source?: string | null
          status?: string | null
          strategy_id?: string | null
          text_content?: string | null
          threads_media_id?: string | null
          user_edited?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "content_strategies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ai_posts_limit: number | null
          ai_posts_used: number | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_posts_limit?: number | null
          ai_posts_used?: number | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_posts_limit?: number | null
          ai_posts_used?: number | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_audiences: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_identity: {
        Row: {
          about_you: string | null
          created_at: string
          desired_perception: string | null
          id: string
          main_goal: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          about_you?: string | null
          created_at?: string
          desired_perception?: string | null
          id?: string
          main_goal?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          about_you?: string | null
          created_at?: string
          desired_perception?: string | null
          id?: string
          main_goal?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_offers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personal_info: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string
          id: string
          plan_data: Json
          plan_type: string
          profile_snapshot: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_data?: Json
          plan_type: string
          profile_snapshot?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_data?: Json
          plan_type?: string
          profile_snapshot?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sales_funnel: {
        Row: {
          created_at: string | null
          goal: string | null
          id: string
          price: string | null
          step_name: string
          step_number: number
          updated_at: string | null
          url: string | null
          user_id: string
          what: string
        }
        Insert: {
          created_at?: string | null
          goal?: string | null
          id?: string
          price?: string | null
          step_name: string
          step_number: number
          updated_at?: string | null
          url?: string | null
          user_id: string
          what?: string
        }
        Update: {
          created_at?: string | null
          goal?: string | null
          id?: string
          price?: string | null
          step_name?: string
          step_number?: number
          updated_at?: string | null
          url?: string | null
          user_id?: string
          what?: string
        }
        Relationships: []
      }
      user_story_vault: {
        Row: {
          created_at: string
          data: Json
          id: string
          section: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          section: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          section?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_story_vault_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_writing_style: {
        Row: {
          created_at: string
          custom_style_description: string | null
          id: string
          selected_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_style_description?: string | null
          id?: string
          selected_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_style_description?: string | null
          id?: string
          selected_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_samples: {
        Row: {
          created_at: string
          id: string
          sample_text: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sample_text?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sample_text?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_samples_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          avg_engagement_rate: number | null
          created_at: string
          follower_count_end: number | null
          follower_count_start: number | null
          follower_growth: number | null
          id: string
          insights: Json | null
          strategy_adjustments: Json | null
          top_post_id: string | null
          total_engagement: number | null
          total_posts: number | null
          total_views: number | null
          user_id: string
          week_end: string | null
          week_start: string | null
          worst_post_id: string | null
        }
        Insert: {
          avg_engagement_rate?: number | null
          created_at?: string
          follower_count_end?: number | null
          follower_count_start?: number | null
          follower_growth?: number | null
          id?: string
          insights?: Json | null
          strategy_adjustments?: Json | null
          top_post_id?: string | null
          total_engagement?: number | null
          total_posts?: number | null
          total_views?: number | null
          user_id: string
          week_end?: string | null
          week_start?: string | null
          worst_post_id?: string | null
        }
        Update: {
          avg_engagement_rate?: number | null
          created_at?: string
          follower_count_end?: number | null
          follower_count_start?: number | null
          follower_growth?: number | null
          id?: string
          insights?: Json | null
          strategy_adjustments?: Json | null
          top_post_id?: string | null
          total_engagement?: number | null
          total_posts?: number | null
          total_views?: number | null
          user_id?: string
          week_end?: string | null
          week_start?: string | null
          worst_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_top_post_id_fkey"
            columns: ["top_post_id"]
            isOneToOne: false
            referencedRelation: "posts_analyzed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_worst_post_id_fkey"
            columns: ["worst_post_id"]
            isOneToOne: false
            referencedRelation: "posts_analyzed"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          archetype_performance: Json | null
          created_at: string | null
          id: string
          pillar_performance: Json | null
          recommendations: Json | null
          review_date: string | null
          top_combos: Json | null
          topic_performance: Json | null
          user_id: string
          week_number: number
        }
        Insert: {
          archetype_performance?: Json | null
          created_at?: string | null
          id?: string
          pillar_performance?: Json | null
          recommendations?: Json | null
          review_date?: string | null
          top_combos?: Json | null
          topic_performance?: Json | null
          user_id: string
          week_number: number
        }
        Update: {
          archetype_performance?: Json | null
          created_at?: string | null
          id?: string
          pillar_performance?: Json | null
          recommendations?: Json | null
          review_date?: string | null
          top_combos?: Json | null
          topic_performance?: Json | null
          user_id?: string
          week_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cron_generate_week_posts: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
