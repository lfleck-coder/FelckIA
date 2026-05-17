/* ============================================================
   rft.js — Cálculo e renderização do RFT
   Depende de: config.js, utils.js
   ============================================================ */

function renderRFT() {
  if (!Object.keys(WO_MAP).length) return;

  // ── Torna o conteúdo visível ANTES de criar os gráficos ────
  // (Chart.js precisa de canvas com dimensões reais para renderizar)
  document.getElementById('rft-content').style.display = 'block';

  var meta = RFT_TARGET || 95;

  // ── RFT diário usa sempre D-1 (dados chegam com 1 dia de atraso) ──
  var ontem    = new Date();
  ontem.setDate(ontem.getDate() - 1);
  var diaRef   = ontem.toISOString().split('T')[0];      // D-1
  var hoje     = new Date().toISOString().split('T')[0]; // data real (para exibição)

  var anoAtual = diaRef.substring(0, 4);
  var semAtual = weekKey(diaRef);
  var wos      = Object.values(WO_MAP);

  document.getElementById('rft-meta-info').innerHTML =
    'Meta RFT calculada automaticamente: <strong>' + meta + '%</strong> ' +
    '(media historica + 2% de melhoria). Ajuste manualmente em Configuracoes se necessario.';

  // ── Cards de resumo ─────────────────────────────────────────
  function calcP(fn) {
    var f   = wos.filter(fn);
    var tot = f.length;
    var ok  = f.filter(function(w) { return w.dpu === 0; }).length;
    return tot === 0 ? { rft: null, tot: 0, ok: 0 } : { rft: Math.round(ok / tot * 10000) / 100, tot: tot, ok: ok };
  }

  // Diário = D-1
  var rH = calcP(function(w) { return w.date === diaRef; });
  // Semanal = semana de D-1
  var rS = calcP(function(w) { return weekKey(w.date) === semAtual; });
  // Acumulado = ano de D-1
  var rA = calcP(function(w) { return (w.date || '').startsWith(anoAtual); });

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
    card('Acumulado ' + anoAtual, rA, 'Jan-Dez');

  // ── Período de consulta (exibição discreta abaixo dos cards) ──
  var periodEl = document.getElementById('rft-periodo');
  if (!periodEl) {
    periodEl = document.createElement('div');
    periodEl.id = 'rft-periodo';
    periodEl.style.cssText = 'font-size:10px;color:#9ca3af;text-align:right;margin-top:4px;margin-bottom:14px;';
    document.getElementById('rft-cards').insertAdjacentElement('afterend', periodEl);
  }
  periodEl.innerHTML =
    '&#128337; Periodo de consulta: dados ate <strong>' + fmtD(diaRef) + '</strong> &middot; ' +
    'Consulta realizada em ' + fmtD(hoje);

  // ── Gráfico diário — últimos 30 dias (a partir de D-1) ──────
  var dias = [];
  for (var i = 29; i >= 0; i--) {
    var d = new Date(ontem);
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().split('T')[0]);
  }
  var byDay = {};
  wos.forEach(function(w) {
    if (dias.indexOf(w.date) !== -1) {
      if (!byDay[w.date]) byDay[w.date] = { tot: 0, ok: 0 };
      byDay[w.date].tot++;
      if (w.dpu === 0) byDay[w.date].ok++;
    }
  });
  mkRFTLine(
    'c-rft-d',
    dias.map(function(d) { return d.slice(5); }),
    dias.map(function(d) { var r = byDay[d]; return r && r.tot > 0 ? Math.round(r.ok / r.tot * 10000) / 100 : null; }),
    meta
  );

  // ── Gráfico semanal — ano corrente ──────────────────────────
  var semMap = {};
  wos.forEach(function(w) {
    if (!(w.date || '').startsWith(anoAtual)) return;
    var wk = weekKey(w.date); if (wk === '?') return;
    if (!semMap[wk]) semMap[wk] = { tot: 0, ok: 0 };
    semMap[wk].tot++;
    if (w.dpu === 0) semMap[wk].ok++;
  });
  var semKeys = Object.keys(semMap).sort();
  mkRFTLine(
    'c-rft-s',
    semKeys.map(function(k) { return 'S' + k.slice(5, 7); }),
    semKeys.map(function(k) { var r = semMap[k]; return r.tot > 0 ? Math.round(r.ok / r.tot * 10000) / 100 : null; }),
    meta
  );

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
