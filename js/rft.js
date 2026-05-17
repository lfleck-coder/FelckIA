/* ============================================================
   rft.js — Cálculo e renderização do RFT
   Depende de: config.js, utils.js
   ============================================================ */

function renderRFT() {
  if (!Object.keys(WO_MAP).length) return;

  // ── Torna o conteúdo visível ANTES de criar os gráficos ────
  document.getElementById('rft-content').style.display = 'block';

  var meta = RFT_TARGET || 95;

  // ── RFT diário usa sempre D-1 (dados chegam com 1 dia de atraso) ──
  var ontem    = new Date();
  ontem.setDate(ontem.getDate() - 1);
  var diaRef   = ontem.toISOString().split('T')[0];      // D-1
  var hoje     = new Date().toISOString().split('T')[0]; // data real (para exibição)

  var anoAtual    = diaRef.substring(0, 4);
  var anoAnterior = String(parseInt(anoAtual) - 1);
  var semAtual    = weekKey(diaRef);
  var wos         = Object.values(WO_MAP);

  document.getElementById('rft-meta-info').innerHTML =
    'Meta RFT calculada automaticamente: <strong>' + meta + '%</strong> ' +
    '(media historica + 2% de melhoria). Ajuste manualmente em Configuracoes se necessario.';

  // ── Função de cálculo por filtro ────────────────────────────
  function calcP(fn) {
    var f   = wos.filter(fn);
    var tot = f.length;
    var ok  = f.filter(function(w) { return w.dpu === 0; }).length;
    return tot === 0 ? { rft: null, tot: 0, ok: 0 } : { rft: Math.round(ok / tot * 10000) / 100, tot: tot, ok: ok };
  }

  // ── Cards de resumo ─────────────────────────────────────────
  var rH   = calcP(function(w) { return w.date === diaRef; });
  var rS   = calcP(function(w) { return weekKey(w.date) === semAtual; });
  var rA   = calcP(function(w) { return (w.date || '').startsWith(anoAtual); });
  var rAnt = calcP(function(w) { return (w.date || '').startsWith(anoAnterior); });

  function card(lbl, r, sub) {
    var v = r.rft === null ? '--' : r.rft + '%';
    var c = rftCls(r.rft, meta);
    return '<div class="rft-c ' + c + '">' +
      '<div class="rft-lbl">' + lbl + '</div>' +
      '<div class="rft-val ' + c + '">' + v + '</div>' +
      '<div class="rft-sub">' + r.ok + ' ok / ' + r.tot + ' WOs &middot; ' + sub + '</div>' +
      '<div class="rft-bar"><div class="rft-bar-fill" style="width:' + Math.min(r.rft || 0, 100) + '%;background:' + (c === 'good' ? '#16a34a' : c === 'warn' ? '#d97706' : '#dc2626') + '"></div></div>' +
      '<div style="font-size:9px;color:#9ca3af;margin-top:4px">Meta: ' + meta + '%</div></div>';
  }

  document.getElementById('rft-cards').innerHTML =
    card('RFT Diario (D-1)', rH, fmtD(diaRef)) +
    card('RFT Semanal', rS, 'Sem. ' + fmtD(semAtual)) +
    card('Acumulado ' + anoAtual, rA, 'Jan-Dez') +
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

  // ── Gráfico combinado: acumulados anuais + semanas do ano atual ──
  //
  // Estrutura do gráfico:
  //   [Ano Anterior | Ano Atual | S01 | S02 | S03 | ...]
  //   Barras anuais (índigo) = referência histórica
  //   Barras semanais (verde/amarelo/vermelho) = desempenho por meta
  //
  var semMap = {};
  wos.forEach(function(w) {
    if (!(w.date || '').startsWith(anoAtual)) return;
    var wk = weekKey(w.date); if (wk === '?') return;
    if (!semMap[wk]) semMap[wk] = { tot: 0, ok: 0 };
    semMap[wk].tot++;
    if (w.dpu === 0) semMap[wk].ok++;
  });
  var semKeys = Object.keys(semMap).sort();

  var cLabels = [anoAnterior, anoAtual].concat(
    semKeys.map(function(k) { return 'S' + k.slice(5, 7); })
  );
  var cData = [rAnt.rft, rA.rft].concat(
    semKeys.map(function(k) {
      var r = semMap[k];
      return r.tot > 0 ? Math.round(r.ok / r.tot * 10000) / 100 : null;
    })
  );
  // Barras anuais: índigo fixo (referência). Semanais: cor por desempenho.
  var cColors = ['#6366f1', '#6366f1'].concat(
    semKeys.map(function(k) {
      var r = semMap[k];
      var v = r.tot > 0 ? Math.round(r.ok / r.tot * 10000) / 100 : null;
      if (v === null) return '#d1d5db';
      return v >= meta ? '#16a34a' : v >= meta - 5 ? '#d97706' : '#dc2626';
    })
  );

  var validC = cData.filter(function(v) { return v !== null; });
  var minY   = validC.length ? Math.max(50, Math.min.apply(null, validC) - 8) : 80;

  if (CH['c-rft-combined']) CH['c-rft-combined'].destroy();
  CH['c-rft-combined'] = new Chart(document.getElementById('c-rft-combined').getContext('2d'), {
    type: 'bar',
    data: {
      labels: cLabels,
      datasets: [
        {
          label: 'RFT %',
          data: cData,
          backgroundColor: cColors,
          borderRadius: 6
        },
        {
          label: 'Meta ' + meta + '%',
          data: cLabels.map(function() { return meta; }),
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
        legend: { labels: { font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.datasetIndex === 1) return 'Meta: ' + meta + '%';
              var v = ctx.raw;
              if (v === null) return 'Sem dados';
              var idx = ctx.dataIndex;
              var tot = idx === 0 ? rAnt.tot : idx === 1 ? rA.tot : (semMap[semKeys[idx - 2]] || {}).tot || 0;
              var ok  = idx === 0 ? rAnt.ok  : idx === 1 ? rA.ok  : (semMap[semKeys[idx - 2]] || {}).ok  || 0;
              return 'RFT: ' + v + '% (' + ok + ' ok / ' + tot + ' WOs)';
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 40 } },
        y: {
          min: minY, max: 100,
          ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } }
        }
      }
    }
  });

  // ── RFT por família de modelo ────────────────────────────────
  var modMap = {};
  wos.forEach(function(w) {
    var m = w.model || '--';
    if (!modMap[m]) modMap[m] = { tot: 0, ok: 0 };
    modMap[m].tot++;
    if (w.dpu === 0) modMap[m].ok++;
  });
  var mKeys = Object.keys(modMap).filter(function(k) { return modMap[k].tot > 0; }).sort();
  mkRFTBar(
    'c-rft-m',
    mKeys,
    mKeys.map(function(k) { var r = modMap[k]; return Math.round(r.ok / r.tot * 10000) / 100; }),
    meta
  );
}
