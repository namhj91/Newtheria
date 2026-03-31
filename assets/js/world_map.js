const WORLD_VERSION = 'ver.0.0.51(260331-해양쏠림보정강화)';

const HEX_CONFIG = {
  cols: 200,
  rows: 200,
  z: 0,
  size: 4,
  seaLevel: 0.5,
  deepSeaLevel: 0.34,
  coastBand: 0.03,
  mountainLevel: 0.8,
  riverCount: 170,
  plateCount: 16,
  elevationFrequency: 0.012,
  heatFrequency: 0.008,
  terrains: {
    심해: '#203b78',
    바다: '#2e5ca6',
    해안: '#4a90d9',
    모래해변: '#d4c08f',
    호수: '#3f76ca',
    강: '#4f8fd8',
    평원: '#7fbf5f',
    숲: '#4d8f45',
    고대림: '#2f6940',
    구릉지: '#90a86f',
    협곡: '#6e5e52',
    산맥: '#8e98a4',
    화산지대: '#9c4b3a',
    만년설산: '#e6eef8',
    습지: '#5b7d50',
    황무지: '#9c8d64',
    사막: '#d4bc75'
  }
};

const canvas = document.getElementById('worldMapCanvas');
const ctx = canvas.getContext('2d');
const regenButton = document.getElementById('regenButton');
const mapMeta = document.getElementById('mapMeta');
const versionTag = document.getElementById('worldMapVersion');

const SQRT3 = Math.sqrt(3);

const createSeed = () => Math.floor(Math.random() * 4294967295);

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const hash2 = (x, y, seed) => {
  let n = x * 374761393 + y * 668265263 + seed * 2246822519;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
};

const smoothstep = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const valueNoise2D = (x, y, seed) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
};

const fbm = (x, y, seed, octaves = 5) => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let ampSum = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2D(x * freq, y * freq, seed + i * 1013) * amp;
    ampSum += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return sum / ampSum;
};

const domainWarpNoise = (x, y, seed, baseFreq) => {
  const warpX = (fbm(x * baseFreq * 0.8, y * baseFreq * 0.8, seed + 71, 3) - 0.5) * 28;
  const warpY = (fbm(x * baseFreq * 0.8, y * baseFreq * 0.8, seed + 131, 3) - 0.5) * 28;
  return fbm((x + warpX) * baseFreq, (y + warpY) * baseFreq, seed, 5);
};

const hexToPixel = (q, r, size) => ({
  x: size * SQRT3 * (q + (r % 2) / 2),
  y: size * 1.5 * r
});

const inBounds = (x, y) => x >= 0 && y >= 0 && x < HEX_CONFIG.cols && y < HEX_CONFIG.rows;

const getNeighbors = (x, y) => {
  if (y % 2 === 0) {
    return [
      [x - 1, y - 1], [x, y - 1],
      [x - 1, y], [x + 1, y],
      [x - 1, y + 1], [x, y + 1]
    ].filter(([nx, ny]) => inBounds(nx, ny));
  }

  return [
    [x, y - 1], [x + 1, y - 1],
    [x - 1, y], [x + 1, y],
    [x, y + 1], [x + 1, y + 1]
  ].filter(([nx, ny]) => inBounds(nx, ny));
};

const edgeFalloff = (x, y) => {
  const cx = (HEX_CONFIG.cols - 1) / 2;
  const cy = (HEX_CONFIG.rows - 1) / 2;
  const dx = Math.abs(x - cx) / cx;
  const dy = Math.abs(y - cy) / cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, 1 - Math.pow(d, 1.95));
};

const generatePlates = (random) => {
  const plates = [];
  for (let i = 0; i < HEX_CONFIG.plateCount; i += 1) {
    plates.push({
      x: Math.floor(random() * HEX_CONFIG.cols),
      y: Math.floor(random() * HEX_CONFIG.rows),
      continental: random() > 0.42,
      uplift: random() * 0.36 + 0.14
    });
  }
  return plates;
};

const plateElevation = (x, y, plates) => {
  let nearest = Infinity;
  let second = Infinity;
  let owner = plates[0];

  for (const plate of plates) {
    const dx = x - plate.x;
    const dy = y - plate.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearest) {
      second = nearest;
      nearest = dist;
      owner = plate;
    } else if (dist < second) {
      second = dist;
    }
  }

  const boundary = clamp01((second - nearest) / 12);
  const base = owner.continental ? 0.56 + owner.uplift * 0.3 : 0.34 + owner.uplift * 0.16;
  const ridgeBoost = clamp01(1 - boundary) * 0.24;
  return clamp01(base + ridgeBoost);
};

