const HEX_CONFIG = {
  cols: 200,
  rows: 200,
  z: 0,
  size: 4,
  terrains: [
    { name: '평원', color: '#7fbf5f', weight: 22 },
    { name: '숲', color: '#4d8f45', weight: 14 },
    { name: '고대림', color: '#2f6940', weight: 6 },
    { name: '구릉지', color: '#8ca36a', weight: 11 },
    { name: '협곡', color: '#6f5f53', weight: 5 },
    { name: '산맥', color: '#9098a2', weight: 8 },
    { name: '화산지대', color: '#9f4d3c', weight: 2 },
    { name: '만년설산', color: '#e4eef9', weight: 3 },
    { name: '습지', color: '#5a7c4e', weight: 6 },
    { name: '황무지', color: '#9d8f65', weight: 7 },
    { name: '사막', color: '#d5bf7b', weight: 8 },
    { name: '모래해변', color: '#d9c796', weight: 5 },
    { name: '강', color: '#4f8fd8', weight: 4 },
    { name: '호수', color: '#4276c7', weight: 3 },
    { name: '해안', color: '#5ca6dc', weight: 4 },
    { name: '바다', color: '#3366b8', weight: 9 },
    { name: '심해', color: '#213e7d', weight: 3 }
  ]
};

const canvas = document.getElementById('worldMapCanvas');
const ctx = canvas.getContext('2d');
const regenButton = document.getElementById('regenButton');
const mapMeta = document.getElementById('mapMeta');

const SQRT3 = Math.sqrt(3);

const hexToPixel = (q, r, size) => ({
  x: size * SQRT3 * (q + (r % 2) / 2),
  y: size * 1.5 * r
});

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

const makeTerrainPicker = (terrains) => {
  const total = terrains.reduce((acc, terrain) => acc + terrain.weight, 0);
  const table = terrains.map((terrain) => {
    const ratio = terrain.weight / total;
    return { ...terrain, ratio };
  });

  return (random) => {
    let value = random();
    for (const terrain of table) {
      value -= terrain.ratio;
      if (value <= 0) return terrain;
    }
    return table[table.length - 1];
  };
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

const buildWorldMap = (seed) => {
  const random = mulberry32(seed);
  const pickTerrain = makeTerrainPicker(HEX_CONFIG.terrains);
  const tiles = [];

  for (let y = 0; y < HEX_CONFIG.rows; y += 1) {
    for (let x = 0; x < HEX_CONFIG.cols; x += 1) {
      const terrain = pickTerrain(random);
      tiles.push({
        coord: { x, y, z: HEX_CONFIG.z },
        terrainType: terrain.name,
        manaSaturation: Math.round(random() * 100),
        security: Math.round(random() * 100),
        nationId: null,
        settlementId: null,
        influenceId: null,
        sparkleLight: Number((random() * 100).toFixed(2)),
        specialProduct: null,
        threatInfo: null,
        specialTileType: null,
        color: terrain.color
      });
    }
  }

  return tiles;
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

  mapMeta.textContent = `seed: ${seed} · hex: ${HEX_CONFIG.cols}x${HEX_CONFIG.rows} (${tiles.length.toLocaleString()} tiles) · 대략 정사각 200x200(40,000) 규모와 동급`; 
};

const generateAndRender = () => {
  const seed = createSeed();
  const tiles = buildWorldMap(seed);
  renderWorld(tiles, seed);
};

regenButton.addEventListener('click', generateAndRender);

generateAndRender();
