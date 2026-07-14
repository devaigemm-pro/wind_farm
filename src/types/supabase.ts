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
      defect: {
        Row: {
          created_at: string
          description: string | null
          distance_from_root: number
          id: string
          inspection_id: string
          severity: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          distance_from_root: number
          id?: string
          inspection_id: string
          severity: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          distance_from_root?: number
          id?: string
          inspection_id?: string
          severity?: number
          type?: string
          updated_at?: string
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
          completed_at: string | null
          created_at: string
          id: string
          inspector_id: string
          scheduled_date: string
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          blade_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          inspector_id: string
          scheduled_date: string
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          blade_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          inspector_id?: string
          scheduled_date?: string
          stage?: string
          status?: string
          updated_at?: string
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
          created_at: string
          id: string
          model: string | null
          name: string
          updated_at: string
          wind_farm_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          name: string
          updated_at?: string
          wind_farm_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          name?: string
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
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
