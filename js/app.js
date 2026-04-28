/* ============================================================
   app.js — Navegação, Documentos e Memória
   Depende de: config.js, dashboard.js, rft.js, criticos.js
   ============================================================ */

// ── Navegação entre páginas ───────────────────────────────────
function nav(id, el) {
  document.querySelectorAll('.pg').forEach(function(p) { p.classList.remove('on'); });
  document.querySelectorAll('.ni').forEach(function(n) { n.classList.remove('on'); });
  document.getElementById('pg-' + id).classList.add('on');
  el.classList.add('on');

  if (id === 'dash' && DEF.length) renderDash();
  if (id === 'rft')                renderRFT();
  if (id === 'crit' && DEF.length) renderCrit();
  if (id === 'docs')               renderDocs();
  if (id === 'mem')                renderMem();
}

// ── Renderizar A3/8D gerados ──────────────────────────────────
function renderDocs() {
  var el = document.getElementById('docs-view');
  if (!DOCS.length) {
    el.innerHTML = '<div class="al al-i">Nenhum documento gerado. Va em Criticos e clique em "Gerar A3/8D".</div>';
    return;
  }
  el.innerHTML = DOCS.map(function(d, i) {
    var scoreHtml = d.score
      ? '<span class="badge" style="background:' + (d.score.color||'#6b7280') + '20;color:' + (d.score.color||'#6b7280') + '">' + d.score.emoji + ' ' + d.score.label + ' ' + d.score.score + '</span>'
      : '';
    return '<div class="dc">' +
      '<div class="dc-hd">' +
        '<span class="badge ' + (d.tdoc === '8D' ? 'b-rd' : 'b-bl') + '">' + d.tdoc + '</span>' +
        scoreHtml +
        '<span style="font-size:13px;font-weight:700">' + d.defeito.tipo + '</span>' +
        '<span class="badge b-gy">' + d.defeito.modelo + '</span>' +
        '<span style="font-size:10px;color:#6b7280;margin-left:auto">' + d.data + '</span>' +
        (d.status === 'aberto'
          ? '<button class="btn btnsm btnok" onclick="resolverDoc(' + i + ')">Resolvido</button>'
          : '<span class="badge b-gr">Resolvido</span>') +
      '</div>' +
      '<div class="dc-body">' + d.texto + '</div>' +
    '</div>';
  }).join('<div class="divider"></div>');
}

// ── Marcar documento como resolvido ──────────────────────────
function resolverDoc(idx) {
  var doc = DOCS[idx];
  var ac  = prompt('Acao corretiva aplicada:') || 'Resolvido';
  doc.status = 'resolvido';
  MEM.unshift({
    tipo: doc.defeito.tipo, local: doc.defeito.local, modelo: doc.defeito.modelo,
    acao: ac, data: new Date().toLocaleDateString('pt-BR'), status: 'fechado', tdoc: doc.tdoc
  });
  try {
    localStorage.setItem('aq_mem',  JSON.stringify(MEM));
    localStorage.setItem('aq_docs', JSON.stringify(DOCS.slice(0, 50)));
  } catch(e) {}
  renderDocs();
}

// ── Renderizar memória ────────────────────────────────────────
function renderMem() {
  var el = document.getElementById('mem-list');
  if (!MEM.length) {
    el.innerHTML = '<div class="al al-i">Memoria vazia. Ao resolver um A3/8D, os problemas ficam registrados aqui e evitam duplicatas.</div>';
    return;
  }
  el.innerHTML = MEM.map(function(m, i) {
    var bc = m.status === 'fechado' ? 'b-gr' : m.status === 'em tratamento' ? 'b-am' : 'b-bl';
    return '<div class="mc2">' +
      '<span class="badge ' + bc + '">' + m.status + '</span>' +
      '<div class="mc2-body">' +
        '<div class="mc2-t">' + m.tipo + ' - ' + m.local + ' (' + m.modelo + ')</div>' +
        '<div class="mc2-s">' + (m.acao || 'Sem descricao') + ' &middot; ' + m.data + '</div>' +
      '</div>' +
      '<button class="btn btnsm btnd" onclick="delMem(' + i + ')">Remover</button>' +
    '</div>';
  }).join('');
}

// ── Remover item da memória ───────────────────────────────────
function delMem(i) {
  if (confirm('Remover da memoria?')) {
    MEM.splice(i, 1);
    try { localStorage.setItem('aq_mem', JSON.stringify(MEM)); } catch(e) {}
    renderMem();
  }
}
