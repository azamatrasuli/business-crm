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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          password_hash: string
          phone: string
          project_id: string | null
          role: string
          status: Database["public"]["Enums"]["admin_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          last_login_at?: string | null
          password_hash: string
          phone: string
          project_id?: string | null
          role: string
          status?: Database["public"]["Enums"]["admin_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string
          phone?: string
          project_id?: string | null
          role?: string
          status?: Database["public"]["Enums"]["admin_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_project_id_fkey"
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
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          budget: number
          created_at: string
          currency_code: string | null
          cutoff_time: string | null
          deleted_at: string | null
          id: string
          name: string
          overdraft_limit: number | null
          status: Database["public"]["Enums"]["company_status"] | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number
          created_at?: string
          currency_code?: string | null
          cutoff_time?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          overdraft_limit?: number | null
          status?: Database["public"]["Enums"]["company_status"] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number
          created_at?: string
          currency_code?: string | null
          cutoff_time?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          overdraft_limit?: number | null
          status?: Database["public"]["Enums"]["company_status"] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string | null
          file_name: string | null
          file_url: string
          id: string
          period_end: string | null
          period_start: string | null
          project_id: string | null
          type: Database["public"]["Enums"]["document_type"]
        }
        Insert: {
          company_id: string
          created_at?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
        }
        Update: {
          company_id?: string
          created_at?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string | null
          type?: Database["public"]["Enums"]["document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          end_date: string
          id: string
          is_paid: boolean | null
          paid_amount: number | null
          project_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          total_amount: number
          total_days: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          end_date: string
          id?: string
          is_paid?: boolean | null
          paid_amount?: number | null
          project_id: string
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          total_amount: number
          total_days: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          end_date?: string
          id?: string
          is_paid?: boolean | null
          paid_amount?: number | null
          project_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          total_amount?: number
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_transactions: {
        Row: {
          amount: number
          balance_after: number
          client_app_order_uuid: string | null
          company_id: string
          created_at: string | null
          daily_order_id: string | null
          description: string | null
          id: string
          invoice_id: string | null
          project_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          client_app_order_uuid?: string | null
          company_id: string
          created_at?: string | null
          daily_order_id?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          client_app_order_uuid?: string | null
          company_id?: string
          created_at?: string | null
          daily_order_id?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "company_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_daily_order_id_fkey"
            columns: ["daily_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_addresses: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          full_address: string
          geo_point: unknown
          id: string
          is_default: boolean
          name: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          full_address: string
          geo_point?: unknown
          id?: string
          is_default?: boolean
          name: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          full_address?: string
          geo_point?: unknown
          id?: string
          is_default?: boolean
          name?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_addresses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_budgets: {
        Row: {
          auto_renew: boolean
          created_at: string
          daily_limit: number
          employee_id: string
          id: string
          period: Database["public"]["Enums"]["budget_period"]
          period_end_date: string | null
          period_start_date: string | null
          spent_this_period: number
          total_budget: number
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          daily_limit?: number
          employee_id: string
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          period_end_date?: string | null
          period_start_date?: string | null
          spent_this_period?: number
          total_budget?: number
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          daily_limit?: number
          employee_id?: string
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          period_end_date?: string | null
          period_start_date?: string | null
          spent_this_period?: number
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_budgets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_freeze_history: {
        Row: {
          assignment_id: string
          created_at: string | null
          employee_id: string
          frozen_at: string
          id: string
          original_date: string
          week_number: number
          week_year: number
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          employee_id: string
          frozen_at?: string
          id?: string
          original_date: string
          week_number: number
          week_year: number
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          employee_id?: string
          frozen_at?: string
          id?: string
          original_date?: string
          week_number?: number
          week_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_freeze_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "employee_meal_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_freeze_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_meal_assignments: {
        Row: {
          assignment_date: string
          combo_type: string
          created_at: string | null
          delivery_address_id: string | null
          employee_id: string
          frozen_at: string | null
          frozen_reason: string | null
          id: string
          price: number
          replacement_date: string | null
          status: Database["public"]["Enums"]["meal_assignment_status"] | null
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_date: string
          combo_type: string
          created_at?: string | null
          delivery_address_id?: string | null
          employee_id: string
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          price: number
          replacement_date?: string | null
          status?: Database["public"]["Enums"]["meal_assignment_status"] | null
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_date?: string
          combo_type?: string
          created_at?: string | null
          delivery_address_id?: string | null
          employee_id?: string
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          price?: number
          replacement_date?: string | null
          status?: Database["public"]["Enums"]["meal_assignment_status"] | null
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_meal_assignments_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_meal_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_meal_assignments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string
          created_at: string
          default_address_id: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          invite_status: Database["public"]["Enums"]["employee_invite_status"]
          is_active: boolean
          phone: string
          position: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_address_id?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          invite_status?: Database["public"]["Enums"]["employee_invite_status"]
          is_active?: boolean
          phone: string
          position?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_address_id?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          invite_status?: Database["public"]["Enums"]["employee_invite_status"]
          is_active?: boolean
          phone?: string
          position?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_default_address_id_fkey"
            columns: ["default_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          currency_code: string | null
          due_date: string | null
          external_id: string | null
          id: string
          paid_at: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          currency_code?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_subscriptions: {
        Row: {
          combo_type: string
          company_id: string
          created_at: string | null
          delivery_address_id: string | null
          employee_id: string
          id: string
          is_active: boolean | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          combo_type: string
          company_id: string
          created_at?: string | null
          delivery_address_id?: string | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          combo_type?: string
          company_id?: string
          created_at?: string | null
          delivery_address_id?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lunch_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_subscriptions_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_subscriptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      news_read_status: {
        Row: {
          news_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          news_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          news_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_read_status_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "system_news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          combo_type: string
          company_id: string
          created_at: string
          created_by_user_id: string | null
          currency_code: string | null
          delivery_address_id: string | null
          employee_id: string | null
          guest_name: string | null
          id: string
          is_guest_order: boolean
          order_date: string
          price: number
          project_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          combo_type: string
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string | null
          delivery_address_id?: string | null
          employee_id?: string | null
          guest_name?: string | null
          id?: string
          is_guest_order?: boolean
          order_date?: string
          price: number
          project_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          combo_type?: string
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string | null
          delivery_address_id?: string | null
          employee_id?: string | null
          guest_name?: string | null
          id?: string
          is_guest_order?: boolean
          order_date?: string
          price?: number
          project_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          company_id: string
          compensation_daily_limit: number | null
          compensation_rollover: boolean | null
          created_at: string | null
          currency_code: string | null
          cutoff_time: string | null
          deleted_at: string | null
          id: string
          is_headquarters: boolean
          name: string
          overdraft_limit: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["company_status"] | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          company_id: string
          compensation_daily_limit?: number | null
          compensation_rollover?: boolean | null
          created_at?: string | null
          currency_code?: string | null
          cutoff_time?: string | null
          deleted_at?: string | null
          id?: string
          is_headquarters?: boolean
          name: string
          overdraft_limit?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["company_status"] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          company_id?: string
          compensation_daily_limit?: number | null
          compensation_rollover?: boolean | null
          created_at?: string | null
          currency_code?: string | null
          cutoff_time?: string | null
          deleted_at?: string | null
          id?: string
          is_headquarters?: boolean
          name?: string
          overdraft_limit?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["company_status"] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          device_info: string | null
          expires_at: string
          id: string
          ip_address: string | null
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_news: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          target_roles: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          target_roles?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          target_roles?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          admin_user_id: string
          id: string
          route: string
        }
        Insert: {
          admin_user_id: string
          id?: string
          route: string
        }
        Update: {
          admin_user_id?: string
          id?: string
          route?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_freeze_limit: {
        Args: { p_date: string; p_employee_id: string }
        Returns: boolean
      }
      get_remaining_freezes: {
        Args: { p_date: string; p_employee_id: string }
        Returns: number
      }
    }
    Enums: {
      admin_status: "Активный" | "Не активный" | "Заблокирован"
      assignment_pattern: "EVERY_DAY" | "EVERY_OTHER_DAY" | "CUSTOM"
      budget_period: "в День" | "в Неделю" | "в Месяц"
      company_status: "ACTIVE" | "BLOCKED_DEBT" | "ARCHIVED"
      document_type: "ACT_OF_RECONCILIATION" | "INVOICE_PDF" | "CONTRACT"
      employee_invite_status: "Принято" | "Ожидает" | "Отклонено"
      invoice_status: "UNPAID" | "PAID" | "CANCELLED" | "OVERDUE"
      meal_assignment_status:
        | "SCHEDULED"
        | "ACTIVE"
        | "FROZEN"
        | "DELIVERED"
        | "CANCELLED"
      order_status: "Активен" | "На паузе" | "Завершен"
      service_type: "LUNCH" | "COMPENSATION"
      subscription_status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
      transaction_type:
        | "DEPOSIT"
        | "LUNCH_DEDUCTION"
        | "GUEST_ORDER"
        | "CLIENT_APP_ORDER"
        | "REFUND"
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
      admin_status: ["Активный", "Не активный", "Заблокирован"],
      assignment_pattern: ["EVERY_DAY", "EVERY_OTHER_DAY", "CUSTOM"],
      budget_period: ["в День", "в Неделю", "в Месяц"],
      company_status: ["ACTIVE", "BLOCKED_DEBT", "ARCHIVED"],
      document_type: ["ACT_OF_RECONCILIATION", "INVOICE_PDF", "CONTRACT"],
      employee_invite_status: ["Принято", "Ожидает", "Отклонено"],
      invoice_status: ["UNPAID", "PAID", "CANCELLED", "OVERDUE"],
      meal_assignment_status: [
        "SCHEDULED",
        "ACTIVE",
        "FROZEN",
        "DELIVERED",
        "CANCELLED",
      ],
      order_status: ["Активен", "На паузе", "Завершен"],
      service_type: ["LUNCH", "COMPENSATION"],
      subscription_status: ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
      transaction_type: [
        "DEPOSIT",
        "LUNCH_DEDUCTION",
        "GUEST_ORDER",
        "CLIENT_APP_ORDER",
        "REFUND",
      ],
    },
  },
} as const
