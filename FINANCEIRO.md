# Empréstimos e Captação de Recursos

Branch de revisão: `feat/emprestimos-captacao`. Sem implantação ou migração de dados.

## Implementação

Menu Financeiro integrado ao React compilado existente com um componente web (`gp-finance`). CSS separado, usando as cores e componentes do sistema original. Arquivos originais preservados, exceto pontos de integração e sincronização.

- Bancos: cadastro e edição. Operações: cadastro, consulta por texto, edição, simulação e contratação explícita.
- Price e SAC, parcelas mensais com ajuste no último pagamento para quitar o principal em centavos, vencimentos ajustados ao último dia do mês.
- Juros mensais e anuais efetivos equivalentes. Nenhum resultado rotulado como CET.
- Modelo financeiro explícito: IOF, tarifas, seguro e outros custos descontados da liberação; principal menos custos deve corresponder ao líquido. Encargos recorrentes separados. Custos financiados, carência, períodos irregulares, pagamentos parciais, renegociação e multas de atraso não modelados.
- Baixa integral por parcela com data de hoje em São Paulo e opção de desfazer. Com pagamentos, alterações financeiras são bloqueadas; identificação e banco continuam editáveis.
- Saldo devedor de principal separado do total pendente com juros futuros. Simulações não permitem baixa nem criam arrecadações/despesas.
- Exemplo do cartão somente ilustrativo: 11 × R$ 2.350,07 + R$ 2.350,02; taxas e líquido conciliados. 1,51% sem periodicidade presumida; custo 12,80% arredondado.
- Relatório CSV por parcela com valores em centavos, proteção contra fórmulas e situação das operações. Backup JSON ampliado; backups anteriores continuam aceitos e IDs existentes são preservados.

## Firestore e segurança

Dois documentos novos, `reforma/banks` e `reforma/loans`, usando o padrão existente `{items, version}`, transações com controle de versão e listeners. Não há escrita em registros antigos ao cadastrar operações. Regras propostas mantêm o mesmo proprietário, email verificado, limite de 2.000 itens e versões; não permitem exclusão de documentos. Nenhuma regra foi publicada.

Antes do uso real, revisar e publicar as regras propostas pelo procedimento da gestão e testar com a conta autorizada. Até lá, as regras antigas rejeitam os documentos novos. O limite de 1 MiB por documento do Firestore também se aplica; 2.000 itens não garantem caber nesse limite.

## Verificação e limitação 403

- `node --test tests/finance.test.mjs`: 6 testes aprovados (Price, SAC, juros zero, centavos, datas/leap year, pagamento, saldo, taxa anual, entradas inválidas e conciliação do cartão).
- `node --check finance-module.js` e `node --check firebase-sync.js` aprovados.
- `tests/finance-ui.cjs`: Playwright com Chromium do sistema, servidor estático local na porta 8080 e Firebase substituído por armazenamento em memória apenas no teste. Fluxos aprovados: menu, banco, simulação, salvar, editar, contratar, pagar parcela, ausência de movimentação de caixa, largura 390px e ausência de erros JavaScript.
- Teste de interface não substitui testes autenticados nem testes das regras no emulador. Esses não foram executados.
- Consulta HTTP somente de leitura, sem autenticação, ao documento `reforma/expenses`: HTTP 403 `PERMISSION_DENIED`, “Missing or insufficient permissions.” Resultado esperado para visitante sem sessão. Não prova a causa do erro anterior com usuário autenticado. O SDK Firebase público respondeu HTTP 200.
- Para investigar um 403 autenticado, confirmar email e email_verified do usuário, projeto/database, regras realmente publicadas, domínio de login autorizado e eventual App Check. Não foram usadas credenciais da gestão nem alteradas permissões de produção.

## Executar os testes de interface

Com Playwright disponível e Chromium em `/usr/bin/chromium`, iniciar `python -m http.server 8080 --bind 127.0.0.1` na raiz e executar `node tests/finance-ui.cjs`. O teste intercepta apenas o arquivo de sincronização Firebase; não acessa ou altera o banco real.
