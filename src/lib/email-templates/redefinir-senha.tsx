import React from "react";
import { Button, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Layout, box, button, code, muted, text } from "./layout";

interface Props {
  razao_social?: string;
  responsavel?: string | null;
  link?: string;
  codigo?: string;
  validade?: string;
}

/** "Esqueci minha senha" da empresa: link de uso único para criar uma senha nova. */
export const redefinirSenha = {
  component: (p: Props) => (
    <Layout preview="Redefinir a senha do PontoFlex">
      <Text style={text}>Olá{p.responsavel ? `, ${p.responsavel}` : ""}!</Text>
      <Text style={text}>
        Recebemos um pedido para redefinir a senha de acesso de <b>{p.razao_social}</b> ao
        PontoFlex. Clique no botão para criar uma senha nova.
      </Text>
      <Section style={{ margin: "20px 0" }}>
        <Button href={p.link} style={button}>
          Criar nova senha
        </Button>
      </Section>
      <Text style={text}>Se o botão não funcionar, abra o link e digite o código:</Text>
      <Section style={box}>
        <Text style={code}>{p.codigo ?? "XXXX-XXXX-XXXX"}</Text>
      </Section>
      <Text style={muted}>
        O link vale por {p.validade ?? "1 hora"} e só pode ser usado uma vez. Se você não pediu,
        ignore este e-mail: sua senha atual continua valendo.
      </Text>
    </Layout>
  ),
  subject: "Redefinir a senha — PontoFlex",
  displayName: "Redefinição de senha da empresa",
  previewData: {
    razao_social: "Padaria Pão Quente",
    responsavel: "Maria",
    link: "https://pontoflex.app/redefinir?codigo=K7QF2MZP9TXA",
    codigo: "K7QF-2MZP-9TXA",
    validade: "1 hora",
  },
} satisfies TemplateEntry;
