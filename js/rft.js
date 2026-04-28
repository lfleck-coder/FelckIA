/* ============================================================
   rft.js — Cálculo e renderização do RFT
   Depende de: config.js, utils.js
   ============================================================ */

function renderRFT() {
  if (!Object.keys(WO_MAP).length) return;

  var meta     = RFT_TARGET || 95;
  var hoje     = new Date().toISOString().split('T')[0];
  var anoAtual = hoje.substring(0, 4);
  var semAtual = weekKey(hoje);
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

  var rH = calcP(function(w) { return w.date === hoje; });
  var rS = calcP(function(w) { return weekKey(w.date) === semAtual; });
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
    card('RFT Diario', rH, fmtD(hoje)) +
    card('RFT Semanal', rS, 'Sem. ' + fmtD(semAtual)) +
    card('Acumulado ' + anoAtual, rA, 'Jan-Dez');

  // ── Gráfico diário — últimos 30 dias ────────────────────────
  var dias = [];
  for (var i = 29; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
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

  // ── RFT por modelo ───────────────────────────────────────────
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
