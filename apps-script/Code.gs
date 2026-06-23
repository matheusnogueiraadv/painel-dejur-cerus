/**
 * Painel DEJUR Cerus — ponte entre o admin (admin.html) e a planilha Google.
 *
 * Como implantar (ver README.md para o passo a passo completo):
 * 1. Abra a planilha Google que será a fonte de dados.
 * 2. Extensões > Apps Script.
 * 3. Apague o conteúdo padrão e cole este arquivo inteiro.
 * 4. Ajuste SHEET_NAME abaixo se sua aba não se chamar "dados".
 * 5. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL gerada e cole em config.js como APPS_SCRIPT_URL.
 *
 * A primeira linha da aba deve ter os cabeçalhos, na mesma ordem usada pelo painel:
 * assunto, recebimento, responsavel, demanda, envio, forma_envio, conclusao, dias,
 * status, tarefas, setor, ano, mes, dow, continuacao, caso
 */

const SHEET_NAME = 'dados';

function getSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if(!sheet) throw new Error('Aba "' + SHEET_NAME + '" não encontrada na planilha.');
  return sheet;
}

function jsonResponse_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const rows = values.map(r => {
      const obj = {};
      headers.forEach((h,i)=> obj[h] = r[i]);
      return obj;
    });
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
    const sheet = getSheet_();
    payload.rows.forEach(row => sheet.appendRow(row));
    return jsonResponse_({ ok:true, inserted: payload.rows.length });
  }catch(err){
    return jsonResponse_({ ok:false, error: err.message });
  }
}
