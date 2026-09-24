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
      ai_logs: {
        Row: {
          confidence: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_summary: string | null
          model: string | null
          operation: string
          output_summary: string | null
          project_id: string | null
          prompt_version: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          model?: string | null
          operation: string
          output_summary?: string | null
          project_id?: string | null
          prompt_version?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          model?: string | null
          operation?: string
          output_summary?: string | null
          project_id?: string | null
          prompt_version?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          category: string | null
          created_at: string | null
          expected_lifespan_years: number | null
          id: string
          installation_date: string | null
          location: unknown
          manufacturer: string | null
          model: string | null
          name_ar: string
          notes: string | null
          project_id: string
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code: string
          category?: string | null
          created_at?: string | null
          expected_lifespan_years?: number | null
          id?: string
          installation_date?: string | null
          location?: unknown
          manufacturer?: string | null
          model?: string | null
          name_ar: string
          notes?: string | null
          project_id: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string
          category?: string | null
          created_at?: string | null
          expected_lifespan_years?: number | null
          id?: string
          installation_date?: string | null
          location?: unknown
          manufacturer?: string | null
          model?: string | null
          name_ar?: string
          notes?: string | null
          project_id?: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_id: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          project_id: string | null
          reason: string | null
          record_id: string | null
          result: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          project_id?: string | null
          reason?: string | null
          record_id?: string | null
          result?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          project_id?: string | null
          reason?: string | null
          record_id?: string | null
          result?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          connection_date: string | null
          created_at: string | null
          customer_number: string
          customer_type: string | null
          id: string
          location: unknown
          name_ar: string
          notes: string | null
          phone: string | null
          project_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          connection_date?: string | null
          created_at?: string | null
          customer_number: string
          customer_type?: string | null
          id?: string
          location?: unknown
          name_ar: string
          notes?: string | null
          phone?: string | null
          project_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          connection_date?: string | null
          created_at?: string | null
          customer_number?: string
          customer_type?: string | null
          id?: string
          location?: unknown
          name_ar?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          name_ar: string
          name_en: string | null
          region_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          name_ar: string
          name_en?: string | null
          region_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          name_ar?: string
          name_en?: string | null
          region_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "districts_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      faults: {
        Row: {
          asset_id: string | null
          assigned_team: string | null
          created_at: string | null
          description: string | null
          fault_number: string
          fault_type: string | null
          id: string
          location: unknown
          project_id: string
          pump_id: string | null
          reported_at: string | null
          reported_by: string | null
          reporter_type: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          updated_at: string | null
          verified_at: string | null
          well_id: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_team?: string | null
          created_at?: string | null
          description?: string | null
          fault_number: string
          fault_type?: string | null
          id?: string
          location?: unknown
          project_id: string
          pump_id?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reporter_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          verified_at?: string | null
          well_id?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_team?: string | null
          created_at?: string | null
          description?: string | null
          fault_number?: string
          fault_type?: string | null
          id?: string
          location?: unknown
          project_id?: string
          pump_id?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reporter_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          verified_at?: string | null
          well_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faults_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faults_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faults_pump_id_fkey"
            columns: ["pump_id"]
            isOneToOne: false
            referencedRelation: "pumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faults_well_id_fkey"
            columns: ["well_id"]
            isOneToOne: false
            referencedRelation: "wells"
            referencedColumns: ["id"]
          },
        ]
      }
      field_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          items_completed: number | null
          items_total: number | null
          notes: string | null
          priority: string | null
          project_id: string
          status: string | null
          task_number: string
          task_type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          items_completed?: number | null
          items_total?: number | null
          notes?: string | null
          priority?: string | null
          project_id: string
          status?: string | null
          task_number: string
          task_type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          items_completed?: number | null
          items_total?: number | null
          notes?: string | null
          priority?: string | null
          project_id?: string
          status?: string | null
          task_number?: string
          task_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          balance: number | null
          billing_period_end: string
          billing_period_start: string
          consumption_fee: number | null
          consumption_m3: number | null
          created_at: string | null
          current_reading: number | null
          customer_id: string
          due_date: string | null
          fixed_fee: number | null
          grand_total: number | null
          id: string
          invoice_number: string
          issue_date: string | null
          meter_id: string | null
          notes: string | null
          previous_balance: number | null
          previous_reading: number | null
          project_id: string
          source_reading_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance?: number | null
          billing_period_end: string
          billing_period_start: string
          consumption_fee?: number | null
          consumption_m3?: number | null
          created_at?: string | null
          current_reading?: number | null
          customer_id: string
          due_date?: string | null
          fixed_fee?: number | null
          grand_total?: number | null
          id?: string
          invoice_number: string
          issue_date?: string | null
          meter_id?: string | null
          notes?: string | null
          previous_balance?: number | null
          previous_reading?: number | null
          project_id: string
          source_reading_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance?: number | null
          billing_period_end?: string
          billing_period_start?: string
          consumption_fee?: number | null
          consumption_m3?: number | null
          created_at?: string | null
          current_reading?: number | null
          customer_id?: string
          due_date?: string | null
          fixed_fee?: number | null
          grand_total?: number | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          meter_id?: string | null
          notes?: string | null
          previous_balance?: number | null
          previous_reading?: number | null
          project_id?: string
          source_reading_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_source_reading_id_fkey"
            columns: ["source_reading_id"]
            isOneToOne: false
            referencedRelation: "meter_readings"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          active_customers: number | null
          collection_rate: number | null
          created_at: string | null
          data_completeness: number | null
          id: string
          nrw_percentage: number | null
          open_faults: number | null
          open_work_orders: number | null
          outstanding_balance: number | null
          pending_readings: number | null
          period: string
          period_end: string | null
          period_start: string | null
          project_id: string | null
          revenue_collected: number | null
          revenue_total: number | null
          total_readings: number | null
          water_consumption_m3: number | null
          water_production_m3: number | null
        }
        Insert: {
          active_customers?: number | null
          collection_rate?: number | null
          created_at?: string | null
          data_completeness?: number | null
          id?: string
          nrw_percentage?: number | null
          open_faults?: number | null
          open_work_orders?: number | null
          outstanding_balance?: number | null
          pending_readings?: number | null
          period: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string | null
          revenue_collected?: number | null
          revenue_total?: number | null
          total_readings?: number | null
          water_consumption_m3?: number | null
          water_production_m3?: number | null
        }
        Update: {
          active_customers?: number | null
          collection_rate?: number | null
          created_at?: string | null
          data_completeness?: number | null
          id?: string
          nrw_percentage?: number | null
          open_faults?: number | null
          open_work_orders?: number | null
          outstanding_balance?: number | null
          pending_readings?: number | null
          period?: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string | null
          revenue_collected?: number | null
          revenue_total?: number | null
          total_readings?: number | null
          water_consumption_m3?: number | null
          water_production_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_work_orders: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          completed_date: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          downtime_hours: number | null
          fault_id: string | null
          id: string
          notes: string | null
          parts_used: string | null
          priority: string | null
          project_id: string
          pump_id: string | null
          scheduled_date: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          well_id: string | null
          work_order_number: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          downtime_hours?: number | null
          fault_id?: string | null
          id?: string
          notes?: string | null
          parts_used?: string | null
          priority?: string | null
          project_id: string
          pump_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          well_id?: string | null
          work_order_number: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          downtime_hours?: number | null
          fault_id?: string | null
          id?: string
          notes?: string | null
          parts_used?: string | null
          priority?: string | null
          project_id?: string
          pump_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          well_id?: string | null
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_fault_id_fkey"
            columns: ["fault_id"]
            isOneToOne: false
            referencedRelation: "faults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_pump_id_fkey"
            columns: ["pump_id"]
            isOneToOne: false
            referencedRelation: "pumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_well_id_fkey"
            columns: ["well_id"]
            isOneToOne: false
            referencedRelation: "wells"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          ai_confidence: number | null
          ai_extracted_value: number | null
          ai_model: string | null
          anomaly_flag: boolean | null
          anomaly_reason: string | null
          business_date: string | null
          client_capture_id: string | null
          consumption: number | null
          created_at: string | null
          customer_id: string | null
          gps_accuracy: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          image_url: string | null
          meter_id: string
          notes: string | null
          previous_reading: number | null
          project_id: string
          reader_name: string | null
          reading_date: string | null
          reading_method: string | null
          reading_value: number
          status: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_extracted_value?: number | null
          ai_model?: string | null
          anomaly_flag?: boolean | null
          anomaly_reason?: string | null
          business_date?: string | null
          client_capture_id?: string | null
          consumption?: number | null
          created_at?: string | null
          customer_id?: string | null
          gps_accuracy?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          image_url?: string | null
          meter_id: string
          notes?: string | null
          previous_reading?: number | null
          project_id: string
          reader_name?: string | null
          reading_date?: string | null
          reading_method?: string | null
          reading_value: number
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_extracted_value?: number | null
          ai_model?: string | null
          anomaly_flag?: boolean | null
          anomaly_reason?: string | null
          business_date?: string | null
          client_capture_id?: string | null
          consumption?: number | null
          created_at?: string | null
          customer_id?: string | null
          gps_accuracy?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          image_url?: string | null
          meter_id?: string
          notes?: string | null
          previous_reading?: number | null
          project_id?: string
          reader_name?: string | null
          reading_date?: string | null
          reading_method?: string | null
          reading_value?: number
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meters: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          installation_date: string | null
          last_reading: number | null
          last_reading_date: string | null
          location: unknown
          meter_number: string
          meter_type: string | null
          project_id: string
          serial_number: string | null
          size_mm: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          installation_date?: string | null
          last_reading?: number | null
          last_reading_date?: string | null
          location?: unknown
          meter_number: string
          meter_type?: string | null
          project_id: string
          serial_number?: string | null
          size_mm?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          installation_date?: string | null
          last_reading?: number | null
          last_reading_date?: string | null
          location?: unknown
          meter_number?: string
          meter_type?: string | null
          project_id?: string
          serial_number?: string | null
          size_mm?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meters_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mizan_permissions: {
        Row: {
          description_ar: string
          name_ar: string
          permission_code: string
        }
        Insert: {
          description_ar: string
          name_ar: string
          permission_code: string
        }
        Update: {
          description_ar?: string
          name_ar?: string
          permission_code?: string
        }
        Relationships: []
      }
      mizan_role_catalog: {
        Row: {
          description_ar: string
          is_legacy: boolean
          name_ar: string
          role_code: string
        }
        Insert: {
          description_ar: string
          is_legacy?: boolean
          name_ar: string
          role_code: string
        }
        Update: {
          description_ar?: string
          is_legacy?: boolean
          name_ar?: string
          role_code?: string
        }
        Relationships: []
      }
      mizan_role_permissions: {
        Row: {
          permission_code: string
          role_code: string
        }
        Insert: {
          permission_code: string
          role_code: string
        }
        Update: {
          permission_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "mizan_role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "mizan_permissions"
            referencedColumns: ["permission_code"]
          },
          {
            foreignKeyName: "mizan_role_permissions_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "mizan_role_catalog"
            referencedColumns: ["role_code"]
          },
        ]
      }
      notifications: {
        Row: {
          body_ar: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          project_id: string | null
          severity: string | null
          title_ar: string
          type: string
        }
        Insert: {
          body_ar?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          severity?: string | null
          title_ar: string
          type: string
        }
        Update: {
          body_ar?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          severity?: string | null
          title_ar?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name_ar: string
          name_en: string | null
          phone: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name_ar: string
          name_en?: string | null
          phone?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name_ar?: string
          name_en?: string | null
          phone?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          collector_name: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          project_id: string
          receipt_number: string
          reference_number: string | null
        }
        Insert: {
          amount: number
          collector_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          project_id: string
          receipt_number: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          collector_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string
          receipt_number?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          must_change_password: boolean | null
          phone: string | null
          project_id: string | null
          role: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          must_change_password?: boolean | null
          phone?: string | null
          project_id?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean | null
          phone?: string | null
          project_id?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_seq_counters: {
        Row: {
          counter: number
          id: string
          project_id: string
          seq_name: string
        }
        Insert: {
          counter?: number
          id: string
          project_id: string
          seq_name: string
        }
        Update: {
          counter?: number
          id?: string
          project_id?: string
          seq_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_seq_counters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          beneficiary_count: number | null
          created_at: string | null
          design_capacity: number | null
          district_id: string | null
          donor: string | null
          established_date: string | null
          funding_source: string | null
          id: string
          location: unknown
          name_ar: string
          name_en: string | null
          operational_capacity: number | null
          organization_id: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          beneficiary_count?: number | null
          created_at?: string | null
          design_capacity?: number | null
          district_id?: string | null
          donor?: string | null
          established_date?: string | null
          funding_source?: string | null
          id?: string
          location?: unknown
          name_ar: string
          name_en?: string | null
          operational_capacity?: number | null
          organization_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          beneficiary_count?: number | null
          created_at?: string | null
          design_capacity?: number | null
          district_id?: string | null
          donor?: string | null
          established_date?: string | null
          funding_source?: string | null
          id?: string
          location?: unknown
          name_ar?: string
          name_en?: string | null
          operational_capacity?: number | null
          organization_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pumps: {
        Row: {
          code: string
          created_at: string | null
          efficiency: number | null
          flow_rate_m3_h: number | null
          head_m: number | null
          id: string
          installation_date: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          operating_hours: number | null
          power_kw: number | null
          project_id: string
          serial_number: string | null
          status: string | null
          updated_at: string | null
          well_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          efficiency?: number | null
          flow_rate_m3_h?: number | null
          head_m?: number | null
          id?: string
          installation_date?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          operating_hours?: number | null
          power_kw?: number | null
          project_id: string
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
          well_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          efficiency?: number | null
          flow_rate_m3_h?: number | null
          head_m?: number | null
          id?: string
          installation_date?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          operating_hours?: number | null
          power_kw?: number | null
          project_id?: string
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
          well_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pumps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pumps_well_id_fkey"
            columns: ["well_id"]
            isOneToOne: false
            referencedRelation: "wells"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          name_ar: string
          name_en: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          name_ar: string
          name_en?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          name_ar?: string
          name_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seq_counters: {
        Row: {
          counter: number
          id: string
          year: number
        }
        Insert: {
          counter?: number
          id: string
          year?: number
        }
        Update: {
          counter?: number
          id?: string
          year?: number
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      tanks: {
        Row: {
          capacity_m3: number | null
          code: string
          created_at: string | null
          current_level_m3: number | null
          elevation_m: number | null
          id: string
          installation_date: string | null
          location: unknown
          material: string | null
          name_ar: string | null
          project_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          capacity_m3?: number | null
          code: string
          created_at?: string | null
          current_level_m3?: number | null
          elevation_m?: number | null
          id?: string
          installation_date?: string | null
          location?: unknown
          material?: string | null
          name_ar?: string | null
          project_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity_m3?: number | null
          code?: string
          created_at?: string | null
          current_level_m3?: number | null
          elevation_m?: number | null
          id?: string
          installation_date?: string | null
          location?: unknown
          material?: string | null
          name_ar?: string | null
          project_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tanks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_tiers: {
        Row: {
          created_at: string | null
          from_m3: number
          id: string
          price_per_m3: number
          tariff_id: string
          to_m3: number | null
        }
        Insert: {
          created_at?: string | null
          from_m3?: number
          id?: string
          price_per_m3: number
          tariff_id: string
          to_m3?: number | null
        }
        Update: {
          created_at?: string | null
          from_m3?: number
          id?: string
          price_per_m3?: number
          tariff_id?: string
          to_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tariff_tiers_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          created_at: string | null
          customer_type: string | null
          effective_from: string
          effective_to: string | null
          fixed_fee: number | null
          id: string
          is_active: boolean | null
          name_ar: string
          project_id: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          customer_type?: string | null
          effective_from?: string
          effective_to?: string | null
          fixed_fee?: number | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          project_id?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          customer_type?: string | null
          effective_from?: string
          effective_to?: string | null
          fixed_fee?: number | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          project_id?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tariffs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
          parent_tenant_id: string | null
          status: string
          tenant_type: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
          parent_tenant_id?: string | null
          status?: string
          tenant_type?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          parent_tenant_id?: string | null
          status?: string
          tenant_type?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wells: {
        Row: {
          capacity_m3_h: number | null
          code: string
          created_at: string | null
          daily_output_m3: number | null
          depth_m: number | null
          id: string
          installation_date: string | null
          location: unknown
          name_ar: string | null
          notes: string | null
          operating_hours: number | null
          project_id: string
          pump_installed: boolean | null
          status: string | null
          updated_at: string | null
          water_level_m: number | null
          water_source: string | null
        }
        Insert: {
          capacity_m3_h?: number | null
          code: string
          created_at?: string | null
          daily_output_m3?: number | null
          depth_m?: number | null
          id?: string
          installation_date?: string | null
          location?: unknown
          name_ar?: string | null
          notes?: string | null
          operating_hours?: number | null
          project_id: string
          pump_installed?: boolean | null
          status?: string | null
          updated_at?: string | null
          water_level_m?: number | null
          water_source?: string | null
        }
        Update: {
          capacity_m3_h?: number | null
          code?: string
          created_at?: string | null
          daily_output_m3?: number | null
          depth_m?: number | null
          id?: string
          installation_date?: string | null
          location?: unknown
          name_ar?: string | null
          notes?: string | null
          operating_hours?: number | null
          project_id?: string
          pump_installed?: boolean | null
          status?: string | null
          updated_at?: string | null
          water_level_m?: number | null
          water_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wells_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_user_project_id: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
      gettransactionid: { Args: never; Returns: unknown }
      is_main_tenant_user: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_tenant_manager: { Args: never; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mizan_create_invoice: {
        Args: {
          p_current_reading: number
          p_customer_id: string
          p_meter_id: string
          p_period_end: string
          p_period_start: string
          p_project_id: string
        }
        Returns: {
          amount_paid: number | null
          balance: number | null
          billing_period_end: string
          billing_period_start: string
          consumption_fee: number | null
          consumption_m3: number | null
          created_at: string | null
          current_reading: number | null
          customer_id: string
          due_date: string | null
          fixed_fee: number | null
          grand_total: number | null
          id: string
          invoice_number: string
          issue_date: string | null
          meter_id: string | null
          notes: string | null
          previous_balance: number | null
          previous_reading: number | null
          project_id: string
          source_reading_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mizan_record_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_notes?: string
          p_payment_method?: string
          p_reference_number?: string
        }
        Returns: {
          amount: number
          collector_name: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          project_id: string
          receipt_number: string
          reference_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mrx_capture_meter_reading: {
        Args: {
          p_ai_confidence?: number
          p_ai_extracted_value?: number
          p_ai_model?: string
          p_client_capture_id?: string
          p_gps_accuracy?: number
          p_gps_lat?: number
          p_gps_lng?: number
          p_image_url?: string
          p_meter_id: string
          p_notes?: string
          p_reading_date?: string
          p_reading_method?: string
          p_reading_value: number
        }
        Returns: {
          ai_confidence: number | null
          ai_extracted_value: number | null
          ai_model: string | null
          anomaly_flag: boolean | null
          anomaly_reason: string | null
          business_date: string | null
          client_capture_id: string | null
          consumption: number | null
          created_at: string | null
          customer_id: string | null
          gps_accuracy: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          image_url: string | null
          meter_id: string
          notes: string | null
          previous_reading: number | null
          project_id: string
          reader_name: string | null
          reading_date: string | null
          reading_method: string | null
          reading_value: number
          status: string | null
          sync_status: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meter_readings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_project_seq_number: {
        Args: { project_uuid: string; seq_name: string }
        Returns: string
      }
      next_seq_number: { Args: { seq_name: string }; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
    Enums: {},
  },
} as const
