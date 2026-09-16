# Anúncios Mercado Livre

## Fluxo

Produtos → conta conectada → Clássico/Premium/ambos → categoria e atributos → revisão dos preços → confirmação de criação.

O usuário autorizou provisoriamente **quantidade 1 por anúncio**, com disponibilidade para venda. O estoque do cadastro ainda não é integrado. O módulo não cria anúncios ao abrir a página, selecionar produtos ou validar: somente o botão final envia `POST /items`.

O preço é carregado no servidor pela associação `pricing_account_settings` e pela modalidade em `pricing_current_calculations`. O navegador não fornece o valor. Mudanças no custo, margem, embalagem, parâmetros, tabela ou grupo de frete bloqueiam um preço antigo. O envio exige validação recente e dados iguais aos revisados.

## Implantação

1. Aplicar uma vez `supabase/migrations/028_listing_publication.sql`, após 027. Não executar novamente as migrations antigas.
2. Publicar o build da aplicação e do Worker.
3. Em Tabelas por conta ou na etapa Conta do assistente, salvar a tabela desejada para a conta conectada.
4. Recalcular os produtos cuja memória esteja desatualizada antes de criar os anúncios.

Nenhuma publicação real é necessária nos testes automatizados. Os testes de API usam respostas simuladas; categoria, atributos, imagens e elegibilidade reais da conta serão conferidos pelo endpoint oficial de validação durante o uso.

## Vínculos e repetição

`listings` preserva produto, conta, modalidade, tabela, cálculo, categoria, identificação externa, endereço do anúncio e `user_product_id`, quando retornado. Há um único registro por produto/conta/modalidade. Anúncios legados sem modalidade precisam ser conferidos antes de nova criação.

O estado `publishing` reserva o envio atomicamente. Timeout, resposta inconclusiva ou falha ao persistir o retorno exigem conferência do anúncio no Mercado Livre, nunca uma repetição automática. A próxima fase poderá reconciliar esses casos e sincronizar preço/estoque pelos vínculos gravados; esta versão não agenda sincronizações.

Contas com a tag `user_product_seller` usam `family_name`; outras usam `title`. A quantidade continua explicitamente 1 no pedido. O status final exibido é o retornado pelo Mercado Livre, inclusive moderação ou pausa.

## Fontes oficiais consultadas

- https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos
- https://developers.mercadolivre.com.br/pt_br/preco-variacao
- https://developers.mercadolivre.com.br/en_us/javascript/listing-validator
- https://developers.mercadolivre.com.br/pt_br/categorizacao-de-produtos

O validador retorna HTTP 204 em caso de sucesso, sem corpo JSON. Os testes cobrem essa resposta.
