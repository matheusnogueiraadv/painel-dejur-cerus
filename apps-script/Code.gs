/**
 * Painel DEJUR Cerus — ponte entre o admin (admin.html) e a planilha Google.
 *
 * Como implantar (ver README.md para o passo a passo completo):
 * 1. Abra a planilha Google que será a fonte de dados.
 * 2. Extensões > Apps Script.
 * 3. Apague o conteúdo padrão e cole este arquivo inteiro.
 * 4. Implantar > Gerenciar implantações > editar a implantação existente
 *    (ou Nova implantação, se ainda não existir uma).
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL gerada e cole em config.js/config.local.js como
 *    APPS_SCRIPT_URL.
 *
 * A planilha pode ter VÁRIAS abas de dados, uma por mês, desde que o nome
 * comece com "DADOS" (ex.: "DADOS MAIO 26", "DADOS JUNHO 26"). O painel:
 *  - na leitura (doGet), soma os registros de TODAS as abas "DADOS ...";
 *  - na gravação (doPost), grava sempre na aba do MÊS/ANO atual (ex.: em
 *    junho/2026 grava em "DADOS JUNHO 26"); se essa aba não existir ainda,
 *    usa a última aba "DADOS ..." da planilha como destino.
 *
 * Os cabeçalhos da primeira linha de cada aba "DADOS ..." devem ser:
 * ASSUNTO / E-MAIL | DATA RECEBIMENTO | DATA ENCAMINHAMENTO PARA O
 * RESPONSAVEL - CIÊNCIA DO RESPONSAVEL | RESPONSÁVEL | DEMANDA | DATA DE
 * ENVIO | FORMA DE ENVIO | DATA DE CONCLUSÃO | DIAS PARA CONCLUSÃO |
 * STATUS | OBSERVAÇÕES | QUANTIDADE DE TAREFAS | SETOR SOLICITANTE
 */

const ABA_PREFIXO = 'DADOS';
const MESES_PT = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
  'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

/* Todas as abas cujo nome começa com "DADOS" (ignorando maiúsculas/minúsculas),
   na ordem em que aparecem na planilha. */
function getAbasDados_(){
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .filter(s => s.getName().toUpperCase().trim().indexOf(ABA_PREFIXO) === 0);
}

/* Linhas de uma aba, como objetos {cabeçalho: valor}. Ignora abas sem
   cabeçalho (vazias) e linhas completamente em branco. */
function lerLinhasDaAba_(sheet){
  if(sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values
    .filter(r => r.some(c => c !== '' && c !== null))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { if(h) obj[h] = r[i]; });
      return obj;
    });
}

/* Aba onde novos lançamentos (admin) devem ser gravados: a aba "DADOS ..."
   do mês/ano atual; se não existir, a última aba "DADOS ..." da planilha. */
function getAbaParaGravar_(){
  const abas = getAbasDados_();
  if(!abas.length) throw new Error('Nenhuma aba "' + ABA_PREFIXO + ' ..." encontrada na planilha.');
  const agora = new Date();
  const mes = MESES_PT[agora.getMonth()];
  const ano = String(agora.getFullYear()).slice(-2);
  const correspondente = abas.find(s => {
    const nome = s.getName().toUpperCase();
    return nome.indexOf(mes) !== -1 && nome.indexOf(ano) !== -1;
  });
  return correspondente || abas[abas.length - 1];
}

function jsonResponse_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    const abas = getAbasDados_();
    if(!abas.length) throw new Error('Nenhuma aba "' + ABA_PREFIXO + ' ..." encontrada na planilha.');
    const rows = abas.reduce((acc, sheet) => acc.concat(lerLinhasDaAba_(sheet)), []);
    return jsonResponse_({ ok:true, rows });
  }catch(err){
    return jsonResponse_({ ok:false, error: err.message });
  }
}

function doPost(e){
  try{
    const payload = JSON.parse(e.postData.contents);
    if(payload.action !== 'append' || !Array.isArray(payload.rows)){
      throw new Error('Payload inválido. Esperado {action:"append", rows:[[...]]}.');
    }
    const sheet = getAbaParaGravar_();
    payload.rows.forEach(row => sheet.appendRow(row));
    return jsonResponse_({ ok:true, inserted: payload.rows.length, aba: sheet.getName() });
  }catch(err){
    return jsonResponse_({ ok:false, error: err.message });
  }
}
