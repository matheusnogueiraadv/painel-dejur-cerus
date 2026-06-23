/* Painel DEJUR Cerus — lógica do dashboard público.
   Fonte de dados: CSV publicado do Google Sheets (ver config.js).
   Se não houver link configurado ou a busca falhar, usa data/sample-data.js como fallback. */

const MONTH_NAMES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DOW_NAMES = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const PALETTE = ['#F47920','#1A1A1A','#C75D0F','#F2A93B','#6E6358','#8C6E4B','#3E3E3E','#D98A3D','#B5491E','#4A4038'];

let RAW_DATA = [];
let charts = {};
let state = { ano:'', mes:'', resp:'', tipo:'', status:'', setor:'', envio:'' };
let respSortMode = 'demandas';

/* ============ CARGA DE DADOS ============ */

/* Converte datas no formato DD/MM/AAAA (planilha) ou AAAA-MM-DD (já ISO) para ISO. */
function toISODate(s){
  if(!s) return '';
  s = String(s).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}

function deriveCalendarFields(row){
  const rec = row.recebimento ? new Date(row.recebimento + 'T00:00:00') : null;
  return {
    ...row,
    ano: rec ? rec.getFullYear() : null,
    mes: rec ? rec.getMonth()+1 : null,
    dow: rec ? (rec.getDay()+6)%7 : null, // 0=Seg ... 6=Dom
  };
}

/* Linhas vindas da planilha real do DEJUR (cabeçalhos em português, datas DD/MM/AAAA). */
function normalizeSheetRow(d){
  const assunto = d['ASSUNTO / E-MAIL'] || '';
  const row = {
    assunto,
    recebimento: toISODate(d['DATA RECEBIMENTO']),
    responsavel: d['RESPONSÁVEL'] || '',
    demanda: d['DEMANDA'] || '',
    envio: toISODate(d['DATA DE ENVIO']),
    forma_envio: d['FORMA DE ENVIO'] || '',
    conclusao: toISODate(d['DATA DE CONCLUSÃO']),
    dias: Number(d['DIAS PARA CONCLUSÃO']) || 0,
    status: d['STATUS'] || '',
    tarefas: Number(d['QUANTIDADE DE TAREFAS']) || 0,
    setor: d['SETOR SOLICITANTE'] || '',
    continuacao: false,
    caso: assunto,
  };
  return deriveCalendarFields(row);
}

/* Linhas já no formato interno (usadas pelo data/sample-data.js). */
function normalizeRow(d){
  return {
    assunto: d.assunto || '',
    recebimento: d.recebimento || '',
    responsavel: d.responsavel || '',
    demanda: d.demanda || '',
    envio: d.envio || '',
    forma_envio: d.forma_envio || '',
    conclusao: d.conclusao || '',
    dias: Number(d.dias) || 0,
    status: d.status || '',
    tarefas: Number(d.tarefas) || 0,
    setor: d.setor || '',
    ano: Number(d.ano) || null,
    mes: Number(d.mes) || null,
    dow: d.dow === '' || d.dow === undefined || d.dow === null ? null : Number(d.dow),
    continuacao: d.continuacao === true || d.continuacao === 'true' || d.continuacao === 'TRUE',
    caso: d.caso || d.assunto || '',
  };
}

function loadFromSample(){
  RAW_DATA = (window.SAMPLE_DATA || []).map(normalizeRow);
  init();
}

function loadData(){
  const url = window.APP_CONFIG && window.APP_CONFIG.SHEET_CSV_URL;
  const isConfigured = url && !url.includes('COLOQUE_AQUI');
  if(!isConfigured){
    console.warn('SHEET_CSV_URL não configurado em config.js — usando dados de exemplo (data/sample-data.js).');
    loadFromSample();
    return;
  }
  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if(!results.data || !results.data.length){
        console.warn('Planilha retornou vazia — usando dados de exemplo.');
        loadFromSample();
        return;
      }
      RAW_DATA = results.data.filter(r => r['ASSUNTO / E-MAIL'] || r['RESPONSÁVEL']).map(normalizeSheetRow);
      if(!RAW_DATA.length){
        console.warn('Nenhuma linha válida encontrada na planilha — usando dados de exemplo.');
        loadFromSample();
        return;
      }
      init();
    },
    error: (err) => {
      console.error('Falha ao buscar a planilha publicada, usando dados de exemplo.', err);
      loadFromSample();
    }
  });
}

