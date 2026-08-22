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

O Solo, o Daily e a base multiplayer estão ativos. As salas usam Socket.IO e o próximo eixo de implementação é persistir rankings globais no Postgres do Supabase.

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
- [x] Fase 2 — Sistema de pontuação
- [x] Fase 3 — Sessão Solo de cinco rodadas (melhor resultado de cinco)
- [x] Recordes locais — score, precisão e partidas jogadas
- [x] Daily local — mesmos cinco alvos e melhor resultado do dia
- [x] Polimento Solo inicial — áudio, preferência de som e feedback visual
- [x] Fundação em tempo real — Socket.IO e eventos compartilhados
- [x] Lobby de salas privadas — criação, convite e entrada por código
- [x] Modo Duplas 2v2 — equipes AB/CD e turnos A → C → B → D
- [x] Regras competitivas — fechamento quando todos jogam ou em alvo × 2, sem campeão antecipado e desempate extra
- [x] Regra Verificar Tempo — um uso por jogador em cada rodada
- [x] Início sincronizado — host inicia, alvo compartilhado e primeiro turno definido pelo servidor
- [x] Prontidão da sala — convidados marcam Ready e o host libera o início
- [x] Turnos cronometrados — medição no servidor e avanço sincronizado da ordem
- [x] Verificação sincronizada — um uso por jogador, resultado e ponto após todos confirmarem
- [x] Avanço configurável — host inicia a próxima rodada ou ativa o modo automático
- [x] Contagem por turno — alvo visível, preparação 3–2–1 e cronômetro iniciado pelo servidor
- [x] Limite do turno — encerramento automático ao atingir alvo × 2
- [x] Schema de rankings — melhor diário e agregações semanal/mensal
- [ ] Concluir partidas privadas — desafio, eliminação e reconexão
- [x] API de ranking — gravação validada e consultas por período
- [x] Tela de ranking — abas Diário, Semanal e Mensal
- [x] Integração Solo → ranking — nickname local e envio automático do melhor Daily
- [ ] Deploy Render + Supabase — variáveis, migrations e observabilidade
- [ ] Polimento Solo contínuo — mobile e acessibilidade
- [ ] Escala multiplayer — estado compartilhado para múltiplas instâncias

## Status atual

A sessão Solo e o Daily permanecem funcionais. O multiplayer possui lobby privado em memória, Ready, turnos cronometrados, verificação, placar e modos Pontos/Eliminatório/Duplas. O schema do Supabase preserva somente o melhor resultado diário de cada jogador; os rankings semanal e mensal somam esses melhores resultados diários. Consulte `docs/ranking-architecture.md` para o desenho da implantação.
