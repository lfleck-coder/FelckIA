/* ============================================================
   data.js — Processamento de dados e carga de demonstração
   Depende de: config.js, parser.js, utils.js
   ============================================================ */

// ── Handlers de upload ────────────────────────────────────────
function handleDefFile(e) {
  var f = e.target.files[0];
  if (!f) return;
  readFile(f, function(txt) { processDefData(txt, f.name); });
}

function handleProdFile(e) {
  var f = e.target.files[0];
  if (!f) return;
  readFile(f, function(txt) { processProdData(txt, f.name); });
}

// ── Processa CSV de defeitos ──────────────────────────────────
function processDefData(txt, fname) {
  var rows = parseCSV(txt);

  DEF = rows.filter(function(r) {
    return (r['CD_POSTO_FALHA'] || '').trim().toUpperCase() === 'QG09'
        && (r['ANOMALIA_FALHA'] || '').trim() !== '';
  });

  var excModels = {}, excAreas = {};

  DEF.forEach(function(r) {
    r._date    = normDate(r['DT_CRIACAO_FALHA']);
    r._anomalia = (r['ANOMALIA_FALHA'] || '').trim();
    var parsed = parseAnomalia(r._anomalia);
    r._model   = parsed.model || normModelStr(r['C_MODELO_FAMILIA'] || r['CD_MODELO'] || '');
    r._region  = parsed.area;
    r._defect  = parsed.defect;

    // Rastreia excluídos para mostrar ao usuário
    if (!r._model && r._anomalia) {
      var key = (r._anomalia.split(/\s{2,}/)[0] || '').substring(0, 50);
      excModels[key] = (excModels[key] || 0) + 1;
    }
    if (!r._region && r._anomalia) {
      var key2 = (r._anomalia.split(/\s{2,}/)[0] || '').substring(0, 50);
      excAreas[key2] = (excAreas[key2] || 0) + 1;
    }
  });

  SEL = 'all';
  var cols       = rows.length ? Object.keys(rows[0]).join(', ') : '';
  var validCount = DEF.filter(function(r) { return r._model; }).length;
  var excMTop    = Object.entries(excModels).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(e){return e[1]+'x &rarr; "'+e[0]+'"';}).join('<br>');
  var excATop    = Object.entries(excAreas).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(e){return e[1]+'x &rarr; "'+e[0]+'"';}).join('<br>');

  document.getElementById('fb-def').innerHTML =
    '<div class="al al-ok">CSV <strong>' + fname + '</strong> importado!<br>' +
    'Total QG09: <strong>' + DEF.length + '</strong> &middot; Nos graficos: <strong>' + validCount + '</strong><br>' +
    '<span style="font-size:10px;color:#166534">Colunas: ' + cols + '</span>' +
    '<div style="margin-top:8px;display:flex;gap:6px">' +
    '<button class="btn btnp btnsm" onclick="nav(\'dash\',document.querySelectorAll(\'.ni\')[1])">Dashboard</button>' +
    '<button class="btn btnsm" onclick="nav(\'crit\',document.querySelectorAll(\'.ni\')[3])">Criticos</button>' +
    '<button class="btn btnsm" onclick="document.getElementById(\'excl-box\').style.display=document.getElementById(\'excl-box\').style.display===\'none\'?\'block\':\'none\'">Ver excluidos</button>' +
    '</div></div>' +
    '<div id="excl-box" style="display:none;margin-top:8px" class="al al-w">' +
    '<strong>Modelos nao reconhecidos (excluidos dos graficos):</strong><br>' +
    (excMTop || 'Nenhum — todos reconhecidos!') + '<br><br>' +
    '<strong>Anomalias sem area reconhecida (excluidas do heatmap):</strong><br>' +
    (excATop || 'Nenhuma — todas reconhecidas!') + '</div>';

  if (DEF.length === 0) {
    document.getElementById('fb-def').innerHTML +=
      '<div class="al al-e" style="margin-top:8px">Nenhum registro QG09 encontrado. Verifique se CD_POSTO_FALHA contem "QG09".</div>';
  }
}

// ── Processa CSV de producao (Lista de Maquinas) ──────────────
function processProdData(txt, fname) {
  var rows = parseCSV(txt);

  var qg09 = rows.filter(function(r) {
    return (r['CD_POSTO_CN'] || r['CD_POSTO_FALHA'] || '').trim().toUpperCase() === 'QG09';
  });

  WO_MAP = {};
  qg09.forEach(function(r) {
    var wo    = (r['NR_WO'] || '').trim(); if (!wo) return;
    var dpu   = parseFloat(r['C_DPU_QG_AMARELO']) || 0;
    var date  = normDate(r['DT_HR_INSPECAO'] || r['DT_CRIACAO_FALHA'] || '');
    var model = normModelStr(r['CD_MODELO'] || r['C_MODELO_FAMILIA'] || '');
    if (!WO_MAP[wo]) WO_MAP[wo] = { dpu: dpu, model: model, date: date };
    else if (dpu > WO_MAP[wo].dpu) WO_MAP[wo].dpu = dpu;
  });

  PROD = qg09;
  RFT_TARGET = calcAutoTarget();

  document.getElementById('fb-prod').innerHTML =
    '<div class="al al-ok"><strong>' + fname + '</strong> carregado &middot; ' +
    rows.length + ' linhas &middot; QG09: <strong>' + qg09.length + '</strong> registros &middot; ' +
    '<strong>' + Object.keys(WO_MAP).length + '</strong> WOs unicas</div>';

  document.getElementById('rft-content').style.display = 'block';
  renderRFT();
}

