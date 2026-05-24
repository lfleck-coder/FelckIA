/* ============================================================
   criticos.js — Defeitos críticos, Score de Prioridade e A3/8D
   Depende de: config.js, utils.js
   ============================================================ */

// ── Fator de confiança por quantidade de ocorrências ─────────
function confidenceFactor(count) {
  if (count >= 5) return 1.00;
  if (count === 4) return 0.87;
  if (count === 3) return 0.75;
  if (count === 2) return 0.60;
  return 0.40;
}

// ── Tendência: média 3 sem. recentes vs 3 sem. anteriores ────
function calcTendencia(tipo, local, modelo) {
  var hoje = new Date();

  function semCount(weeksAgo) {
    var d = new Date(hoje);
    d.setDate(d.getDate() - (weeksAgo * 7));
    var wk = weekKey(d.toISOString().split('T')[0]);
    return DEF.filter(function(r) {
      return r._defect === tipo && r._region === local && r._model === modelo
          && weekKey(r._date) === wk;
    }).length;
  }

  // Semanas recentes: 0, 1, 2 atrás
  var recent = (semCount(0) + semCount(1) + semCount(2)) / 3;
  // Semanas anteriores: 3, 4, 5 atrás
  var older  = (semCount(3) + semCount(4) + semCount(5)) / 3;

  if (older === 0) return recent > 0 ? 1 : 0; // sem histórico anterior
  return (recent - older) / older; // positivo = subindo, negativo = caindo
}

// ── Impacto RFT: % WOs deste defeito reprovadas ───────────────
function calcRFTImpact(wosSet) {
  if (!Object.keys(WO_MAP).length) return 0;
  var total = 0, reprovadas = 0;
  wosSet.forEach(function(wo) {
    if (WO_MAP[wo]) {
      total++;
      if (WO_MAP[wo].dpu > 0) reprovadas++;
    }
  });
  return total > 0 ? reprovadas / total : 0;
}

// ── Região crítica: verifica config ──────────────────────────
function isRegiaoClitica(local) {
  var regsConfig = (document.getElementById('cfg-reg').value || '').toUpperCase();
  if (!regsConfig || !local) return false;
  return regsConfig.indexOf(local.toUpperCase()) !== -1;
}

// ── Cálculo principal do score ────────────────────────────────
function calcScore(c, maxCount) {
  // Frequência (25pts)
  var freqScore = maxCount > 0 ? (c.count / maxCount) * 25 : 0;

  // Tendência (20pts)
  var trend = calcTendencia(c.tipo, c.local, c.modelo);
  // trend: >0.5 = subindo muito, 0 = estável, <0 = caindo
  var trendScore = trend > 0
    ? Math.min(20, trend * 20)      // sobe até 20
    : Math.max(0, 10 + trend * 10); // cai até 0, estável = 10

  // Região crítica (15pts)
  var regScore = isRegiaoClitica(c.local) ? 15 : 0;

  // Impacto RFT (40pts)
  var rftImpact = calcRFTImpact(c.wos);
  var rftScore  = rftImpact * 40;

  // Score bruto
  var raw = freqScore + trendScore + regScore + rftScore;

  // Fator de confiança
  var score = Math.round(raw * confidenceFactor(c.count));

  // Classificação
  var label, color, emoji;
  if      (score >= 75) { label = 'Critico'; color = '#dc2626'; emoji = '🔴'; }
  else if (score >= 50) { label = 'Alto';    color = '#d97706'; emoji = '🟠'; }
  else if (score >= 25) { label = 'Medio';   color = '#ca8a04'; emoji = '🟡'; }
  else                  { label = 'Baixo';   color = '#16a34a'; emoji = '🟢'; }

  return {
    score:     score,
    label:     label,
    color:     color,
    emoji:     emoji,
    trend:     trend,
    rftImpact: rftImpact,
    regCrit:   regScore > 0
  };
}

// ── Ícone de tendência ────────────────────────────────────────
function trendIcon(trend) {
  if (trend >  0.2) return '<span style="color:#dc2626">&#8679; Subindo</span>';
  if (trend < -0.2) return '<span style="color:#16a34a">&#8681; Caindo</span>';
  return '<span style="color:#6b7280">&#8644; Estavel</span>';
}

