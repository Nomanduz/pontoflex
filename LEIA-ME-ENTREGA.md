# PontoFlex — entrega do código-fonte

Este ZIP é o código-fonte do aplicativo web completo, não um SDK de integração nem um APK.

## Conteúdo
- Telas da empresa, funcionário e terminal facial.
- Funções de servidor, autenticação, armazenamento, escalas, marcações e folhas.
- Migrações SQL e definições de esquema.
- Configurações do projeto, dependências declaradas e testes.

## O que não acompanha
- Senhas, chaves de serviços, sessões, arquivos de ambiente, fotos ou dados do banco.
- Histórico Git, dependências instaladas e compilação do aplicativo.
- Contas antigas de demonstração: a criação delas foi retirada apenas da cópia exportada.
- Configuração interna de hospedagem e pagamentos vinculada ao projeto.

## Para o desenvolvedor
1. Descompacte e instale Bun; execute `bun install`.
2. Configure as variáveis de ambiente do seu destino. O cliente lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; o servidor lê `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
3. No Lovable Cloud, os acessos privilegiados e a chave de IA são fornecidos pelo ambiente gerenciado. Eles não são exportáveis. Para hospedagem independente, obtenha credenciais próprias do serviço escolhido e configure o cliente servidor e os serviços de IA/e-mail correspondentes.
4. Revise e aplique as migrações SQL na ordem numérica. Configurações de autenticação, armazenamento privado `faces`, envio de e-mail e permissões de serviços devem ser verificadas no destino; um ZIP não transfere esses serviços nem usuários automaticamente.
5. Execute `bun run dev` e `bunx vitest run`.
6. O arquivo `src/routeTree.gen.ts` é gerado automaticamente pelo roteador ao iniciar o projeto. Os contratos de IA em `src/generated/ai-gateway` são declarações necessárias e foram mantidos.
7. A implantação independente exige configurar hospedagem compatível com TanStack Start e os serviços utilizados. Este pacote não é uma migração pronta de dados ou infraestrutura.

## Verificação desta entrega
- 33 testes passaram na versão exportada antes da etapa final de empacotamento.
- Captura ajustada para salvar o mesmo recorte central 3x4 mostrado na tela, sem ampliar artificialmente a fotografia.
- Falhas de serviço diferenciadas de rosto não reconhecido; aprovação mínima de 70% mantida.
- A comparação atual por IA não é um motor biométrico treinável nem prova certificada de pessoa ao vivo. Não houve treinamento do modelo.
- Não foi validada uma identificação positiva com o rosto real do usuário; o terminal não abriu com a antiga senha de demonstração durante a verificação.
- Planos e checkout ainda não estão implementados.
