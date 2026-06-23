# Painel DEJUR Cerus

Dashboard de monitoramento de demandas do DEJUR (Cerus Securitizadora de
Créditos). Site estático, sem backend próprio — os dados vêm de uma
planilha Google e a gravação de novos dados é feita por um Google Apps
Script.

## Estrutura

```
index.html            painel público (somente leitura)
admin.html             painel administrativo (cadastro manual + upload de Excel)
assets/style.css       estilos compartilhados
assets/app.js          lógica do dashboard público
assets/admin.js        lógica do admin
assets/admin.css       estilos específicos do admin
apps-script/Code.gs    script a ser colado no Google Apps Script da planilha
config.js              URLs da planilha/Apps Script (preencher antes do deploy)
data/sample-data.js    dados de exemplo, usados como fallback se config.js não estiver preenchido
```

## Passo a passo de configuração

### 1. Criar a planilha Google

1. Crie uma planilha Google nova (ou use uma existente).
2. Renomeie a primeira aba para `dados` (ou ajuste `SHEET_NAME` no
   `apps-script/Code.gs`).
3. Na primeira linha, cole exatamente estes cabeçalhos, uma coluna cada:
   ```
   assunto  recebimento  responsavel  demanda  envio  forma_envio  conclusao  dias  status  tarefas  setor  ano  mes  dow  continuacao  caso
   ```
4. (Opcional) Para já começar com dados, exporte `data/sample-data.js`
   para CSV e importe na planilha — ou copie e cole os dados que já tinham
   sido extraídos do arquivo HTML original.

### 2. Publicar a planilha como CSV (leitura do painel público)

1. Arquivo → Compartilhar → **Publicar na Web**.
2. Selecione a aba `dados`, formato **CSV**, clique em Publicar.
3. Copie o link gerado e cole em `config.js`, no campo `SHEET_CSV_URL`.

### 3. Implantar o Apps Script (gravação via admin)

1. Na planilha, vá em **Extensões → Apps Script**.
2. Apague o conteúdo do editor e cole o conteúdo de `apps-script/Code.gs`.
3. Clique em **Implantar → Nova implantação**.
4. Tipo: **App da Web**. Executar como: **Eu**. Quem pode acessar:
   **Qualquer pessoa**.
5. Autorize as permissões solicitadas (é a sua própria conta Google).
6. Copie a URL gerada (termina em `/exec`) e cole em `config.js`, no
   campo `APPS_SCRIPT_URL`.

> Sempre que o código do `Code.gs` for alterado, é preciso criar uma
> **nova implantação** (ou editar a implantação existente) para a
> mudança valer na URL pública.

### 4. Testar localmente

Abra `admin.html` no navegador — a seção "Status da conexão" deve
mostrar "Conectado ao Apps Script da planilha". Teste adicionar uma
demanda manual e fazer upload de uma planilha Excel de exemplo. Depois
abra `index.html` e confirme que os dados aparecem nos gráficos.

Se `config.js` ainda não estiver preenchido, `index.html` usa
automaticamente os dados de exemplo em `data/sample-data.js`, então o
painel público sempre funciona mesmo antes do setup da planilha.

### 5. Publicar para a equipe

Suba este projeto para um repositório no GitHub e conecte a
[Vercel](https://vercel.com) ou [Netlify](https://netlify.com)
(ou habilite GitHub Pages) — qualquer uma gera uma URL pública
automaticamente a cada novo commit, sem necessidade de configuração de
servidor.

## Formato esperado no upload de Excel (admin)

A primeira linha deve ter cabeçalhos com os mesmos nomes das colunas da
planilha (case-sensitive): `assunto, recebimento, responsavel, demanda,
envio, forma_envio, conclusao, dias, status, tarefas, setor, caso,
continuacao`. Datas no formato `AAAA-MM-DD`. Os campos `ano`, `mes`, `dow`
e `dias` (quando ausente) são calculados automaticamente a partir de
`recebimento`/`conclusao`.
