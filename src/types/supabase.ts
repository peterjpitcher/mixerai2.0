export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      analytics: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          likes: number | null
          shares: number | null
          updated_at: string | null
          views: number | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          likes?: number | null
          shares?: number | null
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          likes?: number | null
          shares?: number | null
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_selected_agencies: {
        Row: {
          agency_id: string
          brand_id: string
          created_at: string | null
        }
        Insert: {
          agency_id: string
          brand_id: string
          created_at?: string | null
        }
        Update: {
          agency_id?: string
          brand_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_selected_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "content_vetting_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_selected_agencies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          approved_content_types: Json | null
          brand_admin_id: string | null
          brand_color: string | null
          brand_identity: string | null
          brand_summary: string | null
          content_vetting_agencies: string[] | null
          country: string | null
          created_at: string | null
          guardrails: string | null
          id: string
          language: string | null
          name: string
          normalized_website_domain: string | null
          tone_of_voice: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          approved_content_types?: Json | null
          brand_admin_id?: string | null
          brand_color?: string | null
          brand_identity?: string | null
          brand_summary?: string | null
          content_vetting_agencies?: string[] | null
          country?: string | null
          created_at?: string | null
          guardrails?: string | null
          id?: string
          language?: string | null
          name: string
          normalized_website_domain?: string | null
          tone_of_voice?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          approved_content_types?: Json | null
          brand_admin_id?: string | null
          brand_color?: string | null
          brand_identity?: string | null
          brand_summary?: string | null
          content_vetting_agencies?: string[] | null
          country?: string | null
          created_at?: string | null
          guardrails?: string | null
          id?: string
          language?: string | null
          name?: string
          normalized_website_domain?: string | null
          tone_of_voice?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_brand_admin_id_fkey"
            columns: ["brand_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_brand_admin_id_fkey"
            columns: ["brand_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          claim_text: string
          claim_type: Database["public"]["Enums"]["claim_type_enum"]
          country_code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          global_brand_id: string | null
          id: string
          ingredient_id: string | null
          level: Database["public"]["Enums"]["claim_level_enum"]
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          claim_text: string
          claim_type: Database["public"]["Enums"]["claim_type_enum"]
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          global_brand_id?: string | null
          id?: string
          ingredient_id?: string | null
          level: Database["public"]["Enums"]["claim_level_enum"]
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          claim_text?: string
          claim_type?: Database["public"]["Enums"]["claim_type_enum"]
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          global_brand_id?: string | null
          id?: string
          ingredient_id?: string | null
          level?: Database["public"]["Enums"]["claim_level_enum"]
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_global_brand_id_fkey"
            columns: ["global_brand_id"]
            isOneToOne: false
            referencedRelation: "global_claim_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          assigned_to: string[] | null
          body: string
          brand_id: string | null
          content_data: Json | null
          content_type_id: string | null
          created_at: string | null
          created_by: string | null
          current_step: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_version: number | null
          status: Database["public"]["Enums"]["content_status"]
          template_id: string | null
          title: string
          updated_at: string | null
          version: number | null
          workflow_id: string | null
        }
        Insert: {
          assigned_to?: string[] | null
          body: string
          brand_id?: string | null
          content_data?: Json | null
          content_type_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_step?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_version?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          template_id?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
          workflow_id?: string | null
        }
        Update: {
          assigned_to?: string[] | null
          body?: string
          brand_id?: string | null
          content_data?: Json | null
          content_type_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_step?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_version?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          template_id?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_current_step_fkey"
            columns: ["current_step"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "content_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ownership_history: {
        Row: {
          changed_by: string | null
          content_id: string | null
          created_at: string | null
          id: string
          new_owner: string | null
          previous_owner: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          new_owner?: string | null
          previous_owner?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          new_owner?: string | null
          previous_owner?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ownership_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ownership_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ownership_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ownership_history_new_owner_fkey"
            columns: ["new_owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ownership_history_new_owner_fkey"
            columns: ["new_owner"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ownership_history_previous_owner_fkey"
            columns: ["previous_owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ownership_history_previous_owner_fkey"
            columns: ["previous_owner"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          brand_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          fields: Json
          icon: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fields: Json
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fields?: Json
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      content_versions: {
        Row: {
          action_status: string
          content_id: string
          content_json: Json | null
          created_at: string
          feedback: string | null
          id: string
          reviewer_id: string | null
          step_name: string | null
          version_number: number
          workflow_step_identifier: string
        }
        Insert: {
          action_status: string
          content_id: string
          content_json?: Json | null
          created_at?: string
          feedback?: string | null
          id?: string
          reviewer_id?: string | null
          step_name?: string | null
          version_number: number
          workflow_step_identifier: string
        }
        Update: {
          action_status?: string
          content_id?: string
          content_json?: Json | null
          created_at?: string
          feedback?: string | null
          id?: string
          reviewer_id?: string | null
          step_name?: string | null
          version_number?: number
          workflow_step_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      content_vetting_agencies: {
        Row: {
          country_code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          priority:
            | Database["public"]["Enums"]["vetting_agency_priority_level"]
            | null
          updated_at: string | null
        }
        Insert: {
          country_code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          priority?:
            | Database["public"]["Enums"]["vetting_agency_priority_level"]
            | null
          updated_at?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          priority?:
            | Database["public"]["Enums"]["vetting_agency_priority_level"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feedback_items: {
        Row: {
          actual_behavior: string | null
          affected_area: string | null
          app_version: string | null
          attachments_metadata: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expected_behavior: string | null
          id: string
          priority: Database["public"]["Enums"]["feedback_priority"]
          status: Database["public"]["Enums"]["feedback_status"]
          steps_to_reproduce: string | null
          title: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_impact_details: string | null
        }
        Insert: {
          actual_behavior?: string | null
          affected_area?: string | null
          app_version?: string | null
          attachments_metadata?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expected_behavior?: string | null
          id?: string
          priority: Database["public"]["Enums"]["feedback_priority"]
          status?: Database["public"]["Enums"]["feedback_status"]
          steps_to_reproduce?: string | null
          title?: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_impact_details?: string | null
        }
        Update: {
          actual_behavior?: string | null
          affected_area?: string | null
          app_version?: string | null
          attachments_metadata?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expected_behavior?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["feedback_priority"]
          status?: Database["public"]["Enums"]["feedback_status"]
          steps_to_reproduce?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["feedback_type"]
          user_impact_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_feedback_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_feedback_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      global_claim_brands: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invitation_logs: {
        Row: {
          brand_id: string | null
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          invited_by: string | null
          success: boolean
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          invited_by?: string | null
          success: boolean
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          invited_by?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invitation_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_logs_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_logs_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string | null
          ingredient_id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          ingredient_id: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          ingredient_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          global_brand_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          global_brand_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          global_brand_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_global_brand_id_fkey"
            columns: ["global_brand_id"]
            isOneToOne: false
            referencedRelation: "global_claim_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          job_description: string | null
          job_title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_description?: string | null
          job_title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_description?: string | null
          job_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tool_run_history: {
        Row: {
          brand_id: string | null
          error_message: string | null
          id: string
          inputs: Json
          outputs: Json
          run_at: string
          status: Database["public"]["Enums"]["tool_run_status"]
          tool_name: string
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          error_message?: string | null
          id?: string
          inputs: Json
          outputs: Json
          run_at?: string
          status?: Database["public"]["Enums"]["tool_run_status"]
          tool_name: string
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          error_message?: string | null
          id?: string
          inputs?: Json
          outputs?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["tool_run_status"]
          tool_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_run_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_brand_permissions: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_brand_role_enum"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_brand_role_enum"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_brand_role_enum"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_brand_permissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_brand_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_brand_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invitation_source: string
          invite_token: string
          invited_by: string | null
          last_reminder_at: string | null
          reminder_count: number | null
          role: string
          source_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invitation_source: string
          invite_token: string
          invited_by?: string | null
          last_reminder_at?: string | null
          reminder_count?: number | null
          role: string
          source_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_source?: string
          invite_token?: string
          invited_by?: string | null
          last_reminder_at?: string | null
          reminder_count?: number | null
          role?: string
          source_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_system_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_system_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_system_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          content_id: string
          created_at: string | null
          due_date: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
          workflow_id: string
          workflow_step_id: string
          workflow_step_name: string | null
        }
        Insert: {
          content_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          workflow_id: string
          workflow_step_id: string
          workflow_step_name?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workflow_id?: string
          workflow_step_id?: string
          workflow_step_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ut_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invite_token: string
          role: string
          status: string | null
          step_id: string | null
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invite_token: string
          role: string
          status?: string | null
          step_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          role?: string
          status?: string | null
          step_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_invitations_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_invitations_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          approval_required: boolean | null
          assigned_user_ids: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_optional: boolean
          name: string
          role: string | null
          step_id: string | null
          step_order: number
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          approval_required?: boolean | null
          assigned_user_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_optional?: boolean
          name: string
          role?: string | null
          step_id?: string | null
          step_order: number
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          approval_required?: boolean | null
          assigned_user_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_optional?: boolean
          name?: string
          role?: string | null
          step_id?: string | null
          step_order?: number
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_user_assignments: {
        Row: {
          created_at: string | null
          id: string
          step_id: string
          updated_at: string | null
          user_id: string | null
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          step_id: string
          updated_at?: string | null
          user_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          step_id?: string
          updated_at?: string | null
          user_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_user_assignments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wua_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          brand_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          steps: Json
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          steps?: Json
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          steps?: Json
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "content_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_view: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_brand_and_set_admin: {
        Args: {
          creator_user_id: string
          brand_name: string
          brand_website_url?: string
          brand_country?: string
          brand_language?: string
          brand_identity_text?: string
          brand_tone_of_voice?: string
          brand_guardrails?: string
          brand_content_vetting_agencies_input?: string[]
          brand_color_input?: string
          approved_content_types_input?: Json
        }
        Returns: string
      }
      create_workflow_and_log_invitations: {
        Args: {
          p_name: string
          p_brand_id: string
          p_steps_definition: Json
          p_created_by: string
          p_invitation_items: Json
        }
        Returns: string
      }
      delete_brand_and_dependents: {
        Args: { brand_id_to_delete: string }
        Returns: undefined
      }
      delete_template_and_update_content: {
        Args: { template_id_to_delete: string }
        Returns: undefined
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_by_email: {
        Args: { user_email: string }
        Returns: unknown[]
      }
      has_brand_permission: {
        Args: {
          user_id: string
          target_brand_id: string
          allowed_roles: string[]
        }
        Returns: boolean
      }
      integer_to_uuid: {
        Args: { "": number }
        Returns: string
      }
      is_global_admin: {
        Args: Record<PropertyKey, never> | { user_id: string }
        Returns: boolean
      }
      set_user_role_for_all_assigned_brands: {
        Args: {
          target_user_id: string
          new_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: number
      }
      test_plpgsql_declare: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_workflow_and_handle_invites: {
        Args:
          | {
              p_workflow_id: string
              p_name: string
              p_brand_id: string
              p_steps: Json
              p_template_id: string
              p_description: string
              p_new_invitation_items: Json
            }
          | {
              p_workflow_id: string
              p_name?: string
              p_brand_id?: string
              p_steps?: Json
              p_template_id?: string
              p_new_invitation_items?: Json
            }
        Returns: boolean
      }
      update_workflow_and_handle_invites_invoker_version_temp: {
        Args: {
          p_workflow_id: string
          p_name?: string
          p_brand_id?: string
          p_steps?: Json
          p_template_id?: string
          p_description?: string
          p_new_invitation_items?: Json
        }
        Returns: boolean
      }
    }
    Enums: {
      claim_level_enum: "brand" | "product" | "ingredient"
      claim_type_enum: "allowed" | "disallowed" | "mandatory"
      content_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "published"
        | "rejected"
        | "cancelled"
      feedback_priority: "low" | "medium" | "high" | "critical"
      feedback_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "closed"
        | "wont_fix"
      feedback_type: "bug" | "enhancement"
      tool_run_status: "success" | "failure"
      user_brand_role_enum: "admin" | "editor" | "viewer"
      user_role: "admin" | "editor" | "viewer"
      vetting_agency_priority_level: "High" | "Medium" | "Low"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      claim_level_enum: ["brand", "product", "ingredient"],
      claim_type_enum: ["allowed", "disallowed", "mandatory"],
      content_status: [
        "draft",
        "pending_review",
        "approved",
        "published",
        "rejected",
        "cancelled",
      ],
      feedback_priority: ["low", "medium", "high", "critical"],
      feedback_status: [
        "open",
        "in_progress",
        "resolved",
        "closed",
        "wont_fix",
      ],
      feedback_type: ["bug", "enhancement"],
      tool_run_status: ["success", "failure"],
      user_brand_role_enum: ["admin", "editor", "viewer"],
      user_role: ["admin", "editor", "viewer"],
      vetting_agency_priority_level: ["High", "Medium", "Low"],
    },
  },
} as const
