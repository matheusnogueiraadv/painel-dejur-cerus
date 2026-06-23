# Painel DEJUR Cerus

Dashboard de monitoramento de demandas do DEJUR (Cerus Securitizadora de
Créditos). Site estático, sem backend próprio — os dados vêm de uma
planilha Google e a gravação de novos dados é feita por um Google Apps
Script.

Planilha em uso: `https://docs.google.com/spreadsheets/d/1BCCP9Ghka9nXjna-16FraSN-nqc7EX1AaWKexCQabHQ`
(fora do domínio @cerus.com.br — a conta corporativa bloqueia publicação
externa via política do Workspace; ver seção "Por que uma planilha fora
do domínio?" no fim deste arquivo).

## Estrutura

```
index.html            painel público (somente leitura)
admin.html             painel administrativo (cadastro manual + upload de Excel)
assets/style.css       estilos compartilhados
assets/app.js          lógica do dashboard público
assets/admin.js        lógica do admin
assets/admin.css       estilos específicos do admin
apps-script/Code.gs    script a ser colado no Google Apps Script da planilha
config.js              SHEET_CSV_URL (não sensível, versionado) + placeholder de APPS_SCRIPT_URL
config.local.js        APPS_SCRIPT_URL real, NUNCA commitado (está no .gitignore) — só para uso local
data/sample-data.js    dados de exemplo, usados como fallback se config.js não estiver preenchido
```

`APPS_SCRIPT_URL` permite **gravar** dados na planilha (qualquer pessoa
com a URL pode inserir linhas), então ela não fica no `config.js`
versionado — isso importa porque este repositório é público no GitHub.
Para uso local, crie `config.local.js` (veja o passo 2) com a URL real;
em produção (Vercel/Netlify), ela é injetada via variável de ambiente no
build, nunca aparecendo no código-fonte (veja o passo 4).

## Colunas da planilha (primeira aba, primeira linha = cabeçalho)

```
ASSUNTO / E-MAIL | DATA RECEBIMENTO | DATA ENCAMINHAMENTO PARA O RESPONSAVEL - CIÊNCIA DO RESPONSAVEL |
RESPONSÁVEL | DEMANDA | DATA DE ENVIO | FORMA DE ENVIO | DATA DE CONCLUSÃO | DIAS PARA CONCLUSÃO |
STATUS | OBSERVAÇÕES | QUANTIDADE DE TAREFAS | SETOR SOLICITANTE
```

Datas no formato `DD/MM/AAAA`. `assets/app.js` lê essas colunas pelo
nome exato (função `normalizeSheetRow`) e calcula automaticamente ano,
mês e dia da semana a partir de `DATA RECEBIMENTO` para os gráficos.
`apps-script/Code.gs` sempre usa a **primeira aba** da planilha, então
não importa como ela se chama — só a ordem/nome das colunas importa.

## Passo a passo de configuração

### 1. Publicar a planilha como CSV (leitura do painel público)

1. Arquivo → Compartilhar → defina o acesso geral como **"Qualquer
   pessoa com o link" → Leitor** (sem isso o link de publicação cai numa
   tela de login do Google).
2. Arquivo → Compartilhar → **Publicar na Web** → selecione a primeira
   aba, formato **CSV** → clique no botão azul **Publicar** e confirme
   no pop-up.
3. O link de publicação é do tipo `.../pub?output=csv`. Para o painel,
   é mais simples usar o link de **exportação direta**, que já está
   configurado em `config.js`:
   ```
   https://docs.google.com/spreadsheets/d/<ID_DA_PLANILHA>/export?format=csv&gid=0
   ```
   Troque `<ID_DA_PLANILHA>` pelo ID da sua planilha (está na URL, entre
   `/d/` e `/edit`) e `gid=0` pelo gid da aba, se não for a primeira.

### 2. Implantar o Apps Script (gravação via admin)

1. Na planilha, vá em **Extensões → Apps Script**.
2. Apague o conteúdo do editor e cole o conteúdo de `apps-script/Code.gs`.
3. Clique em **Implantar → Nova implantação**.
4. Tipo: **App da Web**. Executar como: **Eu**. Quem pode acessar:
   **Qualquer pessoa**.
