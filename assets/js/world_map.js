
const WORLD_VERSION_FALLBACK = 'ver.0.0.98(260420-시작별속도광량개별점멸)';

const MAP_SIZE = 200;

const HEX_CONFIG = {
  cols: MAP_SIZE,
  rows: MAP_SIZE,
  z: 0,
  size: 4,
  seaLevelRatio: 0.58,
  elevationScale: 1,
  deepSeaOffset: 0.12,
  coastBand: 0.02,
  mountainLevel: 0.78,
  elevationFrequency: 0.0158,
  moistureFrequency: 0.0162,
  heatFrequency: 0.0105,
  warpFrequency: 0.0068,
  warpStrength: 18,
  ridgeFrequency: 0.0092,
  ridgeDetailFrequency: 0.023,
  ridgeStrength: 0.24,
  riverBudgetScale: 1,
  biomePatchFrequency: 0.054,
  biomePatchStrength: 0.12,
  terrains: {
    심해: '#203b78',
    바다: '#2e5ca6',
    산호해안: '#0ea5e9',
    얕은해안: '#38bdf8',
    해안: '#4a90d9',
    모래해변: '#d4c08f',
    호수: '#3f76ca',
    강: '#4f8fd8',
    사바나평원: '#65a30d',
    푸른평원: '#4ade80',
    울창한숲: '#15803d',
    침엽수림: '#0f766e',
    고대숲: '#064e3b',
    열대우림: '#065f46',
    맹그로브습지: '#166534',
    구릉지: '#90a86f',
    운무고원림: '#3f7c65',
    이끼고원숲: '#5b8f72',
    한랭고원: '#7f9c96',
    붉은고원: '#a8783a',
    붉은대협곡: '#9a3412',
    험준한산맥: '#52525b',
    바위산맥: '#6b7280',
    고산운무림: '#2f855a',
    빙하설산: '#dbeafe',
    화산지대: '#9c4b3a',
    만년설산: '#e6eef8',
    늪지대: '#4d7c0f',
    빙원: '#a1a1aa',
    건조사막: '#fde047',
    사막오아시스: '#34d399',
    세계수: '#10b981',
    용의둥지: '#9f1239',
    수정동굴: '#6d28d9',
    고대성소: '#94a3b8'
  }
};

const canvas = document.getElementById('worldMapCanvas');
const ctx = canvas.getContext('2d');
const regenButton = document.getElementById('regenButton');
const mapMeta = document.getElementById('mapMeta');
const calendarMeta = document.getElementById('calendarMeta');
const versionTag = document.getElementById('worldMapVersion');
const metaToggleButton = document.getElementById('metaToggleButton');
const worldInfoDialog = document.getElementById('worldInfoDialog');
const metaCloseButton = document.getElementById('metaCloseButton');
const layerButtons = [...document.querySelectorAll('.layer-button')];
const tilePopup = document.getElementById('tilePopup');
const seaLevelRatioInput = document.getElementById('seaLevelRatioInput');
const seaLevelRatioValue = document.getElementById('seaLevelRatioValue');
const elevationScaleInput = document.getElementById('elevationScaleInput');
const elevationScaleValue = document.getElementById('elevationScaleValue');
const warpStrengthInput = document.getElementById('warpStrengthInput');
const warpStrengthValue = document.getElementById('warpStrengthValue');
const ridgeStrengthInput = document.getElementById('ridgeStrengthInput');
const ridgeStrengthValue = document.getElementById('ridgeStrengthValue');
const riverBudgetScaleInput = document.getElementById('riverBudgetScaleInput');
const riverBudgetScaleValue = document.getElementById('riverBudgetScaleValue');

const SQRT3 = Math.sqrt(3);
const LAYER_MODE = {
  TERRAIN: 'terrain',
  ELEVATION: 'elevation',
  MOISTURE: 'moisture',
  HEAT: 'heat'
};

let activeLayer = LAYER_MODE.TERRAIN;
let currentWorld = null;
const calendarApi = window.NewtheriaCalendar;
const worldDate = calendarApi?.createDefaultDate?.() || { year: 1, month: 1, week: 1 };
const worldTurnMode = calendarApi?.TURN_MODE?.WEEKLY || 'weekly';

const createSeed = () => Math.floor(Math.random() * 4294967295);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const updateCalendarMeta = () => {
  if (!calendarMeta) return;
  const info = calendarApi?.getCalendarInfo?.(worldDate) || {
    seasonName: '아르케의 절기(겨울)',
    seasonDesc: '테마: 천사 / 심판, 지혜, 침묵',
    monthName: '로고스',
    monthDesc: '진리와 언령의 룬',
    weekName: '태동(胎動)',
    weekDesc: '마력이 막 깨어나는 주'
  };
  const turnRuleLabel = calendarApi?.getTurnRuleLabel?.(worldTurnMode) || '일반 월드맵(1턴=1주)';
  calendarMeta.textContent = [
    `턴 규칙 · ${turnRuleLabel}`,
    `현재 날짜 · ${worldDate.year}년 ${worldDate.month}월 ${worldDate.week}주`,
    `절기 · ${info.seasonName} (${info.seasonDesc})`,
    `월 룬 · ${info.monthName} (${info.monthDesc})`,
    `주차 테마 · ${info.weekName} (${info.weekDesc})`
  ].join('\n');
};
const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};
const rgbToHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const blendHex = (from, to, t) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex([
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t)
  ]);
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const setMapDimensions = (width, height) => {
  HEX_CONFIG.cols = width;
  HEX_CONFIG.rows = height;
};

const buildPermutation = (seed) => {
  const random = mulberry32(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = p.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }

  const perm = new Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  return perm;
};

const grad2 = (hash, x, y) => {
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
};

const createPerlin2D = (seed) => {
  const perm = buildPermutation(seed);

  return (x, y) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = quintic(xf);
    const v = quintic(yf);

    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];

    const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);

    return lerp(x1, x2, v);
  };
};

