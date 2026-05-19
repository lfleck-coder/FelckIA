/* ============================================================
   rft.js — Cálculo e renderização do RFT
   Depende de: config.js, utils.js
   ============================================================ */

// ── Número da semana ISO (1-53) a partir de uma data string ──
function isoWeekNum(dateStr) {
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  var day = d.getDay() || 7;                        // Dom=7, Seg=1...
  d.setDate(d.getDate() + 4 - day);                 // Quinta-feira da semana
  var yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function renderRFT() {
  if (!Object.keys(WO_MAP).length) return;

  document.getElementById('rft-content').style.display = 'block';

  var meta        = RFT_TARGET || 95;
  var ontem       = new Date();
  ontem.setDate(ontem.getDate() - 1);
  var diaRef      = ontem.toISOString().split('T')[0];       // D-1
  var hoje        = new Date().toISOString().split('T')[0];  // Hoje (exibição)
  var anoAtual    = diaRef.substring(0, 4);
  var anoAnterior = String(parseInt(anoAtual) - 1);
  var semAtual    = weekKey(diaRef);
  var wos         = Object.values(WO_MAP);

  document.getElementById('rft-meta-info').innerHTML =
    'Meta RFT calculada automaticamente: <strong>' + meta + '%</strong> ' +
    '(media historica + 2% de melhoria). Ajuste manualmente em Configuracoes se necessario.';

  // ── Cálculo genérico por filtro ──────────────────────────────
  function calcP(fn) {
    var f   = wos.filter(fn);
    var tot = f.length;
    var ok  = f.filter(function(w) { return w.dpu === 0; }).length;
    return tot === 0 ? { rft: null, tot: 0, ok: 0 }
                     : { rft: Math.round(ok / tot * 10000) / 100, tot: tot, ok: ok };
  }

  // ── Cards ────────────────────────────────────────────────────
  var rH   = calcP(function(w) { return w.date === diaRef; });
  var rS   = calcP(function(w) { return weekKey(w.date) === semAtual; });
  var rA   = calcP(function(w) { return (w.date || '').startsWith(anoAtual); });
  var rAnt = calcP(function(w) { return (w.date || '').startsWith(anoAnterior); });

  function card(lbl, r, sub) {
    var v = r.rft === null ? '--' : r.rft + '%';
    var c = rftCls(r.rft, meta);
    var bg = c === 'good' ? '#16a34a' : c === 'warn' ? '#d97706' : '#dc2626';
    return '<div class="rft-c ' + c + '">' +
      '<div class="rft-lbl">' + lbl + '</div>' +
      '<div class="rft-val ' + c + '">' + v + '</div>' +
      '<div class="rft-sub">' + r.ok + ' ok / ' + r.tot + ' WOs &middot; ' + sub + '</div>' +
      '<div class="rft-bar"><div class="rft-bar-fill" style="width:' + Math.min(r.rft || 0, 100) + '%;background:' + bg + '"></div></div>' +
      '<div style="font-size:9px;color:#9ca3af;margin-top:4px">Meta: ' + meta + '%</div></div>';
  }

  document.getElementById('rft-cards').innerHTML =
    card('RFT Diario (D-1)', rH, fmtD(diaRef)) +
    card('RFT Semanal', rS, 'Semana ' + (isoWeekNum(semAtual) || isoWeekNum(diaRef))) +
    card('Acumulado ' + anoAtual, rA, 'YTD &middot; ate ' + fmtD(diaRef)) +
    card('Acumulado ' + anoAnterior, rAnt, 'Jan-Dez');

  // ── Período de consulta ──────────────────────────────────────
  var periodEl = document.getElementById('rft-periodo');
  if (!periodEl) {
    periodEl = document.createElement('div');
    periodEl.id = 'rft-periodo';
    periodEl.style.cssText = 'font-size:10px;color:#9ca3af;text-align:right;margin-top:4px;margin-bottom:14px;';
    document.getElementById('rft-cards').insertAdjacentElement('afterend', periodEl);
  }
  periodEl.innerHTML =
    '&#128337; Periodo de consulta: dados ate <strong>' + fmtD(diaRef) + '</strong> &middot; ' +
    'Consulta realizada em ' + fmtD(hoje) + ' &middot; ' +
    Object.keys(WO_MAP).length + ' WOs no historico';

  // ── Gráfico combinado ─────────────────────────────────────────
  // Barras  → acumulado ano anterior e atual
  // Linha   → RFT semanal S01 → semana atual (número ISO)
  var elComb = document.getElementById('c-rft-combined');
  if (elComb) {

    // Agrupa WOs do ano atual por número de semana ISO
    var semByWN = {};
    wos.forEach(function(w) {
      if (!(w.date || '').startsWith(anoAtual)) return;
      var wk = weekKey(w.date); if (wk === '?') return;
      var wn = isoWeekNum(wk); if (!wn) return;
      if (!semByWN[wn]) semByWN[wn] = { tot: 0, ok: 0 };
      semByWN[wn].tot++;
      if (w.dpu === 0) semByWN[wn].ok++;
    });

    // Semanas S01 → semana atual
    var curWN    = isoWeekNum(diaRef) || 1;
    var weekNums = [];
    for (var n = 1; n <= curWN; n++) weekNums.push(n);

    // Labels: anos + semanas
    var annualLbls = [anoAnterior, anoAtual];
    var weeklyLbls = weekNums.map(function(n) { return 'S' + String(n).padStart(2, '0'); });
    var allLabels  = annualLbls.concat(weeklyLbls);
    var total      = allLabels.length;

    // Dataset barras: apenas posições anuais com valor
    var barData = [rAnt.rft, rA.rft].concat(weekNums.map(function() { return null; }));
    var barColors = [
      rftCls(rAnt.rft, meta) === 'good' ? '#16a34a' : rftCls(rAnt.rft, meta) === 'warn' ? '#d97706' : '#dc2626',
      rftCls(rA.rft,   meta) === 'good' ? '#16a34a' : rftCls(rA.rft,   meta) === 'warn' ? '#d97706' : '#dc2626'
    ].concat(weekNums.map(function() { return 'transparent'; }));

    // Dataset linha: apenas posições semanais
    var lineVals = weekNums.map(function(n) {
      var r = semByWN[n];
      return r && r.tot > 0 ? Math.round(r.ok / r.tot * 10000) / 100 : null;
    });
    var lineData = [null, null].concat(lineVals);

    // Cores dos pontos da linha
    var ptColors = ['transparent', 'transparent'].concat(lineVals.map(function(v) {
      if (v === null) return 'transparent';
      return v >= meta ? '#16a34a' : v >= meta - 5 ? '#d97706' : '#dc2626';
    }));

    // Eixo Y mínimo
    var allVals = [rAnt.rft, rA.rft].concat(lineVals).filter(function(v) { return v !== null; });
    var minY    = allVals.length ? Math.max(0, Math.min.apply(null, allVals) - 8) : 80;

    // Opções de escala clean (sem grid)
    var cleanScale = {
      grid:   { display: false },
      border: { display: false }
    };

    if (CH['c-rft-combined']) CH['c-rft-combined'].destroy();
    CH['c-rft-combined'] = new Chart(elComb.getContext('2d'), {
      type: 'bar',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Acumulado anual',
            data: barData,
            backgroundColor: barColors,
            borderRadius: 6,
            maxBarThickness: 52,
            order: 2
          },
          {
            label: 'RFT Semanal',
            data: lineData,
            type: 'line',
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.07)',
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: 'transparent',
            spanGaps: false,
            order: 1
          },
          {
            label: 'Meta ' + meta + '%',
            data: allLabels.map(function() { return meta; }),
            type: 'line',
            borderColor: '#dc2626',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            filter: function(item) { return item.raw !== null; },
            callbacks: {
              label: function(ctx) {
                var v = ctx.raw;
                if (v === null) return null;
                var idx = ctx.dataIndex;
                var tot, ok;
                if (ctx.datasetIndex === 0) {
                  var ref = idx === 0 ? rAnt : rA;
                  return 'Acumulado: ' + v + '% (' + ref.ok + ' ok / ' + ref.tot + ' WOs)';
                }
                if (ctx.datasetIndex === 1) {
                  var wn2 = weekNums[idx - 2];
                  var r2  = semByWN[wn2] || { tot: 0, ok: 0 };
                  return 'Semana: ' + v + '% (' + r2.ok + ' ok / ' + r2.tot + ' WOs)';
                }
                return 'Meta: ' + v + '%';
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, cleanScale, {
            ticks: { font: { size: 9 }, color: '#9ca3af', maxRotation: 40 }
          }),
          y: Object.assign({}, cleanScale, {
            min: minY, max: 100,
            ticks: {
              callback: function(v) { return v + '%'; },
              font: { size: 9 },
              color: '#9ca3af'
            }
          })
        }
      }
    });
  }

  // ── RFT por família de modelo ────────────────────────────────
  var elMod = document.getElementById('c-rft-m');
  if (elMod) {
    var modMap = {};
    wos.forEach(function(w) {
      var m = w.model || '--';
      if (!modMap[m]) modMap[m] = { tot: 0, ok: 0 };
      modMap[m].tot++;
      if (w.dpu === 0) modMap[m].ok++;
    });
    var mKeys = Object.keys(modMap).filter(function(k) { return modMap[k].tot > 0 && k !== '--'; }).sort();

    if (CH['c-rft-m']) CH['c-rft-m'].destroy();
    var mVals   = mKeys.map(function(k) { var r = modMap[k]; return Math.round(r.ok / r.tot * 10000) / 100; });
    var mColors = mVals.map(function(v) { return v >= meta ? '#16a34a' : v >= meta - 5 ? '#d97706' : '#dc2626'; });
    var mMinY   = mVals.length ? Math.max(0, Math.min.apply(null, mVals) - 8) : 80;

    var cleanScale2 = { grid: { display: false }, border: { display: false } };
    CH['c-rft-m'] = new Chart(elMod.getContext('2d'), {
      type: 'bar',
      data: {
        labels: mKeys,
        datasets: [
          {
            label: 'RFT %',
            data: mVals,
            backgroundColor: mColors,
            borderRadius: 6,
            maxBarThickness: 64
          },
          {
            label: 'Meta ' + meta + '%',
            data: mKeys.map(function() { return meta; }),
            type: 'line',
            borderColor: '#dc2626',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { font: { size: 10 }, color: '#6b7280', boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                if (ctx.datasetIndex === 1) return 'Meta: ' + meta + '%';
                var k = ctx.label;
                var r = modMap[k] || { tot: 0, ok: 0 };
                return 'RFT: ' + ctx.raw + '% (' + r.ok + ' ok / ' + r.tot + ' WOs)';
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, cleanScale2, {
            ticks: { font: { size: 10 }, color: '#6b7280' }
          }),
          y: Object.assign({}, cleanScale2, {
            min: mMinY, max: 100,
            ticks: {
              callback: function(v) { return v + '%'; },
              font: { size: 9 },
              color: '#9ca3af'
            }
          })
        }
      }
    });
  }
}