const smoothField = (field, passes = 2) => {
  let current = field.slice();

  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
      for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
        const idx = y * HEX_CONFIG.cols + x;
        const neighbors = getNeighbors(x, y);
        let sum = current[idx] * 1.2;
        let weight = 1.2;
        for (const [nx, ny] of neighbors) {
          sum += current[ny * HEX_CONFIG.cols + nx];
          weight += 1;
        }
        next[idx] = sum / weight;
      }
    }
    current = next;
  }

  return current;
};

const distanceToWater = (elevations, levels) => {
  const len = HEX_CONFIG.cols * HEX_CONFIG.rows;
  const dist = new Array(len).fill(Infinity);
  const queue = [];

  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const idx = y * HEX_CONFIG.cols + x;
      if (elevations[idx] < levels.seaLevel) {
        dist[idx] = 0;
        queue.push([x, y]);
      }
    }
  }

  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = queue[i];
    const base = dist[y * HEX_CONFIG.cols + x];
    for (const [nx, ny] of getNeighbors(x, y)) {
      const nIdx = ny * HEX_CONFIG.cols + nx;
      if (dist[nIdx] > base + 1) {
        dist[nIdx] = base + 1;
        queue.push([nx, ny]);
      }
    }
  }

  return dist;
};


const getAdaptiveSeaLevels = (elevations) => {
  const sorted = [...elevations].sort((a, b) => a - b);
  const pickByRatio = (ratio) => {
    const idx = Math.floor(sorted.length * ratio);
    return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
  };

  let seaLevel = pickByRatio(0.62);
  const waterRatio = elevations.filter((value) => value < seaLevel).length / elevations.length;

  if (waterRatio > 0.9) seaLevel = pickByRatio(0.52);
  else if (waterRatio < 0.4) seaLevel = pickByRatio(0.78);

  const deepSeaLevel = seaLevel - 0.13;
  return { seaLevel, deepSeaLevel };
};

const classifyTerrain = (elevation, moisture, heat, nearSea, levels) => {
  if (elevation < levels.deepSeaLevel) return '심해';
  if (elevation < levels.seaLevel - HEX_CONFIG.coastBand) return '바다';
  if (elevation < levels.seaLevel) return '해안';
  if (elevation < levels.seaLevel + 0.012 && nearSea) return '모래해변';

  if (elevation > 0.9 && heat < 0.23) return '만년설산';
  if (elevation > 0.87 && moisture < 0.24) return '화산지대';
  if (elevation > HEX_CONFIG.mountainLevel) return '산맥';
  if (elevation > 0.69 && moisture < 0.33) return '협곡';
  if (elevation > 0.63) return '구릉지';

  if (moisture > 0.8 && heat > 0.54) return '습지';
  if (moisture > 0.7) return '고대림';
  if (moisture > 0.56) return '숲';
  if (moisture < 0.22 && heat > 0.58) return '사막';
  if (moisture < 0.3) return '황무지';
  return '평원';
};

const carveRivers = (tiles, random, levels) => {
  const get = (x, y) => tiles[y * HEX_CONFIG.cols + x];
  const sources = tiles.filter((tile) => tile.elevation > 0.72 && tile.moisture > 0.42);

  for (let i = 0; i < HEX_CONFIG.riverCount; i += 1) {
    const source = sources[Math.floor(random() * sources.length)];
    if (!source) continue;

    let x = source.coord.x;
    let y = source.coord.y;
    const visited = new Set();

    for (let step = 0; step < 150; step += 1) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);

      const current = get(x, y);
      if (!current || current.elevation <= levels.seaLevel) break;

      if (!['산맥', '만년설산', '화산지대'].includes(current.terrainType)) {
        current.terrainType = '강';
        current.color = HEX_CONFIG.terrains.강;
      }

      const neighbors = getNeighbors(x, y).map(([nx, ny]) => [nx, ny, get(nx, ny)]);
      neighbors.sort((a, b) => (a[2].elevation + random() * 0.005) - (b[2].elevation + random() * 0.005));
      const next = neighbors.find(([, , tile]) => tile.elevation <= current.elevation + 0.005);
      if (!next) break;
      [x, y] = next;
    }
  }
};

