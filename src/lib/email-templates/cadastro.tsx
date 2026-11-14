import React from "react";
import { Button, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Layout, box, button, code, muted, row, text } from "./layout";

interface Solicitacao {
  razao_social?: string;
  documento?: string;
  tipo_documento?: string;
  responsavel?: string;
  email?: string;
  telefone?: string;
  qtd_funcionarios?: number | null;
  mensagem?: string | null;
  link?: string;
}

/** Para a equipe Nomanduz: nova empresa pediu acesso. */
export const novaSolicitacao = {
  component: (p: Solicitacao) => (
    <Layout preview={`Nova solicitação de cadastro: ${p.razao_social ?? ""}`}>
      <Text style={text}>Uma nova empresa pediu acesso ao PontoFlex.</Text>
      <Text style={row}>
        <b>Empresa:</b> {p.razao_social}
      </Text>
      <Text style={row}>
        <b>{p.tipo_documento}:</b> {p.documento}
      </Text>
      <Text style={row}>
        <b>Responsável:</b> {p.responsavel}
      </Text>
      <Text style={row}>
        <b>E-mail:</b> {p.email}
      </Text>
      <Text style={row}>
        <b>Telefone:</b> {p.telefone || "—"}
      </Text>
      <Text style={row}>
        <b>Funcionários:</b> {p.qtd_funcionarios ?? "—"}
      </Text>
      {p.mensagem && (
        <Text style={row}>
          <b>Mensagem:</b> {p.mensagem}
        </Text>
      )}
      <Section style={{ margin: "20px 0" }}>
        <Button href={p.link} style={button}>
          Analisar no painel Nomanduz
        </Button>
      </Section>
    </Layout>
  ),
  subject: (d: Solicitacao) => `Nova solicitação de cadastro — ${d.razao_social ?? "PontoFlex"}`,
  displayName: "Nova solicitação (equipe Nomanduz)",
  previewData: {
    razao_social: "Padaria Pão Quente",
    documento: "12.345.678/0001-95",
    tipo_documento: "CNPJ",
    responsavel: "Maria",
    email: "maria@exemplo.com",
    telefone: "(31) 99999-0000",
    qtd_funcionarios: 8,
    link: "https://pontoflex.app/nomanduz",
  },
} satisfies TemplateEntry;

/** Para quem pediu: confirmação de recebimento. */
export const solicitacaoRecebida = {
  component: (p: Solicitacao) => (
    <Layout preview="Recebemos sua solicitação de cadastro">
      <Text style={text}>Olá{p.responsavel ? `, ${p.responsavel}` : ""}!</Text>
      <Text style={text}>
        Recebemos o pedido de cadastro de <b>{p.razao_social}</b> no PontoFlex. Nossa equipe vai
        analisar e, assim que aprovado, você receberá por e-mail o link com o código de ativação.
      </Text>
      <Text style={muted}>Se não foi você, pode ignorar esta mensagem.</Text>
    </Layout>
  ),
  subject: "Recebemos sua solicitação — PontoFlex",
  displayName: "Solicitação recebida",
  previewData: { responsavel: "Maria", razao_social: "Padaria Pão Quente" },
} satisfies TemplateEntry;

/** Para quem pediu: aprovado, com link e código de ativação. */
export const ativacao = {
  component: (p: Solicitacao & { codigo?: string; validade?: string; diasTeste?: number }) => (
    <Layout preview="Seu acesso ao PontoFlex foi aprovado">
      <Text style={text}>Olá{p.responsavel ? `, ${p.responsavel}` : ""}!</Text>
      <Text style={text}>
        O cadastro de <b>{p.razao_social}</b> foi aprovado. Clique no botão para ativar o acesso e
        criar a senha da empresa. O período de teste é de {p.diasTeste ?? 30} dias.
      </Text>
      <Section style={{ margin: "20px 0" }}>
        <Button href={p.link} style={button}>
          Ativar meu acesso
        </Button>
      </Section>
      <Text style={text}>
        Se o botão não funcionar, acesse a página de ativação e digite o código:
      </Text>
      <Section style={box}>
        <Text style={code}>{p.codigo ?? "XXXX-XXXX-XXXX"}</Text>
      </Section>
      <Text style={muted}>
        O código vale até {p.validade ?? "7 dias"} e só pode ser usado uma vez. Login da empresa:{" "}
        {p.tipo_documento} {p.documento}.
      </Text>
    </Layout>
  ),
  subject: "Acesso aprovado: ative o PontoFlex",
  displayName: "Ativação de acesso",
  previewData: {
    responsavel: "Maria",
    razao_social: "Padaria Pão Quente",
    codigo: "K7QF-2MZP-9TXA",
    link: "https://pontoflex.app/ativar?codigo=K7QF2MZP9TXA",
    validade: "21/11/2026",
    tipo_documento: "CNPJ",
    documento: "12.345.678/0001-95",
    diasTeste: 30,
  },
} satisfies TemplateEntry;

/** Para quem pediu: não aprovado. */
export const solicitacaoRecusada = {
  component: (p: Solicitacao & { observacao?: string }) => (
    <Layout preview="Sobre sua solicitação de cadastro">
      <Text style={text}>Olá{p.responsavel ? `, ${p.responsavel}` : ""}!</Text>
      <Text style={text}>
        Não foi possível aprovar o cadastro de <b>{p.razao_social}</b> no momento.
      </Text>
      {p.observacao && <Text style={text}>Motivo: {p.observacao}</Text>}
      <Text style={muted}>Responda este e-mail se quiser falar com a nossa equipe.</Text>
    </Layout>
  ),
  subject: "Sua solicitação de cadastro — PontoFlex",
  displayName: "Solicitação recusada",
  previewData: {
    responsavel: "Maria",
    razao_social: "Padaria Pão Quente",
    observacao: "Documento não confere.",
  },
} satisfies TemplateEntry;
