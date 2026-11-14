# PontoFlex

Ponto eletrônico para pequenas e médias empresas, com reconhecimento facial no estilo totem (enquadrar o rosto, piscar e confirmar), localização com cerca opcional, escalas de trabalho, fechamento mensal e assinatura eletrônica da folha.

Um produto **NOMANDUZ - TECH and IA**.

## Como funciona

| Quem | Entra com | O que faz |
|---|---|---|
| Empresa | CPF **ou** CNPJ + senha | Funcionários, aprovação de rostos, registros, ajustes, fechamento, terminal e local permitido |
| Funcionário | CPF/CNPJ da empresa + matrícula + senha | Bate ponto pelo celular, vê o espelho, pede ajuste e assina a folha |
| Totem (`/terminal`) | CPF/CNPJ + senha mestra | **Leitura:** enquadrar → piscar → conferir dados → Confirmar. **Cadastro:** o funcionário cadastra o rosto com a própria senha |
| Equipe Nomanduz (`/nomanduz`) | e-mail + senha | Aprova empresas, envia código de ativação, suspende ou exclui empresas |

**Entrada de novas empresas:** em `/cadastro` a empresa pede acesso. O pedido chega por e-mail à equipe Nomanduz (`NOMANDUZ_ADMIN_EMAIL`). Ao aprovar no painel, a empresa recebe o link com o código de ativação (válido por 7 dias), cria a senha e começa um teste de 30 dias. Ainda não há cobrança.

### Reconhecimento facial
- No aparelho, o MediaPipe acompanha o rosto: pede para enquadrar no oval, aproximar ou afastar, olhar de frente e **piscar**. A foto é tirada sozinha, com os olhos abertos, logo depois da piscada.
- No servidor, o **AWS Rekognition** procura o rosto entre os funcionários da empresa numa única consulta, com similaridade mínima de 95% (ajustável).
- O rosto de referência só passa a valer depois que o **administrador aprova** a foto. Cada marcação guarda a foto e a localização para auditoria.
- A piscada dificulta fraudes com foto impressa. **Não é** prova certificada de pessoa viva: um vídeo da pessoa ainda pode enganar a câmera. Para esse nível de proteção, o próximo passo é o *Rekognition Face Liveness*.

### Regras de negócio
- Sequência: ENTRADA → SAÍDA ALMOÇO → RETORNO ALMOÇO → SAÍDA. A hora é sempre a do servidor, e a sequência é validada no banco.
- Escalas: 5x2, 6x1, 4x3, 5x1, 6x2, 12x36, 24x48, 24x72 e personalizada, inclusive turnos que cruzam a meia-noite.
- Fechamento do dia 21 ao dia 20. Feriados nacionais não contam como falta. Variações de até 10 minutos por dia são desconsideradas (CLT, art. 58, § 1º).
- Assinatura eletrônica simples em duas etapas (funcionário e depois empresa), com reconfirmação de senha, IP e hash. A assinatura só grava se o conteúdo for exatamente o que a pessoa conferiu.
- Funcionário com registros **não pode ser excluído**, só desativado, porque o histórico precisa ser guardado.

## Primeira instalação (infra própria)

Você vai precisar de contas gratuitas ou baratas em: **Supabase** (banco), **Vercel** (hospedagem), **AWS** (Rekognition) e **Gmail** ou **Resend** (e-mail).

1. **Dependências:** instale o [Bun](https://bun.sh) e rode `bun install`.
2. **Supabase:** crie um projeto em supabase.com (região São Paulo).
   - Em *Authentication → Providers → Email*, **desative "Allow new users to sign up"**. Todas as contas são criadas pelo servidor.
   - Copie `.env.example` para `.env` e preencha as chaves do Supabase e o `DATABASE_URL`.
3. **Banco:** `bun run db:migrate` aplica as migrações em ordem e cria o bucket privado `faces`.
4. **Segredo:** gere o `APP_SECRET` com o comando que está no `.env.example`.
5. **AWS Rekognition:** crie um usuário IAM sem acesso ao console, anexe a política gerenciada `AmazonRekognitionFullAccess` (ou a política mínima abaixo), gere uma chave de acesso e coloque no `.env`. Confira com `bun run testar-aws`.
   ```json
   { "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": [
     "rekognition:CreateCollection", "rekognition:DeleteCollection", "rekognition:IndexFaces",
     "rekognition:SearchFacesByImage", "rekognition:DeleteFaces"], "Resource": "*" }] }
   ```
6. **E-mail:** no Gmail `academiadaprevencaobr@gmail.com`, ative a verificação em 2 etapas, crie uma *senha de app* e coloque em `SMTP_PASS`. Quando tiver domínio próprio, prefira o Resend.
7. **Acesso da equipe:** `bun run criar-superadmin` cria o login do painel `/nomanduz` com o `NOMANDUZ_ADMIN_EMAIL`.
8. **Rodar localmente:** `bun run dev` e abra http://localhost:8080.
9. **Publicar:** importe o repositório na Vercel, cadastre as mesmas variáveis do `.env` (menos `DATABASE_URL`) e publique. Depois ajuste `APP_URL` para o endereço final.

## Desenvolvimento

```sh
bun run dev         # servidor local (porta 8080)
bun run test        # testes (inclui o banco real em PGlite)
bun run typecheck   # TypeScript
bun run lint        # ESLint + Prettier
bun run build       # build de produção
```

Tecnologia: TanStack Start (React 19 + Vite), Tailwind CSS v4, shadcn/ui, Supabase (PostgreSQL com RLS, Auth e Storage), AWS Rekognition, MediaPipe Face Landmarker.

## Pendências antes de cobrar clientes
- **Jurídico:** revisar `/termos`. Confirmar com contador ou advogado se o produto deve atender à Portaria MTP nº 671/2021 como REP-P, o que exige arquivos AFD/AEJ, atestado técnico e registro no INPI. Hoje o espelho é só para conferência.
- **LGPD:** nomear um encarregado (DPO) e publicar o canal de contato. A biometria é processada pela AWS, possivelmente fora do Brasil.
- **Planos e pagamento:** ainda não implementados. O status da empresa (teste/ativa/suspensa) já existe para isso.
