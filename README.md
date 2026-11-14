# PontoFlex

Sistema de registro de ponto eletrônico para pequenas e médias empresas, com reconhecimento facial, geolocalização, escalas de trabalho, fechamento mensal e assinatura eletrônica da folha de ponto.

## Áreas do sistema

### Empresa (administrador)
Login com **CNPJ + senha** em `/login` (aba Empresa).

- **Dashboard** (`/admin`) — indicadores do dia: presentes, ausentes, marcações.
- **Funcionários** (`/admin/funcionarios`) — cadastrar, editar, desativar, excluir, definir escala, redefinir rosto. A senha do funcionário é **gerada automaticamente** (alfanumérica, 8 caracteres) e exibida uma única vez.
- **Registros** (`/admin/registros`) — consulta de marcações com link para o mapa.
- **Fechamento** (`/admin/fechamento`) — gera as folhas do período e assina como empresa.
- **Terminal** (`/admin/terminal`) — define as senhas mestras e mostra o log de atividades do totem.

### Totem / terminal (`/terminal`)
Uso sem login do funcionário. Desbloqueado com **CNPJ + senha mestra**:

- **Senha mestra de leitura** — modo registro de ponto: o funcionário toca na tela, a câmera captura o rosto, aparecem nome, matrícula e CPF para confirmação e a marcação é gravada com localização.
- **Senha mestra de cadastro** — modo cadastro facial de funcionários que ainda não têm rosto de referência.

Todas as ações ficam registradas no log do terminal.

### Funcionário
Login com **matrícula + senha gerada pela empresa** em `/login` (aba Funcionário).

- **Ponto** (`/ponto`) — relógio, registro com selfie + GPS e comprovante.
- **Histórico** (`/ponto/historico`) — espelho de ponto e jornada.
- **Folhas** (`/ponto/folhas`) — conferir e assinar a folha do período.
- **Folha** (`/folha/:id`) — versão imprimível da folha assinada.

## Regras de negócio

- **Sequência de marcações:** ENTRADA → SAÍDA ALMOÇO → RETORNO ALMOÇO → SAÍDA.
- **Jornada padrão:** 08:00 / 12:00 / 13:00 / 17:00.
- **Escalas suportadas:** 5x2, 6x1, 4x3, 5x1, 6x2, 12x36, 24x48, 24x72 e personalizada (inclusive jornadas que cruzam a meia-noite).
- **Período de fechamento:** do dia **21** de um mês ao dia **20** do mês seguinte.
- **Reconhecimento facial:** comparação por IA com a foto de referência; confiança mínima de 70%.
- **Assinatura da folha:** eletrônica simples, em duas etapas (funcionário e empresa), com reconfirmação de senha, data/hora, IP, localização e hash de integridade. Não é assinatura ICP-Brasil — a adequação legal deve ser confirmada com um profissional.

## Credenciais

Credenciais e dados reais não acompanham este pacote. Use os acessos atuais da empresa, nunca senhas antigas de demonstração.

## Planos (previsto)

Cobrança por funcionário ativo por mês: Gratuito, Básico e Pro. O checkout será ativado quando o pagamento for habilitado no projeto.

## Tecnologia

- TanStack Start (React 19 + Vite), Tailwind CSS v4, shadcn/ui
- Lovable Cloud (PostgreSQL, autenticação, armazenamento) com RLS
- Lovable AI para comparação facial

## Rodando localmente

```sh
bun install
bun run dev
```

Testes:

```sh
bunx vitest run
```
