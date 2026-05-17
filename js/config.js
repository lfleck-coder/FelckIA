/* ============================================================
   config.js — Estado global, constantes e inicialização
   ============================================================ */

// ── Dados brutos ──────────────────────────────────────────────
var DEF  = [];   // registros de defeito QG09 (CSV de defeitos)
var PROD = [];   // registros de produção QG09 (Lista de Máquinas)
var WO_MAP = {}; // { NR_WO: { dpu, model, date } }
var MEM  = [];   // memória de problemas tratados
var DOCS = [];   // A3/8D gerados
var CH   = {};   // instâncias Chart.js ativas

// ── Configuração do usuário ───────────────────────────────────
var CFG = {
  thr:      3,    // threshold de criticidade (ocorrências/semana)
  ctx:      '',   // contexto do processo
  reg:      '',   // regiões críticas
  persona:  '',   // persona do especialista
  rftMeta:  null  // meta RFT manual (null = automático)
};

// ── Seleção de modelo no dashboard ───────────────────────────
var SEL = 'all';

// ── Seleções independentes por gráfico ───────────────────────
var SEL_PARETO = 'all';
var SEL_HM     = 'all';

// ── Meta RFT calculada automaticamente ───────────────────────
var RFT_TARGET = 95;

// ── Modelos canônicos aceitos ─────────────────────────────────
var CANON_MODELS = ['VTBA', 'V2 MF', 'V2 VT', 'G8', 'G7'];

// ── Keywords de área para split da ANOMALIA_FALHA ─────────────
var AREA_KW = [
  'LATERAL ESQUERDA', 'LATERAL ESQURDA', 'LATERAL DIREITA',
  'LAT ESQ', 'LAT DIR',
  'PISO FRONTAL', 'PISO TRAS', 'PISO',
  'ASSOALHO', 'FRONTAL SUPERIOR', 'FRONTAL',
  'SUPERIOR TETO', 'SUPERIOR', 'TETO',
  'TRASEIRA', 'INFERIOR', 'COLUNA', 'PAREDE'
];

// ── Inicialização — carrega dados do localStorage ─────────────
window.addEventListener('DOMContentLoaded', function() {
  try {
    var m = localStorage.getItem('aq_mem');
    if (m) MEM = JSON.parse(m);

    var d = localStorage.getItem('aq_docs');
    if (d) DOCS = JSON.parse(d);

    var cf = localStorage.getItem('aq_cfg');
    if (cf) {
      var parsed = JSON.parse(cf);
      CFG = Object.assign(CFG, parsed);
      if (parsed.thr)     document.getElementById('cfg-thr').value     = parsed.thr;
      if (parsed.ctx)     document.getElementById('cfg-ctx').value     = parsed.ctx;
      if (parsed.reg)     document.getElementById('cfg-reg').value     = parsed.reg;
      if (parsed.persona) document.getElementById('cfg-persona').value = parsed.persona;
      if (parsed.rftMeta) document.getElementById('cfg-rft-meta').value = parsed.rftMeta;
    }

    var k = localStorage.getItem('aq_key');
    if (k) document.getElementById('apikey').value = k;

    var wm = localStorage.getItem('aq_wo_map');
    if (wm) WO_MAP = JSON.parse(wm);

  } catch(e) { console.warn('Config init error:', e); }
});

function saveKey() {
  var k = document.getElementById('apikey').value.trim();
  if (k) { localStorage.setItem('aq_key', k); alert('Chave salva!'); }
}

function getKey() {
  return document.getElementById('apikey').value.trim()
      || localStorage.getItem('aq_key')
      || '';
}

function saveCfg() {
  CFG.thr     = parseInt(document.getElementById('cfg-thr').value);
  CFG.ctx     = document.getElementById('cfg-ctx').value;
  CFG.reg     = document.getElementById('cfg-reg').value;
  CFG.persona = document.getElementById('cfg-persona').value;
  CFG.rftMeta = parseFloat(document.getElementById('cfg-rft-meta').value) || null;
  try { localStorage.setItem('aq_cfg', JSON.stringify(CFG)); } catch(e) {}
  alert('Configuracoes salvas!');
}
