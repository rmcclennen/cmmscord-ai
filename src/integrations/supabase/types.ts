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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      asset_maintenance_info: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          intervals: Json
          parts: Json
          sources: Json
          summary: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          intervals?: Json
          parts?: Json
          sources?: Json
          summary?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          intervals?: Json
          parts?: Json
          sources?: Json
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_info_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          category: string | null
          class: string | null
          commission_date: string | null
          created_at: string
          criticality: string
          enclosure: string | null
          frame: string | null
          hertz: string | null
          hp: string | null
          id: string
          limble_asset_id: number | null
          location_name: string | null
          make: string | null
          manuals: string | null
          manufacturer: string | null
          manufacturer_url: string | null
          model: string | null
          name: string
          notes: string | null
          parent_limble_id: number | null
          phase: string | null
          rpm: string | null
          serial_number: string | null
          status: string
          supplier: string | null
          tag_number: string | null
          type: string | null
          updated_at: string
          volts: string | null
        }
        Insert: {
          category?: string | null
          class?: string | null
          commission_date?: string | null
          created_at?: string
          criticality?: string
          enclosure?: string | null
          frame?: string | null
          hertz?: string | null
          hp?: string | null
          id?: string
          limble_asset_id?: number | null
          location_name?: string | null
          make?: string | null
          manuals?: string | null
          manufacturer?: string | null
          manufacturer_url?: string | null
          model?: string | null
          name: string
          notes?: string | null
          parent_limble_id?: number | null
          phase?: string | null
          rpm?: string | null
          serial_number?: string | null
          status?: string
          supplier?: string | null
          tag_number?: string | null
          type?: string | null
          updated_at?: string
          volts?: string | null
        }
        Update: {
          category?: string | null
          class?: string | null
          commission_date?: string | null
          created_at?: string
          criticality?: string
          enclosure?: string | null
          frame?: string | null
          hertz?: string | null
          hp?: string | null
          id?: string
          limble_asset_id?: number | null
          location_name?: string | null
          make?: string | null
          manuals?: string | null
          manufacturer?: string | null
          manufacturer_url?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          parent_limble_id?: number | null
          phase?: string | null
          rpm?: string | null
          serial_number?: string | null
          status?: string
          supplier?: string | null
          tag_number?: string | null
          type?: string | null
          updated_at?: string
          volts?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pm_schedules: {
        Row: {
          active: boolean
          asset_id: string | null
          assigned_label: string | null
          assigned_to: string | null
          created_at: string
          estimated_hours: number | null
          id: string
          interval_days: number
          last_completed: string | null
          limble_task_id: number | null
          next_due: string
          priority: string
          tasks: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_id?: string | null
          assigned_label?: string | null
          assigned_to?: string | null
          created_at?: string
          estimated_hours?: number | null
          id?: string
          interval_days?: number
          last_completed?: string | null
          limble_task_id?: number | null
          next_due?: string
          priority?: string
          tasks?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string | null
          assigned_label?: string | null
          assigned_to?: string | null
          created_at?: string
          estimated_hours?: number | null
          id?: string
          interval_days?: number
          last_completed?: string | null
          limble_task_id?: number | null
          next_due?: string
          priority?: string
          tasks?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          labor_hours: number | null
          parts_used: string | null
          pm_schedule_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          wo_number: number
          wo_type: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          labor_hours?: number | null
          parts_used?: string | null
          pm_schedule_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          wo_number?: number
          wo_type?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          labor_hours?: number | null
          parts_used?: string | null
          pm_schedule_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          wo_number?: number
          wo_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_pm_schedule_id_fkey"
            columns: ["pm_schedule_id"]
            isOneToOne: false
            referencedRelation: "pm_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "technician" | "viewer"
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
    Enums: {
      app_role: ["admin", "technician", "viewer"],
    },
  },
} as const
