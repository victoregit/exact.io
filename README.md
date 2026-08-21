# EXACT.io

Jogo web de precisão temporal. O jogador conhece um tempo-alvo, inicia a rodada sem qualquer cronômetro visível e tenta parar no milissegundo correto.

## Mecânica

Uma rodada apresenta o alvo, executa uma contagem regressiva e oculta todas as referências temporais. O jogador para por toque, clique ou tecla `SPACE`; o resultado compara o tempo medido com `performance.now()` ao alvo usando o erro absoluto.

## Stack

- Next.js, React, TypeScript e Tailwind CSS no frontend
- Fastify e TypeScript no servidor
- pnpm workspaces no monorepo
- Vitest para testes automatizados
- ESLint e Prettier para qualidade de código

O foco atual é exclusivamente single-player. PostgreSQL, Prisma, Socket.IO, multiplayer e sistemas competitivos permanecem fora do escopo até a experiência Solo estar sólida.

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
- [x] Fase 1 — Protótipo Solo
- [ ] Fase 2 — Sistema de pontuação
- [ ] Fase 3 — Sessão Solo de cinco rodadas
- [ ] Polimento Solo — UX, mobile, áudio e acessibilidade
- [ ] Futuro — Multiplayer, competição e demais modos

## Status atual

A Fase 1 está implementada: rodada Solo completa com alvo aleatório em centésimos entre 3 e 15 segundos, contagem regressiva, tempo oculto, controles por toque/clique/teclado, prevenção de parada duplicada e feedback de precisão em milissegundos. Pontuação e sessões de cinco rodadas não foram antecipadas.