const TERRAIN_FAMILY = {
  심해: 'water', 바다: 'water', 호수: 'water', 강: 'river',
  산호해안: 'coast', 얕은해안: 'coast', 해안: 'coast', 모래해변: 'coast',
  푸른평원: 'grass', 사바나평원: 'grass', 구릉지: 'grass',
  울창한숲: 'forest', 침엽수림: 'forest', 열대우림: 'forest', 고대숲: 'forest', 운무고원림: 'forest', 이끼고원숲: 'forest', 맹그로브습지: 'wetland',
  늪지대: 'wetland', 사막오아시스: 'wetland',
  건조사막: 'arid', 붉은고원: 'arid', 붉은대협곡: 'arid',
  험준한산맥: 'mountain', 바위산맥: 'mountain', 화산지대: 'mountain', 용의둥지: 'mountain',
  만년설산: 'snow', 빙하설산: 'snow', 한랭고원: 'snow', 빙원: 'snow',
  세계수: 'special', 수정동굴: 'special', 고대성소: 'special', 고산운무림: 'special'
};

const FAMILY_GRADIENTS = {
  water: ['#10306a', '#2f78c7'],
  river: ['#2b63ad', '#67b2f8'],
  coast: ['#4aa9d8', '#8fd4ff'],
  grass: ['#4f8d3f', '#b9d47e'],
  forest: ['#0a4f33', '#4ea070'],
  wetland: ['#2b6241', '#62ab82'],
  arid: ['#9a4d1a', '#e7c96c'],
  mountain: ['#464d56', '#978376'],
  snow: ['#97a8b8', '#f4f8ff'],
  special: ['#5f6672', '#2ac08b']
};

const getTerrainColor = (terrainType, elevation, moisture, heat) => {
  const family = TERRAIN_FAMILY[terrainType] || 'special';
  if (['세계수', '용의둥지', '수정동굴', '고대성소', '고대숲'].includes(terrainType)) {
    return HEX_CONFIG.terrains[terrainType] || '#ffffff';
  }
  const [from, to] = FAMILY_GRADIENTS[family] || ['#6b7280', '#cbd5e1'];
  const rawMix = clamp01(elevation * 0.44 + moisture * 0.31 + heat * 0.25);
  const terrainBias = clamp01(((HEX_CONFIG.terrains[terrainType] ? hexToRgb(HEX_CONFIG.terrains[terrainType])[1] : 128) / 255));
  const familyGamma = family === 'coast' ? 0.85 : 0.92;
  const gradientMix = Math.pow(clamp01(rawMix * 0.92 + terrainBias * 0.18), familyGamma);
  let color = blendHex(from, to, gradientMix);
  const terrainBase = HEX_CONFIG.terrains[terrainType];
  if (terrainBase) {
    color = blendHex(color, terrainBase, family === 'coast' ? 0.28 : 0.22);
  }
  if (terrainType === '모래해변') {
    const warmSand = blendHex('#e7cd78', '#f3df9f', clamp01((1 - moisture) * 0.6 + heat * 0.4));
    color = blendHex(color, warmSand, 0.34);

  }
  return color;
};

const fbmPerlin = (noise2D, x, y, octaves, lacunarity = 2, gain = 0.5) => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let ampSum = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += noise2D(x * freq, y * freq) * amp;
    ampSum += amp;
    amp *= gain;
    freq *= lacunarity;
  }

  return sum / ampSum;
};

const ridgedNoise = (noise2D, x, y, octaves, lacunarity = 2, gain = 0.5) => {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let ampSum = 0;
  let weight = 1;

  for (let i = 0; i < octaves; i += 1) {
    const sample = 1 - Math.abs(noise2D(x * freq, y * freq));
    const ridge = sample * sample;
    const signal = ridge * weight;
    sum += signal * amp;
    ampSum += amp;
    weight = clamp01(signal * 1.85);
    freq *= lacunarity;
    amp *= gain;
  }

  return ampSum === 0 ? 0 : sum / ampSum;
};

const applyRerollSettings = () => {
  const seaLevelRatio = Number.parseFloat(seaLevelRatioInput?.value ?? `${HEX_CONFIG.seaLevelRatio}`);
  const elevationScale = Number.parseFloat(elevationScaleInput?.value ?? `${HEX_CONFIG.elevationScale}`);
  const warpStrength = Number.parseFloat(warpStrengthInput?.value ?? `${HEX_CONFIG.warpStrength}`);
  const ridgeStrength = Number.parseFloat(ridgeStrengthInput?.value ?? `${HEX_CONFIG.ridgeStrength}`);
  const riverBudgetScale = Number.parseFloat(riverBudgetScaleInput?.value ?? `${HEX_CONFIG.riverBudgetScale}`);
  HEX_CONFIG.seaLevelRatio = Number.isFinite(seaLevelRatio) ? seaLevelRatio : HEX_CONFIG.seaLevelRatio;
  HEX_CONFIG.elevationScale = Number.isFinite(elevationScale) ? elevationScale : HEX_CONFIG.elevationScale;
  HEX_CONFIG.warpStrength = Number.isFinite(warpStrength) ? warpStrength : HEX_CONFIG.warpStrength;
  HEX_CONFIG.ridgeStrength = Number.isFinite(ridgeStrength) ? ridgeStrength : HEX_CONFIG.ridgeStrength;
  HEX_CONFIG.riverBudgetScale = Number.isFinite(riverBudgetScale) ? riverBudgetScale : HEX_CONFIG.riverBudgetScale;
};

const updateRerollLabels = () => {
  if (seaLevelRatioValue) {
    seaLevelRatioValue.textContent = `${Math.round(HEX_CONFIG.seaLevelRatio * 100)}%`;
  }
  if (elevationScaleValue) {
    elevationScaleValue.textContent = `${HEX_CONFIG.elevationScale.toFixed(2)}x`;
  }
  if (warpStrengthValue) {
    warpStrengthValue.textContent = `${Math.round(HEX_CONFIG.warpStrength)}`;
  }
  if (ridgeStrengthValue) {
    ridgeStrengthValue.textContent = `${HEX_CONFIG.ridgeStrength.toFixed(2)}`;
  }
  if (riverBudgetScaleValue) {
    riverBudgetScaleValue.textContent = `${HEX_CONFIG.riverBudgetScale.toFixed(2)}x`;
  }
};