const buildWorldMap = (seed) => {
  const random = mulberry32(seed);
  const plates = generatePlates(random);
  const count = HEX_CONFIG.cols * HEX_CONFIG.rows;

  const elevations = new Array(count).fill(0);
  const moistures = new Array(count).fill(0);
  const heats = new Array(count).fill(0);

  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    const latitude = Math.abs((y / (HEX_CONFIG.rows - 1)) * 2 - 1);

    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const idx = y * HEX_CONFIG.cols + x;
      const plateBase = plateElevation(x, y, plates);
      const continentalNoise = domainWarpNoise(x, y, seed + 17, HEX_CONFIG.elevationFrequency);
      const ruggedNoise = domainWarpNoise(x * 1.8, y * 1.8, seed + 97, HEX_CONFIG.elevationFrequency * 1.8);
      const islandMask = edgeFalloff(x, y);

      const elevation = clamp01((plateBase * 0.58 + continentalNoise * 0.29 + ruggedNoise * 0.13) * islandMask + (1 - islandMask) * 0.06);
      elevations[idx] = elevation;

      const heatNoise = fbm(x * HEX_CONFIG.heatFrequency, y * HEX_CONFIG.heatFrequency, seed + 401, 4);
      heats[idx] = clamp01((1 - latitude * 0.82) * 0.74 + heatNoise * 0.26);

      const rainNoise = domainWarpNoise(x, y, seed + 719, 0.016);
      moistures[idx] = clamp01(rainNoise * 0.8 + (1 - elevation) * 0.2);
    }
  }

  const smoothElev = smoothField(elevations, 2);
  const levels = getAdaptiveSeaLevels(smoothElev);
  const waterDistance = distanceToWater(smoothElev, levels);

  const tiles = [];
  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const idx = y * HEX_CONFIG.cols + x;
      const elevation = smoothElev[idx];
      const coastMoisture = clamp01(1 - waterDistance[idx] / 18);
      const moisture = clamp01(moistures[idx] * 0.72 + coastMoisture * 0.28);
      const heat = heats[idx];

      const nearSea = getNeighbors(x, y).some(([nx, ny]) => smoothElev[ny * HEX_CONFIG.cols + nx] < levels.seaLevel);
      const terrainType = classifyTerrain(elevation, moisture, heat, nearSea, levels);

      tiles.push({
        coord: { x, y, z: HEX_CONFIG.z },
        elevation,
        moisture,
        heat,
        terrainType,
        manaSaturation: Math.round((0.3 + moisture * 0.5 + heat * 0.2) * 100),
        security: Math.round(clamp01(0.68 - Math.abs(elevation - 0.58) * 0.56 + moisture * 0.18) * 100),
        nationId: null,
        settlementId: null,
        influenceId: null,
        sparkleLight: Number(((0.26 + moisture * 0.4 + heat * 0.34) * 100).toFixed(2)),
        specialProduct: null,
        threatInfo: null,
        specialTileType: null,
        color: HEX_CONFIG.terrains[terrainType] || '#ffffff'
      });
    }
  }

  carveRivers(tiles, random, levels);
  return tiles;
};

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

const renderWorld = (tiles, seed) => {
  const hexWidth = SQRT3 * HEX_CONFIG.size;
  const hexHeight = HEX_CONFIG.size * 2;
  const width = Math.ceil(hexWidth * (HEX_CONFIG.cols + 0.5) + 16);
  const height = Math.ceil(HEX_CONFIG.size * 1.5 * (HEX_CONFIG.rows - 1) + hexHeight + 16);

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  tiles.forEach((tile) => {
    const { x, y } = hexToPixel(tile.coord.x, tile.coord.y, HEX_CONFIG.size);
    drawHex(x + 8, y + 8, HEX_CONFIG.size, tile.color);
  });

  const terrainStat = tiles.reduce((acc, tile) => {
    acc[tile.terrainType] = (acc[tile.terrainType] || 0) + 1;
    return acc;
  }, {});

  const landCount = Object.entries(terrainStat)
    .filter(([name]) => !['심해', '바다', '해안', '모래해변', '호수'].includes(name))
    .reduce((sum, [, count]) => sum + count, 0);

  const riverCount = terrainStat.강 || 0;
  mapMeta.textContent = `seed: ${seed} · hex: ${HEX_CONFIG.cols}x${HEX_CONFIG.rows} (${tiles.length.toLocaleString()} tiles) · 육지 ${landCount.toLocaleString()} / 해양 ${(tiles.length - landCount).toLocaleString()} · 강 ${riverCount.toLocaleString()}`;
};

const generateAndRender = () => {
  const seed = createSeed();
  const tiles = buildWorldMap(seed);
  renderWorld(tiles, seed);
};

versionTag.textContent = WORLD_VERSION;
regenButton.addEventListener('click', generateAndRender);

generateAndRender();
