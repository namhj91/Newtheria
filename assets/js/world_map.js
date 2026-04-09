const WORLD_VERSION = 'ver.0.0.62(260409-중앙대륙강제제거)';
const MAP_SIZE = 200;

const HEX_CONFIG = {
  cols: MAP_SIZE,
  rows: MAP_SIZE,
  z: 0,
  size: 4,
  seaLevelRatio: 0.58,
  deepSeaOffset: 0.12,
  coastBand: 0.02,
  mountainLevel: 0.78,
  elevationFrequency: 0.0125,
  moistureFrequency: 0.0135,
  heatFrequency: 0.0092,
  terrains: {
    심해: '#203b78',
    바다: '#2e5ca6',
    산호초해안: '#0ea5e9',
    얕은해안: '#38bdf8',
    해안: '#4a90d9',
    모래해변: '#d4c08f',
    호수: '#3f76ca',
    강: '#4f8fd8',
    사바나평원: '#65a30d',
    푸른평원: '#4ade80',
    울창한숲: '#15803d',
    침엽수림: '#0f766e',
    태고의대수림: '#064e3b',
    열대우림: '#065f46',
    구릉지: '#90a86f',
    붉은대협곡: '#9a3412',
    험준한산맥: '#52525b',
    화산지대: '#9c4b3a',
    만년설산: '#e6eef8',
    늪지대: '#4d7c0f',
    얼어붙은툰드라: '#a1a1aa',
    건조사막: '#fde047',
    사막오아시스: '#34d399',
    세계수중심: '#10b981',
    고대용의둥지: '#9f1239',
    빛나는수정동굴: '#6d28d9',
    고대성소유적: '#94a3b8'
  }
};

const canvas = document.getElementById('worldMapCanvas');
const ctx = canvas.getContext('2d');
const regenButton = document.getElementById('regenButton');
const mapMeta = document.getElementById('mapMeta');
const versionTag = document.getElementById('worldMapVersion');

const SQRT3 = Math.sqrt(3);

const createSeed = () => Math.floor(Math.random() * 4294967295);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);

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

  let seaLevel = pick(HEX_CONFIG.seaLevelRatio);
  const waterRatio = elevations.filter((v) => v < seaLevel).length / elevations.length;
  if (waterRatio > 0.88) seaLevel = pick(0.54);
  else if (waterRatio < 0.42) seaLevel = pick(0.7);

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

const isWaterTerrain = (terrainType) => ['심해', '바다', '얕은해안', '산호초해안', '해안', '호수'].includes(terrainType);

const classifyTerrain = (elevation, moisture, heat, nearSea, levels) => {
  if (elevation < levels.deepSeaLevel) return '심해';
  if (elevation < levels.seaLevel - HEX_CONFIG.coastBand * 0.7) return '바다';
  if (elevation < levels.seaLevel - HEX_CONFIG.coastBand * 0.25) return heat > 0.75 ? '산호초해안' : '얕은해안';
  if (elevation < levels.seaLevel) return nearSea ? '해안' : '얕은해안';
  if (elevation < levels.seaLevel + 0.01 && nearSea) return '모래해변';

  if (elevation > 0.75) {
    if (heat > 0.7 && moisture < 0.45) return elevation > 0.85 ? '붉은대협곡' : '화산지대';
    if (heat < 0.35 || (moisture > 0.5 && elevation > 0.85)) return '만년설산';
    return '험준한산맥';
  }
  if (elevation > 0.62) return '구릉지';

  if (heat > 0.65) {
    if (moisture > 0.6) return '열대우림';
    if (moisture < 0.3) return moisture > 0.22 && heat < 0.8 ? '사막오아시스' : '건조사막';
    return '사바나평원';
  }
  if (heat > 0.35) {
    if (moisture > 0.8) return '늪지대';
    if (moisture > 0.45) return '울창한숲';
    return '푸른평원';
  }
  return moisture > 0.4 ? '침엽수림' : '얼어붙은툰드라';
};

const RESOURCE_RULES = [
  { id: 'herbs', terrains: ['푸른평원', '사바나평원'], prob: 0.06 },
  { id: 'timber', terrains: ['울창한숲', '침엽수림', '태고의대수림', '열대우림'], prob: 0.08 },
  { id: 'obsidian', terrains: ['화산지대', '붉은대협곡'], prob: 0.05 },
  { id: 'crystal', terrains: ['만년설산', '험준한산맥', '빛나는수정동굴'], prob: 0.035 },
  { id: 'mana_bloom', terrains: ['사막오아시스', '세계수중심', '고대성소유적'], prob: 0.03 }
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
          waterTile.color = HEX_CONFIG.terrains.호수;
        });
      }
    }
  }
};