// ── Identificar críticos da semana atual ──────────────────────
function getCrits() {
  if (!DEF.length) return [];
  var hoje = weekKey(new Date().toISOString());
  var m    = {};

  DEF.forEach(function(r) {
    if (weekKey(r._date) !== hoje) return;
    var def = r._defect || r._anomalia || '';
    var reg = r._region || '';
    var mod = r._model  || '--';
    var k   = def + '|' + reg + '|' + mod;
    if (!m[k]) m[k] = { tipo: def, local: reg, modelo: mod, count: 0, wos: new Set() };
    m[k].count++;
    if (r['NR_WO']) m[k].wos.add(r['NR_WO']);
  });

  var crits = Object.values(m).filter(function(c) { return c.count >= CFG.thr; });

  // Calcula score para todos
  var maxCount = crits.length ? Math.max.apply(null, crits.map(function(c) { return c.count; })) : 1;
  crits.forEach(function(c) { c._score = calcScore(c, maxCount); });

  // Ordena por score desc
  return crits.sort(function(a, b) { return b._score.score - a._score.score; });
}

// ── Verifica memória ──────────────────────────────────────────
function inMem(it) {
  return MEM.some(function(m) {
    return m.tipo === it.tipo && m.local === it.local && m.modelo === it.modelo && m.status !== 'fechado';
  });
}

