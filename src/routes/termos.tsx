import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/Brand";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de uso e privacidade — PontoFlex" }] }),
  component: Termos,
});

// Texto-base para revisão jurídica antes do lançamento comercial.
function Termos() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-sm leading-relaxed">
      <Brand className="text-primary" />
      <h1 className="font-display text-2xl font-bold">Termos de uso e política de privacidade</h1>
      <p className="text-muted-foreground">
        Versão preliminar · PontoFlex, um produto NOMANDUZ - TECH and IA.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. O serviço</h2>
        <p>
          O PontoFlex registra a jornada de trabalho dos funcionários da empresa contratante, com
          reconhecimento facial, localização, espelho de ponto, fechamento mensal e assinatura
          eletrônica simples da folha.
        </p>
        <p>
          A empresa contratante é a controladora dos dados dos seus funcionários (LGPD, art. 5º,
          VI). A Nomanduz atua como operadora, tratando os dados apenas para prestar o serviço.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Dados tratados</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Da empresa: CPF ou CNPJ, nome, responsável, e-mail e telefone.</li>
          <li>
            Dos funcionários: nome, CPF, matrícula, cargo, escala, marcações de ponto com data, hora
            e localização.
          </li>
          <li>
            Biometria facial (dado pessoal sensível, art. 11): foto de referência aprovada pela
            empresa e foto tirada a cada marcação, usadas só para confirmar a identidade no registro
            de ponto. O funcionário dá o consentimento no cadastro do rosto.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Onde ficam e quem acessa</h2>
        <p>
          Os dados ficam em banco de dados com controle de acesso por empresa. As fotos ficam em
          armazenamento privado. A comparação facial é feita pelo serviço Amazon Rekognition (Amazon
          Web Services), que pode processar os dados fora do Brasil, com as salvaguardas contratuais
          do provedor (LGPD, art. 33).
        </p>
        <p>
          Só a própria empresa, o próprio funcionário (seus dados) e a equipe técnica da Nomanduz,
          quando necessário para suporte, têm acesso.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Guarda e exclusão</h2>
        <p>
          Os registros de ponto são mantidos enquanto a empresa usar o serviço, para cumprir
          obrigações trabalhistas. O funcionário pode pedir à empresa a exclusão da sua biometria
          quando deixar de usar o sistema. Ao encerrar o contrato, a empresa pode pedir a exportação
          e a exclusão definitiva dos dados.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. Assinatura e validade legal</h2>
        <p>
          A assinatura da folha é eletrônica simples (MP 2.200-2/2001, art. 10, § 2º). O espelho de
          ponto serve para conferência e não substitui os arquivos fiscais (AFD/AEJ) da Portaria MTP
          nº 671/2021. Cabe à empresa confirmar, com seu contador ou advogado, a adequação do
          sistema às suas obrigações.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. Período de teste</h2>
        <p>
          Novas empresas têm um período de teste gratuito. Planos pagos serão informados antes de
          qualquer cobrança.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. Contato</h2>
        <p>
          Dúvidas, pedidos sobre dados pessoais ou suporte: responda qualquer e-mail do PontoFlex ou
          fale com a empresa onde você trabalha.
        </p>
      </section>

      <Link to="/login" className="inline-block text-primary underline">
        Voltar
      </Link>
    </main>
  );
}
