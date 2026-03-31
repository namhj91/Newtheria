const HEX_CONFIG = {
  cols: 200,
  rows: 200,
  z: 0,
  size: 4,
  seaLevel: 0.5,
  deepSeaLevel: 0.34,
  coastBand: 0.03,
  mountainLevel: 0.8,
  snowTemp: 0.2,
  riverCount: 140,
  elevationFrequency: 0.014,
  moistureFrequency: 0.02,
  heatFrequency: 0.01,
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

const SQRT3 = Math.sqrt(3);
const OFFSETS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1]
];

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
  return Math.max(0, 1 - Math.pow(d, 1.8));
};

const classifyTerrain = (tile, isNearSea) => {
  const { elevation, moisture, heat } = tile;

  if (elevation < HEX_CONFIG.deepSeaLevel) return '심해';
  if (elevation < HEX_CONFIG.seaLevel - HEX_CONFIG.coastBand) return '바다';
  if (elevation < HEX_CONFIG.seaLevel) return '해안';
  if (elevation < HEX_CONFIG.seaLevel + 0.01 && isNearSea) return '모래해변';

  if (elevation > 0.91 && heat < HEX_CONFIG.snowTemp) return '만년설산';
  if (elevation > 0.88 && moisture < 0.22) return '화산지대';
  if (elevation > HEX_CONFIG.mountainLevel) return '산맥';
  if (elevation > 0.72 && moisture < 0.30) return '협곡';
  if (elevation > 0.64) return '구릉지';

  if (moisture > 0.78 && heat > 0.55) return '습지';
  if (moisture > 0.72) return '고대림';
  if (moisture > 0.56) return '숲';
  if (moisture < 0.2 && heat > 0.6) return '사막';
  if (moisture < 0.28) return '황무지';
  return '평원';
};

const carveRivers = (tiles, random) => {
  const get = (x, y) => tiles[y * HEX_CONFIG.cols + x];
  const landTiles = tiles.filter((tile) => tile.elevation >= HEX_CONFIG.seaLevel + 0.02);

  for (let i = 0; i < HEX_CONFIG.riverCount; i += 1) {
    const source = landTiles[Math.floor(random() * landTiles.length)];
    if (!source || source.elevation < 0.7) continue;

    let x = source.coord.x;
    let y = source.coord.y;
    const visited = new Set();

    for (let step = 0; step < 130; step += 1) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);

      const current = get(x, y);
      if (!current) break;
      if (current.elevation <= HEX_CONFIG.seaLevel) break;

      if (current.terrainType !== '산맥' && current.terrainType !== '만년설산') {
        current.terrainType = '강';
        current.color = HEX_CONFIG.terrains.강;
      }

      const neighbors = getNeighbors(x, y);
      let next = null;
      let nextScore = current.elevation;

      for (const [nx, ny] of neighbors) {
        const candidate = get(nx, ny);
        const slope = candidate.elevation + (random() * 0.01);
        if (slope < nextScore) {
          nextScore = slope;
          next = [nx, ny];
        }
      }

      if (!next) break;
      [x, y] = next;
    }
  }
};

const buildWorldMap = (seed) => {
  const random = mulberry32(seed);
  const tiles = [];

  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    const latitude = Math.abs((y / (HEX_CONFIG.rows - 1)) * 2 - 1);

    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const nx = x * HEX_CONFIG.elevationFrequency;
      const ny = y * HEX_CONFIG.elevationFrequency;
      const mx = x * HEX_CONFIG.moistureFrequency;
      const my = y * HEX_CONFIG.moistureFrequency;
      const hx = x * HEX_CONFIG.heatFrequency;
      const hy = y * HEX_CONFIG.heatFrequency;

      const continental = fbm(nx, ny, seed, 5);
      const rugged = fbm(nx * 2.6, ny * 2.6, seed + 97, 4) * 0.35;
      const elevation = continental * 0.7 + rugged * 0.3;

      const heatNoise = fbm(hx, hy, seed + 211, 4);
      const heat = Math.min(1, Math.max(0, (1 - latitude * 0.78) * 0.74 + heatNoise * 0.26));

      const rainShadow = fbm((x + 700) * HEX_CONFIG.moistureFrequency, (y - 300) * HEX_CONFIG.moistureFrequency, seed + 509, 4);
      const moisture = Math.min(1, Math.max(0, fbm(mx, my, seed + 401, 4) * 0.75 + (1 - elevation) * 0.2 + rainShadow * 0.05));

      const island = edgeFalloff(x, y);
      const finalElevation = Math.min(1, Math.max(0, elevation * island + (1 - island) * 0.08));

      tiles.push({
        coord: { x, y, z: HEX_CONFIG.z },
        elevation: finalElevation,
        moisture,
        heat,
        terrainType: '바다',
        manaSaturation: Math.round((0.35 + moisture * 0.45 + heat * 0.2) * 100),
        security: Math.round((0.65 - Math.abs(finalElevation - 0.58) * 0.6 + moisture * 0.2) * 100),
        nationId: null,
        settlementId: null,
        influenceId: null,
        sparkleLight: Number(((0.25 + moisture * 0.4 + heat * 0.35) * 100).toFixed(2)),
        specialProduct: null,
        threatInfo: null,
        specialTileType: null,
        color: HEX_CONFIG.terrains.바다
      });
    }
  }

  tiles.forEach((tile) => {
    const { x, y } = tile.coord;
    const nearSea = getNeighbors(x, y).some(([nx, ny]) => {
      const neighbor = tiles[ny * HEX_CONFIG.cols + nx];
      return neighbor.elevation < HEX_CONFIG.seaLevel;
    });
    tile.terrainType = classifyTerrain(tile, nearSea);
    tile.color = HEX_CONFIG.terrains[tile.terrainType] || '#ffffff';
  });

  carveRivers(tiles, random);

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

  mapMeta.textContent = `seed: ${seed} · hex: ${HEX_CONFIG.cols}x${HEX_CONFIG.rows} (${tiles.length.toLocaleString()} tiles) · 육지 ${landCount.toLocaleString()} / 해양 ${(tiles.length - landCount).toLocaleString()}`;
};

const generateAndRender = () => {
  const seed = createSeed();
  const tiles = buildWorldMap(seed);
  renderWorld(tiles, seed);
};

regenButton.addEventListener('click', generateAndRender);

generateAndRender();
