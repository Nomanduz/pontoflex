// Envia um exemplo de cada modelo de e-mail do app para conferir a entrega.
// Uso: bun run testar-email [destinatario]   (padrão: NOMANDUZ_ADMIN_EMAIL)
import { sendTemplateEmail, emailNomanduz } from "../src/lib/email-templates/send-email";
import { TEMPLATES } from "../src/lib/email-templates/registry";

const para = process.argv[2] || emailNomanduz();
const modelos = ["nova-solicitacao", "ativacao", "redefinir-senha"];

for (const nome of modelos) {
  const t = TEMPLATES[nome];
  if (!t) {
    console.log(`✗ ${nome}: modelo não existe`);
    continue;
  }
  try {
    const r = await sendTemplateEmail(nome, para, {
      templateData: { ...(t.previewData ?? {}), link: "https://pontoflex-d2ab.vercel.app" },
    });
    console.log(`${r.sent ? "✓" : "✗"} ${nome} → ${para}`);
  } catch (e) {
    console.log(`✗ ${nome}: ${(e as Error).message}`);
  }
}
