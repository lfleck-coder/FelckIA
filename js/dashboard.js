/* ============================================================
   dashboard.js — Renderização do Dashboard
   Depende de: config.js, parser.js, utils.js
   ============================================================ */

function renderDash() {
  var data = filtDef();
  if (!data.length) {
    document.getElementById('mrow').innerHTML = '<div class="al al-w" style="grid-column:1/-1">Sem dados QG09. Importe o CSV primeiro.</div>';
    return;
  }

  // Seletor de modelo global
  var allModels = getCanonModels();
  document.getElementById('model-sel').innerHTML =
    '<button class="mbtn' + (SEL === 'all' ? ' on' : '') + '" onclick="selModel(\'all\',this)">Todos</button>' +
    allModels.map(function(m) {
      return '<button class="mbtn' + (SEL === m ? ' on' : '') + '" onclick="selModel(\'' + m.replace(/'/g, "\\'") + '\',this)">' + m + '</button>';
    }).join('');

  // WOs com defeito
  var wosSet = new Set();
  data.forEach(function(r) { if (r['NR_WO'] && r._model) wosSet.add(r['NR_WO']); });

  // RFT acumulado do ano via WO_MAP
  var anoAtual = new Date().toISOString().substring(0, 4);
  var rftAnual = null;
  if (Object.keys(WO_MAP).length) {
    var wosAno = Object.values(WO_MAP).filter(function(w) { return (w.date || '').startsWith(anoAtual); });
    var okAno  = wosAno.filter(function(w) { return w.dpu === 0; }).length;
    if (wosAno.length) rftAnual = Math.round(okAno / wosAno.length * 10000) / 100;
  }

  // Top 1 defeito
  var defMap = {};
  data.forEach(function(r) { if (r._defect && r._defect.trim()) defMap[r._defect] = (defMap[r._defect] || 0) + 1; });
  var defSorted = sortObj(defMap);
  var top1      = defSorted.length ? defSorted[0][0] : '--';
  var top1Short = top1.length > 22 ? top1.substring(0, 20) + '...' : top1;

  // Modelo mais afetado
  var modMap = {};
  data.forEach(function(r) { if (r._model) modMap[r._model] = (modMap[r._model] || 0) + 1; });
  var topModel = sortObj(modMap).length ? sortObj(modMap)[0][0] : '--';

  // Taxa DPU geral
  var dpu = Math.round(data.length / (wosSet.size || 1) * 100) / 100;

  var rftDisplay = rftAnual !== null ? (rftAnual + '%') : '--';
  var rftClass   = rftAnual === null ? 'bl' : rftAnual >= 95 ? 'gr' : rftAnual >= 90 ? 'am' : 'red';

  document.getElementById('dash-sub').textContent = 'QG09 - ' + data.length + ' defeitos' + (SEL !== 'all' ? ' - ' + SEL : '');

  document.getElementById('mrow').innerHTML =
    '<div class="mc"><div class="mc-l">Defeitos QG09</div><div class="mc-v red">' + data.length + '</div></div>' +
    '<div class="mc"><div class="mc-l">RFT Acumulado ' + anoAtual + '</div><div class="mc-v ' + rftClass + '">' + rftDisplay + '</div></div>' +
    '<div class="mc"><div class="mc-l">Top 1 Defeito</div><div class="mc-v" style="font-size:13px;line-height:1.3;color:#7c3aed" title="' + top1 + '">' + top1Short + '</div></div>' +
    '<div class="mc"><div class="mc-l">Modelo mais afetado</div><div class="mc-v" style="font-size:18px;color:#0369a1">' + topModel + '</div></div>' +
    '<div class="mc"><div class="mc-l">Taxa (def / WO)</div><div class="mc-v am">' + dpu + '</div></div>';

  renderPareto(data);
  renderModelChart(data);
  renderDPU(data);
  renderSemanal(data);
  renderHeatmap(data);
  renderModelRegiao();
}

// ── Pareto TOP 15 ─────────────────────────────────────────────
function renderPareto() {
  buildModelSel('model-sel-pareto', SEL_PARETO, 'selPareto');
  renderParetoOnly();
}

function renderParetoOnly() {
  var data = filtFor(SEL_PARETO);
  var dm   = {};
  data.forEach(function(r) { var d = r._defect || r._anomalia || ''; if (!d) return; dm[d] = (dm[d] || 0) + 1; });
  var sorted = sortObj(dm).slice(0, 15);
  var labels = sorted.map(function(e) { return e[0].length > 32 ? e[0].substring(0, 30) + '...' : e[0]; });
  var values = sorted.map(function(e) { return e[1]; });
  var total  = values.reduce(function(a, b) { return a + b; }, 0);
  var cum = [], s = 0;
  values.forEach(function(v) { s += v; cum.push(Math.round(s / total * 100)); });

  if (CH['pareto']) CH['pareto'].destroy();
  CH['pareto'] = new Chart(document.getElementById('c-pareto').getContext('2d'), {
    data: { labels: labels, datasets: [
      { type: 'bar', label: 'Defeitos', data: values, backgroundColor: values.map(function(_, i) { return cum[i] <= 80 ? '#3b82f6' : '#93c5fd'; }), borderRadius: 4, yAxisID: 'y' },
      { type: 'line', label: '% Acum.', data: cum, borderColor: '#dc2626', backgroundColor: 'transparent', pointRadius: 3, pointBackgroundColor: '#dc2626', tension: .1, yAxisID: 'y2' }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { size: 10 } } } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 35 } },
        y: { ticks: { font: { size: 10 } } },
        y2: { position: 'right', min: 0, max: 100, ticks: { font: { size: 10 }, callback: function(v) { return v + '%'; } }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

// ── Defeitos por modelo ───────────────────────────────────────
function renderModelChart(data) {
  var sorted = sortObj(cnt(data, '_model'));
  mkBar('c-modelo',
    sorted.map(function(e) { return e[0]; }),
    sorted.map(function(e) { return e[1]; }),
    ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b']
  );
}

// ── DPU semanal ───────────────────────────────────────────────
function renderDPU(data) {
  var semDef = {}, semWO = {};
  data.forEach(function(r) {
    var wk = weekKey(r._date); if (wk === '?') return;
    semDef[wk] = (semDef[wk] || 0) + 1;
    if (!semWO[wk]) semWO[wk] = new Set();
    if (r['NR_WO']) semWO[wk].add(r['NR_WO']);
  });
  var keys = Object.keys(semDef).sort();
  var vals = keys.map(function(k) { return Math.round(semDef[k] / (semWO[k] ? semWO[k].size : 1) * 100) / 100; });
  var avg  = vals.length ? Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length * 100) / 100 : 0;

  if (CH['dpu']) CH['dpu'].destroy();
  CH['dpu'] = new Chart(document.getElementById('c-dpu').getContext('2d'), {
    type: 'line',
    data: { labels: keys.map(fmtD), datasets: [
      { label: 'DPU (def/WO)', data: vals, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.1)', tension: .35, fill: true, pointRadius: 4, pointBackgroundColor: '#f97316' },
      { label: 'Media ' + avg, data: keys.map(function() { return avg; }), borderColor: 'rgba(107,114,128,.5)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { size: 10 } } } }, scales: { x: { ticks: { font: { size: 9 }, maxRotation: 40 } }, y: { ticks: { font: { size: 10 } }, beginAtZero: true } } }
  });
}

// ── Tendência semanal ─────────────────────────────────────────
function renderSemanal(data) {
  var semMap = {};
  data.forEach(function(r) { var k = weekKey(r._date); if (k !== '?') semMap[k] = (semMap[k] || 0) + 1; });
  var keys = Object.keys(semMap).sort();
  mkLine('c-semanal', keys.map(fmtD), keys.map(function(k) { return semMap[k]; }));
}

// ── Heatmap da cabine ─────────────────────────────────────────
function renderHeatmap() {
  buildModelSel('model-sel-hm', SEL_HM, 'selHM');
  renderHeatmapOnly();
}

function renderHeatmapOnly() {
  var data = filtFor(SEL_HM);
  var hm   = { superior: 0, frontal: 0, 'lat-esq': 0, 'lat-dir': 0, inferior: 0, traseira: 0 };
  data.forEach(function(r) { var k = normRegion(r._region); if (k && hm.hasOwnProperty(k)) hm[k]++; });
  var maxV   = Math.max.apply(null, Object.values(hm).concat([1]));
  var svgMap = { superior: 'hm-superior', frontal: 'hm-frontal', 'lat-esq': 'hm-lat-esq', 'lat-dir': 'hm-lat-dir', inferior: 'hm-inferior', traseira: 'hm-traseira' };
  Object.entries(svgMap).forEach(function(e) { var el = document.getElementById(e[1]); if (el) el.setAttribute('fill', heatColor(hm[e[0]], maxV)); });

  var rawCnt = {};
  data.forEach(function(r) { var reg = r._region || ''; if (!reg.trim()) return; rawCnt[reg] = (rawCnt[reg] || 0) + 1; });
  var total = data.length || 1;
  document.getElementById('hm-list').innerHTML = sortObj(rawCnt).map(function(e) {
    var color = heatColor(hm[normRegion(e[0])] || 0, maxV);
    return '<div class="hm-row"><div class="hm-dot" style="background:' + color + '"></div><div class="hm-name">' + e[0] + '</div><div class="hm-cnt">' + e[1] + '<span class="hm-pct">' + Math.round(e[1] / total * 100) + '%</span></div></div>';
  }).join('');
}

// ── Modelo x Região (stacked bar) ────────────────────────────
function renderModelRegiao() {
  var data    = DEF.filter(function(r) { return r._model && r._region; });
  var regions = ['TETO', 'FRONTAL', 'LATERAL DIREITA', 'LATERAL ESQUERDA', 'ASSOALHO', 'TRASEIRA'];
  var models  = getCanonModels();
  var palette = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];

  var matrix = {};
  models.forEach(function(m) { matrix[m] = {}; regions.forEach(function(r) { matrix[m][r] = 0; }); });
  data.forEach(function(r) { if (matrix[r._model] && matrix[r._model].hasOwnProperty(r._region)) matrix[r._model][r._region]++; });

  if (CH['c-regiao']) CH['c-regiao'].destroy();
  CH['c-regiao'] = new Chart(document.getElementById('c-regiao').getContext('2d'), {
    type: 'bar',
    data: {
      labels: regions,
      datasets: models.map(function(m, i) {
        return { label: m, data: regions.map(function(r) { return matrix[m][r] || 0; }), backgroundColor: palette[i % palette.length], borderRadius: 3 };
      })
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10 } } },
        tooltip: { callbacks: { footer: function(items) { return 'Total: ' + items.reduce(function(s, i) { return s + i.raw; }, 0); } } }
      },
      scales: { x: { stacked: true, ticks: { font: { size: 10 } } }, y: { stacked: true, ticks: { font: { size: 10 } } } }
    }
  });
}
