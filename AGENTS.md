# PontoFlex — notas para quem mexe no código

- Produto da NOMANDUZ - TECH and IA. Infra própria: Supabase + Vercel + AWS Rekognition + e-mail (SMTP/Resend).
- Reconhecimento facial: AWS Rekognition (`src/lib/face.server.ts`), uma coleção por empresa. Rosto de referência só vale depois de aprovado pelo administrador.
- Captura no aparelho: MediaPipe Face Landmarker (`src/components/FaceCapture.tsx` + `src/lib/face-guia.ts`): enquadrar → piscar → captura automática. Arquivos servidos de `public/mediapipe` (gerado por `scripts/copiar-mediapipe.mjs`).
- Falha do serviço facial nunca pode ser tratada como "rosto não reconhecido".
- Nunca chame `signInWithPassword` no cliente `supabaseAdmin`: use `src/integrations/supabase/auth-check.server.ts`.
- Funções que leem cabeçalhos da requisição ficam em `src/lib/requisicao.server.ts` e são importadas dentro dos handlers.
- Toda mudança de banco: nova migração em `drizzle/migrations/NNNN_*.sql`, atualizar `src/integrations/supabase/types.ts` e `src/test/banco.test.ts`.
- Antes de commitar: `bun run typecheck`, `bun run test`, `bun run lint`, `bun run build`.
