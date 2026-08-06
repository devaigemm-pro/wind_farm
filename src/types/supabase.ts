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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      annotation: {
        Row: {
          angle: number
          category: number
          created_at: string
          h: number
          id: string
          inspection_id: string
          next_step: string | null
          note: string | null
          root_cause: string | null
          thumbnail_id: string
          type: string
          updated_at: string
          w: number
          x: number
          y: number
        }
        Insert: {
          angle?: number
          category: number
          created_at?: string
          h: number
          id?: string
          inspection_id: string
          next_step?: string | null
          note?: string | null
          root_cause?: string | null
          thumbnail_id: string
          type: string
          updated_at?: string
          w: number
          x: number
          y: number
        }
        Update: {
          angle?: number
          category?: number
          created_at?: string
          h?: number
          id?: string
          inspection_id?: string
          next_step?: string | null
          note?: string | null
          root_cause?: string | null
          thumbnail_id?: string
          type?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      annotation_comment: {
        Row: {
          annotation_id: string
          author_name: string
          created_at: string
          id: string
          text: string
        }
        Insert: {
          annotation_id: string
          author_name?: string
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          annotation_id?: string
          author_name?: string
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      asset_document: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_by: string | null
          wind_farm_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
          wind_farm_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
          wind_farm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_document_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_document_wind_farm_id_fkey"
            columns: ["wind_farm_id"]
            isOneToOne: false
            referencedRelation: "wind_farm"
            referencedColumns: ["id"]
          },
        ]
      }
      blade: {
        Row: {
          created_at: string
          id: string
          length_meters: number | null
          position: number
          serial_number: string | null
          turbine_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          length_meters?: number | null
          position: number
          serial_number?: string | null
          turbine_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          length_meters?: number | null
          position?: number
          serial_number?: string | null
          turbine_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_turbine_id_fkey"
            columns: ["turbine_id"]
            isOneToOne: false
            referencedRelation: "turbine"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          wind_farm_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          wind_farm_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          wind_farm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_wind_farm_id_fkey"
            columns: ["wind_farm_id"]
            isOneToOne: false
            referencedRelation: "wind_farm"
            referencedColumns: ["id"]
          },
        ]
      }
      defect: {
        Row: {
          action_text: string | null
          action_urgency: string | null
          created_at: string
          description: string | null
          distance_from_root: number
          height_cm: number | null
          id: string
          inspection_id: string
          next_step: string | null
          notes: string | null
          resolved: boolean | null
          root_cause: string | null
          severity: number
          side: string | null
          type: string
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          action_text?: string | null
          action_urgency?: string | null
          created_at?: string
          description?: string | null
          distance_from_root: number
          height_cm?: number | null
          id?: string
          inspection_id: string
          next_step?: string | null
          notes?: string | null
          resolved?: boolean | null
          root_cause?: string | null
          severity: number
          side?: string | null
          type: string
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          action_text?: string | null
          action_urgency?: string | null
          created_at?: string
          description?: string | null
          distance_from_root?: number
          height_cm?: number | null
          id?: string
          inspection_id?: string
          next_step?: string | null
          notes?: string | null
          resolved?: boolean | null
          root_cause?: string | null
          severity?: number
          side?: string | null
          type?: string
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_comment: {
        Row: {
          author_id: string
          created_at: string
          defect_id: string
          id: string
          text: string
        }
        Insert: {
          author_id: string
          created_at?: string
          defect_id: string
          id?: string
          text: string
        }
        Update: {
          author_id?: string
          created_at?: string
          defect_id?: string
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_comment_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_comment_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defect"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_image: {
        Row: {
          defect_id: string
          evidence_id: string
        }
        Insert: {
          defect_id: string
          evidence_id: string
        }
        Update: {
          defect_id?: string
          evidence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_image_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defect"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_image_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          filename: string
          geo_lat: number | null
          geo_lng: number | null
          id: string
          inspection_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          filename: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          inspection_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          filename?: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          inspection_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          blade_id: string
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          inspection_type: string | null
          inspector_id: string
          notes: string | null
          photos_count: number | null
          scheduled_date: string
          stage: string
          status: string
          updated_at: string
          viewed_percent: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          blade_id: string
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_type?: string | null
          inspector_id: string
          notes?: string | null
          photos_count?: number | null
          scheduled_date: string
          stage?: string
          status?: string
          updated_at?: string
          viewed_percent?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          blade_id?: string
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_type?: string | null
          inspector_id?: string
          notes?: string | null
          photos_count?: number | null
          scheduled_date?: string
          stage?: string
          status?: string
          updated_at?: string
          viewed_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_blade_id_fkey"
            columns: ["blade_id"]
            isOneToOne: false
            referencedRelation: "blade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      report: {
        Row: {
          filename: string
          generated_at: string
          generated_by: string
          id: string
          reference_id: string
          storage_path: string
          type: string
        }
        Insert: {
          filename: string
          generated_at?: string
          generated_by: string
          id?: string
          reference_id: string
          storage_path: string
          type: string
        }
        Update: {
          filename?: string
          generated_at?: string
          generated_by?: string
          id?: string
          reference_id?: string
          storage_path?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turbine: {
        Row: {
          anticlockwise: boolean | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          model: string | null
          name: string
          power_kw: number | null
          powering_date: string | null
          serial_number: string | null
          tower_serial_number: string | null
          updated_at: string
          wind_farm_id: string
        }
        Insert: {
          anticlockwise?: boolean | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          model?: string | null
          name: string
          power_kw?: number | null
          powering_date?: string | null
          serial_number?: string | null
          tower_serial_number?: string | null
          updated_at?: string
          wind_farm_id: string
        }
        Update: {
          anticlockwise?: boolean | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          model?: string | null
          name?: string
          power_kw?: number | null
          powering_date?: string | null
          serial_number?: string | null
          tower_serial_number?: string | null
          updated_at?: string
          wind_farm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turbine_wind_farm_id_fkey"
            columns: ["wind_farm_id"]
            isOneToOne: false
            referencedRelation: "wind_farm"
            referencedColumns: ["id"]
          },
        ]
      }
      wind_farm: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          name: string
          powering_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          name: string
          powering_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          name?: string
          powering_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_defects_dashboard: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
        }
        Returns: {
          action_text: string
          action_urgency: string
          asset_name: string
          blade_id: string
          blade_position: number
          category: number
          defect_type: string
          height_cm: number
          id: string
          inspection_id: string
          next_step: string
          notes: string
          resolved: boolean
          root_cause: string
          root_distance: number
          side: string
          total_count: number
          turbine_model: string
          turbine_name: string
          width_cm: number
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_wind_farm_detail: {
        Args: { p_wind_farm_id: string }
        Returns: {
          id: string
          inspections_count: number
          location: string
          name: string
          oldest_inspection: string
          powering_date: string
          sub_assets_count: number
          total_power: number
        }[]
      }
      get_wind_farm_subassets: {
        Args: { p_wind_farm_id: string }
        Returns: {
          id: string
          inspections_count: number
          last_inspection: string
          model: string
          name: string
          power_kw: number
          powering_date: string
          serial_number: string
        }[]
      }
      get_wind_farms_dashboard: {
        Args: never
        Returns: {
          id: string
          inspections_count: number
          name: string
          oldest_inspection: string
          powering_date: string
          sub_assets_count: number
          total_power: number
        }[]
      }
      toggle_defect_resolved: {
        Args: { p_defect_id: string; p_resolved: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
