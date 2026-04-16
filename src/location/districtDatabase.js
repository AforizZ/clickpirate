'use strict';

/**
 * ISTANBUL DISTRICT DATABASE
 *
 * All 39 official Istanbul districts with:
 * - Aliases (common references)
 * - Abbreviations (WhatsApp shorthand)
 * - Misspellings (common errors)
 * - Phonetic variants
 * - Neighboring districts (for radius expansion)
 * - Zone classification (European/Asian side)
 */

const DISTRICTS = {
  // ─── EUROPEAN SIDE ────────────────────────────────────────────────────────

  esenyurt: {
    key: 'esenyurt', display: 'Esenyurt', zone: 'europe',
    aliases: ['esenyurt', 'esen', 'esnyrt', 'esy', 'esenyrt', 'esenirt', 'eseniurt'],
    abbreviations: ['esn', 'esy', 'esyrt'],
    misspellings: ['esnyurt', 'esenyrt', 'eseniurt', 'eseniyurt', 'esenyurtt'],
    phonetic: ['ezenyurt', 'eseniort', 'esenurt'],
    neighbors: ['avcilar', 'beylikduzu', 'kucukcekmece', 'bagcilar'],
    coords: { lat: 41.0291, lon: 28.6725 },
  },
  avcilar: {
    key: 'avcilar', display: 'Avcılar', zone: 'europe',
    aliases: ['avcilar', 'avclr', 'avclar'],
    abbreviations: ['avc', 'avclr'],
    misspellings: ['avclar', 'avcillar', 'afcilar'],
    phonetic: ['afcilar', 'avsilar'],
    neighbors: ['esenyurt', 'kucukcekmece', 'buyukcekmece'],
    coords: { lat: 40.9801, lon: 28.7219 },
  },
  beylikduzu: {
    key: 'beylikduzu', display: 'Beylikdüzü', zone: 'europe',
    aliases: ['beylikduzu', 'beylik', 'beylikdz', 'bykdz'],
    abbreviations: ['bld', 'bykdz', 'beylik'],
    misspellings: ['beylikdz', 'beylikdzu', 'beylikduzu'],
    phonetic: ['beylikdizu', 'beilikduzu'],
    neighbors: ['avcilar', 'esenyurt', 'buyukcekmece'],
    coords: { lat: 41.0017, lon: 28.6451 },
  },
  bakirkoy: {
    key: 'bakirkoy', display: 'Bakırköy', zone: 'europe',
    aliases: ['bakirkoy', 'bakrky', 'bakrkoy'],
    abbreviations: ['bkr', 'bky', 'bakr'],
    misspellings: ['bakiroy', 'bakrkoy', 'bakirkoy'],
    phonetic: ['bakirkoy'],
    neighbors: ['bahcelievler', 'zeytinburnu', 'kucukcekmece', 'gungoren'],
    coords: { lat: 40.9792, lon: 28.8736 },
  },
  bahcelievler: {
    key: 'bahcelievler', display: 'Bahçelievler', zone: 'europe',
    aliases: ['bahcelievler', 'bahce', 'bahceli'],
    abbreviations: ['bhc', 'bahce'],
    misspellings: ['bahcelievlr', 'bahceli', 'bahcelievler'],
    phonetic: ['bahcelievler'],
    neighbors: ['bakirkoy', 'bagcilar', 'gungoren', 'zeytinburnu'],
    coords: { lat: 40.9999, lon: 28.8637 },
  },
  bagcilar: {
    key: 'bagcilar', display: 'Bağcılar', zone: 'europe',
    aliases: ['bagcilar', 'bagclr'],
    abbreviations: ['bgc', 'bag'],
    misspellings: ['bagcilar', 'bagclar', 'bagcilar'],
    phonetic: ['bagsilar', 'bakcilar'],
    neighbors: ['bahcelievler', 'gungoren', 'esenler', 'kucukcekmece', 'esenyurt'],
    coords: { lat: 41.0397, lon: 28.8536 },
  },
  gungoren: {
    key: 'gungoren', display: 'Güngören', zone: 'europe',
    aliases: ['gungoren', 'gungren'],
    abbreviations: ['gng', 'gngr'],
    misspellings: ['gungoren', 'gungren'],
    phonetic: ['gungoren'],
    neighbors: ['bahcelievler', 'bagcilar', 'esenler', 'bakirkoy'],
    coords: { lat: 41.0204, lon: 28.8772 },
  },
  zeytinburnu: {
    key: 'zeytinburnu', display: 'Zeytinburnu', zone: 'europe',
    aliases: ['zeytinburnu', 'zeytinbrn', 'zeytin'],
    abbreviations: ['zytn', 'zbn', 'zeytin'],
    misspellings: ['zeytinburnu', 'zeytinbron', 'zeitinburnu'],
    phonetic: ['zeytinborno'],
    neighbors: ['bakirkoy', 'fatih', 'bayrampasa'],
    coords: { lat: 41.0014, lon: 28.9024 },
  },
  fatih: {
    key: 'fatih', display: 'Fatih', zone: 'europe',
    aliases: ['fatih', 'fth', 'sultanahmet', 'eminonu'],
    abbreviations: ['fth', 'fat'],
    misspellings: ['fatih', 'fatiih', 'fathi'],
    phonetic: ['fatih', 'fatieh'],
    neighbors: ['zeytinburnu', 'eyup', 'beyoglu'],
    coords: { lat: 41.0182, lon: 28.9397 },
  },
  beyoglu: {
    key: 'beyoglu', display: 'Beyoğlu', zone: 'europe',
    aliases: ['beyoglu', 'taksim', 'pera', 'istiklal'],
    abbreviations: ['tks', 'byo'],
    misspellings: ['beyolu', 'byoglu'],
    phonetic: ['beioglu'],
    neighbors: ['fatih', 'besiktas', 'kagithane', 'eyup'],
    coords: { lat: 41.0369, lon: 28.9776 },
  },
  besiktas: {
    key: 'besiktas', display: 'Beşiktaş', zone: 'europe',
    aliases: ['besiktas', 'levent', 'etiler', 'bebek', 'ortakoy'],
    abbreviations: ['bsk', 'bst'],
    misspellings: ['besikas', 'besikts', 'besiktas'],
    phonetic: ['besiktas', 'beshiktas'],
    neighbors: ['beyoglu', 'sisli', 'sariyer', 'kagithane'],
    coords: { lat: 41.0430, lon: 29.0059 },
  },
  sisli: {
    key: 'sisli', display: 'Şişli', zone: 'europe',
    aliases: ['sisli', 'mecidiyekoy', 'maslak', 'nisantasi'],
    abbreviations: ['ssl', 'sis'],
    misspellings: ['sislii', 'siisli'],
    phonetic: ['sisli', 'shishli'],
    neighbors: ['besiktas', 'beyoglu', 'kagithane', 'eyup'],
    coords: { lat: 41.0609, lon: 28.9872 },
  },
  kagithane: {
    key: 'kagithane', display: 'Kağıthane', zone: 'europe',
    aliases: ['kagithane', 'kagthane'],
    abbreviations: ['kgt', 'kgth'],
    misspellings: ['kagithane', 'kagthane'],
    phonetic: ['kagithane'],
    neighbors: ['sisli', 'besiktas', 'sariyer', 'eyup'],
    coords: { lat: 41.0828, lon: 28.9742 },
  },
  sariyer: {
    key: 'sariyer', display: 'Sarıyer', zone: 'europe',
    aliases: ['sariyer', 'istinye', 'tarabya', 'buyukdere'],
    abbreviations: ['sry', 'sar'],
    misspellings: ['sarier', 'saryier'],
    phonetic: ['sariyer'],
    neighbors: ['besiktas', 'kagithane', 'eyup', 'beykoz'],
    coords: { lat: 41.1669, lon: 29.0520 },
  },
  eyup: {
    key: 'eyup', display: 'Eyüpsultan', zone: 'europe',
    aliases: ['eyup', 'eyupsultan'],
    abbreviations: ['eyp'],
    misspellings: ['eyop', 'eyupp'],
    phonetic: ['eyup', 'eiyup'],
    neighbors: ['fatih', 'beyoglu', 'kagithane', 'gaziosmanpasa'],
    coords: { lat: 41.0527, lon: 28.9340 },
  },
  gaziosmanpasa: {
    key: 'gaziosmanpasa', display: 'Gaziosmanpaşa', zone: 'europe',
    aliases: ['gaziosmanpasa', 'gop', 'gazi'],
    abbreviations: ['gop', 'gazi', 'gosp'],
    misspellings: ['gaziosmanpasha', 'gaziomanpasa'],
    phonetic: ['gaziosmanpasha'],
    neighbors: ['eyup', 'sultangazi', 'bagcilar', 'esenler', 'bayrampasa'],
    coords: { lat: 41.0604, lon: 28.9126 },
  },
  sultangazi: {
    key: 'sultangazi', display: 'Sultangazi', zone: 'europe',
    aliases: ['sultangazi', 'sultangazii'],
    abbreviations: ['sltg', 'stg'],
    misspellings: ['sultangazii', 'sultangzai'],
    phonetic: ['sultangazi'],
    neighbors: ['gaziosmanpasa', 'esenler', 'bagcilar'],
    coords: { lat: 41.1039, lon: 28.9142 },
  },
  esenler: {
    key: 'esenler', display: 'Esenler', zone: 'europe',
    aliases: ['esenler', 'esenlr'],
    abbreviations: ['esnl', 'esl'],
    misspellings: ['esenlerr', 'esenlr'],
    phonetic: ['esenler'],
    neighbors: ['bagcilar', 'gungoren', 'gaziosmanpasa', 'sultangazi'],
    coords: { lat: 41.0436, lon: 28.8813 },
  },
  bayrampasa: {
    key: 'bayrampasa', display: 'Bayrampaşa', zone: 'europe',
    aliases: ['bayrampasa', 'bayrmpas'],
    abbreviations: ['brp', 'brmps'],
    misspellings: ['bayrampaas', 'bayramapsa'],
    phonetic: ['bayrampasa'],
    neighbors: ['eyup', 'fatih', 'zeytinburnu', 'gaziosmanpasa'],
    coords: { lat: 41.0439, lon: 28.9227 },
  },
  kucukcekmece: {
    key: 'kucukcekmece', display: 'Küçükçekmece', zone: 'europe',
    aliases: ['kucukcekmece', 'kck', 'kkc', 'kucuk'],
    abbreviations: ['kck', 'kkc', 'kucuk'],
    misspellings: ['kucukcekceme', 'kucukcekmce'],
    phonetic: ['kucukcekmece', 'kuchukcekmece'],
    neighbors: ['avcilar', 'esenyurt', 'bagcilar', 'bahcelievler', 'buyukcekmece'],
    coords: { lat: 40.9987, lon: 28.7756 },
  },
  buyukcekmece: {
    key: 'buyukcekmece', display: 'Büyükçekmece', zone: 'europe',
    aliases: ['buyukcekmece', 'byk', 'buyuk'],
    abbreviations: ['bkc', 'byc'],
    misspellings: ['buyukcekmce', 'buyukcekmece'],
    phonetic: ['buyukcekmece'],
    neighbors: ['avcilar', 'beylikduzu', 'silivri'],
    coords: { lat: 41.0217, lon: 28.5825 },
  },
  silivri: {
    key: 'silivri', display: 'Silivri', zone: 'europe',
    aliases: ['silivri', 'slivri', 'silvri'],
    abbreviations: ['slv', 'slvr'],
    misspellings: ['slivri', 'silvri', 'silivrii'],
    phonetic: ['silivri'],
    neighbors: ['buyukcekmece', 'catalca'],
    coords: { lat: 41.0732, lon: 28.2463 },
  },
  catalca: {
    key: 'catalca', display: 'Çatalca', zone: 'europe',
    aliases: ['catalca', 'catalkca'],
    abbreviations: ['ctlc', 'ctl'],
    misspellings: ['catalca', 'catlca'],
    phonetic: ['catalca'],
    neighbors: ['silivri', 'arnavutkoy'],
    coords: { lat: 41.1432, lon: 28.4616 },
  },
  arnavutkoy: {
    key: 'arnavutkoy', display: 'Arnavutköy', zone: 'europe',
    aliases: ['arnavutkoy', 'arnavut'],
    abbreviations: ['arv', 'arvk'],
    misspellings: ['arnavutkoy', 'arnavutkoi'],
    phonetic: ['arnavutkoy'],
    neighbors: ['catalca', 'sultangazi', 'eyup'],
    coords: { lat: 41.1826, lon: 28.7398 },
  },

  // ─── ASIAN SIDE ───────────────────────────────────────────────────────────

  kadikoy: {
    key: 'kadikoy', display: 'Kadıköy', zone: 'asia',
    aliases: ['kadikoy', 'moda', 'bostanci', 'fenerbahce'],
    abbreviations: ['kdk', 'kky'],
    misspellings: ['kadiky', 'kadioy', 'kadikgy'],
    phonetic: ['kadikoy', 'kadikoi'],
    neighbors: ['uskudar', 'atasehir', 'maltepe'],
    coords: { lat: 40.9923, lon: 29.0289 },
  },
  uskudar: {
    key: 'uskudar', display: 'Üsküdar', zone: 'asia',
    aliases: ['uskudar', 'uskdar', 'uskadar'],
    abbreviations: ['usk', 'ukd'],
    misspellings: ['uskdar', 'uskadar', 'uskuadr'],
    phonetic: ['uskudar', 'ushkudar'],
    neighbors: ['kadikoy', 'beykoz', 'atasehir', 'umraniye'],
    coords: { lat: 41.0234, lon: 29.0152 },
  },
  beykoz: {
    key: 'beykoz', display: 'Beykoz', zone: 'asia',
    aliases: ['beykoz', 'bykz', 'beykz'],
    abbreviations: ['bkz', 'byz'],
    misspellings: ['bykoz', 'beycoz', 'beyykoz'],
    phonetic: ['beykoz'],
    neighbors: ['uskudar', 'sariyer', 'cekmekoy'],
    coords: { lat: 41.1252, lon: 29.1076 },
  },
  atasehir: {
    key: 'atasehir', display: 'Ataşehir', zone: 'asia',
    aliases: ['atasehir', 'atashir', 'ata'],
    abbreviations: ['ats'],
    misspellings: ['atasehirr', 'atashir'],
    phonetic: ['atasehir'],
    neighbors: ['kadikoy', 'umraniye', 'maltepe', 'sancaktepe'],
    coords: { lat: 40.9920, lon: 29.1252 },
  },
  umraniye: {
    key: 'umraniye', display: 'Ümraniye', zone: 'asia',
    aliases: ['umraniye', 'umrn'],
    abbreviations: ['umr', 'umrn'],
    misspellings: ['umraniye', 'omraniye'],
    phonetic: ['umraniye'],
    neighbors: ['uskudar', 'atasehir', 'cekmekoy', 'sancaktepe'],
    coords: { lat: 41.0176, lon: 29.1253 },
  },
  maltepe: {
    key: 'maltepe', display: 'Maltepe', zone: 'asia',
    aliases: ['maltepe', 'maltp', 'mltp'],
    abbreviations: ['mlt', 'mltp'],
    misspellings: ['maltepe', 'maltpe'],
    phonetic: ['maltepe'],
    neighbors: ['kadikoy', 'atasehir', 'kartal'],
    coords: { lat: 40.9354, lon: 29.1307 },
  },
  kartal: {
    key: 'kartal', display: 'Kartal', zone: 'asia',
    aliases: ['kartal', 'krtl'],
    abbreviations: ['krt', 'krtl'],
    misspellings: ['kartall', 'kartal'],
    phonetic: ['kartal'],
    neighbors: ['maltepe', 'pendik', 'sultanbeyli'],
    coords: { lat: 40.8990, lon: 29.1888 },
  },
  pendik: {
    key: 'pendik', display: 'Pendik', zone: 'asia',
    aliases: ['pendik', 'pndik'],
    abbreviations: ['pnd', 'pndk'],
    misspellings: ['pendik', 'pndik', 'pendikk'],
    phonetic: ['pendik'],
    neighbors: ['kartal', 'tuzla', 'sancaktepe', 'sultanbeyli'],
    coords: { lat: 40.8716, lon: 29.2319 },
  },
  tuzla: {
    key: 'tuzla', display: 'Tuzla', zone: 'asia',
    aliases: ['tuzla', 'tzla'],
    abbreviations: ['tzl', 'tzla'],
    misspellings: ['tuzlaa', 'tzla'],
    phonetic: ['tuzla'],
    neighbors: ['pendik', 'cekmekoy'],
    coords: { lat: 40.8131, lon: 29.3004 },
  },
  sancaktepe: {
    key: 'sancaktepe', display: 'Sancaktepe', zone: 'asia',
    aliases: ['sancaktepe', 'sancak', 'sncktp'],
    abbreviations: ['snck', 'snckt'],
    misspellings: ['sancaktepe', 'sancaktpe'],
    phonetic: ['sancaktepe'],
    neighbors: ['umraniye', 'atasehir', 'pendik', 'sultanbeyli'],
    coords: { lat: 40.9798, lon: 29.2238 },
  },
  sultanbeyli: {
    key: 'sultanbeyli', display: 'Sultanbeyli', zone: 'asia',
    aliases: ['sultanbeyli', 'stbl'],
    abbreviations: ['stbl', 'sltb'],
    misspellings: ['sultanbeily', 'sultanbeyii'],
    phonetic: ['sultanbeyli'],
    neighbors: ['sancaktepe', 'kartal', 'pendik'],
    coords: { lat: 40.9580, lon: 29.2740 },
  },
  cekmekoy: {
    key: 'cekmekoy', display: 'Çekmeköy', zone: 'asia',
    aliases: ['cekmekoy', 'ckmky'],
    abbreviations: ['ckm', 'ckmk'],
    misspellings: ['cekmekoy', 'cekmekoi'],
    phonetic: ['cekmekoy'],
    neighbors: ['umraniye', 'beykoz', 'sancaktepe'],
    coords: { lat: 41.0534, lon: 29.1811 },
  },

  // ─── AIRPORTS ─────────────────────────────────────────────────────────────

  havalimani: {
    key: 'havalimani', display: 'İstanbul Havalimanı', zone: 'europe',
    aliases: ['havalimani', 'istanbul havalimani', 'ist havalimani',
              'yeni havalimani', '3. havalimani', 'ucuncu', 'ist airport',
              'havaliman', 'havliman'],
    abbreviations: ['hav', 'hvl', 'ist'],
    misspellings: ['havalimani', 'havaliamni', 'havaliman', 'havliman'],
    phonetic: ['havalimani'],
    neighbors: ['arnavutkoy', 'catalca'],
    coords: { lat: 41.2753, lon: 28.7519 },
  },
  sabiha: {
    key: 'sabiha', display: 'Sabiha Gökçen Havalimanı', zone: 'asia',
    aliases: ['sabiha', 'sabiha gokcen', 'saw', 'anadolu havalimani',
              'sabha', 'sabiha hav', 'gokcen'],
    abbreviations: ['sgh', 'saw', 'sgb'],
    misspellings: ['sabha', 'sabiha gokcen'],
    phonetic: ['sabiha'],
    neighbors: ['pendik', 'tuzla', 'kartal'],
    coords: { lat: 40.8983, lon: 29.3092 },
  },
};

