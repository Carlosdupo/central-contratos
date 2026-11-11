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
      alocacoes: {
        Row: {
          bloqueio_motivo: string | null
          created_at: string
          id: string
          integracao_data: string | null
          liberado_em: string | null
          obra_id: string
          situacao: Database["public"]["Enums"]["situacao_alocacao"]
          updated_at: string
          vinculo_id: string
        }
        Insert: {
          bloqueio_motivo?: string | null
          created_at?: string
          id?: string
          integracao_data?: string | null
          liberado_em?: string | null
          obra_id: string
          situacao?: Database["public"]["Enums"]["situacao_alocacao"]
          updated_at?: string
          vinculo_id: string
        }
        Update: {
          bloqueio_motivo?: string | null
          created_at?: string
          id?: string
          integracao_data?: string | null
          liberado_em?: string | null
          obra_id?: string
          situacao?: Database["public"]["Enums"]["situacao_alocacao"]
          updated_at?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
        ]
      }
      assinantes_fluxo: {
        Row: {
          ordem: number
          papel: Database["public"]["Enums"]["papel"]
          rotulo: string
        }
        Insert: {
          ordem: number
          papel: Database["public"]["Enums"]["papel"]
          rotulo: string
        }
        Update: {
          ordem?: number
          papel?: Database["public"]["Enums"]["papel"]
          rotulo?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          assinado_em: string
          assinado_por: string
          contratacao_id: string
          ordem: number
        }
        Insert: {
          assinado_em?: string
          assinado_por: string
          contratacao_id: string
          ordem: number
        }
        Update: {
          assinado_em?: string
          assinado_por?: string
          contratacao_id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_assinado_por_fkey"
            columns: ["assinado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_ordem_fkey"
            columns: ["ordem"]
            isOneToOne: false
            referencedRelation: "assinantes_fluxo"
            referencedColumns: ["ordem"]
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
      avisos_vencimento: {
        Row: {
          criado_em: string
          documento_id: string
          marco: number
          validade: string
        }
        Insert: {
          criado_em?: string
          documento_id: string
          marco: number
          validade: string
        }
        Update: {
          criado_em?: string
          documento_id?: string
          marco?: number
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_vencimento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacao_etapas: {
        Row: {
          concluida_em: string | null
          concluida_por: string | null
          contratacao_id: string
          etapa: number
          iniciada_em: string | null
          situacao: Database["public"]["Enums"]["situacao_etapa"]
        }
        Insert: {
          concluida_em?: string | null
          concluida_por?: string | null
          contratacao_id: string
          etapa: number
          iniciada_em?: string | null
          situacao?: Database["public"]["Enums"]["situacao_etapa"]
        }
        Update: {
          concluida_em?: string | null
          concluida_por?: string | null
          contratacao_id?: string
          etapa?: number
          iniciada_em?: string | null
          situacao?: Database["public"]["Enums"]["situacao_etapa"]
        }
        Relationships: [
          {
            foreignKeyName: "contratacao_etapas_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacao_etapas_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacoes: {
        Row: {
          cancelamento_motivo: string | null
          codigo: string
          created_at: string
          criado_por: string
          empresa_id: string | null
          fluxo_versao: number
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string
          limite_obra: number
          negociacao_pulada: boolean
          obra_id: string
          pacote: string | null
          prazos: Json
          servico: string
          sienge_contrato: string | null
          sienge_solicitacao: string | null
          situacao: Database["public"]["Enums"]["situacao_contratacao"]
          tipo: Database["public"]["Enums"]["tipo_contratacao"]
          updated_at: string
          valor_negociado: number | null
          valor_orcado: number
        }
        Insert: {
          cancelamento_motivo?: string | null
          codigo: string
          created_at?: string
          criado_por?: string
          empresa_id?: string | null
          fluxo_versao?: number
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          limite_obra: number
          negociacao_pulada?: boolean
          obra_id: string
          pacote?: string | null
          prazos?: Json
          servico: string
          sienge_contrato?: string | null
          sienge_solicitacao?: string | null
          situacao?: Database["public"]["Enums"]["situacao_contratacao"]
          tipo: Database["public"]["Enums"]["tipo_contratacao"]
          updated_at?: string
          valor_negociado?: number | null
          valor_orcado: number
        }
        Update: {
          cancelamento_motivo?: string | null
          codigo?: string
          created_at?: string
          criado_por?: string
          empresa_id?: string | null
          fluxo_versao?: number
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          limite_obra?: number
          negociacao_pulada?: boolean
          obra_id?: string
          pacote?: string | null
          prazos?: Json
          servico?: string
          sienge_contrato?: string | null
          sienge_solicitacao?: string | null
          situacao?: Database["public"]["Enums"]["situacao_contratacao"]
          tipo?: Database["public"]["Enums"]["tipo_contratacao"]
          updated_at?: string
          valor_negociado?: number | null
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          cnpj: string
          contratacao_id: string
          created_at: string
          created_by: string | null
          escolhida: boolean
          escolhida_por: string | null
          fornecedor: string
          id: string
          prazo_dias: number | null
          valor: number
        }
        Insert: {
          cnpj: string
          contratacao_id: string
          created_at?: string
          created_by?: string | null
          escolhida?: boolean
          escolhida_por?: string | null
          fornecedor: string
          id?: string
          prazo_dias?: number | null
          valor: number
        }
        Update: {
          cnpj?: string
          contratacao_id?: string
          created_at?: string
          created_by?: string | null
          escolhida?: boolean
          escolhida_por?: string | null
          fornecedor?: string
          id?: string
          prazo_dias?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_escolhida_por_fkey"
            columns: ["escolhida_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "documentos_vinculo_fk"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
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
      envio_itens: {
        Row: {
          arquivo_id: string | null
          decidido_em: string | null
          decidido_por: string | null
          decisao: Database["public"]["Enums"]["decisao_documento"] | null
          documento_id: string
          envio_id: string
          id: string
          motivo: string | null
        }
        Insert: {
          arquivo_id?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: Database["public"]["Enums"]["decisao_documento"] | null
          documento_id: string
          envio_id: string
          id?: string
          motivo?: string | null
        }
        Update: {
          arquivo_id?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: Database["public"]["Enums"]["decisao_documento"] | null
          documento_id?: string
          envio_id?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envio_itens_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "documento_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envio_itens_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envio_itens_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envio_itens_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios_analise"
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
          {
            foreignKeyName: "envios_vinculo_fk"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
        ]
      }
      etapa_checklist: {
        Row: {
          contratacao_id: string
          etapa: number
          item: number
          marcado: boolean
          marcado_em: string | null
          marcado_por: string | null
        }
        Insert: {
          contratacao_id: string
          etapa: number
          item: number
          marcado?: boolean
          marcado_em?: string | null
          marcado_por?: string | null
        }
        Update: {
          contratacao_id?: string
          etapa?: number
          item?: number
          marcado?: boolean
          marcado_em?: string | null
          marcado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etapa_checklist_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_checklist_marcado_por_fkey"
            columns: ["marcado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_fluxo: {
        Row: {
          dependencias: number[]
          etapa: number
          itens: string[]
          nome: string
          papel: Database["public"]["Enums"]["papel"] | null
          pode_pular: boolean
          responsavel: string
          trilha: string
          versao: number
        }
        Insert: {
          dependencias?: number[]
          etapa: number
          itens?: string[]
          nome: string
          papel?: Database["public"]["Enums"]["papel"] | null
          pode_pular?: boolean
          responsavel: string
          trilha: string
          versao?: number
        }
        Update: {
          dependencias?: number[]
          etapa?: number
          itens?: string[]
          nome?: string
          papel?: Database["public"]["Enums"]["papel"] | null
          pode_pular?: boolean
          responsavel?: string
          trilha?: string
          versao?: number
        }
        Relationships: []
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
      notificacoes: {
        Row: {
          assunto: string
          canal: string
          criado_em: string
          destinatario: string
          empresa_id: string | null
          enviado_em: string | null
          erro: string | null
          id: string
          situacao: Database["public"]["Enums"]["situacao_notificacao"]
          tentativas: number
          texto: string
        }
        Insert: {
          assunto: string
          canal?: string
          criado_em?: string
          destinatario: string
          empresa_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          situacao?: Database["public"]["Enums"]["situacao_notificacao"]
          tentativas?: number
          texto: string
        }
        Update: {
          assunto?: string
          canal?: string
          criado_em?: string
          destinatario?: string
          empresa_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          situacao?: Database["public"]["Enums"]["situacao_notificacao"]
          tentativas?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
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
      pessoas: {
        Row: {
          cpf: string
          created_at: string
          created_by: string | null
          foto_path: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          created_by?: string | null
          foto_path?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          created_by?: string | null
          foto_path?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_created_by_fkey"
            columns: ["created_by"]
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
      vinculos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          eletricidade: boolean
          empresa_id: string
          funcao: string
          id: string
          pessoa_id: string
          tipo: Database["public"]["Enums"]["tipo_vinculo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          eletricidade?: boolean
          empresa_id: string
          funcao: string
          id?: string
          pessoa_id: string
          tipo: Database["public"]["Enums"]["tipo_vinculo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          eletricidade?: boolean
          empresa_id?: string
          funcao?: string
          id?: string
          pessoa_id?: string
          tipo?: Database["public"]["Enums"]["tipo_vinculo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          decidido_em: string | null
          decidido_por: string | null
          documento_foto_nome: string
          documento_foto_path: string
          id: string
          motivo: string | null
          obra_id: string
          situacao: Database["public"]["Enums"]["situacao_visita"]
          vinculo_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          decidido_em?: string | null
          decidido_por?: string | null
          documento_foto_nome: string
          documento_foto_path: string
          id?: string
          motivo?: string | null
          obra_id: string
          situacao?: Database["public"]["Enums"]["situacao_visita"]
          vinculo_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          decidido_em?: string | null
          decidido_por?: string | null
          documento_foto_nome?: string
          documento_foto_path?: string
          id?: string
          motivo?: string | null
          obra_id?: string
          situacao?: Database["public"]["Enums"]["situacao_visita"]
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_contratacao: {
        Args: {
          p_obra: string
          p_pacote: string
          p_servico: string
          p_tipo: Database["public"]["Enums"]["tipo_contratacao"]
          p_valor: number
        }
        Returns: string
      }
      assinar_contrato: {
        Args: { p_contratacao: string; p_ordem: number }
        Returns: undefined
      }
      buscar_pessoas: {
        Args: { p_termo: string }
        Returns: {
          cpf_mascarado: string
          empresa: string
          funcao: string
          integracao_data: string
          nome: string
          obra: string
          situacao: Database["public"]["Enums"]["situacao_alocacao"]
          tipo: Database["public"]["Enums"]["tipo_vinculo"]
          vinculo_id: string
        }[]
      }
      cadastrar_pessoa: {
        Args: {
          p_cpf: string
          p_eletricidade: boolean
          p_empresa: string
          p_funcao: string
          p_nome: string
          p_obra: string
          p_telefone: string
          p_tipo: Database["public"]["Enums"]["tipo_vinculo"]
        }
        Returns: string
      }
      cancelar_contratacao: {
        Args: { p_contratacao: string; p_motivo: string }
        Returns: undefined
      }
      concluir_envio: {
        Args: {
          p_assunto: string
          p_data_integracao: string
          p_envio: string
          p_texto: string
        }
        Returns: string
      }
      concluir_etapa: {
        Args: { p_contratacao: string; p_etapa: number }
        Returns: undefined
      }
      cpf_mascarado: { Args: { p_pessoa: string }; Returns: string }
      decidir_documento: {
        Args: {
          p_decisao: Database["public"]["Enums"]["decisao_documento"]
          p_item: string
          p_motivo?: string
        }
        Returns: undefined
      }
      decidir_visita: {
        Args: {
          p_aprovar: boolean
          p_assunto: string
          p_motivo: string
          p_texto: string
          p_visita: string
        }
        Returns: undefined
      }
      enviar_documentos_empresa: {
        Args: { p_empresa: string }
        Returns: string
      }
      enviar_documentos_pessoa: { Args: { p_vinculo: string }; Returns: string }
      escolher_fornecedor: { Args: { p_cotacao: string }; Returns: undefined }
      marcar_item: {
        Args: {
          p_contratacao: string
          p_etapa: number
          p_item: number
          p_marcado: boolean
        }
        Returns: undefined
      }
      processar_vencimentos: { Args: { p_hoje: string }; Returns: Json }
      pular_negociacao: { Args: { p_contratacao: string }; Returns: undefined }
      reabrir_etapa: {
        Args: { p_contratacao: string; p_etapa: number; p_motivo: string }
        Returns: undefined
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
      registrar_arquivo_pessoa: {
        Args: {
          p_data_emissao?: string
          p_data_validade?: string
          p_mime: string
          p_nome: string
          p_sha256: string
          p_storage_path: string
          p_tamanho: number
          p_tipo: string
          p_vinculo: string
        }
        Returns: string
      }
      registrar_cotacao: {
        Args: {
          p_cnpj: string
          p_contratacao: string
          p_fornecedor: string
          p_prazo: number
          p_valor: number
        }
        Returns: string
      }
      registrar_foto_pessoa: {
        Args: { p_storage_path: string; p_vinculo: string }
        Returns: undefined
      }
      registrar_integracao: {
        Args: {
          p_alocacao: string
          p_assunto: string
          p_nova_data: string
          p_presente: boolean
          p_texto: string
        }
        Returns: undefined
      }
      registrar_primeiro_acesso: {
        Args: { p_empresa: string }
        Returns: undefined
      }
      salvar_campo_etapa: {
        Args: { p_contratacao: string; p_etapa: number; p_valor: string }
        Returns: undefined
      }
      salvar_texto_empresa: {
        Args: { p_empresa: string; p_texto: string; p_tipo: string }
        Returns: string
      }
      solicitar_visita: {
        Args: {
          p_data: string
          p_nome: string
          p_obra: string
          p_storage_path: string
          p_vinculo: string
        }
        Returns: string
      }
    }
    Enums: {
      abrangencia_feriado: "nacional" | "estadual" | "municipal"
      aplica_a_documento: "empresa" | "funcionario" | "socio_diario"
      condicao_documento: "sempre" | "eletricidade" | "mais_de_5_na_obra"
      decisao_documento: "aprovado" | "reprovado"
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
      situacao_alocacao:
        | "rascunho"
        | "em_analise"
        | "pendente"
        | "aguardando_empresa"
        | "integracao_agendada"
        | "liberado"
        | "bloqueado"
      situacao_contratacao: "em_andamento" | "liberada" | "cancelada"
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
      situacao_etapa: "pendente" | "em_andamento" | "concluida" | "pulada"
      situacao_notificacao: "pendente" | "enviada" | "erro"
      situacao_visita: "solicitada" | "aprovada" | "recusada"
      tipo_contratacao: "unico" | "contrato" | "aditivo"
      tipo_usuario: "interno" | "externo"
      tipo_vinculo: "funcionario" | "socio_diario" | "socio_esporadico"
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
      decisao_documento: ["aprovado", "reprovado"],
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
      situacao_alocacao: [
        "rascunho",
        "em_analise",
        "pendente",
        "aguardando_empresa",
        "integracao_agendada",
        "liberado",
        "bloqueado",
      ],
      situacao_contratacao: ["em_andamento", "liberada", "cancelada"],
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
      situacao_etapa: ["pendente", "em_andamento", "concluida", "pulada"],
      situacao_notificacao: ["pendente", "enviada", "erro"],
      situacao_visita: ["solicitada", "aprovada", "recusada"],
      tipo_contratacao: ["unico", "contrato", "aditivo"],
      tipo_usuario: ["interno", "externo"],
      tipo_vinculo: ["funcionario", "socio_diario", "socio_esporadico"],
    },
  },
} as const
