# EXACT.io

Jogo web de precisão temporal. O jogador conhece um tempo-alvo, inicia a rodada sem qualquer cronômetro visível e tenta parar no milissegundo correto.

## Mecânica

Uma rodada apresenta o alvo, executa uma contagem regressiva e oculta todas as referências temporais. O resultado compara o tempo estimado pelo jogador ao alvo usando o erro absoluto. A mecânica Solo será implementada na próxima fase.

## Stack

- Next.js, React, TypeScript e Tailwind CSS no frontend
- Fastify e TypeScript no servidor
- pnpm workspaces no monorepo
- Vitest para testes automatizados
- ESLint e Prettier para qualidade de código

PostgreSQL, Prisma e Socket.IO serão adicionados somente quando as fases correspondentes do roadmap exigirem.

## Arquitetura

```text
apps/
  web/       aplicação Next.js
  server/    API Fastify
packages/
  shared/    tipos e constantes compartilhados
```

## Como executar

Requisitos: Node.js 20.9 ou superior e pnpm 11.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

O frontend inicia em `http://localhost:3000` e a API em `http://localhost:3001`. O health check está disponível em `GET http://localhost:3001/health` e responde com:

```json
{ "status": "ok" }
```

No Windows PowerShell, use `Copy-Item .env.example .env` em vez de `cp` se necessário.

## Variáveis de ambiente

| Variável              | Padrão                  | Uso                           |
| --------------------- | ----------------------- | ----------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL pública da API            |
| `HOST`                | `0.0.0.0`               | Interface de rede do servidor |
| `PORT`                | `3001`                  | Porta do servidor             |
| `WEB_ORIGIN`          | `http://localhost:3000` | Origem permitida pelo CORS    |

## Scripts

| Comando             | Descrição                                  |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | inicia frontend e backend simultaneamente  |
| `pnpm build`        | compila todos os workspaces                |
| `pnpm lint`         | executa o ESLint em todos os workspaces    |
| `pnpm test`         | executa os testes de todos os workspaces   |
| `pnpm format`       | formata o repositório com Prettier         |
| `pnpm format:check` | verifica a formatação sem alterar arquivos |

## Roadmap

- [x] Fase 0 — Fundação do projeto
- [ ] Fase 1 — Protótipo Solo
- [ ] Fase 2 — Sistema de pontuação
- [ ] Fase 3 — Sessão Solo de cinco rodadas
- [ ] Fases 4–20 — Multiplayer, competição e evolução do produto

## Status atual

A Fase 0 está implementada: monorepo, frontend, backend, configurações de qualidade, comandos unificados e health check testado. Nenhuma funcionalidade de gameplay ou persistência foi antecipada.