// ─── Index structures for fast lookup ─────────────────────────────────────────

/**
 * Builds a flat lookup map: any alias/abbreviation/misspelling → districtKey
 */
function buildAliasIndex() {
  const index = new Map();

  for (const [key, district] of Object.entries(DISTRICTS)) {
    const allVariants = [
      key,
      ...district.aliases,
      ...district.abbreviations,
      ...district.misspellings,
      ...district.phonetic,
    ];

    for (const variant of allVariants) {
      const normalized = variant.toLowerCase().trim();
      if (!index.has(normalized)) {
        index.set(normalized, key);
      }
    }
  }

  return index;
}

const ALIAS_INDEX = buildAliasIndex();

function getAllKeys() {
  return Object.keys(DISTRICTS);
}

function getDistrict(key) {
  return DISTRICTS[key] || null;
}

function lookupByAlias(query) {
  const normalized = query.toLowerCase().trim();
  const key = ALIAS_INDEX.get(normalized);
  if (key) return { key, district: DISTRICTS[key] };
  return null;
}

/**
 * Returns neighboring districts for radius expansion.
 * @param {string} districtKey
 * @param {number} [depth=1]
 * @returns {string[]}
 */
function getNeighbors(districtKey, depth = 1) {
  const district = DISTRICTS[districtKey];
  if (!district) return [];

  if (depth === 1) return district.neighbors || [];

  // BFS for deeper radius
  const visited = new Set([districtKey]);
  const queue = [...(district.neighbors || [])];
  const result = [];

  let currentDepth = 1;
  let levelSize = queue.length;

  while (queue.length > 0 && currentDepth <= depth && result.length < 20) {
    const current = queue.shift();
    levelSize--;

    if (visited.has(current)) {
      if (levelSize === 0 && queue.length > 0) {
        currentDepth++;
        levelSize = queue.length;
      }
      continue;
    }

    visited.add(current);
    result.push(current);

    const d = DISTRICTS[current];
    if (d && currentDepth < depth) {
      queue.push(...(d.neighbors || []).filter((n) => !visited.has(n)));
    }

    if (levelSize === 0 && queue.length > 0) {
      currentDepth++;
      levelSize = queue.length;
    }
  }

  return result;
}

module.exports = {
  DISTRICTS,
  ALIAS_INDEX,
  getAllKeys,
  getDistrict,
  lookupByAlias,
  getNeighbors,
};
