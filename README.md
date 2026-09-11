# Ruta Direct — Gestor Comercial V1

Base demonstrativa em React + TypeScript + Vite e Cloudflare Worker, preparada para o primeiro deploy e posterior integração com o Supabase **gestor**.

Repositório: https://github.com/lnogueiralopes/gestor — branch `main`.

## Estado desta entrega

- Dashboard, Produtos e Kits em matrizes por conta/canal: Mercado Livre, Shopee e Ruta Direct Shop.
- Busca por SKU/nome e seleção individual ou de todos os resultados.
- Precificador com campos demonstrativos de margem, premissas e redução por kit.
- Telas demonstrativas de Contas e Usuários; Anúncios, Pedidos e Configurações são módulos futuros.
- Worker com saúde e status de presença de credenciais, sem validar conexão externa.
- Migrations PostgreSQL, seed opcional e testes locais de acesso.

**Ainda não há login, gravação de dados, cálculo real de preços, cadastro de usuários, OAuth ou envio aos marketplaces.** Os preços são ilustrativos; editar os campos não os recalcula. As ações não implementadas ficam desabilitadas. A interface continua demonstrativa mesmo se variáveis Supabase forem preenchidas. Não cadastre dados reais nesta interface.

## Instalar e validar

Use Node.js 22.12 ou superior (linha 22 indicada em `.nvmrc`) e npm.

```bash
npm ci
npm test
npm run build
npm run deploy:check
```

O lockfile fixa as versões usadas. `build` valida frontend, configuração e Worker com TypeScript e gera `dist/client` e `dist/ruta_direct_gestor`. `deploy:check` prepara o pacote sem publicar nem exigir credenciais de produção; execute após o build.

Para desenvolvimento: `npm run dev`. Para testar o build: `npm run preview`.
Sem arquivos `.env` ou `.dev.vars`, a demonstração e `/api/health` funcionam.

## Primeiro deploy na Cloudflare pelo GitHub

No painel da Cloudflare, abra **Workers & Pages**, crie/importe um Worker de um repositório Git e selecione `lnogueiralopes/gestor`.

| Campo | Valor |
|---|---|
| Nome do Worker | `ruta-direct-gestor` |
| Branch de produção | `main` |
| Diretório raiz | raiz do repositório (`/`) |
| Comando de build | `npm run build` |
| Comando de deploy | `npx wrangler deploy` |
| Node.js | 22.12 ou superior; use a linha 22 |

A instalação das dependências ocorre pelo lockfile no ambiente de build. Se houver configuração manual de instalação, use `npm ci`.
O nome do Worker deve coincidir com `wrangler.jsonc`. O Vite gera a configuração de saída utilizada pelo Wrangler; não configure um projeto Pages nem envie apenas `dist/client`.

**Nenhuma credencial Supabase, ML ou Shopee é necessária para este primeiro deploy demo.** Não copie os valores de exemplo como credenciais reais.

Alternativa pelo computador:

```bash
npx wrangler login
npm run deploy
```

Após o deploy, confira a URL `*.workers.dev` fornecida pela Cloudflare:

- `/`: Dashboard com aviso de demonstração.
- `/produtos` e `/kits`: devem abrir diretamente e sobreviver a recarregamento.
- `/api/health`: JSON com `ok: true` e `env: "demo"`.
- `/api/inexistente`: JSON de erro com status 404, nunca a página HTML.

O binding `ASSETS` atende o frontend; `/api/*` passa primeiro pelo Worker.

## Integração posterior com Supabase gestor

Esta etapa prepara o banco; não conecta automaticamente as telas da V1.

No SQL Editor do projeto **gestor**, em um banco novo, execute **na ordem**:

1. `supabase/migrations/001_initial_schema.sql`.
2. `supabase/migrations/002_access_hardening.sql`.
3. Opcionalmente `supabase/seed.sql`, somente para dados de demonstração.

As migrations são aplicadas uma vez. O seed pode ser repetido. Se a 001 já foi aplicada, execute somente a 002; não recrie tabelas. A 002 é transacional e falhará se já houver anúncios duplicados por produto/kit e conta; nesse caso revise os duplicados antes de reaplicar, sem apagar dados automaticamente.

Depois crie o primeiro usuário em Authentication e atribua o perfil pelo SQL Editor:

```sql
insert into public.profiles(id, full_name, is_admin)
select id, 'Administrador', true from auth.users where email = 'SEU_EMAIL'
on conflict (id) do update set is_admin = true;
```

A próxima implementação deve incluir login Supabase Auth, criação de perfis, CRUD autorizado e associação de usuários às contas. As políticas verificam usuário ativo, permissão funcional e conta autorizada. Todas as 15 tabelas têm RLS; a view de estoque de kits respeita as permissões do leitor. O navegador tem acesso somente de leitura; filas, auditoria e movimentos de estoque ficam bloqueados até existirem endpoints apropriados. Não há sincronização de estoque em execução nesta V1.

### Variáveis reservadas para essa integração

Frontend (públicas, incorporadas no **build**, exigem novo build quando alteradas):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use `.env.local` no computador; no Cloudflare Builds, cadastre como variáveis do build quando o login for implementado. Nunca use Service Role em uma variável `VITE_*`.

Backend (runtime do Worker, fora do bundle público):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`
- `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_REDIRECT_URI`

Guarde segredos em Secrets do Worker, ou `.dev.vars` local. Os arquivos `.env.example` e `.dev.vars.example` são modelos, sem credenciais reais. As rotas de status verificam apenas presença de valores. Callbacks OAuth ainda retornam 404, por isso não autorize contas reais antes de implementá-los.

Um endpoint futuro que use Service Role deverá validar o token do usuário, seu perfil ativo, a permissão da ação e a conta de destino antes de qualquer escrita; Service Role ignora RLS.

## Testes e limites

`npm test` aplica as duas migrations e o seed num PostgreSQL local em memória (PGlite), com papéis de autenticação simulados. Verifica estoque dos kits, seed repetível, isolamento por conta, usuários inativos, bloqueio anônimo, bloqueio de escrita e duplicidade de anúncios. PGlite usa `gen_random_uuid` nativo; a criação da extensão `pgcrypto` é omitida somente no teste. Isso não substitui validar a configuração de Auth e as migrations no projeto Supabase real.

## Referências

- [Cloudflare: assets no Vite](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/)
- [Cloudflare: configuração de Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Identidade visual

Paleta da marca: azul celeste #74B9FF, branco #FFFFFF, dourado #D4AF37 e azul noite #0B2D4A. Fonte Montserrat distribuída junto com o app, sem consulta externa ao Google Fonts. Símbolo vetorial recriado a partir da referência fornecida pelo proprietário; não é o arquivo vetorial original da marca. O canal próprio mantém o nome Ruta Direct Shop.

