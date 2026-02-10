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
      content_strategies: {
        Row: {
          created_at: string
          id: string
          performance_vs_previous: Json | null
          regression_insights: Json | null
          status: string | null
          strategy_json: Json | null
          user_id: string
          week_number: number | null
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          performance_vs_previous?: Json | null
          regression_insights?: Json | null
          status?: string | null
          strategy_json?: Json | null
          user_id: string
          week_number?: number | null
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          performance_vs_previous?: Json | null
          regression_insights?: Json | null
          status?: string | null
          strategy_json?: Json | null
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
          created_at: string
          dream_client: string | null
          email: string | null
          end_goal: string | null
          full_name: string | null
          generate_weekend_posts: boolean
          id: string
          include_credibility_markers: boolean
          is_established: boolean | null
          max_posts_per_day: number
          niche: string | null
          onboarding_complete: boolean | null
          threads_access_token: string | null
          threads_profile_picture_url: string | null
          threads_token_expires_at: string | null
          threads_user_id: string | null
          threads_username: string | null
          updated_at: string
          voice_profile: Json | null
        }
        Insert: {
          auto_approve_ai_posts?: boolean
          created_at?: string
          dream_client?: string | null
          email?: string | null
          end_goal?: string | null
          full_name?: string | null
          generate_weekend_posts?: boolean
          id: string
          include_credibility_markers?: boolean
          is_established?: boolean | null
          max_posts_per_day?: number
          niche?: string | null
          onboarding_complete?: boolean | null
          threads_access_token?: string | null
          threads_profile_picture_url?: string | null
          threads_token_expires_at?: string | null
          threads_user_id?: string | null
          threads_username?: string | null
          updated_at?: string
          voice_profile?: Json | null
        }
        Update: {
          auto_approve_ai_posts?: boolean
          created_at?: string
          dream_client?: string | null
          email?: string | null
          end_goal?: string | null
          full_name?: string | null
          generate_weekend_posts?: boolean
          id?: string
          include_credibility_markers?: boolean
          is_established?: boolean | null
          max_posts_per_day?: number
          niche?: string | null
          onboarding_complete?: boolean | null
          threads_access_token?: string | null
          threads_profile_picture_url?: string | null
          threads_token_expires_at?: string | null
          threads_user_id?: string | null
          threads_username?: string | null
          updated_at?: string
          voice_profile?: Json | null
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          ai_generated: boolean | null
          content_category: string | null
          created_at: string
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          pre_post_score: number | null
          published_at: string | null
          scheduled_for: string | null
          score_breakdown: Json | null
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
          id?: string
          media_type?: string | null
          media_url?: string | null
          pre_post_score?: number | null
          published_at?: string | null
          scheduled_for?: string | null
          score_breakdown?: Json | null
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
          id?: string
          media_type?: string | null
          media_url?: string | null
          pre_post_score?: number | null
          published_at?: string | null
          scheduled_for?: string | null
          score_breakdown?: Json | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
