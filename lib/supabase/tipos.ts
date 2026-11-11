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
      acessos_documentos: {
        Row: {
          arquivo_id: string
          em: string
          id: number
          usuario_id: string
        }
        Insert: {
          arquivo_id: string
          em?: string
          id?: never
          usuario_id?: string
        }
        Update: {
          arquivo_id?: string
          em?: string
          id?: never
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acessos_documentos_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "documento_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acessos_documentos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          antes: Json | null
          ator: string | null
          depois: Json | null
          em: string
          id: number
          registro_id: string | null
          tabela: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          ator?: string | null
          depois?: Json | null
          em?: string
          id?: never
          registro_id?: string | null
          tabela: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          ator?: string | null
          depois?: Json | null
          em?: string
          id?: never
          registro_id?: string | null
          tabela?: string
        }
        Relationships: []
      }
      documento_arquivos: {
        Row: {
          documento_id: string
          enviado_em: string
          enviado_por: string
          id: string
          mime: string
          nome_original: string
          sha256: string
          storage_path: string
          tamanho: number
        }
        Insert: {
          documento_id: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          mime: string
          nome_original: string
          sha256: string
          storage_path: string
          tamanho: number
        }
        Update: {
          documento_id?: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          mime?: string
          nome_original?: string
          sha256?: string
          storage_path?: string
          tamanho?: number
        }
        Relationships: [
          {
            foreignKeyName: "documento_arquivos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_arquivos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          arquivo_atual_id: string | null
          competencia: string | null
          created_at: string
          data_emissao: string | null
          data_validade: string | null
          empresa_id: string
          id: string
          motivo_reprovacao: string | null
          situacao: Database["public"]["Enums"]["situacao_documento"]
          tipo_documento: string
          updated_at: string
          valor_texto: string | null
          vinculo_id: string | null
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          arquivo_atual_id?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_validade?: string | null
          empresa_id: string
          id?: string
          motivo_reprovacao?: string | null
          situacao?: Database["public"]["Enums"]["situacao_documento"]
          tipo_documento: string
          updated_at?: string
          valor_texto?: string | null
          vinculo_id?: string | null
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          arquivo_atual_id?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_validade?: string | null
          empresa_id?: string
          id?: string
          motivo_reprovacao?: string | null
          situacao?: Database["public"]["Enums"]["situacao_documento"]
          tipo_documento?: string
          updated_at?: string
          valor_texto?: string | null
          vinculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_arquivo_atual_fk"
            columns: ["arquivo_atual_id"]
            isOneToOne: false
            referencedRelation: "documento_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tipo_documento_fkey"
            columns: ["tipo_documento"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["codigo"]
          },
        ]
      }
      empresa_obras: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          empresa_id: string
          obra_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id: string
          obra_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_obras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_obras_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_usuarios: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          responsavel: boolean
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          responsavel?: boolean
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          responsavel?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_usuarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_terceiras: {
        Row: {
          cnpj: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          razao_social: string
          situacao: Database["public"]["Enums"]["situacao_empresa"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          razao_social: string
          situacao?: Database["public"]["Enums"]["situacao_empresa"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          razao_social?: string
          situacao?: Database["public"]["Enums"]["situacao_empresa"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_terceiras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      envios_analise: {
        Row: {
          concluido_em: string | null
          concluido_por: string | null
          empresa_id: string
          enviado_em: string
          enviado_por: string
          id: string
          situacao: Database["public"]["Enums"]["situacao_envio"]
          vinculo_id: string | null
        }
        Insert: {
          concluido_em?: string | null
          concluido_por?: string | null
          empresa_id: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          situacao?: Database["public"]["Enums"]["situacao_envio"]
          vinculo_id?: string | null
        }
        Update: {
          concluido_em?: string | null
          concluido_por?: string | null
          empresa_id?: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          situacao?: Database["public"]["Enums"]["situacao_envio"]
          vinculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envios_analise_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_analise_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_analise_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          abrangencia: Database["public"]["Enums"]["abrangencia_feriado"]
          cidade: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          uf: string | null
        }
        Insert: {
          abrangencia: Database["public"]["Enums"]["abrangencia_feriado"]
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          descricao: string
          id?: string
          uf?: string | null
        }
        Update: {
          abrangencia?: Database["public"]["Enums"]["abrangencia_feriado"]
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feriados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      matriz_documental: {
        Row: {
          aplica_a: Database["public"]["Enums"]["aplica_a_documento"]
          ativo: boolean
          condicao: Database["public"]["Enums"]["condicao_documento"]
          id: string
          tipo_documento: string
        }
        Insert: {
          aplica_a: Database["public"]["Enums"]["aplica_a_documento"]
          ativo?: boolean
          condicao?: Database["public"]["Enums"]["condicao_documento"]
          id?: string
          tipo_documento: string
        }
        Update: {
          aplica_a?: Database["public"]["Enums"]["aplica_a_documento"]
          ativo?: boolean
          condicao?: Database["public"]["Enums"]["condicao_documento"]
          id?: string
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriz_documental_tipo_documento_fkey"
            columns: ["tipo_documento"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["codigo"]
          },
        ]
      }
      obras: {
        Row: {
          ativa: boolean
          cidade: string
          codigo: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          uf: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cidade: string
          codigo: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          uf: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cidade?: string
          codigo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros: {
        Row: {
          chave: string
          descricao: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          chave: string
          descricao: string
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "parametros_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_documento: {
        Row: {
          aceita_texto: boolean
          ativo: boolean
          chave_validade: string | null
          codigo: string
          escopo: Database["public"]["Enums"]["escopo_documento"]
          nome: string
          observacao: string | null
          ordem: number
          regra_validade: Database["public"]["Enums"]["regra_validade"]
          sensivel: boolean
        }
        Insert: {
          aceita_texto?: boolean
          ativo?: boolean
          chave_validade?: string | null
          codigo: string
          escopo: Database["public"]["Enums"]["escopo_documento"]
          nome: string
          observacao?: string | null
          ordem?: number
          regra_validade: Database["public"]["Enums"]["regra_validade"]
          sensivel?: boolean
        }
        Update: {
          aceita_texto?: boolean
          ativo?: boolean
          chave_validade?: string | null
          codigo?: string
          escopo?: Database["public"]["Enums"]["escopo_documento"]
          nome?: string
          observacao?: string | null
          ordem?: number
          regra_validade?: Database["public"]["Enums"]["regra_validade"]
          sensivel?: boolean
        }
        Relationships: []
      }
      usuario_obras: {
        Row: {
          created_at: string
          created_by: string | null
          obra_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          obra_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          obra_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_obras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_obras_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_obras_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_papeis: {
        Row: {
          created_at: string
          created_by: string | null
          papel: Database["public"]["Enums"]["papel"]
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          papel: Database["public"]["Enums"]["papel"]
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          papel?: Database["public"]["Enums"]["papel"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_papeis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_papeis_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          nome: string
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enviar_documentos_empresa: {
        Args: { p_empresa: string }
        Returns: string
      }
      registrar_acesso_arquivo: { Args: { p_arquivo: string }; Returns: string }
      registrar_arquivo_empresa: {
        Args: {
          p_competencia?: string
          p_data_emissao?: string
          p_data_validade?: string
          p_empresa: string
          p_mime: string
          p_nome: string
          p_sha256: string
          p_storage_path: string
          p_tamanho: number
          p_tipo: string
        }
        Returns: string
      }
      registrar_primeiro_acesso: {
        Args: { p_empresa: string }
        Returns: undefined
      }
      salvar_texto_empresa: {
        Args: { p_empresa: string; p_texto: string; p_tipo: string }
        Returns: string
      }
    }
    Enums: {
      abrangencia_feriado: "nacional" | "estadual" | "municipal"
      aplica_a_documento: "empresa" | "funcionario" | "socio_diario"
      condicao_documento: "sempre" | "eletricidade" | "mais_de_5_na_obra"
      escopo_documento: "empresa" | "pessoa"
      papel:
        | "admin"
        | "coordenador_obra"
        | "suprimentos"
        | "gerente_suprimentos"
        | "contratos"
        | "direcao"
        | "rh"
        | "sst"
      regra_validade:
        | "meses_apos_emissao"
        | "data_informada"
        | "sem_validade"
        | "mensal"
      situacao_documento:
        | "anexado"
        | "enviado"
        | "aprovado"
        | "reprovado"
        | "vencido"
      situacao_empresa:
        | "convidada"
        | "cadastro_incompleto"
        | "em_analise"
        | "pendente"
        | "aprovada"
        | "bloqueada"
      situacao_envio: "aberto" | "concluido"
      tipo_usuario: "interno" | "externo"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      abrangencia_feriado: ["nacional", "estadual", "municipal"],
      aplica_a_documento: ["empresa", "funcionario", "socio_diario"],
      condicao_documento: ["sempre", "eletricidade", "mais_de_5_na_obra"],
      escopo_documento: ["empresa", "pessoa"],
      papel: [
        "admin",
        "coordenador_obra",
        "suprimentos",
        "gerente_suprimentos",
        "contratos",
        "direcao",
        "rh",
        "sst",
      ],
      regra_validade: [
        "meses_apos_emissao",
        "data_informada",
        "sem_validade",
        "mensal",
      ],
      situacao_documento: [
        "anexado",
        "enviado",
        "aprovado",
        "reprovado",
        "vencido",
      ],
      situacao_empresa: [
        "convidada",
        "cadastro_incompleto",
        "em_analise",
        "pendente",
        "aprovada",
        "bloqueada",
      ],
      situacao_envio: ["aberto", "concluido"],
      tipo_usuario: ["interno", "externo"],
    },
  },
} as const
