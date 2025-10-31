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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      account_record: {
        Row: {
          account_subtype: string | null
          account_type: string | null
          classification: string | null
          created_at: string | null
          currency_id: string | null
          current_balance: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_sub_account: boolean | null
          last_sync_at: string | null
          name: string
          number: string | null
          opening_balance: number | null
          opening_balance_date: string | null
          organization_id: string
          parent_account_id: string | null
          qbo_id: string | null
          sync_status: string | null
          tax_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_subtype?: string | null
          account_type?: string | null
          classification?: string | null
          created_at?: string | null
          currency_id?: string | null
          current_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_sub_account?: boolean | null
          last_sync_at?: string | null
          name: string
          number?: string | null
          opening_balance?: number | null
          opening_balance_date?: string | null
          organization_id: string
          parent_account_id?: string | null
          qbo_id?: string | null
          sync_status?: string | null
          tax_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_subtype?: string | null
          account_type?: string | null
          classification?: string | null
          created_at?: string | null
          currency_id?: string | null
          current_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_sub_account?: boolean | null
          last_sync_at?: string | null
          name?: string
          number?: string | null
          opening_balance?: number | null
          opening_balance_date?: string | null
          organization_id?: string
          parent_account_id?: string | null
          qbo_id?: string | null
          sync_status?: string | null
          tax_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_record_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_record_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "account_record"
            referencedColumns: ["id"]
          },
        ]
      }
      account_transaction: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string | null
          description: string | null
          id: string
          last_sync_at: string | null
          memo: string | null
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_transaction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_record"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string | null
          description: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          organization_id: string
          storage_path: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          organization_id: string
          storage_path?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string
          storage_path?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          created_at: string | null
          detail: Json | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          portal_user_id: string | null
          severity: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          portal_user_id?: string | null
          severity?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          portal_user_id?: string | null
          severity?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_entries: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          change_timestamp: string
          changed_by: string | null
          id: string
          operation: string
          organization_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          change_timestamp?: string
          changed_by?: string | null
          id?: string
          operation: string
          organization_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          change_timestamp?: string
          changed_by?: string | null
          id?: string
          operation?: string
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      batch_job_queue: {
        Row: {
          actual_duration_seconds: number | null
          can_cancel: boolean | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          errors: Json | null
          estimated_duration_seconds: number | null
          failed_items: number | null
          id: string
          job_config: Json | null
          job_data: Json
          job_type: string
          last_error: string | null
          max_retries: number | null
          organization_id: string
          processed_items: number | null
          progress_log: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          successful_items: number | null
          total_items: number
          updated_at: string | null
        }
        Insert: {
          actual_duration_seconds?: number | null
          can_cancel?: boolean | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          errors?: Json | null
          estimated_duration_seconds?: number | null
          failed_items?: number | null
          id?: string
          job_config?: Json | null
          job_data: Json
          job_type: string
          last_error?: string | null
          max_retries?: number | null
          organization_id: string
          processed_items?: number | null
          progress_log?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          successful_items?: number | null
          total_items: number
          updated_at?: string | null
        }
        Update: {
          actual_duration_seconds?: number | null
          can_cancel?: boolean | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          errors?: Json | null
          estimated_duration_seconds?: number | null
          failed_items?: number | null
          id?: string
          job_config?: Json | null
          job_data?: Json
          job_type?: string
          last_error?: string | null
          max_retries?: number | null
          organization_id?: string
          processed_items?: number | null
          progress_log?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          successful_items?: number | null
          total_items?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_job_queue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_job_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_processing_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          job_type: string
          max_retries: number | null
          organization_id: string
          payload: Json
          priority: number | null
          result: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_retries?: number | null
          organization_id: string
          payload: Json
          priority?: number | null
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_retries?: number | null
          organization_id?: string
          payload?: Json
          priority?: number | null
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_processing_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_line_item: {
        Row: {
          amount: number | null
          bill_id: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          id: string
          item_id: string | null
          last_sync_at: string | null
          organization_id: string
          position: number | null
          quantity: number
          rate: number
          tax_amount: number | null
          tax_code: string | null
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          bill_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          organization_id: string
          position?: number | null
          quantity: number
          rate: number
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          bill_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          organization_id?: string
          position?: number | null
          quantity?: number
          rate?: number
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_line_item_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_line_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_record: {
        Row: {
          balance_due: number | null
          bill_date: string | null
          bill_number: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          due_date: string | null
          id: string
          last_sync_at: string | null
          memo: string | null
          organization_id: string
          qbo_id: string | null
          qbo_sync_status: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          total: number | null
          updated_at: string | null
          updated_by: string | null
          vendor_id: string | null
        }
        Insert: {
          balance_due?: number | null
          bill_date?: string | null
          bill_number?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          due_date?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id: string
          qbo_id?: string | null
          qbo_sync_status?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string | null
        }
        Update: {
          balance_due?: number | null
          bill_date?: string | null
          bill_number?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          due_date?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id?: string
          qbo_id?: string | null
          qbo_sync_status?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_record_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_record_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_record_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          ip_address: string | null
          operation_type: string | null
          organization_id: string
          record_id: string
          table_name: string
          timestamp: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          operation_type?: string | null
          organization_id: string
          record_id: string
          table_name: string
          timestamp?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          operation_type?: string | null
          organization_id?: string
          record_id?: string
          table_name?: string
          timestamp?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_memo_record: {
        Row: {
          created_at: string | null
          customer_id: string | null
          customer_ref: string | null
          id: string
          organization_id: string | null
          private_note: string | null
          qbo_id: string | null
          total_amount: number | null
          txn_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_memo_record_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memo_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          symbol: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          is_active?: boolean | null
          name: string
          organization_id: string
          symbol?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          symbol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_role_permissions: {
        Row: {
          created_at: string | null
          custom_role_id: string | null
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["role_permission"]
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          custom_role_id?: string | null
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["role_permission"]
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          custom_role_id?: string | null
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["role_permission"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["user_role"]
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          base_role: Database["public"]["Enums"]["user_role"]
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          base_role?: Database["public"]["Enums"]["user_role"]
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_item_price: {
        Row: {
          created_at: string
          custom_price: number
          customer_id: string
          end_date: string | null
          id: string
          item_id: string
          organization_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_price: number
          customer_id: string
          end_date?: string | null
          id?: string
          item_id: string
          organization_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_price?: number
          customer_id?: string
          end_date?: string | null
          id?: string
          item_id?: string
          organization_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_item_price_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_item_price_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_item_price_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_messages: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          message: string
          organization_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          message: string
          organization_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          message?: string
          organization_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_methods: {
        Row: {
          billing_name: string | null
          card_brand: string | null
          created_at: string
          customer_id: string
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean | null
          last_four: string | null
          organization_id: string
          payment_type: string
          provider_id: string | null
          updated_at: string
        }
        Insert: {
          billing_name?: string | null
          card_brand?: string | null
          created_at?: string
          customer_id: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          organization_id: string
          payment_type: string
          provider_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_name?: string | null
          card_brand?: string | null
          created_at?: string
          customer_id?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          organization_id?: string
          payment_type?: string
          provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_user_links: {
        Row: {
          created_at: string | null
          customer_id: string
          email_verified: boolean
          id: string
          last_login_at: string | null
          organization_id: string
          portal_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email_verified?: boolean
          id?: string
          last_login_at?: string | null
          organization_id: string
          portal_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email_verified?: boolean
          id?: string
          last_login_at?: string | null
          organization_id?: string
          portal_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_user_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_price_level: {
        Row: {
          created_at: string
          discount_percentage: number | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_price_level_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profile: {
        Row: {
          balance: number | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          currency_id: string | null
          custom_fields: Json | null
          display_name: string
          email: string | null
          fax: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          last_sync_at: string | null
          mobile: string | null
          notes: string | null
          organization_id: string
          payment_terms: string | null
          phone: string | null
          portal_enabled: boolean | null
          portal_invitation_sent_at: string | null
          qbo_id: string | null
          qbo_sync_status: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          source_system: string | null
          sync_status: string | null
          tax_exempt: boolean | null
          tax_id: string | null
          updated_at: string | null
          updated_by: string | null
          website: string | null
        }
        Insert: {
          balance?: number | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          currency_id?: string | null
          custom_fields?: Json | null
          display_name: string
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          last_sync_at?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id: string
          payment_terms?: string | null
          phone?: string | null
          portal_enabled?: boolean | null
          portal_invitation_sent_at?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          source_system?: string | null
          sync_status?: string | null
          tax_exempt?: boolean | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          balance?: number | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          currency_id?: string | null
          custom_fields?: Json | null
          display_name?: string
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          last_sync_at?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id?: string
          payment_terms?: string | null
          phone?: string | null
          portal_enabled?: boolean | null
          portal_invitation_sent_at?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          source_system?: string | null
          sync_status?: string | null
          tax_exempt?: boolean | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profile_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_template_items: {
        Row: {
          created_at: string
          friday_qty: number
          id: string
          item_id: string
          monday_qty: number
          organization_id: string
          saturday_qty: number
          sunday_qty: number
          template_id: string
          thursday_qty: number
          tuesday_qty: number
          unit_measure: string
          unit_price: number
          updated_at: string
          wednesday_qty: number
        }
        Insert: {
          created_at?: string
          friday_qty?: number
          id?: string
          item_id: string
          monday_qty?: number
          organization_id: string
          saturday_qty?: number
          sunday_qty?: number
          template_id: string
          thursday_qty?: number
          tuesday_qty?: number
          unit_measure?: string
          unit_price?: number
          updated_at?: string
          wednesday_qty?: number
        }
        Update: {
          created_at?: string
          friday_qty?: number
          id?: string
          item_id?: string
          monday_qty?: number
          organization_id?: string
          saturday_qty?: number
          sunday_qty?: number
          template_id?: string
          thursday_qty?: number
          tuesday_qty?: number
          unit_measure?: string
          unit_price?: number
          updated_at?: string
          wednesday_qty?: number
        }
        Relationships: []
      }
      customer_templates: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_profile: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          display_name: string | null
          email: string | null
          employment_type: string | null
          first_name: string
          gender: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          last_name: string
          last_sync_at: string | null
          middle_name: string | null
          mobile: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          qbo_id: string | null
          release_date: string | null
          ssn: string | null
          state: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          display_name?: string | null
          email?: string | null
          employment_type?: string | null
          first_name: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          last_name: string
          last_sync_at?: string | null
          middle_name?: string | null
          mobile?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          qbo_id?: string | null
          release_date?: string | null
          ssn?: string | null
          state?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          display_name?: string | null
          email?: string | null
          employment_type?: string | null
          first_name?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          last_sync_at?: string | null
          middle_name?: string | null
          mobile?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          qbo_id?: string | null
          release_date?: string | null
          ssn?: string | null
          state?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_tracking: {
        Row: {
          billable: boolean | null
          billable_rate: number | null
          break_time: number | null
          created_at: string | null
          customer_id: string | null
          date: string
          description: string | null
          employee_id: string | null
          end_time: string | null
          hours: number
          id: string
          last_sync_at: string | null
          organization_id: string
          qbo_id: string | null
          service_item_id: string | null
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          billable?: boolean | null
          billable_rate?: number | null
          break_time?: number | null
          created_at?: string | null
          customer_id?: string | null
          date: string
          description?: string | null
          employee_id?: string | null
          end_time?: string | null
          hours: number
          id?: string
          last_sync_at?: string | null
          organization_id: string
          qbo_id?: string | null
          service_item_id?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          billable?: boolean | null
          billable_rate?: number | null
          break_time?: number | null
          created_at?: string | null
          customer_id?: string | null
          date?: string
          description?: string | null
          employee_id?: string | null
          end_time?: string | null
          hours?: number
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          qbo_id?: string | null
          service_item_id?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_tracking_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_tracking_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          tag_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          tag_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          tag_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_record: {
        Row: {
          created_at: string | null
          customer_id: string | null
          customer_ref: string | null
          expiry_date: string | null
          id: string
          organization_id: string | null
          private_note: string | null
          qbo_id: string | null
          total_amount: number | null
          txn_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          expiry_date?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          expiry_date?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_record_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_metrics: {
        Row: {
          created_at: string
          id: string
          is_forecasted: boolean
          metric_type: string
          metric_value: number
          organization_id: string
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_forecasted?: boolean
          metric_type: string
          metric_value: number
          organization_id: string
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_forecasted?: boolean
          metric_type?: string
          metric_value?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_item: {
        Row: {
          amount: number | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          discount_amount: number | null
          discount_rate: number | null
          id: string
          invoice_id: string | null
          item_id: string | null
          last_sync_at: string | null
          organization_id: string
          position: number | null
          quantity: number
          tax_amount: number | null
          tax_code: string | null
          tax_rate: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          discount_amount?: number | null
          discount_rate?: number | null
          id?: string
          invoice_id?: string | null
          item_id?: string | null
          last_sync_at?: string | null
          organization_id: string
          position?: number | null
          quantity: number
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          discount_amount?: number | null
          discount_rate?: number | null
          id?: string
          invoice_id?: string | null
          item_id?: string | null
          last_sync_at?: string | null
          organization_id?: string
          position?: number | null
          quantity?: number
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_line_item_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_item_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_sequences: {
        Row: {
          created_at: string
          next_number: number
          organization_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          next_number?: number
          organization_id: string
          prefix?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          next_number?: number
          organization_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_record: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          balance_due: number | null
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          custom_fields: Json | null
          customer_id: string | null
          customer_po_number: string | null
          delivery_date: string | null
          discount_rate: number | null
          discount_total: number | null
          discount_type: string | null
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          is_no_order: boolean | null
          last_sync_at: string | null
          memo: string | null
          message: string | null
          order_date: string | null
          organization_id: string
          po_number: string | null
          promised_ship_date: string | null
          qbo_id: string | null
          qbo_sync_status: string | null
          requested_ship_date: string | null
          ship_date: string | null
          shipping_method: string | null
          shipping_total: number | null
          shipping_tracking: string | null
          source_sync_operation_id: string | null
          source_system: string | null
          status: string | null
          subtotal: number | null
          sync_status: string | null
          tax_total: number | null
          terms: string | null
          total: number | null
          updated_at: string | null
          updated_by: string | null
          updated_by_user_id: string | null
          updated_source: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_po_number?: string | null
          delivery_date?: string | null
          discount_rate?: number | null
          discount_total?: number | null
          discount_type?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_no_order?: boolean | null
          last_sync_at?: string | null
          memo?: string | null
          message?: string | null
          order_date?: string | null
          organization_id: string
          po_number?: string | null
          promised_ship_date?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          requested_ship_date?: string | null
          ship_date?: string | null
          shipping_method?: string | null
          shipping_total?: number | null
          shipping_tracking?: string | null
          source_sync_operation_id?: string | null
          source_system?: string | null
          status?: string | null
          subtotal?: number | null
          sync_status?: string | null
          tax_total?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          updated_source?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_po_number?: string | null
          delivery_date?: string | null
          discount_rate?: number | null
          discount_total?: number | null
          discount_type?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_no_order?: boolean | null
          last_sync_at?: string | null
          memo?: string | null
          message?: string | null
          order_date?: string | null
          organization_id?: string
          po_number?: string | null
          promised_ship_date?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          requested_ship_date?: string | null
          ship_date?: string | null
          shipping_method?: string | null
          shipping_total?: number | null
          shipping_tracking?: string | null
          source_sync_operation_id?: string | null
          source_system?: string | null
          status?: string | null
          subtotal?: number | null
          sync_status?: string | null
          tax_total?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          updated_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_record_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_record_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_record_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_record_source_sync_operation_id_fkey"
            columns: ["source_sync_operation_id"]
            isOneToOne: false
            referencedRelation: "qbo_sync_operation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_record_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_inventory: {
        Row: {
          average_cost: number | null
          created_at: string | null
          id: string
          item_id: string | null
          last_inventory_date: string | null
          last_sync_at: string | null
          location: string | null
          organization_id: string
          quantity_available: number | null
          quantity_on_hand: number | null
          quantity_on_order: number | null
          quantity_reserved: number | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          average_cost?: number | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          last_inventory_date?: string | null
          last_sync_at?: string | null
          location?: string | null
          organization_id: string
          quantity_available?: number | null
          quantity_on_hand?: number | null
          quantity_on_order?: number | null
          quantity_reserved?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          average_cost?: number | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          last_inventory_date?: string | null
          last_sync_at?: string | null
          location?: string | null
          organization_id?: string
          quantity_available?: number | null
          quantity_on_hand?: number | null
          quantity_on_order?: number | null
          quantity_reserved?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
        ]
      }
      item_pricing: {
        Row: {
          created_at: string | null
          currency_id: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          item_id: string | null
          organization_id: string
          price: number
          price_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency_id?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          item_id?: string | null
          organization_id: string
          price: number
          price_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency_id?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          item_id?: string | null
          organization_id?: string
          price?: number
          price_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pricing_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pricing_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
        ]
      }
      item_record: {
        Row: {
          asset_account_id: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          expense_account_id: string | null
          id: string
          income_account_id: string | null
          is_active: boolean | null
          is_taxable: boolean | null
          item_type: string | null
          last_sync_at: string | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          name: string
          organization_id: string
          purchase_cost: number | null
          purchase_description: string | null
          qbo_id: string | null
          qbo_sync_status: string | null
          reorder_point: number | null
          size: string | null
          size_unit: string | null
          sku: string | null
          source_system: string | null
          sync_status: string | null
          tax_code: string | null
          tax_rate: number | null
          updated_at: string | null
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          asset_account_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          is_active?: boolean | null
          is_taxable?: boolean | null
          item_type?: string | null
          last_sync_at?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          name: string
          organization_id: string
          purchase_cost?: number | null
          purchase_description?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          reorder_point?: number | null
          size?: string | null
          size_unit?: string | null
          sku?: string | null
          source_system?: string | null
          sync_status?: string | null
          tax_code?: string | null
          tax_rate?: number | null
          updated_at?: string | null
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          asset_account_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          is_active?: boolean | null
          is_taxable?: boolean | null
          item_type?: string | null
          last_sync_at?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          name?: string
          organization_id?: string
          purchase_cost?: number | null
          purchase_description?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          reorder_point?: number | null
          size?: string | null
          size_unit?: string | null
          sku?: string | null
          source_system?: string | null
          sync_status?: string | null
          tax_code?: string | null
          tax_rate?: number | null
          updated_at?: string | null
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_record_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "account_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_record_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "account_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_record_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "account_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_line_item: {
        Row: {
          account_ref: string | null
          amount: number | null
          created_at: string
          description: string | null
          id: string
          journal_entry_id: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          account_ref?: string | null
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          account_ref?: string | null
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_line_item_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_line_item_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_record: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          private_note: string | null
          qbo_id: string | null
          total_amount: number | null
          txn_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          name: string
          plan_type: string | null
          qbo_access_token: string | null
          qbo_company_id: string | null
          qbo_realm_id: string | null
          qbo_refresh_token: string | null
          qbo_token_expires_at: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name: string
          plan_type?: string | null
          qbo_access_token?: string | null
          qbo_company_id?: string | null
          qbo_realm_id?: string | null
          qbo_refresh_token?: string | null
          qbo_token_expires_at?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name?: string
          plan_type?: string | null
          qbo_access_token?: string | null
          qbo_company_id?: string | null
          qbo_realm_id?: string | null
          qbo_refresh_token?: string | null
          qbo_token_expires_at?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_receipt: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          custom_fields: Json | null
          customer_id: string | null
          deposit_account_id: string | null
          exchange_rate: number | null
          external_payment_id: string | null
          id: string
          last_sync_at: string | null
          memo: string | null
          organization_id: string
          payment_date: string | null
          payment_gateway: string | null
          payment_link_url: string | null
          payment_method: string | null
          payment_number: string | null
          payment_status: string | null
          process_payment: boolean | null
          qbo_id: string | null
          qbo_sync_status: string | null
          reference_number: string | null
          source_system: string | null
          sync_status: string | null
          total_amount: number
          unapplied_amount: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          deposit_account_id?: string | null
          exchange_rate?: number | null
          external_payment_id?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id: string
          payment_date?: string | null
          payment_gateway?: string | null
          payment_link_url?: string | null
          payment_method?: string | null
          payment_number?: string | null
          payment_status?: string | null
          process_payment?: boolean | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          reference_number?: string | null
          source_system?: string | null
          sync_status?: string | null
          total_amount: number
          unapplied_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          deposit_account_id?: string | null
          exchange_rate?: number | null
          external_payment_id?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_gateway?: string | null
          payment_link_url?: string | null
          payment_method?: string | null
          payment_number?: string | null
          payment_status?: string | null
          process_payment?: boolean | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          reference_number?: string | null
          source_system?: string | null
          sync_status?: string | null
          total_amount?: number
          unapplied_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipt_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipt_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipt_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipt_deposit_account_id_fkey"
            columns: ["deposit_account_id"]
            isOneToOne: false
            referencedRelation: "account_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipt_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipt_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          affected_role: Database["public"]["Enums"]["user_role"] | null
          affected_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_value: boolean
          organization_id: string
          previous_value: boolean | null
          resource: Database["public"]["Enums"]["permission_resource"]
          timestamp: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          affected_role?: Database["public"]["Enums"]["user_role"] | null
          affected_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value: boolean
          organization_id: string
          previous_value?: boolean | null
          resource: Database["public"]["Enums"]["permission_resource"]
          timestamp?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          affected_role?: Database["public"]["Enums"]["user_role"] | null
          affected_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: boolean
          organization_id?: string
          previous_value?: boolean | null
          resource?: Database["public"]["Enums"]["permission_resource"]
          timestamp?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      portal_impersonation_tokens: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          expires_at: string
          id: string
          last_used_at: string | null
          organization_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          organization_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          organization_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_impersonation_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_impersonation_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_order: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          custom_fields: Json | null
          exchange_rate: number | null
          expected_date: string | null
          id: string
          last_sync_at: string | null
          memo: string | null
          organization_id: string
          po_date: string | null
          purchase_order_number: string | null
          qbo_id: string | null
          ship_to: string | null
          status: string | null
          sync_status: string | null
          total: number | null
          updated_at: string | null
          updated_by: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          exchange_rate?: number | null
          expected_date?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id: string
          po_date?: string | null
          purchase_order_number?: string | null
          qbo_id?: string | null
          ship_to?: string | null
          status?: string | null
          sync_status?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          exchange_rate?: number | null
          expected_date?: string | null
          id?: string
          last_sync_at?: string | null
          memo?: string | null
          organization_id?: string
          po_date?: string | null
          purchase_order_number?: string | null
          qbo_id?: string | null
          ship_to?: string | null
          status?: string | null
          sync_status?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_line_item: {
        Row: {
          amount: number | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          id: string
          item_id: string | null
          last_sync_at: string | null
          organization_id: string
          position: number | null
          purchase_order_id: string | null
          quantity: number
          rate: number
          tax_amount: number | null
          tax_code: string | null
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          organization_id: string
          position?: number | null
          purchase_order_id?: string | null
          quantity: number
          rate: number
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          organization_id?: string
          position?: number | null
          purchase_order_id?: string | null
          quantity?: number
          rate?: number
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_line_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_line_item_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_connection: {
        Row: {
          created_at: string | null
          environment: string
          id: string
          is_active: boolean | null
          last_connected_at: string | null
          last_sync_at: string | null
          organization_id: string
          qbo_access_token: string | null
          qbo_company_id: string
          qbo_realm_id: string
          qbo_refresh_token: string | null
          qbo_token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          last_sync_at?: string | null
          organization_id: string
          qbo_access_token?: string | null
          qbo_company_id: string
          qbo_realm_id: string
          qbo_refresh_token?: string | null
          qbo_token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          last_sync_at?: string | null
          organization_id?: string
          qbo_access_token?: string | null
          qbo_company_id?: string
          qbo_realm_id?: string
          qbo_refresh_token?: string | null
          qbo_token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_connection_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_entity_config: {
        Row: {
          batch_size: number | null
          created_at: string | null
          dependency_order: number | null
          entity_type: string
          id: string
          is_enabled: boolean | null
          organization_id: string
          priority_level: number | null
          sync_direction: string
          sync_frequency_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          batch_size?: number | null
          created_at?: string | null
          dependency_order?: number | null
          entity_type: string
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          priority_level?: number | null
          sync_direction?: string
          sync_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_size?: number | null
          created_at?: string | null
          dependency_order?: number | null
          entity_type?: string
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          priority_level?: number | null
          sync_direction?: string
          sync_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_entity_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_entity_dependencies: {
        Row: {
          created_at: string | null
          depends_on_entity: string
          entity_type: string
          id: string
          is_required: boolean | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          depends_on_entity: string
          entity_type: string
          id?: string
          is_required?: boolean | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          depends_on_entity?: string
          entity_type?: string
          id?: string
          is_required?: boolean | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_entity_dependencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_entity_mapping: {
        Row: {
          batchly_id: string
          created_at: string | null
          entity_type: string
          id: string
          last_batchly_update: string | null
          last_qbo_update: string | null
          organization_id: string
          qbo_id: string
          updated_at: string | null
        }
        Insert: {
          batchly_id: string
          created_at?: string | null
          entity_type: string
          id?: string
          last_batchly_update?: string | null
          last_qbo_update?: string | null
          organization_id: string
          qbo_id: string
          updated_at?: string | null
        }
        Update: {
          batchly_id?: string
          created_at?: string | null
          entity_type?: string
          id?: string
          last_batchly_update?: string | null
          last_qbo_update?: string | null
          organization_id?: string
          qbo_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_entity_mapping_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_error_registry: {
        Row: {
          created_at: string | null
          error_category: string
          error_code: string | null
          error_message: string
          id: string
          is_resolved: boolean | null
          last_occurred_at: string | null
          occurrence_count: number | null
          organization_id: string
          suggested_resolution: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_category: string
          error_code?: string | null
          error_message: string
          id?: string
          is_resolved?: boolean | null
          last_occurred_at?: string | null
          occurrence_count?: number | null
          organization_id: string
          suggested_resolution?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_category?: string
          error_code?: string | null
          error_message?: string
          id?: string
          is_resolved?: boolean | null
          last_occurred_at?: string | null
          occurrence_count?: number | null
          organization_id?: string
          suggested_resolution?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_error_registry_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_field_mapping: {
        Row: {
          batchly_field: string
          created_at: string | null
          entity_type: string
          id: string
          is_enabled: boolean | null
          organization_id: string
          qbo_field: string
          transformation_config: Json | null
          transformation_type: string | null
          updated_at: string | null
        }
        Insert: {
          batchly_field: string
          created_at?: string | null
          entity_type: string
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          qbo_field: string
          transformation_config?: Json | null
          transformation_type?: string | null
          updated_at?: string | null
        }
        Update: {
          batchly_field?: string
          created_at?: string | null
          entity_type?: string
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          qbo_field?: string
          transformation_config?: Json | null
          transformation_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_field_mapping_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_batch: {
        Row: {
          batch_id: string
          completed_at: string | null
          created_at: string | null
          entity_type: string
          failure_count: number | null
          id: string
          operation_count: number | null
          organization_id: string
          started_at: string | null
          status: string
          success_count: number | null
          updated_at: string | null
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          created_at?: string | null
          entity_type: string
          failure_count?: number | null
          id?: string
          operation_count?: number | null
          organization_id: string
          started_at?: string | null
          status?: string
          success_count?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          created_at?: string | null
          entity_type?: string
          failure_count?: number | null
          id?: string
          operation_count?: number | null
          organization_id?: string
          started_at?: string | null
          status?: string
          success_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_batch_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_history: {
        Row: {
          completed_at: string | null
          created_at: string
          entity_count: number | null
          entity_types: string[] | null
          error_summary: string | null
          failure_count: number | null
          id: string
          organization_id: string
          started_at: string | null
          started_by: string | null
          status: string
          success_count: number | null
          summary: Json | null
          sync_type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entity_count?: number | null
          entity_types?: string[] | null
          error_summary?: string | null
          failure_count?: number | null
          id?: string
          organization_id: string
          started_at?: string | null
          started_by?: string | null
          status: string
          success_count?: number | null
          summary?: Json | null
          sync_type: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entity_count?: number | null
          entity_types?: string[] | null
          error_summary?: string | null
          failure_count?: number | null
          id?: string
          organization_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          success_count?: number | null
          summary?: Json | null
          sync_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_metrics: {
        Row: {
          avg_time_per_entity_ms: number | null
          created_at: string
          entity_type: string
          failure_count: number | null
          id: string
          operation_count: number | null
          organization_id: string
          rate_limit_hits: number | null
          recorded_at: string | null
          success_count: number | null
          sync_direction: string
          total_time_ms: number | null
          updated_at: string
        }
        Insert: {
          avg_time_per_entity_ms?: number | null
          created_at?: string
          entity_type: string
          failure_count?: number | null
          id?: string
          operation_count?: number | null
          organization_id: string
          rate_limit_hits?: number | null
          recorded_at?: string | null
          success_count?: number | null
          sync_direction: string
          total_time_ms?: number | null
          updated_at?: string
        }
        Update: {
          avg_time_per_entity_ms?: number | null
          created_at?: string
          entity_type?: string
          failure_count?: number | null
          id?: string
          operation_count?: number | null
          organization_id?: string
          rate_limit_hits?: number | null
          recorded_at?: string | null
          success_count?: number | null
          sync_direction?: string
          total_time_ms?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_operation: {
        Row: {
          completed_at: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          operation_id: string
          operation_type: string
          organization_id: string
          qbo_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          retry_count: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          sync_direction: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          operation_id: string
          operation_type: string
          organization_id: string
          qbo_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          sync_direction: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          operation_id?: string
          operation_type?: string
          organization_id?: string
          qbo_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          sync_direction?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_operation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_queue: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          max_retries: number
          operation_type: string
          organization_id: string
          payload: Json | null
          priority: number
          processed_at: string | null
          retry_count: number
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          max_retries?: number
          operation_type: string
          organization_id: string
          payload?: Json | null
          priority?: number
          processed_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          operation_type?: string
          organization_id?: string
          payload?: Json | null
          priority?: number
          processed_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_webhook_events: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          event_data: Json | null
          event_type: string
          id: string
          is_processed: boolean | null
          organization_id: string
          processed_at: string | null
          updated_at: string
          webhook_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          event_data?: Json | null
          event_type: string
          id?: string
          is_processed?: boolean | null
          organization_id: string
          processed_at?: string | null
          updated_at?: string
          webhook_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          is_processed?: boolean | null
          organization_id?: string
          processed_at?: string | null
          updated_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_webhook_handler_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          payload: Json
          processed_at: string | null
          processing_status: string
          received_at: string
          updated_at: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          payload: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          updated_at?: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          updated_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_webhook_handler_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permission_mapping: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["role_permission"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["role_permission"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["role_permission"]
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          allowed: boolean
          created_at: string
          id: string
          organization_id: string
          resource: Database["public"]["Enums"]["permission_resource"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          allowed?: boolean
          created_at?: string
          id?: string
          organization_id: string
          resource: Database["public"]["Enums"]["permission_resource"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          allowed?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          resource?: Database["public"]["Enums"]["permission_resource"]
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_order: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_from_template: boolean | null
          customer_id: string
          delivery_date: string
          discount_total: number | null
          id: string
          invoice_id: string | null
          invoiced: boolean | null
          is_no_order_today: boolean | null
          memo: string | null
          order_date: string
          order_number: string
          organization_id: string
          shipping_total: number | null
          status: string | null
          subtotal: number | null
          tax_total: number | null
          template_id: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_from_template?: boolean | null
          customer_id: string
          delivery_date: string
          discount_total?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          is_no_order_today?: boolean | null
          memo?: string | null
          order_date?: string
          order_number: string
          organization_id: string
          shipping_total?: number | null
          status?: string | null
          subtotal?: number | null
          tax_total?: number | null
          template_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_from_template?: boolean | null
          customer_id?: string
          delivery_date?: string
          discount_total?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          is_no_order_today?: boolean | null
          memo?: string | null
          order_date?: string
          order_number?: string
          organization_id?: string
          shipping_total?: number | null
          status?: string | null
          subtotal?: number | null
          tax_total?: number | null
          template_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_customer_id_fkey1"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_organization_id_fkey1"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_archived: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          custom_fields: Json | null
          customer_id: string | null
          customer_po_number: string | null
          delivery_date: string
          discount_rate: number | null
          discount_total: number | null
          discount_type: string | null
          exchange_rate: number | null
          id: string
          invoice_id: string | null
          invoiced: boolean
          is_no_order_today: boolean
          last_sync_at: string | null
          memo: string | null
          message: string | null
          order_date: string | null
          order_number: string | null
          organization_id: string
          promised_ship_date: string | null
          qbo_estimate_id: string | null
          requested_ship_date: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_method: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          shipping_terms: string | null
          shipping_total: number | null
          source_system: string | null
          status: string | null
          subtotal: number | null
          sync_status: string | null
          tax_total: number | null
          terms: string | null
          total: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_po_number?: string | null
          delivery_date?: string
          discount_rate?: number | null
          discount_total?: number | null
          discount_type?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          is_no_order_today?: boolean
          last_sync_at?: string | null
          memo?: string | null
          message?: string | null
          order_date?: string | null
          order_number?: string | null
          organization_id: string
          promised_ship_date?: string | null
          qbo_estimate_id?: string | null
          requested_ship_date?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          shipping_terms?: string | null
          shipping_total?: number | null
          source_system?: string | null
          status?: string | null
          subtotal?: number | null
          sync_status?: string | null
          tax_total?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_po_number?: string | null
          delivery_date?: string
          discount_rate?: number | null
          discount_total?: number | null
          discount_type?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          is_no_order_today?: boolean
          last_sync_at?: string | null
          memo?: string | null
          message?: string | null
          order_date?: string | null
          order_number?: string | null
          organization_id?: string
          promised_ship_date?: string | null
          qbo_estimate_id?: string | null
          requested_ship_date?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          shipping_terms?: string | null
          shipping_total?: number | null
          source_system?: string | null
          status?: string | null
          subtotal?: number | null
          sync_status?: string | null
          tax_total?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_fulfillment: {
        Row: {
          carrier: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          fulfillment_date: string | null
          fulfillment_number: string | null
          id: string
          last_sync_at: string | null
          notes: string | null
          organization_id: string
          sales_order_id: string | null
          shipping_method: string | null
          status: string | null
          sync_status: string | null
          tracking_number: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          fulfillment_date?: string | null
          fulfillment_number?: string | null
          id?: string
          last_sync_at?: string | null
          notes?: string | null
          organization_id: string
          sales_order_id?: string | null
          shipping_method?: string | null
          status?: string | null
          sync_status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          fulfillment_date?: string | null
          fulfillment_number?: string | null
          id?: string
          last_sync_at?: string | null
          notes?: string | null
          organization_id?: string
          sales_order_id?: string | null
          shipping_method?: string | null
          status?: string | null
          sync_status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_fulfillment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_fulfillment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_fulfillment_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order_archive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_fulfillment_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order_archived"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_fulfillment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_fulfillment_line: {
        Row: {
          created_at: string | null
          fulfillment_id: string | null
          id: string
          item_id: string | null
          last_sync_at: string | null
          location_id: string | null
          lot_number: string | null
          notes: string | null
          organization_id: string
          quantity: number
          sales_order_line_item_id: string | null
          serial_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fulfillment_id?: string | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          location_id?: string | null
          lot_number?: string | null
          notes?: string | null
          organization_id: string
          quantity: number
          sales_order_line_item_id?: string | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fulfillment_id?: string | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          location_id?: string | null
          lot_number?: string | null
          notes?: string | null
          organization_id?: string
          quantity?: number
          sales_order_line_item_id?: string | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_fulfillment_line_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "sales_order_fulfillment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_fulfillment_line_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_fulfillment_line_sales_order_line_item_id_fkey"
            columns: ["sales_order_line_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_line_item_archived"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_invoice_link: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          organization_id: string
          sales_order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          organization_id: string
          sales_order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          organization_id?: string
          sales_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_invoice_link_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_link_invoice_id_fkey1"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_link_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_link_sales_order_id_fkey1"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_invoice_link_archived: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_metadata: Json | null
          id: string
          invoice_id: string | null
          organization_id: string
          sales_order_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_metadata?: Json | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          sales_order_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_metadata?: Json | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          sales_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_invoice_link_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_link_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order_archive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_link_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order_archived"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_line_item: {
        Row: {
          amount: number | null
          created_at: string
          discount_amount: number | null
          discount_rate: number | null
          id: string
          item_id: string
          organization_id: string
          quantity: number
          quantity_fulfilled: number | null
          quantity_invoiced: number | null
          sales_order_id: string
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          discount_amount?: number | null
          discount_rate?: number | null
          id?: string
          item_id: string
          organization_id: string
          quantity?: number
          quantity_fulfilled?: number | null
          quantity_invoiced?: number | null
          sales_order_id: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          discount_amount?: number | null
          discount_rate?: number | null
          id?: string
          item_id?: string
          organization_id?: string
          quantity?: number
          quantity_fulfilled?: number | null
          quantity_invoiced?: number | null
          sales_order_id?: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_line_item_item_id_fkey1"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_line_item_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_line_item_sales_order_id_fkey1"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_line_item_archived: {
        Row: {
          amount: number | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          discount_amount: number | null
          discount_rate: number | null
          id: string
          item_id: string | null
          last_sync_at: string | null
          organization_id: string
          position: number | null
          quantity: number
          quantity_fulfilled: number | null
          quantity_invoiced: number | null
          sales_order_id: string | null
          tax_amount: number | null
          tax_code: string | null
          tax_rate: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          discount_amount?: number | null
          discount_rate?: number | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          organization_id: string
          position?: number | null
          quantity: number
          quantity_fulfilled?: number | null
          quantity_invoiced?: number | null
          sales_order_id?: string | null
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          discount_amount?: number | null
          discount_rate?: number | null
          id?: string
          item_id?: string | null
          last_sync_at?: string | null
          organization_id?: string
          position?: number | null
          quantity?: number
          quantity_fulfilled?: number | null
          quantity_invoiced?: number | null
          sales_order_id?: string | null
          tax_amount?: number | null
          tax_code?: string | null
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_line_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_line_item_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order_archive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_line_item_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order_archived"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_number_sequences: {
        Row: {
          last_number: number
          organization_id: string
          updated_at: string | null
          year: number
        }
        Insert: {
          last_number?: number
          organization_id: string
          updated_at?: string | null
          year: number
        }
        Update: {
          last_number?: number
          organization_id?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      sales_receipt_record: {
        Row: {
          created_at: string | null
          customer_id: string | null
          customer_ref: string | null
          id: string
          organization_id: string | null
          private_note: string | null
          qbo_id: string | null
          total_amount: number | null
          txn_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          id?: string
          organization_id?: string | null
          private_note?: string | null
          qbo_id?: string | null
          total_amount?: number | null
          txn_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_receipt_record_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_receipt_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          access_type: string
          accessed_column: string | null
          accessed_table: string
          id: string
          ip_address: unknown
          organization_id: string
          record_id: string | null
          sensitive_data_accessed: boolean | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_type: string
          accessed_column?: string | null
          accessed_table: string
          id?: string
          ip_address?: unknown
          organization_id: string
          record_id?: string | null
          sensitive_data_accessed?: boolean | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_type?: string
          accessed_column?: string | null
          accessed_table?: string
          id?: string
          ip_address?: unknown
          organization_id?: string
          record_id?: string | null
          sensitive_data_accessed?: boolean | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sync_error: {
        Row: {
          created_at: string | null
          entity_type: string
          error_code: string | null
          error_details: string | null
          error_message: string | null
          error_time: string | null
          http_status_code: number | null
          id: string
          organization_id: string
          qbo_endpoint: string | null
          record_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number | null
          sync_log_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          error_code?: string | null
          error_details?: string | null
          error_message?: string | null
          error_time?: string | null
          http_status_code?: number | null
          id?: string
          organization_id: string
          qbo_endpoint?: string | null
          record_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          sync_log_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          error_code?: string | null
          error_details?: string | null
          error_message?: string | null
          error_time?: string | null
          http_status_code?: number | null
          id?: string
          organization_id?: string
          qbo_endpoint?: string | null
          record_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          sync_log_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_error_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_error_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_log"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_function_control: {
        Row: {
          created_at: string
          finished_at: string | null
          function_name: string | null
          id: string
          log: string | null
          run_id: string | null
          started_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          function_name?: string | null
          id?: string
          log?: string | null
          run_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          function_name?: string | null
          id?: string
          log?: string | null
          run_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          notes: string | null
          organization_id: string
          records_created: number | null
          records_deleted: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          start_time: string | null
          status: string | null
          sync_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          records_created?: number | null
          records_deleted?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          start_time?: string | null
          status?: string | null
          sync_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          records_created?: number | null
          records_deleted?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          start_time?: string | null
          status?: string | null
          sync_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          created_at: string | null
          end_time: string | null
          entity_type: string
          id: string
          organization_id: string
          records_created: number | null
          records_deleted: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          start_time: string | null
          status: string | null
          sync_log_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          entity_type: string
          id?: string
          organization_id: string
          records_created?: number | null
          records_deleted?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          start_time?: string | null
          status?: string | null
          sync_log_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          records_created?: number | null
          records_deleted?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          start_time?: string | null
          status?: string | null
          sync_log_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_status_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_log"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_agency: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          registration_number: string | null
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          registration_number?: string | null
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          registration_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_agency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_code: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          organization_id: string
          qbo_id: string | null
          rate: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          organization_id: string
          qbo_id?: string | null
          rate?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          qbo_id?: string | null
          rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_code_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rate: {
        Row: {
          agency_id: string | null
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          is_combined: boolean | null
          name: string
          organization_id: string
          rate_value: number
          tax_code_id: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_combined?: boolean | null
          name: string
          organization_id: string
          rate_value: number
          tax_code_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_combined?: boolean | null
          name?: string
          organization_id?: string
          rate_value?: number
          tax_code_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rate_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "tax_agency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rate_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_code"
            referencedColumns: ["id"]
          },
        ]
      }
      time_activity_record: {
        Row: {
          billable: boolean | null
          created_at: string | null
          customer_id: string | null
          customer_ref: string | null
          description: string | null
          employee_id: string | null
          employee_ref: string | null
          end_time: string | null
          hours: number | null
          id: string
          organization_id: string | null
          qbo_id: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          billable?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          description?: string | null
          employee_id?: string | null
          employee_ref?: string | null
          end_time?: string | null
          hours?: number | null
          id?: string
          organization_id?: string | null
          qbo_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          billable?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          customer_ref?: string | null
          description?: string | null
          employee_id?: string | null
          employee_ref?: string | null
          end_time?: string | null
          hours?: number | null
          id?: string
          organization_id?: string | null
          qbo_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_activity_record_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_activity_record_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_activity_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          organization_id: string
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          organization_id: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          organization_id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          allowed: boolean
          created_at: string
          granted_by: string | null
          id: string
          organization_id: string
          resource: Database["public"]["Enums"]["permission_resource"]
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          allowed: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          resource: Database["public"]["Enums"]["permission_resource"]
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          allowed?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          resource?: Database["public"]["Enums"]["permission_resource"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          organization_id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vendor_profile: {
        Row: {
          account_number: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          custom_fields: Json | null
          display_name: string
          email: string | null
          fax: string | null
          first_name: string | null
          id: string
          is_1099: boolean | null
          is_active: boolean | null
          last_name: string | null
          last_sync_at: string | null
          mobile: string | null
          notes: string | null
          organization_id: string
          payment_terms: string | null
          phone: string | null
          qbo_id: string | null
          qbo_sync_status: string | null
          source_system: string | null
          sync_status: string | null
          tax_id: string | null
          updated_at: string | null
          updated_by: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          display_name: string
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          is_1099?: boolean | null
          is_active?: boolean | null
          last_name?: string | null
          last_sync_at?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id: string
          payment_terms?: string | null
          phone?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          source_system?: string | null
          sync_status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          display_name?: string
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          is_1099?: boolean | null
          is_active?: boolean | null
          last_name?: string | null
          last_sync_at?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id?: string
          payment_terms?: string | null
          phone?: string | null
          qbo_id?: string | null
          qbo_sync_status?: string | null
          source_system?: string | null
          sync_status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_profile_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_profile_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          organization_id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          received_at: string | null
          updated_at: string
          webhook_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          updated_at?: string
          webhook_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          updated_at?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      qbo_connection_safe: {
        Row: {
          created_at: string | null
          environment: string | null
          has_access_token: boolean | null
          has_refresh_token: boolean | null
          id: string | null
          is_active: boolean | null
          last_connected_at: string | null
          last_sync_at: string | null
          organization_id: string | null
          qbo_company_id: string | null
          qbo_realm_id: string | null
          qbo_token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          environment?: string | null
          has_access_token?: never
          has_refresh_token?: never
          id?: string | null
          is_active?: boolean | null
          last_connected_at?: string | null
          last_sync_at?: string | null
          organization_id?: string | null
          qbo_company_id?: string | null
          qbo_realm_id?: string | null
          qbo_token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          environment?: string | null
          has_access_token?: never
          has_refresh_token?: never
          id?: string | null
          is_active?: boolean | null
          last_connected_at?: string | null
          last_sync_at?: string | null
          organization_id?: string | null
          qbo_company_id?: string | null
          qbo_realm_id?: string | null
          qbo_token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_connection_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_archive_view: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archive_status: string | null
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          custom_fields: Json | null
          customer_id: string | null
          customer_po_number: string | null
          delivery_date: string | null
          discount_rate: number | null
          discount_total: number | null
          discount_type: string | null
          exchange_rate: number | null
          id: string | null
          invoice_id: string | null
          invoiced: boolean | null
          is_no_order_today: boolean | null
          last_sync_at: string | null
          memo: string | null
          message: string | null
          order_date: string | null
          order_number: string | null
          organization_id: string | null
          promised_ship_date: string | null
          qbo_estimate_id: string | null
          requested_ship_date: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_method: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          shipping_terms: string | null
          shipping_total: number | null
          source_system: string | null
          status: string | null
          subtotal: number | null
          sync_status: string | null
          tax_total: number | null
          terms: string | null
          total: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archive_status?: never
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_po_number?: string | null
          delivery_date?: string | null
          discount_rate?: number | null
          discount_total?: number | null
          discount_type?: string | null
          exchange_rate?: number | null
          id?: string | null
          invoice_id?: string | null
          invoiced?: boolean | null
          is_no_order_today?: boolean | null
          last_sync_at?: string | null
          memo?: string | null
          message?: string | null
          order_date?: string | null
          order_number?: string | null
          organization_id?: string | null
          promised_ship_date?: string | null
          qbo_estimate_id?: string | null
          requested_ship_date?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          shipping_terms?: string | null
          shipping_total?: number | null
          source_system?: string | null
          status?: string | null
          subtotal?: number | null
          sync_status?: string | null
          tax_total?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archive_status?: never
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_po_number?: string | null
          delivery_date?: string | null
          discount_rate?: number | null
          discount_total?: number | null
          discount_type?: string | null
          exchange_rate?: number | null
          id?: string | null
          invoice_id?: string | null
          invoiced?: boolean | null
          is_no_order_today?: boolean | null
          last_sync_at?: string | null
          memo?: string | null
          message?: string | null
          order_date?: string | null
          order_number?: string | null
          organization_id?: string | null
          promised_ship_date?: string | null
          qbo_estimate_id?: string | null
          requested_ship_date?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          shipping_terms?: string | null
          shipping_total?: number | null
          source_system?: string | null
          status?: string | null
          subtotal?: number | null
          sync_status?: string | null
          tax_total?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_sales_order: {
        Args: { p_approved_by: string; p_sales_order_id: string }
        Returns: undefined
      }
      batch_create_invoices_from_orders_archived: {
        Args: {
          p_due_days?: number
          p_invoice_date?: string
          p_sales_order_ids: string[]
          p_user_context?: Json
        }
        Returns: {
          error_message: string
          invoice_id: string
          sales_order_id: string
          success: boolean
        }[]
      }
      bulk_create_sales_orders_from_templates: {
        Args: { p_orders: Json }
        Returns: Json
      }
      bulk_update_invoice_status: {
        Args: {
          p_invoice_ids: string[]
          p_new_status: string
          p_updated_by: string
        }
        Returns: Json
      }
      calculate_sales_order_totals: {
        Args: { p_sales_order_id: string }
        Returns: {
          shipping_amount: number
          subtotal: number
          tax_amount: number
          total: number
        }[]
      }
      can_delete_sales_order: { Args: { order_id: string }; Returns: boolean }
      cancel_batch_job: {
        Args: { p_cancelled_by: string; p_job_id: string }
        Returns: undefined
      }
      cancel_bulk_invoice_job: { Args: { p_job_id: string }; Returns: boolean }
      cancel_invoice_order: {
        Args: { p_cancelled_by: string; p_invoice_id: string }
        Returns: undefined
      }
      check_duplicate_orders: {
        Args: {
          p_customer_id: string
          p_delivery_date: string
          p_exclude_order_id?: string
          p_organization_id: string
        }
        Returns: Json
      }
      check_duplicate_orders_batch: {
        Args: {
          p_customer_ids: string[]
          p_delivery_date: string
          p_organization_id: string
        }
        Returns: {
          customer_id: string
          has_duplicate: boolean
        }[]
      }
      check_user_is_admin: { Args: { check_user_id: string }; Returns: boolean }
      cleanup_stuck_batch_jobs: {
        Args: never
        Returns: {
          cleaned_jobs: number
          job_ids: string[]
        }[]
      }
      clear_all_invoices: { Args: { p_organization_id: string }; Returns: Json }
      complete_batch_job: {
        Args: { p_job_id: string; p_result?: Json }
        Returns: undefined
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_organization_id: string
        }
        Returns: string
      }
      create_bulk_invoice_job: {
        Args: {
          p_due_days?: number
          p_invoice_date?: string
          p_organization_id: string
          p_sales_order_ids: string[]
          p_user_context?: Json
        }
        Returns: string
      }
      create_invoice_atomic: {
        Args: {
          p_created_from_template?: boolean
          p_customer_id: string
          p_delivery_date: string
          p_invoice_number: string
          p_is_no_order?: boolean
          p_memo?: string
          p_order_date?: string
          p_organization_id: string
          p_status?: string
          p_template_id?: string
        }
        Returns: string
      }
      create_invoice_from_sales_order_archived: {
        Args: {
          p_due_days?: number
          p_invoice_date?: string
          p_sales_order_id: string
          p_user_context?: Json
        }
        Returns: string
      }
      create_invoice_from_sales_order_sql_archived: {
        Args: {
          p_created_by: string
          p_organization_id: string
          p_sales_order_id: string
        }
        Returns: string
      }
      create_sales_order_atomic:
        | {
            Args: {
              p_created_from_template?: boolean
              p_customer_id: string
              p_delivery_date: string
              p_is_no_order_today: boolean
              p_memo: string
              p_order_date: string
              p_organization_id: string
              p_status: string
              p_template_id?: string
            }
            Returns: {
              order_id: string
              order_number: string
            }[]
          }
        | {
            Args: {
              p_customer_id: string
              p_delivery_date: string
              p_is_no_order_today: boolean
              p_memo: string
              p_order_date: string
              p_organization_id: string
              p_status: string
            }
            Returns: {
              order_id: string
              order_number: string
            }[]
          }
      enqueue_batch_job: {
        Args: {
          p_job_type: string
          p_organization_id: string
          p_payload: Json
          p_priority?: number
        }
        Returns: string
      }
      fail_batch_job: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: undefined
      }
      generate_sales_order_number: { Args: { org_id: string }; Returns: string }
      generate_sales_orders_from_templates: {
        Args: {
          p_customer_id?: string
          p_date?: string
          p_organization_id?: string
          p_template_id?: string
        }
        Returns: Json
      }
      get_batch_processing_stats: { Args: never; Returns: Json }
      get_bulk_invoice_job_status: {
        Args: { p_job_id: string }
        Returns: {
          actual_duration_seconds: number
          completed_at: string
          created_at: string
          errors: Json
          failed_items: number
          job_id: string
          processed_items: number
          progress_percentage: number
          started_at: string
          status: string
          successful_items: number
          total_items: number
        }[]
      }
      get_customer_portal_status: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      get_next_batch_job: {
        Args: never
        Returns: {
          job_id: string
          job_type: string
          organization_id: string
          payload: Json
        }[]
      }
      get_next_invoice_number: {
        Args: { p_organization_id: string }
        Returns: string
      }
      get_next_order_number: {
        Args: { p_organization_id: string; p_year: number }
        Returns: string
      }
      get_portal_user_customer_id: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_qb_sync_status: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          is_synced: boolean
          last_sync_at: string
          needs_sync: boolean
          qb_id: string
          sync_errors: string
        }[]
      }
      get_qbo_connection_for_sync: {
        Args: { p_organization_id: string }
        Returns: {
          environment: string
          id: string
          is_active: boolean
          organization_id: string
          qbo_access_token: string
          qbo_company_id: string
          qbo_realm_id: string
          qbo_refresh_token: string
          qbo_token_expires_at: string
        }[]
      }
      get_qbo_connection_secure: {
        Args: { org_id: string }
        Returns: {
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          is_active: boolean
          last_connected_at: string
          last_sync_at: string
          organization_id: string
          qbo_company_id: string
          qbo_realm_id: string
        }[]
      }
      get_template_item_quantity_for_date: {
        Args: {
          friday_qty: number
          monday_qty: number
          saturday_qty: number
          sunday_qty: number
          target_date: string
          thursday_qty: number
          tuesday_qty: number
          wednesday_qty: number
        }
        Returns: number
      }
      get_user_organization_id: { Args: { user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_user_to_organization: {
        Args: {
          p_email: string
          p_organization_id: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      needs_qb_sync: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_organization_id: string
        }
        Returns: boolean
      }
      process_all_pending_batches: { Args: never; Returns: Json }
      process_bulk_invoice_job_sql: {
        Args: { p_job_id: string }
        Returns: Json
      }
      process_invoice_batch: { Args: { p_payload: Json }; Returns: Json }
      process_pending_batch_jobs: { Args: never; Returns: Json }
      qbo_enqueue_sync_operation: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_operation_type: string
          p_organization_id: string
          p_payload?: Json
          p_priority?: number
        }
        Returns: string
      }
      queue_qb_sync: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_operation?: string
          p_organization_id: string
          p_priority?: number
        }
        Returns: string
      }
      rollback_to_sales_order_model: { Args: never; Returns: string }
      setup_table_rls: { Args: { table_name: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_batch_job: { Args: { p_job_id: string }; Returns: undefined }
      trigger_batch_invoice_processing: { Args: never; Returns: Json }
      update_batch_job_progress: {
        Args: {
          p_errors?: Json
          p_failed: number
          p_job_id: string
          p_processed: number
          p_successful: number
        }
        Returns: undefined
      }
      update_qb_mapping: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_organization_id: string
          p_qb_id: string
          p_sync_token?: string
        }
        Returns: undefined
      }
      update_qbo_connection_tokens: {
        Args: {
          p_access_token: string
          p_organization_id: string
          p_refresh_token: string
          p_token_expires_at: string
        }
        Returns: undefined
      }
      user_has_permission:
        | {
            Args: {
              p_action: Database["public"]["Enums"]["permission_action"]
              p_resource: Database["public"]["Enums"]["permission_resource"]
              p_user_id: string
            }
            Returns: boolean
          }
        | { Args: { permission: string }; Returns: boolean }
      validate_customer_credit_limit: {
        Args: { p_customer_id: string; p_new_order_total?: number }
        Returns: {
          available_credit: number
          credit_limit: number
          current_outstanding: number
          is_valid: boolean
          would_exceed: boolean
        }[]
      }
      validate_inventory_availability: {
        Args: {
          p_item_id: string
          p_organization_id: string
          p_quantity: number
        }
        Returns: {
          available_quantity: number
          current_stock: number
          is_available: boolean
          reserved_quantity: number
          shortage: number
        }[]
      }
      validate_invoice_for_sending: {
        Args: { p_invoice_id: string }
        Returns: {
          is_valid: boolean
          validation_errors: string[]
        }[]
      }
      validate_order_before_invoice: {
        Args: { p_order_id: string }
        Returns: Json
      }
      validate_order_number_integrity: {
        Args: { p_organization_id: string; p_year?: number }
        Returns: {
          check_name: string
          details: string
          is_valid: boolean
          issue_count: number
        }[]
      }
      validate_order_numbers_simple: {
        Args: { p_organization_id: string; p_year?: number }
        Returns: {
          check_name: string
          details: string
          is_valid: boolean
          issue_count: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      permission_action: "create" | "read" | "update" | "delete" | "manage"
      permission_resource:
        | "users"
        | "customers"
        | "vendors"
        | "employees"
        | "inventory"
        | "items"
        | "sales_orders"
        | "purchase_orders"
        | "invoices"
        | "bills"
        | "payments"
        | "accounts"
        | "time_tracking"
        | "reports"
        | "settings"
        | "integrations"
      role_permission:
        | "view_dashboard"
        | "manage_users"
        | "manage_roles"
        | "configure_integrations"
        | "manage_organization_settings"
        | "view_customers"
        | "manage_customers"
        | "view_sales"
        | "manage_sales"
        | "view_inventory"
        | "manage_inventory"
        | "view_fulfillment"
        | "manage_fulfillment"
        | "view_deliveries"
        | "manage_deliveries"
        | "view_customer_service"
        | "manage_customer_service"
        | "view_reports"
        | "export_data"
      user_role:
        | "admin"
        | "sales_manager"
        | "warehouse_staff"
        | "delivery_driver"
        | "customer_service"
        | "customer"
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
      app_role: ["admin", "moderator", "user"],
      permission_action: ["create", "read", "update", "delete", "manage"],
      permission_resource: [
        "users",
        "customers",
        "vendors",
        "employees",
        "inventory",
        "items",
        "sales_orders",
        "purchase_orders",
        "invoices",
        "bills",
        "payments",
        "accounts",
        "time_tracking",
        "reports",
        "settings",
        "integrations",
      ],
      role_permission: [
        "view_dashboard",
        "manage_users",
        "manage_roles",
        "configure_integrations",
        "manage_organization_settings",
        "view_customers",
        "manage_customers",
        "view_sales",
        "manage_sales",
        "view_inventory",
        "manage_inventory",
        "view_fulfillment",
        "manage_fulfillment",
        "view_deliveries",
        "manage_deliveries",
        "view_customer_service",
        "manage_customer_service",
        "view_reports",
        "export_data",
      ],
      user_role: [
        "admin",
        "sales_manager",
        "warehouse_staff",
        "delivery_driver",
        "customer_service",
        "customer",
      ],
    },
  },
} as const