// ── Calcula meta RFT automaticamente ─────────────────────────
function calcAutoTarget() {
  var manual = parseFloat(document.getElementById('cfg-rft-meta').value);
  if (manual >= 50 && manual <= 100) return manual;

  var wos = Object.values(WO_MAP);
  if (!wos.length) return 95;

  var weeks = {};
  wos.forEach(function(w) {
    var wk = weekKey(w.date); if (wk === '?') return;
    if (!weeks[wk]) weeks[wk] = { tot: 0, ok: 0 };
    weeks[wk].tot++;
    if (w.dpu === 0) weeks[wk].ok++;
  });

  var rfts = Object.values(weeks)
    .filter(function(w) { return w.tot >= 3; })
    .map(function(w)    { return w.ok / w.tot * 100; });

  if (!rfts.length) {
    var t = wos.length, o = wos.filter(function(w) { return w.dpu === 0; }).length;
    return Math.min(99, Math.round(o / t * 100 + 2));
  }
  var avg = rfts.reduce(function(a, b) { return a + b; }, 0) / rfts.length;
  return Math.min(99, Math.round(avg + 2));
}

// ── Dados de demonstração ─────────────────────────────────────
function loadDemo() {
  var models  = ['VTBA', 'VTBA', 'V2 MF', 'V2 MF', 'G7', 'G8', 'V2 VT'];
  var defects = ['SOLDA - RESPINGOS', 'SOLDA - FALTA CORDAO QTD', 'SOLDA - ACABAMENTO NAO REALIZADO', 'SOLDA - SOBREPOSICAO', 'PECA FORA DO ESPECIFICADO', 'SOLDA - FALTA PENETRACAO'];
  var regions = ['LATERAL DIREITA', 'LATERAL ESQUERDA', 'FRONTAL', 'TETO', 'ASSOALHO', 'TRASEIRA'];
  var rows = [], hoje = new Date(), now = hoje.toISOString().split('T')[0];

  for (var i = 0; i < 200; i++) {
    var d = new Date(hoje); d.setDate(d.getDate() - Math.floor(Math.random() * 90));
    var mod = models[Math.floor(Math.random() * models.length)];
    var reg = regions[Math.floor(Math.random() * regions.length)];
    var def = defects[Math.floor(Math.random() * defects.length)];
    rows.push({
      NR_WO: 'WO-' + (10000 + Math.floor(Math.random() * 500)),
      DT_CRIACAO_FALHA: d.toISOString().split('T')[0],
      C_MODELO_FAMILIA: mod, CD_POSTO_FALHA: 'QG09',
      ANOMALIA_FALHA: 'GLAZED FRAME ' + mod + ' ' + reg + '  ' + def,
      C_AREA_ORIGEM_FALHA: reg, C_DPU_QG_AMARELO: '1', D1: '', NR_SERIE: 'SN-' + i
    });
  }

  // Força críticos desta semana
  for (var j = 0; j < 6; j++) rows.push({ NR_WO: 'WO-' + (10600 + j), DT_CRIACAO_FALHA: now, C_MODELO_FAMILIA: 'VTBA', CD_POSTO_FALHA: 'QG09', ANOMALIA_FALHA: 'GLAZED FRAME VTBA LATERAL DIREITA  SOLDA - RESPINGOS', C_AREA_ORIGEM_FALHA: 'LATERAL DIREITA', C_DPU_QG_AMARELO: '1', D1: '', NR_SERIE: 'SN-X' + j });
  for (var k = 0; k < 4; k++) rows.push({ NR_WO: 'WO-' + (10700 + k), DT_CRIACAO_FALHA: now, C_MODELO_FAMILIA: 'V2 MF', CD_POSTO_FALHA: 'QG09', ANOMALIA_FALHA: 'GLAZED FRAME V2 MF TRASEIRA  SOLDA - FALTA CORDAO QTD', C_AREA_ORIGEM_FALHA: 'TRASEIRA', C_DPU_QG_AMARELO: '1', D1: '', NR_SERIE: 'SN-Y' + k });

  DEF = rows;
  DEF.forEach(function(r) {
    r._date     = r['DT_CRIACAO_FALHA'];
    r._anomalia = r['ANOMALIA_FALHA'] || '';
    var p       = parseAnomalia(r._anomalia);
    r._model    = p.model || r['C_MODELO_FAMILIA'] || '';
    r._region   = p.area;
    r._defect   = p.defect;
  });

  SEL = 'all';
  document.getElementById('fb-def').innerHTML =
    '<div class="al al-ok">Demo carregado: <strong>' + DEF.length + '</strong> defeitos QG09' +
    '<div style="margin-top:8px;display:flex;gap:6px">' +
    '<button class="btn btnp btnsm" onclick="nav(\'dash\',document.querySelectorAll(\'.ni\')[1])">Dashboard</button>' +
    '<button class="btn btnsm" onclick="nav(\'crit\',document.querySelectorAll(\'.ni\')[3])">Criticos</button>' +
    '</div></div>';
}
