/* ============================================================
   parser.js — Leitura de CSV e normalização de dados
   Depende de: config.js
   ============================================================ */

// ── Detecção de separador ─────────────────────────────────────
function detectSep(line) {
  var t = (line.match(/\t/g) || []).length;
  var s = (line.match(/;/g)  || []).length;
  var c = (line.match(/,/g)  || []).length;
  return t >= s && t >= c ? '\t' : s >= c ? ';' : ',';
}

// ── Parse CSV genérico ────────────────────────────────────────
function parseCSV(txt) {
  txt = txt.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '');
  var lines = txt.replace(/\r/g, '').split('\n').filter(function(l) { return l.trim(); });
  if (lines.length < 2) return [];
  var sep  = detectSep(lines[0]);
  var hdrs = lines[0].split(sep).map(function(h) { return h.trim().replace(/^"|"$/g, ''); });
  return lines.slice(1).map(function(line) {
    var vals = line.split(sep).map(function(v) { return v.trim().replace(/^"|"$/g, ''); });
    var o = {};
    hdrs.forEach(function(h, i) { o[h] = vals[i] !== undefined ? vals[i] : ''; });
    return o;
  }).filter(function(r) { return Object.values(r).some(function(v) { return v; }); });
}

// ── Leitura de arquivo (suporta UTF-8 e UTF-16) ───────────────
function readFile(file, cb) {
  var ab = new FileReader();
  ab.onload = function(e) {
    var b   = new Uint8Array(e.target.result.slice(0, 4));
    var enc = (b[0] === 0xFF && b[1] === 0xFE) || (b[0] === 0xFE && b[1] === 0xFF)
              ? 'UTF-16' : 'UTF-8';
    var tr = new FileReader();
    tr.onload = function(e2) { cb(e2.target.result); };
    tr.readAsText(file, enc);
  };
  ab.readAsArrayBuffer(file);
}

// ── Normalização de data ──────────────────────────────────────
// Aceita: YYYY-MM-DD, M/D/YYYY (formato JDE americano)
function normDate(s) {
  if (!s) return '';
  s = s.trim().split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  var p = s.split('/');
  if (p.length === 3 && p[2].length === 4)
    return p[2] + '-' + p[0].padStart(2, '0') + '-' + p[1].padStart(2, '0');
  return s;
}

// ── Normalização de modelo ────────────────────────────────────
// Recebe texto bruto e retorna um dos CANON_MODELS ou ''
function normModelStr(m) {
  if (!m || !m.trim()) return '';
  // Remove sufixos conhecidos: GFCAN, GFC, GF, CAN
  var u = m.trim().toUpperCase().replace(/\s*(GFCAN|GFC|GF|CAN)\b/g, '').trim();
  // Variantes sem espaço: V2MF → V2 MF, V2VT → V2 VT
  u = u.replace(/^V2MF\b/, 'V2 MF').replace(/^V2VT\b/, 'V2 VT');
  for (var i = 0; i < CANON_MODELS.length; i++) {
    var cm = CANON_MODELS[i].toUpperCase();
    if (u === cm || u.indexOf(cm + ' ') === 0 || u.indexOf(cm + '-') === 0)
      return CANON_MODELS[i];
  }
  return ''; // não reconhecido → excluir dos gráficos
}

// ── Normalização de área ──────────────────────────────────────
// Retorna uma das 6 áreas canônicas ou ''
function normAreaStr(a) {
  if (!a || !a.trim()) return '';
  var u = a.trim().toUpperCase();
  if (u.indexOf('LATERAL DIREITA')  !== -1 || u.indexOf('LAT DIR') !== -1) return 'LATERAL DIREITA';
  if (u.indexOf('LATERAL ESQUER')   !== -1 || u.indexOf('LATERAL ESQUR') !== -1 || u.indexOf('LAT ESQ') !== -1) return 'LATERAL ESQUERDA';
  if (u.indexOf('TETO')             !== -1 || u.indexOf('SUPERIOR') !== -1) return 'TETO';
  if (u.indexOf('ASSOALHO')         !== -1 || u.indexOf('PISO')     !== -1) return 'ASSOALHO';
  if (u.indexOf('FRONTAL')          !== -1) return 'FRONTAL';
  if (u.indexOf('TRASEIRA')         !== -1) return 'TRASEIRA';
  return '';
}

// ── Mapeamento área canônica → chave SVG do heatmap ───────────
function normRegion(r) {
  var c = normAreaStr(r);
  if (c === 'TETO')             return 'superior';
  if (c === 'FRONTAL')          return 'frontal';
  if (c === 'LATERAL ESQUERDA') return 'lat-esq';
  if (c === 'LATERAL DIREITA')  return 'lat-dir';
  if (c === 'ASSOALHO')         return 'inferior';
  if (c === 'TRASEIRA')         return 'traseira';
  return null;
}

// ── Parser principal da ANOMALIA_FALHA ────────────────────────
// Estrutura esperada: "GLAZED FRAME [MODELO] [AREA PONTO X]   [TIPO DEFEITO]"
// Estratégia 1: modelo canônico no início do texto
// Estratégia 2: split por keyword de área
// Estratégia 3: texto inteiro como modelo
function parseAnomalia(s) {
  if (!s) return { model: '', area: '', defect: '' };

  // Separa em: parte esquerda (modelo+área) e parte direita (defeito) pelo duplo espaço
  var parts  = s.trim().split(/\s{2,}/);
  var left   = parts[0].trim();
  var defect = parts.length > 1 ? parts.slice(1).join('  ').trim() : '';
  var leftU  = left.toUpperCase();

  // Remove prefixo "GLAZED FRAME "
  if (leftU.indexOf('GLAZED FRAME ') === 0) {
    left  = left.substring(13).trim();
    leftU = left.toUpperCase();
  }

  // Estratégia 1 — modelo canônico no início
  for (var i = 0; i < CANON_MODELS.length; i++) {
    var cm = CANON_MODELS[i].toUpperCase();
    if (leftU === cm || leftU.indexOf(cm + ' ') === 0) {
      var afterModel = left.substring(cm.length).trim();
      var rawArea    = afterModel
        .replace(/\s+PONTO\s+\d+.*/i, '')
        .replace(/\s+\d+(\s|$)/g, '').trim();
      return { model: CANON_MODELS[i], area: normAreaStr(rawArea), defect: defect };
    }
  }

  // Estratégia 2 — encontra keyword de área mais cedo no texto
  var bestIdx = -1;
  for (var j = 0; j < AREA_KW.length; j++) {
    var idx = leftU.indexOf(AREA_KW[j]);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx !== -1) {
    var rawModel = left.substring(0, bestIdx).trim();
    var rawArea2 = left.substring(bestIdx)
      .replace(/\s+PONTO\s+\d+.*/i, '')
      .replace(/\s+\d+(\s|$)/g, '').trim();
    return { model: normModelStr(rawModel), area: normAreaStr(rawArea2), defect: defect };
  }

  // Estratégia 3 — sem área identificada, tudo é modelo
  return { model: normModelStr(left), area: '', defect: defect };
}

// Alias para compatibilidade
function normModel(m) { return normModelStr(m); }
