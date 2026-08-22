# Arquitetura de ranking e multiplayer

## Responsabilidades

- **Navegador/Next.js:** interface, nickname e uma chave aleatória local do jogador.
- **Fastify + Socket.IO no Render:** autoridade da partida, medição dos tempos, validação das tentativas, salas e gravação dos resultados.
- **Postgres no Supabase:** identidade pseudônima, melhor resultado diário e rankings Diário/Semanal/Mensal.

O navegador nunca envia uma pontuação pronta para o banco. Ele envia ações ao servidor; o servidor calcula o resultado e grava usando uma credencial disponível apenas no Render.

## Cálculo dos períodos

- **Diário:** melhor resultado do jogador naquele dia.
- **Semanal:** soma dos melhores resultados diários de segunda a domingo.
- **Mensal:** soma dos melhores resultados diários do primeiro ao último dia do mês.
- **Desempate:** menor diferença em milissegundos; persistindo, mesma posição.

As datas do produto serão calculadas na API usando `America/Sao_Paulo` antes da gravação em `played_on`.

## Conexões

```text
Navegadores
   │ HTTPS + WSS
   ▼
Render: Next.js + Fastify/Socket.IO
   │ conexão Postgres protegida
   ▼
Supabase: ranking_players + solo_daily_scores + views de ranking
```

Na primeira implantação, o Socket.IO roda em uma única instância do Render e mantém as salas em memória. Antes de escalar horizontalmente, as salas e eventos deverão usar um adaptador compartilhado, porque jogadores conectados a instâncias diferentes precisam receber o mesmo estado.

## Próximas integrações

1. Aplicar a migration no projeto Supabase.
2. Adicionar `DATABASE_URL` somente ao serviço Fastify no Render.
3. Criar endpoints de envio do melhor Daily e consulta dos três rankings.
4. Gerar e salvar a chave local do jogador; enviar apenas seu hash ao banco.
5. Criar a tela de ranking com abas Diário, Semanal e Mensal.
6. Adicionar rate limit, validação server-side e auditoria básica contra resultados falsos.
