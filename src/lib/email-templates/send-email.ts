/* eslint-disable @typescript-eslint/no-explicit-any -- cada modelo de e-mail tem props próprias */
// Somente servidor. Envia e-mails por SMTP (ex.: Gmail com senha de app) ou pela API do Resend.
import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";

export type SendTemplateEmailResult = { sent: true } | { sent: false; reason: "nao_configurado" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>;
  replyTo?: string;
  /** Mantido por compatibilidade; o envio direto não deduplica. */
  idempotencyKey?: string;
}

/** E-mail da equipe Nomanduz que recebe as solicitações de cadastro. */
export const emailNomanduz = () =>
  process.env["NOMANDUZ_ADMIN_EMAIL"] || "academiadaprevencaobr@gmail.com";

function remetente() {
  return (
    process.env["EMAIL_FROM"] ||
    (process.env["SMTP_USER"]
      ? `PontoFlex <${process.env["SMTP_USER"]}>`
      : "PontoFlex <onboarding@resend.dev>")
  );
}

async function enviar(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | undefined;
}): Promise<SendTemplateEmailResult> {
  if (process.env["RESEND_API_KEY"]) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!r.ok) {
      const corpo = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        `Falha no envio de e-mail (Resend ${r.status}${corpo?.message ? `: ${corpo.message}` : ""})`,
      );
    }
    return { sent: true };
  }
  if (process.env["SMTP_HOST"] && process.env["SMTP_USER"] && process.env["SMTP_PASS"]) {
    const nodemailer = await import("nodemailer");
    const porta = Number(process.env["SMTP_PORT"] ?? 465);
    const transporte = nodemailer.createTransport({
      host: process.env["SMTP_HOST"],
      port: porta,
      secure: porta === 465,
      auth: { user: process.env["SMTP_USER"], pass: process.env["SMTP_PASS"] },
    });
    await transporte.sendMail({
      from: remetente(),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
    });
    return { sent: true };
  }
  if (process.env["NODE_ENV"] === "production")
    throw new Error("Envio de e-mail não configurado (SMTP ou RESEND_API_KEY).");
  console.warn(`[email não configurado] Para: ${msg.to} | ${msg.subject}\n${msg.text}`);
  return { sent: false, reason: "nao_configurado" };
}

/** Diagnóstico sem expor segredos: qual caminho de envio está ativo e com qual remetente. */
export function configuracaoEmail() {
  const chave = process.env["RESEND_API_KEY"] ?? "";
  return {
    resend: chave
      ? `sim (começa com "${chave.slice(0, 3)}", ${chave.length} caracteres${/\s|"|'/.test(chave) ? ", CONTÉM ESPAÇO OU ASPAS" : ""})`
      : "não configurado",
    remetente: remetente(),
    smtp: process.env["SMTP_HOST"] ? "configurado (usado só sem Resend)" : "não configurado",
  };
}

export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) throw new Error(`Modelo de e-mail '${templateName}' não encontrado.`);
  const recipient = template.to || to;
  if (!recipient) throw new Error("Destinatário obrigatório");
  const data = options.templateData ?? {};
  const element = React.createElement(template.component, data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(data) : template.subject;
  return enviar({ to: recipient, subject, html, text, replyTo: options.replyTo });
}