const inBounds = (x, y, width, height) => x >= 0 && y >= 0 && x < width && y < height;

const getNeighbors = (x, y, width, height) => {
  if (y % 2 === 0) {
    return [
      [x - 1, y - 1], [x, y - 1],
      [x - 1, y], [x + 1, y],
      [x - 1, y + 1], [x, y + 1]
    ].filter(([nx, ny]) => inBounds(nx, ny, width, height));
  }

  return [
    [x, y - 1], [x + 1, y - 1],
    [x - 1, y], [x + 1, y],
    [x, y + 1], [x + 1, y + 1]
  ].filter(([nx, ny]) => inBounds(nx, ny, width, height));
};

const smoothField = (field, width, height, passes = 1) => {
  let current = field.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const neighbors = getNeighbors(x, y, width, height);
        let sum = current[idx] * 1.35;
        let weight = 1.35;
        for (const [nx, ny] of neighbors) {
          sum += current[ny * width + nx];
          weight += 1;
        }
        next[idx] = sum / weight;
      }
    }
    current = next;
  }
  return current;
};

const getAdaptiveSeaLevels = (elevations) => {
  const sorted = [...elevations].sort((a, b) => a - b);
  const pick = (ratio) => {
    const idx = Math.floor(sorted.length * ratio);
    return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
  };

  const targetSeaRatio = clamp01(HEX_CONFIG.seaLevelRatio);
  let seaLevel = pick(targetSeaRatio);
  const waterRatio = elevations.filter((v) => v < seaLevel).length / elevations.length;
  if (waterRatio > targetSeaRatio + 0.18) seaLevel = pick(Math.max(0.05, targetSeaRatio - 0.06));
  else if (waterRatio < targetSeaRatio - 0.18) seaLevel = pick(Math.min(0.95, targetSeaRatio + 0.06));

  return { seaLevel, deepSeaLevel: seaLevel - HEX_CONFIG.deepSeaOffset };
};

const distanceToWater = (elevations, levels, width, height) => {
  const dist = new Array(width * height).fill(Infinity);
  const queue = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (elevations[idx] < levels.seaLevel) {
        dist[idx] = 0;
        queue.push([x, y]);
      }
    }
  }

  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = queue[i];
    const base = dist[y * width + x];
    for (const [nx, ny] of getNeighbors(x, y, width, height)) {
      const nIdx = ny * width + nx;
      if (dist[nIdx] > base + 1) {
        dist[nIdx] = base + 1;
        queue.push([nx, ny]);
      }
    }
  }

  return dist;
};

const isWaterTerrain = (terrainType) => ['심해', '바다', '얕은해안', '산호해안', '해안', '호수'].includes(terrainType);

const quantile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * ratio)));
  return sorted[idx];
};

const computeBiomeBands = (tilesForBanding) => {
  const elevations = tilesForBanding.map((tile) => tile.elevation);
  const moistures = tilesForBanding.map((tile) => tile.moisture);
  const heats = tilesForBanding.map((tile) => tile.heat);

  return {
    elevation: { low: quantile(elevations, 0.34), high: quantile(elevations, 0.68) },
    moisture: { low: quantile(moistures, 0.33), high: quantile(moistures, 0.67) },
    heat: { low: quantile(heats, 0.33), high: quantile(heats, 0.67) }
  };
};

const getBand = (value, low, high) => {
  if (value <= low) return 'low';
  if (value >= high) return 'high';
  return 'mid';
};

const classifyTerrain = (elevation, moisture, heat, nearSea, levels, bands, random) => {
  const mountainStart = Math.max(bands.elevation.high, levels.seaLevel + 0.12);
  const highlandStart = Math.max(bands.elevation.low, levels.seaLevel + 0.04);

  if (elevation < levels.deepSeaLevel) return '심해';
  if (elevation < levels.seaLevel - HEX_CONFIG.coastBand * 0.7) return '바다';
  if (elevation < levels.seaLevel - HEX_CONFIG.coastBand * 0.25) return heat > 0.75 ? '산호해안' : '얕은해안';
  if (elevation < levels.seaLevel) return nearSea ? '해안' : '얕은해안';
  if (elevation < levels.seaLevel + 0.01 && nearSea) return '모래해변';

  const elevationBand = getBand(elevation, bands.elevation.low, bands.elevation.high);
  const moistureBand = getBand(moisture, bands.moisture.low, bands.moisture.high);
  const heatBand = getBand(heat, bands.heat.low, bands.heat.high);

  if (elevation > mountainStart) {
    if (heatBand === 'high' && moistureBand === 'high') return random < 0.48 ? '고산운무림' : '험준한산맥';
    if (heatBand === 'low' && moistureBand === 'high') return random < 0.52 ? '빙하설산' : '만년설산';
    if (moistureBand === 'low') return random < 0.55 ? '바위산맥' : '험준한산맥';
    if (heatBand === 'high' && moistureBand !== 'high') return random < 0.5 ? '화산지대' : '붉은대협곡';
    if (heatBand === 'low') return '만년설산';
    return '험준한산맥';
  }
  if (elevation > highlandStart) {
    if (heatBand === 'high' && moistureBand === 'high') return random < 0.6 ? '운무고원림' : '고산운무림';
    if (heatBand === 'high' && moistureBand === 'low') return random < 0.18 ? '붉은고원' : '구릉지';
    if (heatBand === 'low' && moistureBand === 'high') return random < 0.55 ? '한랭고원' : '이끼고원숲';
    if (moistureBand === 'high') return '이끼고원숲';
    return '구릉지';
  }

  if (heatBand === 'high') {
    if (moistureBand === 'high') {
      if (nearSea && random < 0.5) return '맹그로브습지';
      return random < 0.5 ? '열대우림' : '늪지대';
    }
    if (moistureBand === 'low') return (!nearSea && random < 0.12) ? '사막오아시스' : '건조사막';
    return random < 0.6 ? '사바나평원' : '푸른평원';
  }
  if (heatBand === 'mid') {
    if (moistureBand === 'high') return random < 0.45 ? '울창한숲' : '늪지대';
    if (moistureBand === 'low') return random < 0.6 ? '푸른평원' : '사바나평원';
    return random < 0.5 ? '푸른평원' : '울창한숲';
  }
  if (moistureBand === 'high') return random < 0.6 ? '침엽수림' : '한랭고원';
  if (moistureBand === 'low') return random < 0.6 ? '빙원' : '바위산맥';
  return random < 0.5 ? '침엽수림' : '빙원';
};