/* ============ FILTROS ============ */

function uniqueSorted(arr){ return [...new Set(arr.filter(v=>v!==null && v!==undefined && v!==''))].sort((a,b)=>('' + a).localeCompare('' + b)); }

function populateSelect(id, values, allLabel){
  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="">${allLabel}</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
}

function initFilters(){
  populateSelect('f_ano', uniqueSorted(RAW_DATA.map(d=>d.ano)), 'Todos os anos');
  document.getElementById('f_mes').innerHTML = `<option value="">Todos os meses</option>` + uniqueSorted(RAW_DATA.map(d=>d.mes)).map(m=>`<option value="${m}">${MONTH_NAMES[m]}</option>`).join('');
  populateSelect('f_resp', uniqueSorted(RAW_DATA.map(d=>d.responsavel)), 'Todos os responsáveis');
  populateSelect('f_tipo', uniqueSorted(RAW_DATA.map(d=>d.demanda)), 'Todos os tipos');
  populateSelect('f_status', uniqueSorted(RAW_DATA.map(d=>d.status)), 'Todos os status');
  populateSelect('f_setor', uniqueSorted(RAW_DATA.map(d=>d.setor)), 'Todos os setores');
  populateSelect('f_envio', uniqueSorted(RAW_DATA.map(d=>d.forma_envio)), 'Todas as formas');

  ['ano','mes','resp','tipo','status','setor','envio'].forEach(k=>{
    document.getElementById('f_'+k).addEventListener('change', e=>{ state[k] = e.target.value; render(); });
  });
  document.getElementById('btnReset').addEventListener('click', ()=>{
    state = { ano:'', mes:'', resp:'', tipo:'', status:'', setor:'', envio:'' };
    ['ano','mes','resp','tipo','status','setor','envio'].forEach(k=> document.getElementById('f_'+k).value = '');
    render();
  });

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-'+btn.dataset.view).classList.add('active');
    });
  });

  document.querySelectorAll('#respSortToggle .sort-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#respSortToggle .sort-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      respSortMode = btn.dataset.sort;
      renderRespChart(getFiltered());
    });
  });
}

function getFiltered(){
  return RAW_DATA.filter(d=>
    (!state.ano || String(d.ano)===String(state.ano)) &&
    (!state.mes || String(d.mes)===String(state.mes)) &&
    (!state.resp || d.responsavel===state.resp) &&
    (!state.tipo || d.demanda===state.tipo) &&
    (!state.status || d.status===state.status) &&
    (!state.setor || d.setor===state.setor) &&
    (!state.envio || d.forma_envio===state.envio)
  );
}

function groupCount(arr, key){
  const m = {};
  arr.forEach(d=>{ const k = d[key] || 'Não informado'; m[k] = (m[k]||0)+1; });
  return m;
}
function groupSum(arr, key, val){
  const m = {};
  arr.forEach(d=>{ const k = d[key] || 'Não informado'; m[k] = (m[k]||0)+ (d[val]||0); });
  return m;
}
function sortDesc(obj){ return Object.entries(obj).sort((a,b)=>b[1]-a[1]); }
function fmtPct(n){ return (n*100).toFixed(1).replace('.', ',') + '%'; }
function avg(arr, key){ if(!arr.length) return 0; return arr.reduce((s,d)=>s+(d[key]||0),0)/arr.length; }

function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }

function baseGridOpts(){
  return { grid:{ color:'#EDE6DA' }, ticks:{ font:{ family:'Manrope', size:11 }, color:'#6E6358' } };
}