const placeMythicLandmarks = (tiles, random, width, height) => {
  const landTiles = tiles.filter((tile) => !isWaterTerrain(tile.terrainType) && tile.terrainType !== '모래해변');
  if (!landTiles.length) return;

  const worldTree = landTiles[Math.floor(random() * landTiles.length)];
  worldTree.terrainType = '세계수중심';
  worldTree.specialTileType = 'world_tree';
  worldTree.manaSaturation = 100;
  worldTree.sparkleLight = 100;
  worldTree.color = HEX_CONFIG.terrains.세계수중심;

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
      target.terrainType = '태고의대수림';
      target.color = HEX_CONFIG.terrains.태고의대수림;
      target.manaSaturation = Math.max(90, target.manaSaturation);
      forestSeeds.push(target);
    }
    attempts += 1;
  }

  const peaks = landTiles.filter((tile) => ['험준한산맥', '화산지대', '붉은대협곡'].includes(tile.terrainType));
  if (peaks.length) {
    const dragonPeak = peaks.reduce((max, tile) => (tile.elevation > max.elevation ? tile : max), peaks[0]);
    dragonPeak.terrainType = '고대용의둥지';
    dragonPeak.specialTileType = 'dragon_peak';
    dragonPeak.manaSaturation = 100;
    dragonPeak.sparkleLight = 100;
    dragonPeak.color = HEX_CONFIG.terrains.고대용의둥지;
  }

  const coldTiles = landTiles.filter((tile) => ['만년설산', '얼어붙은툰드라'].includes(tile.terrainType));
  if (coldTiles.length) {
    const cave = coldTiles[Math.floor(random() * coldTiles.length)];
    cave.terrainType = '빛나는수정동굴';
    cave.specialTileType = 'crystal_cave';
    cave.manaSaturation = 100;
    cave.sparkleLight = 100;
    cave.color = HEX_CONFIG.terrains.빛나는수정동굴;
  }

  const plains = landTiles.filter((tile) => ['푸른평원', '사막오아시스', '사바나평원'].includes(tile.terrainType));
  if (plains.length) {
    const monolith = plains[Math.floor(random() * plains.length)];
    monolith.terrainType = '고대성소유적';
    monolith.specialTileType = 'ancient_monolith';
    monolith.manaSaturation = 100;
    monolith.sparkleLight = 100;
    monolith.color = HEX_CONFIG.terrains.고대성소유적;
  }
};

