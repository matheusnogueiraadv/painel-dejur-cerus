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
config.js              SHEET_CSV_URL (não sensível, versionado) + placeholders de APPS_SCRIPT_URL/ADMIN_PASSWORD_HASH
config.local.js        valores reais, NUNCA commitado (está no .gitignore) — só para uso local
assets/admin-auth.js   trava de senha do admin (lê o hash de window.APP_CONFIG, nunca hardcoded)
data/sample-data.js    dados de exemplo, usados como fallback se config.js não estiver preenchido
```

`APPS_SCRIPT_URL` permite **gravar** dados na planilha e
`ADMIN_PASSWORD_HASH` é o hash da senha do admin — nenhum dos dois fica
no `config.js` versionado, porque este repositório é público no GitHub
(mesmo em hash, uma senha previsível seria quebrável por força bruta
num repo público). Para uso local, crie `config.local.js` (veja os
passos 2 e 3) com os valores reais; em produção (Vercel/Netlify), eles
são injetados via variável de ambiente no build, nunca aparecendo no
código-fonte (veja o passo 5).

## Abas da planilha (uma por mês)

A planilha pode ter **várias abas de dados**, uma por mês, desde que o
nome comece com `DADOS` (ex.: `DADOS MAIO 26`, `DADOS JUNHO 26`,
`DADOS JULHO 26`...). O painel público e o admin somam os registros de
**todas** as abas `DADOS ...` automaticamente — basta criar uma nova aba
a cada mês, copiando os mesmos cabeçalhos, que o painel passa a incluí-la
sem precisar mudar nada no código. Indicadores, gráficos de evolução
mensal e os comparativos entre meses continuam funcionando normalmente,
já que cada registro carrega sua própria data — a divisão em abas é só
organizacional.

Cabeçalhos esperados na primeira linha de cada aba `DADOS ...`:

```
ASSUNTO / E-MAIL | DATA RECEBIMENTO | DATA ENCAMINHAMENTO PARA O RESPONSAVEL - CIÊNCIA DO RESPONSAVEL |
RESPONSÁVEL | DEMANDA | DATA DE ENVIO | FORMA DE ENVIO | DATA DE CONCLUSÃO | DIAS PARA CONCLUSÃO |
STATUS | OBSERVAÇÕES | QUANTIDADE DE TAREFAS | SETOR SOLICITANTE
```

Datas no formato `DD/MM/AAAA`. `assets/app.js` lê essas colunas pelo
nome exato (função `normalizeSheetRow`) e calcula automaticamente ano,
mês e dia da semana a partir de `DATA RECEBIMENTO` para os gráficos.

`apps-script/Code.gs` soma as abas `DADOS ...` na leitura (`doGet`) e,
na gravação pelo admin (`doPost`), grava sempre na aba do **mês/ano
atual** (ex.: em junho/2026 grava em `DADOS JUNHO 26`); se essa aba
ainda não existir, usa a última aba `DADOS ...` da planilha. O painel
público lê primeiro via `APPS_SCRIPT_URL` (soma todas as abas); só usa
o CSV de uma única aba (`SHEET_CSV_URL`) como reserva, se o Apps Script
não estiver configurado ou falhar.

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

### 3. Configurar a senha do admin

`admin.html` pede uma senha antes de mostrar o conteúdo (não é
segurança forte — qualquer pessoa com acesso ao DevTools consegue
contornar — só evita acesso casual de quem não deveria ter o link).

1. Gere o hash SHA-256 da senha escolhida. No navegador, abra o
   DevTools (F12), aba Console, e rode:
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('SUA_SENHA_AQUI'))
     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
   ```
2. Adicione o resultado ao `config.local.js`:
   ```js
   window.APP_CONFIG.ADMIN_PASSWORD_HASH = "COLE_O_HASH_AQUI";
   ```

### 4. Testar localmente

Abra `admin.html` no navegador — a seção "Status da conexão" deve
mostrar "Conectado ao Apps Script da planilha". Teste adicionar uma
demanda manual e fazer upload de uma planilha Excel de exemplo. Depois
abra `index.html` e confirme que os dados aparecem nos gráficos.

Se `config.js` ainda não estiver preenchido, `index.html` usa
automaticamente os dados de exemplo em `data/sample-data.js`, então o
painel público sempre funciona mesmo antes do setup da planilha.

### 5. Publicar para a equipe (repositório público)

Suba este projeto para um repositório no GitHub e conecte a
[Vercel](https://vercel.com) ou [Netlify](https://netlify.com) — qualquer
uma gera uma URL pública automaticamente a cada novo commit.

Como o repositório é **público**, `APPS_SCRIPT_URL` e
`ADMIN_PASSWORD_HASH` não podem estar no código. Em vez de GitHub Pages
(que não tem variáveis de ambiente), use Vercel ou Netlify com um Build
Command que gera `config.runtime.js` na hora do deploy, lendo os
valores de variáveis de ambiente configuradas no painel do serviço
(nunca no código):

1. No painel do Vercel/Netlify, em **Environment Variables**, crie
   `APPS_SCRIPT_URL` e `ADMIN_PASSWORD_HASH` com os valores reais (os
   mesmos dos passos 2 e 3).
2. Configure o **Build Command** como:
   ```
   echo "window.APP_CONFIG=window.APP_CONFIG||{};window.APP_CONFIG.APPS_SCRIPT_URL='$APPS_SCRIPT_URL';window.APP_CONFIG.ADMIN_PASSWORD_HASH='$ADMIN_PASSWORD_HASH';" > config.runtime.js
   ```
3. `admin.html` já carrega `<script src="config.runtime.js">` depois de
   `config.js` (mesmo padrão usado para `config.local.js` em
   desenvolvimento local — um 404 nesse arquivo não quebra a página, só
   significa que os valores de produção não foram configurados ainda).
4. Output/Publish directory: a raiz do projeto (`.`), já que não há
   etapa de bundling além desse script gerando um arquivo.

Assim os segredos nunca aparecem no histórico do Git nem no código
visível publicamente — só existem em tempo de build, dentro da
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