/* ============ KPI CARDS ============ */
function renderKpis(data){
  const total = data.length;
  const concluidas = data.filter(d=>d.status==='Concluído').length;
  const abertas = total - concluidas;
  const taxa = total ? concluidas/total : 0;
  const tempoMedio = avg(data.filter(d=>d.status==='Concluído'), 'dias');
  const totalTarefas = data.reduce((s,d)=>s+(d.tarefas||0),0);
  const porResp = sortDesc(groupCount(data,'responsavel'));
  const porSetor = sortDesc(groupCount(data,'setor'));
  const topResp = porResp[0] || ['—',0];
  const topSetor = porSetor[0] || ['—',0];

  const casosDistintos = new Set(data.map(d=>d.caso)).size;

  const cards = [
    {label:'Total de Demandas (itens)', value: total.toLocaleString('pt-BR'), sub:`${casosDistintos.toLocaleString('pt-BR')} e-mails/casos distintos`, color:'var(--navy)'},
    {label:'Demandas Concluídas', value: concluidas.toLocaleString('pt-BR'), sub:`${fmtPct(total?concluidas/total:0)} do total`, color:'var(--green)'},
    {label:'Demandas em Aberto', value: abertas.toLocaleString('pt-BR'), sub:`${fmtPct(total?abertas/total:0)} do total`, color:'var(--yellow)'},
    {label:'Taxa de Conclusão', value: fmtPct(taxa), sub:'concluídas ÷ total', color:'var(--orange)'},
    {label:'Tempo Médio de Conclusão', value: tempoMedio.toFixed(1).replace('.',',')+' dias', sub:'média das concluídas', color:'var(--petrol)'},
    {label:'Total de Tarefas', value: totalTarefas.toLocaleString('pt-BR'), sub:`média de ${(totalTarefas/(total||1)).toFixed(1).replace('.',',')} tarefas/item`, color:'var(--navy)'},
    {label:'Responsável Mais Demandado', value: topResp[0], sub:`${topResp[1]} demandas (${fmtPct(total?topResp[1]/total:0)})`, color:'var(--orange)'},
    {label:'Setor Mais Demandante', value: topSetor[0], sub:`${topSetor[1]} demandas (${fmtPct(total?topSetor[1]/total:0)})`, color:'var(--petrol)'},
  ];

  document.getElementById('kpiGrid').innerHTML = cards.map(c=>`
    <div class="kpi-card">
      <div class="accent" style="background:${c.color}"></div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>`).join('');
}

/* ============ CHARTS ============ */
function renderRespChart(data){
  destroyChart('resp');
  const tarefasMap = groupSum(data,'responsavel','tarefas');
  let counts = sortDesc(groupCount(data,'responsavel'));
  if(respSortMode === 'tarefas'){
    counts = counts.slice().sort((a,b)=> (tarefasMap[b[0]]||0) - (tarefasMap[a[0]]||0));
  }
  const total = data.length || 1;
  const ctx = document.getElementById('chartResp');
  charts.resp = new Chart(ctx, {
    type:'bar',
    data:{ labels: counts.map(c=>c[0]), datasets:[
      { label:'Demandas', data: counts.map(c=>c[1]), backgroundColor: '#1A1A1A', borderRadius:6, maxBarThickness:16 },
      { label:'Tarefas', data: counts.map(c=> tarefasMap[c[0]]||0), backgroundColor: '#F47920', borderRadius:6, maxBarThickness:16 },
    ]},
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', align:'end', labels:{ boxWidth:10, font:{ size:11, family:'Manrope' } } },
        tooltip:{ callbacks:{ label: c=> c.dataset.label==='Demandas' ? `${c.parsed.x} demandas (${fmtPct(c.parsed.x/total)})` : `${c.parsed.x} tarefas` }}},
      scales:{ x: baseGridOpts(), y:{ grid:{display:false}, ticks:{ font:{family:'Manrope', size:11, weight:'600'}, color:'#1A1A1A' } } } }
  });
}

function renderDonut(canvasId, key, data, palette){
  destroyChart(canvasId);
  const counts = sortDesc(groupCount(data,key));
  const total = data.length || 1;
  const ctx = document.getElementById(canvasId === 'tipo' ? 'chartTipo' : 'chartStatus');
  charts[canvasId] = new Chart(ctx, {
    type:'doughnut',
    data:{ labels: counts.map(c=>c[0]), datasets:[{ data: counts.map(c=>c[1]), backgroundColor: palette, borderWidth:2, borderColor:'#fff' }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{ position:'right', labels:{ boxWidth:10, font:{ size:11, family:'Manrope' } } },
        tooltip:{ callbacks:{ label: c=>`${c.label}: ${c.parsed} (${fmtPct(c.parsed/total)})` }}} }
  });
}