const rebalanceBiomeDiversity = (tiles, random, levels) => {
  const LAND_WATER = new Set(['심해', '바다', '얕은해안', '산호해안', '해안', '모래해변', '호수']);
  const targetBiomes = [
    '맹그로브습지', '열대우림', '건조사막', '사바나평원',
    '운무고원림', '이끼고원숲', '한랭고원',
    '험준한산맥', '바위산맥', '만년설산', '빙하설산', '고산운무림', '화산지대', '붉은대협곡'
  ];

  const counts = tiles.reduce((acc, tile) => {
    acc[tile.terrainType] = (acc[tile.terrainType] || 0) + 1;
    return acc;
  }, {});

  const landTiles = tiles.filter((tile) => !LAND_WATER.has(tile.terrainType));
  const minTarget = Math.max(18, Math.floor(landTiles.length * 0.004));

  const tryPromote = (biome, predicate) => {
    const missing = minTarget - (counts[biome] || 0);
    if (missing <= 0) return;
    const candidates = landTiles.filter((tile) => predicate(tile) && tile.terrainType !== biome);
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const take = Math.min(missing, candidates.length);
    for (let i = 0; i < take; i += 1) {
      const tile = candidates[i];
      counts[tile.terrainType] = Math.max(0, (counts[tile.terrainType] || 0) - 1);
      tile.terrainType = biome;
      tile.color = getTerrainColor(tile.terrainType, tile.elevation, tile.moisture, tile.heat);
      counts[biome] = (counts[biome] || 0) + 1;
    }
  };

  tryPromote('맹그로브습지', (tile) => tile.heat > 0.62 && tile.moisture > 0.6 && tile.elevation < levels.seaLevel + 0.08);
  tryPromote('열대우림', (tile) => tile.heat > 0.6 && tile.moisture > 0.58 && tile.elevation < levels.seaLevel + 0.16);
  tryPromote('건조사막', (tile) => tile.heat > 0.64 && tile.moisture < 0.26);
  tryPromote('운무고원림', (tile) => tile.elevation > levels.seaLevel + 0.1 && tile.heat > 0.56 && tile.moisture > 0.58);
  tryPromote('이끼고원숲', (tile) => tile.elevation > levels.seaLevel + 0.1 && tile.moisture > 0.62);
  tryPromote('붉은고원', (tile) => tile.elevation > levels.seaLevel + 0.14 && tile.heat > 0.64 && tile.moisture < 0.26);
  tryPromote('한랭고원', (tile) => tile.elevation > levels.seaLevel + 0.1 && tile.heat < 0.42 && tile.moisture > 0.56);
  tryPromote('바위산맥', (tile) => tile.elevation > levels.seaLevel + 0.16 && tile.moisture < 0.32);
  tryPromote('빙하설산', (tile) => tile.elevation > levels.seaLevel + 0.16 && tile.heat < 0.33 && tile.moisture > 0.52);
  tryPromote('고산운무림', (tile) => tile.elevation > levels.seaLevel + 0.16 && tile.heat > 0.58 && tile.moisture > 0.52);
  tryPromote('화산지대', (tile) => tile.elevation > levels.seaLevel + 0.15 && tile.heat > 0.62 && tile.moisture < 0.48);
  tryPromote('붉은대협곡', (tile) => tile.elevation > levels.seaLevel + 0.18 && tile.heat > 0.6 && tile.moisture < 0.42);

  for (const biome of targetBiomes) {
    counts[biome] = counts[biome] || 0;
  }
};

const clusterAridTiles = (tiles, width, height, levels) => {
  const ARID_SET = new Set(['건조사막', '사막오아시스']);
  const WATER_SET = new Set(['심해', '바다', '얕은해안', '산호해안', '해안', '모래해변', '호수', '강']);

  for (let pass = 0; pass < 2; pass += 1) {
    const updates = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const tile = tiles[idx];
        const neighbors = getNeighbors(x, y, width, height).map(([nx, ny]) => tiles[ny * width + nx]);
        const aridNeighbors = neighbors.filter((neighbor) => ARID_SET.has(neighbor.terrainType)).length;

        if (tile.terrainType === '사막오아시스' && aridNeighbors >= 4) {
          updates.push([idx, '건조사막']);
          continue;
        }

        if (tile.terrainType === '건조사막' && aridNeighbors <= 1) {
          const fallback = tile.moisture < 0.22 ? '구릉지' : '사바나평원';
          updates.push([idx, fallback]);
          continue;
        }

        if (!ARID_SET.has(tile.terrainType)
          && !WATER_SET.has(tile.terrainType)
          && aridNeighbors >= 4
          && tile.heat > 0.6
          && tile.moisture < 0.34
          && tile.elevation < levels.seaLevel + 0.18) {
          updates.push([idx, '건조사막']);
        }
      }
    }

    updates.forEach(([idx, terrainType]) => {
      const tile = tiles[idx];
      tile.terrainType = terrainType;
      tile.color = getTerrainColor(terrainType, tile.elevation, tile.moisture, tile.heat);
    });
  }
};

const RESOURCE_RULES = [
  { id: 'herbs', terrains: ['푸른평원', '사바나평원'], prob: 0.06 },
  { id: 'timber', terrains: ['울창한숲', '침엽수림', '고대숲', '열대우림'], prob: 0.08 },
  { id: 'obsidian', terrains: ['화산지대', '붉은대협곡'], prob: 0.05 },
  { id: 'crystal', terrains: ['만년설산', '험준한산맥', '수정동굴'], prob: 0.035 },
  { id: 'mana_bloom', terrains: ['사막오아시스', '세계수', '고대성소'], prob: 0.03 }
];

