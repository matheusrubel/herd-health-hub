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
      animais: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data_entrada: string
          id: string
          idade_meses: number | null
          lote_id: string | null
          numero_brinco: string
          observacoes: string | null
          peso_entrada: number
          raca: string | null
          responsavel_id: string | null
          sexo: string | null
          updated_at: string | null
          user_id: string
          valor_aquisicao: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_entrada: string
          id?: string
          idade_meses?: number | null
          lote_id?: string | null
          numero_brinco: string
          observacoes?: string | null
          peso_entrada: number
          raca?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          updated_at?: string | null
          user_id: string
          valor_aquisicao?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_entrada?: string
          id?: string
          idade_meses?: number | null
          lote_id?: string | null
          numero_brinco?: string
          observacoes?: string | null
          peso_entrada?: number
          raca?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          updated_at?: string | null
          user_id?: string
          valor_aquisicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      dietas: {
        Row: {
          ativo: boolean | null
          composicao: string | null
          consumo_diario_kg: number
          created_at: string | null
          custo_por_kg: number | null
          id: string
          nome: string
          tipo: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          composicao?: string | null
          consumo_diario_kg: number
          created_at?: string | null
          custo_por_kg?: number | null
          id?: string
          nome: string
          tipo?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          composicao?: string | null
          consumo_diario_kg?: number
          created_at?: string | null
          custo_por_kg?: number | null
          id?: string
          nome?: string
          tipo?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          animal_id: string | null
          aplicacao: string | null
          created_at: string | null
          data: string
          descricao: string
          id: string
          lote_id: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          animal_id?: string | null
          aplicacao?: string | null
          created_at?: string | null
          data: string
          descricao: string
          id?: string
          lote_id?: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          animal_id?: string | null
          aplicacao?: string | null
          created_at?: string | null
          data?: string
          descricao?: string
          id?: string
          lote_id?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_exclusao_lotes: {
        Row: {
          acao: string | null
          animais_afetados: number | null
          created_at: string | null
          detalhes: Json | null
          id: string
          lote_destino_id: string | null
          lote_id: string
          lote_nome: string | null
          user_id: string
        }
        Insert: {
          acao?: string | null
          animais_afetados?: number | null
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          lote_destino_id?: string | null
          lote_id: string
          lote_nome?: string | null
          user_id: string
        }
        Update: {
          acao?: string | null
          animais_afetados?: number | null
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          lote_destino_id?: string | null
          lote_id?: string
          lote_nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lotes: {
        Row: {
          ativo: boolean | null
          capacidade: number | null
          created_at: string | null
          dieta_id: string | null
          id: string
          nome: string
          responsavel_id: string | null
          tipo_alimentacao: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          capacidade?: number | null
          created_at?: string | null
          dieta_id?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          tipo_alimentacao?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          capacidade?: number | null
          created_at?: string | null
          dieta_id?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          tipo_alimentacao?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_dieta_id_fkey"
            columns: ["dieta_id"]
            isOneToOne: false
            referencedRelation: "dietas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_lotes: {
        Row: {
          animal_id: string | null
          created_at: string | null
          data: string
          id: string
          lote_destino_id: string | null
          lote_origem_id: string | null
          motivo: string | null
          user_id: string
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          data: string
          id?: string
          lote_destino_id?: string | null
          lote_origem_id?: string | null
          motivo?: string | null
          user_id: string
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          data?: string
          id?: string
          lote_destino_id?: string | null
          lote_origem_id?: string | null
          motivo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_lotes_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_lotes_lote_destino_id_fkey"
            columns: ["lote_destino_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_lotes_lote_origem_id_fkey"
            columns: ["lote_origem_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      pesagens: {
        Row: {
          animal_id: string | null
          created_at: string | null
          data: string
          id: string
          observacoes: string | null
          peso: number
          responsavel_id: string | null
          user_id: string
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          data: string
          id?: string
          observacoes?: string | null
          peso: number
          responsavel_id?: string | null
          user_id: string
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          peso?: number
          responsavel_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesagens_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          fazenda: string | null
          id: string
          nome_completo: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fazenda?: string | null
          id: string
          nome_completo: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fazenda?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      protocolos_sanitarios: {
        Row: {
          animal_id: string | null
          aplicacao: string | null
          created_at: string | null
          custo: number | null
          data: string
          dose: string | null
          id: string
          lote_id: string | null
          observacoes: string | null
          produto: string
          proxima_dose: string | null
          responsavel_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          animal_id?: string | null
          aplicacao?: string | null
          created_at?: string | null
          custo?: number | null
          data: string
          dose?: string | null
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          produto: string
          proxima_dose?: string | null
          responsavel_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          animal_id?: string | null
          aplicacao?: string | null
          created_at?: string | null
          custo?: number | null
          data?: string
          dose?: string | null
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          produto?: string
          proxima_dose?: string | null
          responsavel_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_sanitarios_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_sanitarios_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_sanitarios_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
