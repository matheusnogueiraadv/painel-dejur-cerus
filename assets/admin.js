/* Painel DEJUR Cerus — lógica do admin.
   Escreve na planilha Google através do Web App do Google Apps Script (apps-script/Code.gs). */

const COLUMNS = ['assunto','recebimento','responsavel','demanda','envio','forma_envio','conclusao','dias','status','tarefas','setor','ano','mes','dow','continuacao','caso'];

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

function deriveFields(row){
  const rec = row.recebimento ? new Date(row.recebimento + 'T00:00:00') : null;
  const concl = row.conclusao ? new Date(row.conclusao + 'T00:00:00') : null;
  const ano = rec ? rec.getFullYear() : '';
  const mes = rec ? rec.getMonth()+1 : '';
  const dow = rec ? (rec.getDay()+6)%7 : ''; // 0=Seg ... 6=Dom, igual ao painel
  let dias = '';
  if(rec && concl){ dias = Math.max(0, Math.round((concl-rec)/(1000*60*60*24))); }
  return { ...row, ano, mes, dow, dias: row.dias || dias, caso: row.caso || row.assunto };
}

function rowToOrderedArray(row){
  return COLUMNS.map(c => row[c] ?? '');
}

/* ============ FORMULÁRIO MANUAL ============ */
function initManualForm(){
  const form = document.getElementById('manualForm');
  const msg = document.getElementById('manualMsg');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = ''; msg.className = 'form-msg';
    const fd = new FormData(form);
    const row = {};
    COLUMNS.forEach(c => row[c] = fd.get(c) || '');
    row.continuacao = fd.get('continuacao') === 'on';
    row.tarefas = Number(fd.get('tarefas')) || 0;
    const full = deriveFields(row);

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try{
      await postToAppsScript({ action:'append', rows:[ rowToOrderedArray(full) ] });
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

    pendingRows = json.map(r=>{
      const row = {};
      COLUMNS.forEach(c => row[c] = r[c] ?? r[c.charAt(0).toUpperCase()+c.slice(1)] ?? '');
      row.continuacao = row.continuacao === true || row.continuacao === 'true' || row.continuacao === 'TRUE' || row.continuacao === 1;
      row.tarefas = Number(row.tarefas) || 0;
      return deriveFields(row);
    });

    previewWrap.innerHTML = `
      <p class="card-sub">${pendingRows.length} linha(s) detectada(s). Prévia das primeiras 5:</p>
      <div class="table-scroll">
        <table>
          <thead><tr>${COLUMNS.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${pendingRows.slice(0,5).map(r=>`<tr>${COLUMNS.map(c=>`<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    btnSend.style.display = 'inline-block';
  });

  btnSend.addEventListener('click', async ()=>{
    msg.textContent = ''; msg.className = 'form-msg';
    btnSend.disabled = true;
    try{
      await postToAppsScript({ action:'append', rows: pendingRows.map(rowToOrderedArray) });
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