const assignTerrainResources = (tiles, random) => {
  tiles.forEach((tile) => {
    if (isWaterTerrain(tile.terrainType)) return;
    const candidates = RESOURCE_RULES.filter((rule) => rule.terrains.includes(tile.terrainType));
    for (const candidate of candidates) {
      if (random() < candidate.prob) {
        tile.specialProduct = candidate.id;
        break;
      }
    }
  });
};

const convertSmallWaterBodiesToLakes = (tiles, width, height, maxLakeSize = 220) => {
  const visited = new Set();
  const get = (x, y) => tiles[y * width + x];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      const tile = get(x, y);
      if (!isWaterTerrain(tile.terrainType) || visited.has(key)) continue;

      const queue = [[x, y]];
      const body = [];
      visited.add(key);

      for (let i = 0; i < queue.length; i += 1) {
        const [cx, cy] = queue[i];
        const current = get(cx, cy);
        body.push(current);

        for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
          const nKey = `${nx},${ny}`;
          const neighbor = get(nx, ny);
          if (!visited.has(nKey) && isWaterTerrain(neighbor.terrainType)) {
            visited.add(nKey);
            queue.push([nx, ny]);
          }
        }
      }

      if (body.length <= maxLakeSize) {
        body.forEach((waterTile) => {
          waterTile.terrainType = '호수';
          waterTile.color = getTerrainColor('호수', waterTile.elevation, waterTile.moisture, waterTile.heat);
        });
      }
    }
  }
};

const placeMythicLandmarks = (tiles, random, width, height) => {
  const landTiles = tiles.filter((tile) => !isWaterTerrain(tile.terrainType) && tile.terrainType !== '모래해변');
  if (!landTiles.length) return;

  const worldTree = landTiles[Math.floor(random() * landTiles.length)];
  worldTree.terrainType = '세계수';
  worldTree.specialTileType = 'world_tree';
  worldTree.manaSaturation = 100;
  worldTree.sparkleLight = 100;
  worldTree.color = getTerrainColor('세계수', worldTree.elevation, worldTree.moisture, worldTree.heat);

  const ancientForestSize = Math.floor(random() * 20) + 30;
  const forestSeeds = [worldTree];
  const marked = new Set([`${worldTree.coord.x},${worldTree.coord.y}`]);
  let attempts = 0;
  while (forestSeeds.length && marked.size < ancientForestSize && attempts < 2000) {
    const current = forestSeeds[Math.floor(random() * forestSeeds.length)];
    const neighbors = getNeighbors(current.coord.x, current.coord.y, width, height);
    const [nx, ny] = neighbors[Math.floor(random() * neighbors.length)] || [];
    if (nx === undefined) break;
    const key = `${nx},${ny}`;
    const target = tiles[ny * width + nx];

    if (!marked.has(key) && target && !isWaterTerrain(target.terrainType) && target.terrainType !== '호수') {
      marked.add(key);
      target.terrainType = '고대숲';
      target.color = getTerrainColor('고대숲', target.elevation, target.moisture, target.heat);
      target.manaSaturation = Math.max(90, target.manaSaturation);
      forestSeeds.push(target);
    }
    attempts += 1;
  }

  const peaks = landTiles.filter((tile) => ['험준한산맥', '화산지대', '붉은대협곡'].includes(tile.terrainType));
  if (peaks.length) {
    const dragonPeak = peaks.reduce((max, tile) => (tile.elevation > max.elevation ? tile : max), peaks[0]);
    dragonPeak.terrainType = '용의둥지';
    dragonPeak.specialTileType = 'dragon_peak';
    dragonPeak.manaSaturation = 100;
    dragonPeak.sparkleLight = 100;
    dragonPeak.color = getTerrainColor('용의둥지', dragonPeak.elevation, dragonPeak.moisture, dragonPeak.heat);
  }

  const coldTiles = landTiles.filter((tile) => ['만년설산', '빙원'].includes(tile.terrainType));
  if (coldTiles.length) {
    const cave = coldTiles[Math.floor(random() * coldTiles.length)];
    cave.terrainType = '수정동굴';
    cave.specialTileType = 'crystal_cave';
    cave.manaSaturation = 100;
    cave.sparkleLight = 100;
    cave.color = getTerrainColor('수정동굴', cave.elevation, cave.moisture, cave.heat);
  }

  const plains = landTiles.filter((tile) => ['푸른평원', '사막오아시스', '사바나평원'].includes(tile.terrainType));
  if (plains.length) {
    const monolith = plains[Math.floor(random() * plains.length)];
    monolith.terrainType = '고대성소';
    monolith.specialTileType = 'ancient_monolith';
    monolith.manaSaturation = 100;
    monolith.sparkleLight = 100;
    monolith.color = getTerrainColor('고대성소', monolith.elevation, monolith.moisture, monolith.heat);
  }
};

const carveRivers = (tiles, random, levels, width, height, riverBudget) => {
  const get = (x, y) => tiles[y * width + x];
  let sources = tiles.filter((tile) => tile.elevation > 0.69 && tile.moisture > 0.44);

  if (sources.length < 30) {
    sources = [...tiles]
      .sort((a, b) => (b.elevation + b.moisture * 0.24) - (a.elevation + a.moisture * 0.24))
      .slice(0, 220);
  }

  for (let i = sources.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [sources[i], sources[j]] = [sources[j], sources[i]];
  }

  const attempts = Math.min(riverBudget, Math.max(8, Math.floor(sources.length * 0.45)));

  for (let i = 0; i < attempts; i += 1) {
    const source = sources[i % sources.length];
    if (!source) continue;

    let x = source.coord.x;
    let y = source.coord.y;
    const visited = new Set();
    let carvedLength = 0;

    for (let step = 0; step < 80; step += 1) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);

      const current = get(x, y);
      if (!current || current.elevation <= levels.seaLevel) break;
      if (current.terrainType === '강' && carvedLength > 10) break;

      if (!['험준한산맥', '만년설산', '화산지대', '용의둥지'].includes(current.terrainType)) {
        current.terrainType = '강';
        current.color = getTerrainColor('강', current.elevation, current.moisture, current.heat);
        carvedLength += 1;
      }

      const candidates = getNeighbors(x, y, width, height).map(([nx, ny]) => [nx, ny, get(nx, ny)]);
      candidates.sort((a, b) => (a[2].elevation + random() * 0.0022) - (b[2].elevation + random() * 0.0022));
      const next = candidates.find(([, , tile]) => tile.elevation <= current.elevation + 0.0009);
      if (!next) break;
      [x, y] = next;
    }
  }
};

