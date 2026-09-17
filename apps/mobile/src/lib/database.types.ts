/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with `supabase gen types typescript --local` (needs Docker) or
 * `python3 supabase/scripts/gen-types.py <db> apps/mobile/src/lib/database.types.ts`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          id: number
          actor_id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          whiskey_id: string | null
          tasting_id: string | null
          event_id: string | null
          target_user_id: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: number
          actor_id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          whiskey_id?: string | null
          tasting_id?: string | null
          event_id?: string | null
          target_user_id?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          whiskey_id?: string | null
          tasting_id?: string | null
          event_id?: string | null
          target_user_id?: string | null
          payload?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tastings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_bottles: {
        Row: {
          id: string
          user_id: string
          whiskey_id: string
          status: Database["public"]["Enums"]["bottle_status"]
          fill_percent: number
          purchased_at: string | null
          price_paid: number | null
          currency: string | null
          store_name: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          whiskey_id: string
          status?: Database["public"]["Enums"]["bottle_status"]
          fill_percent?: number
          purchased_at?: string | null
          price_paid?: number | null
          currency?: string | null
          store_name?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          whiskey_id?: string
          status?: Database["public"]["Enums"]["bottle_status"]
          fill_percent?: number
          purchased_at?: string | null
          price_paid?: number | null
          currency?: string | null
          store_name?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_bottles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_bottles_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          id: number
          user_id: string
          winner_whiskey_id: string
          loser_whiskey_id: string
          event_id: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          winner_whiskey_id: string
          loser_whiskey_id: string
          event_id?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          winner_whiskey_id?: string
          loser_whiskey_id?: string
          event_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_loser_whiskey_id_fkey"
            columns: ["loser_whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_winner_whiskey_id_fkey"
            columns: ["winner_whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      distilleries: {
        Row: {
          id: string
          name: string
          country: string
          region: string | null
          city: string | null
          founded_year: number | null
          website: string | null
          description: string | null
          status: Database["public"]["Enums"]["catalog_status"]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          country: string
          region?: string | null
          city?: string | null
          founded_year?: number | null
          website?: string | null
          description?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          country?: string
          region?: string | null
          city?: string | null
          founded_year?: number | null
          website?: string | null
          description?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distilleries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          event_id: string
          user_id: string
          role: Database["public"]["Enums"]["event_role"]
          joined_at: string
        }
        Insert: {
          event_id: string
          user_id: string
          role?: Database["public"]["Enums"]["event_role"]
          joined_at?: string
        }
        Update: {
          event_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["event_role"]
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_pours: {
        Row: {
          id: string
          event_id: string
          whiskey_id: string
          label: string | null
          flight: string | null
          table_location: string | null
          sort_order: number
          notes: string | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          whiskey_id: string
          label?: string | null
          flight?: string | null
          table_location?: string | null
          sort_order?: number
          notes?: string | null
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          whiskey_id?: string
          label?: string | null
          flight?: string | null
          table_location?: string | null
          sort_order?: number
          notes?: string | null
          added_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_pours_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_pours_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_pours_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          id: string
          name: string
          description: string | null
          venue_name: string | null
          address: string | null
          starts_at: string
          ends_at: string | null
          timezone: string
          visibility: Database["public"]["Enums"]["event_visibility"]
          status: Database["public"]["Enums"]["event_status"]
          join_code: string
          cover_image_url: string | null
          is_blind: boolean
          lineup_version: number
          member_count: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          venue_name?: string | null
          address?: string | null
          starts_at: string
          ends_at?: string | null
          timezone?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
          status?: Database["public"]["Enums"]["event_status"]
          join_code: string
          cover_image_url?: string | null
          is_blind?: boolean
          lineup_version?: number
          member_count?: number
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          venue_name?: string | null
          address?: string | null
          starts_at?: string
          ends_at?: string | null
          timezone?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
          status?: Database["public"]["Enums"]["event_status"]
          join_code?: string
          cover_image_url?: string | null
          is_blind?: boolean
          lineup_version?: number
          member_count?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flavor_tags: {
        Row: {
          slug: string
          label: string
          group_slug: string
          group_label: string
          sort: number
        }
        Insert: {
          slug: string
          label: string
          group_slug: string
          group_label: string
          sort?: number
        }
        Update: {
          slug?: string
          label?: string
          group_slug?: string
          group_label?: string
          sort?: number
        }
        Relationships: [

        ]
      }
      follows: {
        Row: {
          follower_id: string
          followee_id: string
          status: Database["public"]["Enums"]["follow_status"]
          created_at: string
        }
        Insert: {
          follower_id: string
          followee_id: string
          status?: Database["public"]["Enums"]["follow_status"]
          created_at?: string
        }
        Update: {
          follower_id?: string
          followee_id?: string
          status?: Database["public"]["Enums"]["follow_status"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: number
          user_id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          actor_id: string | null
          tasting_id: string | null
          event_id: string | null
          whiskey_id: string | null
          payload: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          actor_id?: string | null
          tasting_id?: string | null
          event_id?: string | null
          whiskey_id?: string | null
          payload?: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          actor_id?: string | null
          tasting_id?: string | null
          event_id?: string | null
          whiskey_id?: string | null
          payload?: Json
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tastings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      price_observations: {
        Row: {
          id: number
          whiskey_id: string
          user_id: string | null
          source: string
          store_name: string | null
          store_url: string | null
          price: number
          currency: string
          size_ml: number
          country: string | null
          region: string | null
          lat: number | null
          lng: number | null
          observed_at: string
          created_at: string
        }
        Insert: {
          id?: number
          whiskey_id: string
          user_id?: string | null
          source?: string
          store_name?: string | null
          store_url?: string | null
          price: number
          currency?: string
          size_ml?: number
          country?: string | null
          region?: string | null
          lat?: number | null
          lng?: number | null
          observed_at?: string
          created_at?: string
        }
        Update: {
          id?: number
          whiskey_id?: string
          user_id?: string | null
          source?: string
          store_name?: string | null
          store_url?: string | null
          price?: number
          currency?: string
          size_ml?: number
          country?: string | null
          region?: string | null
          lat?: number | null
          lng?: number | null
          observed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_observations_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string
          avatar_url: string | null
          bio: string | null
          home_country: string | null
          home_region: string | null
          visibility: Database["public"]["Enums"]["profile_visibility"]
          is_moderator: boolean
          age_verified_at: string | null
          onboarded_at: string | null
          rankings_count: number
          followers_count: number
          following_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string
          avatar_url?: string | null
          bio?: string | null
          home_country?: string | null
          home_region?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
          is_moderator?: boolean
          age_verified_at?: string | null
          onboarded_at?: string | null
          rankings_count?: number
          followers_count?: number
          following_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string
          avatar_url?: string | null
          bio?: string | null
          home_country?: string | null
          home_region?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
          is_moderator?: boolean
          age_verified_at?: string | null
          onboarded_at?: string | null
          rankings_count?: number
          followers_count?: number
          following_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          token: string
          user_id: string
          platform: string
          updated_at: string
        }
        Insert: {
          token: string
          user_id: string
          platform: string
          updated_at?: string
        }
        Update: {
          token?: string
          user_id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          user_id: string
          whiskey_id: string
          tier: Database["public"]["Enums"]["rating_tier"]
          position: number
          score: number
          first_rated_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          whiskey_id: string
          tier: Database["public"]["Enums"]["rating_tier"]
          position: number
          score?: number
          first_rated_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          whiskey_id?: string
          tier?: Database["public"]["Enums"]["rating_tier"]
          position?: number
          score?: number
          first_rated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          target_type: string
          target_id: string
          reason: string
          details: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          target_type: string
          target_id: string
          reason: string
          details?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          target_type?: string
          target_id?: string
          reason?: string
          details?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_comments: {
        Row: {
          id: string
          tasting_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          tasting_id: string
          user_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          tasting_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_comments_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tastings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_flavors: {
        Row: {
          tasting_id: string
          tag_slug: string
          intensity: number | null
        }
        Insert: {
          tasting_id: string
          tag_slug: string
          intensity?: number | null
        }
        Update: {
          tasting_id?: string
          tag_slug?: string
          intensity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasting_flavors_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "flavor_tags"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "tasting_flavors_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tastings"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_likes: {
        Row: {
          user_id: string
          tasting_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          tasting_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          tasting_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_likes_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tastings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasting_photos: {
        Row: {
          id: string
          tasting_id: string
          storage_path: string
          width: number | null
          height: number | null
          sort: number
          created_at: string
        }
        Insert: {
          id?: string
          tasting_id: string
          storage_path: string
          width?: number | null
          height?: number | null
          sort?: number
          created_at?: string
        }
        Update: {
          id?: string
          tasting_id?: string
          storage_path?: string
          width?: number | null
          height?: number | null
          sort?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasting_photos_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "tastings"
            referencedColumns: ["id"]
          },
        ]
      }
      tastings: {
        Row: {
          id: string
          user_id: string
          whiskey_id: string
          event_id: string | null
          tasted_at: string
          note: string | null
          nose: string | null
          palate: string | null
          finish: string | null
          serving: Database["public"]["Enums"]["serving_style"] | null
          setting: Database["public"]["Enums"]["tasting_setting"] | null
          location_name: string | null
          price_paid: number | null
          currency: string | null
          pour_size_ml: number | null
          bottle_batch: string | null
          bottle_number: string | null
          store_pick: string | null
          is_blind: boolean
          score_appearance: number | null
          score_nose: number | null
          score_palate: number | null
          score_finish: number | null
          score_balance: number | null
          score_total: number | null
          likes_count: number
          comments_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          whiskey_id: string
          event_id?: string | null
          tasted_at?: string
          note?: string | null
          nose?: string | null
          palate?: string | null
          finish?: string | null
          serving?: Database["public"]["Enums"]["serving_style"] | null
          setting?: Database["public"]["Enums"]["tasting_setting"] | null
          location_name?: string | null
          price_paid?: number | null
          currency?: string | null
          pour_size_ml?: number | null
          bottle_batch?: string | null
          bottle_number?: string | null
          store_pick?: string | null
          is_blind?: boolean
          score_appearance?: number | null
          score_nose?: number | null
          score_palate?: number | null
          score_finish?: number | null
          score_balance?: number | null
          likes_count?: number
          comments_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          whiskey_id?: string
          event_id?: string | null
          tasted_at?: string
          note?: string | null
          nose?: string | null
          palate?: string | null
          finish?: string | null
          serving?: Database["public"]["Enums"]["serving_style"] | null
          setting?: Database["public"]["Enums"]["tasting_setting"] | null
          location_name?: string | null
          price_paid?: number | null
          currency?: string | null
          pour_size_ml?: number | null
          bottle_batch?: string | null
          bottle_number?: string | null
          store_pick?: string | null
          is_blind?: boolean
          score_appearance?: number | null
          score_nose?: number | null
          score_palate?: number | null
          score_finish?: number | null
          score_balance?: number | null
          likes_count?: number
          comments_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tastings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tastings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tastings_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      whiskey_aliases: {
        Row: {
          whiskey_id: string
          alias: string
          normalized: string | null
        }
        Insert: {
          whiskey_id: string
          alias: string
        }
        Update: {
          whiskey_id?: string
          alias?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiskey_aliases_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
      whiskeys: {
        Row: {
          id: string
          name: string
          brand: string | null
          distillery_id: string | null
          distillery_name: string | null
          bottler: string | null
          category: Database["public"]["Enums"]["whiskey_category"]
          subcategory: string | null
          country: string
          region: string | null
          age_years: number | null
          abv: number | null
          cask_type: string | null
          finish: string | null
          mash_bill: string | null
          release_year: number | null
          is_limited: boolean
          description: string | null
          image_url: string | null
          upc: string | null
          status: Database["public"]["Enums"]["catalog_status"]
          merged_into: string | null
          created_by: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          ratings_count: number
          avg_score: number | null
          loved_count: number
          liked_count: number
          fine_count: number
          disliked_count: number
          wishlist_count: number
          search_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          brand?: string | null
          distillery_id?: string | null
          distillery_name?: string | null
          bottler?: string | null
          category: Database["public"]["Enums"]["whiskey_category"]
          subcategory?: string | null
          country: string
          region?: string | null
          age_years?: number | null
          abv?: number | null
          cask_type?: string | null
          finish?: string | null
          mash_bill?: string | null
          release_year?: number | null
          is_limited?: boolean
          description?: string | null
          image_url?: string | null
          upc?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          merged_into?: string | null
          created_by?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          ratings_count?: number
          avg_score?: number | null
          loved_count?: number
          liked_count?: number
          fine_count?: number
          disliked_count?: number
          wishlist_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          brand?: string | null
          distillery_id?: string | null
          distillery_name?: string | null
          bottler?: string | null
          category?: Database["public"]["Enums"]["whiskey_category"]
          subcategory?: string | null
          country?: string
          region?: string | null
          age_years?: number | null
          abv?: number | null
          cask_type?: string | null
          finish?: string | null
          mash_bill?: string | null
          release_year?: number | null
          is_limited?: boolean
          description?: string | null
          image_url?: string | null
          upc?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          merged_into?: string | null
          created_by?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          ratings_count?: number
          avg_score?: number | null
          loved_count?: number
          liked_count?: number
          fine_count?: number
          disliked_count?: number
          wishlist_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiskeys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whiskeys_distillery_id_fkey"
            columns: ["distillery_id"]
            isOneToOne: false
            referencedRelation: "distilleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whiskeys_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whiskeys_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist: {
        Row: {
          user_id: string
          whiskey_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          whiskey_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          whiskey_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_whiskey_id_fkey"
            columns: ["whiskey_id"]
            isOneToOne: false
            referencedRelation: "whiskeys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_latest_prices: {
        Row: {
          whiskey_id: string | null
          currency: string | null
          size_ml: number | null
          price: number | null
          store_name: string | null
          observed_at: string | null
        }
        Relationships: []
      }
      v_rankings: {
        Row: {
          user_id: string | null
          whiskey_id: string | null
          tier: Database["public"]["Enums"]["rating_tier"] | null
          position: number | null
          score: number | null
          first_rated_at: string | null
          updated_at: string | null
          overall_rank: number | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_event: {
        Args: {
          p_event_id: string
        }
        Returns: boolean
      }
      can_view_profile: {
        Args: {
          p_target: string
        }
        Returns: boolean
      }
      can_view_tasting: {
        Args: {
          p_tasting_id: string
        }
        Returns: boolean
      }
      delete_my_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      event_leaderboard: {
        Args: {
          p_event_id: string
        }
        Returns: {
          pour_id: string | null
          whiskey_id: string | null
          whiskey_name: string | null
          label: string | null
          flight: string | null
          table_location: string | null
          sort_order: number | null
          ratings_count: number | null
          avg_score: number | null
          loved: number | null
          liked: number | null
          fine: number | null
          disliked: number | null
          my_tier: Database["public"]["Enums"]["rating_tier"] | null
          my_score: number | null
          my_tried: boolean | null
        }[]
      }
      export_my_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      feed: {
        Args: {
          p_limit?: number
          p_before_id?: number
          p_actor?: string
        }
        Returns: {
          id: number | null
          kind: Database["public"]["Enums"]["activity_kind"] | null
          created_at: string | null
          actor: Json | null
          whiskey: Json | null
          tasting: Json | null
          event: Json | null
          target_user: Json | null
          payload: Json | null
          liked_by_me: boolean | null
        }[]
      }
      friends_loved: {
        Args: {
          p_limit?: number
        }
        Returns: {
          whiskey: Json | null
          friend_count: number | null
          friends: Json | null
        }[]
      }
      generate_join_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      immutable_unaccent: {
        Args: {
          p: string
        }
        Returns: string
      }
      is_event_host: {
        Args: {
          p_event_id: string
        }
        Returns: boolean
      }
      is_event_member: {
        Args: {
          p_event_id: string
        }
        Returns: boolean
      }
      is_moderator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      join_event: {
        Args: {
          p_code: string
        }
        Returns: Database["public"]["Tables"]["events"]["Row"][]
      }
      match_whiskey_lines: {
        Args: {
          p_lines: string[]
        }
        Returns: {
          line: string | null
          whiskey_id: string | null
          whiskey_name: string | null
          similarity: number | null
        }[]
      }
      merge_whiskeys: {
        Args: {
          p_source: string
          p_target: string
        }
        Returns: undefined
      }
      normalize_text: {
        Args: {
          p: string
        }
        Returns: string
      }
      post_tasting_activity: {
        Args: {
          p_tasting_id: string
        }
        Returns: undefined
      }
      recompute_tier_scores: {
        Args: {
          p_user: string
          p_tier: Database["public"]["Enums"]["rating_tier"]
        }
        Returns: undefined
      }
      refresh_whiskey_stats: {
        Args: {
          p_ids: string[]
        }
        Returns: undefined
      }
      remove_ranking: {
        Args: {
          p_whiskey_id: string
        }
        Returns: undefined
      }
      search_whiskeys: {
        Args: {
          q: string
          p_categories?: Database["public"]["Enums"]["whiskey_category"][]
          p_country?: string
          p_region?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: Database["public"]["Tables"]["whiskeys"]["Row"][]
      }
      similar_whiskeys: {
        Args: {
          p_whiskey_id: string
          p_limit?: number
        }
        Returns: Database["public"]["Tables"]["whiskeys"]["Row"][]
      }
      taste_match: {
        Args: {
          p_other: string
        }
        Returns: {
          common_count: number | null
          agreement_pct: number | null
          avg_score_diff: number | null
        }[]
      }
      tier_band: {
        Args: {
          p_tier: Database["public"]["Enums"]["rating_tier"]
        }
        Returns: {
          lo: number | null
          hi: number | null
        }
      }
      top_whiskeys: {
        Args: {
          p_category?: Database["public"]["Enums"]["whiskey_category"]
          p_country?: string
          p_region?: string
          p_min_ratings?: number
          p_limit?: number
        }
        Returns: Database["public"]["Tables"]["whiskeys"]["Row"][]
      }
      trending_whiskeys: {
        Args: {
          p_days?: number
          p_limit?: number
        }
        Returns: Database["public"]["Tables"]["whiskeys"]["Row"][]
      }
      upsert_ranking: {
        Args: {
          p_whiskey_id: string
          p_tier: Database["public"]["Enums"]["rating_tier"]
          p_position?: number
          p_event_id?: string
          p_comparisons?: Json
        }
        Returns: Database["public"]["Views"]["v_rankings"]["Row"][]
      }
      whiskey_flavor_profile: {
        Args: {
          p_whiskey_id: string
        }
        Returns: {
          tag_slug: string | null
          label: string | null
          group_slug: string | null
          group_label: string | null
          tasting_count: number | null
        }[]
      }
      whiskey_friend_rankings: {
        Args: {
          p_whiskey_id: string
        }
        Returns: {
          user_id: string | null
          username: string | null
          display_name: string | null
          avatar_url: string | null
          tier: Database["public"]["Enums"]["rating_tier"] | null
          score: number | null
          overall_rank: number | null
          total: number | null
        }[]
      }
    }
    Enums: {
      activity_kind: "rated" | "tasting_added" | "whiskey_added" | "event_joined" | "event_created" | "followed"
      bottle_status: "sealed" | "open" | "finished"
      catalog_status: "pending" | "approved" | "rejected" | "merged"
      event_role: "organizer" | "host" | "attendee"
      event_status: "draft" | "live" | "ended"
      event_visibility: "public" | "code"
      follow_status: "pending" | "accepted"
      notification_kind: "new_follower" | "follow_request" | "follow_accepted" | "like" | "comment" | "event_starting" | "event_lineup_updated" | "whiskey_approved" | "whiskey_merged"
      profile_visibility: "public" | "followers"
      rating_tier: "disliked" | "fine" | "liked" | "loved"
      serving_style: "neat" | "rocks" | "water" | "highball" | "cocktail" | "other"
      tasting_setting: "home" | "bar" | "restaurant" | "event" | "distillery" | "other"
      whiskey_category: "bourbon" | "rye" | "wheat" | "tennessee" | "american_single_malt" | "american_other" | "scotch_single_malt" | "scotch_blended" | "scotch_blended_malt" | "scotch_grain" | "irish" | "japanese" | "canadian" | "world" | "other"
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
export type Functions<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]
