# Arquitetura de ranking e multiplayer

## Responsabilidades

- **Navegador/Next.js:** interface, nickname e uma chave aleatória local do jogador.
- **Fastify + Socket.IO no Render:** autoridade da partida, medição dos tempos, validação das tentativas, salas e gravação dos resultados.
- **PostgreSQL na Aiven:** identidade pseudônima, melhor resultado diário e rankings Diário/Semanal/Mensal.

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
Aiven PostgreSQL: ranking_players + solo_daily_scores + views de ranking
```

Na primeira implantação, o Socket.IO roda em uma única instância do Render e mantém as salas em memória. Antes de escalar horizontalmente, as salas e eventos deverão usar um adaptador compartilhado, porque jogadores conectados a instâncias diferentes precisam receber o mesmo estado.

## Próximas integrações

1. Criar o PostgreSQL gratuito na Aiven e copiar a Service URI.
2. Informar essa URI como `DATABASE_URL` somente no serviço Fastify do Render.
3. Aplicar automaticamente as migrations antes de cada deploy da API.
4. Informar as URLs públicas da API e do frontend nas variáveis solicitadas.
5. Validar rankings, gravação do Daily e uma sala em dois navegadores.