const createNoiseContext = (seed) => ({
  elevation: createPerlin2D(seed ^ 0xa54ff53a),
  moisture: createPerlin2D(seed ^ 0x510e527f),
  heat: createPerlin2D(seed ^ 0x9b05688c)
});

const buildScalarFields = (width, height, noiseContext) => {
  const elevations = new Array(width * height).fill(0);
  const moistures = new Array(width * height).fill(0);
  const heats = new Array(width * height).fill(0);

  for (let y = 0; y < height; y += 1) {
    const latitude = Math.abs((y / (height - 1)) * 2 - 1);
    const equatorBase = 1 - latitude;

    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const warpX = fbmPerlin(noiseContext.moisture, x * HEX_CONFIG.warpFrequency + 71, y * HEX_CONFIG.warpFrequency - 29, 3, 2, 0.5);
      const warpY = fbmPerlin(noiseContext.heat, x * HEX_CONFIG.warpFrequency - 113, y * HEX_CONFIG.warpFrequency + 167, 3, 2, 0.5);
      const wx = x + warpX * HEX_CONFIG.warpStrength;
      const wy = y + warpY * HEX_CONFIG.warpStrength;

      const macroElevation = fbmPerlin(noiseContext.elevation, wx * HEX_CONFIG.elevationFrequency, wy * HEX_CONFIG.elevationFrequency, 6, 2.02, 0.56);
      const regionalElevation = fbmPerlin(noiseContext.elevation, wx * HEX_CONFIG.elevationFrequency * 2.6 + 37, wy * HEX_CONFIG.elevationFrequency * 2.6 - 41, 5, 2.08, 0.57);
      const microElevation = fbmPerlin(noiseContext.elevation, wx * HEX_CONFIG.elevationFrequency * 5.5 - 13, wy * HEX_CONFIG.elevationFrequency * 5.5 + 17, 4, 2.12, 0.6);
      const ruggedNoise = Math.abs(fbmPerlin(noiseContext.elevation, wx * HEX_CONFIG.elevationFrequency * 8.8 + 59, wy * HEX_CONFIG.elevationFrequency * 8.8 - 83, 3, 2.18, 0.6));
      const macroRidge = ridgedNoise(noiseContext.elevation, wx * HEX_CONFIG.ridgeFrequency + 181, wy * HEX_CONFIG.ridgeFrequency - 127, 4, 2.05, 0.58);
      const detailRidge = ridgedNoise(noiseContext.elevation, wx * HEX_CONFIG.ridgeDetailFrequency - 311, wy * HEX_CONFIG.ridgeDetailFrequency + 89, 3, 2.2, 0.55);
      const oceanScatter = fbmPerlin(noiseContext.elevation, wx * HEX_CONFIG.elevationFrequency * 0.9 + 101, wy * HEX_CONFIG.elevationFrequency * 0.9 - 73, 3, 2, 0.5);

      const biomePatch = fbmPerlin(
        noiseContext.elevation,
        wx * HEX_CONFIG.biomePatchFrequency + 211,
        wy * HEX_CONFIG.biomePatchFrequency - 157,
        3,
        2.2,
        0.58
      );

      const elevation = clamp01(
        ((macroElevation * 0.5 + 0.5) * 0.56
        + (regionalElevation * 0.5 + 0.5) * 0.24
        + (microElevation * 0.5 + 0.5) * 0.12
        + ruggedNoise * 0.08
        + macroRidge * HEX_CONFIG.ridgeStrength
        + detailRidge * HEX_CONFIG.ridgeStrength * 0.34)
        - (oceanScatter * 0.5 + 0.5) * 0.09
        + biomePatch * HEX_CONFIG.biomePatchStrength
      ) ** HEX_CONFIG.elevationScale;
      elevations[idx] = elevation;

      const heatLarge = fbmPerlin(noiseContext.heat, wx * HEX_CONFIG.heatFrequency, wy * HEX_CONFIG.heatFrequency, 5, 2.03, 0.6);
      const heatDetail = fbmPerlin(noiseContext.heat, wx * HEX_CONFIG.heatFrequency * 4.1 + 12, wy * HEX_CONFIG.heatFrequency * 4.1 - 9, 4, 2.1, 0.58);
      const heatPatch = fbmPerlin(noiseContext.heat, wx * HEX_CONFIG.heatFrequency * 9.8 - 143, wy * HEX_CONFIG.heatFrequency * 9.8 + 227, 3, 2.24, 0.58);
      heats[idx] = clamp01(equatorBase * 0.5 + (heatLarge * 0.5 + 0.5) * 0.3 + (heatDetail * 0.5 + 0.5) * 0.14 + (heatPatch * 0.5 + 0.5) * 0.06);

      const moistureLarge = fbmPerlin(noiseContext.moisture, wx * HEX_CONFIG.moistureFrequency, wy * HEX_CONFIG.moistureFrequency, 6, 2.05, 0.58);
      const moistureDetail = fbmPerlin(noiseContext.moisture, wx * HEX_CONFIG.moistureFrequency * 4.5 - 17, wy * HEX_CONFIG.moistureFrequency * 4.5 + 29, 5, 2.08, 0.57);
      const moisturePatch = fbmPerlin(noiseContext.moisture, wx * HEX_CONFIG.moistureFrequency * 10.2 + 71, wy * HEX_CONFIG.moistureFrequency * 10.2 - 93, 3, 2.18, 0.6);
      const elevationPenalty = Math.max(0, elevation - 0.64) * 0.24;
      moistures[idx] = clamp01((moistureLarge * 0.5 + 0.5) * 0.56 + (moistureDetail * 0.5 + 0.5) * 0.24 + (moisturePatch * 0.5 + 0.5) * 0.1 + (1 - elevation) * 0.1 - elevationPenalty);
    }
  }

  return {
    elevations: smoothField(elevations, width, height, 1),
    moistures: smoothField(moistures, width, height, 0),
    heats: smoothField(heats, width, height, 0)
  };
};

