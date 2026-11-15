export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      codigos_senha_empresa: {
        Row: {
          codigo_hash: string;
          created_at: string;
          empresa_id: string;
          expira_em: string;
          id: string;
          tentativas: number;
          usado: boolean;
        };
        Insert: {
          codigo_hash: string;
          created_at?: string;
          empresa_id: string;
          expira_em: string;
          id?: string;
          tentativas?: number;
          usado?: boolean;
        };
        Update: {
          codigo_hash?: string;
          created_at?: string;
          empresa_id?: string;
          expira_em?: string;
          id?: string;
          tentativas?: number;
          usado?: boolean;
        };
        Relationships: [];
      };
      empresas: {
        Row: {
          documento: string;
          created_at: string;
          email: string | null;
          id: string;
          razao_social: string;
          senha_mestra_cadastro: string | null;
          senha_mestra_leitura: string | null;
          user_id: string;
          tipo_documento: string;
          responsavel: string | null;
          telefone: string | null;
          status: string;
          teste_ate: string | null;
          latitude: number | null;
          longitude: number | null;
          raio_m: number | null;
        };
        Insert: {
          documento: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          razao_social: string;
          senha_mestra_cadastro?: string | null;
          senha_mestra_leitura?: string | null;
          user_id: string;
          tipo_documento?: string;
          responsavel?: string | null;
          telefone?: string | null;
          status?: string;
          teste_ate?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          raio_m?: number | null;
        };
        Update: {
          documento?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          razao_social?: string;
          senha_mestra_cadastro?: string | null;
          senha_mestra_leitura?: string | null;
          user_id?: string;
          tipo_documento?: string;
          responsavel?: string | null;
          telefone?: string | null;
          status?: string;
          teste_ate?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          raio_m?: number | null;
        };
        Relationships: [];
      };
      fechamentos: {
        Row: {
          empresa_assinado_em: string | null;
          empresa_id: string;
          empresa_ip: string | null;
          fechado_em: string;
          func_assinado_em: string | null;
          func_ip: string | null;
          func_latitude: number | null;
          func_longitude: number | null;
          funcionario_id: string;
          hash: string;
          id: string;
          periodo_fim: string;
          periodo_inicio: string;
          resumo: Json;
          func_hash_assinado: string | null;
          empresa_hash_assinado: string | null;
        };
        Insert: {
          empresa_assinado_em?: string | null;
          empresa_id: string;
          empresa_ip?: string | null;
          fechado_em?: string;
          func_assinado_em?: string | null;
          func_ip?: string | null;
          func_latitude?: number | null;
          func_longitude?: number | null;
          funcionario_id: string;
          hash: string;
          id?: string;
          periodo_fim: string;
          periodo_inicio: string;
          resumo: Json;
          func_hash_assinado?: string | null;
          empresa_hash_assinado?: string | null;
        };
        Update: {
          empresa_assinado_em?: string | null;
          empresa_id?: string;
          empresa_ip?: string | null;
          fechado_em?: string;
          func_assinado_em?: string | null;
          func_ip?: string | null;
          func_latitude?: number | null;
          func_longitude?: number | null;
          funcionario_id?: string;
          hash?: string;
          id?: string;
          periodo_fim?: string;
          periodo_inicio?: string;
          resumo?: Json;
          func_hash_assinado?: string | null;
          empresa_hash_assinado?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fechamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fechamentos_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
        ];
      };
      funcionarios: {
        Row: {
          ativo: boolean;
          cargo: string | null;
          cpf: string;
          created_at: string;
          dias_semana: number[] | null;
          empresa_id: string;
          escala: string;
          escala_inicio: string | null;
          foto_path: string | null;
          hora_entrada: string;
          hora_retorno_almoco: string;
          hora_saida: string;
          hora_saida_almoco: string;
          id: string;
          matricula: string;
          nome: string;
          senha_alterada_em: string | null;
          telefone: string | null;
          user_id: string | null;
          face_id: string | null;
          foto_status: string;
          foto_enviada_em: string | null;
          consentimento_biometria_em: string | null;
          desativado_em: string | null;
        };
        Insert: {
          ativo?: boolean;
          cargo?: string | null;
          cpf: string;
          created_at?: string;
          dias_semana?: number[] | null;
          empresa_id: string;
          escala?: string;
          escala_inicio?: string | null;
          foto_path?: string | null;
          hora_entrada?: string;
          hora_retorno_almoco?: string;
          hora_saida?: string;
          hora_saida_almoco?: string;
          id?: string;
          matricula: string;
          nome: string;
          senha_alterada_em?: string | null;
          telefone?: string | null;
          user_id?: string | null;
          face_id?: string | null;
          foto_status?: string;
          foto_enviada_em?: string | null;
          consentimento_biometria_em?: string | null;
          desativado_em?: string | null;
        };
        Update: {
          ativo?: boolean;
          cargo?: string | null;
          cpf?: string;
          created_at?: string;
          dias_semana?: number[] | null;
          empresa_id?: string;
          escala?: string;
          escala_inicio?: string | null;
          foto_path?: string | null;
          hora_entrada?: string;
          hora_retorno_almoco?: string;
          hora_saida?: string;
          hora_saida_almoco?: string;
          id?: string;
          matricula?: string;
          nome?: string;
          senha_alterada_em?: string | null;
          telefone?: string | null;
          user_id?: string | null;
          face_id?: string | null;
          foto_status?: string;
          foto_enviada_em?: string | null;
          consentimento_biometria_em?: string | null;
          desativado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "funcionarios_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      pontos: {
        Row: {
          data_hora: string;
          empresa_id: string;
          face_confianca: number | null;
          face_status: string | null;
          funcionario_id: string;
          id: string;
          latitude: number;
          longitude: number;
          origem: string;
          selfie_path: string | null;
          solicitacao_id: string | null;
          tipo: Database["public"]["Enums"]["ponto_tipo"];
          distancia_m: number | null;
          fora_do_raio: boolean;
        };
        Insert: {
          data_hora?: string;
          empresa_id: string;
          face_confianca?: number | null;
          face_status?: string | null;
          funcionario_id: string;
          id?: string;
          latitude: number;
          longitude: number;
          origem?: string;
          selfie_path?: string | null;
          solicitacao_id?: string | null;
          tipo: Database["public"]["Enums"]["ponto_tipo"];
          distancia_m?: number | null;
          fora_do_raio?: boolean;
        };
        Update: {
          data_hora?: string;
          empresa_id?: string;
          face_confianca?: number | null;
          face_status?: string | null;
          funcionario_id?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          origem?: string;
          selfie_path?: string | null;
          solicitacao_id?: string | null;
          tipo?: Database["public"]["Enums"]["ponto_tipo"];
          distancia_m?: number | null;
          fora_do_raio?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pontos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pontos_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitacoes_ponto: {
        Row: {
          analisado_em: string | null;
          created_at: string;
          data_hora: string;
          empresa_id: string;
          funcionario_id: string;
          id: string;
          latitude: number;
          longitude: number;
          motivo: string;
          observacao: string | null;
          status: string;
          tipo: Database["public"]["Enums"]["ponto_tipo"];
        };
        Insert: {
          analisado_em?: string | null;
          created_at?: string;
          data_hora: string;
          empresa_id: string;
          funcionario_id: string;
          id?: string;
          latitude: number;
          longitude: number;
          motivo: string;
          observacao?: string | null;
          status?: string;
          tipo: Database["public"]["Enums"]["ponto_tipo"];
        };
        Update: {
          analisado_em?: string | null;
          created_at?: string;
          data_hora?: string;
          empresa_id?: string;
          funcionario_id?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          motivo?: string;
          observacao?: string | null;
          status?: string;
          tipo?: Database["public"]["Enums"]["ponto_tipo"];
        };
        Relationships: [
          {
            foreignKeyName: "solicitacoes_ponto_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitacoes_ponto_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitacoes_cadastro: {
        Row: {
          analisado_em: string | null;
          ativado_em: string | null;
          codigo_expira_em: string | null;
          codigo_hash: string | null;
          created_at: string;
          documento: string;
          email: string;
          empresa_id: string | null;
          id: string;
          ip: string | null;
          mensagem: string | null;
          observacao: string | null;
          qtd_funcionarios: number | null;
          razao_social: string;
          responsavel: string;
          status: string;
          telefone: string | null;
          tipo_documento: string;
        };
        Insert: {
          analisado_em?: string | null;
          ativado_em?: string | null;
          codigo_expira_em?: string | null;
          codigo_hash?: string | null;
          created_at?: string;
          documento: string;
          email: string;
          empresa_id?: string | null;
          id?: string;
          ip?: string | null;
          mensagem?: string | null;
          observacao?: string | null;
          qtd_funcionarios?: number | null;
          razao_social: string;
          responsavel: string;
          status?: string;
          telefone?: string | null;
          tipo_documento: string;
        };
        Update: {
          analisado_em?: string | null;
          ativado_em?: string | null;
          codigo_expira_em?: string | null;
          codigo_hash?: string | null;
          created_at?: string;
          documento?: string;
          email?: string;
          empresa_id?: string | null;
          id?: string;
          ip?: string | null;
          mensagem?: string | null;
          observacao?: string | null;
          qtd_funcionarios?: number | null;
          razao_social?: string;
          responsavel?: string;
          status?: string;
          telefone?: string | null;
          tipo_documento?: string;
        };
        Relationships: [];
      };
      redefinicoes_senha: {
        Row: {
          codigo_hash: string;
          created_at: string;
          empresa_id: string;
          expira_em: string;
          id: string;
          origem: string;
          usado_em: string | null;
        };
        Insert: {
          codigo_hash: string;
          created_at?: string;
          empresa_id: string;
          expira_em: string;
          id?: string;
          origem: string;
          usado_em?: string | null;
        };
        Update: {
          codigo_hash?: string;
          created_at?: string;
          empresa_id?: string;
          expira_em?: string;
          id?: string;
          origem?: string;
          usado_em?: string | null;
        };
        Relationships: [];
      };
      tentativas: {
        Row: {
          chave: string;
          criado_em: string;
          id: number;
        };
        Insert: {
          chave: string;
          criado_em?: string;
          id?: number;
        };
        Update: {
          chave?: string;
          criado_em?: string;
          id?: number;
        };
        Relationships: [];
      };
      terminal_logs: {
        Row: {
          acao: string;
          data_hora: string;
          detalhe: string | null;
          empresa_id: string;
          funcionario_id: string | null;
          id: string;
        };
        Insert: {
          acao: string;
          data_hora?: string;
          detalhe?: string | null;
          empresa_id: string;
          funcionario_id?: string | null;
          id?: string;
        };
        Update: {
          acao?: string;
          data_hora?: string;
          detalhe?: string | null;
          empresa_id?: string;
          funcionario_id?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terminal_logs_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terminal_logs_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_superadmin: { Args: never; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      my_empresa_id: { Args: never; Returns: string };
      my_funcionario_empresa_id: { Args: never; Returns: string };
      my_funcionario_id: { Args: never; Returns: string };
    };
    Enums: {
      app_role: "admin" | "funcionario" | "superadmin";
      ponto_tipo: "ENTRADA" | "SAIDA_ALMOCO" | "RETORNO_ALMOCO" | "SAIDA";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "funcionario", "superadmin"],
      ponto_tipo: ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"],
    },
  },
} as const;
