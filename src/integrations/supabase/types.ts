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
      meta_bulk_send_logs: {
        Row: {
          account_id: string | null
          created_at: string | null
          delivered_count: number | null
          empresa_id: string
          failed_count: number | null
          fallback_body: string | null
          fallback_sent_count: number | null
          fallback_template: string | null
          finished_at: string | null
          id: string
          read_count: number | null
          rows_detail: Json | null
          sent_count: number | null
          started_at: string | null
          template_body: string | null
          template_language: string | null
          template_name: string
          total_rows: number | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          delivered_count?: number | null
          empresa_id: string
          failed_count?: number | null
          fallback_body?: string | null
          fallback_sent_count?: number | null
          fallback_template?: string | null
          finished_at?: string | null
          id?: string
          read_count?: number | null
          rows_detail?: Json | null
          sent_count?: number | null
          started_at?: string | null
          template_body?: string | null
          template_language?: string | null
          template_name: string
          total_rows?: number | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          delivered_count?: number | null
          empresa_id?: string
          failed_count?: number | null
          fallback_body?: string | null
          fallback_sent_count?: number | null
          fallback_template?: string | null
          finished_at?: string | null
          id?: string
          read_count?: number | null
          rows_detail?: Json | null
          sent_count?: number | null
          started_at?: string | null
          template_body?: string | null
          template_language?: string | null
          template_name?: string
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_bulk_send_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_inbox_accounts: {
        Row: {
          access_token: string
          created_at: string
          empresa_id: string
          id: string
          last_webhook_at: string | null
          nome: string
          phone_display: string | null
          phone_number_id: string
          status: string
          token_type: string
          updated_at: string
          waba_id: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          empresa_id: string
          id?: string
          last_webhook_at?: string | null
          nome: string
          phone_display?: string | null
          phone_number_id: string
          status?: string
          token_type?: string
          updated_at?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          empresa_id?: string
          id?: string
          last_webhook_at?: string | null
          nome?: string
          phone_display?: string | null
          phone_number_id?: string
          status?: string
          token_type?: string
          updated_at?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      meta_inbox_conversations: {
        Row: {
          account_id: string
          assigned_user_id: string | null
          contact_name: string | null
          contact_phone: string
          contact_profile_pic: string | null
          created_at: string | null
          empresa_id: string
          first_response_at: string | null
          first_response_ms: number | null
          id: string
          last_inbound_ts: string | null
          last_message: string | null
          last_message_from_me: boolean | null
          last_message_ts: string | null
          participants_out: string[] | null
          resolved_at: string | null
          status: string | null
          tags: string[] | null
          total_messages_in: number | null
          total_messages_out: number | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          assigned_user_id?: string | null
          contact_name?: string | null
          contact_phone: string
          contact_profile_pic?: string | null
          created_at?: string | null
          empresa_id: string
          first_response_at?: string | null
          first_response_ms?: number | null
          id?: string
          last_inbound_ts?: string | null
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_ts?: string | null
          participants_out?: string[] | null
          resolved_at?: string | null
          status?: string | null
          tags?: string[] | null
          total_messages_in?: number | null
          total_messages_out?: number | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          assigned_user_id?: string | null
          contact_name?: string | null
          contact_phone?: string
          contact_profile_pic?: string | null
          created_at?: string | null
          empresa_id?: string
          first_response_at?: string | null
          first_response_ms?: number | null
          id?: string
          last_inbound_ts?: string | null
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_ts?: string | null
          participants_out?: string[] | null
          resolved_at?: string | null
          status?: string | null
          tags?: string[] | null
          total_messages_in?: number | null
          total_messages_out?: number | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_inbox_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_inbox_messages: {
        Row: {
          account_id: string
          body: string | null
          caption: string | null
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          empresa_id: string
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          from_me: boolean
          from_phone: string | null
          id: string
          media_filename: string | null
          media_id: string | null
          media_mime: string | null
          media_url: string | null
          msg_type: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          template_components: Json | null
          template_language: string | null
          template_name: string | null
          timestamp: string
          to_phone: string | null
          wamid: string | null
          sent_by_user_id: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          caption?: string | null
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          empresa_id: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_me?: boolean
          from_phone?: string | null
          id?: string
          media_filename?: string | null
          media_id?: string | null
          media_mime?: string | null
          media_url?: string | null
          msg_type?: string
          read_at?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          template_components?: Json | null
          template_language?: string | null
          template_name?: string | null
          timestamp?: string
          to_phone?: string | null
          wamid?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          caption?: string | null
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          empresa_id?: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_me?: boolean
          from_phone?: string | null
          id?: string
          media_filename?: string | null
          media_id?: string | null
          media_mime?: string | null
          media_url?: string | null
          msg_type?: string
          read_at?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          template_components?: Json | null
          template_language?: string | null
          template_name?: string | null
          timestamp?: string
          to_phone?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_inbox_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_inbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_inbox_metrics_daily: {
        Row: {
          account_id: string
          avg_first_response_ms: number | null
          conversations_opened: number | null
          conversations_resolved: number | null
          created_at: string | null
          date: string
          empresa_id: string
          id: string
          max_first_response_ms: number | null
          media_sent: number | null
          messages_in: number | null
          messages_out: number | null
          min_first_response_ms: number | null
          templates_sent: number | null
          unique_contacts: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          avg_first_response_ms?: number | null
          conversations_opened?: number | null
          conversations_resolved?: number | null
          created_at?: string | null
          date: string
          empresa_id: string
          id?: string
          max_first_response_ms?: number | null
          media_sent?: number | null
          messages_in?: number | null
          messages_out?: number | null
          min_first_response_ms?: number | null
          templates_sent?: number | null
          unique_contacts?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          avg_first_response_ms?: number | null
          conversations_opened?: number | null
          conversations_resolved?: number | null
          created_at?: string | null
          date?: string
          empresa_id?: string
          id?: string
          max_first_response_ms?: number | null
          media_sent?: number | null
          messages_in?: number | null
          messages_out?: number | null
          min_first_response_ms?: number | null
          templates_sent?: number | null
          unique_contacts?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_inbox_metrics_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_inbox_templates: {
        Row: {
          account_id: string
          category: string
          components: Json | null
          display_name: string | null
          empresa_id: string
          id: string
          is_active: boolean | null
          language: string
          meta_template_id: string
          name: string
          quality_score: string | null
          rejected_reason: string | null
          status: string
          synced_at: string | null
          version: number | null
        }
        Insert: {
          account_id: string
          category?: string
          components?: Json | null
          display_name?: string | null
          empresa_id: string
          id?: string
          is_active?: boolean | null
          language?: string
          meta_template_id: string
          name: string
          quality_score?: string | null
          rejected_reason?: string | null
          status?: string
          synced_at?: string | null
          version?: number | null
        }
        Update: {
          account_id?: string
          category?: string
          components?: Json | null
          display_name?: string | null
          empresa_id?: string
          id?: string
          is_active?: boolean | null
          language?: string
          meta_template_id?: string
          name?: string
          quality_score?: string | null
          rejected_reason?: string | null
          status?: string
          synced_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_inbox_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_inbox_user_access: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          usuario_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          usuario_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_inbox_user_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_inbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_inbox_metric: {
        Args: {
          p_account_id: string
          p_date: string
          p_empresa_id: string
          p_field: string
          p_increment?: number
        }
        Returns: undefined
      }
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
