/* eslint-disable @typescript-eslint/no-explicit-any -- cada modelo de e-mail tem props próprias */
import type { ComponentType } from "react";
import { template as codigoSenhaEmpresa } from "./codigo-senha-empresa";
import { redefinirSenha } from "./redefinir-senha";
import { ativacao, novaSolicitacao, solicitacaoRecebida, solicitacaoRecusada } from "./cadastro";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  "codigo-senha-empresa": codigoSenhaEmpresa,
  "nova-solicitacao": novaSolicitacao,
  "solicitacao-recebida": solicitacaoRecebida,
  ativacao: ativacao,
  "solicitacao-recusada": solicitacaoRecusada,
  "redefinir-senha": redefinirSenha,
};