function renderSetorChart(data){
  destroyChart('setor');
  const counts = sortDesc(groupCount(data,'setor')).slice(0,12);
  const tarefasMap = groupSum(data,'setor','tarefas');
  const ctx = document.getElementById('chartSetor');
  charts.setor = new Chart(ctx, {
    type:'bar',
    data:{ labels: counts.map(c=>c[0]), datasets:[
      { label:'Demandas', data: counts.map(c=>c[1]), backgroundColor: '#1A1A1A', borderRadius:6, maxBarThickness:18 },
      { label:'Tarefas', data: counts.map(c=> tarefasMap[c[0]]||0), backgroundColor: '#F47920', borderRadius:6, maxBarThickness:18 },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', align:'end', labels:{ boxWidth:10, font:{ size:11, family:'Manrope' } } } },
      scales:{ y: baseGridOpts(), x:{ grid:{display:false}, ticks:{ font:{size:10, family:'Manrope'}, color:'#1A1A1A', maxRotation:40, minRotation:20 } } } }
  });
}

function renderEvolucao(data){
  destroyChart('evolucao');
  const keys = uniqueSorted(data.map(d=> d.ano && d.mes ? `${d.ano}-${String(d.mes).padStart(2,'0')}` : null)).sort();
  const recebidas = keys.map(k=> data.filter(d=> `${d.ano}-${String(d.mes).padStart(2,'0')}`===k ).length );
  const concluidas = keys.map(k=> data.filter(d=> `${d.ano}-${String(d.mes).padStart(2,'0')}`===k && d.status==='Concluído').length );
  const labels = keys.map(k=>{ const [y,m]=k.split('-'); return MONTH_NAMES[parseInt(m)]+'/'+y.slice(2); });
  const ctx = document.getElementById('chartEvolucao');
  charts.evolucao = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Recebidas', data:recebidas, borderColor:'#1A1A1A', backgroundColor:'rgba(26,26,26,0.07)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:'#1A1A1A' },
      { label:'Concluídas', data:concluidas, borderColor:'#F47920', backgroundColor:'rgba(244,121,32,0.12)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:'#F47920' },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', align:'end', labels:{ boxWidth:10, font:{ size:11, family:'Manrope' } } } },
      scales:{ y: baseGridOpts(), x:{ grid:{display:false}, ticks:{ font:{family:'Manrope', size:11}, color:'#6E6358' } } } }
  });
}

function renderTempoResp(data){
  destroyChart('tempo');
  const concl = data.filter(d=>d.status==='Concluído');
  const grouped = {};
  concl.forEach(d=>{ (grouped[d.responsavel] = grouped[d.responsavel]||[]).push(d.dias); });
  const entries = Object.entries(grouped).map(([k,v])=>[k, v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b)=>a[1]-b[1]);
  const ctx = document.getElementById('chartTempo');
  charts.tempo = new Chart(ctx, {
    type:'bar',
    data:{ labels: entries.map(e=>e[0]), datasets:[{ data: entries.map(e=>+e[1].toFixed(1)), backgroundColor: entries.map((e,i)=> i < entries.length/2 ? '#1E8E5A' : '#C5371F'), borderRadius:6, maxBarThickness:30 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>`${c.parsed.y} dias em média` }}},
      scales:{ y: baseGridOpts(), x:{ grid:{display:false}, ticks:{ font:{family:'Manrope', size:11, weight:'600'}, color:'#1A1A1A' } } } }
  });
}

