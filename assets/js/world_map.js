const WORLD_VERSION = 'ver.0.0.54(260331-노이즈강도상향)';

const HEX_CONFIG = {
  cols: 210,
  rows: 180,
  z: 0,
  size: 4,
  seaLevelRatio: 0.58,
  deepSeaOffset: 0.12,
  coastBand: 0.02,
  mountainLevel: 0.78,
  plateCount: 18,
  elevationFrequency: 0.0125,
  moistureFrequency: 0.0135,
  heatFrequency: 0.0092,
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

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);

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

const domainWarp = (baseNoise, x, y, freq, strength = 28) => {
  const wx = fbmPerlin(baseNoise, x * freq * 0.7 + 13, y * freq * 0.7 - 9, 3);
  const wy = fbmPerlin(baseNoise, x * freq * 0.7 - 11, y * freq * 0.7 + 7, 3);
  return {
    x: x + wx * strength,
    y: y + wy * strength
  };
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

const edgeMask = (x, y) => {
  const cx = (HEX_CONFIG.cols - 1) / 2;
  const cy = (HEX_CONFIG.rows - 1) / 2;
  const dx = Math.abs(x - cx) / cx;
  const dy = Math.abs(y - cy) / cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, 1 - Math.pow(d, 1.9));
};

const generatePlates = (seed) => {
  const random = mulberry32(seed ^ 0x6a09e667);
  const plates = [];
  for (let i = 0; i < HEX_CONFIG.plateCount; i += 1) {
    const angle = random() * Math.PI * 2;
    plates.push({
      x: Math.floor(random() * HEX_CONFIG.cols),
      y: Math.floor(random() * HEX_CONFIG.rows),
      vx: Math.cos(angle),
      vy: Math.sin(angle),
      continental: random() > 0.45,
      uplift: random() * 0.3 + 0.12
    });
  }
  return plates;
};

const plateField = (x, y, plates) => {
  let first = Infinity;
  let second = Infinity;
  let owner = plates[0];

  for (const p of plates) {
    const dx = x - p.x;
    const dy = y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < first) {
      second = first;
      first = dist;
      owner = p;
    } else if (dist < second) {
      second = dist;
    }
  }

  const boundary = clamp01(1 - (second - first) / 11);
  const divergence = clamp01(Math.abs(owner.vx * (x - owner.x) + owner.vy * (y - owner.y)) / 24);
  const base = owner.continental ? 0.54 + owner.uplift * 0.26 : 0.32 + owner.uplift * 0.14;

  return {
    base,
    boundary,
    divergence,
    continental: owner.continental
  };
};

const smoothField = (field, passes = 1) => {
  let current = field.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
      for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
        const idx = y * HEX_CONFIG.cols + x;
        const neighbors = getNeighbors(x, y);
        let sum = current[idx] * 1.35;
        let w = 1.35;
        for (const [nx, ny] of neighbors) {
          sum += current[ny * HEX_CONFIG.cols + nx];
          w += 1;
        }
        next[idx] = sum / w;
      }
    }
    current = next;
  }
  return current;
};

