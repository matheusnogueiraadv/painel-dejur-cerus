/* Painel DEJUR Cerus — lógica do admin.
   Escreve na planilha Google através do Web App do Google Apps Script (apps-script/Code.gs).
   A ordem abaixo precisa bater exatamente com os cabeçalhos da primeira aba da planilha. */

const SHEET_COLUMNS = [
  'ASSUNTO / E-MAIL',
  'DATA RECEBIMENTO',
  'DATA ENCAMINHAMENTO PARA O RESPONSAVEL - CIÊNCIA DO RESPONSAVEL',
  'RESPONSÁVEL',
  'DEMANDA',
  'DATA DE ENVIO',
  'FORMA DE ENVIO',
  'DATA DE CONCLUSÃO',
  'DIAS PARA CONCLUSÃO',
  'STATUS',
  'OBSERVAÇÕES',
  'QUANTIDADE DE TAREFAS',
  'SETOR SOLICITANTE',
];

function appsScriptUrl(){
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  return (url && !url.includes('COLOQUE_AQUI')) ? url : null;
}

/* POST em text/plain evita o preflight CORS que o Apps Script não responde bem. */
async function postToAppsScript(body){
  const url = appsScriptUrl();
  if(!url) throw new Error('APPS_SCRIPT_URL não configurado em config.js.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch(e){ throw new Error('Resposta inesperada do Apps Script: ' + text.slice(0,200)); }
  if(!json.ok) throw new Error(json.error || 'Falha desconhecida ao gravar na planilha.');
  return json;
}

async function checkStatus(){
  const statusText = document.getElementById('statusText');
  const sheetUrl = window.APP_CONFIG && window.APP_CONFIG.SHEET_CSV_URL;
  const scriptUrl = appsScriptUrl();

  if((!sheetUrl || sheetUrl.includes('COLOQUE_AQUI')) && !scriptUrl){
    statusText.textContent = 'Nenhuma planilha configurada ainda. Edite config.js seguindo o README.md para conectar este admin à planilha Google.';
    statusText.className = 'warn';
    return;
  }
  if(!scriptUrl){
    statusText.textContent = 'CSV da planilha configurado, mas APPS_SCRIPT_URL não está definido — o admin não conseguirá gravar dados até isso ser configurado (ver README.md).';
    statusText.className = 'warn';
    return;
  }
  try{
    const res = await fetch(scriptUrl, { method:'GET' });
    if(!res.ok) throw new Error('status ' + res.status);
    statusText.textContent = 'Conectado ao Apps Script da planilha. Pronto para gravar dados.';
    statusText.className = 'ok';
  }catch(e){
    statusText.textContent = 'Não foi possível confirmar a conexão com o Apps Script (' + e.message + '). Verifique se o Web App está implantado e o link em config.js está correto.';
    statusText.className = 'warn';
  }
}

/* Converte AAAA-MM-DD (input type=date) para DD/MM/AAAA, igual ao resto da planilha. */
function toBRDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function calcDias(recebimentoISO, conclusaoISO){
  if(!recebimentoISO || !conclusaoISO) return '';
  const rec = new Date(recebimentoISO + 'T00:00:00');
  const concl = new Date(conclusaoISO + 'T00:00:00');
  return Math.max(0, Math.round((concl-rec)/(1000*60*60*24)));
}

function rowFromForm(fd){
  const recebimento = fd.get('recebimento') || '';
  const conclusao = fd.get('conclusao') || '';
  const dias = fd.get('dias') || calcDias(recebimento, conclusao);
  const row = {
    'ASSUNTO / E-MAIL': fd.get('assunto') || '',
    'DATA RECEBIMENTO': toBRDate(recebimento),
    'DATA ENCAMINHAMENTO PARA O RESPONSAVEL - CIÊNCIA DO RESPONSAVEL': '',
    'RESPONSÁVEL': fd.get('responsavel') || '',
    'DEMANDA': fd.get('demanda') || '',
    'DATA DE ENVIO': toBRDate(fd.get('envio') || ''),
    'FORMA DE ENVIO': fd.get('forma_envio') || '',
    'DATA DE CONCLUSÃO': toBRDate(conclusao),
    'DIAS PARA CONCLUSÃO': dias,
    'STATUS': fd.get('status') || '',
    'OBSERVAÇÕES': fd.get('observacoes') || '',
    'QUANTIDADE DE TAREFAS': Number(fd.get('tarefas')) || 0,
    'SETOR SOLICITANTE': fd.get('setor') || '',
  };
  return SHEET_COLUMNS.map(c => row[c]);
}

/* ============ FORMULÁRIO MANUAL ============ */
function initManualForm(){
  const form = document.getElementById('manualForm');
  const msg = document.getElementById('manualMsg');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = ''; msg.className = 'form-msg';
    const fd = new FormData(form);
    const orderedRow = rowFromForm(fd);

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try{
      await postToAppsScript({ action:'append', rows:[ orderedRow ] });
      msg.textContent = 'Demanda enviada com sucesso para a planilha.';
      msg.className = 'form-msg ok';
      form.reset();
    }catch(err){
      msg.textContent = 'Erro ao enviar: ' + err.message;
      msg.className = 'form-msg err';
    }finally{
      btn.disabled = false;
    }
  });
}