// ── Renderiza lista de críticos ───────────────────────────────
function renderCrit() {
  var crits = getCrits();
  document.getElementById('crit-sub').textContent = 'Threshold: ' + CFG.thr + '+ por semana - QG09 - Ordenado por score de prioridade';

  if (!DEF.length) {
    document.getElementById('crit-al').innerHTML   = '<div class="al al-i">Importe dados primeiro.</div>';
    document.getElementById('crit-list').innerHTML = '';
    return;
  }
  if (!crits.length) {
    document.getElementById('crit-al').innerHTML   = '<div class="al al-ok">Nenhum defeito atingiu o threshold esta semana.</div>';
    document.getElementById('crit-list').innerHTML = '';
    return;
  }

  document.getElementById('crit-al').innerHTML =
    '<div class="al al-w"><strong>' + crits.length + '</strong> defeito(s) critico(s) esta semana &middot; Ordenados por score de prioridade</div>';

  window._crits = crits;

  document.getElementById('crit-list').innerHTML = crits.map(function(c, i) {
    var s  = c._score;
    var im = inMem(c);
    var rftTxt = Object.keys(WO_MAP).length
      ? Math.round(s.rftImpact * 100) + '% WOs reprovadas'
      : 'Lista de Maquinas nao carregada';

    return '<div class="cc" style="border-left:4px solid ' + s.color + '">' +

      // Score badge
      '<div style="min-width:72px;text-align:center">' +
        '<div style="font-size:22px;font-weight:800;color:' + s.color + '">' + s.score + '</div>' +
        '<div style="font-size:10px;font-weight:700;color:' + s.color + ';margin-bottom:4px">' + s.emoji + ' ' + s.label + '</div>' +
        '<div style="font-size:10px;color:#9ca3af">' + c.count + 'x</div>' +
        '<div style="font-size:10px;color:#9ca3af">' + c.wos.size + ' WOs</div>' +
      '</div>' +

      // Detalhes
      '<div class="cc-body">' +
        '<div class="cc-t">' + c.tipo + '</div>' +
        '<div class="cc-m">Regiao: ' + (c.local || '--') + (s.regCrit ? ' <span style="color:#d97706;font-size:10px">&#9888; Critica</span>' : '') + ' &middot; Modelo: <strong>' + c.modelo + '</strong></div>' +

        // Score breakdown
        '<div style="display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap">' +
          '<span style="font-size:10px;color:#6b7280">Tendencia: ' + trendIcon(s.trend) + '</span>' +
          '<span style="font-size:10px;color:#6b7280">RFT: ' + rftTxt + '</span>' +
        '</div>' +

        '<div class="cc-acts">' +
          (im
            ? '<span class="badge b-am">Ja tratado - ver memoria</span>'
            : '<button class="btn btnp btnsm" id="gb' + i + '" onclick="gerarDoc(' + i + ')">Gerar A3/8D</button>' +
              '<button class="btn btnsm btnd" onclick="addMem(' + i + ')">Registrar</button>') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── Adicionar à memória ───────────────────────────────────────
function addMem(idx) {
  var c = window._crits[idx];
  if (inMem(c)) return;
  var ac = prompt('Acao tomada (opcional):') || '';
  MEM.unshift({ tipo: c.tipo, local: c.local, modelo: c.modelo, acao: ac, data: new Date().toLocaleDateString('pt-BR'), status: 'em tratamento' });
  try { localStorage.setItem('aq_mem', JSON.stringify(MEM)); } catch(e) {}
  renderCrit();
}

// ── Gerar A3/8D via API Anthropic ────────────────────────────
async function gerarDoc(idx) {
  var key = getKey();
  if (!key) { alert('Insira a chave de API Anthropic.'); return; }

  var c   = window._crits[idx];
  var s   = c._score;
  var btn = document.getElementById('gb' + idx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Gerando...'; }

  var ctx     = document.getElementById('cfg-ctx').value;
  var reg     = document.getElementById('cfg-reg').value;
  var persona = document.getElementById('cfg-persona').value;

  var trendDesc = s.trend > 0.2 ? 'SUBINDO (' + Math.round(s.trend*100) + '% vs semanas anteriores)'
                : s.trend < -0.2 ? 'CAINDO (' + Math.round(Math.abs(s.trend)*100) + '% vs semanas anteriores)'
                : 'ESTAVEL';

  var prompt =
    'Voce e: ' + persona + '\n\n' +
    'CONTEXTO: Manufatura de tratores agricolas. Posto QG09 - Glazed Frame (solda MIG/MAG de frames de cabine).\n\n' +
    'SCORE DE PRIORIDADE: ' + s.score + '/100 - Classificacao: ' + s.label + '\n' +
    'Breakdown: Frequencia alta, Tendencia ' + trendDesc + ', ' +
    (s.regCrit ? 'REGIAO ESTRUTURALMENTE CRITICA, ' : '') +
    'Impacto RFT: ' + Math.round(s.rftImpact*100) + '% das WOs reprovadas.\n\n' +
    'DEFEITO:\n' +
    '- Tipo: ' + c.tipo + '\n' +
    '- Regiao: ' + (c.local || 'nao identificada') + '\n' +
    '- Familia: ' + c.modelo + '\n' +
    '- Frequencia: ' + c.count + 'x esta semana / ' + c.wos.size + ' WOs impactadas\n\n' +
    'CONTEXTO DO PROCESSO:\n' + (ctx || 'Nao informado.') + '\n\n' +
    'REGIOES CRITICAS:\n' + (reg || 'Nao informadas.') + '\n\n' +
    'HISTORICO TRATADO:\n' +
    (MEM.length ? MEM.map(function(m) { return '- ' + m.tipo + ' / ' + m.local + ' (' + m.modelo + '): ' + (m.acao || 'sem acao'); }).join('\n') : 'Nenhum.') + '\n\n' +
    'REGRA: A3 para problemas focados. 8D para complexos, recorrentes ou com score >= 75 ou regiao critica.\n\n' +
    'Para A3: 1-Contexto, 2-Situacao Atual, 3-Meta, 4-Causa Raiz Ishikawa (min 3 causas MIG/MAG), 5-Contramedidas, 6-Plano de Acao (Acao|Responsavel|Prazo), 7-Verificacao, 8-Follow-up.\n' +
    'Para 8D: D1 a D8 completos. Seja tecnico e especifico.\n\n' +
    'Finalize com: DECISAO: [A3 ou 8D] - [justificativa em 1 frase]';

  try {
    var res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    var data = await res.json();
    if (data.error) {
      alert('Erro API: ' + data.error.message);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Gerar A3/8D'; }
      return;
    }

    var text = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content
      : 'Erro ao obter resposta.';
    var dm   = text.match(/DECIS[AO]+:\s*(A3|8D)/i);
    DOCS.unshift({
      id: Date.now(), tdoc: dm ? dm[1] : 'A3',
      defeito: c, score: s, texto: text,
      data: new Date().toLocaleDateString('pt-BR'), status: 'aberto'
    });
    try { localStorage.setItem('aq_docs', JSON.stringify(DOCS.slice(0, 50))); } catch(e) {}
    nav('docs', document.querySelectorAll('.ni')[4]);

  } catch(err) {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Gerar A3/8D'; }
    alert('Erro: ' + err.message);
  }
}
