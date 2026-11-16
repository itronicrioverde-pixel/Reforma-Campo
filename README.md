# Reforma Campo · Green Park FC

Aplicativo estático no GitHub Pages, conectado ao projeto Firebase `reforma-campo` (Cloud Firestore Standard em São Paulo, plano Spark).

- Login Google: acesso aos dados reservado à conta verificada da gestão configurada nas regras.
- Despesas, itens recebidos e arrecadações salvos online na coleção `reforma`.
- Atualização entre aparelhos via listeners Firestore.
- Gravação com transação e controle de versão, evitando sobrescrever alterações de outro aparelho.
- Sem internet, o formulário informa falha; não apresenta gravação local como salva online.
- Importação de backup JSON e dos dados locais anteriores: soma IDs novos e preserva registros existentes.
- O botão de exportação gera backup completo do banco.

`index.html` mantém o layout original. `firebase-sync.js` contém a integração. `firestore.rules` registra as regras publicadas no console.

Os dados da versão hospedada no ChatGPT são independentes e não são transferidos automaticamente. Exporte um backup de lá e importe aqui. Dados locais continuam na chave `greenpark-reforma-html-v1` e podem ser importados no mesmo navegador/endereço.

Nenhuma chave administrativa ou credencial de serviço faz parte do frontend. A configuração web pública do Firebase identifica o projeto; as regras do Firestore controlam os dados.
