<div align="center">
  <img src="apps/web/public/exact-logo-final.png" width="150" alt="EXACT.io Logo">

# EXACT.io

**Desafie sua percepção do tempo ao milissegundo exato.**

Um jogo web competitivo de precisão temporal e reflexos em tempo real. Memorize o tempo-alvo, sinta o ritmo sem nenhum cronômetro visível e craqueie a parada exata no milissegundo certo contra jogadores do mundo todo.

![Versão](https://img.shields.io/badge/versão-0.1.0-6366f1?style=for-the-badge)
![Plataformas](https://img.shields.io/badge/Web%20%7C%20Mobile%20%7C%20Desktop-1e1b4b?style=for-the-badge)
![Status](https://img.shields.io/badge/status-online%20%2F%20beta-10b981?style=for-the-badge)
</div>

---

## Modos de Jogo & Acesso

| Modo                      | Descrição                                                          |   Status   |
| ------------------------- | ------------------------------------------------------------------ | :--------: |
| **Solo Challenge**        | Sessão de 5 rodadas com alvos dinâmicos e recordes locais          | Disponível |
| **Daily Challenge**       | Mesmos 5 alvos para todos no dia com ranking global unificado      | Disponível |
| **Multiplayer 1v1 / FFA** | Salas privadas com turnos cronometrados e modo Pontos/Eliminatório | Disponível |
| **Duplas 2v2**            | Disputa cooperativa e competitiva em duplas (turnos A → C → B → D) | Disponível |
| **Rankings Globais**      | Classificação Diária, Semanal e Mensal com PostgreSQL na nuvem     | Disponível |

> O jogo é otimizado para navegadores modernos em computadores, tablets e smartphones (PWA / Touch / Teclado com tecla `SPACE`).

---

## Integridade e Autoridade de Servidor

O EXACT.io foi desenhado com foco em competição justa, alta fidelidade temporal e proteção anti-cheat:

- **Autoridade do Servidor:** o navegador nunca envia pontuações prontas. Todas as ações, contagens regressivas e travas de tempo são calculadas e validadas pela API Fastify + Socket.IO antes de qualquer gravação.
- **Identidade Pseudonimizada:** cada jogador possui uma credencial gerada localmente e protegida por hash HMAC (`DEVICE_KEY_SECRET`), garantindo privacidade e impedindo falsificação de perfil.
- **Precisão de Hardware:** medições locais utilizam a API de alta precisão `performance.now()`, com sincronização rigorosa de eventos no servidor.

---

## O que é o EXACT.io?

O **EXACT.io** é um jogo web multiplayer criado para testar a intuição, foco e senso de tempo humano levados ao limite do milissegundo.

A premissa parece simples, mas é altamente viciante e desafiadora: você recebe um tempo-alvo (por exemplo, exatamente `3.450s` ou `5.120s`), acompanha uma breve contagem regressiva de preparação (3... 2... 1...) e, no momento em que a contagem termina, **todas as referências visuais de tempo desaparecem**.

Você precisa confiar unicamente no seu ritmo mental interno e travar o cronômetro no instante exato.

O resultado não é apenas "ganhou ou perdeu". O jogo analisa o seu erro absoluto com precisão milimétrica:

- **Medição em milissegundos:** cálculo exato do desvio positivo ou negativo em relação ao alvo;
- **Feedback audiovisual imersivo:** efeitos sonoros táteis e sinalizações visuais instantâneas;
- **Desafio diário compartilhado:** alvos iguais no mundo inteiro para comparar recordes legítimos;
- **Lobbies multiplayer em tempo real:** crie sua sala com código, chame amigos e jogue em turnos sincronizados;
- **Mecânica estratégica "Verificar Tempo":** use 1 verificação por rodada para analisar o andamento e recalibrar o ritmo;
- **Tabelas de classificação com desempate justo:** rankings agregados diários, semanais e mensais.

---

## Como funciona uma partida?

### 1. Conheça o tempo-alvo

A rodada apresenta o objetivo temporal exato que deve ser atingido (ex: `4.200s`).

### 2. Contagem regressiva de foco

Uma preparação 3-2-1 sincronizada prepara o jogador para o início da contagem.

### 3. Blackout temporal

Todas as referências visuais somem da tela. Nenhum cronômetro corre à vista: o controle está 100% na sua mente.

### 4. Trave no instante certo

Use a tecla `SPACE`, clique com o mouse ou dê um toque na tela do celular para cravar o momento exato em que você acredita que o alvo foi atingido.

### 5. Análise de precisão

O sistema calcula a diferença entre o tempo medido (`performance.now()`) e o tempo-alvo, revelando o erro absoluto (ex: `+14ms`, `-3ms` ou `0ms - EXACT!`).

### 6. Use a verificação estratégica

No modo multiplayer, cada competidor pode acionar o recurso **Verificar Tempo** uma vez por rodada para auditar o progresso e ajustar a tomada de decisão da equipe.

### 7. Dispute o pódio global

No Modo Daily, seu melhor resultado diário é enviado com segurança para a tabela de líderes, somando pontos para os rankings Semanal e Mensal.

---

## Principais recursos

### Precisão temporal sub-milissegundo

Utilização da API `performance.now()` do JavaScript combinada com validação no backend para garantir feedback ultra-preciso em cada tentativa.

### Multiplayer em tempo real com WebSockets

Arquitetura orientada a eventos com Socket.IO, permitindo lobbies com código de acesso, confirmação de prontidão (_Ready_), turnos automáticos e sincronização entre múltiplos jogadores.

### Modo Duplas 2v2 e Eliminatório

Suporte a formatos dinâmicos de jogo:

- **Pontos:** soma de precisão rodada a rodada;
- **Eliminatório:** sobrevive quem mantiver a menor margem de erro;
- **Duplas:** cooperação tática em turnos alternados ($A \to C \to B \to D$).

### Desafio Diário (Daily Challenge)

Um conjunto de cinco alvos gerados diariamente com a mesma semente para todos os participantes globais. Apenas a melhor pontuação de cada jogador em 24h conta para o ranking.

### Rankings com PostgreSQL na Aiven

Estrutura de dados relacional com views otimizadas para consultas instantâneas:

- **Diário:** melhor pontuação individual do dia atual;
- **Semanal:** somatório dos melhores desempenhos diários de segunda a domingo;
- **Mensal:** somatório acumulado durante todo o mês corrente;
- **Critério de desempate:** menor diferença total acumulada em milissegundos.

### Design Dark Futurista & Áudio Tátil

Interface visual moderna com tema escuro construída em Tailwind CSS, tipografia de alta legibilidade, animações suaves e efeitos sonoros sintéticos com opção de silenciamento.

---

## Privacidade e segurança

- Chaves de conexão ao banco e segredos HMAC (`DATABASE_URL`, `DEVICE_KEY_SECRET`) ficam estritamente isolados no ambiente do servidor;
- O navegador não envia pontuações nem cálculos prontos para a API;
- O rate limiting no Fastify previne abusos e tentativas automatizadas de brute-force;
- Identificação pseudônima por dispositivo sem necessidade de coleta de dados pessoais sensíveis;
- CORS restrito com cabeçalhos de segurança pré-configurados.

---

## Como executar o projeto localmente

### Requisitos

- **Node.js:** versão 20.9.0 ou superior;
- **pnpm:** versão 11.19.0 ou superior (`corepack enable && corepack prepare pnpm@11.19.0 --activate`);
- **PostgreSQL (opcional para rankings locais):** instância local ou serviço gerenciado (Aiven / Supabase).

### Instalação e inicialização

1. Clone o repositório e instale as dependências:

```bash
pnpm install
```

2. Configure as variáveis de ambiente:

```bash
# No Linux/macOS
cp .env.example .env

# No Windows PowerShell
Copy-Item .env.example .env
```

3. Inicie o ecossistema completo (Shared, Web e Server):

```bash
pnpm dev
```

O frontend iniciará em `http://localhost:3000` e o backend Fastify em `http://localhost:3001`.

---

## Variáveis de ambiente

| Variável              | Padrão                  | Descrição                                         |
| --------------------- | ----------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL pública da API Fastify                        |
| `HOST`                | `0.0.0.0`               | Interface de rede do servidor                     |
| `PORT`                | `3001`                  | Porta do servidor Fastify                         |
| `WEB_ORIGIN`          | `http://localhost:3000` | Origem permitida nas políticas de CORS            |
| `DATABASE_URL`        | —                       | String de conexão do PostgreSQL (Aiven)           |
| `DEVICE_KEY_SECRET`   | —                       | Chave secreta para assinatura HMAC do dispositivo |

---

## Scripts do monorepo

| Comando             | Descrição                                                       |
| ------------------- | --------------------------------------------------------------- |
| `pnpm dev`          | Inicia o frontend Next.js e o backend Fastify em paralelo       |
| `pnpm build`        | Compila todos os pacotes e aplicações do monorepo               |
| `pnpm lint`         | Executa a verificação estática do ESLint em todos os workspaces |
| `pnpm test`         | Roda os testes unitários e de integração com Vitest             |
| `pnpm format`       | Formata o código-fonte do projeto inteiro com Prettier          |
| `pnpm format:check` | Verifica a conformidade da formatação sem modificar arquivos    |

---

## Estrutura do projeto

```text
apps/
  web/              aplicação frontend Next.js 15 (React 19, Tailwind CSS)
  server/           API Fastify v5 com Socket.IO e driver PostgreSQL
packages/
  shared/           tipos TypeScript, contratos de eventos e constantes
database/
  migrations/       schemas e views de agregação do PostgreSQL
docs/
  ranking-architecture.md   desenho técnico de pontuação e anti-cheat
  deployment-checklist.md  guia passo a passo de deploy (Render + Aiven)
render.yaml         blueprint de infraestrutura para deploy no Render
```

---

## Roadmap e status

- [x] **Fase 0 — Fundação:** Monorepo pnpm, TypeScript e stack base
- [x] **Fase 1 — Protótipo Solo:** Medição com `performance.now()`, controles e feedback
- [x] **Fase 2 — Sistema de pontuação:** Erro absoluto em milissegundos e cálculo de precisão
- [x] **Fase 3 — Sessão Solo:** Modo 5 rodadas com estatísticas e recordes locais
- [x] **Daily local:** Alvos diários compartilhados e sincronização de melhor resultado
- [x] **Efeitos audiovisuais:** Sons táteis, sintetizador Web Audio e preferências do usuário
- [x] **Multiplayer em tempo real:** Socket.IO, lobbies por código e sistema de Ready
- [x] **Modos de jogo multiplayer:** Pontos, Eliminatório e Duplas 2v2 ($A \to C \to B \to D$)
- [x] **Regra "Verificar Tempo":** Checagem estratégica sincronizada por rodada
- [x] **Infraestrutura de ranking:** Banco PostgreSQL na Aiven com views diária, semanal e mensal
- [x] **API e telas de ranking:** Abas Diário, Semanal e Mensal com envio protegido
- [x] **Deploy Render Blueprint:** Serviços web/API configurados com health check
- [ ] Ativação das variáveis de produção no Render + Aiven
- [ ] Conclusão das salas privadas com reconexão resiliente e modo desafio direto
- [ ] Escala horizontal do multiplayer com Redis Adapter

---

<div align="center">
  <strong>EXACT.io v0.1.0</strong><br>
  Domine cada fração de segundo. Precisão absoluta, competição em tempo real.
</div>