/* ============ IMPORTAÇÃO DE EXCEL ============ */
let pendingRows = [];

function rowFromExcelRecord(r){
  const recebimento = r['recebimento'] || r['DATA RECEBIMENTO'] || '';
  const conclusao = r['conclusao'] || r['DATA DE CONCLUSÃO'] || '';
  const dias = r['dias'] || r['DIAS PARA CONCLUSÃO'] || '';
  return {
    'ASSUNTO / E-MAIL': r['assunto'] || r['ASSUNTO / E-MAIL'] || '',
    'DATA RECEBIMENTO': recebimento,
    'DATA ENCAMINHAMENTO PARA O RESPONSAVEL - CIÊNCIA DO RESPONSAVEL': r['DATA ENCAMINHAMENTO PARA O RESPONSAVEL - CIÊNCIA DO RESPONSAVEL'] || '',
    'RESPONSÁVEL': r['responsavel'] || r['RESPONSÁVEL'] || '',
    'DEMANDA': r['demanda'] || r['DEMANDA'] || '',
    'DATA DE ENVIO': r['envio'] || r['DATA DE ENVIO'] || '',
    'FORMA DE ENVIO': r['forma_envio'] || r['FORMA DE ENVIO'] || '',
    'DATA DE CONCLUSÃO': conclusao,
    'DIAS PARA CONCLUSÃO': dias,
    'STATUS': r['status'] || r['STATUS'] || '',
    'OBSERVAÇÕES': r['observacoes'] || r['OBSERVAÇÕES'] || '',
    'QUANTIDADE DE TAREFAS': Number(r['tarefas'] || r['QUANTIDADE DE TAREFAS']) || 0,
    'SETOR SOLICITANTE': r['setor'] || r['SETOR SOLICITANTE'] || '',
  };
}

function initExcelImport(){
  const input = document.getElementById('excelInput');
  const previewWrap = document.getElementById('excelPreviewWrap');
  const btnSend = document.getElementById('btnSendExcel');
  const msg = document.getElementById('excelMsg');

  input.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    msg.textContent = ''; msg.className = 'form-msg';
    previewWrap.innerHTML = '';
    btnSend.style.display = 'none';
    if(!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type:'array', cellDates:false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval:'' });

    if(!json.length){
      msg.textContent = 'A planilha está vazia ou não foi possível lê-la.';
      msg.className = 'form-msg err';
      return;
    }

    pendingRows = json.map(rowFromExcelRecord);

    previewWrap.innerHTML = `
      <p class="card-sub">${pendingRows.length} linha(s) detectada(s). Prévia das primeiras 5:</p>
      <div class="table-scroll">
        <table>
          <thead><tr>${SHEET_COLUMNS.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${pendingRows.slice(0,5).map(r=>`<tr>${SHEET_COLUMNS.map(c=>`<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    btnSend.style.display = 'inline-block';
  });

  btnSend.addEventListener('click', async ()=>{
    msg.textContent = ''; msg.className = 'form-msg';
    btnSend.disabled = true;
    try{
      await postToAppsScript({ action:'append', rows: pendingRows.map(r => SHEET_COLUMNS.map(c => r[c])) });
      msg.textContent = `${pendingRows.length} linha(s) enviada(s) com sucesso para a planilha.`;
      msg.className = 'form-msg ok';
      pendingRows = [];
      previewWrap.innerHTML = '';
      btnSend.style.display = 'none';
      document.getElementById('excelInput').value = '';
    }catch(err){
      msg.textContent = 'Erro ao enviar: ' + err.message;
      msg.className = 'form-msg err';
    }finally{
      btnSend.disabled = false;
    }
  });
}

checkStatus();
initManualForm();
initExcelImport();