const buildTiles = (width, height, fields, levels, waterDist, random) => {
  const tiles = [];
  const tilesForBanding = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const elevation = fields.elevations[idx];
      const coastMoisture = clamp01(1 - waterDist[idx] / 17);
      const moisture = clamp01(fields.moistures[idx] * 0.72 + coastMoisture * 0.28);
      const heat = fields.heats[idx];

      const nearSea = getNeighbors(x, y, width, height).some(([nx, ny]) => fields.elevations[ny * width + nx] < levels.seaLevel);
      if (elevation >= levels.seaLevel) {
        tilesForBanding.push({ elevation, moisture, heat });
      }
    }
  }

  const bands = computeBiomeBands(tilesForBanding);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const elevation = fields.elevations[idx];
      const coastMoisture = clamp01(1 - waterDist[idx] / 17);
      const moisture = clamp01(fields.moistures[idx] * 0.72 + coastMoisture * 0.28);
      const heat = fields.heats[idx];
      const nearSea = getNeighbors(x, y, width, height).some(([nx, ny]) => fields.elevations[ny * width + nx] < levels.seaLevel);
      const terrainType = classifyTerrain(elevation, moisture, heat, nearSea, levels, bands, random());

      tiles.push({
        coord: { x, y, z: HEX_CONFIG.z },
        elevation,
        moisture,
        heat,
        terrainType,
        manaSaturation: Math.round((0.28 + moisture * 0.52 + heat * 0.2) * 100),
        security: Math.round(clamp01(0.7 - Math.abs(elevation - 0.56) * 0.54 + moisture * 0.17) * 100),
        nationId: null,
        settlementId: null,
        influenceId: null,
        sparkleLight: Number(((0.22 + moisture * 0.43 + heat * 0.35) * 100).toFixed(2)),
        specialProduct: null,
        threatInfo: null,
        specialTileType: null,
        color: getTerrainColor(terrainType, elevation, moisture, heat)
      });
    }
  }

  rebalanceBiomeDiversity(tiles, random, levels);

  return tiles;
};

function generateWorldMap(width = MAP_SIZE, height = MAP_SIZE) {
  setMapDimensions(width, height);

  const seed = createSeed();
  const random = mulberry32(seed);
  const noiseContext = createNoiseContext(seed);
  const rawFields = buildScalarFields(width, height, noiseContext);

  const levels = getAdaptiveSeaLevels(rawFields.elevations);
  const waterDist = distanceToWater(rawFields.elevations, levels, width, height);

  const tiles = buildTiles(width, height, rawFields, levels, waterDist, random);
  clusterAridTiles(tiles, width, height, levels);
  convertSmallWaterBodiesToLakes(tiles, width, height, 200);
  assignTerrainResources(tiles, random);
  placeMythicLandmarks(tiles, random, width, height);

  const landTiles = tiles.filter((tile) => !['심해', '바다', '얕은해안', '산호해안', '해안', '모래해변', '호수'].includes(tile.terrainType));
  const avgLandMoisture = landTiles.length ? landTiles.reduce((sum, tile) => sum + tile.moisture, 0) / landTiles.length : 0;
  const riverBudget = Math.max(8, Math.floor(30
    * (0.28 + avgLandMoisture * 0.42)
    * (landTiles.length / tiles.length + 0.1)
    * HEX_CONFIG.riverBudgetScale));

  carveRivers(tiles, random, levels, width, height, riverBudget);

  return {
    seed,
    width,
    height,
    levels,
    riverBudget,
    tiles
  };
}

const hexToPixel = (q, r, size) => ({
  x: size * SQRT3 * (q + (r % 2) / 2),
  y: size * 1.5 * r
});

const drawHex = (x, y, size, color) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