const carveRivers = (tiles, random, levels, width, height, riverBudget) => {
  const get = (x, y) => tiles[y * width + x];
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

      if (!['험준한산맥', '만년설산', '화산지대', '고대용의둥지'].includes(current.terrainType)) {
        current.terrainType = '강';
        current.color = HEX_CONFIG.terrains.강;
      }

      const candidates = getNeighbors(x, y, width, height).map(([nx, ny]) => [nx, ny, get(nx, ny)]);
      candidates.sort((a, b) => (a[2].elevation + random() * 0.004) - (b[2].elevation + random() * 0.004));
      const next = candidates.find(([, , tile]) => tile.elevation <= current.elevation + 0.004);
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
      const macroElevation = fbmPerlin(noiseContext.elevation, x * HEX_CONFIG.elevationFrequency, y * HEX_CONFIG.elevationFrequency, 5, 2, 0.56);
      const regionalElevation = fbmPerlin(noiseContext.elevation, x * HEX_CONFIG.elevationFrequency * 2.2 + 37, y * HEX_CONFIG.elevationFrequency * 2.2 - 41, 4, 2, 0.58);
      const microElevation = fbmPerlin(noiseContext.elevation, x * HEX_CONFIG.elevationFrequency * 4.6 - 13, y * HEX_CONFIG.elevationFrequency * 4.6 + 17, 3, 2.05, 0.6);
      const oceanScatter = fbmPerlin(noiseContext.elevation, x * HEX_CONFIG.elevationFrequency * 0.75 + 101, y * HEX_CONFIG.elevationFrequency * 0.75 - 73, 2, 2, 0.5);

      const elevation = clamp01(
        ((macroElevation * 0.5 + 0.5) * 0.56
        + (regionalElevation * 0.5 + 0.5) * 0.3
        + (microElevation * 0.5 + 0.5) * 0.14)
        - (oceanScatter * 0.5 + 0.5) * 0.07
      );
      elevations[idx] = elevation;

      const heatLarge = fbmPerlin(noiseContext.heat, x * HEX_CONFIG.heatFrequency, y * HEX_CONFIG.heatFrequency, 5, 2, 0.6);
      const heatDetail = fbmPerlin(noiseContext.heat, x * HEX_CONFIG.heatFrequency * 3.5 + 12, y * HEX_CONFIG.heatFrequency * 3.5 - 9, 3, 2.1, 0.58);
      heats[idx] = clamp01(equatorBase * 0.52 + (heatLarge * 0.5 + 0.5) * 0.32 + (heatDetail * 0.5 + 0.5) * 0.16);

      const moistureLarge = fbmPerlin(noiseContext.moisture, x * HEX_CONFIG.moistureFrequency, y * HEX_CONFIG.moistureFrequency, 6, 2, 0.58);
      const moistureDetail = fbmPerlin(noiseContext.moisture, x * HEX_CONFIG.moistureFrequency * 3.9 - 17, y * HEX_CONFIG.moistureFrequency * 3.9 + 29, 4, 2.05, 0.57);
      const elevationPenalty = Math.max(0, elevation - 0.64) * 0.24;
      moistures[idx] = clamp01((moistureLarge * 0.5 + 0.5) * 0.62 + (moistureDetail * 0.5 + 0.5) * 0.26 + (1 - elevation) * 0.12 - elevationPenalty);
    }
  }

  return {
    elevations: smoothField(elevations, width, height, 2),
    moistures: smoothField(moistures, width, height, 1),
    heats: smoothField(heats, width, height, 1)
  };
};

const buildTiles = (width, height, fields, levels, waterDist) => {
  const tiles = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const elevation = fields.elevations[idx];
      const coastMoisture = clamp01(1 - waterDist[idx] / 17);
      const moisture = clamp01(fields.moistures[idx] * 0.72 + coastMoisture * 0.28);
      const heat = fields.heats[idx];

      const nearSea = getNeighbors(x, y, width, height).some(([nx, ny]) => fields.elevations[ny * width + nx] < levels.seaLevel);
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

  const tiles = buildTiles(width, height, rawFields, levels, waterDist);
  convertSmallWaterBodiesToLakes(tiles, width, height, 200);
  assignTerrainResources(tiles, random);
  placeMythicLandmarks(tiles, random, width, height);

  const landTiles = tiles.filter((tile) => !['심해', '바다', '얕은해안', '산호초해안', '해안', '모래해변', '호수'].includes(tile.terrainType));
  const avgLandMoisture = landTiles.length ? landTiles.reduce((sum, tile) => sum + tile.moisture, 0) / landTiles.length : 0;
  const riverBudget = Math.max(90, Math.floor(210 * (0.6 + avgLandMoisture * 0.8) * (landTiles.length / tiles.length + 0.28)));

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
    drawHex(x + 8, y + 8, HEX_CONFIG.size, tile.color);
  });

  const terrainStat = tiles.reduce((acc, tile) => {
    acc[tile.terrainType] = (acc[tile.terrainType] || 0) + 1;
    return acc;
  }, {});

  const landCount = Object.entries(terrainStat)
    .filter(([name]) => !['심해', '바다', '얕은해안', '산호초해안', '해안', '모래해변', '호수'].includes(name))
    .reduce((sum, [, count]) => sum + count, 0);

  const riverCount = terrainStat.강 || 0;
  mapMeta.textContent = `seed: ${seed} · hex: ${width}x${height} (${tiles.length.toLocaleString()} tiles) · 육지 ${landCount.toLocaleString()} / 해양 ${(tiles.length - landCount).toLocaleString()} · 강 ${riverCount.toLocaleString()} · riverBudget ${riverBudget}`;
};

const generateAndRender = () => {
  const world = generateWorldMap(MAP_SIZE, MAP_SIZE);
  renderWorld(world);
};

versionTag.textContent = WORLD_VERSION;
regenButton.addEventListener('click', generateAndRender);

generateAndRender();