const applyErosion = (field, passes = 1) => {
  let current = field.slice();
  for (let step = 0; step < passes; step += 1) {
    const next = current.slice();
    for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
      for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
        const idx = y * HEX_CONFIG.cols + x;
        const neighbors = getNeighbors(x, y).map(([nx, ny]) => current[ny * HEX_CONFIG.cols + nx]);
        const avg = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
        const slope = current[idx] - avg;
        const erode = slope > 0.04 ? slope * 0.18 : 0;
        next[idx] = clamp01(current[idx] - erode);
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

  let seaLevel = pick(HEX_CONFIG.seaLevelRatio);
  const waterRatio = elevations.filter((v) => v < seaLevel).length / elevations.length;

  if (waterRatio > 0.88) seaLevel = pick(0.54);
  else if (waterRatio < 0.42) seaLevel = pick(0.7);

  return { seaLevel, deepSeaLevel: seaLevel - HEX_CONFIG.deepSeaOffset };
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

const classifyTerrain = (elevation, moisture, heat, nearSea, levels) => {
  if (elevation < levels.deepSeaLevel) return '심해';
  if (elevation < levels.seaLevel - HEX_CONFIG.coastBand) return '바다';
  if (elevation < levels.seaLevel) return '해안';
  if (elevation < levels.seaLevel + 0.01 && nearSea) return '모래해변';

  if (elevation > 0.9 && heat < 0.25) return '만년설산';
  if (elevation > 0.85 && moisture < 0.24) return '화산지대';
  if (elevation > HEX_CONFIG.mountainLevel) return '산맥';
  if (elevation > 0.68 && moisture < 0.34) return '협곡';
  if (elevation > 0.62) return '구릉지';

  if (moisture > 0.82 && heat > 0.56) return '습지';
  if (moisture > 0.7) return '고대림';
  if (moisture > 0.56) return '숲';
  if (moisture < 0.22 && heat > 0.6) return '사막';
  if (moisture < 0.32) return '황무지';
  return '평원';
};

const carveRivers = (tiles, random, levels, riverBudget) => {
  const get = (x, y) => tiles[y * HEX_CONFIG.cols + x];
  let sources = tiles.filter((tile) => tile.elevation > 0.64 && tile.moisture > 0.34);

  if (sources.length < 30) {
    sources = [...tiles]
      .sort((a, b) => (b.elevation + b.moisture * 0.24) - (a.elevation + a.moisture * 0.24))
      .slice(0, 500);
  }

  for (let i = 0; i < riverBudget; i += 1) {
    const source = sources[Math.floor(random() * sources.length)];
    if (!source) continue;

    let x = source.coord.x;
    let y = source.coord.y;
    const visited = new Set();

    for (let step = 0; step < 180; step += 1) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);

      const current = get(x, y);
      if (!current || current.elevation <= levels.seaLevel) break;

      if (!['산맥', '만년설산', '화산지대'].includes(current.terrainType)) {
        current.terrainType = '강';
        current.color = HEX_CONFIG.terrains.강;
      }

      const candidates = getNeighbors(x, y).map(([nx, ny]) => [nx, ny, get(nx, ny)]);
      candidates.sort((a, b) => (a[2].elevation + random() * 0.004) - (b[2].elevation + random() * 0.004));
      const next = candidates.find(([, , tile]) => tile.elevation <= current.elevation + 0.004);
      if (!next) break;
      [x, y] = next;
    }
  }
};