const valueToGradient = (value, stops) => {
  if (value <= stops[0].value) return stops[0].color;
  if (value >= stops[stops.length - 1].value) return stops[stops.length - 1].color;

  for (let i = 1; i < stops.length; i += 1) {
    const start = stops[i - 1];
    const end = stops[i];
    if (value <= end.value) {
      const t = (value - start.value) / (end.value - start.value);
      const [sr, sg, sb] = start.color;
      const [er, eg, eb] = end.color;
      const r = Math.round(lerp(sr, er, t));
      const g = Math.round(lerp(sg, eg, t));
      const b = Math.round(lerp(sb, eb, t));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  return `rgb(${stops[stops.length - 1].color.join(', ')})`;
};

const getTileColorByLayer = (tile, layer) => {
  if (layer === LAYER_MODE.TERRAIN) return tile.color;
  if (layer === LAYER_MODE.ELEVATION) {
    return valueToGradient(tile.elevation, [
      { value: 0, color: [17, 24, 39] },
      { value: 0.3, color: [30, 64, 175] },
      { value: 0.58, color: [74, 222, 128] },
      { value: 0.75, color: [163, 230, 53] },
      { value: 1, color: [250, 250, 250] }
    ]);
  }
  if (layer === LAYER_MODE.MOISTURE) {
    return valueToGradient(tile.moisture, [
      { value: 0, color: [120, 53, 15] },
      { value: 0.3, color: [202, 138, 4] },
      { value: 0.55, color: [34, 197, 94] },
      { value: 1, color: [8, 145, 178] }
    ]);
  }

  return valueToGradient(tile.heat, [
    { value: 0, color: [59, 130, 246] },
    { value: 0.35, color: [56, 189, 248] },
    { value: 0.62, color: [253, 224, 71] },
    { value: 1, color: [239, 68, 68] }
  ]);
};

const renderWorld = (world) => {
  const { tiles, seed, width, height, riverBudget } = world;

  const hexWidth = SQRT3 * HEX_CONFIG.size;
  const hexHeight = HEX_CONFIG.size * 2;
  const canvasWidth = Math.ceil(hexWidth * (width + 0.5) + 16);
  const canvasHeight = Math.ceil(HEX_CONFIG.size * 1.5 * (height - 1) + hexHeight + 16);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  tiles.forEach((tile) => {
    const { x, y } = hexToPixel(tile.coord.x, tile.coord.y, HEX_CONFIG.size);
    drawHex(x + 8, y + 8, HEX_CONFIG.size, getTileColorByLayer(tile, activeLayer));
  });

  const terrainStat = tiles.reduce((acc, tile) => {
    acc[tile.terrainType] = (acc[tile.terrainType] || 0) + 1;
    return acc;
  }, {});

  const landCount = Object.entries(terrainStat)
    .filter(([name]) => !['심해', '바다', '얕은해안', '산호해안', '해안', '모래해변', '호수'].includes(name))
    .reduce((sum, [, count]) => sum + count, 0);

  const riverCount = terrainStat.강 || 0;
  mapMeta.textContent = [
    `시드 · ${seed}`,
    `헥스 크기 · ${width}x${height} (${tiles.length.toLocaleString()} 타일)`,
    `지형 분포 · 육지 ${landCount.toLocaleString()} / 해양 ${(tiles.length - landCount).toLocaleString()}`,
    `하천 정보 · 강 ${riverCount.toLocaleString()} / riverBudget ${riverBudget}`
  ].join('\n');
};

const generateAndRender = () => {
  applyRerollSettings();
  updateRerollLabels();
  const world = generateWorldMap(MAP_SIZE, MAP_SIZE);
  currentWorld = world;
  tilePopup.hidden = true;
  renderWorld(world);
};

const updateVersionTag = async () => {
  let version = WORLD_VERSION_FALLBACK;

  try {
    const response = await fetch('./docs/99_변경이력.md', { cache: 'no-store' });
    if (response.ok) {
      const changelogText = await response.text();
      const matched = changelogText.match(/^##\s+(ver\.[^\n]+)/m);
      if (matched?.[1]) {
        version = matched[1].trim();
      }
    }
  } catch (error) {
    console.warn('변경 이력에서 버전 정보를 불러오지 못했습니다.', error);
  }

  versionTag.textContent = version;
};

const cubeRound = (x, y, z) => {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;

  return { x: rx, y: ry, z: rz };
};

const pixelToHexCoord = (pixelX, pixelY, size) => {
  const px = pixelX - 8;
  const py = pixelY - 8;
  const q = (SQRT3 / 3 * px - py / 3) / size;
  const r = ((2 / 3) * py) / size;
  const cube = cubeRound(q, -q - r, r);
  const row = cube.z;
  const col = cube.x + (row - (row & 1)) / 2;
  return { x: col, y: row };
};

const updateLayerButtons = () => {
  layerButtons.forEach((button) => {
    const isActive = button.dataset.layer === activeLayer;
    button.classList.toggle('is-active', isActive);
  });
};

const showTilePopup = (tile, offsetX, offsetY) => {
  tilePopup.innerHTML = `
    <strong>타일 (${tile.coord.x}, ${tile.coord.y}, z=${tile.coord.z})</strong><br />
    지형: ${tile.terrainType}<br />
    고도: ${tile.elevation.toFixed(3)}<br />
    습도: ${tile.moisture.toFixed(3)}<br />
    온도: ${tile.heat.toFixed(3)}
  `;
  tilePopup.style.left = `${offsetX + 16}px`;
  tilePopup.style.top = `${offsetY + 16}px`;
  tilePopup.hidden = false;
};

layerButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeLayer = button.dataset.layer || LAYER_MODE.TERRAIN;
    updateLayerButtons();
    if (currentWorld) renderWorld(currentWorld);
  });
});

canvas.addEventListener('click', (event) => {
  if (!currentWorld) return;
  const { offsetX, offsetY } = event;
  const target = pixelToHexCoord(offsetX, offsetY, HEX_CONFIG.size);
  if (!inBounds(target.x, target.y, currentWorld.width, currentWorld.height)) {
    tilePopup.hidden = true;
    return;
  }

  const tile = currentWorld.tiles[target.y * currentWorld.width + target.x];
  if (!tile) {
    tilePopup.hidden = true;
    return;
  }
  showTilePopup(tile, offsetX, offsetY);
});

metaToggleButton?.addEventListener('click', () => {
  if (!worldInfoDialog) return;
  worldInfoDialog.showModal();
  metaToggleButton.setAttribute('aria-expanded', 'true');
});

metaCloseButton?.addEventListener('click', () => {
  if (!worldInfoDialog) return;
  worldInfoDialog.close();
});

worldInfoDialog?.addEventListener('close', () => {
  metaToggleButton?.setAttribute('aria-expanded', 'false');
});

updateCalendarMeta();
regenButton.addEventListener('click', generateAndRender);
seaLevelRatioInput?.addEventListener('input', () => {
  applyRerollSettings();
  updateRerollLabels();
});
elevationScaleInput?.addEventListener('input', () => {
  applyRerollSettings();
  updateRerollLabels();
});
warpStrengthInput?.addEventListener('input', () => {
  applyRerollSettings();
  updateRerollLabels();
});
ridgeStrengthInput?.addEventListener('input', () => {
  applyRerollSettings();
  updateRerollLabels();
});
riverBudgetScaleInput?.addEventListener('input', () => {
  applyRerollSettings();
  updateRerollLabels();
});
applyRerollSettings();
updateRerollLabels();
updateVersionTag();

generateAndRender();
