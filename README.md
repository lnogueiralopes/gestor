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
3. `supabase/migrations/003_ean_sku.sql`.
4. `supabase/migrations/004_internal_barcodes.sql`.
5. `supabase/migrations/005_kit_margin_bands.sql`.
6. Opcionalmente `supabase/seed.sql`, somente para dados de demonstração.

As migrations são aplicadas uma vez. O seed pode ser repetido. Se a 001 já foi aplicada, execute as migrations restantes na ordem (002, 003, 004, 005); não recrie tabelas. A 002 é transacional e falhará se já houver anúncios duplicados por produto/kit e conta; nesse caso revise os duplicados antes de reaplicar, sem apagar dados automaticamente.

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

`npm test` aplica as cinco migrations e o seed num PostgreSQL local em memória (PGlite), com papéis de autenticação simulados. Verifica estoque dos kits, seed repetível, isolamento por conta, usuários inativos, bloqueio anônimo, bloqueio de escrita e duplicidade de anúncios. PGlite usa `gen_random_uuid` nativo; a criação da extensão `pgcrypto` é omitida somente no teste. Isso não substitui validar a configuração de Auth e as migrations no projeto Supabase real.

## Referências

- [Cloudflare: assets no Vite](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/)
- [Cloudflare: configuração de Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Identidade visual

Paleta da marca: azul celeste #74B9FF, branco #FFFFFF, dourado #D4AF37 e azul noite #0B2D4A. Fonte Montserrat distribuída junto com o app, sem consulta externa ao Google Fonts. Símbolo vetorial recriado a partir da referência fornecida pelo proprietário; não é o arquivo vetorial original da marca. O canal próprio mantém o nome Ruta Direct Shop.


## Regra de SKU

- Produto unitário com EAN: SKU = EAN (texto, preservando zeros à esquerda).
- Kit com um único produto na composição: SKU = EAN + `_x` + quantidade. Exemplo: `7790000000011_x2`.
- Kit misto: recebe SKU sequencial `kitmix_00001`, `kitmix_00002` etc.
- Produto sem EAN: recebe código interno EAN-13; esse mesmo código vira seu SKU.

A migration 003 atualiza registros existentes mantendo os UUIDs e vínculos. Conflitos de SKU interrompem a migration sem excluir registros. Novos cadastros e alterações de EAN ou quantidade atualizam automaticamente os SKUs. A composição completa de um kit deve ser gravada em uma única transação: a regra é aplicada no commit para não confundir um kit misto parcialmente cadastrado com um kit de produto único. A V1 continua demonstrativa; estas regras estão preparadas para o futuro cadastro real.

## Códigos internos para produtos e kits

A migration 004 acrescenta EAN aos kits e identifica a origem interna em `ean_is_internal`. Kits sem EAN e produtos sem EAN recebem códigos com prefixo **04**, dez posições de sequência e um dígito verificador módulo 10 (13 dígitos no total). Exemplo: `0400000000015`. Esse prefixo é destinado à numeração interna de empresas; os códigos não são GTINs globais atribuídos pela GS1. Não os exporte como GTIN oficial aos marketplaces. O campo `ean_is_internal` deve ser respeitado pelos futuros conectores.

As sequências PostgreSQL são únicas no projeto gestor e não são calculadas por contagem de linhas. Um registro privado compartilhado reserva códigos para produtos e kits, rejeita colisões e mantém códigos antigos reservados mesmo após exclusão ou substituição. Os registros existentes são reservados antes da geração; candidatos ocupados são pulados. Não há garantia de unicidade fora deste banco/empresa. Não reinicie sequências ou exclua os registros de reserva. Backups e restaurações devem incluir o schema `private` e suas sequências.

O SKU de kit homogêneo continua `EAN_DO_PRODUTO_xQUANTIDADE`, enquanto seu EAN interno é independente e estável. Kits mistos recebem `kitmix_00001` em diante; lacunas são normais após falhas ou exclusões. A sequência aumenta além de cinco dígitos sem truncamento. Kits sem composição são rascunhos; o SKU definitivo é aplicado no commit da transação que grava a composição inteira. Releia o kit após o commit para obter o SKU definitivo.

O seed é somente demonstrativo e identifica os kits pelo nome e descrição dos exemplos para permitir repetição. Não o utilize como importador de catálogo real. As migrations falham e revertem a transação se encontrarem códigos conflitantes; nenhum registro é apagado automaticamente. Os testes cobrem a migração de dados anteriores, dígitos verificadores, bloqueio de duplicidade entre produto e kit, não reutilização, sequências e preservação dos códigos. A ativação no Supabase real continua pendente.

[GS1, seção 2.1.11.2: numeração interna RCN-13 com prefixo 04](https://ref.gs1.org/standards/genspecs/24.0.0/).

## Redução de margem por quantidade

Faixas independentes: 1, 2, 3, 4, 5, 6 e >6. Valores em pontos percentuais, com duas casas decimais. Padrões demo: 0,00; 1,00; 1,00; 2,00; 2,00; 3,00; 3,00. A migration 005 separa faixas existentes preservando seus valores; faixas antes ausentes herdam o valor da faixa anterior. No banco, >6 usa min_units=7 e max_units=NULL (sem limite superior). Para consultar uma faixa, use min_units <= quantidade AND (max_units IS NULL OR max_units >= quantidade). A interface ainda não salva alterações no banco nesta V1 demo.
