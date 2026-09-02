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
      asset_photos: {
        Row: {
          asset_id: string
          caption: string | null
          created_at: string
          id: string
          kind: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_photos_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          building: string | null
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
          building?: string | null
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
          building?: string | null
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
      deletion_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          reason: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id: string
          entity_label: string
          entity_type: string
          id?: string
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id?: string
          entity_label?: string
          entity_type?: string
          id?: string
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      manuals: {
        Row: {
          added_by: string | null
          asset_id: string | null
          created_at: string
          file_url: string
          id: string
          kind: string
          manufacturer: string | null
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          asset_id?: string | null
          created_at?: string
          file_url: string
          id?: string
          kind?: string
          manufacturer?: string | null
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          asset_id?: string | null
          created_at?: string
          file_url?: string
          id?: string
          kind?: string
          manufacturer?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manuals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
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
      part_assets: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          note: string | null
          part_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          note?: string | null
          part_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          note?: string | null
          part_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_assets_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_request_bids: {
        Row: {
          amount: number | null
          contact: string | null
          created_at: string
          created_by: string | null
          id: string
          is_winner: boolean
          lead_time_days: number | null
          note: string | null
          request_id: string
          updated_at: string
          vendor: string
        }
        Insert: {
          amount?: number | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_winner?: boolean
          lead_time_days?: number | null
          note?: string | null
          request_id: string
          updated_at?: string
          vendor: string
        }
        Update: {
          amount?: number | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_winner?: boolean
          lead_time_days?: number | null
          note?: string | null
          request_id?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_request_bids_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      part_requests: {
        Row: {
          asset_id: string | null
          awarded_cost: number | null
          awarded_vendor: string | null
          created_at: string
          decision_note: string | null
          expected_date: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          lead_time_days: number | null
          needed_by: string | null
          note: string | null
          ordered_at: string | null
          part_id: string | null
          part_lines: string
          photo_paths: string[]
          po_number: string | null
          priority: string
          quoted_cost: number | null
          received_at: string | null
          requested_by: string | null
          route_to: string
          sent_to: string | null
          status: string
          title: string
          updated_at: string
          vendor: string | null
          work_order_id: string | null
        }
        Insert: {
          asset_id?: string | null
          awarded_cost?: number | null
          awarded_vendor?: string | null
          created_at?: string
          decision_note?: string | null
          expected_date?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          lead_time_days?: number | null
          needed_by?: string | null
          note?: string | null
          ordered_at?: string | null
          part_id?: string | null
          part_lines: string
          photo_paths?: string[]
          po_number?: string | null
          priority?: string
          quoted_cost?: number | null
          received_at?: string | null
          requested_by?: string | null
          route_to?: string
          sent_to?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor?: string | null
          work_order_id?: string | null
        }
        Update: {
          asset_id?: string | null
          awarded_cost?: number | null
          awarded_vendor?: string | null
          created_at?: string
          decision_note?: string | null
          expected_date?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          lead_time_days?: number | null
          needed_by?: string | null
          note?: string | null
          ordered_at?: string | null
          part_id?: string | null
          part_lines?: string
          photo_paths?: string[]
          po_number?: string | null
          priority?: string
          quoted_cost?: number | null
          received_at?: string | null
          requested_by?: string | null
          route_to?: string
          sent_to?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_requests_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      part_transactions: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          part_id: string
          performed_by: string | null
          qty: number
          work_order_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          part_id: string
          performed_by?: string | null
          qty: number
          work_order_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          part_id?: string
          performed_by?: string | null
          qty?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_transactions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          bin: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          manufacturer: string | null
          min_qty: number
          name: string
          part_number: string | null
          qty_on_hand: number
          unit: string
          unit_cost: number | null
          updated_at: string
          where_to_buy: string | null
        }
        Insert: {
          bin?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          min_qty?: number
          name: string
          part_number?: string | null
          qty_on_hand?: number
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          where_to_buy?: string | null
        }
        Update: {
          bin?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          min_qty?: number
          name?: string
          part_number?: string | null
          qty_on_hand?: number
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          where_to_buy?: string | null
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
          season_end_md: string | null
          season_start_md: string | null
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
          season_end_md?: string | null
          season_start_md?: string | null
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
          season_end_md?: string | null
          season_start_md?: string | null
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
          carrier: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notify_email: boolean
          notify_sms: boolean
          phone: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          notify_email?: boolean
          notify_sms?: boolean
          phone?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notify_email?: boolean
          notify_sms?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      team_directory: {
        Row: {
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          id?: string
          updated_at?: string
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
      can_approve_deletions: { Args: { _user_id: string }; Returns: boolean }
      can_write_operational: { Args: { _user_id: string }; Returns: boolean }
      decide_deletion_request: {
        Args: { _approve: boolean; _note?: string; _request_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          reason: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "technician"
        | "viewer"
        | "manager"
        | "supervisor"
        | "lead_operator"
        | "operator"
        | "electrician"
        | "maintenance"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "technician",
        "viewer",
        "manager",
        "supervisor",
        "lead_operator",
        "operator",
        "electrician",
        "maintenance",
      ],
    },
  },
} as const
