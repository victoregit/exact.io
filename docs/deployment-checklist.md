# Checklist de implantação

## 1. Aiven PostgreSQL

1. Criar um serviço PostgreSQL no plano gratuito e na região mais próxima disponível.
2. Copiar a **Service URI** da página de conexão.
3. Não versionar a URI, porque ela contém usuário e senha do banco.

## 2. Render Blueprint

1. Conectar o repositório e criar um Blueprint usando `render.yaml`.
2. Informar os valores solicitados:
   - `DATABASE_URL`: Service URI do PostgreSQL da Aiven.
   - `WEB_ORIGIN`: URL pública do `exact-web`, sem barra final.
   - `NEXT_PUBLIC_API_URL`: URL pública do `exact-api`, sem barra final.
3. O Render gera `DEVICE_KEY_SECRET` automaticamente.
4. A migration em `database/migrations` é executada pelo `preDeployCommand` da API.
5. Aguardar o banco e os dois serviços concluírem o primeiro deploy.
6. Se `NEXT_PUBLIC_API_URL` for alterada depois, disparar novo deploy do frontend porque variáveis `NEXT_PUBLIC_*` entram no bundle durante o build.

### Limites do plano gratuito

O PostgreSQL gratuito da Aiven tem 1 GB, uma instância por organização e limite de 20 conexões. Ele não expira, possui backups e pode ser desligado por inatividade; nesse caso, pode ser religado no painel.

## 3. Verificação

1. Abrir `https://<api>/health` e confirmar `{ "status": "ok" }`.
2. Abrir `https://<api>/ready` e confirmar `{ "database": "ready" }`.
3. Abrir `https://<web>/ranking` e confirmar que as três abas carregam sem erro.
4. Jogar as cinco rodadas do Daily com um nickname.
5. Confirmar a mensagem de resultado salvo.
6. Reabrir as abas Diário, Semanal e Mensal e conferir o mesmo jogador.
7. Jogar novamente com resultado inferior e confirmar que o melhor diário não piora.
8. Testar uma sala privada em dois navegadores diferentes.

## 4. Antes de produção pública

- Ajustar os limites conforme o tráfego real e alertar sobre respostas `429`.
- Registrar erros da API sem armazenar a chave local bruta.
- Monitorar conexões Socket.IO e falhas de reconexão.
- Usar uma instância sem suspensão para evitar atraso no primeiro acesso.
- Adicionar estado compartilhado antes de escalar o servidor horizontalmente.
