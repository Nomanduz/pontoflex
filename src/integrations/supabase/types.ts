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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      codigos_senha_empresa: {
        Row: {
          codigo_hash: string
          created_at: string
          empresa_id: string
          expira_em: string
          id: string
          tentativas: number
          usado: boolean
        }
        Insert: {
          codigo_hash: string
          created_at?: string
          empresa_id: string
          expira_em: string
          id?: string
          tentativas?: number
          usado?: boolean
        }
        Update: {
          codigo_hash?: string
          created_at?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          tentativas?: number
          usado?: boolean
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string
          created_at: string
          email: string | null
          id: string
          razao_social: string
          senha_mestra_cadastro: string | null
          senha_mestra_leitura: string | null
          user_id: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          email?: string | null
          id?: string
          razao_social: string
          senha_mestra_cadastro?: string | null
          senha_mestra_leitura?: string | null
          user_id: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          email?: string | null
          id?: string
          razao_social?: string
          senha_mestra_cadastro?: string | null
          senha_mestra_leitura?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fechamentos: {
        Row: {
          empresa_assinado_em: string | null
          empresa_id: string
          empresa_ip: string | null
          fechado_em: string
          func_assinado_em: string | null
          func_ip: string | null
          func_latitude: number | null
          func_longitude: number | null
          funcionario_id: string
          hash: string
          id: string
          periodo_fim: string
          periodo_inicio: string
          resumo: Json
        }
        Insert: {
          empresa_assinado_em?: string | null
          empresa_id: string
          empresa_ip?: string | null
          fechado_em?: string
          func_assinado_em?: string | null
          func_ip?: string | null
          func_latitude?: number | null
          func_longitude?: number | null
          funcionario_id: string
          hash: string
          id?: string
          periodo_fim: string
          periodo_inicio: string
          resumo: Json
        }
        Update: {
          empresa_assinado_em?: string | null
          empresa_id?: string
          empresa_ip?: string | null
          fechado_em?: string
          func_assinado_em?: string | null
          func_ip?: string | null
          func_latitude?: number | null
          func_longitude?: number | null
          funcionario_id?: string
          hash?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          resumo?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string
          created_at: string
          dias_semana: number[] | null
          empresa_id: string
          escala: string
          escala_inicio: string | null
          foto_path: string | null
          hora_entrada: string
          hora_retorno_almoco: string
          hora_saida: string
          hora_saida_almoco: string
          id: string
          matricula: string | null
          nome: string
          senha_alterada_em: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf: string
          created_at?: string
          dias_semana?: number[] | null
          empresa_id: string
          escala?: string
          escala_inicio?: string | null
          foto_path?: string | null
          hora_entrada?: string
          hora_retorno_almoco?: string
          hora_saida?: string
          hora_saida_almoco?: string
          id?: string
          matricula?: string | null
          nome: string
          senha_alterada_em?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string
          created_at?: string
          dias_semana?: number[] | null
          empresa_id?: string
          escala?: string
          escala_inicio?: string | null
          foto_path?: string | null
          hora_entrada?: string
          hora_retorno_almoco?: string
          hora_saida?: string
          hora_saida_almoco?: string
          id?: string
          matricula?: string | null
          nome?: string
          senha_alterada_em?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos: {
        Row: {
          data_hora: string
          empresa_id: string
          face_confianca: number | null
          face_status: string | null
          funcionario_id: string
          id: string
          latitude: number
          longitude: number
          origem: string
          selfie_path: string | null
          solicitacao_id: string | null
          tipo: Database["public"]["Enums"]["ponto_tipo"]
        }
        Insert: {
          data_hora?: string
          empresa_id: string
          face_confianca?: number | null
          face_status?: string | null
          funcionario_id: string
          id?: string
          latitude: number
          longitude: number
          origem?: string
          selfie_path?: string | null
          solicitacao_id?: string | null
          tipo: Database["public"]["Enums"]["ponto_tipo"]
        }
        Update: {
          data_hora?: string
          empresa_id?: string
          face_confianca?: number | null
          face_status?: string | null
          funcionario_id?: string
          id?: string
          latitude?: number
          longitude?: number
          origem?: string
          selfie_path?: string | null
          solicitacao_id?: string | null
          tipo?: Database["public"]["Enums"]["ponto_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "pontos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_ponto: {
        Row: {
          analisado_em: string | null
          created_at: string
          data_hora: string
          empresa_id: string
          funcionario_id: string
          id: string
          latitude: number
          longitude: number
          motivo: string
          observacao: string | null
          status: string
          tipo: Database["public"]["Enums"]["ponto_tipo"]
        }
        Insert: {
          analisado_em?: string | null
          created_at?: string
          data_hora: string
          empresa_id: string
          funcionario_id: string
          id?: string
          latitude: number
          longitude: number
          motivo: string
          observacao?: string | null
          status?: string
          tipo: Database["public"]["Enums"]["ponto_tipo"]
        }
        Update: {
          analisado_em?: string | null
          created_at?: string
          data_hora?: string
          empresa_id?: string
          funcionario_id?: string
          id?: string
          latitude?: number
          longitude?: number
          motivo?: string
          observacao?: string | null
          status?: string
          tipo?: Database["public"]["Enums"]["ponto_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_ponto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_ponto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_logs: {
        Row: {
          acao: string
          data_hora: string
          detalhe: string | null
          empresa_id: string
          funcionario_id: string | null
          id: string
        }
        Insert: {
          acao: string
          data_hora?: string
          detalhe?: string | null
          empresa_id: string
          funcionario_id?: string | null
          id?: string
        }
        Update: {
          acao?: string
          data_hora?: string
          detalhe?: string | null
          empresa_id?: string
          funcionario_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminal_logs_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      my_empresa_id: { Args: never; Returns: string }
      my_funcionario_empresa_id: { Args: never; Returns: string }
      my_funcionario_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "funcionario"
      ponto_tipo: "ENTRADA" | "SAIDA_ALMOCO" | "RETORNO_ALMOCO" | "SAIDA"
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
      app_role: ["admin", "funcionario"],
      ponto_tipo: ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"],
    },
  },
} as const
