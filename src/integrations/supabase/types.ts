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
      account_transactions: {
        Row: {
          account_id: string
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          linked_account_id: string | null
          note: string | null
          reference_id: string | null
          reference_type: string | null
          tx_date: string
          tx_type: string
        }
        Insert: {
          account_id: string
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_account_id?: string | null
          note?: string | null
          reference_id?: string | null
          reference_type?: string | null
          tx_date?: string
          tx_type: string
        }
        Update: {
          account_id?: string
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_account_id?: string | null
          note?: string | null
          reference_id?: string | null
          reference_type?: string | null
          tx_date?: string
          tx_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          account_type: string
          business_id: string
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          is_active: boolean
          name: string
          note: string | null
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          business_id: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      app_permissions: {
        Row: {
          description: string | null
          id: number
          module: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: number
          module: string
          name: string
        }
        Update: {
          description?: string | null
          id?: number
          module?: string
          name?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          file_name: string
          folder_id: number | null
          id: string
          mime: string | null
          share_token: string
          size: number | null
          vault_file_id: number
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          file_name: string
          folder_id?: number | null
          id?: string
          mime?: string | null
          share_token: string
          size?: number | null
          vault_file_id: number
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          file_name?: string
          folder_id?: number | null
          id?: string
          mime?: string | null
          share_token?: string
          size?: number | null
          vault_file_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          use_for_repair: boolean
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          use_for_repair?: boolean
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          use_for_repair?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brands_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_locations: {
        Row: {
          alternate_number: string | null
          business_id: string
          city: string | null
          country: string | null
          created_at: string
          default_payment_accounts: Json
          email: string | null
          id: string
          invoice_layout_id: string | null
          invoice_scheme_id: string | null
          is_active: boolean
          landmark: string | null
          location_id: string | null
          mobile: string | null
          name: string
          selling_price_group_id: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          alternate_number?: string | null
          business_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          default_payment_accounts?: Json
          email?: string | null
          id?: string
          invoice_layout_id?: string | null
          invoice_scheme_id?: string | null
          is_active?: boolean
          landmark?: string | null
          location_id?: string | null
          mobile?: string | null
          name: string
          selling_price_group_id?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          alternate_number?: string | null
          business_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          default_payment_accounts?: Json
          email?: string | null
          id?: string
          invoice_layout_id?: string | null
          invoice_scheme_id?: string | null
          is_active?: boolean
          landmark?: string | null
          location_id?: string | null
          mobile?: string | null
          name?: string
          selling_price_group_id?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_requests: {
        Row: {
          admin_notes: string | null
          business_id: string | null
          created_at: string
          currency_id: number
          id: string
          location_name: string
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          sku_prefix: string | null
          status: Database["public"]["Enums"]["biz_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          business_id?: string | null
          created_at?: string
          currency_id: number
          id?: string
          location_name?: string
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku_prefix?: string | null
          status?: Database["public"]["Enums"]["biz_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          business_id?: string | null
          created_at?: string
          currency_id?: number
          id?: string
          location_name?: string
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku_prefix?: string | null
          status?: Database["public"]["Enums"]["biz_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_users: {
        Row: {
          access_all_locations: boolean
          allowed_location_ids: string[]
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          access_all_locations?: boolean
          allowed_location_ids?: string[]
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          access_all_locations?: boolean
          allowed_location_ids?: string[]
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accounting_method: string
          created_at: string
          currency_id: number
          default_profit_percent: number
          default_sales_tax: string | null
          default_unit_id: string | null
          enable_brand: boolean
          enable_category: boolean
          enable_inline_tax: boolean
          enable_price_tax: boolean
          enable_product_expiry: boolean
          enable_sub_category: boolean
          fy_start_month: number
          id: string
          logo: string | null
          name: string
          owner_id: string
          sku_prefix: string | null
          start_date: string | null
          tax_label_1: string | null
          tax_label_2: string | null
          tax_number_1: string | null
          tax_number_2: string | null
          time_zone: string
          updated_at: string
        }
        Insert: {
          accounting_method?: string
          created_at?: string
          currency_id: number
          default_profit_percent?: number
          default_sales_tax?: string | null
          default_unit_id?: string | null
          enable_brand?: boolean
          enable_category?: boolean
          enable_inline_tax?: boolean
          enable_price_tax?: boolean
          enable_product_expiry?: boolean
          enable_sub_category?: boolean
          fy_start_month?: number
          id?: string
          logo?: string | null
          name: string
          owner_id: string
          sku_prefix?: string | null
          start_date?: string | null
          tax_label_1?: string | null
          tax_label_2?: string | null
          tax_number_1?: string | null
          tax_number_2?: string | null
          time_zone?: string
          updated_at?: string
        }
        Update: {
          accounting_method?: string
          created_at?: string
          currency_id?: number
          default_profit_percent?: number
          default_sales_tax?: string | null
          default_unit_id?: string | null
          enable_brand?: boolean
          enable_category?: boolean
          enable_inline_tax?: boolean
          enable_price_tax?: boolean
          enable_product_expiry?: boolean
          enable_sub_category?: boolean
          fy_start_month?: number
          id?: string
          logo?: string | null
          name?: string
          owner_id?: string
          sku_prefix?: string | null
          start_date?: string | null
          tax_label_1?: string | null
          tax_label_2?: string | null
          tax_number_1?: string | null
          tax_number_2?: string | null
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          business_id: string
          category_type: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          short_code: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          category_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          short_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          short_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chief_complaints: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      combo_products: {
        Row: {
          component_variation_id: string
          created_at: string
          id: string
          parent_variation_id: string
          quantity: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          component_variation_id: string
          created_at?: string
          id?: string
          parent_variation_id: string
          quantity?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          component_variation_id?: string
          created_at?: string
          id?: string
          parent_variation_id?: string
          quantity?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_products_component_variation_id_fkey"
            columns: ["component_variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_products_parent_variation_id_fkey"
            columns: ["parent_variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_line_1: string | null
          business_id: string
          city: string | null
          contact_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean
          is_default: boolean
          mobile: string | null
          name: string
          opening_balance: number
          pay_term_number: number | null
          pay_term_type: string | null
          state: string | null
          supplier_business_name: string | null
          tax_number: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          business_id: string
          city?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          mobile?: string | null
          name: string
          opening_balance?: number
          pay_term_number?: number | null
          pay_term_type?: string | null
          state?: string | null
          supplier_business_name?: string | null
          tax_number?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          business_id?: string
          city?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          mobile?: string | null
          name?: string
          opening_balance?: number
          pay_term_number?: number | null
          pay_term_type?: string | null
          state?: string | null
          supplier_business_name?: string | null
          tax_number?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          budget: number | null
          business_id: string
          channel: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          business_id: string
          channel?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          business_id?: string
          channel?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followups: {
        Row: {
          business_id: string
          created_at: string
          done: boolean
          follow_up_date: string
          id: string
          lead_id: string | null
          note: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          done?: boolean
          follow_up_date: string
          id?: string
          lead_id?: string | null
          note?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          done?: boolean
          follow_up_date?: string
          id?: string
          lead_id?: string | null
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          stage: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          country: string
          currency: string
          decimal_separator: string
          id: number
          symbol: string
          thousand_separator: string
        }
        Insert: {
          code: string
          country: string
          currency: string
          decimal_separator?: string
          id?: number
          symbol: string
          thousand_separator?: string
        }
        Update: {
          code?: string
          country?: string
          currency?: string
          decimal_separator?: string
          id?: number
          symbol?: string
          thousand_separator?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          expense_id: string
          id: string
          method: string
          note: string | null
          paid_on: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          expense_id: string
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          is_recurring_active: boolean
          location_id: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          recurring_end_date: string | null
          recurring_interval:
            | Database["public"]["Enums"]["expense_recurring_interval"]
            | null
          recurring_next_date: string | null
          ref_no: string | null
          tax_amount: number
          total_amount: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id: string
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          is_recurring_active?: boolean
          location_id?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          recurring_end_date?: string | null
          recurring_interval?:
            | Database["public"]["Enums"]["expense_recurring_interval"]
            | null
          recurring_next_date?: string | null
          ref_no?: string | null
          tax_amount?: number
          total_amount?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          is_recurring_active?: boolean
          location_id?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          recurring_end_date?: string | null
          recurring_interval?:
            | Database["public"]["Enums"]["expense_recurring_interval"]
            | null
          recurring_next_date?: string | null
          ref_no?: string | null
          tax_amount?: number
          total_amount?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_attendance: {
        Row: {
          business_id: string
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_attendance_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrm_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hrm_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_employees: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          id: string
          is_active: boolean
          joining_date: string | null
          name: string
          phone: string | null
          salary: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string | null
          name: string
          phone?: string | null
          salary?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string | null
          name?: string
          phone?: string | null
          salary?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_leaves: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          from_date: string
          id: string
          leave_type: string
          reason: string | null
          status: string
          to_date: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          from_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          status?: string
          to_date: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          from_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          status?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_leaves_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrm_leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hrm_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_payrolls: {
        Row: {
          business_id: string
          created_at: string
          deductions: number
          employee_id: string
          gross: number
          id: string
          net: number
          notes: string | null
          paid_on: string | null
          period_month: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          deductions?: number
          employee_id: string
          gross?: number
          id?: string
          net?: number
          notes?: string | null
          paid_on?: string | null
          period_month: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          deductions?: number
          employee_id?: string
          gross?: number
          id?: string
          net?: number
          notes?: string | null
          paid_on?: string | null
          period_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_payrolls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrm_payrolls_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hrm_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      mfg_bom_lines: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          unit_cost: number
          variation_id: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          unit_cost?: number
          variation_id: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          unit_cost?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfg_bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "mfg_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_bom_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_bom_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      mfg_boms: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          finished_product_id: string
          finished_variation_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          output_qty: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          finished_product_id: string
          finished_variation_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          output_qty?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          finished_product_id?: string
          finished_variation_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          output_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfg_boms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_boms_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_boms_finished_variation_id_fkey"
            columns: ["finished_variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      mfg_production_lines: {
        Row: {
          actual_qty: number
          created_at: string
          id: string
          order_id: string
          planned_qty: number
          product_id: string
          total_cost: number
          unit_cost: number
          variation_id: string
        }
        Insert: {
          actual_qty?: number
          created_at?: string
          id?: string
          order_id: string
          planned_qty?: number
          product_id: string
          total_cost?: number
          unit_cost?: number
          variation_id: string
        }
        Update: {
          actual_qty?: number
          created_at?: string
          id?: string
          order_id?: string
          planned_qty?: number
          product_id?: string
          total_cost?: number
          unit_cost?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfg_production_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "mfg_production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_production_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_production_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      mfg_production_orders: {
        Row: {
          bom_id: string | null
          business_id: string
          created_at: string
          created_by: string | null
          finished_product_id: string
          finished_variation_id: string
          id: string
          location_id: string
          notes: string | null
          order_date: string
          planned_qty: number
          produced_qty: number
          ref_no: string | null
          status: Database["public"]["Enums"]["mfg_order_status"]
          total_cost: number
          unit_cost: number
          updated_at: string
          wastage_qty: number
          yield_percent: number
        }
        Insert: {
          bom_id?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          finished_product_id: string
          finished_variation_id: string
          id?: string
          location_id: string
          notes?: string | null
          order_date?: string
          planned_qty?: number
          produced_qty?: number
          ref_no?: string | null
          status?: Database["public"]["Enums"]["mfg_order_status"]
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          wastage_qty?: number
          yield_percent?: number
        }
        Update: {
          bom_id?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          finished_product_id?: string
          finished_variation_id?: string
          id?: string
          location_id?: string
          notes?: string | null
          order_date?: string
          planned_qty?: number
          produced_qty?: number
          ref_no?: string | null
          status?: Database["public"]["Enums"]["mfg_order_status"]
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          wastage_qty?: number
          yield_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "mfg_production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "mfg_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_production_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_production_orders_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_production_orders_finished_variation_id_fkey"
            columns: ["finished_variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfg_production_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_lines: {
        Row: {
          created_at: string
          dose: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medicine_name: string
          prescription_id: string
          product_id: string | null
          quantity: number
          sort_order: number
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_name: string
          prescription_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_name?: string
          prescription_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_lines_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          advice: string | null
          business_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          doctor_name: string | null
          doctor_qualification: string | null
          id: string
          investigation: string | null
          location_id: string | null
          next_visit: string | null
          notes: string | null
          patient_age: string | null
          patient_gender: string | null
          patient_name: string
          patient_phone: string | null
          rx_date: string
          rx_no: string | null
          sale_id: string | null
          updated_at: string
          vitals: string | null
        }
        Insert: {
          advice?: string | null
          business_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_name?: string | null
          doctor_qualification?: string | null
          id?: string
          investigation?: string | null
          location_id?: string | null
          next_visit?: string | null
          notes?: string | null
          patient_age?: string | null
          patient_gender?: string | null
          patient_name: string
          patient_phone?: string | null
          rx_date?: string
          rx_no?: string | null
          sale_id?: string | null
          updated_at?: string
          vitals?: string | null
        }
        Update: {
          advice?: string | null
          business_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_name?: string | null
          doctor_qualification?: string | null
          id?: string
          investigation?: string | null
          location_id?: string | null
          next_visit?: string | null
          notes?: string | null
          patient_age?: string | null
          patient_gender?: string | null
          patient_name?: string
          patient_phone?: string | null
          rx_date?: string
          rx_no?: string | null
          sale_id?: string | null
          updated_at?: string
          vitals?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          name: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          name: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          name?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alert_quantity: number | null
          barcode: string | null
          barcode_type: Database["public"]["Enums"]["barcode_type"]
          brand_id: string | null
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          default_purchase_price: number
          default_sell_price: number
          description: string | null
          enable_stock: boolean
          id: string
          image: string | null
          is_inactive: boolean
          mrp: number
          name: string
          not_for_selling: boolean
          sku: string
          sub_category_id: string | null
          tax_id: string | null
          tax_type: string
          type: Database["public"]["Enums"]["product_type"]
          unit_id: string | null
          updated_at: string
          warranty_id: string | null
          weight: number | null
        }
        Insert: {
          alert_quantity?: number | null
          barcode?: string | null
          barcode_type?: Database["public"]["Enums"]["barcode_type"]
          brand_id?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          default_purchase_price?: number
          default_sell_price?: number
          description?: string | null
          enable_stock?: boolean
          id?: string
          image?: string | null
          is_inactive?: boolean
          mrp?: number
          name: string
          not_for_selling?: boolean
          sku: string
          sub_category_id?: string | null
          tax_id?: string | null
          tax_type?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit_id?: string | null
          updated_at?: string
          warranty_id?: string | null
          weight?: number | null
        }
        Update: {
          alert_quantity?: number | null
          barcode?: string | null
          barcode_type?: Database["public"]["Enums"]["barcode_type"]
          brand_id?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          default_purchase_price?: number
          default_sell_price?: number
          description?: string | null
          enable_stock?: boolean
          id?: string
          image?: string | null
          is_inactive?: boolean
          mrp?: number
          name?: string
          not_for_selling?: boolean
          sku?: string
          sub_category_id?: string | null
          tax_id?: string | null
          tax_type?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit_id?: string | null
          updated_at?: string
          warranty_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_business_id: string | null
          doctor_name: string | null
          doctor_qualification: string | null
          email: string | null
          first_name: string | null
          id: string
          language: string
          last_name: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          current_business_id?: string | null
          doctor_name?: string | null
          doctor_qualification?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          language?: string
          last_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          current_business_id?: string | null
          doctor_name?: string | null
          doctor_qualification?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          language?: string
          last_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      repair_jobs: {
        Row: {
          advance_paid: number | null
          brand: string | null
          business_id: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivered_date: string | null
          device: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          job_no: string | null
          model: string | null
          notes: string | null
          problem: string | null
          received_date: string
          serial_no: string | null
          status: string
          technician: string | null
          updated_at: string
          warranty_days: number | null
        }
        Insert: {
          advance_paid?: number | null
          brand?: string | null
          business_id: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivered_date?: string | null
          device?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          job_no?: string | null
          model?: string | null
          notes?: string | null
          problem?: string | null
          received_date?: string
          serial_no?: string | null
          status?: string
          technician?: string | null
          updated_at?: string
          warranty_days?: number | null
        }
        Update: {
          advance_paid?: number | null
          brand?: string | null
          business_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivered_date?: string | null
          device?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          job_no?: string | null
          model?: string | null
          notes?: string | null
          problem?: string | null
          received_date?: string
          serial_no?: string | null
          status?: string
          technician?: string | null
          updated_at?: string
          warranty_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_orders: {
        Row: {
          business_id: string
          created_at: string
          customer_name: string | null
          discount: number
          id: string
          items: Json
          notes: string | null
          order_no: string | null
          order_type: string
          ordered_at: string
          served_at: string | null
          status: string
          subtotal: number
          table_id: string | null
          table_name: string | null
          tax: number
          total: number
          updated_at: string
          waiter: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_name?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          order_no?: string | null
          order_type?: string
          ordered_at?: string
          served_at?: string | null
          status?: string
          subtotal?: number
          table_id?: string | null
          table_name?: string | null
          tax?: number
          total?: number
          updated_at?: string
          waiter?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_name?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          order_no?: string | null
          order_type?: string
          ordered_at?: string
          served_at?: string | null
          status?: string
          subtotal?: number
          table_id?: string | null
          table_name?: string | null
          tax?: number
          total?: number
          updated_at?: string
          waiter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          area: string | null
          business_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          seats: number
          status: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          business_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          seats?: number
          status?: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          seats?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: number
          role_id: string
        }
        Insert: {
          permission_id: number
          role_id: string
        }
        Update: {
          permission_id?: number
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "app_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          allowed_sections: string[] | null
          business_id: string
          created_at: string
          id: string
          is_default: boolean
          is_service_staff: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allowed_sections?: string[] | null
          business_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_service_staff?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allowed_sections?: string[] | null
          business_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_service_staff?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rx_frequencies: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      selling_price_groups: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selling_price_groups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_lines: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          stock_adjustment_id: string
          unit_price: number
          variation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          stock_adjustment_id: string
          unit_price?: number
          variation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          stock_adjustment_id?: string
          unit_price?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_stock_adjustment_id_fkey"
            columns: ["stock_adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_type: Database["public"]["Enums"]["stock_adjustment_type"]
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          reason: string | null
          ref_no: string
          total_amount: number
          total_amount_recovered: number
          updated_at: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_type?: Database["public"]["Enums"]["stock_adjustment_type"]
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          reason?: string | null
          ref_no: string
          total_amount?: number
          total_amount_recovered?: number
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_type?: Database["public"]["Enums"]["stock_adjustment_type"]
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          reason?: string | null
          ref_no?: string
          total_amount?: number
          total_amount_recovered?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_lines: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          transfer_id: string
          unit_cost: number
          variation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          transfer_id: string
          unit_cost?: number
          variation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          transfer_id?: string
          unit_cost?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          additional_notes: string | null
          business_id: string
          created_at: string
          created_by: string | null
          from_location_id: string
          id: string
          ref_no: string | null
          shipping_charges: number
          status: string
          to_location_id: string
          total_amount: number
          transfer_date: string
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          from_location_id: string
          id?: string
          ref_no?: string | null
          shipping_charges?: number
          status?: string
          to_location_id: string
          total_amount?: number
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          from_location_id?: string
          id?: string
          ref_no?: string | null
          shipping_charges?: number
          status?: string
          to_location_id?: string
          total_amount?: number
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_group_sub_taxes: {
        Row: {
          sub_tax_id: string
          tax_group_id: string
        }
        Insert: {
          sub_tax_id: string
          tax_group_id: string
        }
        Update: {
          sub_tax_id?: string
          tax_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_group_sub_taxes_sub_tax_id_fkey"
            columns: ["sub_tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_group_sub_taxes_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          for_tax_group: boolean
          id: string
          is_tax_group: boolean
          name: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id: string
          created_at?: string
          for_tax_group?: boolean
          id?: string
          is_tax_group?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          for_tax_group?: boolean
          id?: string
          is_tax_group?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string
          note: string | null
          paid_on: string
          payment_ref_no: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          payment_ref_no?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          payment_ref_no?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_purchase_lines: {
        Row: {
          created_at: string
          expire_date: string | null
          id: string
          item_tax: number
          lot_no: string | null
          pp_without_discount: number
          product_id: string
          purchase_price: number
          purchase_price_inc_tax: number
          quantity: number
          tax_id: string | null
          transaction_id: string
          updated_at: string
          variation_id: string
        }
        Insert: {
          created_at?: string
          expire_date?: string | null
          id?: string
          item_tax?: number
          lot_no?: string | null
          pp_without_discount?: number
          product_id: string
          purchase_price?: number
          purchase_price_inc_tax?: number
          quantity?: number
          tax_id?: string | null
          transaction_id: string
          updated_at?: string
          variation_id: string
        }
        Update: {
          created_at?: string
          expire_date?: string | null
          id?: string
          item_tax?: number
          lot_no?: string | null
          pp_without_discount?: number
          product_id?: string
          purchase_price?: number
          purchase_price_inc_tax?: number
          quantity?: number
          tax_id?: string | null
          transaction_id?: string
          updated_at?: string
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_purchase_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_purchase_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_purchase_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_purchase_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_sell_lines: {
        Row: {
          created_at: string
          id: string
          item_tax: number
          line_discount_amount: number
          line_discount_type: string | null
          product_id: string
          quantity: number
          tax_id: string | null
          transaction_id: string
          unit_price: number
          unit_price_inc_tax: number
          variation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_tax?: number
          line_discount_amount?: number
          line_discount_type?: string | null
          product_id: string
          quantity: number
          tax_id?: string | null
          transaction_id: string
          unit_price: number
          unit_price_inc_tax?: number
          variation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_tax?: number
          line_discount_amount?: number
          line_discount_type?: string | null
          product_id?: string
          quantity?: number
          tax_id?: string | null
          transaction_id?: string
          unit_price?: number
          unit_price_inc_tax?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_sell_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_sell_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_sell_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_sell_lines_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          additional_notes: string | null
          business_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          discount_type: string | null
          final_total: number
          id: string
          invoice_no: string | null
          location_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          ref_no: string | null
          shipping_charges: number
          staff_note: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tax_amount: number
          tax_id: string | null
          total_before_tax: number
          total_paid: number
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          business_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_type?: string | null
          final_total?: number
          id?: string
          invoice_no?: string | null
          location_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          ref_no?: string | null
          shipping_charges?: number
          staff_note?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tax_amount?: number
          tax_id?: string | null
          total_before_tax?: number
          total_paid?: number
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          business_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_type?: string | null
          final_total?: number
          id?: string
          invoice_no?: string | null
          location_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          ref_no?: string | null
          shipping_charges?: number
          staff_note?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tax_amount?: number
          tax_id?: string | null
          total_before_tax?: number
          total_paid?: number
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          actual_name: string
          allow_decimal: boolean
          base_unit_id: string | null
          base_unit_multiplier: number | null
          business_id: string
          created_at: string
          id: string
          short_name: string
          updated_at: string
        }
        Insert: {
          actual_name: string
          allow_decimal?: boolean
          base_unit_id?: string | null
          base_unit_multiplier?: number | null
          business_id: string
          created_at?: string
          id?: string
          short_name: string
          updated_at?: string
        }
        Update: {
          actual_name?: string
          allow_decimal?: boolean
          base_unit_id?: string | null
          base_unit_multiplier?: number | null
          business_id?: string
          created_at?: string
          id?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          allowed_sections: string[] | null
          business_id: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          allowed_sections?: string[] | null
          business_id: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          allowed_sections?: string[] | null
          business_id?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      variation_location_details: {
        Row: {
          created_at: string
          id: string
          location_id: string
          product_id: string
          qty_available: number
          updated_at: string
          variation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          product_id: string
          qty_available?: number
          updated_at?: string
          variation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          product_id?: string
          qty_available?: number
          updated_at?: string
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variation_location_details_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variation_location_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variation_location_details_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      variations: {
        Row: {
          barcode: string | null
          combo_variations: Json | null
          created_at: string
          default_purchase_price: number
          default_sell_price: number
          dpp_inc_tax: number
          id: string
          mrp: number
          name: string
          pack_size: number
          product_id: string
          product_variation_id: string | null
          profit_percent: number
          sell_price_inc_tax: number
          sub_sku: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          combo_variations?: Json | null
          created_at?: string
          default_purchase_price?: number
          default_sell_price?: number
          dpp_inc_tax?: number
          id?: string
          mrp?: number
          name?: string
          pack_size?: number
          product_id: string
          product_variation_id?: string | null
          profit_percent?: number
          sell_price_inc_tax?: number
          sub_sku?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          combo_variations?: Json | null
          created_at?: string
          default_purchase_price?: number
          default_sell_price?: number
          dpp_inc_tax?: number
          id?: string
          mrp?: number
          name?: string
          pack_size?: number
          product_id?: string
          product_variation_id?: string | null
          profit_percent?: number
          sell_price_inc_tax?: number
          sub_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variations_product_variation_id_fkey"
            columns: ["product_variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration: number
          duration_type: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration?: number
          duration_type?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration?: number
          duration_type?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_business_request: {
        Args: { _id: string; _notes?: string }
        Returns: string
      }
      can_manage_member_profile: {
        Args: { _manager: string; _target: string }
        Returns: boolean
      }
      complete_production_order: {
        Args: { _id: string; _payload: Json }
        Returns: string
      }
      create_purchase: { Args: { _payload: Json }; Returns: string }
      create_stock_adjustment: { Args: { _payload: Json }; Returns: string }
      create_stock_transfer: { Args: { _payload: Json }; Returns: string }
      current_user_role_name: {
        Args: { _business_id: string }
        Returns: string
      }
      delete_sale: { Args: { _id: string }; Returns: undefined }
      delete_stock_adjustment: { Args: { _id: string }; Returns: undefined }
      delete_stock_transfer: { Args: { _id: string }; Returns: undefined }
      has_permission: {
        Args: { _business_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_business_owner: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      receive_stock_transfer: { Args: { _id: string }; Returns: undefined }
      reject_business_request: {
        Args: { _id: string; _notes?: string }
        Returns: undefined
      }
      transfer_between_accounts: {
        Args: { _amount: number; _from: string; _note: string; _to: string }
        Returns: undefined
      }
      update_purchase: {
        Args: { _id: string; _payload: Json }
        Returns: string
      }
      update_sale: { Args: { _id: string; _payload: Json }; Returns: string }
    }
    Enums: {
      barcode_type: "C128" | "C39" | "EAN13" | "EAN8" | "UPCA" | "UPCE"
      biz_request_status: "pending" | "approved" | "rejected"
      contact_type: "customer" | "supplier" | "both"
      expense_recurring_interval: "daily" | "weekly" | "monthly" | "yearly"
      mfg_order_status: "draft" | "in_progress" | "completed" | "cancelled"
      payment_status: "paid" | "due" | "partial" | "overdue"
      product_type: "single" | "variable" | "combo"
      stock_adjustment_type: "normal" | "abnormal"
      transaction_status: "draft" | "final" | "received" | "pending" | "ordered"
      transaction_type:
        | "sell"
        | "purchase"
        | "sell_return"
        | "purchase_return"
        | "opening_balance"
        | "expense"
        | "stock_adjustment"
        | "stock_transfer"
        | "sell_transfer"
        | "purchase_transfer"
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
      barcode_type: ["C128", "C39", "EAN13", "EAN8", "UPCA", "UPCE"],
      biz_request_status: ["pending", "approved", "rejected"],
      contact_type: ["customer", "supplier", "both"],
      expense_recurring_interval: ["daily", "weekly", "monthly", "yearly"],
      mfg_order_status: ["draft", "in_progress", "completed", "cancelled"],
      payment_status: ["paid", "due", "partial", "overdue"],
      product_type: ["single", "variable", "combo"],
      stock_adjustment_type: ["normal", "abnormal"],
      transaction_status: ["draft", "final", "received", "pending", "ordered"],
      transaction_type: [
        "sell",
        "purchase",
        "sell_return",
        "purchase_return",
        "opening_balance",
        "expense",
        "stock_adjustment",
        "stock_transfer",
        "sell_transfer",
        "purchase_transfer",
      ],
    },
  },
} as const