function heatColor(v, max){
  if(!max) return '#F0EBE2';
  const t = v/max;
  if(t===0) return '#F0EBE2';
  const stops = [
    {t:0.0, c:[238,241,244]},
    {t:0.5, c:[255,210,150]},
    {t:1.0, c:[244,121,32]},
  ];
  let lo=stops[0], hi=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){ if(t>=stops[i].t && t<=stops[i+1].t){ lo=stops[i]; hi=stops[i+1]; break; } }
  const span = (hi.t-lo.t)||1; const f = (t-lo.t)/span;
  const c = lo.c.map((v0,i)=> Math.round(v0 + (hi.c[i]-v0)*f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function renderHeatmap(data){
  const months = uniqueSorted(data.map(d=>d.mes)).sort((a,b)=>a-b);
  const matrix = {};
  let max = 0;
  for(let dow=0; dow<7; dow++){ matrix[dow]={}; months.forEach(m=>{ matrix[dow][m]=0; }); }
  data.forEach(d=>{ if(d.dow!==null && d.mes){ matrix[d.dow][d.mes] = (matrix[d.dow][d.mes]||0)+1; if(matrix[d.dow][d.mes]>max) max = matrix[d.dow][d.mes]; } });

  let html = '<table class="heatmap"><thead><tr><th></th>' + months.map(m=>`<th>${MONTH_NAMES[m]}</th>`).join('') + '</tr></thead><tbody>';
  for(let dow=0; dow<7; dow++){
    html += `<tr><td class="heat-rowlabel">${DOW_NAMES[dow]}</td>`;
    months.forEach(m=>{
      const v = matrix[dow][m]||0;
      html += `<td><div class="heat-cell" style="background:${heatColor(v,max)}" title="${DOW_NAMES[dow]}, ${MONTH_NAMES[m]}: ${v} demandas">${v||''}</div></td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('heatmapWrap').innerHTML = months.length ? html : '<div class="empty-state">Sem dados de data para o filtro selecionado.</div>';
}

/* ============ INSIGHTS ============ */
function renderInsights(data){
  const total = data.length;
  const list = [];
  if(!total){ document.getElementById('insightList').innerHTML = '<li>Nenhuma demanda no filtro selecionado.</li>'; return; }

  const porSetor = sortDesc(groupCount(data,'setor'));
  const top2Setor = porSetor.slice(0,2).reduce((s,e)=>s+e[1],0);
  if(porSetor.length>=2){
    list.push(`Os setores <b>${porSetor[0][0]}</b> e <b>${porSetor[1][0]}</b> concentram <b>${fmtPct(top2Setor/total)}</b> das demandas do período filtrado.`);
  } else if(porSetor.length===1){
    list.push(`O setor <b>${porSetor[0][0]}</b> concentra <b>${fmtPct(porSetor[0][1]/total)}</b> das demandas do período.`);
  }

  const porResp = sortDesc(groupCount(data,'responsavel'));
  if(porResp.length){
    list.push(`<b>${porResp[0][0]}</b> concluiu/recebeu <b>${fmtPct(porResp[0][1]/total)}</b> das demandas do período filtrado (${porResp[0][1]} demandas).`);
  }

  const keys = uniqueSorted(data.map(d=> d.ano && d.mes ? `${d.ano}-${String(d.mes).padStart(2,'0')}` : null)).sort();
  if(keys.length>=2){
    const last = keys[keys.length-1], prev = keys[keys.length-2];
    const tLast = data.filter(d=>`${d.ano}-${String(d.mes).padStart(2,'0')}`===last && d.status==='Concluído');
    const tPrev = data.filter(d=>`${d.ano}-${String(d.mes).padStart(2,'0')}`===prev && d.status==='Concluído');
    const aLast = avg(tLast,'dias'), aPrev = avg(tPrev,'dias');
    if(aPrev>0){
      const variacao = ((aLast-aPrev)/aPrev)*100;
      const [yl,ml]=last.split('-'); const [yp,mp]=prev.split('-');
      list.push(`O tempo médio de conclusão ${variacao<=0?'reduziu':'aumentou'} <b>${Math.abs(variacao).toFixed(0)}%</b> em ${MONTH_NAMES[parseInt(ml)]}/${yl.slice(2)} em relação a ${MONTH_NAMES[parseInt(mp)]}/${yp.slice(2)}.`);
    }
  }

  const acima20 = data.filter(d=>d.status==='Concluído' && d.dias>20).length;
  list.push(`Existem <b>${acima20}</b> demanda(s) concluída(s) acima de 20 dias de prazo (${fmtPct(total?acima20/total:0)} do total filtrado).`);

  const emAndamento = data.filter(d=>d.status!=='Concluído').length;
  if(emAndamento>0){
    list.push(`Há <b>${emAndamento}</b> demanda(s) em andamento aguardando conclusão no recorte atual.`);
  }

  const porTipo = sortDesc(groupCount(data,'demanda'));
  if(porTipo.length){
    list.push(`O tipo de demanda mais frequente é <b>${porTipo[0][0]}</b>, com ${porTipo[0][1]} ocorrências (${fmtPct(porTipo[0][1]/total)}).`);
  }

  document.getElementById('insightList').innerHTML = list.map(t=>`<li>${t}</li>`).join('');
}

/* ============ PRODUTIVIDADE ============ */
function renderProdutividade(data){
  const byResp = {};
  data.forEach(d=>{
    const r = d.responsavel;
    if(!byResp[r]) byResp[r] = { recebidas:0, concluidas:0, andamento:0, dias:[], tarefas:0 };
    byResp[r].recebidas++;
    if(d.status==='Concluído'){ byResp[r].concluidas++; byResp[r].dias.push(d.dias); }
    else byResp[r].andamento++;
    byResp[r].tarefas += (d.tarefas||0);
  });
  const rows = Object.entries(byResp).map(([resp,v])=>({
    resp, recebidas:v.recebidas, concluidas:v.concluidas, andamento:v.andamento,
    taxa: v.recebidas? v.concluidas/v.recebidas : 0,
    tempoMedio: v.dias.length? v.dias.reduce((a,b)=>a+b,0)/v.dias.length : 0,
    tarefas: v.tarefas
  })).sort((a,b)=> b.tarefas - a.tarefas);

  const medals = ['🥇','🥈','🥉'];
  const maxTarefas = Math.max(...rows.map(r=>r.tarefas), 1);

  document.getElementById('prodTableBody').innerHTML = rows.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div class="rank-cell"><span class="medal">${medals[i]||''}</span><span>${r.resp}</span></div></td>
      <td>${r.recebidas}</td>
      <td>${r.concluidas}</td>
      <td>${r.andamento}</td>
      <td>${fmtPct(r.taxa)}</td>
      <td>${r.tempoMedio.toFixed(1).replace('.',',')}</td>
      <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${(r.tarefas/maxTarefas)*100}%"></div></div><span class="mono">${r.tarefas}</span></div></td>
    </tr>`).join('') || '<tr><td colspan="8">Sem dados para o filtro selecionado.</td></tr>';
}

/* ============ SLA ============ */
function drawGauge(canvasId, value, max, color){
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  charts[canvasId] = new Chart(ctx, {
    type:'doughnut',
    data:{ datasets:[{ data:[value, Math.max(max-value,0.0001)], backgroundColor:[color,'#F0EBE2'], borderWidth:0 }]},
    options:{ circumference:180, rotation:270, cutout:'74%', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} } }
  });
}

function renderSla(data){
  const concl = data.filter(d=>d.status==='Concluído');
  const total = concl.length || 1;
  const b5 = concl.filter(d=>d.dias<=5).length;
  const b10 = concl.filter(d=>d.dias>5 && d.dias<=10).length;
  const a10 = concl.filter(d=>d.dias>10 && d.dias<=20).length;
  const a20 = concl.filter(d=>d.dias>20).length;

  const buckets = [
    { id:'gAte5', label:'Concluídas até 5 dias', value:b5, color:'#1E8E5A' },
    { id:'gAte10', label:'Concluídas até 10 dias', value:b10, color:'#3E7CB1' },
    { id:'gAcima10', label:'Concluídas entre 11–20 dias', value:a10, color:'#C9881A' },
    { id:'gAcima20', label:'Concluídas acima de 20 dias', value:a20, color:'#C5371F' },
  ];

  document.getElementById('gaugeGrid').innerHTML = buckets.map(b=>`
    <div class="card gauge-card">
      <div class="chart-wrap short"><canvas id="${b.id}"></canvas></div>
      <div class="gauge-num">${b.value}</div>
      <div class="gauge-pct">${fmtPct(total?b.value/total:0)} das concluídas</div>
      <div class="gauge-title">${b.label}</div>
    </div>`).join('');

  buckets.forEach(b=> drawGauge(b.id, b.value, total, b.color));

  const byResp = {};
  concl.forEach(d=>{
    const r = d.responsavel;
    if(!byResp[r]) byResp[r] = {b5:0,b10:0,a10:0,a20:0,total:0};
    byResp[r].total++;
    if(d.dias<=5) byResp[r].b5++; else if(d.dias<=10) byResp[r].b10++; else if(d.dias<=20) byResp[r].a10++; else byResp[r].a20++;
  });
  const rows = Object.entries(byResp).sort((a,b)=>b[1].total-a[1].total);
  document.getElementById('slaTableBody').innerHTML = rows.map(([resp,v])=>`
    <tr>
      <td>${resp}</td><td>${v.b5}</td><td>${v.b10}</td><td>${v.a10}</td>
      <td>${v.a20 ? `<span class="badge red">${v.a20}</span>` : v.a20}</td><td>${v.total}</td>
    </tr>`).join('') || '<tr><td colspan="6">Sem demandas concluídas para o filtro selecionado.</td></tr>';
}

/* ============ GARGALOS ============ */
function renderGargalos(data){
  destroyChart('backlogResp'); destroyChart('backlogSetor');
  const abertas = data.filter(d=>d.status!=='Concluído');
  const byRespOpen = sortDesc(groupCount(abertas,'responsavel'));
  const bySetorAll = sortDesc(groupCount(data,'setor')).slice(0,10);

  charts.backlogResp = new Chart(document.getElementById('chartBacklogResp'), {
    type:'bar',
    data:{ labels: byRespOpen.map(e=>e[0]), datasets:[{ data: byRespOpen.map(e=>e[1]), backgroundColor:'#C5371F', borderRadius:6, maxBarThickness:26 }]},
    options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{display:false} },
      scales:{ x: baseGridOpts(), y:{ grid:{display:false}, ticks:{ font:{size:11, family:'Manrope', weight:'600'}, color:'#1A1A1A' } } } }
  });

  charts.backlogSetor = new Chart(document.getElementById('chartBacklogSetor'), {
    type:'bar',
    data:{ labels: bySetorAll.map(e=>e[0]), datasets:[{ data: bySetorAll.map(e=>e[1]), backgroundColor:'#1A1A1A', borderRadius:6, maxBarThickness:26 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ y: baseGridOpts(), x:{ grid:{display:false}, ticks:{ font:{size:10, family:'Manrope'}, color:'#1A1A1A', maxRotation:40, minRotation:20 } } } }
  });

  const top10 = [...data].sort((a,b)=>b.dias-a.dias).slice(0,10);
  document.getElementById('top10Body').innerHTML = top10.map(d=>`
    <tr class="${d.dias>20?'row-alert':''}">
      <td>${d.assunto || '(sem assunto)'}</td><td>${d.responsavel}</td><td>${d.setor}</td>
      <td><b>${d.dias}</b></td>
      <td>${d.status==='Concluído' ? '<span class="badge green">Concluído</span>' : '<span class="badge yellow">Em andamento</span>'}</td>
    </tr>`).join('') || '<tr><td colspan="5">Sem dados para o filtro selecionado.</td></tr>';

  const today = new Date();
  const openSorted = abertas.map(d=>{
    const rec = d.recebimento ? new Date(d.recebimento) : null;
    const diasAberto = rec ? Math.round((today-rec)/(1000*60*60*24)) : null;
    return {...d, diasAberto};
  }).sort((a,b)=> (b.diasAberto||0)-(a.diasAberto||0));

  document.getElementById('openBody').innerHTML = openSorted.map(d=>`
    <tr class="${d.diasAberto>20?'row-alert':''}">
      <td>${d.assunto || '(sem assunto)'}</td><td>${d.responsavel}</td><td>${d.setor}</td>
      <td><b>${d.diasAberto ?? '—'}</b></td><td>${d.recebimento ? d.recebimento.split('-').reverse().join('/') : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="5">Nenhuma demanda em andamento no filtro selecionado.</td></tr>';
}

/* ============ MASTER RENDER ============ */
function render(){
  const data = getFiltered();
  document.getElementById('filterCount').textContent = data.length.toLocaleString('pt-BR');
  document.getElementById('filterTotal').textContent = RAW_DATA.length.toLocaleString('pt-BR');

  renderKpis(data);
  renderRespChart(data);
  renderDonut('tipo','demanda', data, PALETTE);
  renderDonut('status','status', data, ['#1E8E5A','#C9881A','#C5371F','#6E6358']);
  renderSetorChart(data);
  renderEvolucao(data);
  renderTempoResp(data);
  renderHeatmap(data);
  renderInsights(data);
  renderProdutividade(data);
  renderSla(data);
  renderGargalos(data);
}

function init(){
  const recDates = RAW_DATA.map(d=>d.recebimento).filter(Boolean).sort();
  if(recDates.length){
    document.getElementById('dataRange').textContent = `${recDates[0].split('-').reverse().join('/')} a ${recDates[recDates.length-1].split('-').reverse().join('/')}`;
  }
  document.getElementById('totalRecords').textContent = RAW_DATA.length.toLocaleString('pt-BR');
  initFilters();
  render();
}

loadData();
