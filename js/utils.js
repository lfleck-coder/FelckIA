/* ============================================================
   utils.js — Funções utilitárias e construtores de gráficos
   Depende de: config.js
   ============================================================ */

// ── Contagem por chave ────────────────────────────────────────
function cnt(arr, key) {
  var m = {};
  arr.forEach(function(r) {
    var k = r[key] || '';
    if (!k || k.trim() === '') return;
    m[k] = (m[k] || 0) + 1;
  });
  return m;
}

// ── Ordenar objeto por valor (desc) ──────────────────────────
function sortObj(o) {
  return Object.entries(o).sort(function(a, b) { return b[1] - a[1]; });
}

// ── Chave de semana (ISO, segunda-feira) ──────────────────────
function weekKey(ds) {
  if (!ds || ds.length < 8) return '?';
  var d = new Date(ds);
  if (isNaN(d.getTime())) return '?';
  var day  = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  var m    = new Date(d);
  m.setDate(diff);
  return m.toISOString().split('T')[0];
}

// ── Formata data ISO → DD/MM ──────────────────────────────────
function fmtD(ds) {
  if (!ds || ds.length < 10) return ds || '';
  var p = ds.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : ds;
}

// ── Cor do heatmap por intensidade ───────────────────────────
function heatColor(v, mx) {
  if (!v || v === 0) return '#e2e8f0';
  var t = v / mx;
  if (t < 0.2) return '#fef3c7';
  if (t < 0.4) return '#fde68a';
  if (t < 0.6) return '#fb923c';
  if (t < 0.8) return '#f97316';
  return '#dc2626';
}

// ── Classe CSS para valor de RFT ─────────────────────────────
function rftCls(v, meta) {
  return v === null ? 'bad' : v >= meta ? 'good' : v >= meta - 5 ? 'warn' : 'bad';
}

// ── Filtrar DEF pelo modelo selecionado no dashboard ─────────
function filtDef() {
  var base = DEF.filter(function(r) { return r._model; });
  return SEL === 'all' ? base : base.filter(function(r) { return r._model === SEL; });
}

// ── Filtrar DEF por seletor independente ─────────────────────
function filtFor(sel) {
  var base = DEF.filter(function(r) { return r._model; });
  return sel === 'all' ? base : base.filter(function(r) { return r._model === sel; });
}

// ── Lista de modelos canônicos presentes nos dados ────────────
function getCanonModels() {
  var ms = [];
  DEF.forEach(function(r) {
    if (r._model && ms.indexOf(r._model) === -1) ms.push(r._model);
  });
  return ms.sort();
}

// ── Construtor de seletor de modelo ──────────────────────────
function buildModelSel(elId, cur, fnName) {
  var ms   = getCanonModels();
  var html = '<button class="mbtn' + (cur === 'all' ? ' on' : '') + '" onclick="' + fnName + '(\'all\',this)">Todos</button>';
  ms.forEach(function(m) {
    html += '<button class="mbtn' + (cur === m ? ' on' : '') + '" onclick="' + fnName + '(\'' + m.replace(/'/g, "\\'") + '\',this)">' + m + '</button>';
  });
  document.getElementById(elId).innerHTML = html;
}

// ── Selectores por gráfico ────────────────────────────────────
function selModel(m, el) {
  SEL = m;
  document.querySelectorAll('.model-sel .mbtn').forEach(function(b) { b.classList.remove('on'); });
  el.classList.add('on');
  renderDash();
}

function selPareto(m, el) {
  SEL_PARETO = m;
  document.querySelectorAll('#model-sel-pareto .mbtn').forEach(function(b) { b.classList.remove('on'); });
  el.classList.add('on');
  renderParetoOnly();
}

function selHM(m, el) {
  SEL_HM = m;
  document.querySelectorAll('#model-sel-hm .mbtn').forEach(function(b) { b.classList.remove('on'); });
  el.classList.add('on');
  renderHeatmapOnly();
}

// ── Construtores de gráficos Chart.js ────────────────────────
function mkBar(id, labels, data, colors, horiz) {
  if (CH[id]) CH[id].destroy();
  var bg = Array.isArray(colors)
    ? labels.map(function(_, i) { return colors[i % colors.length]; })
    : colors;
  CH[id] = new Chart(document.getElementById(id).getContext('2d'), {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: 'Defeitos', data: data, backgroundColor: bg, borderRadius: 5 }] },
    options: {
      indexAxis: horiz ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } }
    }
  });
}

function mkLine(id, labels, data) {
  if (CH[id]) CH[id].destroy();
  CH[id] = new Chart(document.getElementById(id).getContext('2d'), {
    type: 'line',
    data: { labels: labels, datasets: [{ label: 'Defeitos', data: data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', tension: .35, fill: true, pointRadius: 4, pointBackgroundColor: '#3b82f6' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: { size: 9 }, maxRotation: 40 } }, y: { ticks: { font: { size: 10 } } } }
    }
  });
}

function mkRFTLine(id, labels, data, meta) {
  if (CH[id]) CH[id].destroy();
  var valid = data.filter(function(v) { return v !== null; });
  var minY  = valid.length ? Math.max(50, Math.min.apply(null, valid) - 8) : 80;
  var ptC   = data.map(function(v) {
    return v === null ? 'transparent' : v >= meta ? '#16a34a' : v >= meta - 5 ? '#d97706' : '#dc2626';
  });
  CH[id] = new Chart(document.getElementById(id).getContext('2d'), {
    type: 'line',
    data: { labels: labels, datasets: [
      { label: 'RFT %', data: data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)', tension: .3, fill: true, pointRadius: 4, pointBackgroundColor: ptC, spanGaps: true },
      { label: 'Meta ' + meta + '%', data: labels.map(function() { return meta; }), borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { size: 10 } } } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 40 } },
        y: { min: minY, max: 100, ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } } }
      }
    }
  });
}

function mkRFTBar(id, labels, data, meta) {
  if (CH[id]) CH[id].destroy();
  var minY   = data.length ? Math.max(50, Math.min.apply(null, data) - 8) : 80;
  var colors = data.map(function(v) { return v >= meta ? '#16a34a' : v >= meta - 5 ? '#d97706' : '#dc2626'; });
  CH[id] = new Chart(document.getElementById(id).getContext('2d'), {
    type: 'bar',
    data: { labels: labels, datasets: [
      { label: 'RFT %', data: data, backgroundColor: colors, borderRadius: 6 },
      { label: 'Meta ' + meta + '%', data: labels.map(function() { return meta; }), type: 'line', borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { size: 10 } } } },
      scales: {
        x: { ticks: { font: { size: 10 } } },
        y: { min: minY, max: 100, ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } } }
      }
    }
  });
}