const buildWorldMap = (seed) => {
  const random = mulberry32(seed);
  const perlinElevation = createPerlin2D(seed ^ 0xa54ff53a);
  const perlinMoisture = createPerlin2D(seed ^ 0x510e527f);
  const perlinHeat = createPerlin2D(seed ^ 0x9b05688c);
  const plates = generatePlates(seed);

  const count = HEX_CONFIG.cols * HEX_CONFIG.rows;
  const elevations = new Array(count).fill(0);
  const moistures = new Array(count).fill(0);
  const heats = new Array(count).fill(0);

  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    const latitude = Math.abs((y / (HEX_CONFIG.rows - 1)) * 2 - 1);

    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const idx = y * HEX_CONFIG.cols + x;
      const plate = plateField(x, y, plates);
      const warped = domainWarp(perlinElevation, x, y, HEX_CONFIG.elevationFrequency, 28);

      const continentNoise = fbmPerlin(
        perlinElevation,
        warped.x * HEX_CONFIG.elevationFrequency,
        warped.y * HEX_CONFIG.elevationFrequency,
        6,
        2,
        0.56
      );
      const ridgeNoise = fbmPerlin(
        perlinElevation,
        x * HEX_CONFIG.elevationFrequency * 2.8,
        y * HEX_CONFIG.elevationFrequency * 2.8,
        4,
        2.15,
        0.6
      );
      const basinNoise = fbmPerlin(
        perlinElevation,
        x * HEX_CONFIG.elevationFrequency * 1.05 - 21,
        y * HEX_CONFIG.elevationFrequency * 1.05 + 19,
        5,
        2.1,
        0.58
      );
      const detailNoise = fbmPerlin(
        perlinElevation,
        x * HEX_CONFIG.elevationFrequency * 4.1 + 37,
        y * HEX_CONFIG.elevationFrequency * 4.1 - 53,
        3,
        2.2,
        0.62
      );

      const ridgeLift = plate.boundary * 0.23 + (1 - plate.divergence) * 0.1;
      const trenchCut = clamp01((0.16 - basinNoise) * 2.2) * (1 - plate.boundary) * 0.16;
      const masked = edgeMask(x, y);

      const elev = clamp01(
        (
          plate.base * 0.47
          + (continentNoise * 0.5 + 0.5) * 0.24
          + (ridgeNoise * 0.5 + 0.5) * 0.18
          + (detailNoise * 0.5 + 0.5) * 0.1
          + ridgeLift
        ) * masked
        + (1 - masked) * 0.05
        - trenchCut
      );
      elevations[idx] = elev;

      const heatNoise = fbmPerlin(
        perlinHeat,
        x * HEX_CONFIG.heatFrequency,
        y * HEX_CONFIG.heatFrequency,
        5,
        2,
        0.6
      );
      const seasonal = Math.sin((y / HEX_CONFIG.rows) * Math.PI * 4 + seed * 0.000001) * 0.055;
      heats[idx] = clamp01((1 - latitude * 0.82) * 0.72 + (heatNoise * 0.5 + 0.5) * 0.24 + seasonal);

      const moistureNoise = fbmPerlin(
        perlinMoisture,
        x * HEX_CONFIG.moistureFrequency,
        y * HEX_CONFIG.moistureFrequency,
        6,
        2,
        0.58
      );
      const wind = Math.sin((x / HEX_CONFIG.cols) * Math.PI * 3 + y * 0.04) * 0.07;
      const rainShadow = clamp01(1 - Math.max(0, elev - 0.62) * 1.2);
      moistures[idx] = clamp01((moistureNoise * 0.5 + 0.5) * 0.68 + (1 - elev) * 0.16 + wind * 0.08 + rainShadow * 0.08);
    }
  }

  const smoothElev = applyErosion(smoothField(elevations, 2), 1);
  const levels = getAdaptiveSeaLevels(smoothElev);
  const waterDist = distanceToWater(smoothElev, levels);

  const tiles = [];
  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const idx = y * HEX_CONFIG.cols + x;
      const elevation = smoothElev[idx];
      const coastMoisture = clamp01(1 - waterDist[idx] / 17);
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
        manaSaturation: Math.round((0.28 + moisture * 0.52 + heat * 0.2) * 100),
        security: Math.round(clamp01(0.7 - Math.abs(elevation - 0.56) * 0.54 + moisture * 0.17) * 100),
        nationId: null,
        settlementId: null,
        influenceId: null,
        sparkleLight: Number(((0.22 + moisture * 0.43 + heat * 0.35) * 100).toFixed(2)),
        specialProduct: null,
        threatInfo: null,
        specialTileType: null,
        color: HEX_CONFIG.terrains[terrainType] || '#ffffff'
      });
    }
  }

  const landTiles = tiles.filter((tile) => !['심해', '바다', '해안', '모래해변', '호수'].includes(tile.terrainType));
  const avgLandMoisture = landTiles.length
    ? landTiles.reduce((sum, tile) => sum + tile.moisture, 0) / landTiles.length
    : 0;
  const riverBudget = Math.max(
    90,
    Math.floor(210 * (0.6 + avgLandMoisture * 0.8) * (landTiles.length / tiles.length + 0.28))
  );

  carveRivers(tiles, random, levels, riverBudget);
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