5. Autorize as permissões solicitadas (é a sua própria conta Google).
6. Copie a URL gerada (termina em `/exec`). Crie um arquivo
   `config.local.js` na raiz do projeto (não será commitado) com:
   ```js
   window.APP_CONFIG = window.APP_CONFIG || {};
   window.APP_CONFIG.APPS_SCRIPT_URL = "COLE_A_URL_AQUI";
   ```

> Sempre que o código do `Code.gs` for alterado, é preciso criar uma
> **nova implantação** (ou editar a implantação existente) para a
> mudança valer na URL pública.

### 3. Testar localmente

Abra `admin.html` no navegador — a seção "Status da conexão" deve
mostrar "Conectado ao Apps Script da planilha". Teste adicionar uma
demanda manual e fazer upload de uma planilha Excel de exemplo. Depois
abra `index.html` e confirme que os dados aparecem nos gráficos.

Se `config.js` ainda não estiver preenchido, `index.html` usa
automaticamente os dados de exemplo em `data/sample-data.js`, então o
painel público sempre funciona mesmo antes do setup da planilha.

### 4. Publicar para a equipe (repositório público)

Suba este projeto para um repositório no GitHub e conecte a
[Vercel](https://vercel.com) ou [Netlify](https://netlify.com) — qualquer
uma gera uma URL pública automaticamente a cada novo commit.

Como o repositório é **público**, `APPS_SCRIPT_URL` não pode estar no
código. Em vez de GitHub Pages (que não tem variáveis de ambiente),
use Vercel ou Netlify com um Build Command que gera `config.js` na hora
do deploy, lendo a URL de uma variável de ambiente configurada no
painel do serviço (nunca no código):

1. No painel do Vercel/Netlify, em **Environment Variables**, crie
   `APPS_SCRIPT_URL` com o valor real (a mesma URL do passo 2).
2. Configure o **Build Command** como:
   ```
   echo "window.APP_CONFIG=window.APP_CONFIG||{};window.APP_CONFIG.APPS_SCRIPT_URL='$APPS_SCRIPT_URL';" > config.runtime.js
   ```
3. Adicione `<script src="config.runtime.js"></script>` depois de
   `config.js` em `admin.html` (mesmo padrão usado para
   `config.local.js` em desenvolvimento local — só o admin precisa de
   `APPS_SCRIPT_URL`; um 404 nesse arquivo não quebra a página, só
   significa que a URL de gravação não foi configurada ainda).
4. Output/Publish directory: a raiz do projeto (`.`), já que não há
   etapa de bundling além desse script gerando um arquivo.

Assim a URL de gravação nunca aparece no histórico do Git nem no código
visível publicamente — só existe em tempo de build, dentro da
infraestrutura do Vercel/Netlify.

## Formato esperado no upload de Excel (admin)

A primeira linha deve ter cabeçalhos iguais aos da planilha (ver seção
acima) ou os nomes simplificados: `assunto, recebimento, responsavel,
demanda, envio, forma_envio, conclusao, dias, status, observacoes,
tarefas, setor`. Datas em `DD/MM/AAAA` ou `AAAA-MM-DD`. O campo `dias`,
quando ausente, é calculado automaticamente a partir de
`recebimento`/`conclusao`.

## Por que uma planilha fora do domínio @cerus.com.br?

A primeira tentativa foi com uma planilha na conta corporativa, mas o
link de "Publicar na Web" continuava redirecionando para a tela de
login do Google mesmo após publicado — sinal de que a política do
Google Workspace da Cerus bloqueia publicação/compartilhamento externo
do domínio. Para não depender de uma liberação do administrador de TI,
os dados reais foram movidos para uma planilha em uma conta Google
pessoal, usada apenas como fonte pública de leitura para este painel.
Se essa restrição for liberada no futuro, basta trocar `SHEET_CSV_URL`
em `config.js` pela planilha corporativa.
